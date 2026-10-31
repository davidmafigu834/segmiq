package com.segmiq.sales

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import com.segmiq.sales.features.realestate.EstateDemoApp
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import org.junit.Rule
import org.junit.Test

/** Standalone fictional workspace: no API dependency or real identity is passed to the UI. */
class EstateWorkflowUiTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun propertyBuyerViewingOfferTransactionAndDocumentsStayLinked() {
        compose.setContent { SegmiQSalesTheme { EstateDemoApp(onExit = {}) } }
        compose.onNodeWithText("FICTIONAL TRAINING DATA · NOT YOUR ORGANISATION'S STOCK · NO SERVER WRITES").assertIsDisplayed()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("24 Jacaranda Close"))
        compose.onNodeWithText("24 Jacaranda Close").performClick()
        compose.onNodeWithText("Concept gallery", substring = true).assertExists()
        compose.onNodeWithText("Schedule demo viewing").performScrollTo().assertIsDisplayed()
        compose.onAllNodesWithText("Nyasha Demo").onFirst().performScrollTo().performClick()
        compose.onNodeWithText("Overview").assertExists()
        compose.onNodeWithText("24 Jacaranda Close").performScrollTo().performClick()
        compose.onNodeWithText("Review completion").performScrollTo().assertExists()
        compose.onNodeWithText("Prepare offer").performScrollTo().performClick()
        compose.onNodeWithText("Offer amount · USD (demo)").performScrollTo().performTextInput("275000")
        compose.onNodeWithText("Review demo change").performScrollTo().performClick()
        compose.onNodeWithText("Confirm demo action").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Continue workflow").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Continue workflow").performScrollTo().performClick()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("$275,000", substring = true))
        compose.onNodeWithText("$275,000", substring = true).performClick()
        compose.onNodeWithText("Review demo submission").performScrollTo().performClick()
        compose.onNodeWithText("Confirm demo action").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Review acceptance").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Review acceptance").performScrollTo().performClick()
        compose.onNodeWithText("Confirm demo action").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Create demo transaction").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Create demo transaction").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Transaction progress").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Transaction progress").performScrollTo().performClick()
        compose.onNodeWithText("Pending compliance").assertExists()
        compose.onNodeWithText("Compliance checklist").performScrollTo().performClick()
        compose.onNodeWithText("Supporting identity documents").performScrollTo().performClick()
        compose.onNodeWithText("Fictional document preview").assertExists()
        compose.onNodeWithText("Production file access gated").performScrollTo().assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Compliance review").assertExists()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Milestones").assertExists()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Negotiation history").assertExists()
    }

    @Test fun darkLargeTextPreviewKeepsCriticalReviewActionsReachable() {
        compose.setContent { SegmiQSalesTheme(darkTheme = true) {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.5f)) {
                EstateDemoApp(start = "introductions", onExit = {})
            }
        } }
        compose.onNode(hasScrollAction()).performScrollToNode(hasText("Received introduction"))
        compose.onNodeWithText("Received introduction").performClick()
        compose.onNodeWithText("Review approval").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Review approval").performClick()
        compose.onNodeWithText("Confirm demo action").assertIsDisplayed()
    }
}
