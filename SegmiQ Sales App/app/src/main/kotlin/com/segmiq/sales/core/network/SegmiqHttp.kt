package com.segmiq.sales.core.network

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.io.InterruptedIOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

val SegmiqJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

data class ApiConfig(val baseUrl: HttpUrl, val userAgent: String) {
    companion object {
        private val LOCAL_HOSTS = setOf("10.0.2.2", "localhost", "127.0.0.1")

        /** HTTPS is required except for a local development server in debug builds. */
        fun create(rawBaseUrl: String, userAgent: String, allowLocalCleartext: Boolean): ApiConfig {
            val url = rawBaseUrl.trim().trimEnd('/').toHttpUrl()
            val local = url.host in LOCAL_HOSTS
            require(url.isHttps || (allowLocalCleartext && local)) { "SegmiQ base URL must use HTTPS" }
            return ApiConfig(url, userAgent)
        }
    }
}

/** Marks a request that must carry a Bearer token: the signed-in user's, or [explicitToken]. */
data class AuthRequired(val explicitToken: String? = null) {
    override fun toString() = "AuthRequired(explicitToken=${if (explicitToken == null) "null" else "<redacted>"})"
}

fun interface TokenProvider {
    fun currentToken(): String?
}

fun interface SessionProblemListener {
    fun onSessionProblem(error: ApiError)
}

/**
 * Adds the Bearer token only to authenticated requests aimed at the configured SegmiQ host,
 * so the token can never be sent to another origin (e.g. a redirect or absolute URL).
 */
class BearerInterceptor(
    private val config: ApiConfig,
    private val tokens: TokenProvider,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()
            .header("User-Agent", config.userAgent)
            .header("Accept", "application/json")
        val sameOrigin = original.url.host == config.baseUrl.host &&
            original.url.scheme == config.baseUrl.scheme &&
            original.url.port == config.baseUrl.port
        val auth = original.tag(AuthRequired::class.java)
        if (auth != null && sameOrigin) {
            (auth.explicitToken ?: tokens.currentToken())?.let { builder.header("Authorization", "Bearer $it") }
        }
        return chain.proceed(builder.build())
    }
}

enum class HttpMethod { GET, POST, PATCH }

class SegmiqHttp(
    val config: ApiConfig,
    tokens: TokenProvider,
    private val sessionProblems: SessionProblemListener? = null,
    client: OkHttpClient? = null,
) {
    private val http: OkHttpClient = (client ?: defaultClient()).newBuilder()
        .addInterceptor(BearerInterceptor(config, tokens))
        .followRedirects(false)
        .followSslRedirects(false)
        .build()

    suspend fun <T> request(
        method: HttpMethod,
        path: String,
        deserializer: DeserializationStrategy<T>,
        query: Map<String, String?> = emptyMap(),
        body: JsonObject? = null,
        authenticated: Boolean = true,
        background: Boolean = false,
        retries: Int = if (method == HttpMethod.GET) 1 else 0,
        explicitToken: String? = null,
        reportSessionProblems: Boolean = true,
        idempotencyKey: String? = null,
    ): ApiResult<T> {
        require(idempotencyKey == null || (idempotencyKey.length in 8..200 && idempotencyKey.all { it.isLetterOrDigit() || it in "-_.:" }))
        var attempt = 0
        while (true) {
            val result = once(method, path, deserializer, query, body, authenticated, background, explicitToken, idempotencyKey)
            val error = (result as? ApiResult.Failure)?.error
            val retryable = error != null && error.kind in RETRYABLE
            if (!retryable || attempt >= retries) {
                val report = authenticated && reportSessionProblems && error != null &&
                    (error.endsSession || error.kind == ErrorKind.SUBSCRIPTION_SUSPENDED)
                if (report) sessionProblems?.onSessionProblem(error!!)
                return result
            }
            attempt += 1
            delay(600L * attempt)
        }
    }

    private suspend fun <T> once(
        method: HttpMethod,
        path: String,
        deserializer: DeserializationStrategy<T>,
        query: Map<String, String?>,
        body: JsonObject?,
        authenticated: Boolean,
        background: Boolean,
        explicitToken: String?,
        idempotencyKey: String?,
    ): ApiResult<T> = withContext(Dispatchers.IO) {
        // Headers arrive asynchronously, but ResponseBody.string() may still read the socket.
        // Keep body consumption, decoding and resource closure off the caller's UI thread.
        val url = config.baseUrl.newBuilder().apply {
            path.trimStart('/').split('/').forEach { addPathSegment(it) }
            query.forEach { (k, v) -> if (v != null) addQueryParameter(k, v) }
        }.build()
        val requestBody = when (method) {
            HttpMethod.GET -> null
            else -> (body ?: JsonObject(emptyMap())).toString().toRequestBody(JSON_MEDIA)
        }
        val request = Request.Builder().url(url).method(method.name, requestBody).apply {
            if (authenticated) tag(AuthRequired::class.java, AuthRequired(explicitToken))
            if (background) header("X-Segmiq-Activity", "background")
            if (idempotencyKey != null) header("Idempotency-Key", idempotencyKey)
        }.build()

        val response = try {
            http.newCall(request).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: SocketTimeoutException) {
            return@withContext ApiResult.Failure(ErrorMapper.timeout())
        } catch (e: InterruptedIOException) {
            return@withContext ApiResult.Failure(ErrorMapper.timeout())
        } catch (e: UnknownHostException) {
            return@withContext ApiResult.Failure(ErrorMapper.offline())
        } catch (e: IOException) {
            return@withContext ApiResult.Failure(ErrorMapper.offline())
        }

        response.use { res ->
            val text = try {
                res.body?.string()
            } catch (e: IOException) {
                return@use ApiResult.Failure(ErrorMapper.offline())
            }
            val contentType = res.header("Content-Type")
            if (!res.isSuccessful) {
                ApiResult.Failure(ErrorMapper.fromHttp(res.code, text, contentType))
            } else if (contentType != null && !contentType.contains("json", ignoreCase = true)) {
                // A 2xx HTML page means the route is not served by this deployment.
                ApiResult.Failure(ErrorMapper.fromHttp(404, text, contentType))
            } else {
                try {
                    ApiResult.Success(SegmiqJson.decodeFromString(deserializer, text ?: ""))
                } catch (e: SerializationException) {
                    ApiResult.Failure(ErrorMapper.decoding())
                } catch (e: IllegalArgumentException) {
                    ApiResult.Failure(ErrorMapper.decoding())
                }
            }
        }
    }

    companion object {
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
        private val RETRYABLE = setOf(ErrorKind.OFFLINE, ErrorKind.TIMEOUT, ErrorKind.SERVER)

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .callTimeout(45, TimeUnit.SECONDS)
            .build()
    }
}

private suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = cont.resume(response)
        override fun onFailure(call: Call, e: IOException) {
            if (!cont.isCancelled) cont.resumeWithException(e)
        }
    })
    cont.invokeOnCancellation { runCatching { cancel() } }
}
