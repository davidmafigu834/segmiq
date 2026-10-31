package com.segmiq.sales

import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.live.*
import com.segmiq.sales.core.network.*
import com.segmiq.sales.features.live.*
import com.segmiq.sales.features.realestate.RealEstateHomeContent
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import kotlinx.coroutines.flow.MutableStateFlow
import okhttp3.mockwebserver.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

/** No real account, property, buyer or company is used by these tests. */
class RealEstateShellTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = MockWebServer()
    private val requests = CopyOnWriteArrayList<RecordedRequest>()
    @After fun stop() = server.shutdown()

    private fun workspace(modules: List<String> = listOf("LISTINGS", "BUYERS", "WHATSAPP", "LEADS", "VIEWINGS", "TASKS")) =
        LiveWorkspace.from(SalesAppBootstrap(
            schemaVersion = 1, user = BootstrapUser("test-agent", "Test Agent", "SALESPERSON"),
            organisation = BootstrapOrganisation("test-org", "Fictional Test Agency"),
            subscription = BootstrapSubscription(), experience = BootstrapExperience("REAL_ESTATE"),
            capabilities = BootstrapCapabilities(modules),
            navigation = BootstrapNavigation(destinations = modules.map { NavDestination(it, it, webPath = "/sales/test") }),
            salesConfiguration = SalesConfiguration(timeZone = TimeZoneConfig(effective = "Africa/Harare")),
        ))

    @Test fun realEstateTabsRemainVisibleAndBlockedModulesNeverRequestCustomerData() {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                requests.add(request)
                val body = when (request.requestUrl!!.encodedPath) {
                    "/api/sales/dashboard" -> """{"commercial":{"newEnquiriesToday":7,"followUpsDueToday":2}}"""
                    "/api/sales/dashboard/workspace" -> """{"greetingPart":"morning","openCount":0,"actions":[]}"""
                    "/api/sales/tasks" -> """{"tasks":[]}"""
                    else -> return MockResponse().setResponseCode(403)
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(body)
            }
        }
        server.start()
        val http = SegmiqHttp(ApiConfig(server.url("/"), "SegmiQ-Test"),
            TokenProvider { "synthetic-token" })
        compose.setContent { SegmiQSalesTheme {
            LiveSalesApp(workspace(), LiveSalesApi(http), ScopedCache(), MutableStateFlow(true)) {}
        } }
        try {
            compose.waitUntil(15_000) { compose.onAllNodesWithText("7").fetchSemanticsNodes().isNotEmpty() }
        } catch (failure: Throwable) {
            throw AssertionError("Requests: ${requests.map { it.path }}\n${compose.onRoot().printToString()}", failure)
        }
        compose.onNodeWithText("Good morning, Test").assertExists()
        val homeCapture = compose.onRoot().captureToImage().asAndroidBitmap()
        savePremiumCapture(compose.activity, "40-agent-home-synthetic-api", homeCapture)
        homeCapture.recycle()
        compose.onNodeWithContentDescription("SegmiQ Sales").assertExists()
        compose.onNodeWithText("Properties").performClick()
        compose.onNodeWithText("No customer records have been loaded for this module.").assertExists()
        compose.onNodeWithText("Buyers").performClick()
        compose.onNodeWithText("Records stay unloaded", substring = true).assertExists()
        compose.onNodeWithText("Inbox").performClick()
        compose.onNodeWithText("Home").assertExists()
        compose.onNodeWithText("More").performClick()
        compose.onNodeWithText("Inquiries").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Viewings").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Settings").performScrollTo().performClick()
        compose.onNodeWithText("Managed by your organisation").performScrollTo().assertIsDisplayed()
        compose.waitUntil(5_000) { requests.any { it.requestUrl?.encodedPath == "/api/inbox/conversations" } }
        assertTrue(requests.all { it.getHeader("Authorization") == "Bearer synthetic-token" })
        assertTrue(requests.none { it.requestUrl!!.encodedPath.startsWith("/api/clients/") })
        assertTrue(requests.any { it.requestUrl!!.encodedPath == "/api/inbox/conversations" })
    }

    @Test fun restrictedHomeAtLargeFontShowsEmptyAndFailureStatesWithoutUnauthorisedActions() {
        compose.setContent { SegmiQSalesTheme {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.5f)) {
                RealEstateHomeContent(
                    MyDayState(
                        dashboard = Loadable(error = ApiError(ErrorKind.OFFLINE, "Network unavailable")),
                        workspace = Loadable(DailyWorkspaceDto(greetingPart = "morning")),
                    ), workspace(emptyList()), {}, {},
                )
            }
        } }
        compose.onNodeWithText("Review inquiries").assertDoesNotExist()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("Network unavailable"))
        compose.onNodeWithText("Network unavailable").assertIsDisplayed()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("A little breathing room"))
        compose.onNodeWithText("A little breathing room").assertIsDisplayed()
        compose.onNodeWithText("Properties & listings").assertDoesNotExist()
    }
}
