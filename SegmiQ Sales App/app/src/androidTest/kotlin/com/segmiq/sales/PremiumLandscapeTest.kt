package com.segmiq.sales

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.segmiq.sales.features.realestate.EstateDemoApp
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** Rotates the emulator Activity; this is not a marketing landscape mockup. */
class PremiumLandscapeTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    @Test fun landscapePropertyWorkspaceRetainsReachableContent() {
        compose.runOnUiThread { compose.activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        compose.waitUntil(20_000) { compose.activity.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE }
        compose.setContent { SegmiQSalesTheme { EstateDemoApp(onExit = {}) } }
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("24 Jacaranda Close"))
        compose.onNodeWithText("24 Jacaranda Close").assertIsDisplayed()
        compose.waitForIdle()
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        assertTrue("Landscape framebuffer must be wider than tall", bitmap.width > bitmap.height)
        savePremiumCapture(compose.activity, "34-properties-landscape", bitmap)
        bitmap.recycle()
        compose.onNodeWithText("24 Jacaranda Close").performClick()
        compose.onNodeWithText("Schedule demo viewing").performScrollTo().assertIsDisplayed()
        val detail = compose.onRoot().captureToImage().asAndroidBitmap()
        savePremiumCapture(compose.activity, "36-property-landscape-action", detail)
        detail.recycle()
        compose.runOnUiThread { compose.activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
    }
}
