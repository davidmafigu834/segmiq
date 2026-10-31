package com.segmiq.sales.features.live

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.isSystemInDarkTheme
import com.segmiq.sales.features.realestate.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Chat
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.segmiq.sales.app.NotFoundPage
import com.segmiq.sales.core.bootstrap.Experience
import com.segmiq.sales.core.bootstrap.LiveModule
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.bootstrap.NavIcon
import com.segmiq.sales.core.design.SegmiqMotion
import com.segmiq.sales.core.design.SegmiqBottomNavigation
import com.segmiq.sales.core.design.SegmiqNavigationLabel
import com.segmiq.sales.core.design.SegmiqLabel
import com.segmiq.sales.core.design.SegmiqOfflineBanner
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.segmiq.sales.appContainer
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.ScopedCache
import com.segmiq.sales.core.notify.SalesNotifier
import com.segmiq.sales.features.inbox.InboxDirectoryScreen
import com.segmiq.sales.features.inbox.InboxThreadScreen
import com.segmiq.sales.features.inbox.InboxViewModel
import com.segmiq.sales.features.recorder.LiveRecorderScreen
import com.segmiq.sales.features.recorder.LiveRecordingDetail
import com.segmiq.sales.features.recorder.LiveRecordingsScreen
import com.segmiq.sales.ui.theme.Ink
import com.segmiq.sales.ui.theme.Lime
import kotlinx.coroutines.flow.StateFlow

fun NavIcon.vector(): ImageVector = when (this) {
    NavIcon.HOME -> Icons.Rounded.Home
    NavIcon.INBOX -> Icons.AutoMirrored.Rounded.Chat
    NavIcon.DIALER -> Icons.Rounded.Dialpad
    NavIcon.PIPELINE -> Icons.AutoMirrored.Rounded.TrendingUp
    NavIcon.LEADS -> Icons.Rounded.PeopleOutline
    NavIcon.TASKS -> Icons.Rounded.CheckCircleOutline
    NavIcon.COPILOT -> Icons.Rounded.AutoAwesome
    NavIcon.MORE -> Icons.Rounded.MoreHoriz
    NavIcon.PROPERTY -> Icons.Rounded.HomeWork
    NavIcon.VIEWING -> Icons.Rounded.Event
    NavIcon.SOLAR -> Icons.Rounded.WbSunny
    NavIcon.VISIT -> Icons.Rounded.Place
    NavIcon.DOCUMENT -> Icons.Rounded.Description
    NavIcon.PROJECT -> Icons.Rounded.Construction
    NavIcon.PEOPLE -> Icons.Rounded.Groups
    NavIcon.HANDSHAKE -> Icons.Rounded.Handshake
    NavIcon.OFFER -> Icons.Rounded.LocalOffer
    NavIcon.TRANSACTION -> Icons.Rounded.ReceiptLong
}

const val ROUTE_LEAD = "live/lead/{id}"
const val ROUTE_ADD_LEAD = "live/lead-new"

/** Singular/plural lead terminology for the experience (Real Estate calls leads inquiries). */
data class LeadTerms(val singular: String, val plural: String)
fun LiveWorkspace.leadTerms() = if (experience == Experience.REAL_ESTATE) LeadTerms("Inquiry", "Inquiries") else LeadTerms("Lead", "Leads")

@Composable
fun LiveSalesApp(
    workspace: LiveWorkspace,
    api: LiveSalesApi,
    cache: ScopedCache,
    online: StateFlow<Boolean>,
    onSignOut: () -> Unit,
) {
    val repository = remember(api, workspace) { api.estate(workspace) }
    LiveSalesWorkspace(workspace, api, cache, online, onSignOut, repository)
}

/** Same native workspace with explicit repository injection; production uses the wrapper above. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LiveSalesWorkspace(
    workspace: LiveWorkspace,
    api: LiveSalesApi,
    cache: ScopedCache,
    online: StateFlow<Boolean>,
    onSignOut: () -> Unit,
    estateRepository: com.segmiq.sales.core.estate.EstateRepository,
) {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route ?: LiveModule.MY_DAY.route
    val isOnline by online.collectAsStateWithLifecycle()
    val tabs = workspace.navigation.tabs
    val onTab = tabs.any { it.route == route }
    val estate = workspace.experience == Experience.REAL_ESTATE
    val preview = route == ESTATE_PREVIEW_ROUTE
    val context = LocalContext.current
    val pending by context.appContainer.pendingRoute.collectAsStateWithLifecycle()
    val darkWorkspace = route == LiveModule.DIALER.route || route.startsWith("live/recorder")
    val terms = workspace.leadTerms()
    val go: (String) -> Unit = { destination ->
        nav.navigate(destination) {
            // Record routes share one destination pattern; keep each record's parent on the stack.
            launchSingleTop = !destination.startsWith("live/estate/")
        }
    }
    LaunchedEffect(workspace.scope.salespersonId, workspace.scope.organisationId) {
        SalesNotifier.rememberAccount(context, workspace.scope.salespersonId, workspace.scope.organisationId)
        SalesNotifier.ensureChannels(context)
    }
    LaunchedEffect(pending) {
        val destination = pending ?: return@LaunchedEffect
        context.appContainer.pendingRoute.value = null
        if (SalesNotifier.accountMatches(context, workspace.scope.salespersonId, workspace.scope.organisationId)) go(destination)
    }

    val title = when (route) {
        ROUTE_LEAD -> terms.singular
        ROUTE_ADD_LEAD -> "Add ${terms.singular.lowercase()}"
        "live/account" -> "Account"
        else -> LiveModule.entries.firstOrNull { it.route == route }?.let { workspace.navigation.find(it)?.label }
            ?: when (route) {
                LiveModule.COPILOT.route -> "Sales Copilot"
                LiveModule.TASKS.route -> "Tasks"
                else -> "SegmiQ Sales"
            }
    }

    Scaffold(
        containerColor = if (darkWorkspace) Ink else MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.safeDrawing,
        topBar = {
            if (!preview) Column {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = if (darkWorkspace) Ink else MaterialTheme.colorScheme.background,
                        titleContentColor = if (darkWorkspace) com.segmiq.sales.ui.theme.WarmWhite else MaterialTheme.colorScheme.onSurface,
                        navigationIconContentColor = if (darkWorkspace) com.segmiq.sales.ui.theme.WarmWhite else MaterialTheme.colorScheme.onSurface),
                    title = {
                        if (estate && route == LiveModule.MY_DAY.route) EstateBrandTitle()
                        else Text(title, style = MaterialTheme.typography.titleLarge)
                    },
                    navigationIcon = {
                        if (!onTab) IconButton({ nav.popBackStack() }) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back") }
                    },
                    actions = {
                        if (route == LiveModule.MY_DAY.route && workspace.navigation.allows(LiveModule.LEADS)) {
                            IconButton({ go(LiveModule.LEADS.route) }) { Icon(Icons.Rounded.Search, "Search ${terms.plural.lowercase()}") }
                        }
                        if (estate && route == LiveModule.MY_DAY.route) {
                            IconButton({ go(LiveModule.SETTINGS.route) }) { Icon(Icons.Rounded.AccountCircle, "Profile and settings") }
                        }
                        if (route == LiveModule.LEADS.route && workspace.canModifyLeads) {
                            FilledIconButton({ go(ROUTE_ADD_LEAD) },
                                colors = IconButtonDefaults.filledIconButtonColors(containerColor = Lime, contentColor = Ink)) {
                                Icon(Icons.Rounded.Add, "Add ${terms.singular.lowercase()}")
                            }
                        }
                    },
                )
                if (workspace.isDemoWorkspace) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        SegmiqLabel("DEMO WORKSPACE", lime = true)
                        Spacer(Modifier.width(10.dp))
                        Text("Sample organisation provided by SegmiQ", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (!isOnline) Box(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) { SegmiqOfflineBanner() }
            }
        },
        bottomBar = {
            if (onTab) SegmiqBottomNavigation(containerColor = MaterialTheme.colorScheme.surface) {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = route == tab.route,
                        onClick = {
                            nav.navigate(tab.route) {
                                popUpTo(LiveModule.MY_DAY.route) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon.vector(), tab.label) },
                        label = { SegmiqNavigationLabel(tab.label) },
                        colors = NavigationBarItemDefaults.colors(indicatorColor = Lime, selectedIconColor = Ink),
                    )
                }
            }
        },
    ) { padding ->
        NavHost(nav, enterTransition = { SegmiqMotion.enter() }, exitTransition = { SegmiqMotion.exit() },
            popEnterTransition = { SegmiqMotion.backEnter() }, popExitTransition = { SegmiqMotion.backExit() }, startDestination = LiveModule.MY_DAY.route, modifier = Modifier.padding(padding).consumeWindowInsets(padding)) {
            composable(LiveModule.MY_DAY.route) {
                val vm = viewModel { MyDayViewModel(api, cache, workspace) }
                if (estate) RealEstateHome(vm, workspace, go, estateRepository.access, estateRepository) else LiveMyDayScreen(vm, workspace, go)
            }
            composable(LiveModule.LEADS.route) {
                if (!workspace.navigation.allows(LiveModule.LEADS)) NotPermitted { nav.popBackStack() }
                else if (estate) EstateInquiries(viewModel { LeadsViewModel(api) }, workspace, go)
                else LiveLeadsScreen(viewModel { LeadsViewModel(api) }, workspace, go)
            }
            composable(ROUTE_LEAD) { e ->
                val id = e.arguments?.getString("id")
                if (id.isNullOrBlank()) NotFoundPage(terms.singular.lowercase()) { nav.popBackStack() }
                else if (estate) EstateInquiryDetail(viewModel(key = "lead-$id") { LeadDetailViewModel(api, id, workspace.scope.organisationId) }, workspace, go, estateRepository.access)
                else LeadDetailScreen(viewModel(key = "lead-$id") { LeadDetailViewModel(api, id) }, workspace, go)
            }
            composable(ROUTE_ADD_LEAD) {
                LiveAddLeadScreen(viewModel { AddLeadViewModel(api) }, workspace) { leadId ->
                    nav.navigate("live/lead/$leadId") { popUpTo(ROUTE_ADD_LEAD) { inclusive = true } }
                }
            }
            composable(LiveModule.TASKS.route) {
                if (!workspace.navigation.allows(LiveModule.TASKS)) NotPermitted { nav.popBackStack() }
                else LiveTasksScreen(viewModel { TasksViewModel(api, cache, workspace) }, workspace, go)
            }
            composable(LiveModule.COPILOT.route) {
                if (!workspace.navigation.allows(LiveModule.COPILOT)) NotPermitted { nav.popBackStack() }
                else LiveCopilotScreen(viewModel { TasksViewModel(api, cache, workspace) }, workspace, go)
            }
            composable(LiveModule.PIPELINE.route) {
                if (!workspace.navigation.allows(LiveModule.PIPELINE)) NotPermitted { nav.popBackStack() }
                else LivePipelineScreen(viewModel { PipelineViewModel(api, cache, workspace) }, workspace)
            }
            composable(LiveModule.DIALER.route) { LiveDialerScreen(workspace, api, go) }
            composable("live/recordings") {
                LiveRecordingsScreen(workspace.scope.salespersonId, workspace.scope.organisationId,
                    { go("live/recording/$it") }, { go("live/recorder") })
            }
            composable(
                "live/recorder?customerId={customerId}&customerLabel={customerLabel}",
                arguments = listOf(
                    navArgument("customerId") { type = NavType.StringType; nullable = true; defaultValue = null },
                    navArgument("customerLabel") { type = NavType.StringType; nullable = true; defaultValue = null },
                ),
            ) { entry ->
                LiveRecorderScreen(workspace.scope.salespersonId, workspace.scope.organisationId,
                    entry.arguments?.getString("customerId"), entry.arguments?.getString("customerLabel"),
                    if (estate && estateRepository.access.reason(com.segmiq.sales.core.estate.EstateResource.PROPERTIES) == null) estateRepository else null) { id ->
                    nav.navigate("live/recording/$id") { launchSingleTop = true }
                }
            }
            composable("live/recording/{id}") { entry ->
                val id = entry.arguments?.getString("id").orEmpty()
                LiveRecordingDetail(workspace.scope.salespersonId, workspace.scope.organisationId, id,
                    { nav.popBackStack() }, { go(LiveModule.COPILOT.route) })
            }
            composable("live/notifications") { LiveNotificationScreen(workspace, api, go) }
            composable(LiveModule.MORE.route) { LiveMoreScreen(workspace, api.baseUrl(), go, onSignOut) }
            composable(LiveModule.SETTINGS.route) {
                if (estate) EstateSettings(workspace, api.baseUrl().host, onSignOut, { go(estatePreviewRoute("properties")) }) else NotPermitted { nav.popBackStack() }
            }
            composable(LiveModule.ACTIVITIES.route) {
                if (estate && estateRepository.access.reason(com.segmiq.sales.core.estate.EstateResource.CALENDAR) == null)
                    key(estateRepository.stateKey) {
                        EstateServerScreen(viewModel(key = "estate-calendar-${estateRepository.stateKey}") { EstateServerViewModel(estateRepository, EstateLink(com.segmiq.sales.core.estate.EstateResource.CALENDAR)) }, go)
                    }
                else if (estate && workspace.navigation.allows(LiveModule.ACTIVITIES) && workspace.navigation.allows(LiveModule.TASKS))
                    EstateCalendar(viewModel { TasksViewModel(api, cache, workspace) }, workspace, go)
                else EstateGateNotice("Calendar coverage unavailable", "No authorised task feed is available for this workspace.")
            }
            composable(ESTATE_SERVER_ROUTE) { e ->
                val resource = runCatching { com.segmiq.sales.core.estate.EstateResource.valueOf(e.arguments?.getString("resource").orEmpty()) }.getOrNull()
                val id = e.arguments?.getString("id")?.takeUnless { it == "_directory" }
                if (!estate || resource == null) NotPermitted { nav.popBackStack() }
                else {
                    val target = EstateLink(resource, id, e.arguments?.getString("buyer"))
                    key(estateRepository.stateKey, target) {
                        EstateServerScreen(viewModel(key = "estate-${estateRepository.stateKey}-$target") {
                            EstateServerViewModel(estateRepository, target)
                        }, go)
                    }
                }
            }
            composable(ESTATE_PREVIEW_ROUTE) { e ->
                if (estate) EstateDemoApp(e.arguments?.getString("section") ?: "properties", { nav.popBackStack() })
                else NotPermitted { nav.popBackStack() }
            }
            composable(LiveModule.INBOX.route) {
                if (!workspace.navigation.allows(LiveModule.INBOX)) NotPermitted { nav.popBackStack() }
                else InboxDirectoryScreen(viewModel(key = "inbox-${workspace.scope.salespersonId}") {
                    InboxViewModel(api, workspace.scope.salespersonId)
                }, go)
            }
            composable("live/inbox/{leadId}") { entry ->
                val leadId = entry.arguments?.getString("leadId").orEmpty()
                if (!workspace.navigation.allows(LiveModule.INBOX)) NotPermitted { nav.popBackStack() }
                else InboxThreadScreen(viewModel(key = "inbox-thread-${workspace.scope.salespersonId}-$leadId") {
                    InboxViewModel(api, workspace.scope.salespersonId)
                }, leadId, go)
            }
            LiveModule.entries.filter { it.route.startsWith("live/module/") && it != LiveModule.INBOX }.forEach { module ->
                composable(module.route) {
                    val item = workspace.navigation.find(module)
                    if (item == null) NotPermitted { nav.popBackStack() }
                    else if (estate && estateResource(module)?.let { estateRepository.access.reason(it) == null } == true)
                        key(estateRepository.stateKey, module) {
                            EstateServerScreen(viewModel(key = "estate-module-${estateRepository.stateKey}-${module.name}") {
                                EstateServerViewModel(estateRepository, EstateLink(estateResource(module)!!))
                            }, go)
                        }
                    else if (estate) EstateModuleEntry(item, workspace, api.baseUrl(),
                        if (module in setOf(LiveModule.PROPERTIES, LiveModule.BUYERS_TENANTS, LiveModule.VIEWINGS, LiveModule.INTRODUCTIONS, LiveModule.OFFERS, LiveModule.TRANSACTIONS))
                            { { go(estatePreviewRoute(if (module == LiveModule.BUYERS_TENANTS) "buyers" else module.name.lowercase())) } } else null)
                    else UnavailableModuleScreen(item, workspace, api.baseUrl())
                }
            }
        }
    }
}

@Composable
private fun NotPermitted(onBack: () -> Unit) = NotFoundPage("page") { onBack() }
