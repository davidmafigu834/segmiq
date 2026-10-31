package com.segmiq.sales

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Before
import kotlinx.coroutines.runBlocking
import com.segmiq.sales.core.auth.EncryptedSessionStore
import org.junit.Rule
import org.junit.Test

class SalesNavigationTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Before fun resetLocalSessionForDemoTest() {
        // The Application container can outlive the preceding secure-storage test.
        // Reset local sign-in state without revoking any server session or touching demo records.
        runBlocking { EncryptedSessionStore(compose.activity).clear() }
        compose.activity.appContainer.session.start()
    }
    @Test fun welcomeToPrimaryDestinations() {
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Explore local demo").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Explore local demo").performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithText("LOCAL DEMO").assertIsDisplayed()
        compose.onNodeWithContentDescription("Inbox", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Search conversations").assertExists()
        compose.onNodeWithContentDescription("Dialer", useUnmergedTree = true).performClick()
        compose.onNodeWithText("DEMO CALLS ONLY").assertExists()
        compose.onNodeWithContentDescription("Pipeline", useUnmergedTree = true).performClick()
        compose.onNodeWithText("YOUR OPEN OPPORTUNITIES").assertExists()
        compose.onNodeWithContentDescription("More", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Your sales workspace").assertExists()
    }
}
