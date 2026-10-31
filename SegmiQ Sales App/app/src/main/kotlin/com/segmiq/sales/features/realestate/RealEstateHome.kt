package com.segmiq.sales.features.realestate

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.estate.EstateAccess
import com.segmiq.sales.core.estate.EstateRepository
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.estate.EstateResource
import com.segmiq.sales.features.live.*
import com.segmiq.sales.ui.theme.Lime
import java.time.LocalTime
import java.time.format.DateTimeFormatter

val EstateIvory = Color(0xFFF7F4EF)
private val EstateNight = Color(0xFF0C0C0C)
private val EstateForest = Color(0xFF163C2C)

@Composable
fun RealEstateHome(vm: MyDayViewModel, workspace: LiveWorkspace, go: (String) -> Unit, access: EstateAccess? = null, repository: EstateRepository? = null) {
    val state by vm.state.collectAsStateWithLifecycle()
    RealEstateHomeContent(state, workspace, { vm.load() }, go, access, repository)
}

/** Counts are shown only when that module's own response marks them complete. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RealEstateHomeContent(state: MyDayState, workspace: LiveWorkspace, refresh: () -> Unit, go: (String) -> Unit, access: EstateAccess? = null, repository: EstateRepository? = null) {
    var quickActions by remember { mutableStateOf(false) }
    var viewingCount by remember { mutableStateOf<Int?>(null) }
    var offerCount by remember { mutableStateOf<Int?>(null) }
    var propertyCount by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(repository, access) {
        val repo = repository ?: return@LaunchedEffect
        if (access?.reason(EstateResource.VIEWINGS) == null && access != null) {
            (repo.viewings() as? ApiResult.Success)?.let { if (!it.value.incomplete) viewingCount = it.value.total }
        }
        if (access?.reason(EstateResource.OFFERS) == null && access != null) {
            (repo.offers() as? ApiResult.Success)?.let { if (it.value.listCompleteness.exhaustive) offerCount = it.value.offers.size }
        }
        if (access?.reason(EstateResource.PROPERTIES) == null && access != null) {
            (repo.properties() as? ApiResult.Success)?.let { propertyCount = it.value.total }
        }
    }
    val allowed: (LiveModule) -> Boolean = workspace.navigation::allows
    val daily = state.workspace
    val metrics = state.dashboard
    val tasks = state.tasks
    val part = daily.value?.greetingPart ?: when (LocalTime.now(workspace.zone).hour) {
        in 0..11 -> "morning"; in 12..16 -> "afternoon"; else -> "evening"
    }

    PullToRefreshBox(state.refreshing, refresh, Modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.widthIn(max = 840.dp).fillMaxSize().align(Alignment.TopCenter),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            item("identity") {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    IconButton({ go(LiveModule.SETTINGS.route) }, Modifier.size(48.dp)) {
                        SegmiqAvatar(workspace.userName)
                    }
                    Column(Modifier.weight(1f)) {
                        Text("Good $part, ${workspace.userName.substringBefore(' ')}",
                            style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
                        Text(workspace.organisationName, style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    FilledTonalIconButton({ quickActions = true }) { Icon(Icons.Rounded.Add, "Quick actions") }
                }
            }
            item("hero") {
                EstateHero(
                    if (daily.loading && daily.value == null) "Loading your daily priorities"
                    else daily.value?.let { "${it.openCount} open actions in your daily workspace" }
                        ?: "Your daily workspace is temporarily unavailable",
                    workspace.zone.id,
                ) {
                    if (allowed(LiveModule.LEADS)) {
                        Button({ go(LiveModule.LEADS.route) },
                            colors = ButtonDefaults.buttonColors(containerColor = Lime, contentColor = EstateNight),
                            shape = RoundedCornerShape(14.dp), modifier = Modifier.heightIn(min = 48.dp)) {
                            Text("Review inquiries")
                            Spacer(Modifier.width(8.dp))
                            Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, Modifier.size(18.dp))
                        }
                    }
                }
            }
            item("metrics") {
                when {
                    metrics.value?.commercial != null -> {
                        val c = metrics.value.commercial!!
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            EstateMetric("New inquiries", c.newEnquiriesToday.toString(), "Today", Icons.Rounded.Forum,
                                Modifier.weight(1f), allowed(LiveModule.LEADS)) { go(LiveModule.LEADS.route) }
                            EstateMetric("Follow-ups", c.followUpsDueToday.toString(),
                                if (c.followUpsOverdue > 0) "${c.followUpsOverdue} overdue" else "Due today",
                                Icons.Rounded.Schedule, Modifier.weight(1f), allowed(LiveModule.TASKS)) { go(LiveModule.TASKS.route) }
                        }
                    }
                    metrics.loading -> SegmiqSkeleton(3)
                    metrics.error != null -> SegmiqErrorCard(metrics.error.message, refresh)
                    else -> EstateNotice("Metrics not available", "No daily sales metrics were returned for this workspace.", Icons.Rounded.Insights)
                }
                if (metrics.value != null && metrics.error != null) {
                    Spacer(Modifier.height(12.dp))
                    SegmiqErrorCard("Showing previously loaded metrics. ${metrics.error.message}", refresh)
                }
            }
            item("today") {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionTitle("Today's priorities", if (allowed(LiveModule.TASKS)) "All tasks" else null) { go(LiveModule.TASKS.route) }
                    when {
                        daily.value != null -> {
                            val actions = daily.value.actions
                            if (actions.isEmpty()) EstateNotice("A little breathing room", "No open actions need your attention right now.", Icons.Rounded.CheckCircleOutline)
                            actions.take(4).forEach { task ->
                                // A task may link to a lead only when the module is available in bootstrap.
                                if (allowed(LiveModule.LEADS)) TaskSummaryRow(task, workspace) { go("live/lead/${task.leadId}") }
                                else SegmiqCard { Text(task.title, style = MaterialTheme.typography.titleMedium) }
                            }
                            daily.error?.let { SegmiqErrorCard("Previously loaded priorities. ${it.message}", refresh) }
                        }
                        daily.loading -> SegmiqSkeleton(4)
                        daily.error != null -> SegmiqErrorCard(daily.error.message, refresh)
                    }
                }
            }
            if (allowed(LiveModule.VIEWINGS)) item("viewings") {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionTitle("Your viewings")
                    EstateModuleRow("Viewing schedule",
                        if (access?.reason(EstateResource.VIEWINGS) == null && access != null)
                            viewingCount?.let { "$it viewings in the completed feed" } ?: "Your authorised viewing schedule. New appointments stay off until write acceptance."
                        else "Your live viewing schedule is not connected on Android yet.",
                        Icons.Rounded.EventAvailable) { go(LiveModule.VIEWINGS.route) }
                    offerCount?.let { EstateModuleRow("Offers", "$it in the completed offer feed", Icons.Rounded.RequestQuote) { go(LiveModule.OFFERS.route) } }
                    propertyCount?.let { EstateModuleRow("Properties", "$it listings in the server count", Icons.Rounded.HomeWork) { go(LiveModule.PROPERTIES.route) } }
                }
            }
            if (access != null && access.reason(EstateResource.CALENDAR) == null && allowed(LiveModule.ACTIVITIES)) item("calendar") {
                EstateModuleRow("Calendar",
                    "Partial day coverage: viewings, follow-ups and tasks. Standalone meetings are not in this feed.",
                    Icons.Rounded.CalendarMonth) { go(LiveModule.ACTIVITIES.route) }
            }
            if (allowed(LiveModule.PROPERTIES)) item("properties") {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionTitle("Property workspace")
                    EstateModuleRow("Properties & listings",
                        if (access != null && access.reason(EstateResource.PROPERTIES) == null) "Your authorised listings. Photographs stay hidden until private storage is verified."
                        else "Listing access is being verified. No sample listings are shown.",
                        Icons.Rounded.HomeWork) { go(LiveModule.PROPERTIES.route) }
                }
            }
            if (allowed(LiveModule.COPILOT)) item("copilot") {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionTitle("Sales Copilot")
                    when {
                        tasks.value?.meta?.copilotUnavailable == true ->
                            EstateNotice("Copilot is unavailable", "Your tasks remain available. Try refreshing for recommendations.", Icons.Rounded.AutoAwesome)
                        tasks.value != null -> {
                            val pending = tasks.value.tasks.count { !it.completed && it.copilot?.queue == "needs_review" }
                            EstateModuleRow("Your next best actions",
                                if (pending == 0) "No recommendations need your review."
                                else "$pending recommendations ready for your review.",
                                Icons.Rounded.AutoAwesome) { go(LiveModule.COPILOT.route) }
                        }
                        tasks.loading -> SegmiqSkeleton(2)
                        tasks.error != null -> SegmiqErrorCard(tasks.error.message, refresh)
                    }
                }
            }
            if (allowed(LiveModule.INTRODUCTIONS)) item("collaboration") {
                EstateModuleRow("Agent collaboration",
                    if (access != null && access.reason(EstateResource.INTRODUCTIONS) == null) "Received and sent introductions. Decisions stay off until write acceptance."
                    else "Introduction requests are available on SegmiQ web.",
                    Icons.Rounded.Handshake) { go(LiveModule.INTRODUCTIONS.route) }
            }
            item("freshness") {
                Text(
                    listOfNotNull(updatedLabel(state.updatedAt, workspace.zone), workspace.zone.id).joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
    if (quickActions) ModalBottomSheet(onDismissRequest = { quickActions = false }) {
        Column(Modifier.padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Make your next move", style = MaterialTheme.typography.headlineSmall)
            if (allowed(LiveModule.LEADS) && workspace.canModifyLeads) {
                EstateModuleRow("Add inquiry", "Capture a new customer enquiry", Icons.Rounded.PersonAddAlt) {
                    quickActions = false; go(ROUTE_ADD_LEAD)
                }
            }
            EstateModuleRow("Make a call", "Open the supported phone dialer", Icons.Rounded.Call) {
                quickActions = false; go(LiveModule.DIALER.route)
            }
            if (allowed(LiveModule.TASKS)) {
                EstateModuleRow("Review follow-ups", "Prioritise your customer conversations", Icons.Rounded.TaskAlt) {
                    quickActions = false; go(LiveModule.TASKS.route)
                }
            }
        }
    }
}

@Composable
fun EstateHero(context: String, zone: String, actions: @Composable ColumnScope.() -> Unit = {}) {
    val short = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp < 700
    Surface(shape = RoundedCornerShape(24.dp), contentColor = Color.White) {
        Box {
        SegmiqArtwork(com.segmiq.sales.R.drawable.estate_home_feature, Modifier.matchParentSize())
        Box(Modifier.matchParentSize().background(SegmiqGradients.PhotoScrim))
        Column(
            Modifier.fillMaxWidth().padding(if (short) 12.dp else 18.dp),
            verticalArrangement = Arrangement.spacedBy(if (short) 6.dp else 10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Rounded.Key, null, Modifier.size(18.dp), tint = Lime)
                Text(java.time.LocalDate.now(java.time.ZoneId.of(zone)).format(DateTimeFormatter.ofPattern("EEEE, d MMM")).uppercase(), style = MaterialTheme.typography.labelSmall,
                    color = Lime, letterSpacing = 1.sp)
            }
            Text("Your property day",
                style = MaterialTheme.typography.headlineLarge.copy(fontSize = if (short) 20.sp else 24.sp, lineHeight = if (short) 24.sp else 30.sp),
                modifier = Modifier.semantics { heading() })
            if (!short) Text(context, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFD2DDD5))
            actions()
            if (!short) Text("Decorative architecture", style = MaterialTheme.typography.labelSmall, color = Color(0xFFBDCCBF))
        }
        }
    }
}

@Composable
private fun EstateMetric(title: String, value: String, caption: String, icon: ImageVector,
                         modifier: Modifier, enabled: Boolean, onClick: () -> Unit) {
    Surface(onClick, modifier, enabled = enabled, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
            Text(value, style = MaterialTheme.typography.headlineLarge.copy(fontSize = 28.sp))
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(caption, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun EstateModuleRow(title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    Surface(onClick, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                if (icon == Icons.Rounded.AutoAwesome) SegmiqBrandLogo(Modifier.padding(8.dp).size(32.dp), qOnly = true)
                else Icon(icon, null, Modifier.padding(12.dp).size(24.dp), tint = MaterialTheme.colorScheme.primary)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun EstateNotice(title: String, message: String, icon: ImageVector) {
    SegmiqCard {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
        Text(title, style = MaterialTheme.typography.titleLarge)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
