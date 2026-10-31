package com.segmiq.sales.core.bootstrap

import kotlinx.serialization.Serializable

/** `GET /api/sales/app/bootstrap`, schema version 1 (docs/android-integration/01 §6.1). */
@Serializable
data class SalesAppBootstrap(
    val schemaVersion: Int,
    val generatedAt: String? = null,
    val release: BackendRelease? = null,
    val session: BootstrapSession? = null,
    val user: BootstrapUser,
    val organisation: BootstrapOrganisation,
    val subscription: BootstrapSubscription,
    val experience: BootstrapExperience,
    val capabilities: BootstrapCapabilities,
    val navigation: BootstrapNavigation,
    val salesConfiguration: SalesConfiguration,
)

/** Advertised source identity, never independent deployment/privacy certification. */
@Serializable
data class BackendRelease(
    val contractVersion: Int,
    val revision: String? = null,
    val deployedVerification: String = "NOT_ATTESTED",
)

@Serializable
data class BootstrapSession(
    val sessionId: String? = null,
    val sessionType: String? = null,
    val expiresAt: String? = null,
    val refreshSupported: Boolean = false,
)

@Serializable
data class BootstrapUser(
    val id: String,
    val displayName: String,
    val role: String,
    val alsoSells: Boolean = false,
    val avatarUrl: String? = null,
)

@Serializable
data class BootstrapOrganisation(
    val id: String,
    val name: String,
    val logoUrl: String? = null,
    val businessType: String? = null,
    val salesWorkflowPreset: String? = null,
    val clientMode: String? = null,
    val workspaceMode: String? = null,
    val assignmentMode: String? = null,
    val country: String? = null,
    val dialCode: String? = null,
    val responseTimeLimitHours: Double? = null,
)

@Serializable
data class BootstrapSubscription(
    val product: String? = null,
    val status: String = "UNKNOWN",
    val salesAccess: String = "ALLOWED",
)

@Serializable
data class BootstrapExperience(
    val id: String,
    val resolvedBy: String? = null,
    val homeVariant: String = "TEAM",
)

@Serializable
data class BootstrapCapabilities(
    val modules: List<String> = emptyList(),
    val permissions: List<String> = emptyList(),
    val featureFlags: FeatureFlags = FeatureFlags(),
    val restrictions: Restrictions = Restrictions(),
)

@Serializable
data class FeatureFlags(
    val realEstateWorkflow: Boolean = false,
    val solarWorkflow: Boolean = false,
    val demoWorkspace: Boolean = false,
    val realEstatePropertiesRead: Boolean = false,
    val realEstateBuyerSearchRead: Boolean = false,
    val privateListingImageDelivery: Boolean = false,
    val realEstateViewingsRead: Boolean = false,
    val realEstateViewingsWrite: Boolean = false,
    val realEstateOffers: Boolean = false,
    val realEstateTransactionsRead: Boolean = false,
    val realEstateTransactionsWrite: Boolean = false,
    val realEstateIntroductions: Boolean = false,
    val realEstateComplianceRead: Boolean = false,
    val salespersonCalendarRead: Boolean = false,
)

@Serializable
data class Restrictions(
    val salesOperations: String = "ALLOWED",
    val leadVisibility: String? = null,
    val leadModification: String? = null,
    val canManageCompanyProfile: Boolean = false,
    val quotationMarginVisibleToSalespeople: Boolean? = null,
    val quotationCostVisibleToSalespeople: Boolean? = null,
)

@Serializable
data class BootstrapNavigation(
    val home: String? = null,
    val primary: List<String> = emptyList(),
    val sections: List<NavSection> = emptyList(),
    val destinations: List<NavDestination> = emptyList(),
)

@Serializable
data class NavSection(val id: String, val label: String)

@Serializable
data class NavDestination(
    val id: String,
    val label: String,
    val shortLabel: String? = null,
    val section: String? = null,
    val placement: String? = null,
    val webPath: String? = null,
)

@Serializable
data class SalesConfiguration(
    val pipeline: PipelineConfig = PipelineConfig(),
    val timeZone: TimeZoneConfig = TimeZoneConfig(),
    val currency: CurrencyConfig = CurrencyConfig(),
)

@Serializable
data class PipelineConfig(
    val model: String? = null,
    val configurable: Boolean = false,
    val stages: List<PipelineStage> = emptyList(),
)

@Serializable
data class PipelineStage(val id: String, val label: String, val closed: Boolean = false)

@Serializable
data class TimeZoneConfig(
    val configured: String? = null,
    val effective: String = "UTC",
    val source: String? = null,
)

@Serializable
data class CurrencyConfig(
    val quotationDefault: String? = null,
    val supported: List<String> = emptyList(),
    val source: String? = null,
)
