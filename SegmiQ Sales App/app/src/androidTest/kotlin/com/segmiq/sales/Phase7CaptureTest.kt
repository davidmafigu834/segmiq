package com.segmiq.sales

import android.provider.ContactsContract
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import com.segmiq.sales.core.audio.CapturePhase
import com.segmiq.sales.core.audio.RecordingLibrary
import com.segmiq.sales.core.audio.RecordingSessionBus
import com.segmiq.sales.core.bootstrap.BootstrapCapabilities
import com.segmiq.sales.core.bootstrap.BootstrapExperience
import com.segmiq.sales.core.bootstrap.BootstrapNavigation
import com.segmiq.sales.core.bootstrap.BootstrapOrganisation
import com.segmiq.sales.core.bootstrap.BootstrapSubscription
import com.segmiq.sales.core.bootstrap.BootstrapUser
import com.segmiq.sales.core.bootstrap.CurrencyConfig
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.bootstrap.NavDestination
import com.segmiq.sales.core.bootstrap.SalesAppBootstrap
import com.segmiq.sales.core.bootstrap.SalesConfiguration
import com.segmiq.sales.core.bootstrap.TimeZoneConfig
import com.segmiq.sales.core.live.DailyWorkspaceDto
import com.segmiq.sales.core.live.DashboardCommercial
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.SalesDashboardDto
import com.segmiq.sales.core.live.SalesTaskDto
import com.segmiq.sales.core.live.SalesTasksDto
import com.segmiq.sales.core.network.ApiConfig
import com.segmiq.sales.core.network.SegmiqHttp
import com.segmiq.sales.core.network.TokenProvider
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import com.segmiq.sales.features.live.Loadable
import com.segmiq.sales.features.live.LiveDialerScreen
import com.segmiq.sales.features.live.LiveNotificationScreen
import com.segmiq.sales.features.live.MyDayState
import com.segmiq.sales.features.realestate.EstateDemoApp
import com.segmiq.sales.features.realestate.RealEstateHomeContent
import com.segmiq.sales.features.recorder.LiveRecorderScreen
import com.segmiq.sales.features.recorder.LiveRecordingDetail
import com.segmiq.sales.features.recorder.LiveRecordingsScreen
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** Emulator pixels for the native Phase 7 screens. Recording shots are taken only while MediaRecorder is running. */
class Phase7CaptureTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val user = "phase7-user"
    private val org = "phase7-org"
    private val server = MockWebServer()

    @After fun wipe() {
        RecordingLibrary(compose.activity).wipe(user, org)
        server.shutdown()
    }

    @Test fun captureNativeScreens() {
        grant("android.permission.RECORD_AUDIO")
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest) = MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""{"notifications":[],"unreadCount":0}""")
        }
        server.start()
        val api = LiveSalesApi(SegmiqHttp(ApiConfig(server.url("/"), "SegmiQSales-Test"), TokenProvider { "synthetic-preview" }))
        val workspace = previewWorkspace()
        var screen by mutableStateOf("dialer")
        var saved by mutableStateOf<String?>(null)
        compose.setContent {
            SegmiQSalesTheme(darkTheme = screen.startsWith("record") || screen == "dialer" || screen == "review") {
                when (screen) {
                    "dialer" -> LiveDialerScreen(workspace)
                    "review" -> LiveDialerScreen(workspace, showReview = true)
                    "notifications" -> LiveNotificationScreen(workspace, api)
                    "recorder" -> LiveRecorderScreen(user, org, null, null) { saved = it }
                    "library" -> LiveRecordingsScreen(user, org, {}, {})
                    "playback" -> LiveRecordingDetail(user, org, saved.orEmpty(), {}, {})
                    "home" -> RealEstateHomeContent(MyDayState(
                        dashboard = Loadable(SalesDashboardDto(commercial = DashboardCommercial(newEnquiriesToday = 4, followUpsDueToday = 6))),
                        workspace = Loadable(DailyWorkspaceDto(greetingPart = "evening", openCount = 3,
                            actions = listOf(SalesTaskDto("qa-task", "qa-lead", "Confirm tomorrow's viewing", relatedName = "Fictional buyer", typeLabel = "Follow-up")))),
                        tasks = Loadable(SalesTasksDto()),
                    ), workspace, {}, {})
                    "calendar" -> EstateDemoApp(start = "calendar", onExit = {})
                    "copilot" -> EstateDemoApp(start = "copilot", onExit = {})
                    else -> Scaffold { padding -> Text("SegmiQ", Modifier.padding(padding)) }
                }
            }
        }
        compose.onNodeWithText("Call with phone app").assertIsDisplayed()
        shot("p7-01-dialer")
        seedContact()
        compose.onNodeWithText("Choose a contact").performScrollTo().performClick()
        compose.waitForIdle()
        android.os.SystemClock.sleep(2500)
        shot("p7-02-contact-picker", framebuffer = true)
        InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("input keyevent 4").close()
        android.os.SystemClock.sleep(600)
        compose.runOnIdle { screen = "review" }
        compose.onNodeWithText("Reached them").performScrollTo().assertIsDisplayed()
        shot("p7-03-call-review")
        compose.runOnIdle { screen = "notifications" }
        compose.onNodeWithText("Notifications").assertIsDisplayed()
        shot("p7-04-notifications")
        compose.runOnIdle { screen = "home" }
        shot("p7-13-real-estate-home-synthetic")
        compose.runOnIdle { screen = "calendar" }
        shot("p7-05-calendar-demo")
        compose.runOnIdle { screen = "copilot" }
        shot("p7-06-copilot-demo")
        compose.runOnIdle { screen = "recorder" }
        compose.onNodeWithText("Ready").assertIsDisplayed()
        shot("p7-07-recorder-ready")
        compose.onNodeWithText("I will tell everyone in the meeting before recording, and I will follow the law and my company policy.").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Start recording").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(12_000) {
            val phase = RecordingSessionBus.phase.value.phase
            phase == CapturePhase.RECORDING || phase == CapturePhase.ERROR
        }
        val started = RecordingSessionBus.phase.value
        assertEquals(started.error ?: "microphone did not start", CapturePhase.RECORDING, started.phase)
        shot("p7-08-recorder-recording")
        compose.onNodeWithContentDescription("Pause").performClick()
        compose.waitUntil(5_000) { RecordingSessionBus.phase.value.phase == CapturePhase.PAUSED }
        shot("p7-09-recorder-paused")
        compose.onNodeWithText("Stop and save").performClick()
        compose.waitUntil(8_000) { RecordingSessionBus.savedId != null }
        saved = RecordingSessionBus.savedId
        shot("p7-10-recorder-saved")
        compose.runOnIdle { screen = "library" }
        compose.onNodeWithText("Meeting").assertIsDisplayed()
        shot("p7-11-recording-library")
        compose.runOnIdle { screen = "playback" }
        compose.onNodeWithContentDescription("Play").performClick()
        compose.waitForIdle()
        shot("p7-12-recording-playback")
    }

    private fun previewWorkspace(): LiveWorkspace {
        val modules = listOf("TASKS", "LEADS")
        return LiveWorkspace.from(SalesAppBootstrap(
            schemaVersion = 1,
            user = BootstrapUser(user, "Preview Agent", "SALESPERSON"),
            organisation = BootstrapOrganisation(org, "Preview Agency", country = "ZW"),
            subscription = BootstrapSubscription(),
            experience = BootstrapExperience("REAL_ESTATE"),
            capabilities = BootstrapCapabilities(modules),
            navigation = BootstrapNavigation(destinations = modules.map { NavDestination(it, it) }),
            salesConfiguration = SalesConfiguration(
                timeZone = TimeZoneConfig(effective = "Africa/Harare"),
                currency = CurrencyConfig(quotationDefault = "USD"),
            ),
        ))
    }

    private fun seedContact() {
        grant("android.permission.WRITE_CONTACTS")
        val operations = arrayListOf(
            android.content.ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
                .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null).build(),
            android.content.ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, "Fictional Buyer").build(),
            android.content.ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, "0771234501")
                .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE).build(),
        )
        runCatching { compose.activity.contentResolver.applyBatch(ContactsContract.AUTHORITY, operations) }
    }

    private fun grant(permission: String) {
        InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("pm grant com.segmiq.sales $permission").close()
    }

    private fun shot(name: String, framebuffer: Boolean = false) {
        compose.waitForIdle()
        val image = if (framebuffer) {
            InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
        } else compose.onRoot().captureToImage().asAndroidBitmap()
        checkNotNull(image)
        savePremiumCapture(compose.activity, name, image)
        image.recycle()
    }
}
