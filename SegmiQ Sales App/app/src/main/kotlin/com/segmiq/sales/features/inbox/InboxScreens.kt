package com.segmiq.sales.features.inbox

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.inbox.InboxFilter
import com.segmiq.sales.core.inbox.deliveryLabel
import com.segmiq.sales.core.inbox.inboxVisible
import com.segmiq.sales.core.inbox.messageSide
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun InboxDirectoryScreen(vm: InboxViewModel, go: (String) -> Unit) {
    val state by vm.directory.collectAsStateWithLifecycle()
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf(InboxFilter.ALL.name) }
    val selected = InboxFilter.entries.firstOrNull { it.name == filter } ?: InboxFilter.ALL
    LaunchedEffect(Unit) { if (state.conversations.isEmpty()) vm.loadDirectory() }
    val rows = state.conversations.filter { inboxVisible(it, selected, query, vm.userId) }
    Page {
        Text("WhatsApp", style = MaterialTheme.typography.headlineMedium)
        Text("Conversations from SegmiQ. Unread counts come from the server.", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        SegmiqSearchField(query, { query = it }, "Search conversations")
        FilterChips(listOf("All", "Unread", "Open", "Mine"), selected.name.lowercase().replaceFirstChar { it.uppercase() }) {
            filter = it.uppercase()
        }
        TextButton({ vm.loadDirectory() }, enabled = !state.loading) { Text("Refresh") }
        when {
            state.loading && state.conversations.isEmpty() -> SegmiqSkeleton(4)
            state.error != null && state.conversations.isEmpty() -> SegmiqErrorCard(state.error!!, vm::loadDirectory)
            rows.isEmpty() -> SegmiqEmptyState("No conversations", "Nothing in this view matched. Refresh or change the filter.")
            else -> rows.forEach { row ->
                Surface(onClick = { go("live/inbox/${android.net.Uri.encode(row.id)}") }, shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        SegmiqAvatar(row.name ?: row.phone ?: "?")
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(row.name?.takeIf { it.isNotBlank() } ?: row.phone ?: "Unnamed contact", style = MaterialTheme.typography.titleMedium)
                            row.phone?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                            Text(row.lastMessage.ifBlank { "No message text" }, maxLines = 2, style = MaterialTheme.typography.bodyMedium)
                            Text(listOfNotNull(
                                row.conversationStatus.takeIf { it.isNotBlank() },
                                row.assignee?.name?.let { "Assigned to $it" },
                                row.source?.takeIf { it.isNotBlank() },
                                stamp(row.lastMessageAt),
                            ).joinToString(" · "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (row.unread > 0) SegmiqLabel(row.unread.toString(), lime = true)
                    }
                }
            }
        }
    }
}

@Composable
fun InboxThreadScreen(vm: InboxViewModel, leadId: String, go: (String) -> Unit) {
    val state by vm.thread.collectAsStateWithLifecycle()
    var draft by rememberSaveable(leadId) { mutableStateOf("") }
    var sentSnapshot by remember(leadId) { mutableStateOf<String?>(null) }
    val list = rememberLazyListState()
    LaunchedEffect(leadId) { vm.open(leadId) }
    LaunchedEffect(state.sending, state.sendFailed, state.sendNote) {
        val snapshot = sentSnapshot ?: return@LaunchedEffect
        if (!state.sending && state.sendNote != null && !state.sendFailed && draft == snapshot) draft = ""
        if (!state.sending) sentSnapshot = null
    }
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) list.animateScrollToItem(state.messages.lastIndex)
    }
    Column(Modifier.fillMaxSize().imePadding()) {
        LazyColumn(Modifier.weight(1f), state = list, contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Text(state.name ?: "Conversation", style = MaterialTheme.typography.headlineSmall)
                state.phone?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                TextButton({ go("live/lead/${android.net.Uri.encode(leadId)}") }) { Text("Open inquiry") }
                Text("Transfer to support stays on SegmiQ web. This phone session is not accepted by that route.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Attachments cannot be sent from this phone. Received files are labelled, not downloaded.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (state.loading && state.messages.isEmpty()) item { SegmiqSkeleton(4) }
            state.error?.let { item { SegmiqErrorCard(it) { vm.open(leadId) } } }
            if (!state.loading && state.error == null && state.messages.isEmpty()) item {
                SegmiqEmptyState("No messages", "This inquiry has no conversation yet, or you cannot open it.")
            }
            if (state.hasMore) item {
                TextButton({ vm.open(leadId, state.nextBefore) }, enabled = !state.loading) { Text("Older messages") }
            }
            items(state.messages, key = { it.id }) { message ->
                val side = messageSide(message.direction)
                val mine = side == "sent"
                Column(Modifier.fillMaxWidth(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                        modifier = Modifier.widthIn(max = 320.dp).semantics {
                            contentDescription = "${if (mine) "Sent" else "Received"} message. ${message.text}"
                        },
                    ) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            if (message.kind == "system") Text(message.systemTitle ?: "Update", style = MaterialTheme.typography.labelMedium)
                            Text(message.text.ifBlank { message.systemTitle ?: "No text" })
                            if (message.mediaUrl != null || message.mediaMimeType != null) {
                                Text("Attachment${message.mediaMimeType?.let { " · $it" }.orEmpty()}", style = MaterialTheme.typography.labelSmall)
                            }
                            Text(listOfNotNull(stamp(message.createdAt), deliveryLabel(message.status)).joinToString(" · "),
                                style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
            state.sendNote?.let { note ->
                item {
                    Text(note, style = MaterialTheme.typography.bodyMedium)
                    TextButton(vm::dismissSendNote) { Text("Dismiss") }
                }
            }
        }
        if (state.replies.isNotEmpty()) {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                state.replies.take(6).forEach { reply ->
                    FilterChip(false, { draft = if (draft.isBlank()) reply.body else "$draft ${reply.body}" },
                        label = { Text(reply.title, maxLines = 1) })
                }
            }
        }
        if (!state.sessionOpen && state.error == null && !state.loading) {
            Text("The WhatsApp session is closed. SegmiQ will not send this text.",
                Modifier.padding(horizontal = 20.dp), style = MaterialTheme.typography.bodySmall)
        }
        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(draft, { draft = it }, Modifier.weight(1f), label = { Text("Message") }, minLines = 1, maxLines = 4,
                enabled = !state.sending && state.sessionOpen)
            Spacer(Modifier.width(8.dp))
            FilledIconButton(
                onClick = {
                    if (state.sending || draft.isBlank()) return@FilledIconButton
                    sentSnapshot = draft
                    vm.send(leadId, draft)
                },
                enabled = !state.sending && state.sessionOpen && draft.isNotBlank(),
            ) { Icon(Icons.AutoMirrored.Rounded.Send, contentDescription = if (state.sending) "Sending" else "Send message") }
        }
    }
}

private fun stamp(value: String): String? = runCatching {
    Instant.parse(value).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("d MMM, HH:mm"))
}.getOrNull()
