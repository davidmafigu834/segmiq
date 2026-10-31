package com.segmiq.sales.features

import androidx.compose.foundation.background
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.tooling.preview.Preview
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.data.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.ui.theme.*
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.text.NumberFormat
import java.util.Locale


@Composable
fun MyDayScreen(data: DemoState, go: (String) -> Unit, complete: (String) -> Unit) {
    val now = ZonedDateTime.now()
    val greeting = when (now.hour) { in 5..11 -> "Good morning"; in 12..17 -> "Good afternoon"; else -> "Good evening" }
    Page {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SegmiqAvatar("Alex Demo")
            Column {
                Text("$greeting, Alex", style = MaterialTheme.typography.titleMedium)
                Text(now.format(DateTimeFormatter.ofPattern("EEEE, d MMMM")), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Text("Your next move.", style = MaterialTheme.typography.headlineLarge)
        val due = data.tasks.count { !it.completed && it.due.startsWith("Today") }
        val calls = data.tasks.count { !it.completed && it.due.startsWith("Today") && it.title.startsWith("Call", true) }
        val meetings = data.meetings.count { it.startsAt.startsWith("Today") }
        listOf(listOf(Triple("Calls to make", "$calls", "dialer"), Triple("Follow-ups", "$due", "tasks")),
            listOf(Triple("Meetings", "$meetings", "meetings"), Triple("New leads", "${data.customers.size}", "customers"))).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { (label, value, route) ->
                    Surface(onClick = { go(route) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(value, Modifier.weight(1f), style = MaterialTheme.typography.headlineLarge)
                                Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
                            }
                            Text(label, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
        SegmiqCard(dark = true) {
            SegmiqLabel("NEXT MEETING · 14:00", lime = true)
            Text("Let’s move the\nconversation forward.", style = MaterialTheme.typography.headlineMedium)
            Text("Tapiwa Moyo · Moyo Fresh Markets")
            Text("Proposal review · Customer office\nAlex + Tapiwa", style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SegmiqPrimaryButton("Open meeting", { go("meeting/meeting1") })
                TextButton({ go("recorder") }) { Text("Recorder setup", color = Lime) }
            }
        }
        SegmiqActionRow("A nudge from Sales Copilot", "$due priorities need your attention. Review your next steps.", Icons.Rounded.AutoAwesome) { go("copilot") }
        SectionTitle("Today’s priorities", "View all") { go("tasks") }
        data.tasks.filter { !it.completed && it.due.startsWith("Today") }.forEach { TaskCard(it, data, complete, go) }
        if (due == 0) SegmiqEmptyState("Your day is clear", "Your scheduled priorities are complete.")
    }
}

@Composable
fun TaskCard(task: SalesTask, data: DemoState, complete: (String) -> Unit, go: (String) -> Unit) {
    SegmiqCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(task.completed, { complete(task.id) })
            Column(Modifier.weight(1f)) {
                Text(task.title, style = MaterialTheme.typography.titleMedium)
                Text(data.customers.firstOrNull { it.id == task.customerId }?.name ?: "Customer", style = MaterialTheme.typography.bodyMedium)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(task.due, style = MaterialTheme.typography.labelSmall)
            SegmiqLabel(task.priority)
            TextButton({ go("customer/${task.customerId}") }) { Text("Open") }
        }
    }
}

@Composable
fun TasksScreen(data: DemoState, complete: (String) -> Unit, go: (String) -> Unit) {
    var filter by rememberSaveable { mutableStateOf("Today") }
    Page {
        Text("Your follow-ups", style = MaterialTheme.typography.headlineSmall)
        FilterChips(listOf("Today", "Upcoming", "My tasks", "Completed"), filter) { filter = it }
        SegmiqPrimaryButton("Create follow-up", { go("followup") })
        val tasks = filterTasks(data.tasks, filter)
        if (tasks.isEmpty()) SegmiqEmptyState("Nothing here yet", "Try another filter or create a follow-up.")
        tasks.forEach { TaskCard(it, data, complete, go) }
    }
}

@Composable
fun MeetingsScreen(data: DemoState, go: (String) -> Unit) {
    Page {
        SegmiqLabel("SAMPLE SCHEDULE")
        data.meetings.forEach { meeting ->
            SegmiqActionRow(meeting.startsAt, meeting.title + " · " + (data.customers.firstOrNull { it.id == meeting.customerId }?.name ?: "Standalone"), Icons.Rounded.Event) { go("meeting/${meeting.id}") }
        }
        Text("Local plans only. Invitations and reminders are not sent.")
        SegmiqPrimaryButton("Schedule a local meeting", { go("schedule") })
    }
}
@Composable
fun MeetingDetailScreen(meeting: Meeting?, customers: List<Customer>, go: (String) -> Unit) {
    if (meeting == null) return
    Page {
        SegmiqLabel("SAMPLE MEETING")
        Text(meeting.title, style = MaterialTheme.typography.headlineLarge)
        SegmiqCard {
            Text(customers.firstOrNull { it.id == meeting.customerId }?.name ?: "Standalone meeting", style = MaterialTheme.typography.titleLarge)
            Text(meeting.startsAt + "\n" + meeting.location.orEmpty())
            Text("Review delivery requirements and agree the next step.")
        }
        SegmiqPrimaryButton("Open recorder setup", { go("recorder?customer=${meeting.customerId.orEmpty()}") }, Modifier.fillMaxWidth())
        SegmiqActionRow("Add meeting notes", "Capture requirements on this device", Icons.Rounded.EditNote) { go("note?customer=${meeting.customerId.orEmpty()}") }
        SegmiqActionRow("Create a follow-up", "Keep the conversation moving", Icons.Rounded.CheckCircleOutline) { go("followup?customer=${meeting.customerId.orEmpty()}") }
    }
}

fun money(amount: Int): String = NumberFormat.getCurrencyInstance(Locale.US).format(amount)
@Composable
fun PipelineScreen(customers: List<Customer>, go: (String) -> Unit) {
    var stage by rememberSaveable { mutableStateOf("All") }
    Page {
        SegmiqCard(dark = true) {
            Text("YOUR OPEN OPPORTUNITIES", style = MaterialTheme.typography.labelSmall)
            Text(money(DemoFixtures.opportunities.sumOf { it.amount }), style = MaterialTheme.typography.headlineLarge, color = Lime)
            Text("3 active opportunities · USD demo configuration")
        }
        FilterChips(DemoFixtures.stages, stage) { stage = it }
        DemoFixtures.opportunities.filter { stage == "All" || it.stage == stage }.forEach { o ->
            Surface(onClick = { go("deal/${o.id}") }, shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SegmiqLabel(o.stage)
                    Text(o.title, style = MaterialTheme.typography.titleLarge)
                    Text(customers.firstOrNull { it.id == o.customerId }?.company ?: "")
                    Text(money(o.amount), style = MaterialTheme.typography.headlineMedium)
                    HorizontalDivider()
                    Text("Next: ${o.nextAction}", style = MaterialTheme.typography.bodyMedium)
                    Text("Alex Demo · Closing date not set", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
@Composable
fun DealScreen(id: String, customers: List<Customer>, go: (String) -> Unit) {
    val o = DemoFixtures.opportunities.firstOrNull { it.id == id } ?: return
    Page {
        SegmiqLabel(o.stage, true)
        Text(o.title, style = MaterialTheme.typography.headlineLarge)
        Text(money(o.amount), style = MaterialTheme.typography.headlineLarge)
        SegmiqActionRow(customers.firstOrNull { it.id == o.customerId }?.name ?: "Customer", "Open customer context", Icons.Rounded.PersonOutline) { go("customer/${o.customerId}") }
        SegmiqCard { Text("Next action", style = MaterialTheme.typography.titleMedium); Text(o.nextAction); Text("Stage changes require the organisation’s live workflow configuration.") }
        SegmiqActionRow("Quotations", "Review quotation availability", Icons.Rounded.Description) { go("quotation") }
        SegmiqActionRow("Add a note", "Save requirements locally", Icons.Rounded.EditNote) { go("note?customer=${o.customerId}") }
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 844)
@Composable
fun MyDayPreview() { SegmiQSalesTheme(false) { MyDayScreen(DemoState(), {}, {}) } }
