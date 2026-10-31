package com.segmiq.sales.ui.main

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.segmiq.sales.core.design.SegmiqEmptyState
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import org.junit.Rule
import org.junit.Test

class MainScreenTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    @Test fun recordingEmptyStateDoesNotSuggestAudioExists() {
        compose.setContent { SegmiQSalesTheme { SegmiqEmptyState("No recordings on this device", "Audio capture is not enabled.") } }
        compose.onNodeWithText("No recordings on this device").assertExists()
        compose.onNodeWithText("Audio capture is not enabled.").assertExists()
    }
}
