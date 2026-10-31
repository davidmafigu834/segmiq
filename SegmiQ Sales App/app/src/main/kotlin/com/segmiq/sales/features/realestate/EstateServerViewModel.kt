package com.segmiq.sales.features.realestate

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.segmiq.sales.core.estate.*
import com.segmiq.sales.core.network.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.*

data class EstateLink(val resource: EstateResource, val id: String? = null, val buyerContext: String? = null, val sharedRoute: String? = null)
data class EstateServerCard(val link: EstateLink, val title: String, val subtitle: String,
    val status: String? = null, val listing: ListingDto? = null,
    val opensRecord: Boolean = true,
    val key: String = "${link.resource}:${link.id}:${link.buyerContext}:${link.sharedRoute}")
data class EstateServerPage(
    val heading: String,
    val summary: String = "",
    val cards: List<EstateServerCard> = emptyList(),
    val facts: List<Pair<String, String>> = emptyList(),
    val paragraphs: List<String> = emptyList(),
    val links: List<Pair<String, EstateLink>> = emptyList(),
    val listing: ListingDto? = null,
    val milestones: List<MilestoneDto> = emptyList(),
    val introduction: IntroductionDto? = null,
    val viewing: ViewingDto? = null,
    val buyer: BuyerSearchDto? = null,
    val offer: OfferSnapshotDto? = null,
    val transaction: TransactionSnapshotDto? = null,
    val dialPhone: String? = null,
    val hasNext: Boolean = false,
    val bounded: Boolean = false,
)
data class TransactionLookup(val loading: Boolean = false, val records: List<TransactionRowDto> = emptyList(),
    val checked: Boolean = false, val error: ApiError? = null)
data class BookingChoices(val properties: List<ListingDto> = emptyList(), val buyers: List<BuyerSearchDto> = emptyList(),
    val loading: Boolean = false, val error: ApiError? = null, val page: Int = 1, val more: Boolean = false)
data class EstateServerState(
    val page: EstateServerPage? = null, val loading: Boolean = false,
    val error: ApiError? = null, val pending: Boolean = false, val saved: Boolean = false,
)
/** Each VM belongs to one navigation entry and one authenticated scope. No durable private cache. */
class EstateServerViewModel(
    val repository: EstateRepository,
    val target: EstateLink,
) : ViewModel() {
    private val mutable = MutableStateFlow(EstateServerState())
    val transactionLookup = MutableStateFlow(TransactionLookup())
    val bookingChoices = MutableStateFlow(BookingChoices())
    val bookingReceipt = MutableStateFlow<ConfirmedActionDto?>(null)
    val createdRecord = MutableStateFlow<EstateLink?>(null)
    private var choiceJob: Job? = null
    private var transactionJob: Job? = null
    val state = mutable.asStateFlow()
    private var job: Job? = null
    private var pageNumber = 1
    private var query = ""
    private var status: String? = null
    var date: LocalDate = LocalDate.now(repository.workspace.zone)
        private set

    init { load() }
    fun selectDate(value: LocalDate) { date = value; pageNumber = 1; load() }
    fun search(value: String, filter: String? = status) { query = value; status = filter; pageNumber = 1; load() }
    fun nextPage() { if (!mutable.value.loading && mutable.value.page?.hasNext == true) { pageNumber++; load(append = true) } }

    fun load(append: Boolean = false) {
        if (mutable.value.pending) return
        job?.cancel()
        transactionJob?.cancel(); choiceJob?.cancel()
        transactionLookup.value = TransactionLookup()
        bookingChoices.value = BookingChoices()
        val previous = if (append) mutable.value.page else null
        val confirmed = mutable.value.saved
        mutable.value = EstateServerState(loading = true, saved = confirmed)
        job = viewModelScope.launch {
            val result = try { loadPage() } catch (_: IllegalArgumentException) {
                ApiResult.Failure(ApiError(ErrorKind.VALIDATION, "This record or filter is not valid."))
            }
            mutable.value = when (result) {
                is ApiResult.Failure -> {
                    if (result.error.kind == ErrorKind.FORBIDDEN || result.error.endsSession) bookingReceipt.value = null
                    EstateServerState(error = result.error, saved = confirmed)
                }
                is ApiResult.Success -> EstateServerState(saved = confirmed, page = if (previous == null) result.value
                    else result.value.copy(cards = (previous.cards + result.value.cards).distinctBy { it.key }))
            }
        }
    }
    private suspend fun loadPage(): ApiResult<EstateServerPage> {
        val r = repository
        val id = target.id
        return when (target.resource) {
            EstateResource.PROPERTIES -> if (id == null && target.buyerContext != null) r.matches(target.buyerContext).map { feed ->
                EstateServerPage("Matching properties", "Based on the buyer’s recorded requirements",
                    cards = feed.matches.mapNotNull { match -> match.listing?.let { l ->
                        listingCard(l, target.buyerContext).copy(subtitle = match.reasons.joinToString(" · "))
                    } }, bounded = feed.incomplete || feed.truncated, paragraphs = listOfNotNull(feed.notice))
            } else if (id == null) r.properties(query, pageNumber, status).map { feed ->
                EstateServerPage("Properties", "${feed.total} authorised listings · currency context: ${r.workspace.currencyCode ?: "not configured"}",
                    cards = feed.listings.map { listingCard(it, target.buyerContext) },
                    hasNext = feed.page.toLong() * feed.limit < feed.total)
            } else r.property(id).map { p ->
                EstateServerPage(p.listing.address ?: "Property", p.listing.suburb.orEmpty(), listing = p.listing,
                    facts = listingFacts(p.listing), paragraphs = listOfNotNull(p.listing.description),
                    links = listOfNotNull(target.buyerContext?.let { "Return to buyer requirements" to EstateLink(EstateResource.BUYERS, it) }))
            }
            EstateResource.BUYERS -> if (id == null) r.buyers(query, pageNumber).map { feed ->
                EstateServerPage("Buyers & tenants", "${feed.total} authorised searches", cards = feed.searches.map { b ->
                    EstateServerCard(EstateLink(EstateResource.BUYERS, b.id), b.contact_name ?: "Authorised buyer",
                        listOfNotNull(budget(b), b.locations.joinToString().ifBlank { null }, b.property_type).joinToString(" · "), b.status)
                }, hasNext = feed.page.toLong() * feed.pageSize < feed.total)
            } else r.buyer(id).map { b ->
                val phone = revealedPhone(b.search.phone) ?: revealedPhone(b.contact?.phone)
                EstateServerPage(b.contact?.name ?: b.search.contact_name ?: "Buyer requirements",
                    b.search.intent.orEmpty(), buyer = b.search, dialPhone = phone, facts = buyerFacts(b.search, phone),
                    paragraphs = listOfNotNull(b.search.notes, b.search.next_action_note),
                    links = listOf("Matching properties" to EstateLink(EstateResource.PROPERTIES, buyerContext = id)))
            }
            EstateResource.VIEWINGS -> if (id == null) r.viewings(pageNumber).map { f ->
                EstateServerPage("Viewings", "Schedule in ${f.timezone}", cards = f.viewings.map {
                    EstateServerCard(EstateLink(EstateResource.VIEWINGS, it.id), it.listing?.address ?: "Property viewing",
                        timestamp(it.scheduled_at), it.status, it.listing)
                }, hasNext = f.page.toLong() * f.limit < f.total, bounded = f.incomplete)
            } else r.viewing(id).map { d ->
                val v = d.viewing
                val viewingPhone = if (v.access == "full") revealedPhone(v.contact?.phone) else null
                EstateServerPage(v.listing?.address ?: "Viewing", timestamp(v.scheduled_at), listing = v.listing,
                    viewing = v, dialPhone = viewingPhone, facts = listOf("Status" to v.status, "Visible details" to if (v.access == "full") "Customer and property" else "Property only") +
                        listOfNotNull(if (v.access == "full") v.contact?.name?.let { "Customer" to it } else null) +
                        (if (v.access == "full") listOf("Phone" to (viewingPhone ?: "Not returned for your account.")) else emptyList()),
                    paragraphs = if (v.access == "full") listOfNotNull(v.instructions, v.feedback_text) else listOf("Buyer details are private."),
                    links = listOf("Property" to EstateLink(EstateResource.PROPERTIES, v.listing_id)) +
                        if (v.access == "full") listOfNotNull(v.buyer_search_id?.let { "Buyer requirements" to EstateLink(EstateResource.BUYERS, it) }) else emptyList())
            }
            EstateResource.INTRODUCTIONS -> if (id == null) r.introductions().map { f ->
                EstateServerPage("Introductions", "Received and sent collaboration", cards = f.items.filter {
                    query.isBlank() || (if (query == "Sent") it.ownRequest else !it.ownRequest)
                }.map { i -> EstateServerCard(EstateLink(EstateResource.INTRODUCTIONS, i.id), i.listingLabel,
                    "${if (i.ownRequest) "Sent" else "Received"} · ${i.requestingAgentName}", i.status) }, bounded = true)
            } else r.introduction(id).map { d ->
                val i = d.introduction
                val introPhone = revealedPhone(i.phone)
                EstateServerPage(i.listingLabel, i.status, introduction = i, dialPhone = introPhone,
                    facts = listOf("Requesting agent" to i.requestingAgentName, "Phone" to (introPhone ?: "Not disclosed.")) +
                        listOfNotNull(i.responsibleAgentName?.let { "Reviewing agent" to it }, i.contactName?.let { "Customer" to it }),
                    paragraphs = listOf(i.requirementsSummary) + i.matchReasons,
                    links = listOf("Property" to EstateLink(EstateResource.PROPERTIES, i.listingId)))
            }
            EstateResource.OFFERS -> if (id == null) r.offers(query).map { f ->
                EstateServerPage("Offers", "Authorised negotiation workspace", cards = f.offers.map { o ->
                    EstateServerCard(EstateLink(EstateResource.OFFERS, o.id), o.propertyLabel,
                        "${money(o.currentAmount, o.currency)} · ${o.nextActionLabel.orEmpty()}", o.statusLabel)
                }, bounded = !f.listCompleteness.exhaustive)
            } else r.offer(id).map { d ->
                EstateServerPage(d.listing?.address ?: "Offer", money(d.offer.current_offer_amount, d.offer.currency),
                    listing = d.listing, offer = d.offer, facts = listOf("Status" to d.offer.status, "Last updated" to timestamp(d.offer.updated_at)),
                    paragraphs = listOfNotNull(d.offer.conditions, d.offer.notes) + d.events.map { "${timestamp(it.createdAt)} · ${it.label}${it.note?.let { n -> " · $n" }.orEmpty()}" },
                    links = listOf("Property" to EstateLink(EstateResource.PROPERTIES, d.offer.listing_id)))
            }
            EstateResource.TRANSACTIONS -> if (id == null) r.transactions(query).map { f ->
                EstateServerPage("Transactions", "Server-defined sales progress", cards = f.rows.map { t ->
                    EstateServerCard(EstateLink(EstateResource.TRANSACTIONS, t.id), t.propertyLabel,
                        "${money(t.agreedPrice, t.currency)} · ${t.milestonesDone}/${t.milestonesTotal} milestones", t.statusLabel)
                }, bounded = !f.listCompleteness.exhaustive)
            } else r.transaction(id).map { d ->
                EstateServerPage(d.listing?.address ?: "Transaction", d.transaction.status, listing = d.listing,
                    milestones = d.milestones, transaction = d.transaction, paragraphs = listOfNotNull(d.transaction.notes),
                    links = listOf("Property" to EstateLink(EstateResource.PROPERTIES, d.transaction.listing_id)) +
                        listOfNotNull(d.transaction.offer_id?.let { "Related offer" to EstateLink(EstateResource.OFFERS, it) }))
            }
            EstateResource.CALENDAR -> {
                val zone = r.workspace.zone
                r.calendar(date.atStartOfDay(zone).toInstant(), date.plusDays(1).atStartOfDay(zone).toInstant(), pageNumber).map { f ->
                    EstateServerPage("Calendar", "${date} · ${f.timezone}", cards = f.events.distinctBy { it.id }.map { e ->
                        val destination = eventLink(e)
                        EstateServerCard(
                            destination ?: EstateLink(EstateResource.CALENDAR, e.id),
                            e.title,
                            listOf(eventTime(e, zone), e.type.replace('_', ' '), if (destination == null) "Read only" else null).filterNotNull().joinToString(" · "),
                            e.type, key = e.id, opensRecord = destination != null,
                        )
                    }, hasNext = f.page.toLong() * f.limit < f.total, bounded = f.incomplete,
                        paragraphs = listOfNotNull(f.completenessReason) + if (!f.standaloneMeetingsSupported)
                            listOf("Partial coverage · standalone meetings are not supported by this feed.") else emptyList())
                }
            }
            EstateResource.COMPLIANCE -> ApiResult.Failure(ApiError(ErrorKind.FORBIDDEN, "Compliance and protected documents require deployment and storage acceptance."))
        }
    }
    fun loadBookingChoices(propertyQuery: String = "", buyerQuery: String = "", page: Int = 1) {
        choiceJob?.cancel()
        bookingChoices.value = BookingChoices(loading = true)
        choiceJob = viewModelScope.launch {
            val properties = repository.properties(propertyQuery, page)
            val buyers = repository.buyers(buyerQuery, page)
            bookingChoices.value = if (properties is ApiResult.Success && buyers is ApiResult.Success)
                BookingChoices(properties = properties.value.listings, buyers = buyers.value.searches,
                    page = page, more = properties.value.page.toLong() * properties.value.limit < properties.value.total ||
                        buyers.value.page.toLong() * buyers.value.pageSize < buyers.value.total)
            else BookingChoices(error = ((properties as? ApiResult.Failure)?.error ?: (buyers as? ApiResult.Failure)?.error))
        }
    }
    fun findLinkedTransactions() {
        val offer = mutable.value.page?.offer ?: return
        if (offer.status != "accepted" || transactionLookup.value.loading) return
        transactionLookup.value = TransactionLookup(loading = true)
        transactionJob = viewModelScope.launch {
            when (val result = repository.transactions()) {
                is ApiResult.Success -> transactionLookup.value = TransactionLookup(
                    records = result.value.rows.filter { it.offerId == offer.id }, checked = true)
                is ApiResult.Failure -> {
                    transactionLookup.value = TransactionLookup(error = result.error)
                    if (result.error.kind in setOf(ErrorKind.FORBIDDEN, ErrorKind.SESSION_ENDED))
                        mutable.value = EstateServerState(error = result.error)
                }
            }
        }
    }
    fun saveRequirements(draft: RequirementsDraft) {
        val buyer = mutable.value.page?.buyer ?: return
        mutate {
            require(draft.errors().isEmpty())
            repository.updateRequirements(buyer.id, estateDecimal(draft.budgetMin), estateDecimal(draft.budgetMax),
            draft.locationValues(), draft.bedrooms.toIntOrNull(), BuyerRequirementDetails(
                draft.propertyType.ifBlank { null }, draft.bathrooms.toIntOrNull(), draft.features.ifBlank { null }, draft.notes.ifBlank { null }))
            .map { ConfirmedActionDto(ok = true) } }
    }
    fun submitBooking(searchId: String, listingId: String, at: Instant, instructions: String, key: String, confirmOverlap: Boolean = false) {
        bookingReceipt.value = null
        mutate {
            repository.scheduleViewing(searchId, listingId, at, instructions, key, confirmOverlap).also {
                if (it is ApiResult.Success && it.value.ok) bookingReceipt.value = it.value
            }
        }
    }
    fun reschedule(at: Instant, confirmOverlap: Boolean = false) {
        val viewing = mutable.value.page?.viewing ?: return
        bookingReceipt.value = null
        mutate {
            repository.rescheduleViewing(viewing, at, confirmOverlap).also {
                if (it is ApiResult.Success && it.value.ok) bookingReceipt.value = it.value
            }
        }
    }
    fun reviewIntroduction(decision: String, reason: String) {
        val row = mutable.value.page?.introduction ?: return
        mutate { repository.reviewIntroduction(row, decision, reason) }
    }
    fun completeViewing(outcome: String, note: String) {
        val row = mutable.value.page?.viewing ?: return
        mutate { repository.viewingOutcome(row, outcome, note) }
    }
    fun offerAction(action: String, amount: Decimal?, note: String) {
        val row = mutable.value.page?.offer ?: return
        mutate { repository.mutateOffer(row, action, amount, note).map { ConfirmedActionDto(ok = true) } }
    }
    fun transactionNote(note: String) {
        val row = mutable.value.page?.transaction ?: return
        mutate { repository.transactionNote(row, note).map { ConfirmedActionDto(ok = true) } }
    }
    private fun mutate(block: suspend () -> ApiResult<ConfirmedActionDto>) {
        if (mutable.value.pending) return
        mutable.update { it.copy(pending = true, error = null, saved = false) }
        viewModelScope.launch {
            val result = try { block() } catch (_: IllegalArgumentException) {
                ApiResult.Failure(ApiError(ErrorKind.VALIDATION, "Review the action and try again."))
            }
            if (result is ApiResult.Success && result.value.ok) {
                mutable.update { it.copy(pending = false, saved = true) }
                load()
            } else if (result is ApiResult.Failure && isOverlapConflict(result.error)) {
                mutable.update { it.copy(pending = false, error = result.error, saved = false) }
            } else if (result is ApiResult.Failure) {
                // A stale decision or denial cannot leave private stale content on the screen.
                choiceJob?.cancel(); transactionJob?.cancel()
                transactionLookup.value = TransactionLookup()
                bookingChoices.value = BookingChoices()
                bookingReceipt.value = null
                mutable.value = EstateServerState(error = result.error)
            } else {
                mutable.value = EstateServerState(error = ErrorMapper.decoding())
            }
        }
    }
    private fun listingCard(l: ListingDto, search: String?) = EstateServerCard(
        EstateLink(EstateResource.PROPERTIES, l.id, search), l.address ?: "Property", money(l.price, repository.workspace.currencyCode), l.status, l)
    private fun listingFacts(l: ListingDto) = listOfNotNull(l.status?.let { "Status" to it },
        l.transaction_type?.let { "Transaction" to it.replace('_', ' ') },
        l.property_category?.let { "Category" to it.replace('_', ' ') },
        l.price?.let { "Price (organisation currency context)" to money(it, repository.workspace.currencyCode) },
        l.bedrooms?.let { "Bedrooms" to "$it" }, l.bathrooms?.let { "Bathrooms" to "$it" },
        l.size_sqm?.let { "Size" to "${it.toPlainString()} m²" }, l.agent?.name?.let { "Listing agent" to it })
    fun clearCreated() { createdRecord.value = null }
    fun createListing(transactionType: String, address: String, suburb: String, description: String, price: String, bedrooms: String, bathrooms: String, size: String, category: String) =
        saveCreated(EstateResource.PROPERTIES) {
            repository.createListing(transactionType, address, suburb.ifBlank { null }, description.ifBlank { null },
                decimalOrNull(price), bedrooms.toIntOrNull(), bathrooms.toIntOrNull(), decimalOrNull(size), category.ifBlank { null })
                .map { it.listing.id }
        }
    fun updateListing(address: String, suburb: String, description: String, price: String, bedrooms: String, bathrooms: String, size: String, category: String) {
        val row = mutable.value.page?.listing ?: return
        saveCreated(EstateResource.PROPERTIES) {
            repository.updateListing(row, address, suburb.ifBlank { null }, description.ifBlank { null },
                decimalOrNull(price), bedrooms.toIntOrNull(), bathrooms.toIntOrNull(), decimalOrNull(size), category.ifBlank { null })
                .map { it.listing.id }
        }
    }
    fun createOffer(listingId: String, contactId: String, searchId: String?, amount: String, currency: String?, conditions: String, notes: String, submit: Boolean) =
        saveCreated(EstateResource.OFFERS) {
            repository.createOffer(listingId, contactId, searchId, requireNotNull(decimalOrNull(amount)), currency, conditions.ifBlank { null }, notes.ifBlank { null }, submit)
                .map { it.offer.id }
        }
    fun requestIntroduction(listingId: String, searchId: String) = saveCreated(EstateResource.INTRODUCTIONS) {
        repository.requestIntroduction(listingId, searchId).map { it.introduction.id }
    }
    private fun saveCreated(resource: EstateResource, block: suspend () -> ApiResult<String>) {
        if (mutable.value.pending) return
        mutable.update { it.copy(pending = true, error = null, saved = false) }
        viewModelScope.launch {
            val result = try { block() } catch (_: IllegalArgumentException) {
                ApiResult.Failure(ApiError(ErrorKind.VALIDATION, "Review the form and try again."))
            }
            when (result) {
                is ApiResult.Success -> {
                    mutable.update { it.copy(pending = false, saved = true) }
                    createdRecord.value = EstateLink(resource, result.value)
                }
                is ApiResult.Failure -> mutable.update { it.copy(pending = false, error = result.error) }
            }
        }
    }
    private fun buyerFacts(b: BuyerSearchDto, phone: String?) = listOf(
        "Phone" to (phone ?: "Not returned for your account."),
    ) + listOfNotNull(budget(b)?.let { "Budget" to it },
        b.locations.takeIf { it.isNotEmpty() }?.let { "Preferred locations" to it.joinToString() },
        b.property_type?.let { "Property type" to it }, b.features?.let { "Features" to it },
        b.bedrooms?.let { "Bedrooms" to "$it" }, b.bathrooms?.let { "Bathrooms" to "$it" },
        b.agent_name?.let { "Assigned agent" to it }, b.next_action_at?.let { "Next action" to timestamp(it) })
    private fun timestamp(s: String) = runCatching {
        Instant.parse(s).atZone(repository.workspace.zone).format(java.time.format.DateTimeFormatter.ofPattern("EEE d MMM, HH:mm"))
    }.getOrDefault("Time unavailable")
}
fun money(value: Decimal?, currency: String?): String = value?.let { "${currency ?: "Currency not configured"} ${it.toPlainString()}" } ?: "Price not provided"
private fun budget(b: BuyerSearchDto): String? = if (b.budget_min == null && b.budget_max == null) null
    else "${b.currency ?: "Currency not configured"} ${b.budget_min?.toPlainString() ?: "—"} – ${b.budget_max?.toPlainString() ?: "—"}"
fun eventTime(e: CalendarEventDto, zone: ZoneId): String = if (e.allDay)
    e.date?.let { runCatching { LocalDate.parse(it).toString() }.getOrNull() }?.let { "$it · All day" } ?: "Date unavailable"
else e.startAt?.let { runCatching { Instant.parse(it).atZone(zone).toLocalTime().toString() }.getOrNull() } ?: "Time unavailable"
fun revealedPhone(value: String?): String? = value?.trim()?.takeIf { it.isNotEmpty() }
fun isOverlapConflict(error: ApiError) = error.kind == ErrorKind.CONFLICT &&
    (error.message.contains("90 minutes") || error.message.contains("Confirm only if"))
private fun decimalOrNull(raw: String): Decimal? = raw.trim().takeIf { it.isNotEmpty() }?.let { Decimal(it) }
fun eventLink(e: CalendarEventDto): EstateLink? {
    val id = e.relatedEntity.id
    if (id.isBlank() || id.startsWith("demo-")) return null
    val encoded = java.net.URLEncoder.encode(id, "UTF-8").replace("+", "%20")
    return when (e.relatedEntity.type.lowercase()) {
        "viewing" -> EstateLink(EstateResource.VIEWINGS, id)
        "lead" -> EstateLink(EstateResource.CALENDAR, sharedRoute = "live/lead/$encoded")
        "listing", "property" -> EstateLink(EstateResource.PROPERTIES, id)
        "offer" -> EstateLink(EstateResource.OFFERS, id)
        "introduction" -> EstateLink(EstateResource.INTRODUCTIONS, id)
        "transaction" -> EstateLink(EstateResource.TRANSACTIONS, id)
        "buyer_search", "buyer" -> EstateLink(EstateResource.BUYERS, id)
        else -> null
    }
}
