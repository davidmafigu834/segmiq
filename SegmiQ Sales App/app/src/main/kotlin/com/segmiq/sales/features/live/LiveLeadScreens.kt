package com.segmiq.sales.features.live

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.bootstrap.LiveModule
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.live.LEAD_SOURCES
import com.segmiq.sales.core.live.LeadDirectoryRow
import com.segmiq.sales.core.live.NewLeadInput
import com.segmiq.sales.core.live.parseServerDate
import com.segmiq.sales.core.network.ErrorKind

@Composable
private fun LeadRow(lead: LeadDirectoryRow, workspace: LiveWorkspace, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            SegmiqAvatar(lead.name ?: lead.phone ?: "?")
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(lead.name?.takeIf { it.isNotBlank() } ?: lead.phone ?: "Unnamed", style = MaterialTheme.typography.titleMedium)
                val line = lead.contextLine ?: listOfNotNull(lead.company, lead.sourceLabel).joinToString(" · ")
                if (line.isNotBlank()) Text(line, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                val follow = parseServerDate(lead.followUpDate, workspace.zone)?.let { "Follow-up ${friendlyDate(it, workspace.zone)}" }
                Text(listOfNotNull(leadStatusLabel(lead.status), follow).joinToString(" · "), style = MaterialTheme.typography.labelSmall,
                    color = if (lead.followUpOverdue) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun LiveLeadsScreen(vm: LeadsViewModel, workspace: LiveWorkspace, go: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    val terms = workspace.leadTerms()
    Page {
        SegmiqSearchField(state.query, vm::setQuery, "Search ${terms.plural.lowercase()} by name or phone")
        FilterChips(LEAD_STAGE_FILTERS.map { it.second }, LEAD_STAGE_FILTERS.first { it.first == state.stage }.second) { label ->
            vm.setStage(LEAD_STAGE_FILTERS.first { it.second == label }.first)
        }
        Text("${terms.plural} assigned to you" + if (state.loadedOnce && !state.loading) " · ${state.total}" else "",
            style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        state.error?.let { SegmiqErrorCard(it.message, vm::reload) }
        when {
            state.loading && state.items.isEmpty() -> SegmiqSkeleton(3)
            state.loadedOnce && state.items.isEmpty() && state.error == null -> SegmiqEmptyState(
                if (state.query.isBlank() && state.stage == "all") "No ${terms.plural.lowercase()} assigned yet" else "No matches",
                if (state.query.isBlank() && state.stage == "all") "${terms.plural} assigned to you in SegmiQ will appear here."
                else "Try a different search or stage.",
            )
        }
        state.items.forEach { lead -> LeadRow(lead, workspace) { go("live/lead/${lead.id}") } }
        if (state.canLoadMore || state.loadingMore) {
            OutlinedButton(vm::loadMore, Modifier.fillMaxWidth(), enabled = !state.loadingMore) {
                Text(if (state.loadingMore) "Loading…" else "Load more (${state.items.size} of ${state.total})")
            }
        }
    }
}

private val EDITABLE_STATUSES = listOf("NEW" to "New", "CONTACTED" to "Contacted", "QUALIFIED" to "Qualified")

@Composable
fun LeadDetailScreen(vm: LeadDetailViewModel, workspace: LiveWorkspace, go: (String) -> Unit = {}) {
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var note by rememberSaveable { mutableStateOf("") }
    var picking by remember { mutableStateOf(false) }
    val terms = workspace.leadTerms()
    LaunchedEffect(state.actionMessage) { if (state.actionMessage == "Note saved") note = "" }

    Page {
        val lead = state.lead.value
        when {
            lead == null && state.lead.loading -> SegmiqSkeleton(4)
            lead == null && state.lead.error != null -> {
                val e = state.lead.error!!
                if (e.kind == ErrorKind.NOT_FOUND) SegmiqEmptyState("This ${terms.singular.lowercase()} isn't available",
                    "It may have been reassigned or removed, or it isn't assigned to you.")
                else SegmiqErrorCard(e.message, vm::load)
            }
            lead != null -> {
                SegmiqCard {
                    Text(lead.name?.takeIf { it.isNotBlank() } ?: "Unnamed ${terms.singular.lowercase()}", style = MaterialTheme.typography.headlineMedium)
                    SegmiqLabel(leadStatusLabel(lead.status).uppercase())
                    lead.phone?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
                    lead.email?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                    listOfNotNull(lead.project_type, lead.budget?.let { "Budget $it" }).takeIf { it.isNotEmpty() }?.let {
                        Text(it.joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (lead.assigned_to_id == workspace.scope.salespersonId) {
                        Text("Assigned to you", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (lead.phone != null) {
                    SegmiqPrimaryButton("Call with phone app", {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(lead.phone))))
                    }, Modifier.fillMaxWidth())
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton({ go("live/recorder?customerId=${Uri.encode(lead.id)}&customerLabel=${Uri.encode(lead.name ?: "")}") }) { Text("Record meeting") }
                    if (workspace.navigation.allows(LiveModule.INBOX)) OutlinedButton({ go("live/inbox/${Uri.encode(lead.id)}") }) { Text("WhatsApp") }
                    if (workspace.navigation.allows(LiveModule.COPILOT)) TextButton({ go(LiveModule.COPILOT.route) }) { Text("Sales Copilot") }
                }

                state.actionMessage?.let {
                    Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                }
                state.actionError?.let { SegmiqErrorCard(it) }

                SectionTitle("Follow-up")
                val follow = parseServerDate(lead.follow_up_date, workspace.zone)
                Text(follow?.let { "Due ${friendlyDate(it, workspace.zone)}" } ?: "No follow-up set", style = MaterialTheme.typography.bodyLarge)
                if (workspace.canModifyLeads) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton({ picking = true }, enabled = !state.saving) { Text(if (follow == null) "Set date" else "Change date") }
                        if (follow != null) OutlinedButton(vm::clearFollowUp, enabled = !state.saving) { Text("Mark done") }
                    }
                    SectionTitle("Status")
                    FilterChips(EDITABLE_STATUSES.map { it.second }, leadStatusLabel(lead.status)) { label ->
                        val target = EDITABLE_STATUSES.first { it.second == label }.first
                        if (target != lead.status && !state.saving) vm.setStatus(target)
                    }
                    SectionTitle("Add a note")
                    OutlinedTextField(note, { note = it.take(2000) }, Modifier.fillMaxWidth(), label = { Text("Internal note") },
                        minLines = 3, enabled = !state.saving, shape = RoundedCornerShape(16.dp))
                    SegmiqPrimaryButton(if (state.saving) "Saving…" else "Save note", { vm.addNote(note) }, Modifier.fillMaxWidth(),
                        enabled = !state.saving && note.isNotBlank())
                }

                SectionTitle("Timeline")
                state.timelineError?.let { SegmiqErrorCard(it.message) { vm.loadTimeline(reset = true) } }
                if (state.timeline.isEmpty() && state.timelineLoading) SegmiqSkeleton(2)
                if (state.timeline.isEmpty() && !state.timelineLoading && state.timelineError == null) {
                    Text("No activity yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                state.timeline.forEach { item ->
                    SegmiqCard {
                        Text(item.title, style = MaterialTheme.typography.titleMedium)
                        item.summary?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                        Text(listOfNotNull(item.actorName, friendlyWhen(item.occurredAt, workspace.zone)).joinToString(" · "),
                            style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (state.timelineHasMore) {
                    OutlinedButton({ vm.loadTimeline() }, enabled = !state.timelineLoading) { Text("Older activity") }
                }
                if (picking) FollowUpDateDialog(follow, workspace.zone, { picking = false }) { date ->
                    picking = false
                    vm.setFollowUp(date)
                }
            }
        }
    }
}

@Composable
fun LiveAddLeadScreen(vm: AddLeadViewModel, workspace: LiveWorkspace, onCreated: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    var name by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var source by rememberSaveable { mutableStateOf(LEAD_SOURCES.first()) }
    var notes by rememberSaveable { mutableStateOf("") }
    val terms = workspace.leadTerms()
    val input = NewLeadInput(name, phone, email, source, notes)
    LaunchedEffect(state.createdLeadId) { state.createdLeadId?.let(onCreated) }

    Page {
        Text("New ${terms.plural.lowercase()} you add are assigned to you.", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(name, { name = it.take(200) }, Modifier.fillMaxWidth(), label = { Text("Customer name") }, singleLine = true,
            shape = RoundedCornerShape(16.dp), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next))
        OutlinedTextField(phone, { phone = it.filter { c -> c.isDigit() || c in "+ ()-" }.take(40) },
            Modifier.fillMaxWidth().onFocusChanged { if (!it.isFocused && phone.isNotBlank()) vm.lookup(phone) },
            label = { Text("Phone") }, singleLine = true, shape = RoundedCornerShape(16.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Next),
            supportingText = { if (state.checking) Text("Checking for an existing customer…") })
        state.match?.let { m ->
            SegmiqCard {
                Text("Existing customer: ${m.name ?: "unnamed"}", style = MaterialTheme.typography.titleMedium)
                Text(when {
                    m.ownedByYou -> "Already assigned to you."
                    m.owner != null -> "Assigned to ${m.owner}."
                    else -> "Not currently assigned."
                }, style = MaterialTheme.typography.bodyMedium)
                if (m.ownedByYou && m.leadId != null) TextButton({ onCreated(m.leadId) }) { Text("Open existing ${terms.singular.lowercase()}") }
            }
        }
        OutlinedTextField(email, { email = it.take(200) }, Modifier.fillMaxWidth(), label = { Text("Email (optional)") }, singleLine = true,
            shape = RoundedCornerShape(16.dp), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next))
        Text("Source", style = MaterialTheme.typography.labelLarge)
        FilterChips(LEAD_SOURCES, source) { source = it }
        OutlinedTextField(notes, { notes = it.take(5000) }, Modifier.fillMaxWidth(), label = { Text("Notes (optional)") }, minLines = 3,
            shape = RoundedCornerShape(16.dp))
        state.fieldError?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive }) }
        state.error?.let { SegmiqErrorCard(it) }
        state.duplicate?.let { d ->
            SegmiqCard {
                Text("This phone number already exists", style = MaterialTheme.typography.titleMedium)
                Text(listOfNotNull(d.name, d.leadStatus?.let(::leadStatusLabel),
                    if (d.ownedByYou) "assigned to you" else d.owner?.let { "assigned to $it" }).joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium)
                if (d.ownedByYou && d.leadId != null) TextButton({ onCreated(d.leadId) }) { Text("Open existing ${terms.singular.lowercase()}") }
                OutlinedButton({ vm.submit(input, forceNew = true) }, enabled = !state.saving) { Text("Create a new ${terms.singular.lowercase()} anyway") }
                TextButton(vm::clearDuplicate) { Text("Cancel") }
            }
        }
        SegmiqPrimaryButton(if (state.saving) "Saving…" else "Save ${terms.singular.lowercase()}", { vm.submit(input) },
            Modifier.fillMaxWidth(), enabled = !state.saving && state.duplicate == null)
    }
}
