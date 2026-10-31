package com.segmiq.sales.features.realestate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.*
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.design.*
import com.segmiq.sales.features.live.formatAmount
import com.segmiq.sales.ui.theme.Ink
import com.segmiq.sales.ui.theme.Lime
import java.time.*
import java.time.format.DateTimeFormatter

const val ESTATE_PREVIEW_ROUTE = "live/estate-preview/{section}"
fun estatePreviewRoute(section: String) = "live/estate-preview/$section"
private val demoSections = linkedMapOf("home" to "Home", "inbox" to "Inbox", "properties" to "Properties", "buyers" to "Buyers", "inquiries" to "Inquiries",
    "viewings" to "Viewings", "calendar" to "Activities", "introductions" to "Introductions", "offers" to "Offers",
    "transactions" to "Transactions", "documents" to "Documents", "copilot" to "Sales Copilot", "more" to "More")
fun demoDetail(kind: String, id: String, buyer: String = "-") = "detail/$kind/$id/$buyer"
fun demoForm(kind: String, property: String = "-", buyer: String = "-", target: String = "-") = "form/$kind/$property/$buyer/$target"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateDemoApp(start: String = "properties", onExit: () -> Unit, vm: EstateDemoViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val go: (String) -> Unit = { destination ->
        vm.clearFeedback()
        if (destination == "__back") nav.popBackStack()
        else nav.navigate(destination) { launchSingleTop = !destination.startsWith("detail/") && !destination.startsWith("form/") }
    }
    val heading = demoSections[route] ?: if (route?.startsWith("form") == true) "Review & prepare" else "Customer workspace"
    Scaffold(contentWindowInsets = WindowInsets(0, 0, 0, 0),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Column {
                TopAppBar(title = { Text(heading, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis) },
                    navigationIcon = { IconButton({ if (nav.previousBackStackEntry != null) nav.popBackStack() else onExit() }) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back")
                    } }, actions = { TextButton(onExit) { Text("Exit preview") } })
                Surface(color = MaterialTheme.colorScheme.tertiaryContainer) {
                    Text("FICTIONAL TRAINING DATA · NOT YOUR ORGANISATION'S STOCK · NO SERVER WRITES", Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp),
                        style = MaterialTheme.typography.labelSmall)
                }
                if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.error?.let { SegmiqErrorCard(it, vm::clearFeedback) }
                state.message?.let { Text(it, Modifier.padding(horizontal = 20.dp, vertical = 6.dp), style = MaterialTheme.typography.bodyMedium) }
            }
        },
        bottomBar = {
            if (route in setOf("home", "properties", "buyers", "inbox", "more")) SegmiqBottomNavigation {
                listOf("home" to Icons.Rounded.Home, "properties" to Icons.Rounded.HomeWork, "buyers" to Icons.Rounded.People,
                    "inbox" to Icons.Rounded.Forum, "more" to Icons.Rounded.MoreHoriz).forEach { (key, icon) ->
                    NavigationBarItem(route == key, { nav.navigate(key) {
                        popUpTo(nav.graph.startDestinationId) { saveState = true }
                        launchSingleTop = true; restoreState = true
                    } }, icon = { Icon(icon, null) }, label = { SegmiqNavigationLabel(demoSections.getValue(key)) },
                        colors = NavigationBarItemDefaults.colors(indicatorColor = Lime, selectedIconColor = Ink))
                }
            }
        }) { padding ->
        NavHost(nav, enterTransition = { SegmiqMotion.enter() }, exitTransition = { SegmiqMotion.exit() },
            popEnterTransition = { SegmiqMotion.backEnter() }, popExitTransition = { SegmiqMotion.backExit() }, startDestination = start.takeIf { it in demoSections } ?: "properties",
            modifier = Modifier.padding(padding).consumeWindowInsets(padding)) {
            demoSections.keys.forEach { section -> composable(section) { EstateDemoDirectory(section, state, vm, go) } }
            composable("detail/{kind}/{id}/{buyer}") { e ->
                EstateDemoDetail(e.arguments?.getString("kind").orEmpty(), e.arguments?.getString("id").orEmpty(), state, vm, go, e.arguments?.getString("buyer")?.takeUnless { it == "-" })
            }
            composable("form/{kind}/{property}/{buyer}/{target}") { e ->
                EstateDemoForm(e.arguments?.getString("kind").orEmpty(), e.arguments?.getString("property").orEmpty(),
                    e.arguments?.getString("buyer").orEmpty(), e.arguments?.getString("target").orEmpty(), state, vm, go)
            }
            composable("document/{transaction}/{id}") { e ->
                EstateDemoDocument(e.arguments?.getString("transaction").orEmpty(), e.arguments?.getString("id").orEmpty(), state)
            }
        }
    }
}

@Composable
private fun EstateDemoDirectory(section: String, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf(if (section == "viewings") "Upcoming" else "All") }
    val title = demoSections.getValue(section)
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { EstatePageHeader(title, when (section) {
            "properties" -> "${state.properties.size} fictional listings · USD"
            "buyers" -> "${state.buyers.count { it.owner == "demo-agent" }} assigned fictional buyers"
            "inquiries" -> "Authorised fictional inquiries"
            "calendar" -> "Your fictional day and week"
            else -> "Fictional records · this preview session only"
        }) }
        if (section in setOf("properties", "buyers", "inquiries", "offers")) item {
            SegmiqSearchField(query, { query = it }, "Search ${title.lowercase()}")
        }
        when (section) {
            "home" -> {
                item { SegmiqImageFeatureCard(com.segmiq.sales.R.drawable.estate_home_feature, "Your property day",
                    "Explore the linked fictional agent workspace.", badge = "DECORATIVE · GENERATED") {
                    SegmiqPrimaryButton("Review fictional inquiries", { go("inquiries") })
                } }
                item { EstateModuleRow("Upcoming viewings", "${state.viewings.count { it.status == "scheduled" }} fictional appointments", Icons.Rounded.Event) { go("viewings") } }
                item { EstateModuleRow("Offers & next steps", "Review examples before making local changes", Icons.Rounded.LocalOffer) { go("offers") } }
                item { EstateModuleRow("Daily activities", "View your fictional day and week", Icons.Rounded.CalendarMonth) { go("calendar") } }
            }
            "inbox" -> item {
                SegmiqEmptyState("No preview messages", "This fictional workspace has no messaging provider. Exit preview to use your authorised SegmiQ Inbox.")
            }
            "properties" -> {
                val rows = state.properties.filter { (it.address + it.suburb).contains(query, true) }
                if (rows.isEmpty()) item { SegmiqEmptyState("No matching examples", "Try another location or address.") }
                items(rows, key = { it.id }) { EstatePropertyMiniCard(it) { go(demoDetail("property", it.id)) } }
            }
            "buyers", "inquiries" -> {
                val buyers = state.buyers.filter { it.owner == "demo-agent" && it.name.contains(query, true) }
                if (buyers.isEmpty()) item { SegmiqEmptyState("No matching examples", "Private buyers owned by another agent are not shown.") }
                items(buyers, key = { it.id }) { buyer ->
                    EstateBuyerRow(buyer) { go(demoDetail(if (section == "inquiries") "inquiry" else "buyer", buyer.id)) }
                }
            }
            "viewings" -> {
                item { FilterChips(listOf("Today", "Upcoming", "Completed", "Cancelled"), filter) { filter = it } }
                item { SegmiqPrimaryButton("Schedule demo viewing", { go(demoForm("viewing")) }) }
                val today = LocalDate.now(vm.zone)
                val rows = state.viewings.filter { when (filter) {
                    "Today" -> it.status == "scheduled" && it.at.atZone(vm.zone).toLocalDate() == today
                    "Upcoming" -> it.status == "scheduled" && !it.at.atZone(vm.zone).toLocalDate().isBefore(today)
                    "Completed" -> it.status == "completed"
                    else -> it.status == "cancelled"
                } }.sortedBy { it.at }
                if (rows.isEmpty()) item { SegmiqEmptyState("No $filter demo viewings", "Choose another filter or schedule a fictional appointment.") }
                items(rows, key = { it.id }) { row ->
                    val property = state.properties.first { it.id == row.propertyId }
                    EstateWorkCard(property, property.address, "${row.at.atZone(vm.zone).format(DateTimeFormatter.ofPattern("EEE d MMM · HH:mm"))}\n${state.buyers.first { it.id == row.buyerId }.name} · ${row.status}") { go(demoDetail("viewing", row.id)) }
                }
            }
            "offers" -> {
                item { FilterChips(listOf("All", "Awaiting", "Counteroffers", "Accepted", "Declined"), filter) { filter = it } }
                item { SegmiqPrimaryButton("Prepare demo offer", { go(demoForm("offer")) }) }
                val rows = state.offers.filter { offer ->
                    state.properties.first { it.id == offer.propertyId }.address.contains(query, true) && when (filter) {
                        "Awaiting" -> offer.status == "submitted"
                        "Counteroffers" -> offer.status == "countered"
                        "Accepted" -> offer.status == "accepted"
                        "Declined" -> offer.status == "rejected"
                        else -> true
                    }
                }
                if (rows.isEmpty()) item { SegmiqEmptyState("No matching demo offers", "Try another status or prepare a fictional offer.") }
                items(rows, key = { it.id }) { offer -> EstateWorkCard(
                    state.properties.first { it.id == offer.propertyId }, estateAmount(offer.amount), offer.status) { go(demoDetail("offer", offer.id)) } }
            }
            "introductions" -> {
                item { FilterChips(listOf("All", "Received", "Sent", "Pending", "Approved", "Declined"), filter) { filter = it } }
                val rows = state.introductions.filter { when (filter) {
                    "Received" -> it.reviewer == "demo-agent"
                    "Sent" -> it.requester == "demo-agent"
                    "Pending" -> it.status == "pending"
                    "Approved" -> it.status == "accepted"
                    "Declined" -> it.status == "declined"
                    else -> true
                } }
                if (rows.isEmpty()) item { SegmiqEmptyState("No matching requests", "Try another introduction filter.") }
                items(rows, key = { it.id }) { intro -> EstateModuleRow(
                    if (intro.requester == "demo-agent") "Your introduction request" else "Received introduction",
                    "${state.properties.first { it.id == intro.propertyId }.address} · ${intro.status}",
                    Icons.Rounded.Handshake) { go(demoDetail("introduction", intro.id)) } }
            }
            "transactions" -> {
                items(state.transactions, key = { it.id }) { txn ->
                    val property = state.properties.first { it.id == txn.propertyId }
                    EstateWorkCard(property, property.address, "${txn.status.replace('_', ' ')} · ${txn.milestones.count { it.status == "done" }} / ${txn.milestones.size} milestones") { go(demoDetail("transaction", txn.id)) }
                }
            }
            "documents" -> {
                item { SegmiqLabel("EXAMPLE DOCUMENTS · NO PRIVATE FILES") }
                state.transactions.forEach { txn -> items(txn.documents, key = { it.id }) { document ->
                    EstateDocumentRow(document) { go("document/${txn.id}/${document.id}") }
                } }
            }
            "calendar" -> item { EstateDemoCalendar(state, vm, go) }
            "copilot" -> {
                item { SegmiqCopilotHeader("Preview only · review connected recommendations after exiting.") }
                item { EstateNotice("Use your connected Sales Copilot", "This preview does not generate AI recommendations. Review the existing live Copilot after exiting the preview.", Icons.Rounded.AutoAwesome) }
                items(state.commitments, key = { it.id }) { task -> EstateContextRow(task.title, "Fictional follow-up · ${task.date}") { go(demoDetail("buyer", task.buyerId)) } }
            }
            "more" -> {
                demoSections.filterKeys { it !in setOf("home", "properties", "buyers", "inbox", "more") }.forEach { (key, label) ->
                    item { EstateModuleRow(label, "Open fictional $label workflow", Icons.Rounded.ChevronRight) { go(key) } }
                }
                item { OutlinedButton(vm::failNext) { Text("Test a failed demo save") } }
                item { Text("No APIs, messages, financial commitments or document uploads are performed. Exit preview to return to your signed-in workspace.",
                    style = MaterialTheme.typography.bodyMedium) }
            }
        }
    }
}

@Composable
private fun EstateDemoCalendar(state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit) {
    var dateText by rememberSaveable { mutableStateOf(LocalDate.now(vm.zone).toString()) }
    var mode by rememberSaveable { mutableStateOf("Day") }
    val date = LocalDate.parse(dateText)
    val start = if (mode == "Week") date.with(DayOfWeek.MONDAY) else date
    val end = start.plusDays(if (mode == "Week") 7 else 1)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Fictional calendar · ${vm.zone}", style = MaterialTheme.typography.labelLarge)
        FilterChips(listOf("Day", "Week"), mode) { mode = it }
        Row {
            IconButton({ dateText = date.minusDays(if (mode == "Week") 7 else 1).toString() }) { Icon(Icons.Rounded.ChevronLeft, "Previous date") }
            TextButton({ dateText = LocalDate.now(vm.zone).toString() }, Modifier.weight(1f)) { Text(date.format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))) }
            IconButton({ dateText = date.plusDays(if (mode == "Week") 7 else 1).toString() }) { Icon(Icons.Rounded.ChevronRight, "Next date") }
        }
        val marked = state.viewings.map { it.at.atZone(vm.zone).toLocalDate() }.toSet() + state.commitments.map { it.date }
        SegmiqWeekStrip(date, marked) { dateText = it.toString() }
        val viewings = state.viewings.filter { val day = it.at.atZone(vm.zone).toLocalDate(); !day.isBefore(start) && day.isBefore(end) }
        val tasks = state.commitments.filter { !it.date.isBefore(start) && it.date.isBefore(end) }
        if (viewings.isEmpty() && tasks.isEmpty()) SegmiqEmptyState("No example activities", "Navigate dates or schedule a fictional viewing.")
        viewings.forEach { row -> EstateModuleRow(state.properties.first { it.id == row.propertyId }.address,
            row.at.atZone(vm.zone).format(DateTimeFormatter.ofPattern("EEE d MMM · HH:mm")), Icons.Rounded.Event) { go(demoDetail("viewing", row.id)) } }
        tasks.forEach { task -> EstateContextRow(task.title, "${task.date} · date only") { go(demoDetail("buyer", task.buyerId)) } }
        SegmiqPrimaryButton("Schedule demo viewing", { go(demoForm("viewing")) })
    }
}
