package com.segmiq.sales.live

import com.segmiq.sales.app.session.AppState
import com.segmiq.sales.app.session.BlockReason
import com.segmiq.sales.app.session.SessionController
import com.segmiq.sales.core.auth.AuthRepository
import com.segmiq.sales.core.auth.InMemorySessionStore
import com.segmiq.sales.core.data.AuthorisedScope
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.ScopedCache
import com.segmiq.sales.core.network.SegmiqHttp
import com.segmiq.sales.core.network.SessionProblemListener
import com.segmiq.sales.core.network.TokenProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class SessionControllerTest {
    private val server = MockWebServer()
    private val store = InMemorySessionStore()
    private val cache = ScopedCache()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var auth: AuthRepository
    private lateinit var controller: SessionController
    private val releasedOwners = mutableListOf<Pair<String, String>>()

    @Before fun setUp() {
        server.start()
        lateinit var c: SessionController
        val http = SegmiqHttp(server.config(), TokenProvider { auth.currentToken() }, SessionProblemListener { c.onSessionProblem(it) })
        auth = AuthRepository(http, store, Fake.DEVICE)
        val api = LiveSalesApi(http)
        c = SessionController(auth, { api }, cache, scope, onLocalSignOut = { user, org -> releasedOwners += user to org })
        controller = c
    }

    @After fun tearDown() {
        scope.cancel()
        server.shutdown()
    }

    private fun awaitState(predicate: (AppState) -> Boolean): AppState = runBlocking {
        withTimeout(10_000) { controller.state.first(predicate) }
    }

    private fun settled(s: AppState) = s !is AppState.Starting && s !is AppState.Connecting

    @Test fun noStoredSessionShowsSignIn() {
        controller.start()
        assertEquals(AppState.SignedOut(), awaitState(::settled))
        assertEquals(0, server.requestCount)
    }

    @Test fun restoredSessionLoadsWorkspaceFromBootstrap() = runBlocking {
        store.write(Fake.session())
        server.enqueue(json(bootstrapJson(experience = "SOLAR")))
        controller.start()
        val live = awaitState(::settled) as AppState.Live
        assertEquals(Fake.ORG, live.workspace.scope.organisationId)
        val req = server.next()
        assertEquals("/api/sales/app/bootstrap", req.path)
        assertEquals("Bearer ${Fake.TOKEN}", req.getHeader("Authorization"))
    }

    @Test fun missingBootstrapEndpointBlocksLiveData() = runBlocking {
        store.write(Fake.session())
        server.enqueue(html(404))
        controller.start()
        val blocked = awaitState(::settled) as AppState.Blocked
        assertEquals(BlockReason.SERVER_NOT_READY, blocked.reason)
        assertTrue(blocked.signedIn)
        assertNotNull("session is kept so retry can succeed after deployment", store.read())
    }

    @Test fun revokedSessionSignsOutAndClearsCredentials() = runBlocking {
        store.write(Fake.session())
        server.enqueue(json("""{"error":"Session revoked","code":"SESSION_REVOKED"}""", 401))
        controller.start()
        assertTrue(awaitState(::settled) is AppState.SignedOut)
        assertNull(store.read())
    }

    @Test fun bootstrapForADifferentAccountSignsOut() = runBlocking {
        store.write(Fake.session())
        server.enqueue(json(bootstrapJson(orgId = "another-org")))
        server.enqueue(json("""{"ok":true}"""))
        cache.put(AuthorisedScope(Fake.ORG, Fake.USER), "tasks", "cached")
        controller.start()
        assertTrue(awaitState(::settled) is AppState.SignedOut)
        assertNull(store.read())
        assertEquals(0, cache.size())
        server.next()
        assertEquals("/api/auth/session/logout", server.next().path)
    }

    @Test fun suspendedSubscriptionBlocks() = runBlocking {
        store.write(Fake.session())
        server.enqueue(json(bootstrapJson(salesAccess = "BLOCKED")))
        controller.start()
        assertEquals(BlockReason.SUBSCRIPTION, (awaitState(::settled) as AppState.Blocked).reason)
    }

    @Test fun sessionEndedDuringUseClearsCacheAndSignsOut() = runBlocking {
        store.write(Fake.session())
        server.enqueue(json(bootstrapJson()))
        controller.start()
        awaitState { it is AppState.Live }
        cache.put(AuthorisedScope(Fake.ORG, Fake.USER), "tasks", "cached")
        server.enqueue(json("""{"code":"TOKEN_EXPIRED"}""", 401))
        LiveSalesApi(SegmiqHttp(server.config(), TokenProvider { auth.currentToken() }, controller)).tasks()
        assertTrue(awaitState { it is AppState.SignedOut } is AppState.SignedOut)
        assertNull(store.read())
        assertEquals(0, cache.size())
    }

    @Test fun signInThenMfaThenLive() = runBlocking {
        controller.start()
        awaitState(::settled)
        server.enqueue(json("""{"mfaRequired":true,"challengeId":"ch-1","challengeToken":"ct-1"}"""))
        controller.signIn("seller@example.test", "pw-test")
        awaitState { it is AppState.Mfa }
        server.enqueue(json("""{"ok":true,"token":"${Fake.TOKEN}","expiresAt":"2099-01-01T00:00:00Z","user":{"userId":"${Fake.USER}","clientId":"${Fake.ORG}","role":"SALESPERSON"}}"""))
        server.enqueue(json(bootstrapJson()))
        controller.completeMfa("123456", recovery = false)
        assertTrue(awaitState { it is AppState.Live } is AppState.Live)
    }

    @Test fun signOutReleasesTheLocalAccountOwner() = runBlocking {
        store.write(Fake.session())
        server.enqueue(json(bootstrapJson()))
        server.enqueue(json("""{"ok":true}"""))
        controller.start()
        awaitState { it is AppState.Live }
        controller.signOut()
        awaitState { it is AppState.SignedOut }
        assertEquals(listOf(Fake.USER to Fake.ORG), releasedOwners)
    }

    @Test fun demoIsOnlyReachableWhenSignedOutAndUsesNoNetwork() = runBlocking {
        controller.start()
        awaitState(::settled)
        controller.enterDemo()
        assertEquals(AppState.Demo, controller.state.value)
        controller.leaveDemo()
        assertTrue(controller.state.value is AppState.SignedOut)
        assertEquals(0, server.requestCount)
    }
}
