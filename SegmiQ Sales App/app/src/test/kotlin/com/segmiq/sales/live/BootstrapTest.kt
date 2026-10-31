package com.segmiq.sales.live

import com.segmiq.sales.core.bootstrap.Experience
import com.segmiq.sales.core.bootstrap.HomeVariant
import com.segmiq.sales.core.bootstrap.LiveModule
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.bootstrap.WorkspaceGate
import com.segmiq.sales.core.bootstrap.buildNavigation
import com.segmiq.sales.core.bootstrap.gateFor
import com.segmiq.sales.core.bootstrap.resolveExperience
import org.junit.Assert.*
import org.junit.Test
import java.time.ZoneId

private fun com.segmiq.sales.core.bootstrap.SalesAppBootstrap.withGrantedDestinations() = copy(
    navigation = navigation.copy(destinations = capabilities.modules.map {
        com.segmiq.sales.core.bootstrap.NavDestination(it, it, webPath = "/sales/test")
    }),
)

class BootstrapTest {
    @Test fun decodesSchemaAndIgnoresUnknownFields() {
        val b = bootstrap()
        assertEquals(1, b.schemaVersion)
        assertEquals(Fake.ORG, b.organisation.id)
        assertEquals("Africa/Harare", b.salesConfiguration.timeZone.effective)
        assertEquals("/sales/quotations", b.navigation.destinations.single().webPath)
    }

    @Test fun experienceComesFromServerWithGeneralFallback() {
        assertEquals(Experience.REAL_ESTATE, resolveExperience(bootstrap("experience" to "REAL_ESTATE")))
        assertEquals(Experience.SOLAR, resolveExperience(bootstrap("experience" to "SOLAR")))
        assertEquals(Experience.GENERAL, resolveExperience(bootstrap("experience" to "SOMETHING_NEW")))
    }

    @Test fun generalNavigation() {
        val nav = buildNavigation(bootstrap())
        assertEquals(listOf("My Day", "Inbox", "Dialer", "Pipeline", "More"), nav.tabs.map { it.label })
        assertTrue(nav.allows(LiveModule.LEADS))
        assertTrue(nav.allows(LiveModule.COPILOT))
        assertFalse(nav.allows(LiveModule.PROPERTIES))
    }

    @Test fun modulesNotGrantedByServerAreHidden() {
        val nav = buildNavigation(bootstrap("modules" to listOf("LEADS")))
        assertEquals(listOf("My Day", "Dialer", "More"), nav.tabs.map { it.label })
        assertFalse(nav.allows(LiveModule.TASKS))
        assertFalse(nav.allows(LiveModule.COPILOT))
        assertFalse(nav.allows(LiveModule.QUOTATIONS))
        assertTrue(nav.allows(LiveModule.LEADS))
    }

    @Test fun realEstateNavigation() {
        val b = bootstrap(
            "experience" to "REAL_ESTATE",
            "modules" to listOf("LISTINGS", "LEADS", "VIEWINGS", "BUYERS", "INTRODUCTIONS", "OFFERS", "TRANSACTIONS", "TASKS", "WHATSAPP"),
        )
        val nav = buildNavigation(b.withGrantedDestinations())
        assertEquals(listOf("Home", "Properties", "Buyers", "Inbox", "More"), nav.tabs.map { it.label })
        assertEquals(
            listOf("Inquiries", "Viewings", "Introductions", "Offers", "Transactions", "Tasks", "Activities", "Sales Copilot", "Dialer", "Settings"),
            nav.more.map { it.label },
        )
        assertFalse(nav.allows(LiveModule.SOLAR_PIPELINE))
        assertFalse(nav.allows(LiveModule.PIPELINE))
    }

    @Test fun realEstateRequiresDestinationAndCapabilityAgreement() {
        val b = bootstrap("experience" to "REAL_ESTATE", "modules" to listOf("LISTINGS", "BUYERS", "OFFERS"))
        val noDestinations = buildNavigation(b.copy(navigation = b.navigation.copy(destinations = emptyList())))
        assertEquals(listOf("Home", "More"), noDestinations.tabs.map { it.label })
        assertFalse(noDestinations.allows(LiveModule.OFFERS))
        val notGranted = b.copy(capabilities = b.capabilities.copy(modules = emptyList())).copy(
            navigation = b.withGrantedDestinations().navigation)
        assertFalse(buildNavigation(notGranted).allows(LiveModule.PROPERTIES))
    }

    @Test fun realEstateMoreShowsOnlyGrantedAndKnownModules() {
        val b = bootstrap("experience" to "REAL_ESTATE",
            "modules" to listOf("OPPORTUNITIES", "OWNERS", "INSPECTIONS", "MANDATES", "COMMISSIONS", "FUTURE_MODULE"))
        val nav = buildNavigation(b.withGrantedDestinations())
        assertEquals(listOf("Acquisitions", "Inspections", "Owners", "Mandates", "Commissions", "Dialer", "Settings"),
            nav.more.map { it.label })
        assertFalse(nav.allows(LiveModule.LEADS))
        assertFalse(nav.allows(LiveModule.TASKS))
    }

    @Test fun featureFlagsAndBusinessTypeCannotOverrideResolvedExperience() {
        val b = bootstrap().copy(
            organisation = bootstrap().organisation.copy(businessType = "real_estate"),
            capabilities = bootstrap().capabilities.copy(featureFlags = com.segmiq.sales.core.bootstrap.FeatureFlags(realEstateWorkflow = true)))
        assertEquals(Experience.GENERAL, LiveWorkspace.from(b).experience)
        assertFalse(buildNavigation(b).allows(LiveModule.PROPERTIES))
    }

    @Test fun solarNavigation() {
        val nav = buildNavigation(bootstrap("experience" to "SOLAR", "modules" to listOf("PIPELINE", "LEADS", "TASKS", "QUOTES", "PROJECTS", "SOCIAL_INBOX")))
        assertEquals(listOf("My Day", "Inbox", "Solar Pipeline", "Site Visits", "More"), nav.tabs.map { it.label })
        assertTrue(nav.allows(LiveModule.PROJECTS))
        assertFalse(nav.allows(LiveModule.PIPELINE))
        assertFalse(nav.allows(LiveModule.PROPERTIES))
    }

    @Test fun unbuiltModulesAreMarkedUnavailable() {
        assertFalse(LiveModule.PROPERTIES.implemented)
        assertFalse(LiveModule.SOLAR_PIPELINE.implemented)
        assertTrue(LiveModule.INBOX.implemented)
        assertTrue(LiveModule.LEADS.implemented)
    }

    @Test fun gates() {
        assertEquals(WorkspaceGate.Open, gateFor(bootstrap()))
        assertEquals(WorkspaceGate.SubscriptionBlocked, gateFor(bootstrap("salesAccess" to "BLOCKED")))
        assertEquals(WorkspaceGate.SalesOperationsBlocked, gateFor(bootstrap("salesOperations" to "BLOCKED")))
        assertEquals(WorkspaceGate.UnsupportedSchema, gateFor(bootstrap("schemaVersion" to 2)))
    }

    @Test fun workspaceUsesOrganisationZoneScopeAndVariant() {
        val w = LiveWorkspace.from(bootstrap("homeVariant" to "SOLO"))
        assertEquals(ZoneId.of("Africa/Harare"), w.zone)
        assertEquals(Fake.ORG, w.scope.organisationId)
        assertEquals(Fake.USER, w.scope.salespersonId)
        assertEquals(HomeVariant.SOLO, w.homeVariant)
        assertEquals("USD", w.currencyCode)
        assertFalse(w.isDemoWorkspace)
        assertTrue(w.canModifyLeads)
        assertEquals(ZoneId.of("UTC"), LiveWorkspace.from(bootstrap("zone" to "Not/AZone")).zone)
        assertTrue(LiveWorkspace.from(bootstrap("demo" to true)).isDemoWorkspace)
    }
}
