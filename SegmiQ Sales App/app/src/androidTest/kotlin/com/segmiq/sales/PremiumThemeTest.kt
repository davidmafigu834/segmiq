package com.segmiq.sales

import androidx.activity.ComponentActivity
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class PremiumThemeTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private fun contrast(a: Color, b: Color): Float {
        val first = a.luminance(); val second = b.luminance()
        return (maxOf(first, second) + .05f) / (minOf(first, second) + .05f)
    }
    private fun verify(scheme: ColorScheme) {
        listOf(scheme.onSurface to scheme.surface, scheme.onSurfaceVariant to scheme.surface,
            scheme.onPrimaryContainer to scheme.primaryContainer, scheme.onErrorContainer to scheme.errorContainer)
            .forEach { (text, background) -> assertTrue("Body text needs WCAG AA contrast", contrast(text, background) >= 4.5f) }
        listOf(scheme.surfaceContainerLowest, scheme.surfaceContainerLow, scheme.surfaceContainer,
            scheme.surfaceContainerHigh, scheme.surfaceContainerHighest, scheme.surfaceBright, scheme.surfaceDim)
            .forEach { assertTrue("Neutral surface must not fall back to lavender", it.blue <= it.green + .035f) }
    }
    @Test fun bothThemesKeepReadableTextAndNeutralSurfaceFamilies() {
        var dark by mutableStateOf(false)
        lateinit var scheme: ColorScheme
        compose.setContent { SegmiQSalesTheme(darkTheme = dark) {
            val current = MaterialTheme.colorScheme
            SideEffect { scheme = current }
            Text("Theme contrast fixture")
        } }
        compose.runOnIdle { verify(scheme); dark = true }
        compose.waitForIdle()
        compose.runOnIdle { verify(scheme) }
    }
}
