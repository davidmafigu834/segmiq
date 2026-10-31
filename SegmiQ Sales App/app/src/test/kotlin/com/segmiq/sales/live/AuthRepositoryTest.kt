package com.segmiq.sales.live

import com.segmiq.sales.core.auth.InMemorySessionStore
import com.segmiq.sales.core.auth.MfaChallenge
import com.segmiq.sales.core.auth.SignInOutcome
import com.segmiq.sales.core.auth.requiresNewMfaChallenge
import com.segmiq.sales.core.network.ErrorKind
import com.segmiq.sales.core.network.SegmiqJson
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

private val SIGNED_IN = """
{"token":"${Fake.TOKEN}","expiresAt":"2099-01-01T00:00:00Z",
 "user":{"userId":"${Fake.USER}","name":"Test Seller","clientId":"${Fake.ORG}","role":"SALESPERSON","clientMode":"team","alsoSells":false,"sessionId":"session-test-1"}}
""".trimIndent()

class AuthRepositoryTest {
    private val server = MockWebServer()
    private val store = InMemorySessionStore()

    @Before fun start() = server.start()
    @After fun stop() = server.shutdown()

    @Test fun signInSendsOnlyContractFieldsAndStoresSession() = runBlocking {
        server.enqueue(json(SIGNED_IN))
        val auth = server.auth(store)
        val outcome = auth.signIn("  seller@example.test ", "pw-test")
        assertTrue(outcome is SignInOutcome.SignedIn)
        val req = server.next()
        assertEquals("/api/sales/app/auth", req.path)
        assertNull(req.getHeader("Authorization"))
        val body = SegmiqJson.parseToJsonElement(req.body.readUtf8()).jsonObject
        assertEquals(setOf("email", "password", "deviceId", "deviceName"), body.keys)
        assertEquals("seller@example.test", body["email"]!!.jsonPrimitive.content)
        assertEquals(Fake.TOKEN, store.read()!!.token)
        assertEquals(Fake.TOKEN, auth.currentToken())
        assertEquals(Fake.ORG, store.read()!!.clientId)
    }

    @Test fun mfaChallengeStoresNothing() = runBlocking {
        server.enqueue(json("""{"mfaRequired":true,"challengeId":"ch-1","challengeToken":"ct-1","expiresAt":"2099-01-01T00:00:00Z"}"""))
        val outcome = server.auth(store).signIn("a@example.test", "pw")
        assertEquals("ch-1", (outcome as SignInOutcome.MfaRequired).challenge.challengeId)
        assertNull(store.read())
        assertFalse(outcome.challenge.toString().contains("ct-1"))
    }

    @Test fun mfaEnrolmentRevokesRestrictedTokenAndStoresNothing() = runBlocking {
        server.enqueue(json("""{"mfaEnrolmentRequired":true,"token":"restricted-test","expiresAt":"2099-01-01T00:00:00Z","user":{"userId":"u","role":"SALESPERSON","clientId":"o"}}"""))
        server.enqueue(json("""{"ok":true}"""))
        val outcome = server.auth(store).signIn("a@example.test", "pw")
        assertEquals(SignInOutcome.MfaEnrolmentRequired, outcome)
        server.next()
        val logout = server.next()
        assertEquals("/api/auth/session/logout", logout.path)
        assertEquals("Bearer restricted-test", logout.getHeader("Authorization"))
        assertNull(store.read())
    }

    @Test fun invalidCredentialsAndRateLimitsAreDistinct() = runBlocking {
        server.enqueue(json("""{"error":"Invalid credentials","code":"INVALID_CREDENTIALS"}""", 401))
        server.enqueue(json("""{"error":"Too many","code":"RATE_LIMITED"}""", 429))
        val auth = server.auth(store)
        assertEquals(ErrorKind.INVALID_CREDENTIALS, (auth.signIn("a@example.test", "pw") as SignInOutcome.Failed).error.kind)
        assertEquals(ErrorKind.RATE_LIMITED, (auth.signIn("a@example.test", "pw") as SignInOutcome.Failed).error.kind)
        assertNull(store.read())
    }

    @Test fun missingOrganisationIsRejected() = runBlocking {
        server.enqueue(json("""{"token":"t","expiresAt":"2099-01-01T00:00:00Z","user":{"userId":"u","role":"SALESPERSON"}}"""))
        assertEquals(ErrorKind.DECODING, (server.auth(store).signIn("a@example.test", "pw") as SignInOutcome.Failed).error.kind)
        assertNull(store.read())
    }

    @Test fun mfaCompletionSendsContractBody() = runBlocking {
        server.enqueue(json(SIGNED_IN))
        val outcome = server.auth(store).completeMfa(MfaChallenge("ch-1", "ct-1", null), "123 456", isRecoveryCode = false)
        assertTrue(outcome is SignInOutcome.SignedIn)
        val req = server.next()
        assertEquals("/api/auth/mfa/login", req.path)
        val body = SegmiqJson.parseToJsonElement(req.body.readUtf8()).jsonObject
        assertEquals(setOf("action", "channel", "challengeId", "challengeToken", "totpCode", "deviceId", "deviceName"), body.keys)
        assertEquals("mobile_sales", body["channel"]!!.jsonPrimitive.content)
        assertEquals("123456", body["totpCode"]!!.jsonPrimitive.content)
    }

    @Test fun recoveryCodeUsesRecoveryField() = runBlocking {
        server.enqueue(json(SIGNED_IN))
        server.auth(store).completeMfa(MfaChallenge("ch-1", "ct-1", null), " abcd-efgh ", isRecoveryCode = true)
        val body = SegmiqJson.parseToJsonElement(server.next().body.readUtf8()).jsonObject
        assertEquals("abcd-efgh", body["recoveryCode"]!!.jsonPrimitive.content)
        assertFalse("totpCode" in body)
    }

    @Test fun terminalMfaReasonsRequireRestart() = runBlocking {
        val auth = server.auth(store)
        listOf("challenge_expired" to true, "challenge_consumed" to true, "too_many_attempts" to true, "invalid_code" to false).forEach { (reason, restart) ->
            server.enqueue(json("""{"code":"MFA_VERIFICATION_FAILED","reason":"$reason"}""", 401))
            val e = (auth.completeMfa(MfaChallenge("c", "t", null), "000000", false) as SignInOutcome.Failed).error
            assertEquals(reason, restart, e.requiresNewMfaChallenge())
        }
    }

    @Test fun signOutRevokesAndAlwaysClears() = runBlocking {
        store.write(Fake.session())
        val auth = server.auth(store)
        auth.restore()
        server.enqueue(json("""{"error":"x"}""", 500))
        auth.signOut()
        val req = server.next()
        assertEquals("/api/auth/session/logout", req.path)
        assertEquals("Bearer ${Fake.TOKEN}", req.getHeader("Authorization"))
        assertNull(store.read())
        assertNull(auth.currentToken())
        assertEquals("logout is not retried", 1, server.requestCount)
    }

    @Test fun signOutClearsEvenWhenOffline() = runBlocking {
        store.write(Fake.session())
        val unreachable = MockWebServer().apply { start(); shutdown() }
        val auth = unreachable.auth(store)
        auth.restore()
        auth.signOut()
        assertNull(store.read())
    }

    @Test fun restoreDropsExpiredSessions() = runBlocking {
        store.write(Fake.session(expiresAt = "2020-01-01T00:00:00Z"))
        val auth = server.auth(store)
        assertNull(auth.restore())
        assertNull(store.read())
        store.write(Fake.session())
        assertEquals(Fake.USER, auth.restore()!!.userId)
        assertFalse(Fake.session().toString().contains(Fake.TOKEN))
    }
}
