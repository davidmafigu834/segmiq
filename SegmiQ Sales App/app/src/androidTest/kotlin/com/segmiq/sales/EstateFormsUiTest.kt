package com.segmiq.sales

import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.segmiq.sales.features.realestate.*
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import org.junit.*
import org.junit.Assert.*
import java.time.*
import java.time.format.DateTimeFormatter

/** Isolated fictional state. No HTTP client, account or production mutation. */
class EstateFormsUiTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private fun capture(name: String) {
        compose.waitForIdle()
        val instrumentation = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
        instrumentation.waitForIdleSync()
        val image = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
        savePremiumCapture(compose.activity, name, image); image.recycle()
    }
    private fun assertActionAboveSystemBars(label: String) {
        compose.waitUntil(10000) { androidx.core.view.ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
            ?.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime()) == false }
        // Native IME transitions are not driven by the Compose test clock.
        android.os.SystemClock.sleep(350)
        compose.onNodeWithText(label).performScrollTo()
        compose.waitForIdle()
        val action = compose.onNodeWithText(label).fetchSemanticsNode()
        val frame = android.graphics.Rect()
        compose.runOnUiThread { compose.activity.window.decorView.getWindowVisibleDisplayFrame(frame) }
        val bottom = action.positionInWindow.y + action.size.height
        if (bottom > frame.bottom + 1) capture("69-action-overlap-diagnostic")
        assertTrue("Complete action must clear system bars: bottom=$bottom visibleBottom=${frame.bottom}", bottom <= frame.bottom + 1)
    }
    private fun assertReviewAboveKeyboard() {
        compose.waitUntil(10000) { androidx.core.view.ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
            ?.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime()) == true }
        android.os.SystemClock.sleep(350)
        compose.onNodeWithText("Review demo change").performScrollTo()
        compose.waitForIdle()
        val action = compose.onNodeWithText("Review demo change").fetchSemanticsNode()
        val frame = android.graphics.Rect()
        compose.runOnUiThread { compose.activity.window.decorView.getWindowVisibleDisplayFrame(frame) }
        val bottom = action.positionInWindow.y + action.size.height
        if (bottom > frame.bottom + 1) capture("70-keyboard-overlap-diagnostic")
        assertTrue("Review action must clear IME: bottom=$bottom visibleBottom=${frame.bottom}", bottom <= frame.bottom + 1)
    }
    private fun window() = compose.runOnUiThread {
        compose.activity.enableEdgeToEdge()
        compose.activity.window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
    }

    @Test fun requirementsAndExactOfferReviewStayUsableAcrossSizes() {
        window()
        val vm = EstateDemoViewModel()
        var kind by mutableStateOf("requirements")
        var width by mutableIntStateOf(360)
        var font by mutableFloatStateOf(1f)
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density * 360f / width, font)) {
                SegmiQSalesTheme {
                    val state by vm.state.collectAsState()
                    Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                        Text("FICTIONAL PHASE 5B · NO SERVER WRITES", Modifier.padding(12.dp))
                        Box(Modifier.weight(1f).fillMaxWidth()) {
                            key(kind) { EstateDemoForm(kind, "demo-p1", "demo-b1", "-", state, vm, {}) }
                        }
                    }
                }
            }
        }
        compose.onNodeWithText("Minimum budget").performScrollTo().performTextReplacement("200000.01")
        compose.onNodeWithText("Maximum budget").performScrollTo().performTextReplacement("100000.00")
        compose.onNodeWithText("Maximum must be at least the minimum.").assertExists()
        compose.onNodeWithText("Review demo change").performScrollTo().assertIsNotEnabled()
        capture("60-requirements-validation")
        compose.onNodeWithText("Maximum budget").performScrollTo().performTextReplacement("300000.99")
        compose.onNodeWithText("Property type").performScrollTo().performTextReplacement("Townhouse")
        compose.onNodeWithText("Bathrooms").performScrollTo().performTextReplacement("2")
        compose.onNodeWithText("Required features").performScrollTo().performTextReplacement("Solar backup")
        compose.runOnIdle { width = 393; font = 1.5f }
        compose.onNodeWithText("Review demo change").performScrollTo().assertIsDisplayed()
        assertReviewAboveKeyboard()
        capture("61-requirements-font150-393dp-keyboard")
        compose.onNodeWithText("Review demo change").performClick()
        compose.onNodeWithText("Confirm demo action").performScrollTo().assertIsDisplayed()
        assertActionAboveSystemBars("Confirm demo action")
        capture("62-requirements-review")
        compose.onNodeWithText("Confirm demo action").performClick()
        compose.waitUntil(5000) { vm.state.value.buyers.first().propertyType == "Townhouse" }
        assertEquals("300000.99", vm.state.value.buyers.first().budget!!.toPlainString())
        compose.runOnIdle { vm.clearFeedback(); kind = "offer"; width = 412; font = 2f }
        compose.onNodeWithText("Offer amount · USD (demo)").performScrollTo().performTextInput("175000.01")
        compose.onNodeWithText("Review demo change").performScrollTo().assertIsDisplayed()
        assertReviewAboveKeyboard()
        capture("63-offer-font200-412dp-keyboard")
        compose.onNodeWithText("Review demo change").performClick()
        compose.onNodeWithText("Confirm demo action").performScrollTo().assertIsDisplayed()
        assertActionAboveSystemBars("Confirm demo action")
        capture("64-offer-review")
        compose.onNodeWithText("Confirm demo action").performClick()
        compose.waitUntil(5000) { vm.state.value.offers.size == 3 }
        assertEquals("175000.01", vm.state.value.offers.last().amount.toPlainString())
        compose.onNodeWithText("Open confirmed example").performScrollTo().assertIsDisplayed()
        capture("65-offer-confirmed")
    }

    @Test fun bookingOverlapReviewAndReschedulingKeepRecordIdentity() {
        window()
        val zone = ZoneId.of("Africa/Harare")
        val date = LocalDate.now(zone).plusDays(2)
        val at = date.atTime(9, 0).atZone(zone).toInstant()
        val fixture = estateFixtures()
        val vm = EstateDemoViewModel(fixture.copy(viewings = listOf(fixture.viewings.first().copy(at = at))))
        var target by mutableStateOf("-")
        compose.setContent { SegmiQSalesTheme {
            val state by vm.state.collectAsState()
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                Text("FICTIONAL BOOKING · NO SERVER WRITES", Modifier.padding(12.dp))
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    key(target) { EstateDemoForm("viewing", "demo-p1", "demo-b1", target, state, vm, {}) }
                }
            }
        } }
        fun choose(day: LocalDate) {
            compose.onNodeWithText("Choose date and time").performScrollTo().performClick()
            compose.onNodeWithContentDescription("Switch to text input mode").performClick()
            compose.onNode(hasSetTextAction() and hasAnyAncestor(isDialog())).performTextReplacement(day.format(DateTimeFormatter.ofPattern("MMddyyyy")))
            compose.onNodeWithText("Set date").performClick()
            compose.onNodeWithText("Confirm").performClick()
        }
        choose(date)
        compose.onNodeWithText("Appointment overlap").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Review demo change").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithContentDescription("I reviewed this overlap").performScrollTo().performClick()
        compose.onNodeWithText("Review demo change").performScrollTo().performClick()
        compose.onNodeWithText("Confirm demo action").performScrollTo().assertIsDisplayed()
        assertActionAboveSystemBars("Confirm demo action")
        capture("66-booking-overlap-review")
        compose.onNodeWithText("Confirm demo action").performClick()
        compose.waitUntil(5000) { vm.state.value.viewings.size == 2 }
        val created = vm.state.value.viewings.last()
        assertEquals(at, created.at)
        assertEquals("demo-b1", created.buyerId)
        compose.runOnIdle { vm.clearFeedback(); target = created.id }
        // Reschedule preserves the original property and buyer; choose a different proposed day.
        compose.onNodeWithText("Reschedule viewing").assertExists()
        compose.onNodeWithText(date.format(DateTimeFormatter.ofPattern("d MMM yyyy")) + " · 09:00")
            .performScrollTo().performClick()
        compose.onNodeWithContentDescription("Switch to text input mode").performClick()
        compose.onNode(hasSetTextAction() and hasAnyAncestor(isDialog())).performTextReplacement(date.plusDays(1).format(DateTimeFormatter.ofPattern("MMddyyyy")))
        compose.onNodeWithText("Set date").performClick()
        compose.onNodeWithText("Confirm").performClick()
        compose.onNodeWithText("Review demo change").performScrollTo().performClick()
        compose.onNodeWithText("Confirm demo action").performScrollTo().assertIsDisplayed()
        assertActionAboveSystemBars("Confirm demo action")
        capture("67-reschedule-review")
        compose.onNodeWithText("Confirm demo action").performClick()
        compose.waitUntil(5000) { vm.state.value.viewings.last().at != at }
        assertEquals(created.id, vm.state.value.viewings.last().id)
        assertEquals(created.buyerId, vm.state.value.viewings.last().buyerId)
        assertEquals(2, vm.state.value.viewings.size)
    }

    @Test fun buyerMatchContextAndCancelReturnThroughCorrectParents() {
        window()
        compose.setContent { SegmiQSalesTheme { EstateDemoApp(start = "buyers", onExit = {}) } }
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("Rudo Example"))
        compose.onNodeWithText("Rudo Example").performClick()
        compose.onNodeWithText("Matches").performClick()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("8 Acacia Mews"))
        compose.onNodeWithText("8 Acacia Mews").performClick()
        compose.onNodeWithText("Schedule demo viewing").performScrollTo().performClick()
        compose.onNode(hasText("Rudo Example") and isSelected()).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Cancel editing").performScrollTo().performClick()
        compose.onNodeWithText("Concept gallery", substring = true).assertExists()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Matches").assertIsSelected()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithContentDescription("Primary navigation").assertExists()
    }

    @Test fun confirmedRescheduleRemainsVisibleWhenRefreshFails() {
        window()
        val server = okhttp3.mockwebserver.MockWebServer()
        val requests = java.util.concurrent.CopyOnWriteArrayList<okhttp3.mockwebserver.RecordedRequest>()
        val reads = java.util.concurrent.atomic.AtomicInteger()
        val at = LocalDate.now(ZoneId.of("Africa/Harare")).plusDays(2).atTime(9, 0)
            .atZone(ZoneId.of("Africa/Harare")).toInstant().toString()
        server.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): okhttp3.mockwebserver.MockResponse {
                requests.add(request)
                val path = request.requestUrl!!.encodedPath
                if (path.endsWith("/buyer-sales/actions") && request.method == "POST")
                    return okhttp3.mockwebserver.MockResponse().setHeader("Content-Type", "application/json")
                        .setBody("""{"ok":true,"notificationEffects":{"customerNotification":"NOT_REQUESTED","provider":null}}""")
                if (path.endsWith("/viewings/synthetic-viewing") && reads.incrementAndGet() == 1)
                    return okhttp3.mockwebserver.MockResponse().setHeader("Content-Type", "application/json")
                        .setBody("""{"viewing":{"id":"synthetic-viewing","listing_id":"synthetic-property","scheduled_at":"$at","status":"scheduled","access":"full","permittedActions":["reschedule_viewing"]},"timezone":"Africa/Harare"}""")
                return okhttp3.mockwebserver.MockResponse().setResponseCode(503).setHeader("Content-Type", "application/json")
                    .setBody("""{"error":"Synthetic read failure"}""")
            }
        }
        server.start()
        try {
            val modules = listOf("VIEWINGS")
            val workspace = com.segmiq.sales.core.bootstrap.LiveWorkspace.from(com.segmiq.sales.core.bootstrap.SalesAppBootstrap(
                schemaVersion = 1, release = com.segmiq.sales.core.bootstrap.BackendRelease(1, "synthetic-phase5b"),
                user = com.segmiq.sales.core.bootstrap.BootstrapUser("synthetic-agent", "Synthetic Agent", "SALESPERSON"),
                organisation = com.segmiq.sales.core.bootstrap.BootstrapOrganisation("synthetic-org", "Synthetic Agency"),
                subscription = com.segmiq.sales.core.bootstrap.BootstrapSubscription(),
                experience = com.segmiq.sales.core.bootstrap.BootstrapExperience("REAL_ESTATE"),
                capabilities = com.segmiq.sales.core.bootstrap.BootstrapCapabilities(modules,
                    featureFlags = com.segmiq.sales.core.bootstrap.FeatureFlags(realEstateWorkflow = true,
                        realEstateViewingsRead = true, realEstateViewingsWrite = true)),
                navigation = com.segmiq.sales.core.bootstrap.BootstrapNavigation(destinations = modules.map { com.segmiq.sales.core.bootstrap.NavDestination(it, it) }),
                salesConfiguration = com.segmiq.sales.core.bootstrap.SalesConfiguration()))
            val url = server.url("/")
            val repo = com.segmiq.sales.core.estate.EstateRepository(
                com.segmiq.sales.core.network.SegmiqHttp(com.segmiq.sales.core.network.ApiConfig(url, "Synthetic-phase5b"),
                    com.segmiq.sales.core.network.TokenProvider { "synthetic-token" }), workspace,
                com.segmiq.sales.core.estate.EstateAccess(workspace, url, listOf(com.segmiq.sales.core.estate.EstateAcceptance(
                    "${url.scheme}://${url.host}:${url.port}", "synthetic-phase5b",
                    setOf(com.segmiq.sales.core.estate.EstateResource.VIEWINGS), setOf(com.segmiq.sales.core.estate.EstateResource.VIEWINGS)))))
            val vm = EstateServerViewModel(repo, EstateLink(com.segmiq.sales.core.estate.EstateResource.VIEWINGS, "synthetic-viewing"))
            var navigation: String? = null
            compose.setContent { SegmiQSalesTheme {
                Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                    Text("SYNTHETIC API · NO LIVE CUSTOMER DATA")
                    Box(Modifier.weight(1f).fillMaxWidth()) { EstateServerScreen(vm) { navigation = it } }
                }
            } }
            compose.waitUntil(15000) { vm.state.value.page?.viewing != null }
            compose.onNodeWithTag("estate-server-list").performScrollToNode(hasText("Reschedule viewing"))
            compose.onNodeWithText("Reschedule viewing").performClick()
            compose.onNodeWithText("Choose date and time").performScrollTo().performClick()
            compose.onNodeWithContentDescription("Switch to text input mode").performClick()
            compose.onNode(hasSetTextAction() and hasAnyAncestor(isDialog())).performTextReplacement(
                LocalDate.now(ZoneId.of("Africa/Harare")).plusDays(3).format(DateTimeFormatter.ofPattern("MMddyyyy")))
            compose.onNodeWithText("Set date").performClick()
            compose.onNodeWithText("Confirm").performClick()
            compose.onNodeWithText("Review booking").performScrollTo().performClick()
            compose.onNodeWithText("Confirm with SegmiQ").performScrollTo().performClick()
            compose.waitUntil(20000) { vm.state.value.error != null && vm.bookingReceipt.value?.ok == true }
            compose.onNodeWithText("Confirmed by SegmiQ").assertIsDisplayed()
            compose.onNodeWithText("No customer notification requested.").assertIsDisplayed()
            assertActionAboveSystemBars("Open confirmed viewing")
            capture("68-confirmed-reschedule-refresh-error")
            compose.onNodeWithText("Open confirmed viewing").performClick()
            assertTrue(navigation!!.endsWith("/synthetic-viewing"))
            assertEquals(1, requests.count { it.method == "POST" })
            assertTrue(requests.none { it.path!!.contains("buyer-searches") || it.path!!.contains("/listings") })
        } finally { server.shutdown() }
    }
}
