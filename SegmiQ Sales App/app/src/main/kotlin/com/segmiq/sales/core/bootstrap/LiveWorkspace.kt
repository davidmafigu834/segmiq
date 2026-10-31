package com.segmiq.sales.core.bootstrap

import com.segmiq.sales.core.data.AuthorisedScope
import java.time.ZoneId

const val SUPPORTED_BOOTSTRAP_SCHEMA = 1

enum class Experience { GENERAL, REAL_ESTATE, SOLAR }

enum class HomeVariant { TEAM, SOLO }

/** Experience comes only from the server. Unknown values fall back to GENERAL (contract §6.1). */
fun resolveExperience(bootstrap: SalesAppBootstrap): Experience = when (bootstrap.experience.id) {
    "REAL_ESTATE" -> Experience.REAL_ESTATE
    "SOLAR" -> Experience.SOLAR
    else -> Experience.GENERAL
}

/** Screens the Android app can open. [implemented] = false renders an honest unavailable state. */
enum class LiveModule(val route: String, val implemented: Boolean) {
    MY_DAY("live/home", true),
    INBOX("live/module/inbox", true),
    DIALER("live/dialer", true),
    PIPELINE("live/pipeline", true),
    LEADS("live/leads", true),
    TASKS("live/tasks", true),
    COPILOT("live/copilot", true),
    MORE("live/more", true),
    SOLAR_PIPELINE("live/module/solar_pipeline", false),
    SITE_VISITS("live/module/site_visits", false),
    ASSESSMENTS("live/module/assessments", false),
    QUOTATIONS("live/module/quotations", false),
    PROJECTS("live/module/projects", false),
    PROPERTIES("live/module/properties", false),
    BUYERS_TENANTS("live/module/buyers", false),
    VIEWINGS("live/module/viewings", false),
    INTRODUCTIONS("live/module/introductions", false),
    OFFERS("live/module/offers", false),
    TRANSACTIONS("live/module/transactions", false),
    ACQUISITIONS("live/module/acquisitions", false),
    INSPECTIONS("live/module/inspections", false),
    OWNERS("live/module/owners", false),
    MANDATES("live/module/mandates", false),
    COMMISSIONS("live/module/commissions", false),
    SETTINGS("live/settings", true),
    ACTIVITIES("live/activities", true),
}

enum class NavIcon { HOME, INBOX, DIALER, PIPELINE, LEADS, TASKS, COPILOT, MORE, PROPERTY, VIEWING, SOLAR, VISIT, DOCUMENT, PROJECT, PEOPLE, HANDSHAKE, OFFER, TRANSACTION }

data class NavItem(
    val module: LiveModule,
    val label: String,
    val icon: NavIcon,
    /** Server destination that must be in `capabilities.modules`; null when the app owns the item. */
    val destinationId: String? = null,
    val destinationIds: List<String> = listOfNotNull(destinationId),
) {
    val route: String get() = module.route
}

data class LiveNavigation(val tabs: List<NavItem>, val more: List<NavItem>) {
    fun find(module: LiveModule): NavItem? = (tabs + more).firstOrNull { it.module == module }
    fun allows(module: LiveModule): Boolean = find(module) != null
}

private fun tabsFor(experience: Experience): Pair<List<NavItem>, List<NavItem>> = when (experience) {
    Experience.GENERAL -> listOf(
        NavItem(LiveModule.MY_DAY, "My Day", NavIcon.HOME),
        NavItem(LiveModule.INBOX, "Inbox", NavIcon.INBOX, destinationIds = listOf("WHATSAPP", "SOCIAL_INBOX")),
        NavItem(LiveModule.DIALER, "Dialer", NavIcon.DIALER),
        NavItem(LiveModule.PIPELINE, "Pipeline", NavIcon.PIPELINE, "PIPELINE"),
        NavItem(LiveModule.MORE, "More", NavIcon.MORE),
    ) to listOf(
        NavItem(LiveModule.LEADS, "Leads", NavIcon.LEADS, "LEADS"),
        NavItem(LiveModule.TASKS, "Tasks", NavIcon.TASKS, "TASKS"),
        NavItem(LiveModule.COPILOT, "Sales Copilot", NavIcon.COPILOT, "TASKS"),
        NavItem(LiveModule.QUOTATIONS, "Quotations", NavIcon.DOCUMENT, "QUOTES"),
    )
    Experience.REAL_ESTATE -> listOf(
        NavItem(LiveModule.MY_DAY, "Home", NavIcon.HOME),
        NavItem(LiveModule.PROPERTIES, "Properties", NavIcon.PROPERTY, "LISTINGS"),
        NavItem(LiveModule.BUYERS_TENANTS, "Buyers", NavIcon.PEOPLE, "BUYERS"),
        NavItem(LiveModule.INBOX, "Inbox", NavIcon.INBOX, destinationIds = listOf("WHATSAPP", "SOCIAL_INBOX")),
        NavItem(LiveModule.MORE, "More", NavIcon.MORE),
    ) to listOf(
        NavItem(LiveModule.LEADS, "Inquiries", NavIcon.LEADS, "LEADS"),
        NavItem(LiveModule.VIEWINGS, "Viewings", NavIcon.VIEWING, "VIEWINGS"),
        NavItem(LiveModule.INTRODUCTIONS, "Introductions", NavIcon.HANDSHAKE, "INTRODUCTIONS"),
        NavItem(LiveModule.OFFERS, "Offers", NavIcon.OFFER, "OFFERS"),
        NavItem(LiveModule.TRANSACTIONS, "Transactions", NavIcon.TRANSACTION, "TRANSACTIONS"),
        NavItem(LiveModule.ACQUISITIONS, "Acquisitions", NavIcon.PROPERTY, "OPPORTUNITIES"),
        NavItem(LiveModule.INSPECTIONS, "Inspections", NavIcon.DOCUMENT, "INSPECTIONS"),
        NavItem(LiveModule.OWNERS, "Owners", NavIcon.PEOPLE, "OWNERS"),
        NavItem(LiveModule.MANDATES, "Mandates", NavIcon.DOCUMENT, "MANDATES"),
        NavItem(LiveModule.COMMISSIONS, "Commissions", NavIcon.TRANSACTION, "COMMISSIONS"),
        NavItem(LiveModule.TASKS, "Tasks", NavIcon.TASKS, "TASKS"),
        NavItem(LiveModule.ACTIVITIES, "Activities", NavIcon.VIEWING, destinationIds = listOf("TASKS", "CALENDAR")),
        NavItem(LiveModule.COPILOT, "Sales Copilot", NavIcon.COPILOT, "TASKS"),
        NavItem(LiveModule.DIALER, "Dialer", NavIcon.DIALER),
        NavItem(LiveModule.SETTINGS, "Settings", NavIcon.MORE),
    )
    Experience.SOLAR -> listOf(
        NavItem(LiveModule.MY_DAY, "My Day", NavIcon.HOME),
        NavItem(LiveModule.INBOX, "Inbox", NavIcon.INBOX, destinationIds = listOf("WHATSAPP", "SOCIAL_INBOX")),
        NavItem(LiveModule.SOLAR_PIPELINE, "Solar Pipeline", NavIcon.SOLAR, "PIPELINE"),
        NavItem(LiveModule.SITE_VISITS, "Site Visits", NavIcon.VISIT),
        NavItem(LiveModule.MORE, "More", NavIcon.MORE),
    ) to listOf(
        NavItem(LiveModule.LEADS, "Leads", NavIcon.LEADS, "LEADS"),
        NavItem(LiveModule.TASKS, "Tasks", NavIcon.TASKS, "TASKS"),
        NavItem(LiveModule.COPILOT, "Sales Copilot", NavIcon.COPILOT, "TASKS"),
        NavItem(LiveModule.ASSESSMENTS, "Assessments", NavIcon.DOCUMENT),
        NavItem(LiveModule.QUOTATIONS, "Quotations", NavIcon.DOCUMENT, "QUOTES"),
        NavItem(LiveModule.PROJECTS, "Projects", NavIcon.PROJECT, "PROJECTS"),
        NavItem(LiveModule.DIALER, "Dialer", NavIcon.DIALER),
    )
}

/**
 * Builds navigation for the server-resolved experience. Items mapped to a server destination are
 * shown only when that destination is in `capabilities.modules`, so the app never offers more
 * than the web portal grants. The user cannot choose the experience.
 */
fun buildNavigation(bootstrap: SalesAppBootstrap): LiveNavigation {
    // Real Estate requires agreement between capabilities and destinations. Neither is a
    // replacement for server-side access checks; unverified module APIs remain disconnected.
    val experience = resolveExperience(bootstrap)
    val granted = bootstrap.capabilities.modules.toSet().let { modules ->
        if (experience == Experience.REAL_ESTATE) modules.intersect(bootstrap.navigation.destinations.map { it.id }.toSet())
        else modules
    }
    val (tabs, more) = tabsFor(experience)
    fun permitted(item: NavItem) = item.destinationIds.isEmpty() || item.destinationIds.any { it in granted }
    return LiveNavigation(tabs.filter(::permitted), more.filter(::permitted))
}

sealed interface WorkspaceGate {
    data object Open : WorkspaceGate
    data object SubscriptionBlocked : WorkspaceGate
    data object SalesOperationsBlocked : WorkspaceGate
    data object UnsupportedSchema : WorkspaceGate
}

fun gateFor(bootstrap: SalesAppBootstrap): WorkspaceGate = when {
    bootstrap.schemaVersion > SUPPORTED_BOOTSTRAP_SCHEMA -> WorkspaceGate.UnsupportedSchema
    bootstrap.subscription.salesAccess == "BLOCKED" -> WorkspaceGate.SubscriptionBlocked
    bootstrap.capabilities.restrictions.salesOperations == "BLOCKED" -> WorkspaceGate.SalesOperationsBlocked
    else -> WorkspaceGate.Open
}

/** Everything the live app needs about the signed-in user and organisation, from bootstrap only. */
data class LiveWorkspace(
    val bootstrap: SalesAppBootstrap,
    val scope: AuthorisedScope,
    val experience: Experience,
    val homeVariant: HomeVariant,
    val zone: ZoneId,
    val currencyCode: String?,
    val navigation: LiveNavigation,
    val isDemoWorkspace: Boolean,
) {
    val userName: String get() = bootstrap.user.displayName
    val organisationName: String get() = bootstrap.organisation.name
    val canModifyLeads: Boolean get() = bootstrap.capabilities.restrictions.leadModification != null

    companion object {
        fun from(bootstrap: SalesAppBootstrap): LiveWorkspace = LiveWorkspace(
            bootstrap = bootstrap,
            scope = AuthorisedScope(bootstrap.organisation.id, bootstrap.user.id),
            experience = resolveExperience(bootstrap),
            homeVariant = if (bootstrap.experience.homeVariant == "SOLO") HomeVariant.SOLO else HomeVariant.TEAM,
            zone = runCatching { ZoneId.of(bootstrap.salesConfiguration.timeZone.effective) }.getOrDefault(ZoneId.of("UTC")),
            currencyCode = bootstrap.salesConfiguration.currency.quotationDefault,
            navigation = buildNavigation(bootstrap),
            isDemoWorkspace = bootstrap.capabilities.featureFlags.demoWorkspace ||
                bootstrap.organisation.workspaceMode == "demo",
        )
    }
}
