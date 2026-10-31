package com.segmiq.sales.features.live

import androidx.compose.foundation.layout.*
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.expandVertically
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.tween
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Info

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.segmiq.sales.core.notify.SalesNotifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.live.CompletionPlan
import com.segmiq.sales.core.live.CopilotAction
import com.segmiq.sales.core.live.CopilotPolicy
import com.segmiq.sales.core.live.SalesTaskDto
import com.segmiq.sales.core.live.TaskFilter
import com.segmiq.sales.core.live.completionPlan
import com.segmiq.sales.core.live.filterLiveTasks
import java.time.LocalDate

@Composable
private fun StatusLine(state: TasksState) {
    AnimatedVisibility(state.message != null, enter = fadeIn(tween(320)) + expandVertically(tween(240)), exit = fadeOut(tween(160))) {
        Surface(color = if (state.simulated) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.fillMaxWidth().padding(12.dp).semantics { liveRegion = LiveRegionMode.Polite }) {
                Row {
                    Icon(if (state.simulated) Icons.Rounded.Info else Icons.Rounded.CheckCircle, null)
                    Spacer(Modifier.width(8.dp))
                    Text(state.message.orEmpty(), style = MaterialTheme.typography.bodyMedium)
                }
                state.notice?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
    state.error?.let { SegmiqErrorCard(it) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LiveTaskCard(
    task: SalesTaskDto,
    workspace: LiveWorkspace,
    busy: Boolean,
    onOpen: () -> Unit,
    onComplete: () -> Unit,
    onFollowUp: () -> Unit,
    onReview: () -> Unit,
) {
    Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.fillMaxWidth().animateContentSize(tween(SegmiqMotion.Expand)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            AnimatedVisibility(task.completed) {
                Row { Icon(Icons.Rounded.CheckCircle, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(8.dp)); Text("Completed", style = MaterialTheme.typography.labelLarge) }
            }
            Row {
                Text(task.title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                if (task.copilot != null) SegmiqLabel("COPILOT")
            }
            listOfNotNull(task.relatedName, task.typeLabel).joinToString(" · ").takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            val whenText = if (task.completed) task.completedAt?.let { "Completed ${friendlyWhen(it, workspace.zone)}" }
            else listOfNotNull(task.schedule?.label, friendlyWhen(task.schedule?.at ?: task.deadlineAt ?: task.dueAt, workspace.zone)).joinToString(" · ")
            Text(whenText?.ifBlank { null } ?: "No date set", style = MaterialTheme.typography.labelSmall,
                color = if (task.schedule?.overdue == true || task.status == "overdue") MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.onSurfaceVariant)
            if (!task.completed) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (task.completionPlan()) {
                        is CompletionPlan.ClearFollowUp, is CompletionPlan.CompleteWorkItem ->
                            Button(onComplete, enabled = !busy) { Text(if (busy) "Saving…" else "Complete") }
                        CompletionPlan.ReviewFirst -> Button(onReview, enabled = !busy) { Text("Review") }
                        CompletionPlan.AlreadyDone -> Unit
                    }
                    if (workspace.canModifyLeads && task.copilot == null) OutlinedButton(onFollowUp, enabled = !busy) { Text("Reschedule") }
                    TextButton(onOpen) { Text("Open") }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveTasksScreen(vm: TasksViewModel, workspace: LiveWorkspace, go: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    var filter by rememberSaveable { mutableStateOf(TaskFilter.TODAY) }
    var rescheduling by remember { mutableStateOf<SalesTaskDto?>(null) }
    val data = state.data
    val context = LocalContext.current
    LaunchedEffect(data.value, workspace.scope.salespersonId) {
        val payload = data.value ?: return@LaunchedEffect
        val allowed = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (allowed) SalesNotifier.scheduleNext(context, workspace.scope.salespersonId, workspace.scope.organisationId, payload.tasks + payload.upcoming)
    }
    PullToRefreshBox(isRefreshing = data.loading && data.value != null, onRefresh = vm::load, modifier = Modifier.fillMaxSize()) {
        Page {
            FilterChips(TaskFilter.entries.map { it.label }, filter.label) { label -> filter = TaskFilter.entries.first { it.label == label } }
            StatusLine(state)
            val payload = data.value
            when {
                payload != null -> {
                    val today = LocalDate.now(workspace.zone)
                    val all = payload.tasks + payload.upcoming
                    val shown = filterLiveTasks(all, filter, today, workspace.zone)
                    payload.kpis?.let { k ->
                        Text("${k.dueToday} due today · ${k.overdue} overdue · ${k.completedThisWeek} completed this week",
                            style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (filter == TaskFilter.CUSTOMER_LINKED) {
                        Text("Every SegmiQ task is a follow-up on a customer, so this shows all open tasks.",
                            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (shown.isEmpty()) SegmiqEmptyState(
                        when (filter) {
                            TaskFilter.COMPLETED -> "No completed tasks to show"
                            TaskFilter.OVERDUE -> "Nothing overdue"
                            TaskFilter.TODAY -> "Nothing due today"
                            else -> "No open tasks"
                        },
                        if (filter == TaskFilter.COMPLETED) "SegmiQ only lists recently completed follow-ups here." else "New follow-ups will appear here.",
                    )
                    shown.forEach { t ->
                        LiveTaskCard(t, workspace, t.id in state.busyIds,
                            onOpen = { go("live/lead/${t.leadId}") },
                            onComplete = { vm.complete(t) },
                            onFollowUp = { rescheduling = t },
                            onReview = { go(com.segmiq.sales.core.bootstrap.LiveModule.COPILOT.route) })
                    }
                    data.error?.let { SegmiqErrorCard(it.message, vm::load) }
                    updatedLabel(data.updatedAt, workspace.zone)?.let {
                        Text("$it · times in ${workspace.zone.id}", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                data.loading -> SegmiqSkeleton(4)
                data.error != null -> SegmiqErrorCard(data.error!!.message, vm::load)
            }
        }
    }
    rescheduling?.let { task ->
        FollowUpDateDialog(null, workspace.zone, { rescheduling = null }) { date ->
            rescheduling = null
            vm.followUp(task, date)
        }
    }
}

private fun queueTitle(queue: String?) = when (queue) {
    "needs_review" -> "Needs your review"
    "todo" -> "To do"
    "waiting" -> "Waiting on the customer"
    else -> "Other suggestions"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveCopilotScreen(vm: TasksViewModel, workspace: LiveWorkspace, go: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    var snoozing by remember { mutableStateOf<SalesTaskDto?>(null) }
    val data = state.data
    PullToRefreshBox(isRefreshing = data.loading && data.value != null, onRefresh = vm::load, modifier = Modifier.fillMaxSize()) {
        Page {
            SegmiqCopilotHeader("Review verified work items before creating a commitment.")
            Text("Suggestions from SegmiQ's Sales Copilot. Nothing is sent, booked or quoted unless you approve it, " +
                "and quotations and appointments are only prepared on the web.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            StatusLine(state)
            val payload = data.value
            when {
                payload != null -> {
                    if (payload.meta?.copilotUnavailable == true) {
                        SegmiqEmptyState("Sales Copilot is unavailable", "Suggestions couldn't be loaded right now. Pull to refresh to try again.")
                    }
                    val items = (payload.tasks + payload.upcoming).distinctBy { it.id }.filter { it.copilot != null && !it.completed }
                    if (items.isEmpty() && payload.meta?.copilotUnavailable != true) {
                        SegmiqEmptyState("No suggestions right now", "When Copilot spots a follow-up or commitment in a conversation, it appears here for review.")
                    }
                    items.groupBy { it.copilot!!.queue }.toSortedMap(compareBy { listOf("needs_review", "todo", "waiting").indexOf(it).let { i -> if (i < 0) 9 else i } })
                        .forEach { (queue, group) ->
                            SectionTitle(queueTitle(queue))
                            group.forEach { t -> CopilotCard(t, workspace, t.id in state.busyIds, vm, go) { snoozing = t } }
                        }
                    data.error?.let { SegmiqErrorCard(it.message, vm::load) }
                }
                data.loading -> SegmiqSkeleton(4)
                data.error != null -> SegmiqErrorCard(data.error!!.message, vm::load)
            }
        }
    }
    snoozing?.let { task ->
        DateTimeDialog("Show again at", workspace.zone, { snoozing = null }) { at ->
            snoozing = null
            vm.copilot(task, CopilotAction.SNOOZE, at)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CopilotCard(task: SalesTaskDto, workspace: LiveWorkspace, busy: Boolean, vm: TasksViewModel, go: (String) -> Unit, onSnooze: () -> Unit) {
    val c = task.copilot ?: return
    var expanded by rememberSaveable(task.id) { mutableStateOf(false) }
    SegmiqCard(Modifier.animateContentSize(tween(SegmiqMotion.Expand))) {
        Text(c.actionLabel ?: c.primaryLabel ?: task.title, style = MaterialTheme.typography.titleMedium)
        task.relatedName?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        c.explanation?.takeIf { it.isNotBlank() }?.let { explanation ->
            TextButton({ expanded = !expanded }) { Text(if (expanded) "Hide supporting context" else "Why this action?") }
            AnimatedVisibility(expanded) { Text(explanation, style = MaterialTheme.typography.bodyMedium) }
        }
        friendlyWhen(c.proposedAt ?: task.schedule?.at, workspace.zone)?.let { Text("Proposed: $it", style = MaterialTheme.typography.labelSmall) }
        if (c.missing.isNotEmpty()) Text("Still needed: ${c.missing.joinToString(", ")}", style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.error)
        c.executionError?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error) }
        if (c.reviewStatus == "approved") Text("Approved", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        if (CopilotPolicy.requiresWeb(c)) {
            Text("Review this on the SegmiQ website. The app never prepares quotations or appointments.",
                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (CopilotPolicy.canApprove(c)) Button({ vm.copilot(task, CopilotAction.APPROVE) }, enabled = !busy) { Text("Approve") }
            if (CopilotPolicy.canComplete(c)) Button({ vm.copilot(task, CopilotAction.COMPLETE) }, enabled = !busy) { Text("Complete") }
            if (CopilotPolicy.canSnooze(c)) OutlinedButton(onSnooze, enabled = !busy) { Text("Snooze") }
            if (CopilotPolicy.canDismiss(c)) OutlinedButton({ vm.copilot(task, CopilotAction.DISMISS) }, enabled = !busy) { Text("Dismiss") }
            TextButton({ go("live/lead/${task.leadId}") }) { Text("Open customer") }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    }
}
