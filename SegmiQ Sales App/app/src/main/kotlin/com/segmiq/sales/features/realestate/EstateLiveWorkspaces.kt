package com.segmiq.sales.features.realestate

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.live.*
import com.segmiq.sales.features.live.*
import java.time.*
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateInquiries(vm: LeadsViewModel, workspace: LiveWorkspace, go: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    var sort by rememberSaveable { mutableStateOf("Recent") }
    val rows = remember(state.items, sort) {
        when (sort) {
            "Name" -> state.items.sortedBy { it.name?.lowercase() ?: "" }
            "Follow-up" -> state.items.sortedBy { it.followUpDate ?: "9999" }
            else -> state.items
        }
    }
    PullToRefreshBox(state.loading, vm::reload) {
        LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { EstatePageHeader("Inquiries", "Your authorised customer conversations and next steps.") }
            item { SegmiqSearchField(state.query, vm::setQuery, "Search inquiries") }
            item { FilterChips(LEAD_STAGE_FILTERS.map { it.second },
                LEAD_STAGE_FILTERS.firstOrNull { it.first == state.stage }?.second ?: "All") { label ->
                vm.setStage(LEAD_STAGE_FILTERS.first { it.second == label }.first)
            } }
            item {
                Text("Sort loaded inquiries", style = MaterialTheme.typography.labelLarge)
                FilterChips(listOf("Recent", "Name", "Follow-up"), sort) { sort = it }
                Text("${state.total} authorised results · Assignment scope is enforced by SegmiQ",
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            state.error?.let { item { SegmiqErrorCard(it.message, vm::reload) } }
            if (state.loading && rows.isEmpty()) item { SegmiqSkeleton(4) }
            if (state.loadedOnce && rows.isEmpty() && state.error == null) item {
                EstateNotice("No inquiries to show", "Try another search or status, or pull to refresh.", Icons.Rounded.Forum)
            }
            items(rows, key = { it.id }) { row ->
                Surface(onClick = { go("live/lead/${row.id}") }, shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            SegmiqAvatar(row.name ?: "?")
                            Column(Modifier.weight(1f)) {
                                Text(row.name ?: row.phone ?: "Unnamed inquiry", style = MaterialTheme.typography.titleMedium)
                                Text(row.contextLine ?: row.sourceLabel ?: "Source not supplied", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        EstateStatusBadge(leadStatusLabel(row.status))
                        row.followUpDate?.let { Text("Follow-up: ${friendlyWhen(it, workspace.zone) ?: it}", style = MaterialTheme.typography.bodyMedium,
                            color = if (row.followUpOverdue) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) }
                        row.lastContactAt?.let { Text("Last contact: ${friendlyWhen(it, workspace.zone) ?: it}", style = MaterialTheme.typography.labelSmall) }
                        row.createdAt?.let { Text("Received: ${friendlyWhen(it, workspace.zone) ?: it}", style = MaterialTheme.typography.labelSmall) }
                    }
                }
            }
            if (state.canLoadMore) item { OutlinedButton(vm::loadMore, enabled = !state.loadingMore) { Text("Load more inquiries") } }
        }
    }
}

@Composable
fun EstateInquiryDetail(vm: LeadDetailViewModel, workspace: LiveWorkspace, go: (String) -> Unit, access: com.segmiq.sales.core.estate.EstateAccess? = null) {
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf("Overview") }
    var note by rememberSaveable { mutableStateOf("") }
    var picking by remember { mutableStateOf(false) }
    var phoneError by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val lead = state.lead.value
    LaunchedEffect(state.actionMessage) { if (state.actionMessage == "Note saved") note = "" }
    com.segmiq.sales.app.Page {
        when {
            lead == null && state.lead.loading -> SegmiqSkeleton(4)
            lead == null && state.lead.error != null -> SegmiqErrorCard(state.lead.error!!.message, vm::load)
            lead != null -> {
                SegmiqCard {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        SegmiqAvatar(lead.name ?: "?")
                        Column(Modifier.weight(1f)) {
                            Text(lead.name ?: "Unnamed inquiry", style = MaterialTheme.typography.headlineMedium)
                            lead.phone?.let { Text(it) }
                            EstateStatusBadge(leadStatusLabel(lead.status))
                        }
                    }
                    Text(if (lead.assigned_to_id == workspace.scope.salespersonId) "Assigned to you" else "Read-only inquiry",
                        style = MaterialTheme.typography.labelSmall)
                }
                phoneError?.let { SegmiqErrorCard(it) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    lead.phone?.let { phone -> OutlinedButton({
                        runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone)))) }
                            .onFailure { phoneError = "No phone app is available on this device." }
                    }) { Icon(Icons.Rounded.Call, null); Spacer(Modifier.width(6.dp)); Text("Call") } }
                    if (workspace.navigation.allows(LiveModule.INBOX)) OutlinedButton({ go("live/inbox/${Uri.encode(lead.id)}") }) { Text("WhatsApp") }
                    OutlinedButton({ go("live/recorder?customerId=${Uri.encode(lead.id)}&customerLabel=${Uri.encode(lead.name ?: "")}") }) { Text("Record") }
                    if (workspace.navigation.allows(LiveModule.COPILOT)) TextButton({ go(LiveModule.COPILOT.route) }) { Text("Copilot") }
                }
                FilterChips(listOf("Overview", "Activity", "Notes"), tab) { tab = it }
                state.actionMessage?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                state.actionError?.let { SegmiqErrorCard(it) }
                val canEdit = workspace.canModifyLeads && lead.assigned_to_id == workspace.scope.salespersonId
                when (tab) {
                    "Overview" -> {
                        SectionTitle("Requirements")
                        SegmiqCard {
                            Text(lead.project_type ?: "Property requirements not supplied")
                            Text(lead.budget?.let { "Budget: $it" } ?: "Budget not supplied")
                            lead.email?.let { Text(it) }
                        }
                        SectionTitle("Next follow-up")
                        Text(friendlyWhen(lead.follow_up_date, workspace.zone) ?: "No follow-up set")
                        if (canEdit) OutlinedButton({ picking = true }, enabled = !state.saving) { Text("Set follow-up") }
                        if (canEdit) {
                            Text("Inquiry status", style = MaterialTheme.typography.titleMedium)
                            FilterChips(listOf("New", "Contacted", "Qualified"), leadStatusLabel(lead.status)) {
                                if (!state.saving) vm.setStatus(mapOf("New" to "NEW", "Contacted" to "CONTACTED", "Qualified" to "QUALIFIED").getValue(it))
                            }
                        }
                        SectionTitle("Related work")
                        Text("No buyer-search, viewing, or offer id is attached to this inquiry. Related records are not guessed from a name or phone number. The relationship feed accepts a browser sign-in only, so this phone does not call it.",
                            style = MaterialTheme.typography.bodyMedium)
                        if (workspace.navigation.allows(LiveModule.COPILOT)) EstateContextRow("Sales Copilot", "Review existing server recommendations") { go(LiveModule.COPILOT.route) }
                    }
                    "Activity" -> {
                        SectionTitle("Customer timeline")
                        state.timelineError?.let { SegmiqErrorCard(it.message) { vm.loadTimeline(true) } }
                        if (state.timelineLoading && state.timeline.isEmpty()) SegmiqSkeleton(3)
                        if (state.timeline.isEmpty() && !state.timelineLoading && state.timelineError == null) Text("No recorded activity.")
                        EstateTimeline(state.timeline.map { listOfNotNull(it.title, it.summary, friendlyWhen(it.occurredAt, workspace.zone)).joinToString(" · ") })
                        if (state.timelineHasMore) OutlinedButton({ vm.loadTimeline() }, enabled = !state.timelineLoading) { Text("Older activity") }
                    }
                    else -> {
                        SectionTitle("Internal note")
                        Text("Saved to this customer's SegmiQ timeline. Your organisation's access rules apply.", style = MaterialTheme.typography.bodyMedium)
                        if (canEdit) {
                            OutlinedTextField(note, { note = it.take(2000) }, Modifier.fillMaxWidth(), minLines = 4,
                                label = { Text("Write a note") }, enabled = !state.saving)
                            SegmiqPrimaryButton(if (state.saving) "Saving…" else "Save note", { vm.addNote(note) },
                                enabled = note.isNotBlank() && !state.saving)
                        } else Text("You cannot modify this inquiry.")
                    }
                }
                if (picking) FollowUpDateDialog(parseServerDate(lead.follow_up_date, workspace.zone), workspace.zone, { picking = false }) {
                    picking = false; vm.setFollowUp(it)
                }
            }
        }
    }
}

fun calendarTasks(tasks: List<SalesTaskDto>, date: LocalDate, zone: ZoneId, week: Boolean): List<SalesTaskDto> {
    val start = if (week) date.with(java.time.DayOfWeek.MONDAY) else date
    val end = start.plusDays(if (week) 7 else 1)
    return tasks.filter { task ->
        val day = parseServerDate(task.schedule?.at ?: task.deadlineAt ?: task.dueAt, zone)
        day != null && !day.isBefore(start) && day.isBefore(end)
    }.sortedBy { it.schedule?.at ?: it.deadlineAt ?: it.dueAt }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun EstateCalendar(vm: TasksViewModel, workspace: LiveWorkspace, go: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    var dateString by rememberSaveable { mutableStateOf(LocalDate.now(workspace.zone).toString()) }
    var mode by rememberSaveable { mutableStateOf("Day") }
    var picker by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<SalesTaskDto?>(null) }
    LaunchedEffect(state.data.value, state.data.error) { if (state.data.value == null && state.data.error != null) selected = null }
    val date = LocalDate.parse(dateString)
    val all = state.data.value?.let { (it.tasks + it.upcoming).distinctBy(SalesTaskDto::id) } ?: emptyList()
    val rows = calendarTasks(all, date, workspace.zone, mode == "Week")
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { EstatePageHeader("Activities", "Your schedule in ${workspace.zone.id}") }
        item { SegmiqLabel("PARTIAL CALENDAR · TASKS & FOLLOW-UPS")
            Text("Viewings and meetings are not connected. No appointments are inferred from tasks.", style = MaterialTheme.typography.bodyMedium) }
        item {
            FilterChips(listOf("Day", "Week"), mode) { mode = it }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton({ dateString = date.minusDays(if (mode == "Week") 7 else 1).toString() }) { Icon(Icons.Rounded.ChevronLeft, "Previous date") }
                TextButton({ picker = true }, Modifier.weight(1f)) { Text(date.format(DateTimeFormatter.ofPattern("d MMM yyyy"))) }
                IconButton({ dateString = date.plusDays(if (mode == "Week") 7 else 1).toString() }) { Icon(Icons.Rounded.ChevronRight, "Next date") }
            }
            val marked = (0..6).map { date.with(DayOfWeek.MONDAY).plusDays(it.toLong()) }
                .filter { calendarTasks(all, it, workspace.zone, false).isNotEmpty() }.toSet()
            SegmiqWeekStrip(date, marked) { dateString = it.toString() }
            TextButton({ dateString = LocalDate.now(workspace.zone).toString() }) { Text("Today") }
        }
        state.data.error?.let { item { SegmiqErrorCard(it.message, vm::load) } }
        if (state.data.loading && state.data.value == null) item { SegmiqSkeleton(4) }
        if (state.data.value != null && rows.isEmpty()) item { EstateNotice("No scheduled tasks", "Nothing in this date range. Undated tasks remain in Tasks.", Icons.Rounded.EventAvailable) }
        items(rows, key = { it.id }) { task ->
            EstateModuleRow(task.title, listOfNotNull(task.relatedName, friendlyWhen(task.schedule?.at ?: task.deadlineAt ?: task.dueAt, workspace.zone),
                if (task.schedule?.overdue == true) "Overdue" else null).joinToString(" · "), Icons.Rounded.Schedule) { selected = task }
        }
        item { TextButton(vm::load, enabled = !state.data.loading) { Text("Refresh schedule") } }
    }
    selected?.let { task -> ModalBottomSheet(onDismissRequest = { selected = null }) {
        Column(Modifier.padding(20.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(task.title, style = MaterialTheme.typography.headlineSmall)
            Text(task.notes ?: "No additional notes.")
            if (workspace.navigation.allows(LiveModule.LEADS)) SegmiqPrimaryButton("Open inquiry", { selected = null; go("live/lead/${task.leadId}") })
            TextButton({ selected = null; go(LiveModule.TASKS.route) }) { Text("Review task") }
        }
    } }
    if (picker) {
        val pick = rememberDatePickerState(initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(onDismissRequest = { picker = false },
            confirmButton = { TextButton({ pick.selectedDateMillis?.let { dateString = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString() }; picker = false }) { Text("Choose date") } },
            dismissButton = { TextButton({ picker = false }) { Text("Cancel") } }) { DatePicker(pick) }
    }
}
