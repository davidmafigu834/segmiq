package com.segmiq.sales

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.core.app.ApplicationProvider
import com.segmiq.sales.app.session.SignInUi
import com.segmiq.sales.core.auth.EncryptedSessionStore
import com.segmiq.sales.core.auth.StoredSession
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.bootstrap.SalesAppBootstrap
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.ScopedCache
import com.segmiq.sales.core.network.ApiConfig
import com.segmiq.sales.core.network.SegmiqHttp
import com.segmiq.sales.core.network.SegmiqJson
import com.segmiq.sales.core.network.TokenProvider
import com.segmiq.sales.features.auth.LoginScreen
import com.segmiq.sales.features.live.LiveSalesApp
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Synthetic data only: a local MockWebServer stands in for SegmiQ. No real account is used. */
class LiveFoundationTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = MockWebServer()

    @After fun stop() = server.shutdown()

    @Test fun keystoreSessionRoundTripStoresNoPlaintextToken() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val store = EncryptedSessionStore(context)
        val session = StoredSession("fake-instrumented-token", "2099-01-01T00:00:00Z", "user-i", "org-i", null, "SALESPERSON", "Test")
        try {
            store.write(session)
            assertEquals(session, store.read())
            val raw = context.getSharedPreferences("segmiq_secure_session", Context.MODE_PRIVATE).all.values.joinToString()
            assertFalse(raw.contains("fake-instrumented-token"))
        } finally {
            store.clear()
        }
        assertNull(store.read())
    }

    @Test fun loginScreenShowsBrandAndDemoEntry() {
        compose.setContent {
            SegmiQSalesTheme {
                LoginScreen(null, SignInUi(error = "That email or password is incorrect."), "www.segmiq.com", { _, _ -> }, {}, {}, "https://www.segmiq.com/forgot-password")
            }
        }
        compose.onNodeWithContentDescription("SegmiQ").assertExists()
        compose.onNodeWithText("Sign in").assertExists()
        compose.onNodeWithText("Explore local demo").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("That email or password is incorrect.").assertExists()
        compose.onNodeWithText("Secure connection to www.segmiq.com").performScrollTo().assertExists()
    }

    @Test fun myDayShowsServerDataAndHonestUnavailableModules() {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.requestUrl!!.encodedPath) {
                    "/api/sales/dashboard" -> json(DASHBOARD)
                    "/api/sales/dashboard/workspace" -> json(WORKSPACE)
                    "/api/sales/tasks" -> json(TASKS)
                    else -> MockResponse().setResponseCode(404).setHeader("Content-Type", "text/html")
                }
            }
        }
        server.start()
        val http = SegmiqHttp(ApiConfig(server.url("/"), "SegmiQSales-Test"), TokenProvider { "fake-instrumented-token" })
        val workspace = LiveWorkspace.from(SegmiqJson.decodeFromString(SalesAppBootstrap.serializer(), BOOTSTRAP))
        compose.setContent {
            SegmiQSalesTheme { LiveSalesApp(workspace, LiveSalesApi(http), ScopedCache(), MutableStateFlow(true)) {} }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Two follow-ups due today.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Good morning, Test").assertExists()
        compose.onNodeWithText("Instrumented Org").assertExists()
        compose.onNodeWithText("7").assertExists()
        compose.onNodeWithText("Call Anna back", substring = true).assertExists()
        compose.onNodeWithText("DEMO WORKSPACE").assertDoesNotExist()
        compose.onNodeWithText("LOCAL DEMO").assertDoesNotExist()
        compose.onNodeWithText("Inbox").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("WhatsApp").fetchSemanticsNodes().isNotEmpty() }
        repeat(server.requestCount) {
            assertEquals("Bearer fake-instrumented-token", server.takeRequest().getHeader("Authorization"))
        }
    }

    private fun json(body: String) = MockResponse().setHeader("Content-Type", "application/json").setBody(body)

    private companion object {
        val BOOTSTRAP = """
        {"schemaVersion":1,
         "user":{"id":"user-i","displayName":"Test Seller","role":"SALESPERSON"},
         "organisation":{"id":"org-i","name":"Instrumented Org","workspaceMode":"live"},
         "subscription":{"status":"ACTIVE","salesAccess":"ALLOWED"},
         "experience":{"id":"GENERAL","homeVariant":"TEAM"},
         "capabilities":{"modules":["PIPELINE","LEADS","TASKS","WHATSAPP"],"restrictions":{"salesOperations":"ALLOWED","leadModification":"ASSIGNED"}},
         "navigation":{},
         "salesConfiguration":{"timeZone":{"effective":"Africa/Harare"},"currency":{"quotationDefault":"USD"}}}
        """.trimIndent()
        const val DASHBOARD = """{"commercial":{"newEnquiriesToday":7,"activeDeals":3,"pipelineValueKnown":1500,"pipelineAwaitingEstimate":1,"followUpsDueToday":2,"followUpsOverdue":1},"pipelineSnapshot":[],"recentActivity":[],"hasAnyDeals":true,"hasAnyLeads":true}"""
        const val WORKSPACE = """{"greetingPart":"morning","timezone":"Africa/Harare","briefing":"Two follow-ups due today.","openCount":1,"actions":[{"id":"t1","leadId":"lead-1","title":"Call Anna back","relatedName":"Anna Test","completed":false}],"copilotUnavailable":false,"updates":{"heading":"Since yesterday","items":[],"unavailable":false},"visitId":"v1"}"""
        const val TASKS = """{"meta":{"timezone":"Africa/Harare","copilotUnavailable":false},"tasks":[],"upcoming":[]}"""
    }
}
