@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package com.segmiq.sales.core.estate

import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.network.*
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.*
import java.time.Instant
import java.util.UUID

/** Scoped to one authenticated workspace, contains no cache, fixtures or independent HTTP stack. */
class EstateRepository(
    private val http: SegmiqHttp,
    val workspace: LiveWorkspace,
    val access: EstateAccess = EstateAccess(workspace, http.config.baseUrl),
) {
    /** Stable through rotation; a changed scope, origin or bootstrap invalidates protected UI state. */
    val stateKey: String = java.security.MessageDigest.getInstance("SHA-256").digest(
        (workspace.scope.toString() + http.config.baseUrl.toString() +
            SegmiqJson.encodeToString(com.segmiq.sales.core.bootstrap.SalesAppBootstrap.serializer(), workspace.bootstrap))
            .toByteArray(Charsets.UTF_8)
    ).joinToString("") { (it.toInt() and 255).toString(16).padStart(2, '0') }
    private val prefix get() = "/api/clients/${segment(workspace.scope.organisationId)}"
    private fun segment(id: String): String {
        require(id.isNotBlank() && id !in setOf(".", "..") && id.length <= 200 && id.none { it in "/?#%\\" }) { "Invalid record identifier" }
        require(!id.startsWith("demo-")) { "Fictional records cannot be used in live requests" }
        return id
    }
    private fun blocked(resource: EstateResource, write: Boolean): ApiResult.Failure? {
        val reason = if (!access.bindsTo(http.config.baseUrl)) "This mobile release does not match your server."
            else access.reason(resource, write)
        return reason?.let { ApiResult.Failure(ApiError(ErrorKind.FORBIDDEN, it, code = "MOBILE_RELEASE_UNVERIFIED")) }
    }
    private suspend fun <T> get(resource: EstateResource, path: String, serializer: DeserializationStrategy<T>,
        query: Map<String, String?> = emptyMap()): ApiResult<T> =
        blocked(resource, false) ?: http.request(HttpMethod.GET, path, serializer, query = query)

    private fun <T> scoped(result: ApiResult<T>, valid: (T) -> Boolean): ApiResult<T> = when (result) {
        is ApiResult.Failure -> result
        is ApiResult.Success -> if (valid(result.value)) result else ApiResult.Failure(
            ApiError(ErrorKind.FORBIDDEN, "This response does not belong to your workspace.", code = "SCOPE_MISMATCH"))
    }
    private fun owns(client: String?) = client == null || client == workspace.scope.organisationId

    suspend fun properties(query: String = "", page: Int = 1, status: String? = null,
        transactionType: String? = null): ApiResult<ListingsDto> {
        require(page in 1..100000)
        return scoped(get(EstateResource.PROPERTIES, "$prefix/listings", ListingsDto.serializer(),
            mapOf("q" to query.trim().ifEmpty { null }, "page" to page.toString(), "limit" to "20",
                "status" to status, "transaction_type" to transactionType))) { r ->
            r.page == page && r.limit > 0 && r.total >= 0 && r.listings.all { owns(it.client_id) }
        }
    }
    suspend fun property(id: String) = scoped(get(EstateResource.PROPERTIES,
        "$prefix/listings/${segment(id)}", ListingDetailDto.serializer())) { it.listing.id == id && owns(it.listing.client_id) }

    suspend fun buyers(query: String = "", page: Int = 1): ApiResult<BuyersDto> {
        require(page in 1..100000)
        return scoped(get(EstateResource.BUYERS, "$prefix/buyer-searches", BuyersDto.serializer(),
            mapOf("q" to query.trim().ifEmpty { null }, "page" to page.toString()))) {
            it.page == page && it.pageSize > 0 && it.searches.all { row -> owns(row.client_id) }
        }
    }
    suspend fun buyer(id: String) = scoped(get(EstateResource.BUYERS,
        "$prefix/buyer-searches/${segment(id)}", BuyerDetailDto.serializer())) { it.search.id == id && owns(it.search.client_id) }
    suspend fun matches(searchId: String) = scoped(get(EstateResource.BUYERS, "$prefix/matching", MatchesDto.serializer(),
        mapOf("searchId" to segment(searchId)))) { r -> r.matches.all { it.listing?.let { l -> owns(l.client_id) && l.id == it.listingId } ?: true } }

    private fun validViewing(row: ViewingDto): Boolean =
        row.access in setOf("full", "listing_only") &&
            (row.listing == null || (owns(row.listing.client_id) && row.listing.id == row.listing_id)) &&
            (row.access == "full" || (row.contact_id == null && row.buyer_search_id == null &&
                row.contact == null && row.instructions == null && row.feedback_text == null))
    suspend fun viewings(page: Int = 1, from: Instant? = null, to: Instant? = null): ApiResult<ViewingsDto> {
        require(page > 0)
        return scoped(get(EstateResource.VIEWINGS, "$prefix/viewings", ViewingsDto.serializer(),
            mapOf("page" to page.toString(), "limit" to "40", "from" to from?.toString(), "to" to to?.toString()))) {
            it.page == page && it.viewings.all(::validViewing)
        }
    }
    suspend fun viewing(id: String) = scoped(get(EstateResource.VIEWINGS,
        "$prefix/viewings/${segment(id)}", ViewingDetailDto.serializer())) { it.viewing.id == id && validViewing(it.viewing) }
    suspend fun introductions() = get(EstateResource.INTRODUCTIONS,
        "$prefix/buyer-sales/introductions", IntroductionsDto.serializer())
    suspend fun introduction(id: String) = scoped(get(EstateResource.INTRODUCTIONS,
        "$prefix/buyer-sales/introductions/${segment(id)}", IntroductionDetailDto.serializer())) { it.introduction.id == id }
    suspend fun offers(query: String = "", listingId: String? = null) = get(EstateResource.OFFERS,
        "$prefix/offers", OffersDto.serializer(), mapOf("q" to query.ifBlank { null }, "listing_id" to listingId?.let(::segment)))
    suspend fun offer(id: String) = scoped(get(EstateResource.OFFERS, "$prefix/offers/${segment(id)}",
        OfferDetailDto.serializer())) { it.offer.id == id && owns(it.offer.client_id) }
    suspend fun transactions(query: String = "") = get(EstateResource.TRANSACTIONS, "$prefix/transactions",
        TransactionsDto.serializer(), mapOf("q" to query.ifBlank { null }))
    suspend fun transaction(id: String) = scoped(get(EstateResource.TRANSACTIONS,
        "$prefix/transactions/${segment(id)}", TransactionDetailDto.serializer())) { it.transaction.id == id && owns(it.transaction.client_id) }
    suspend fun calendar(from: Instant, to: Instant, page: Int = 1): ApiResult<CalendarDto> {
        require(to > from && java.time.Duration.between(from, to) <= java.time.Duration.ofDays(93))
        return get(EstateResource.CALENDAR, "/api/sales/calendar", CalendarDto.serializer(),
            mapOf("from" to from.toString(), "to" to to.toString(), "page" to page.toString(), "limit" to "100"))
    }
    /** Endpoint paths in JSON are descriptive; never execute them or arbitrary absolute URLs. */
    suspend fun image(listingId: String, index: Int): ApiResult<SignedImageDto> {
        if (index < 0 || access.imageHost() == null) return ApiResult.Failure(
            ApiError(ErrorKind.FORBIDDEN, "Private property photography is awaiting storage verification."))
        return get(EstateResource.PROPERTIES, "$prefix/listings/${segment(listingId)}/images/$index", SignedImageDto.serializer())
    }

    suspend fun updateRequirements(searchId: String, min: Decimal?, max: Decimal?, locations: List<String>, bedrooms: Int?, details: BuyerRequirementDetails? = null): ApiResult<BuyerDetailDto> {
        blocked(EstateResource.BUYERS, true)?.let { return it }
        require(min == null || min.signum() >= 0); require(max == null || max.signum() >= 0)
        require(min == null || max == null || min <= max)
        require(bedrooms == null || bedrooms in 0..100); require(locations.size <= 12 && locations.all { it.trim().length in 1..120 })
        details?.let {
            require(it.bathrooms == null || it.bathrooms in 0..100)
            require((it.propertyType?.length ?: 0) <= 100 && (it.features?.length ?: 0) <= 2000 && (it.notes?.length ?: 0) <= 5000)
        }
        val body = buildJsonObject {
            put("budgetMin", min?.let(::JsonPrimitive) ?: JsonNull)
            put("budgetMax", max?.let(::JsonPrimitive) ?: JsonNull)
            putJsonArray("locations") { locations.forEach { add(it.trim()) } }
            put("bedrooms", bedrooms?.let(::JsonPrimitive) ?: JsonNull)
            details?.let {
                put("propertyType", it.propertyType?.let(::JsonPrimitive) ?: JsonNull)
                put("bathrooms", it.bathrooms?.let(::JsonPrimitive) ?: JsonNull)
                put("features", it.features?.let(::JsonPrimitive) ?: JsonNull)
                put("notes", it.notes?.let(::JsonPrimitive) ?: JsonNull)
            }
        }
        // Do not blindly replay a mutation. PATCH confirms a search; detail is fetched separately.
        val saved = http.request(HttpMethod.PATCH, "$prefix/buyer-searches/${segment(searchId)}",
            BuyerDetailDto.serializer(), body = body, retries = 0)
        return scoped(saved) { it.search.id == searchId && owns(it.search.client_id) }
    }
    suspend fun reviewIntroduction(row: IntroductionDto, decision: String, reason: String): ApiResult<ConfirmedActionDto> {
        blocked(EstateResource.INTRODUCTIONS, true)?.let { return it }
        require(decision in setOf("accepted", "declined"))
        require(!row.ownRequest && row.status == "requested")
        require(if (decision == "accepted") row.canApprove else row.canDecline)
        require(reason.length <= 500 && (decision != "declined" || reason.isNotBlank()))
        return action(EstateResource.INTRODUCTIONS, buildJsonObject {
            put("action", "review_introduction"); put("introductionId", segment(row.id))
            put("decision", decision); put("decisionReason", reason.trim())
        })
    }
    suspend fun scheduleViewing(searchId: String, listingId: String, at: Instant, instructions: String,
        idempotencyKey: String, confirmOverlap: Boolean, now: Instant = Instant.now()): ApiResult<ConfirmedActionDto> {
        blocked(EstateResource.VIEWINGS, true)?.let { return it }
        require(at > now && instructions.length <= 2000)
        UUID.fromString(searchId); UUID.fromString(listingId)
        return action(EstateResource.VIEWINGS, buildJsonObject {
            put("action", "viewing"); put("searchId", searchId); put("listingId", listingId)
            put("scheduledAt", at.toString()); put("instructions", instructions)
            put("confirmOverlap", confirmOverlap)
        }, idempotencyKey)
    }
    suspend fun rescheduleViewing(row: ViewingDto, at: Instant, confirmOverlap: Boolean): ApiResult<ConfirmedActionDto> {
        blocked(EstateResource.VIEWINGS, true)?.let { return it }
        require("reschedule_viewing" in row.permittedActions && row.access == "full" && at > Instant.now())
        return action(EstateResource.VIEWINGS, buildJsonObject {
            put("action", "reschedule_viewing"); put("viewingId", segment(row.id))
            put("scheduledAt", at.toString()); put("confirmOverlap", confirmOverlap)
        })
    }
    suspend fun viewingOutcome(row: ViewingDto, outcome: String, note: String): ApiResult<ConfirmedActionDto> {
        blocked(EstateResource.VIEWINGS, true)?.let { return it }
        require(row.access == "full" && "viewing_outcome" in row.permittedActions)
        require(outcome in VIEWING_OUTCOMES && note.length <= 2000)
        return action(EstateResource.VIEWINGS, buildJsonObject {
            put("action", "viewing_outcome"); put("viewingId", segment(row.id)); put("outcome", outcome); put("note", note)
        })
    }
    /** Revision-protected decisions; no retries or separate notification request. */
    suspend fun mutateOffer(row: OfferSnapshotDto, action: String, amount: Decimal? = null, note: String = ""): ApiResult<OfferMutationDto> {
        blocked(EstateResource.OFFERS, true)?.let { return it }
        require(owns(row.client_id) && action in row.permittedActions)
        require(action in setOf("submit", "counter", "accept", "reject", "withdraw", "note"))
        require(note.length <= 2000)
        if (action == "counter") require(amount != null && amount.signum() > 0)
        Instant.parse(row.updated_at)
        return scoped(http.request(HttpMethod.PATCH, "$prefix/offers/${segment(row.id)}",
            OfferMutationDto.serializer(), retries = 0, body = buildJsonObject {
                put("action", action); put("expected_updated_at", row.updated_at)
                if (action == "counter") put("amount", JsonPrimitive(amount!!))
                if (note.isNotBlank()) {
                    put("note", note.trim())
                    if (action == "reject" || action == "withdraw") put("reason", note.trim())
                }
            })) { it.offer.id == row.id && owns(it.offer.client_id) }
    }
    /** Non-financial edit only. Financial/completion transitions deliberately have no adapter. */
    suspend fun transactionNote(row: TransactionSnapshotDto, note: String): ApiResult<TransactionMutationDto> {
        blocked(EstateResource.TRANSACTIONS, true)?.let { return it }
        require(owns(row.client_id) && "update_notes" in row.permittedActions && note.length <= 5000)
        Instant.parse(row.updated_at)
        return scoped(http.request(HttpMethod.PATCH, "$prefix/transactions/${segment(row.id)}",
            TransactionMutationDto.serializer(), retries = 0, body = buildJsonObject {
                put("action", "update_notes"); put("expected_updated_at", row.updated_at); put("notes", note)
            })) { it.transaction.id == row.id && owns(it.transaction.client_id) }
    }

    suspend fun createListing(
        transactionType: String, address: String, suburb: String?, description: String?,
        price: Decimal?, bedrooms: Int?, bathrooms: Int?, sizeSqm: Decimal?, propertyCategory: String?,
    ): ApiResult<ListingCreatedDto> {
        blocked(EstateResource.PROPERTIES, true)?.let { return it }
        require(transactionType in LISTING_TRANSACTION_TYPES)
        require(address.isNotBlank() && address.length <= 500)
        require(suburb == null || suburb.length <= 200)
        require(description == null || description.length <= 5000)
        require(price == null || price.signum() >= 0)
        require(bedrooms == null || bedrooms >= 0)
        require(bathrooms == null || bathrooms >= 0)
        require(sizeSqm == null || sizeSqm.signum() >= 0)
        require(propertyCategory == null || propertyCategory in LISTING_CATEGORIES)
        return http.request(HttpMethod.POST, "$prefix/listings", ListingCreatedDto.serializer(), retries = 0, body = listingBody(
            transactionType, address, suburb, description, price, bedrooms, bathrooms, sizeSqm, propertyCategory))
    }

    suspend fun updateListing(
        row: ListingDto, address: String, suburb: String?, description: String?,
        price: Decimal?, bedrooms: Int?, bathrooms: Int?, sizeSqm: Decimal?, propertyCategory: String?,
    ): ApiResult<ListingCreatedDto> {
        blocked(EstateResource.PROPERTIES, true)?.let { return it }
        require(row.permittedActions.edit && owns(row.client_id))
        require(address.isNotBlank() && address.length <= 500)
        return http.request(HttpMethod.PATCH, "$prefix/listings/${segment(row.id)}", ListingCreatedDto.serializer(), retries = 0,
            body = listingBody(row.transaction_type, address, suburb, description, price, bedrooms, bathrooms, sizeSqm, propertyCategory))
    }

    suspend fun createOffer(
        listingId: String, contactId: String, buyerSearchId: String?, amount: Decimal, currency: String?,
        conditions: String?, notes: String?, submit: Boolean,
    ): ApiResult<OfferCreatedDto> {
        blocked(EstateResource.OFFERS, true)?.let { return it }
        UUID.fromString(listingId); UUID.fromString(contactId)
        buyerSearchId?.let { UUID.fromString(it) }
        require(amount.signum() > 0 && (currency == null || currency.length == 3))
        require(conditions == null || conditions.length <= 5000)
        require(notes == null || notes.length <= 5000)
        return http.request(HttpMethod.POST, "$prefix/offers", OfferCreatedDto.serializer(), retries = 0, body = buildJsonObject {
            put("listing_id", listingId); put("contact_id", contactId)
            buyerSearchId?.let { put("buyer_search_id", it) }
            put("amount", JsonUnquotedLiteral(amount.toPlainString()))
            currency?.let { put("currency", it) }
            conditions?.takeIf { it.isNotBlank() }?.let { put("conditions", it.trim()) }
            notes?.takeIf { it.isNotBlank() }?.let { put("notes", it.trim()) }
            put("submit", submit)
        })
    }

    suspend fun requestIntroduction(listingId: String, searchId: String): ApiResult<IntroductionCreatedDto> {
        blocked(EstateResource.INTRODUCTIONS, true)?.let { return it }
        UUID.fromString(listingId); UUID.fromString(searchId)
        return http.request(HttpMethod.POST, "$prefix/buyer-sales/actions", IntroductionCreatedDto.serializer(), retries = 0,
            body = buildJsonObject { put("action", "introduction"); put("listingId", listingId); put("searchId", searchId) })
    }

    private fun listingBody(
        transactionType: String?, address: String, suburb: String?, description: String?,
        price: Decimal?, bedrooms: Int?, bathrooms: Int?, sizeSqm: Decimal?, propertyCategory: String?,
    ) = buildJsonObject {
        transactionType?.let { put("transaction_type", it) }
        put("address", address.trim())
        suburb?.takeIf { it.isNotBlank() }?.let { put("suburb", it.trim()) }
        description?.takeIf { it.isNotBlank() }?.let { put("description", it.trim()) }
        price?.let { put("price", JsonUnquotedLiteral(it.toPlainString())) }
        bedrooms?.let { put("bedrooms", it) }
        bathrooms?.let { put("bathrooms", it) }
        sizeSqm?.let { put("size_sqm", JsonUnquotedLiteral(it.toPlainString())) }
        propertyCategory?.let { put("property_category", it) }
    }

    private suspend fun action(resource: EstateResource, body: JsonObject, key: String? = null): ApiResult<ConfirmedActionDto> =
        blocked(resource, true) ?: http.request(HttpMethod.POST, "$prefix/buyer-sales/actions",
            ConfirmedActionDto.serializer(), body = body, retries = 0, idempotencyKey = key)
}
val LISTING_TRANSACTION_TYPES = setOf("sale", "rental", "new_development", "property_management")
val LISTING_CATEGORIES = setOf("house", "apartment", "townhouse", "residential_stand", "commercial", "industrial", "agricultural", "other")
val VIEWING_OUTCOMES = setOf("interested", "considering", "second_viewing", "wants_offer", "too_expensive",
    "location_unsuitable", "condition", "not_interested", "no_show")
