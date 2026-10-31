package com.segmiq.sales.core.estate

import com.segmiq.sales.core.bootstrap.*
import okhttp3.HttpUrl

/** Source contracts are implemented; rollout acceptance is a separate, reviewed release input. */
enum class EstateResource(val module: LiveModule, val label: String) {
    PROPERTIES(LiveModule.PROPERTIES, "Properties"),
    BUYERS(LiveModule.BUYERS_TENANTS, "Buyers"),
    VIEWINGS(LiveModule.VIEWINGS, "Viewings"),
    INTRODUCTIONS(LiveModule.INTRODUCTIONS, "Introductions"),
    OFFERS(LiveModule.OFFERS, "Offers"),
    TRANSACTIONS(LiveModule.TRANSACTIONS, "Transactions"),
    CALENDAR(LiveModule.ACTIVITIES, "Calendar"),
    COMPLIANCE(LiveModule.TRANSACTIONS, "Compliance"),
}
data class EstateAcceptance(
    val origin: String,
    val revision: String,
    val reads: Set<EstateResource>,
    val writes: Set<EstateResource> = emptySet(),
    val privateImageHost: String? = null,
    /** Roles independently verified for this origin and revision. Unknown roles stay closed. */
    val roles: Set<String> = setOf("SALESPERSON", "CLIENT_MANAGER"),
)
/**
 * Phase 6 read release for the revision observed at https://www.segmiq.com on 2026-10-31.
 * Bound to that exact origin, contract 1, salesperson role and read operations whose
 * deployed responses matched the Android contracts. Writes, compliance and private images
 * are absent: image delivery was false and image metadata returned IMAGE_UNAVAILABLE.
 * A different revision, origin or role does not inherit this approval.
 */
val acceptedEstateReleases: List<EstateAcceptance> = listOf(
    EstateAcceptance(
        origin = "https://www.segmiq.com:443",
        revision = "7e743eb43fd2995636c8b2f7133d606a1d2c3cb6",
        reads = setOf(
            EstateResource.PROPERTIES,
            EstateResource.BUYERS,
            EstateResource.VIEWINGS,
            EstateResource.INTRODUCTIONS,
            EstateResource.OFFERS,
            EstateResource.TRANSACTIONS,
            EstateResource.CALENDAR,
        ),
        roles = setOf("SALESPERSON"),
    ),
)

class EstateAccess(
    private val workspace: LiveWorkspace,
    private val origin: HttpUrl,
    private val accepted: List<EstateAcceptance> = acceptedEstateReleases,
) {
    fun bindsTo(url: HttpUrl): Boolean = origin.scheme == url.scheme && origin.host == url.host && origin.port == url.port

    private fun evidence(): EstateAcceptance? {
        val release = workspace.bootstrap.release ?: return null
        if (release.contractVersion != 1 || release.revision.isNullOrBlank()) return null
        val exactOrigin = "${origin.scheme}://${origin.host}:${origin.port}"
        return accepted.firstOrNull { it.origin == exactOrigin && it.revision == release.revision }
    }

    fun reason(resource: EstateResource, write: Boolean = false): String? {
        if (workspace.experience != Experience.REAL_ESTATE || gateFor(workspace.bootstrap) != WorkspaceGate.Open ||
            workspace.bootstrap.subscription.salesAccess != "ALLOWED" ||
            workspace.bootstrap.capabilities.restrictions.salesOperations != "ALLOWED" ||
            workspace.bootstrap.user.role !in setOf("SALESPERSON", "CLIENT_MANAGER"))
            return "This operation is not available for your workspace."
        val b = workspace.bootstrap
        val f = b.capabilities.featureFlags
        val entitled = if (resource == EstateResource.COMPLIANCE)
            f.realEstateComplianceRead && "compliance.read" in b.capabilities.permissions
        else workspace.navigation.allows(resource.module)
        if (!entitled) return "Your organisation has not granted access to this module."
        val flag = when (resource) {
            EstateResource.PROPERTIES -> f.realEstatePropertiesRead
            EstateResource.BUYERS -> f.realEstateBuyerSearchRead
            EstateResource.VIEWINGS -> if (write) f.realEstateViewingsWrite else f.realEstateViewingsRead
            EstateResource.INTRODUCTIONS -> f.realEstateIntroductions
            EstateResource.OFFERS -> f.realEstateOffers
            EstateResource.TRANSACTIONS -> if (write) f.realEstateTransactionsWrite else f.realEstateTransactionsRead
            EstateResource.CALENDAR -> f.salespersonCalendarRead && !write
            EstateResource.COMPLIANCE -> f.realEstateComplianceRead
        }
        if (!flag) return "This server has not enabled the mobile contract for this module."
        val e = evidence()
        if (e == null || workspace.bootstrap.user.role !in e.roles || resource !in e.reads || (write && resource !in e.writes))
            return "Mobile access is waiting for deployed security verification. No records have been requested."
        return null
    }
    fun imageHost(): String? = if (reason(EstateResource.PROPERTIES) == null &&
        workspace.bootstrap.capabilities.featureFlags.privateListingImageDelivery) evidence()?.privateImageHost else null
}
