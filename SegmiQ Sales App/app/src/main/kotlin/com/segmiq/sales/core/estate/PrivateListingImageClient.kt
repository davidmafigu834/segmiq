package com.segmiq.sales.core.estate

import com.segmiq.sales.core.network.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.time.Instant

/**
 * Separate, token-free storage client. No disk cache, cookies, redirects or public fallback.
 * One image is held by its screen only; dropping the authenticated composition releases it.
 */
class PrivateListingImageClient internal constructor(
    private val host: String,
    client: OkHttpClient = SegmiqHttp.defaultClient(),
    private val now: () -> Instant = Instant::now,
) {
    private val bytesClient = client.newBuilder().cache(null).cookieJar(CookieJar.NO_COOKIES)
        .authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
        .followRedirects(false).followSslRedirects(false).build()

    suspend fun fetch(metadata: SignedImageDto): ApiResult<ByteArray> = withContext(Dispatchers.IO) {
        val url = metadata.url.toHttpUrlOrNull()
        val expiry = runCatching { Instant.parse(metadata.expiresAt) }.getOrNull()
        if (url == null || !url.isHttps || url.host != host || url.port != 443 ||
            url.username.isNotEmpty() || url.password.isNotEmpty() || url.fragment != null ||
            expiry == null || !expiry.isAfter(now().plusSeconds(5)) ||
            expiry.isAfter(now().plusSeconds(330)))
            return@withContext unavailable()
        try {
            val request = Request.Builder().url(url).get().header("Accept", "image/*").build()
            bytesClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful || response.isRedirect) return@use unavailable()
                val type = response.header("Content-Type")?.substringBefore(';')?.lowercase()
                if (type !in TYPES) return@use unavailable()
                val body = response.body ?: return@use unavailable()
                if (body.contentLength() > MAX_BYTES) return@use unavailable()
                val output = ByteArrayOutputStream()
                body.byteStream().use { input ->
                    val buffer = ByteArray(8192)
                    while (true) {
                        val count = input.read(buffer)
                        if (count == -1) break
                        if (output.size().toLong() + count > MAX_BYTES) return@withContext unavailable()
                        output.write(buffer, 0, count)
                    }
                }
                val bytes = output.toByteArray()
                if (bytes.isEmpty() || bytes.size.toLong() >= MAX_BYTES) unavailable() else ApiResult.Success(bytes)
            }
        } catch (_: IOException) { ApiResult.Failure(ErrorMapper.offline()) }
    }
    private fun unavailable() = ApiResult.Failure(ApiError(ErrorKind.NOT_FOUND, "Property photograph unavailable."))
    companion object {
        const val MAX_BYTES = 20L * 1024 * 1024
        private val TYPES = setOf("image/jpeg", "image/png", "image/webp", "image/avif")
    }
}
