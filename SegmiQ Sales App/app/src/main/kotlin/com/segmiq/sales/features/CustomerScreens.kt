package com.segmiq.sales.features

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.data.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.ui.theme.*

@Composable
fun CustomersScreen(customers: List<Customer>, go: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    Page {
        SegmiqSearchField(query, { query = it })
        SegmiqPrimaryButton("Add a local demo lead", { go("lead") })
        val matches = customers.filter { "${it.name} ${it.company} ${it.phone}".contains(query, true) }
        if (matches.isEmpty()) SegmiqEmptyState("No matching customers", "Try a different name, company or phone number.")
        matches.forEach { c -> CustomerRow(c, "View customer and next action") { go("customer/${c.id}") } }
    }
}
@Composable
fun CustomerRow(c: Customer, subtitle: String, click: () -> Unit) {
    Surface(onClick = click, color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(20.dp)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            SegmiqAvatar(c.name)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(c.name, style = MaterialTheme.typography.titleMedium)
                if (c.company.isNotBlank()) Text(c.company, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, maxLines = 2)
            }
        }
    }
}
@Composable
fun InboxScreen(data: DemoState, go: (String) -> Unit) {
    var filter by rememberSaveable { mutableStateOf("All") }
    var query by rememberSaveable { mutableStateOf("") }
    Page {
        SectionTitle("Conversations")
        Text("Keep the customer context close.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        SegmiqSearchField(query, { query = it }, "Search conversations")
        FilterChips(listOf("All", "Mine", "Follow-ups"), filter) { filter = it }
        Text("Sample WhatsApp conversations · provider not connected", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        val customers = data.customers.filter { c ->
            data.messages.any { it.customerId == c.id } && "${c.name} ${c.company}".contains(query, true) &&
                (filter != "Follow-ups" || data.tasks.any { it.customerId == c.id && !it.completed })
        }
        if (customers.isEmpty()) SegmiqEmptyState("No conversations yet", "Conversations will appear here when available.")
        customers.forEach { c ->
            val m = data.messages.last { it.customerId == c.id }
            CustomerRow(c, "${m.time} · ${m.text}") { go("conversation/${c.id}") }
        }
    }
}
@Composable
fun ConversationScreen(c: Customer, data: DemoState, go: (String) -> Unit, send: (String) -> Unit) {
    var text by rememberSaveable(c.id) { mutableStateOf("") }
    Scaffold(modifier = Modifier.imePadding(), containerColor = MaterialTheme.colorScheme.background, contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.surface) {
                Column(Modifier.fillMaxWidth().imePadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(text, { text = it }, Modifier.fillMaxWidth(), label = { Text("Write a local draft") },
                        minLines = 1, maxLines = 4, shape = RoundedCornerShape(16.dp))
                    SegmiqPrimaryButton("Save draft on device", { send(text); text = "" }, Modifier.fillMaxWidth(), text.isNotBlank())
                    Text("Local drafts only · provider not connected", style = MaterialTheme.typography.labelSmall)
                }
            }
        }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { CustomerRow(c, "Open customer context") { go("customer/${c.id}") } }
            item { SegmiqLabel("SAMPLE HISTORY · NOT LIVE MESSAGES") }
            items(data.messages.filter { it.customerId == c.id }, key = { it.id }) { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.outgoing) Arrangement.End else Arrangement.Start) {
                    Surface(Modifier.widthIn(max = 310.dp), shape = RoundedCornerShape(
                        topStart = 18.dp, topEnd = 18.dp, bottomStart = if (m.outgoing) 18.dp else 4.dp,
                        bottomEnd = if (m.outgoing) 4.dp else 18.dp),
                        color = if (m.outgoing) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(m.text)
                            Text(m.time, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}
@Composable
fun CustomerScreen(c: Customer, data: DemoState, go: (String) -> Unit) {
    var tab by rememberSaveable(c.id) { mutableStateOf("Overview") }
    Page {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            SegmiqAvatar(c.name)
            Column { Text(c.name, style = MaterialTheme.typography.headlineMedium); Text(c.company) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { SegmiqLabel("Assigned to Alex"); SegmiqLabel("Active lead", true) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            listOf(Triple("Call", Icons.Rounded.Call, "call/${c.id}"), Triple("Message", Icons.AutoMirrored.Rounded.Chat, "conversation/${c.id}"),
                Triple("Quote", Icons.Rounded.Description, "quotation"), Triple("Meeting", Icons.Rounded.Event, "recorder?customer=${c.id}")).forEach { (label, icon, r) ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    FilledTonalIconButton({ go(r) }, Modifier.size(52.dp)) { Icon(icon, label) }
                    Text(label, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        FilterChips(listOf("Overview", "Timeline", "Notes", "Deals"), tab) { tab = it }
        when (tab) {
            "Overview" -> {
                SegmiqCard {
                    Text("Contact details", style = MaterialTheme.typography.titleLarge)
                    listOf("Phone" to c.phone, "Email" to c.email, "Company" to c.company, "Location" to c.location,
                        "Source" to "Local demo enquiry", "Assigned to" to "Alex Demo").forEach { (k, v) ->
                        Text(k, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(v.ifBlank { "Not provided" })
                    }
                }
                data.tasks.filter { it.customerId == c.id && !it.completed }.forEach { t ->
                    SegmiqActionRow(t.title, t.due, Icons.Rounded.CheckCircleOutline) { go("tasks") }
                }
            }
            "Notes" -> {
                SegmiqPrimaryButton("Add note", { go("note?customer=${c.id}") })
                val notes = data.notes.filter { it.customerId == c.id }
                if (notes.isEmpty()) SegmiqEmptyState("No notes yet", "Capture the details that help you move the sale forward.")
                notes.forEach { SegmiqCard { Text(it.text); Text("Saved on this device", style = MaterialTheme.typography.labelSmall) } }
            }
            "Timeline" -> {
                SegmiqCard { Text("Sample enquiry received", style = MaterialTheme.typography.titleMedium); Text("Customer requested further information.") }
                data.messages.filter { it.customerId == c.id && it.outgoing }.forEach { SegmiqCard { Text("Local message draft"); Text(it.text) } }
                data.reviews.filter { it.customerId == c.id }.forEach {
                    SegmiqCard { SegmiqLabel("SIMULATED CALL · NO AUDIO"); Text(it.outcome); Text(it.notes.ifBlank { "No notes added" }); Text("${it.seconds}s · Saved locally") }
                }
                data.notes.filter { it.customerId == c.id }.forEach { SegmiqCard { Text("Note"); Text(it.text) } }
            }
            "Deals" -> {
                val deals = DemoFixtures.opportunities.filter { it.customerId == c.id }
                if (deals.isEmpty()) SegmiqEmptyState("No opportunities yet", "Live opportunities require the SegmiQ backend.")
                deals.forEach { o -> SegmiqActionRow(o.title, "${money(o.amount)} · ${o.stage}", Icons.AutoMirrored.Rounded.TrendingUp) { go("deal/${o.id}") } }
            }
        }
    }
}

@Composable
fun LocalFormScreen(title: String, data: DemoState, label: String, saving: Boolean, count: Int, due: Boolean = false, initialCustomer: String = "", save: (String, String, String) -> Unit) {
    var customer by rememberSaveable { mutableStateOf(data.customers.firstOrNull { it.id == initialCustomer }?.id ?: data.customers.first().id) }
    var value by rememberSaveable { mutableStateOf("") }
    var date by rememberSaveable { mutableStateOf("") }
    var submittedCount by rememberSaveable { mutableIntStateOf(-1) }
    val saved = submittedCount >= 0 && count > submittedCount
    Page {
        Text(title, style = MaterialTheme.typography.headlineMedium)
        Text("Customer", style = MaterialTheme.typography.titleMedium)
        FilterChips(data.customers.map { it.name }, data.customers.first { it.id == customer }.name) { name -> customer = data.customers.first { it.name == name }.id }
        if (saved) SegmiqEmptyState("Saved on this device", "You can find this item in the customer’s notes or your tasks.")
        else {
            OutlinedTextField(value, { value = it }, Modifier.fillMaxWidth(), label = { Text(label) }, minLines = 4, shape = RoundedCornerShape(16.dp))
            if (due) OutlinedTextField(date, { date = it }, Modifier.fillMaxWidth(), label = { Text("Due date and time") }, placeholder = { Text("Tomorrow · 10:00") }, supportingText = { Text("Local planning text; no reminder is scheduled.") })
            SegmiqPrimaryButton(if (saving) "Saving…" else "Save locally", { submittedCount = count; save(customer, value, date) },
                Modifier.fillMaxWidth(), !saving && value.isNotBlank() && (!due || date.isNotBlank()))
        }
    }
}
@Composable
fun AddLeadScreen(count: Int, saving: Boolean, save: (String, String, String) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var company by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var submittedCount by rememberSaveable { mutableIntStateOf(-1) }
    Page {
        Text("Start a new relationship.", style = MaterialTheme.typography.headlineMedium)
        Text("This lead will be saved only in the local demo. No device contacts are uploaded.")
        if (submittedCount >= 0 && count > submittedCount) SegmiqEmptyState("Lead saved locally", "Open Leads & customers to find your new lead.")
        else {
            OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("Customer name") }, singleLine = true)
            OutlinedTextField(company, { company = it }, Modifier.fillMaxWidth(), label = { Text("Company") }, singleLine = true)
            OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("Phone number") }, singleLine = true,
                isError = phone.isNotEmpty() && !validPhone(phone), supportingText = { Text("Use a local number or an international prefix, e.g. +263.") })
            SegmiqPrimaryButton(if (saving) "Saving…" else "Confirm and save local lead", { submittedCount = count; save(name, company, phone) }, Modifier.fillMaxWidth(), !saving && name.isNotBlank() && validPhone(phone))
        }
    }
}
