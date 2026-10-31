package com.segmiq.sales.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import com.segmiq.sales.core.data.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.features.*
import com.segmiq.sales.ui.theme.*
import java.util.UUID

data class MainTab(val route: String, val label: String, val icon: ImageVector)
val mainTabs = listOf(
    MainTab("home", "My Day", Icons.Rounded.GridView),
    MainTab("inbox", "Inbox", Icons.AutoMirrored.Rounded.Chat),
    MainTab("dialer", "Dialer", Icons.Rounded.Dialpad),
    MainTab("pipeline", "Pipeline", Icons.AutoMirrored.Rounded.TrendingUp),
    MainTab("more", "More", Icons.Rounded.MoreHoriz)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesApp(onLeaveDemo: () -> Unit, vm: SalesViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route ?: "home"
    val main = mainTabs.any { it.route == route }
    var quick by rememberSaveable { mutableStateOf(false) }
    val navigate: (String) -> Unit = { nav.navigate(it) { launchSingleTop = true } }
    val titles = demoTitles
    val immersive = route.startsWith("call/")
    val darkWorkspace = immersive || route == "dialer" || route == "recorder"
    Scaffold(
        containerColor = if (darkWorkspace) Ink else MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.safeDrawing,
        topBar = {
            if (!immersive) Column {
                TopAppBar(title = { Text(titles[route.substringBefore("?")] ?: titles[route] ?: "SegmiQ Sales", style = MaterialTheme.typography.titleLarge) },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = if (darkWorkspace) Ink else MaterialTheme.colorScheme.background,
                        titleContentColor = if (darkWorkspace) WarmWhite else MaterialTheme.colorScheme.onSurface,
                        navigationIconContentColor = if (darkWorkspace) WarmWhite else MaterialTheme.colorScheme.onSurface),
                    navigationIcon = { if (!main) IconButton({ nav.popBackStack() }) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back") } },
                    actions = {
                        if (route == "home") {
                            IconButton({ navigate("customers") }) { Icon(Icons.Rounded.Search, "Search customers") }
                            IconButton({ navigate("notifications") }) { Icon(Icons.Rounded.NotificationsNone, "Notifications") }
                            FilledIconButton({ quick = true }, colors = IconButtonDefaults.filledIconButtonColors(containerColor = Lime, contentColor = Ink)) {
                                Icon(Icons.Rounded.Add, "Quick actions")
                            }
                        }
                    })
                if (route != "dialer") Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    SegmiqLabel("LOCAL DEMO", lime = true)
                    Spacer(Modifier.width(10.dp))
                    Text("On-device data · no backend", Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = if (darkWorkspace) Muted else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        bottomBar = {
            if (main) SegmiqBottomNavigation(containerColor = if (darkWorkspace) Ink else MaterialTheme.colorScheme.surface) {
                mainTabs.forEach { tab ->
                    NavigationBarItem(route == tab.route, {
                        nav.navigate(tab.route) {
                            popUpTo("home") { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }, icon = { Icon(tab.icon, tab.label) }, label = { SegmiqNavigationLabel(tab.label) },
                        colors = NavigationBarItemDefaults.colors(indicatorColor = Lime, selectedIconColor = Ink,
                            selectedTextColor = if (darkWorkspace) WarmWhite else MaterialTheme.colorScheme.onSurface,
                            unselectedIconColor = if (darkWorkspace) Muted else MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = if (darkWorkspace) Muted else MaterialTheme.colorScheme.onSurfaceVariant))
                }
            }
        }
    ) { padding ->
        if (state.loading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else if (state.error != null) {
            Column(Modifier.padding(padding).padding(20.dp)) {
                SegmiqEmptyState("Device storage error", state.error!!)
                TextButton(vm::reload) { Text("Retry loading") }
            }
        } else {
            NavHost(nav, enterTransition = { SegmiqMotion.enter() }, exitTransition = { SegmiqMotion.exit() },
                popEnterTransition = { SegmiqMotion.backEnter() }, popExitTransition = { SegmiqMotion.backExit() }, startDestination = "home", modifier = Modifier.padding(padding).consumeWindowInsets(padding)) {
                composable("home") { MyDayScreen(state.data, navigate, vm::complete) }
                composable("inbox") { InboxScreen(state.data, navigate) }
                composable("customers") { CustomersScreen(state.data.customers, navigate) }
                composable("customer/{id}") { e ->
                    val c = state.data.customers.firstOrNull { it.id == e.arguments?.getString("id") }
                    if (c != null) CustomerScreen(c, state.data, navigate) else NotFoundPage("customer") { nav.popBackStack() }
                }
                composable("conversation/{id}") { e ->
                    val c = state.data.customers.firstOrNull { it.id == e.arguments?.getString("id") }
                    if (c != null) ConversationScreen(c, state.data, navigate) { vm.message(c.id, it) } else NotFoundPage("conversation") { nav.popBackStack() }
                }
                composable("dialer") { DialerScreen(state.data, navigate) }
                composable("call/{customer}?number={number}", arguments = listOf(navArgument("number") { defaultValue = "" })) { e ->
                    val id = e.arguments?.getString("customer") ?: "unknown"
                    LiveCallScreen(state.data.customers.firstOrNull { it.id == id }, e.arguments?.getString("number").orEmpty()) { seconds ->
                        nav.navigate("review/$id/${UUID.randomUUID()}/$seconds") { popUpTo(e.destination.id) { inclusive = true } }
                    }
                }
                composable("review/{customer}/{call}/{seconds}", arguments = listOf(navArgument("seconds") { type = NavType.IntType })) { e ->
                    val id = e.arguments?.getString("customer") ?: "unknown"
                    val callId = e.arguments?.getString("call") ?: ""
                    CallReviewScreen(state.data.customers.firstOrNull { it.id == id }, e.arguments?.getInt("seconds") ?: 0,
                        state.data.reviews.any { it.id == callId }, state.saving, navigate) { outcome, notes ->
                        vm.review(CallReview(callId, id, outcome, notes, e.arguments?.getInt("seconds") ?: 0))
                    }
                }
                composable("recorder?customer={customer}", arguments = listOf(navArgument("customer") { defaultValue = "" })) { e -> RecorderScreen(state.data.customers, e.arguments?.getString("customer").orEmpty()) }
                composable("recordings") { RecordingsScreen(navigate) }
                composable("pipeline") { PipelineScreen(state.data.customers, navigate) }
                composable("deal/{id}") { e ->
                    val id = e.arguments?.getString("id") ?: ""
                    if (DemoFixtures.opportunities.any { it.id == id }) DealScreen(id, state.data.customers, navigate) else NotFoundPage("opportunity") { nav.popBackStack() }
                }
                composable("tasks") { TasksScreen(state.data, vm::complete, navigate) }
                composable("meetings") { MeetingsScreen(state.data, navigate) }
                composable("calendar") { MeetingsScreen(state.data, navigate) }
                composable("meeting/{id}") { e ->
                    val meeting = state.data.meetings.firstOrNull { it.id == e.arguments?.getString("id") }
                    if (meeting != null) MeetingDetailScreen(meeting, state.data.customers, navigate) else NotFoundPage("meeting") { nav.popBackStack() }
                }
                composable("schedule") { LocalFormScreen("Schedule a local meeting", state.data, "Meeting title", state.saving, state.data.meetings.size, due = true) { customer, value, date -> vm.meeting(customer, value, date) } }
                composable("more") {
                    Page {
                        Text("Your sales workspace", style = MaterialTheme.typography.headlineMedium)
                        listOf(
                            Triple("customers", "Leads & customers", Icons.Rounded.PeopleOutline),
                            Triple("tasks", "Tasks", Icons.Rounded.CheckCircleOutline),
                            Triple("meetings", "Meetings", Icons.Rounded.Event),
                            Triple("recordings", "Recordings", Icons.Rounded.MicNone),
                            Triple("quotation", "Quotations", Icons.Rounded.Description),
                            Triple("copilot", "Sales Copilot", Icons.Rounded.AutoAwesome),
                            Triple("calendar", "Calendar", Icons.Rounded.Event),
                            Triple("notifications", "Notifications", Icons.Rounded.NotificationsNone),
                            Triple("settings", "Settings", Icons.Rounded.Settings),
                            Triple("help", "Help", Icons.AutoMirrored.Rounded.HelpOutline)
                        ).forEach { (r, label, icon) -> SegmiqActionRow(label, "Open $label", icon) { navigate(r) } }
                    }
                }
                composable("note?customer={customer}", arguments = listOf(navArgument("customer") { defaultValue = "" })) { e -> LocalFormScreen("Save a customer note", state.data, "Note", state.saving, state.data.notes.size, initialCustomer = e.arguments?.getString("customer").orEmpty()) { customer, value, _ -> vm.note(customer, value) } }
                composable("followup?customer={customer}", arguments = listOf(navArgument("customer") { defaultValue = "" })) { e -> LocalFormScreen("Plan the next step", state.data, "Task title", state.saving, state.data.tasks.size, due = true, initialCustomer = e.arguments?.getString("customer").orEmpty()) { customer, value, date -> vm.task(customer, value, date) } }
                composable("lead") { AddLeadScreen(state.data.customers.size, state.saving, vm::lead) }
                composable("copilot") {
                    Page {
                        SegmiqLabel("RECOMMENDATIONS · DEMO")
                        SegmiqCopilotHeader("Local task suggestions · no AI service connected.")
                        Text("Rule-based suggestions from local demo tasks. No AI service is connected.")
                        state.data.tasks.filterNot { it.completed }.forEach { t ->
                            SegmiqCard {
                                Text(t.title, style = MaterialTheme.typography.titleMedium)
                                Text("Why: this action is scheduled for ${t.due.lowercase()}.")
                                TextButton({ navigate("customer/${t.customerId}") }) { Text("Review customer") }
                            }
                        }
                    }
                }
                composable("quotation") { Page { SegmiqEmptyState("Quotation service not connected", "Pricing, tax and quotation templates require the existing SegmiQ contracts. No quotation has been issued."); TextButton({ navigate("note") }) { Text("Save requirements as a local note") } } }
                composable("notifications") { Page { SegmiqEmptyState("You’re all caught up", "No live notification service is connected in local demo mode.") } }
                composable("settings") {
                    Page {
                        SegmiqCard {
                            SegmiqBrandLogo(Modifier.width(124.dp).background(Ink, androidx.compose.foundation.shape.RoundedCornerShape(10.dp)).padding(8.dp))
                            Text("Local demo workspace", style = MaterialTheme.typography.titleLarge)
                            Text("Currency: USD · fictional demo configuration\nTimezone: device setting\nTheme: follows system")
                            Text("No credentials or production access are stored. Device backup is disabled.")
                        }
                        SegmiqCard {
                            Text("Permissions, when you need them", style = MaterialTheme.typography.titleLarge)
                            Text("This local demo does not use your microphone, contacts, or notifications. The signed-in app asks for the microphone only when you start a meeting recording, and for notifications only if you allow local reminders.")
                        }
                        SegmiqCard {
                            Text("Call recording unavailable", style = MaterialTheme.typography.titleLarge)
                            Text("Call audio recording is not supported by this demo. Meeting recording will be integrated separately. No audio is captured.")
                        }
                        OutlinedButton(onLeaveDemo) { Text("Leave demo") }
                    }
                }
                composable("help") { Page { SegmiqEmptyState("Built around your next action", "Start in My Day, open a customer, review their opportunity and save a note or follow-up. All changes stay in this local demo. Phone calls are simulated and no audio is recorded.") } }
            }
        }
    }
    if (quick) ModalBottomSheet(onDismissRequest = { quick = false }) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("What’s next?", style = MaterialTheme.typography.headlineMedium)
            listOf("Add lead" to "lead", "Make call" to "dialer", "Record meeting" to "recorder", "Add note" to "note",
                "Create follow-up" to "followup", "Schedule meeting" to "schedule", "Create quotation" to "quotation").forEach { (label, r) ->
                TextButton({ quick = false; navigate(r) }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text(label, Modifier.fillMaxWidth()) }
            }
        }
    }
}

/** Every demo route has a title; detail routes are keyed by their pattern. */
val demoTitles = mapOf("home" to "My Day", "inbox" to "Sales Inbox", "dialer" to "Dialer", "pipeline" to "Pipeline", "more" to "More",
    "tasks" to "Tasks", "meetings" to "Meetings", "calendar" to "Calendar", "recordings" to "Recordings", "customers" to "Leads & customers",
    "recorder" to "Meeting recorder", "copilot" to "Sales Copilot", "settings" to "Settings", "notifications" to "Notifications",
    "schedule" to "Schedule meeting", "quotation" to "Quotations", "help" to "Help", "note" to "Add note", "followup" to "Create follow-up", "lead" to "Add lead",
    "review/{customer}/{call}/{seconds}" to "Call review", "customer/{id}" to "Customer", "conversation/{id}" to "Conversation",
    "deal/{id}" to "Opportunity", "meeting/{id}" to "Meeting")

@Composable
fun NotFoundPage(kind: String, onBack: () -> Unit) {
    Page {
        SegmiqEmptyState("This $kind isn't available", "It may have been removed or the link is out of date.")
        OutlinedButton(onBack) { Text("Go back") }
    }
}

@Composable
fun Page(content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 680.dp).fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(top = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
    }
}
