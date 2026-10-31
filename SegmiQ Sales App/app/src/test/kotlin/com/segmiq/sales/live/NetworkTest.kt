package com.segmiq.sales.live

import com.segmiq.sales.core.network.ApiConfig
import com.segmiq.sales.core.network.ApiError
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.network.AuthRequired
import com.segmiq.sales.core.network.BearerInterceptor
import com.segmiq.sales.core.network.ErrorKind
import com.segmiq.sales.core.network.ErrorMapper
import com.segmiq.sales.core.network.HttpMethod
import com.segmiq.sales.core.network.SessionProblemListener
import com.segmiq.sales.core.network.TokenProvider
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class ErrorMapperTest {
    private fun map(status: Int, body: String?, type: String? = "application/json") = ErrorMapper.fromHttp(status, body, type)

    @Test fun codesWinOverStatus() {
        assertEquals(ErrorKind.INVALID_CREDENTIALS, map(401, """{"code":"INVALID_CREDENTIALS"}""").kind)
        assertEquals(ErrorKind.SESSION_ENDED, map(401, """{"code":"SESSION_REVOKED"}""").kind)
        assertEquals(ErrorKind.SUBSCRIPTION_SUSPENDED, map(403, """{"code":"SUBSCRIPTION_SUSPENDED"}""").kind)
        assertEquals(ErrorKind.INSUFFICIENT_ROLE, map(403, """{"code":"INSUFFICIENT_ROLE"}""").kind)
        assertEquals(ErrorKind.STALE, map(409, """{"error":"This suggestion changed.","code":"stale"}""").kind)
    }

    @Test fun legacyUnauthorizedIsFlaggedForDiagnosis() {
        val e = map(401, """{"error":"Unauthorized"}""")
        assertEquals(ErrorKind.SESSION_ENDED, e.kind)
        assertTrue(e.genericUnauthorized)
        assertFalse(map(401, """{"code":"TOKEN_EXPIRED"}""").genericUnauthorized)
    }

    @Test fun htmlNotFoundMeansEndpointMissing() {
        assertEquals(ErrorKind.ENDPOINT_MISSING, map(404, "<html></html>", "text/html").kind)
        assertEquals(ErrorKind.NOT_FOUND, map(404, """{"error":"Not found"}""").kind)
    }

    @Test fun mfaReasonAndFieldArePreserved() {
        val e = map(401, """{"code":"MFA_VERIFICATION_FAILED","reason":"challenge_expired"}""")
        assertEquals(ErrorKind.MFA_FAILED, e.kind)
        assertEquals("challenge_expired", e.reason)
        assertEquals("email", map(400, """{"code":"INVALID_REQUEST","field":"email"}""").field)
    }

    @Test fun serverMessagePreferredButTerseLegacyErrorsAreReplaced() {
        assertEquals("Custom message", map(403, """{"code":"NO_ORGANISATION","message":"Custom message"}""").message)
        assertEquals(ErrorMapper.defaultMessage(ErrorKind.VALIDATION), map(400, """{"error":"Invalid body"}""").message)
        assertEquals("Phone number is already used by another lead.", map(400, """{"error":"Phone number is already used by another lead."}""").message)
        assertEquals(ErrorMapper.defaultMessage(ErrorKind.SESSION_ENDED), map(401, """{"error":"Unauthorized"}""").message)
    }

    @Test fun sessionEndingKinds() {
        assertTrue(ApiError(ErrorKind.SESSION_ENDED, "").endsSession)
        assertTrue(ApiError(ErrorKind.ORGANISATION_SUSPENDED, "").endsSession)
        assertFalse(ApiError(ErrorKind.SUBSCRIPTION_SUSPENDED, "").endsSession)
        assertFalse(ApiError(ErrorKind.FORBIDDEN, "").endsSession)
    }

    @Test fun baseUrlMustBeHttpsExceptLocalDebug() {
        assertThrows(IllegalArgumentException::class.java) { ApiConfig.create("http://www.segmiq.com", "ua", true) }
        assertThrows(IllegalArgumentException::class.java) { ApiConfig.create("http://10.0.2.2:3000", "ua", false) }
        assertEquals("www.segmiq.com", ApiConfig.create("https://www.segmiq.com/", "ua", false).baseUrl.host)
        assertEquals("10.0.2.2", ApiConfig.create("http://10.0.2.2:3000", "ua", true).baseUrl.host)
    }
}

@Serializable private data class Probe(val value: String? = null)

class SegmiqHttpTest {
    private val server = MockWebServer()
    private val other = MockWebServer()

    @Before fun start() { server.start(); other.start() }
    @After fun stop() { server.shutdown(); other.shutdown() }

    @Test fun bearerIsSentOnlyToTheConfiguredOrigin() {
        val client = OkHttpClient.Builder().addInterceptor(BearerInterceptor(server.config(), TokenProvider { Fake.TOKEN })).build()
        server.enqueue(json("{}"))
        other.enqueue(json("{}"))
        client.newCall(Request.Builder().url(server.url("/api/x")).tag(AuthRequired::class.java, AuthRequired()).build()).execute().close()
        client.newCall(Request.Builder().url("http://127.0.0.1:${other.port}/steal").tag(AuthRequired::class.java, AuthRequired()).build()).execute().close()
        assertEquals("Bearer ${Fake.TOKEN}", server.next().getHeader("Authorization"))
        assertNull(other.next().getHeader("Authorization"))
    }

    @Test fun unauthenticatedRequestsCarryNoBearer() = runBlocking {
        server.enqueue(json("""{"value":"a"}"""))
        val r = server.http(TokenProvider { Fake.TOKEN }).request(HttpMethod.POST, "/api/sales/app/auth", Probe.serializer(), authenticated = false)
        assertEquals("a", (r as ApiResult.Success).value.value)
        val req = server.next()
        assertNull(req.getHeader("Authorization"))
        assertEquals("SegmiQSales-Test", req.getHeader("User-Agent"))
    }

    @Test fun explicitTokenOverridesSessionToken() = runBlocking {
        server.enqueue(json("""{"ok":true}"""))
        server.http(TokenProvider { "other" }).request(HttpMethod.POST, "/api/auth/session/logout", Probe.serializer(), explicitToken = "explicit-test")
        assertEquals("Bearer explicit-test", server.next().getHeader("Authorization"))
    }

    @Test fun htmlPagesAreTreatedAsMissingEndpoints() = runBlocking {
        server.enqueue(html(404))
        server.enqueue(html(200))
        val http = server.http()
        assertEquals(ErrorKind.ENDPOINT_MISSING, (http.request(HttpMethod.GET, "/a", Probe.serializer(), retries = 0) as ApiResult.Failure).error.kind)
        assertEquals(ErrorKind.ENDPOINT_MISSING, (http.request(HttpMethod.GET, "/b", Probe.serializer(), retries = 0) as ApiResult.Failure).error.kind)
    }

    @Test fun getRetriesServerErrorsOnceButPostDoesNot() = runBlocking {
        server.enqueue(json("""{"error":"x"}""", 503))
        server.enqueue(json("""{"value":"ok"}"""))
        assertTrue(server.http().request(HttpMethod.GET, "/a", Probe.serializer()) is ApiResult.Success)
        assertEquals(2, server.requestCount)
        server.enqueue(json("""{"error":"x"}""", 503))
        assertTrue(server.http().request(HttpMethod.POST, "/b", Probe.serializer()) is ApiResult.Failure)
        assertEquals(3, server.requestCount)
    }

    @Test fun malformedJsonIsADecodingError() = runBlocking {
        server.enqueue(json("""{"value": [1,2"""))
        assertEquals(ErrorKind.DECODING, (server.http().request(HttpMethod.GET, "/a", Probe.serializer(), retries = 0) as ApiResult.Failure).error.kind)
    }

    @Test fun sessionProblemsAreReportedOnlyForAuthenticatedCalls() = runBlocking {
        val seen = mutableListOf<ErrorKind>()
        val http = server.http(TokenProvider { Fake.TOKEN }, SessionProblemListener { seen += it.kind })
        server.enqueue(json("""{"code":"TOKEN_EXPIRED"}""", 401))
        http.request(HttpMethod.GET, "/a", Probe.serializer())
        server.enqueue(json("""{"code":"INVALID_CREDENTIALS"}""", 401))
        http.request(HttpMethod.POST, "/api/sales/app/auth", Probe.serializer(), authenticated = false)
        server.enqueue(json("""{"code":"SESSION_REVOKED"}""", 401))
        http.request(HttpMethod.POST, "/logout", Probe.serializer(), reportSessionProblems = false)
        server.enqueue(json("""{"code":"VALIDATION"}""", 400))
        http.request(HttpMethod.PATCH, "/c", Probe.serializer())
        assertEquals(listOf(ErrorKind.SESSION_ENDED), seen)
    }

    @Test fun backgroundRequestsAreMarked() = runBlocking {
        server.enqueue(json("{}"))
        server.http().request(HttpMethod.GET, "/a", Probe.serializer(), background = true)
        assertEquals("background", server.next().getHeader("X-Segmiq-Activity"))
    }

    @Test fun redirectsAreNotFollowed() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", "http://127.0.0.1:${other.port}/x"))
        val r = server.http(TokenProvider { Fake.TOKEN }).request(HttpMethod.GET, "/a", Probe.serializer(), retries = 0)
        assertTrue(r is ApiResult.Failure)
        assertEquals(0, other.requestCount)
    }
}
