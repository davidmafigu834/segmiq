package com.segmiq.sales.features.live

import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.segmiq.sales.core.calling.DialReturnState
import com.segmiq.sales.core.calling.dialReturnAfter
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.bootstrap.Experience
import com.segmiq.sales.core.bootstrap.HomeVariant
import com.segmiq.sales.core.bootstrap.LiveModule
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.bootstrap.NavItem
import com.segmiq.sales.core.data.validPhone
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.live.ContactMatch
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.SalesTaskDto
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.phone.PhoneNumbers
import kotlinx.coroutines.delay
import com.segmiq.sales.ui.theme.Lime
import com.segmiq.sales.ui.theme.Ink
import okhttp3.HttpUrl
import java.time.LocalTime

@Composable
private fun MetricTile(label: String, value: String, caption: String?, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val content: @Composable ColumnScope.() -> Unit = {
        Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.headlineMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (caption != null) Text(caption, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (onClick != null) {
        Surface(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp), content = content)
        }
    } else {
        Surface(modifier = modifier, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp), content = content)
        }
    }
}

@Composable
fun TaskSummaryRow(task: SalesTaskDto, workspace: LiveWorkspace, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(task.title, style = MaterialTheme.typography.titleMedium)
            val who = listOfNotNull(task.relatedName, task.typeLabel).joinToString(" · ")
            if (who.isNotBlank()) Text(who, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val whenText = friendlyWhen(task.schedule?.at ?: task.deadlineAt ?: task.dueAt, workspace.zone)
            Text(
                listOfNotNull(task.schedule?.label, whenText).joinToString(" · ").ifBlank { "No date set" },
                style = MaterialTheme.typography.labelSmall,
                color = if (task.schedule?.overdue == true || task.status == "overdue") MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveMyDayScreen(vm: MyDayViewModel, workspace: LiveWorkspace, go: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    val terms = workspace.leadTerms()
    PullToRefreshBox(isRefreshing = state.refreshing, onRefresh = { vm.load(refresh = true) }, modifier = Modifier.fillMaxSize()) {
        Page {
            val part = state.workspace.value?.greetingPart ?: when (LocalTime.now(workspace.zone).hour) {
                in 0..11 -> "morning"; in 12..16 -> "afternoon"; else -> "evening"
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Good $part, ${workspace.userName.substringBefore(' ')}", style = MaterialTheme.typography.headlineLarge,
                    modifier = Modifier.semantics { heading() })
                Text(
                    workspace.organisationName + if (workspace.homeVariant == HomeVariant.SOLO) " · Your business" else "",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (workspace.experience == Experience.REAL_ESTATE) {
                SegmiqCard {
                    SegmiqLabel("AGENT HOME · PARTIAL")
                    Text("Your tasks, inquiries and Copilot suggestions are live. Property, viewing, offer and transaction " +
                        "dashboards aren't in the Android app yet. Use SegmiQ on the web for those.",
                        style = MaterialTheme.typography.bodyMedium)
                }
            }

            // Commercial metrics
            val dash = state.dashboard
            when {
                dash.value != null -> {
                    val c = dash.value!!.commercial
                    if (c == null) {
                        SegmiqEmptyState("Sales metrics unavailable", "SegmiQ didn't return sales metrics for your account.")
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            MetricTile("New enquiries", c.newEnquiriesToday.toString(), "Today", Modifier.weight(1f)) { go(LiveModule.LEADS.route) }
                            MetricTile("Active deals", c.activeDeals.toString(), "In pipeline", Modifier.weight(1f))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            MetricTile("Follow-ups due", c.followUpsDueToday.toString(),
                                if (c.followUpsOverdue > 0) "${c.followUpsOverdue} overdue" else "Today", Modifier.weight(1f)) { go(LiveModule.TASKS.route) }
                            val value = if (c.pipelineValueKnown > 0 || c.activeDeals == 0) formatAmount(c.pipelineValueKnown, workspace.currencyCode) else "Not estimated"
                            val caption = buildList {
                                if (c.pipelineAwaitingEstimate > 0) add("+${c.pipelineAwaitingEstimate} awaiting estimate")
                                if (workspace.currencyCode == null) add("Currency not set")
                            }.joinToString(" · ").ifBlank { "Known values" }
                            MetricTile("Pipeline value", value, caption, Modifier.weight(1f))
                        }
                    }
                    dash.error?.let { SegmiqErrorCard("Metrics may be out of date. ${it.message}") { vm.load() } }
                }
                dash.loading -> SegmiqSkeleton(4)
                dash.error != null -> SegmiqErrorCard(dash.error!!.message) { vm.load() }
            }

            // Today's work from the daily workspace
            val ws = state.workspace
            SectionTitle("Today's work", "All tasks") { go(LiveModule.TASKS.route) }
            when {
                ws.value != null -> {
                    val w = ws.value!!
                    w.briefing?.takeIf { it.isNotBlank() }?.let { SegmiqCard(dark = true) { Text(it, style = MaterialTheme.typography.bodyLarge) } }
                    if (w.actions.isEmpty()) SegmiqEmptyState("Nothing due right now", "You have no open follow-ups needing action.")
                    w.actions.forEach { t -> TaskSummaryRow(t, workspace) { go("live/lead/${t.leadId}") } }
                    if (w.openCount > w.actions.size) Text("${w.openCount} open in total", style = MaterialTheme.typography.labelSmall)
                    ws.error?.let { SegmiqErrorCard(it.message) { vm.load() } }
                }
                ws.loading -> SegmiqSkeleton(3)
                ws.error != null -> SegmiqErrorCard(ws.error!!.message) { vm.load() }
            }

            // Sales Copilot
            val tasks = state.tasks
            tasks.value?.let { t ->
                val review = t.tasks.count { it.copilot?.queue == "needs_review" && !it.completed }
                if (t.meta?.copilotUnavailable == true) {
                    SegmiqEmptyState("Sales Copilot is unavailable", "Suggestions couldn't be loaded. Your tasks are unaffected.")
                } else if (workspace.navigation.allows(LiveModule.COPILOT)) {
                    SegmiqActionRow(
                        "Sales Copilot",
                        if (review == 0) "No suggestions need your review" else "$review suggestion${if (review == 1) "" else "s"} need your review",
                        Icons.Rounded.AutoAwesome,
                    ) { go(LiveModule.COPILOT.route) }
                }
            }
            if (tasks.value == null && tasks.error != null) SegmiqErrorCard("Copilot suggestions: ${tasks.error!!.message}") { vm.load() }

            // Meetings: no mobile meeting feed exists, so none are shown.
            SegmiqCard {
                Text("Meetings", style = MaterialTheme.typography.titleMedium)
                Text("Your SegmiQ calendar isn't available in the app yet, so no meetings are shown here.",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            // Recent updates
            ws.value?.updates?.let { u ->
                SectionTitle(u.heading ?: "Recent updates")
                when {
                    u.unavailable -> SegmiqEmptyState("Updates unavailable", "Recent customer updates couldn't be loaded.")
                    u.items.isEmpty() -> Text("No new customer updates${u.timeframe?.let { " in the $it" } ?: ""}.",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    else -> u.items.forEach { item ->
                        Surface(onClick = { item.leadId?.let { go("live/lead/$it") } }, shape = RoundedCornerShape(18.dp),
                            color = MaterialTheme.colorScheme.surface, enabled = item.leadId != null) {
                            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(item.leadName ?: "A customer", style = MaterialTheme.typography.titleMedium)
                                (item.detail ?: item.summary)?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                friendlyWhen(item.at, workspace.zone)?.let {
                                    Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }

            // Recent activity
            dash.value?.recentActivity?.takeIf { it.isNotEmpty() }?.let { items ->
                SectionTitle("Recent activity")
                items.take(5).forEach { a ->
                    SegmiqCard {
                        Text(a.title, style = MaterialTheme.typography.titleMedium)
                        a.detail?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                        a.timeLabel?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
            }

            if (dash.value?.hasAnyLeads == false && dash.value?.hasAnyDeals == false) {
                SegmiqEmptyState("No ${terms.plural.lowercase()} assigned yet", "New ${terms.plural.lowercase()} assigned to you will appear here.")
            }

            updatedLabel(state.updatedAt, workspace.zone)?.let {
                Text("$it · ${workspace.zone.id}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LivePipelineScreen(vm: PipelineViewModel, workspace: LiveWorkspace) {
    val state by vm.state.collectAsStateWithLifecycle()
    PullToRefreshBox(isRefreshing = state.loading && state.value != null, onRefresh = vm::load, modifier = Modifier.fillMaxSize()) {
        Page {
            val data = state.value
            when {
                data != null -> {
                    val stages = data.pipelineSnapshot
                    val known = stages.sumOf { it.knownValue }
                    val awaiting = stages.sumOf { it.awaitingEstimate }
                    SegmiqCard(dark = true) {
                        Text("ACTIVE DEALS", style = MaterialTheme.typography.labelSmall)
                        Text(formatAmount(known, workspace.currencyCode), style = MaterialTheme.typography.headlineLarge, color = Lime)
                        Text(buildList {
                            add("${stages.sumOf { it.dealCount }} deals")
                            if (awaiting > 0) add("$awaiting awaiting estimate")
                            if (workspace.currencyCode == null) add("currency not set")
                        }.joinToString(" · "))
                    }
                    Text("A read-only summary of your active deals. Move deals between stages on the SegmiQ website.",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (stages.isEmpty() || !data.hasAnyDeals) SegmiqEmptyState("No active deals", "Deals you're working on will appear here by stage.")
                    stages.forEach { s ->
                        SegmiqCard {
                            Text(s.label, style = MaterialTheme.typography.titleMedium)
                            Text("${s.dealCount} deal${if (s.dealCount == 1) "" else "s"} · ${formatAmount(s.knownValue, workspace.currencyCode)}" +
                                if (s.awaitingEstimate > 0) " · ${s.awaitingEstimate} awaiting estimate" else "",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    state.error?.let { SegmiqErrorCard(it.message, vm::load) }
                }
                state.loading -> SegmiqSkeleton(4)
                state.error != null -> SegmiqErrorCard(state.error!!.message, vm::load)
            }
        }
    }
}

@Composable
fun LiveDialerScreen(workspace: LiveWorkspace? = null, api: LiveSalesApi? = null, go: (String) -> Unit = {}, showReview: Boolean = false) {
    var number by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var pickedName by rememberSaveable { mutableStateOf<String?>(null) }
    var match by remember { mutableStateOf<ContactMatch?>(null) }
    var lookupNote by remember { mutableStateOf<String?>(null) }
    var review by rememberSaveable { mutableStateOf(showReview) }
    var outcome by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var savedNote by remember { mutableStateOf<String?>(null) }
    val gate = remember { mutableStateOf(DialReturnState()) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            val name = when (event) {
                Lifecycle.Event.ON_STOP -> "stop"
                Lifecycle.Event.ON_START -> "start"
                else -> ""
            }
            val next = dialReturnAfter(gate.value, name)
            gate.value = next
            if (next.review) review = true
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val context = LocalContext.current
    val region = PhoneNumbers.region(workspace?.bootstrap?.organisation?.country)
    val dialable = PhoneNumbers.dialable(number)
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data ?: return@rememberLauncherForActivityResult
        runCatching {
            context.contentResolver.query(uri, arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME), null, null, null)
        }.getOrNull()?.use { cursor ->
            if (cursor.moveToFirst()) {
                number = cursor.getString(0).orEmpty()
                pickedName = cursor.getString(1)
                error = null
            }
        }
    }
    LaunchedEffect(dialable, api) {
        match = null
        lookupNote = null
        if (api == null || dialable.count(Char::isDigit) < 7) return@LaunchedEffect
        delay(350)
        when (val result = api.lookupContact(PhoneNumbers.display(number, region).ifBlank { dialable })) {
            is ApiResult.Success -> {
                val found = result.value.match
                match = found
                lookupNote = if (found == null) "No SegmiQ customer matches this number." else null
            }
            is ApiResult.Failure -> lookupNote = "SegmiQ could not check this number."
        }
    }
    SegmiqDarkWorkspace {
        Scaffold(contentWindowInsets = WindowInsets(0, 0, 0, 0), containerColor = Ink,
            bottomBar = {
                Surface(color = Ink) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SegmiqPrimaryButton("Call with phone app", {
                            try {
                                gate.value = DialReturnState(pending = true)
                                context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(dialable))))
                            } catch (_: android.content.ActivityNotFoundException) {
                                gate.value = DialReturnState()
                                error = "No phone application is available on this device."
                            } catch (_: SecurityException) {
                                gate.value = DialReturnState()
                                error = "Your device did not allow opening the phone app."
                            }
                        }, Modifier.fillMaxWidth(), validPhone(dialable))
                        error?.let { SegmiqErrorCard(it) }
                        Text("Opens your phone app. SegmiQ does not place the call, record it, or know whether it was answered.",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }) { padding ->
            Box(Modifier.padding(padding).consumeWindowInsets(padding)) {
                Page {
                    Text("System phone app", style = MaterialTheme.typography.labelLarge, color = Lime)
                    pickedName?.let { Text(it, style = MaterialTheme.typography.titleMedium) }
                    if (dialable.isNotEmpty()) Text(PhoneNumbers.display(number, region), style = MaterialTheme.typography.bodyMedium, color = Lime)
                    DialPad(number, { number = it; pickedName = null; error = null; review = false })
                    OutlinedButton({
                        pick.launch(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI))
                    }, Modifier.fillMaxWidth()) { Text("Choose a contact") }
                    match?.let { found ->
                        SegmiqCard {
                            Text(found.name ?: "SegmiQ customer", style = MaterialTheme.typography.titleMedium)
                            Text(found.leadStatus ?: "Matched customer", style = MaterialTheme.typography.bodySmall)
                            found.leadId?.let { id -> TextButton({ go("live/lead/$id") }) { Text("Open customer") } }
                        }
                    }
                    lookupNote?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                    if (review) CallReview(outcome, { outcome = it }, notes, { notes = it }, savedNote, match, api, workspace?.zone, go)
                }
            }
        }
    }
}

@Composable
private fun CallReview(
    outcome: String,
    onOutcome: (String) -> Unit,
    notes: String,
    onNotes: (String) -> Unit,
    saved: String?,
    match: ContactMatch?,
    api: LiveSalesApi?,
    zone: java.time.ZoneId?,
    go: (String) -> Unit,
) {
    val choices = listOf("Reached them", "No answer", "Left a message", "Wrong number")
    var localSaved by remember { mutableStateOf(saved) }
    var followUp by remember { mutableStateOf<java.time.LocalDate?>(null) }
    var picking by remember { mutableStateOf(false) }
    SegmiqCard {
        Text("Call review", style = MaterialTheme.typography.titleMedium)
        Text("This appears after you return to SegmiQ. The phone app does not report duration or whether the call was answered.",
            style = MaterialTheme.typography.bodySmall)
        match?.let { Text(it.name ?: "Matched customer", style = MaterialTheme.typography.titleSmall) }
        FilterChips(choices, outcome) { onOutcome(it) }
        OutlinedTextField(notes, onNotes, Modifier.fillMaxWidth(), label = { Text("Notes") }, minLines = 2)
        if (zone != null && match?.leadId != null) TextButton({ picking = true }) {
            Text(followUp?.let { "Follow-up $it" } ?: "Add follow-up date")
        }
        match?.leadId?.let { id ->
            TextButton({ go("live/lead/$id") }) { Text("Linked inquiry") }
        }
        SegmiqPrimaryButton("Save outcome", {
            if (outcome.isBlank()) return@SegmiqPrimaryButton
            localSaved = if (match?.leadId == null || api == null) {
                "Not saved to SegmiQ. No customer is linked, and the address book is not uploaded."
            } else "Saving…"
        }, Modifier.fillMaxWidth(), outcome.isNotBlank())
        localSaved?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    }
    if (picking && zone != null) FollowUpDateDialog(followUp, zone, { picking = false }) { followUp = it; picking = false }
    val lead = match?.leadId
    LaunchedEffect(localSaved, lead, followUp) {
        if (localSaved != "Saving…" || lead == null || api == null || outcome.isBlank()) return@LaunchedEffect
        val summary = listOf("Call outcome: $outcome", notes.takeIf { it.isNotBlank() }).filterNotNull().joinToString(". ")
        val noted = api.addNote(lead, summary)
        if (noted is ApiResult.Failure) { localSaved = noted.error.message; return@LaunchedEffect }
        val dated = followUp?.let { api.setFollowUp(lead, it) }
        localSaved = when (dated) {
            null -> "Saved on the customer record."
            is ApiResult.Success -> "Saved on the customer record. Follow-up date saved."
            is ApiResult.Failure -> dated.error.message
        }
    }
}

@Composable
fun LiveMoreScreen(workspace: LiveWorkspace, baseUrl: HttpUrl, go: (String) -> Unit, onSignOut: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    val b = workspace.bootstrap
    Page {
        SegmiqCard {
            Text(workspace.userName, style = MaterialTheme.typography.titleLarge)
            Text(listOf(if (workspace.experience == Experience.REAL_ESTATE && b.user.role == "SALESPERSON") "Agent" else roleLabel(b.user.role),
                workspace.organisationName).joinToString(" · "), style = MaterialTheme.typography.bodyMedium)
            Text(
                "Workspace: ${experienceLabel(workspace.experience)}${if (workspace.homeVariant == HomeVariant.SOLO) " (solo)" else ""}\n" +
                    "Time zone: ${workspace.zone.id}\n" +
                    "Currency: ${workspace.currencyCode ?: "not configured"}\n" +
                    "Server: ${baseUrl.host}",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text("Your workspace is set by your organisation and can't be changed in the app.",
                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        com.segmiq.sales.features.realestate.EstateModuleRow("Meeting recordings", "Record on this phone. Audio stays in the app until you delete it or sign out.",
            Icons.Rounded.Mic) { go("live/recordings") }
        com.segmiq.sales.features.realestate.EstateModuleRow("Notifications", "Notifications from SegmiQ for this sign-in. Push delivery is not connected.",
            Icons.Rounded.Notifications) { go("live/notifications") }
        workspace.navigation.more.forEach { item ->
            val subtitle = moduleStatusLine(item.module, workspace, com.segmiq.sales.core.estate.EstateAccess(workspace, baseUrl))
            if (workspace.experience == Experience.REAL_ESTATE) {
                com.segmiq.sales.features.realestate.EstateModuleRow(item.label, subtitle, item.icon.vector()) { go(item.route) }
            } else SegmiqActionRow(item.label, subtitle, item.icon.vector()) { go(item.route) }
        }
        OutlinedButton({ confirm = true }, Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
            Icon(Icons.AutoMirrored.Rounded.Logout, null)
            Spacer(Modifier.width(8.dp))
            Text("Sign out")
        }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        title = { Text("Sign out of SegmiQ Sales?") },
        text = { Text("This ends the session on this phone, removes cached customer data, and deletes meeting recordings stored for this account. Other devices stay signed in. There is no server copy of those recordings.") },
        confirmButton = { TextButton({ confirm = false; onSignOut() }) { Text("Sign out") } },
        dismissButton = { TextButton({ confirm = false }) { Text("Cancel") } },
    )
}

@Composable
fun UnavailableModuleScreen(item: NavItem, workspace: LiveWorkspace, baseUrl: HttpUrl) {
    val uri = LocalUriHandler.current
    val webPath = workspace.bootstrap.navigation.destinations.firstOrNull { it.id in item.destinationIds }?.webPath
    Page {
        SegmiqEmptyState("${item.label} isn't in the app yet",
            "This part of SegmiQ hasn't been built for Android. The app doesn't show sample data in its place.")
        if (webPath != null && webPath.startsWith("/")) {
            OutlinedButton({ uri.openUri(baseUrl.newBuilder().encodedPath(webPath).build().toString()) }) {
                Icon(Icons.AutoMirrored.Rounded.OpenInNew, null)
                Spacer(Modifier.width(8.dp))
                Text("Open ${item.label} on the web")
            }
        }
    }
}

fun roleLabel(role: String) = when (role) {
    "SALESPERSON" -> "Salesperson"
    "CLIENT_MANAGER" -> "Sales manager"
    else -> role.lowercase().replaceFirstChar { it.uppercase() }
}

fun experienceLabel(e: Experience) = when (e) {
    Experience.GENERAL -> "Sales"
    Experience.REAL_ESTATE -> "Real estate"
    Experience.SOLAR -> "Solar"
}