package com.segmiq.sales

import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import com.segmiq.sales.app.Page
import com.segmiq.sales.app.session.SignInUi
import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.data.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.live.*
import com.segmiq.sales.features.*
import com.segmiq.sales.features.auth.LoginScreen
import com.segmiq.sales.features.live.*
import com.segmiq.sales.features.realestate.*
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Real emulator pixels, fictional fixtures. No account, API client or production writes. */
class PremiumVisualTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val vm = EstateDemoViewModel()
    private val fixture = vm.state.value
    private val data = DemoState()
    private fun workspace(): LiveWorkspace {
        val modules = listOf("LISTINGS", "BUYERS", "LEADS", "VIEWINGS", "TASKS", "WHATSAPP", "INTRODUCTIONS")
        return LiveWorkspace.from(SalesAppBootstrap(
            schemaVersion = 1, user = BootstrapUser("preview-agent", "Tariro Demo", "SALESPERSON"),
            organisation = BootstrapOrganisation("preview-org", "Fictional Property Agency", workspaceMode = "demo"),
            subscription = BootstrapSubscription(), experience = BootstrapExperience("REAL_ESTATE"),
            capabilities = BootstrapCapabilities(modules),
            navigation = BootstrapNavigation(destinations = modules.map { NavDestination(it, it) }),
            salesConfiguration = SalesConfiguration(timeZone = TimeZoneConfig(effective = "Africa/Harare"),
                currency = CurrencyConfig(quotationDefault = "USD"))))
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        compose.waitUntil(15_000) { compose.onAllNodesWithTag("artwork-loading").fetchSemanticsNodes().isEmpty() }
        compose.waitForIdle()
        // Capture the actual Android framebuffer after decode and finite transitions.
        compose.waitUntil(10_000) { compose.onRoot().fetchSemanticsNode().size.width > 0 }
        if (name.endsWith("keyboard")) {
            compose.waitUntil(10_000) {
                androidx.core.view.ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
                    ?.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime()) == true
            }
            android.os.SystemClock.sleep(350)
            if (name.startsWith("32-")) compose.onNodeWithText("Sign in").performScrollTo().assertIsDisplayed()
            else compose.onNodeWithText("Save draft on device").assertIsDisplayed()
            compose.waitForIdle()
            val action = compose.onNodeWithText(if (name.startsWith("32-")) "Sign in" else "Save draft on device")
                .fetchSemanticsNode()
            val visibleFrame = android.graphics.Rect()
            compose.runOnUiThread { compose.activity.window.decorView.getWindowVisibleDisplayFrame(visibleFrame) }
            val actionBottom = action.positionInWindow.y + action.size.height
            assertTrue("Footer action must be wholly above the actual IME: bottom=$actionBottom keyboard=${visibleFrame.bottom}",
                actionBottom <= visibleFrame.bottom + 1)
        }
        val drawn = compose.onRoot().captureToImage().asAndroidBitmap()
        val image = if (name.endsWith("keyboard")) {
            // IME is a separate Window. Capture it natively after the app draw has completed.
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            instrumentation.waitForIdleSync()
            android.os.SystemClock.sleep(350)
            drawn.recycle()
            checkNotNull(instrumentation.uiAutomation.takeScreenshot())
        } else drawn
        assertNotNull("Emulator screenshot must exist", image)
        savePremiumCapture(compose.activity, name, image)
        image.recycle()
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Test fun captureRunningComposeGalleryAndSizeMatrix() {
        var screen by mutableStateOf("login")
        var dark by mutableStateOf(false)
        var scale by mutableFloatStateOf(1f)
        var width by mutableIntStateOf(360)
        compose.runOnUiThread {
            // Match the production Activity: edge-to-edge plus resize, rather than the
            // generic test Activity's default pan behavior hiding footer actions.
            compose.activity.enableEdgeToEdge()
            compose.activity.window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
        compose.setContent {
            val actualDensity = LocalDensity.current
            // Same physical emulator pixels, different dp constraints, explicitly recorded in filenames.
            CompositionLocalProvider(LocalDensity provides Density(actualDensity.density * 360f / width, scale)) {
                SegmiQSalesTheme(darkTheme = dark || screen in setOf("dialer", "recorder")) {
                    key(screen, dark, scale, width) {
                        if (screen == "login") LoginScreen(null, SignInUi(), "www.segmiq.com", { _, _ -> }, {}, {}, "https://www.segmiq.com/forgot-password")
                        else if (screen in setOf("properties", "buyers", "inquiries", "calendar", "copilot", "offers", "introductions"))
                            EstateDemoApp(start = screen, onExit = {})
                        else Scaffold(topBar = {
                            Column { TopAppBar(title = { if (screen == "home") EstateBrandTitle() else Text("SegmiQ visual review") })
                                Text("FICTIONAL QA · NO SERVER WRITES", Modifier.padding(horizontal = 20.dp), style = MaterialTheme.typography.labelSmall) }
                        }, bottomBar = { if (screen == "home") NavigationBar {
                            workspace().navigation.tabs.forEach { tab -> NavigationBarItem(tab.module == LiveModule.MY_DAY, {},
                                icon = { Icon(tab.icon.vector(), null) }, label = { Text(tab.label) }) }
                        } }) { padding ->
                            Box(Modifier.fillMaxSize().padding(padding)) {
                                when (screen) {
                                    "home" -> RealEstateHomeContent(MyDayState(
                                        dashboard = Loadable(SalesDashboardDto(commercial = DashboardCommercial(newEnquiriesToday = 4, followUpsDueToday = 6))),
                                        workspace = Loadable(DailyWorkspaceDto(greetingPart = "morning", openCount = 3,
                                            actions = listOf(SalesTaskDto("qa-task", "qa-lead", "Confirm tomorrow's viewing", relatedName = "Fictional buyer", typeLabel = "Follow-up")))),
                                        tasks = Loadable(SalesTasksDto())), workspace(), {}, {})
                                    "property" -> EstateDemoDetail("property", "demo-p1", fixture, vm, {})
                                    "buyer" -> EstateDemoDetail("buyer", "demo-b1", fixture, vm, {})
                                    "viewing" -> EstateDemoDetail("viewing", "demo-v1", fixture, vm, {})
                                    "offer" -> EstateDemoDetail("offer", "demo-o1", fixture, vm, {})
                                    "transaction" -> EstateDemoDetail("transaction", "demo-t1", fixture, vm, {})
                                    "compliance" -> EstateDemoDetail("compliance", "demo-t1", fixture, vm, {})
                                    "document" -> EstateDemoDocument("demo-t1", "demo-d1", fixture)
                                    "dialer" -> LiveDialerScreen()
                                    "review" -> CallReviewScreen(data.customers.first(), 0, false, false, {}, { _, _ -> })
                                    "recorder" -> RecorderScreen(data.customers)
                                    "recordings" -> RecordingsScreen({})
                                    "inbox" -> InboxScreen(data, {})
                                    "thread" -> ConversationScreen(data.customers.first(), data, {}, {})
                                    "tasks" -> TasksScreen(data, {}, {})
                                    "image-error" -> Page { SegmiqArtwork(0, Modifier.fillMaxWidth().height(180.dp)) }
                                    else -> EstateDemoApp(start = screen, onExit = {})
                                }
                            }
                        }
                    }
                }
            }
        }
        val screens = listOf("login", "home", "properties", "property", "buyers", "buyer", "inquiries", "calendar",
            "viewing", "dialer", "review", "recorder", "recordings", "copilot", "inbox", "thread", "offers", "offer",
            "introductions", "transaction", "compliance", "document", "tasks")
        screens.forEachIndexed { index, name ->
            compose.runOnIdle { screen = name }
            if (name == "dialer") compose.onNodeWithText("Call with phone app").assertIsDisplayed()
            capture("%02d-%s-light-360dp".format(index + 1, name))
        }
        compose.runOnIdle { screen = "properties"; dark = true }
        capture("24-properties-dark-360dp")
        compose.runOnIdle { screen = "calendar"; scale = 1.5f }
        capture("25-calendar-dark-font150")
        compose.runOnIdle { screen = "login"; scale = 2f }
        compose.onNodeWithText("Sign in").performScrollTo().assertIsDisplayed()
        capture("26-login-font200")
        compose.runOnIdle { screen = "properties"; dark = false; scale = 1f; width = 393 }
        capture("27-properties-393dp")
        compose.runOnIdle { screen = "buyer"; width = 412 }
        capture("28-buyer-412dp")
        compose.runOnIdle { screen = "home"; width = 840 }
        capture("29-home-tablet-dp-constraints")
        compose.runOnIdle { screen = "property"; width = 360; scale = 2f }
        compose.onNodeWithText("Schedule demo viewing").performScrollTo().assertIsDisplayed()
        capture("30-property-font200-action")
        compose.runOnIdle { screen = "image-error"; width = 360; scale = 1f }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Image unavailable").fetchSemanticsNodes().isNotEmpty() }
        capture("31-image-failure")
        compose.runOnIdle { screen = "login"; dark = false; scale = 1f }
        compose.onNodeWithText("Work email").performClick().performTextInput("agent@example.test")
        compose.onNodeWithText("Password").performScrollTo().performClick().performTextInput("fictional-test-only")
        compose.onNodeWithText("Sign in").performScrollTo().assertIsDisplayed()
        capture("32-login-keyboard")
        compose.runOnIdle { screen = "thread" }
        compose.onNodeWithText("Write a local draft").performClick().performTextInput("Fictional draft for keyboard verification")
        compose.onNodeWithText("Save draft on device").assertIsDisplayed()
        capture("33-thread-keyboard")
        compose.runOnIdle { screen = "properties"; dark = true; scale = 2f; width = 360 }
        compose.onNode(hasText("Properties") and hasAnyAncestor(hasContentDescription("Primary navigation"))).assertIsDisplayed()
        capture("35-primary-navigation-font200")
    }
}
