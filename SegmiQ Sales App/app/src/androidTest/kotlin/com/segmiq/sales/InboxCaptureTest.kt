package com.segmiq.sales

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.viewmodel.compose.viewModel
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.network.ApiConfig
import com.segmiq.sales.core.network.SegmiqHttp
import com.segmiq.sales.core.network.TokenProvider
import com.segmiq.sales.features.inbox.InboxDirectoryScreen
import com.segmiq.sales.features.inbox.InboxThreadScreen
import com.segmiq.sales.features.inbox.InboxViewModel
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** Synthetic inbox only. The failed send never leaves the device. */
class InboxCaptureTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = MockWebServer()

    @After fun stop() = server.shutdown()

    @Test fun directoryThreadAndFailedSendKeepTheDraft() {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.requestUrl!!.encodedPath
                val body = when {
                    path == "/api/inbox/conversations" -> CONVERSATIONS
                    path.endsWith("/messages") -> MESSAGES
                    path.endsWith("/quick-replies") -> REPLIES
                    path.endsWith("/send-message") -> return MockResponse().setResponseCode(502)
                        .setHeader("Content-Type", "application/json")
                        .setBody("""{"error":"Provider session rejected the send.","code":"PROVIDER"}""")
                    else -> return MockResponse().setResponseCode(404).setHeader("Content-Type", "application/json").setBody("""{"error":"missing"}""")
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(body)
            }
        }
        server.start()
        val api = LiveSalesApi(SegmiqHttp(ApiConfig(server.url("/"), "SegmiQSales-Test"), TokenProvider { "synthetic-inbox" }))
        compose.setContent {
            SegmiQSalesTheme {
                val vm = viewModel { InboxViewModel(api, "agent-1") }
                var lead by remember { mutableStateOf<String?>(null) }
                val open = lead
                if (open == null) InboxDirectoryScreen(vm) { lead = "lead-synthetic" }
                else InboxThreadScreen(vm, open) {}
            }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Synthetic Buyer").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("2").assertExists()
        shot("inbox-directory-synthetic")
        compose.onNodeWithText("Synthetic Buyer").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("I will check the listing.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Transfer to support stays on SegmiQ web. This phone session is not accepted by that route.").assertExists()
        shot("inbox-thread-synthetic")
        compose.onNodeWithText("Message").performTextInput("Synthetic draft that must stay")
        compose.onNodeWithContentDescription("Send message").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Provider session rejected the send.", substring = true).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Synthetic draft that must stay").assertExists()
        shot("inbox-send-failure-synthetic")
        assertTrue(server.requestCount > 0)
        assertTrue(compose.onAllNodesWithText("Delivered").fetchSemanticsNodes().isEmpty())
    }

    private fun shot(name: String) {
        compose.waitForIdle()
        val image = compose.onRoot().captureToImage().asAndroidBitmap()
        savePremiumCapture(compose.activity, name, image)
        image.recycle()
    }

    private companion object {
        const val CONVERSATIONS = """{"conversations":[{"id":"lead-synthetic","name":"Synthetic Buyer","phone":"+263770000111","source":"whatsapp","status":"open","assignee":{"id":"agent-1","name":"Preview Agent"},"assignedToId":"agent-1","lastMessage":"Is the house still available?","lastMessageAt":"2026-10-31T08:00:00Z","unread":2,"conversationStatus":"OPEN"}],"agentEnabled":true}"""
        const val MESSAGES = """{"messages":[{"id":"m1","direction":"customer","text":"Is the house still available?","createdAt":"2026-10-31T08:00:00Z","kind":"message"},{"id":"m2","direction":"rep","text":"I will check the listing.","createdAt":"2026-10-31T08:05:00Z","kind":"message","status":"sent"}],"sessionOpen":true,"isWhatsApp":true,"hasMore":false}"""
        const val REPLIES = """{"replies":[{"id":"qr1","title":"Viewing","body":"I can arrange a viewing.","isDefault":false}]}"""
    }
}
