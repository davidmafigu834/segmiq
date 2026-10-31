package com.segmiq.sales

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Before
import kotlinx.coroutines.runBlocking
import com.segmiq.sales.core.auth.EncryptedSessionStore
import org.junit.Rule
import org.junit.Test

class SimulatedCallTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Before fun resetLocalSessionForDemoTest() {
        // The Application container can outlive the preceding secure-storage test.
        // Reset local sign-in state without revoking any server session or touching demo records.
        runBlocking { EncryptedSessionStore(compose.activity).clear() }
        compose.activity.appContainer.session.start()
    }
    @Test fun callReviewIsClearlySimulatedAndSavesOnlyOnce() {
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Explore local demo").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Explore local demo").performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithContentDescription("Dialer", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Enter number").assertExists()
        "0771234501".forEach { digit ->
            compose.onAllNodesWithText(digit.toString()).filterToOne(hasClickAction()).assertIsDisplayed().performClick()
        }
        compose.onNodeWithText("0771234501").assertExists()
        compose.onNodeWithText("Start simulated call").assertIsDisplayed().performClick()
        compose.onNodeWithText("SIMULATED CALL · NO PHONE CONNECTION").assertExists()
        compose.onNodeWithText("End simulated call").performScrollTo().performClick()
        compose.onNodeWithText("SIMULATED CALL · NO AUDIO").assertExists()
        compose.onNodeWithText("Interested").performScrollTo().performClick()
        compose.onNodeWithText("Save review locally").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Review saved on this device").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Save review locally").assertDoesNotExist()
        compose.onNodeWithText("Review saved on this device").assertExists()
    }
}
