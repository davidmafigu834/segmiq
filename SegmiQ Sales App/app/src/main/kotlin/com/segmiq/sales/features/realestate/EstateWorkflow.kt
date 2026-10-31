package com.segmiq.sales.features.realestate

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.*

/** Fictional UI workspace only. No API, token, authenticated identity or production record enters it. */
data class EstateProperty(val id: String, val address: String, val suburb: String, val price: Double,
    val bedrooms: Int, val bathrooms: Int, val size: Int, val description: String)
data class EstateBuyer(val id: String, val name: String, val intent: String, val budget: java.math.BigDecimal?,
    val location: String, val bedrooms: Int?, val owner: String = "demo-agent", val notes: List<String> = emptyList(),
    val budgetMin: java.math.BigDecimal? = null, val bathrooms: Int? = null, val propertyType: String? = null,
    val features: String = "", val requirementsNotes: String = "")
data class EstateViewing(val id: String, val propertyId: String, val buyerId: String, val at: Instant,
    val location: String, val notes: String, val status: String = "scheduled", val outcome: String? = null)
data class EstateOffer(val id: String, val propertyId: String, val buyerId: String, val amount: java.math.BigDecimal,
    val conditions: String, val status: String = "draft", val history: List<String> = listOf("Draft created"))
data class EstateIntroduction(val id: String, val propertyId: String, val buyerId: String,
    val requester: String, val reviewer: String, val status: String = "pending", val reason: String = "")
data class EstateMilestone(val id: String, val label: String, val status: String = "pending")
data class EstateDocument(val id: String, val title: String, val status: String, val reason: String? = null)
data class EstateTransaction(val id: String, val offerId: String, val propertyId: String, val buyerId: String,
    val status: String, val milestones: List<EstateMilestone>, val documents: List<EstateDocument>)
data class EstateCommitment(val id: String, val buyerId: String, val title: String, val date: LocalDate, val done: Boolean = false)
data class EstateDemoState(
    val properties: List<EstateProperty>, val buyers: List<EstateBuyer>, val viewings: List<EstateViewing>,
    val offers: List<EstateOffer>, val introductions: List<EstateIntroduction>, val transactions: List<EstateTransaction>,
    val commitments: List<EstateCommitment> = emptyList(), val busy: Boolean = false,
    val error: String? = null, val message: String? = null, val failNext: Boolean = false,
    val completedIntents: Map<String, String> = emptyMap(),
)

/** Mutations are serial and confirmed before state changes. Process death discards this fictional session. */
class EstateDemoViewModel(initial: EstateDemoState = estateFixtures()) : ViewModel() {
    private val _state = MutableStateFlow(initial)
    val state = _state.asStateFlow()
    val zone: ZoneId = ZoneId.of("Africa/Harare")
    private fun id(prefix: String) = "demo-$prefix-${java.util.UUID.randomUUID()}"

    fun failNext() = _state.update { it.copy(failNext = true, message = "The next demo save will fail. No server is contacted.") }
    fun clearFeedback() = _state.update { it.copy(error = null, message = null) }
    private fun save(change: (EstateDemoState) -> EstateDemoState) {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, error = null, message = null) }
        viewModelScope.launch {
            delay(250)
            val before = _state.value
            if (before.failNext) {
                _state.update { it.copy(busy = false, failNext = false, error = "Demo save failed. Your changes were not applied. Try again.") }
            } else {
                try { _state.value = change(before).copy(busy = false, message = "Saved in this fictional demo only.") }
                catch (e: IllegalArgumentException) { _state.update { it.copy(busy = false, error = e.message) } }
            }
        }
    }
    fun schedule(propertyId: String, buyerId: String, at: Instant, location: String, notes: String, viewingId: String? = null,
        intentKey: String = java.util.UUID.randomUUID().toString(), confirmOverlap: Boolean = false, expectedAt: Instant? = null) = save { s ->
        if (s.completedIntents.containsKey(intentKey)) return@save s
        if (viewingId != null) require(s.viewings.any { it.id == viewingId && it.status == "scheduled" && (expectedAt == null || it.at == expectedAt) }) { "This viewing changed. Reopen it before rescheduling." }
        val overlaps = s.viewings.any { it.id != viewingId && it.status == "scheduled" && java.time.Duration.between(it.at, at).abs() < java.time.Duration.ofMinutes(30) }
        require(!overlaps || confirmOverlap) { "This time overlaps another fictional viewing. Review the warning before confirming." }
        require(s.properties.any { it.id == propertyId }) { "Choose a property." }
        require(s.buyers.any { it.id == buyerId && it.owner == "demo-agent" }) { "Choose a buyer assigned to you." }
        require(at.isAfter(Instant.now())) { "Choose a future date and time." }
        require(location.isNotBlank()) { "Enter a meeting location." }
        val row = EstateViewing(viewingId ?: id("viewing"), propertyId, buyerId, at, location.trim(), notes.trim())
        s.copy(viewings = if (viewingId == null) s.viewings + row else s.viewings.map { if (it.id == viewingId) row else it },
            completedIntents = s.completedIntents + (intentKey to row.id))
    }
    fun completeViewing(viewingId: String, feedback: String, outcome: String = "interested") = save { s ->
        require(outcome in com.segmiq.sales.core.estate.VIEWING_OUTCOMES) { "Choose a supported viewing outcome." }
        require(feedback.isNotBlank()) { "Add viewing feedback first." }
        require(s.viewings.any { it.id == viewingId && it.status == "scheduled" }) { "This viewing has already changed." }
        s.copy(viewings = s.viewings.map { if (it.id == viewingId) it.copy(status = "completed", notes = feedback.trim(), outcome = outcome) else it })
    }
    fun cancelViewing(viewingId: String) = save { s ->
        s.copy(viewings = s.viewings.map { if (it.id == viewingId && it.status == "scheduled") it.copy(status = "cancelled") else it })
    }
    fun addNote(buyerId: String, note: String) = save { s ->
        require(note.isNotBlank()) { "Write a note first." }
        require(s.buyers.any { it.id == buyerId && it.owner == "demo-agent" }) { "This buyer isn't available." }
        s.copy(buyers = s.buyers.map { if (it.id == buyerId) it.copy(notes = it.notes + note.trim()) else it })
    }
    fun followUp(buyerId: String, title: String, date: LocalDate) = save { s ->
        require(s.buyers.any { it.id == buyerId && it.owner == "demo-agent" }) { "This buyer isn't available." }
        require(title.isNotBlank()) { "Enter a follow-up title." }
        require(!date.isBefore(LocalDate.now(zone))) { "Choose today or a future date." }
        s.copy(commitments = s.commitments + EstateCommitment(id("task"), buyerId, title.trim(), date))
    }
    fun createOffer(propertyId: String, buyerId: String, amount: java.math.BigDecimal?, conditions: String,
        intentKey: String = java.util.UUID.randomUUID().toString()) = save { s ->
        if (s.completedIntents.containsKey(intentKey)) return@save s
        require(amount != null && amount.signum() > 0) { "Enter a positive offer amount." }
        require(s.properties.any { it.id == propertyId } && s.buyers.any { it.id == buyerId && it.owner == "demo-agent" }) { "Choose an authorised property and buyer." }
        val row = EstateOffer(id("offer"), propertyId, buyerId, amount, conditions.trim())
        s.copy(offers = s.offers + row, completedIntents = s.completedIntents + (intentKey to row.id))
    }
    fun changeOffer(offerId: String, expected: String, next: String, counter: java.math.BigDecimal? = null) = save { s ->
        val offer = s.offers.firstOrNull { it.id == offerId } ?: throw IllegalArgumentException("Offer missing")
        require(offer.status == expected) { "This offer changed. Review its current state." }
        val allowed = when (expected) {
            "draft" -> setOf("submitted")
            "submitted", "countered", "negotiating" -> setOf("countered", "accepted", "rejected")
            else -> emptySet()
        }
        require(next in allowed) { "This decision is not available." }
        require(next != "countered" || (counter != null && counter.signum() > 0)) { "Enter a positive counteroffer." }
        s.copy(offers = s.offers.map { if (it.id == offerId) it.copy(status = next, amount = counter ?: it.amount,
            history = it.history + "Demo decision: $next") else it })
    }
    fun decideIntroduction(introductionId: String, expected: String, decision: String, reason: String) = save { s ->
        val row = s.introductions.firstOrNull { it.id == introductionId } ?: throw IllegalArgumentException("Request unavailable.")
        require(row.reviewer == "demo-agent" && row.requester != "demo-agent") { "You cannot decide your own request or another agent's request." }
        require(row.status == expected && row.status == "pending") { "This request already has a decision. Refresh its context." }
        require(decision in setOf("accepted", "declined")) { "Choose a decision." }
        require(decision != "declined" || reason.isNotBlank()) { "Add a reason before declining." }
        s.copy(introductions = s.introductions.map { if (it.id == introductionId) it.copy(status = decision, reason = reason.trim()) else it })
    }
    fun requestIntroduction(propertyId: String) = save { s ->
        require(s.introductions.none { it.propertyId == propertyId && it.requester == "demo-agent" && it.status == "pending" }) { "A request is already pending for this property." }
        s.copy(introductions = s.introductions + EstateIntroduction(id("intro"), propertyId, "demo-private-buyer", "demo-agent", "demo-other-agent"))
    }
    fun milestone(transactionId: String, milestoneId: String) = save { s ->
        s.copy(transactions = s.transactions.map { t -> if (t.id != transactionId) t else t.copy(
            milestones = t.milestones.map { if (it.id == milestoneId && it.status != "done") it.copy(status = "done") else it }) })
    }
    fun updateRequirements(buyerId: String, draft: RequirementsDraft) = save { s ->
        require(draft.errors().isEmpty()) { "Review the highlighted requirements." }
        require(s.buyers.any { it.id == buyerId && it.owner == "demo-agent" }) { "This buyer isn't available." }
        s.copy(buyers = s.buyers.map { if (it.id == buyerId) it.copy(budget = estateDecimal(draft.budgetMax),
            budgetMin = estateDecimal(draft.budgetMin), location = draft.locationValues().joinToString(),
            bedrooms = draft.bedrooms.toIntOrNull(), bathrooms = draft.bathrooms.toIntOrNull(),
            propertyType = draft.propertyType.ifBlank { null }, features = draft.features, requirementsNotes = draft.notes) else it })
    }
    fun startTransaction(offerId: String) = save { s ->
        val offer = s.offers.firstOrNull { it.id == offerId && it.status == "accepted" }
            ?: throw IllegalArgumentException("An accepted demo offer is required.")
        require(s.transactions.none { it.offerId == offerId }) { "A transaction already exists for this offer." }
        val milestones = listOf("agreement_drafted" to "Agreement drafted", "agreement_signed" to "Agreement signed",
            "deposit_received" to "Deposit received", "conveyancing_started" to "Conveyancing started",
            "inspection_booked" to "Inspection booked", "inspection_complete" to "Inspection complete",
            "conveyancing_complete" to "Conveyancing complete", "balance_received" to "Balance / full payment",
            "keys_handed_over" to "Keys handed over", "commission_invoiced" to "Commission invoiced", "commission_settled" to "Commission settled")
        s.copy(transactions = s.transactions + EstateTransaction(id("transaction"), offerId, offer.propertyId, offer.buyerId,
            "pending_compliance", milestones.map { EstateMilestone(it.first, it.second) },
            listOf(EstateDocument(id("required"), "Supporting identity documents", "required"))))
    }
    fun attachExample(transactionId: String) = save { s ->
        s.copy(transactions = s.transactions.map { t -> if (t.id != transactionId) t else t.copy(
            documents = t.documents + EstateDocument(id("document"), "Fictional supporting document", "submitted")) })
    }
}

fun estateFixtures(now: Instant = Instant.now()): EstateDemoState {
    val zone = ZoneId.of("Africa/Harare")
    val tomorrow = LocalDate.now(zone).plusDays(1).atTime(10, 0).atZone(zone).toInstant()
    return EstateDemoState(
        properties = listOf(
            EstateProperty("demo-p1", "24 Jacaranda Close", "Borrowdale, Harare", 285000.0, 4, 3, 280,
                "Fictional family residence with a generous garden, covered veranda and a separate study. Generated fictional imagery; not an actual listing."),
            EstateProperty("demo-p2", "8 Acacia Mews", "Avondale, Harare", 165000.0, 3, 2, 175,
                "Fictional low-maintenance townhouse near everyday amenities. Example property for reviewing native workflows."),
        ),
        buyers = listOf(
            EstateBuyer("demo-b1", "Nyasha Demo", "Purchase", "300000".toBigDecimal(), "Borrowdale", 4, notes = listOf("Fictional brief: a quiet family home with space to work.")),
            EstateBuyer("demo-b2", "Rudo Example", "Purchase", "180000".toBigDecimal(), "Avondale", 3),
            EstateBuyer("demo-private-buyer", "Private buyer", "Purchase", "300000".toBigDecimal(), "Harare", 4, owner = "demo-other-agent"),
        ),
        viewings = listOf(EstateViewing("demo-v1", "demo-p1", "demo-b1", tomorrow, "Property entrance", "Confirm access with the listing agent."),
            EstateViewing("demo-v2", "demo-p2", "demo-b2", now.minusSeconds(86400), "Acacia Mews entrance", "Fictional feedback: buyer requested the floor plan.", "completed")),
        offers = listOf(EstateOffer("demo-o1", "demo-p1", "demo-b1", "270000".toBigDecimal(), "Subject to financing and inspection.", "submitted", listOf("Draft created", "Submitted in the fictional example")),
            EstateOffer("demo-o2", "demo-p2", "demo-b2", "160000".toBigDecimal(), "Fictional agreed terms", "accepted")),
        introductions = listOf(EstateIntroduction("demo-i1", "demo-p1", "demo-b1", "demo-other-agent", "demo-agent"),
            EstateIntroduction("demo-i2", "demo-p2", "demo-private-buyer", "demo-agent", "demo-other-agent")),
        transactions = listOf(EstateTransaction("demo-t1", "demo-o2", "demo-p2", "demo-b2", "in_progress",
            listOf(EstateMilestone("agreement_drafted", "Agreement drafted", "done"), EstateMilestone("agreement_signed", "Agreement signed", "done"),
                EstateMilestone("deposit_received", "Deposit received", "in_progress"), EstateMilestone("conveyancing_started", "Conveyancing started"),
                EstateMilestone("inspection_complete", "Inspection complete"), EstateMilestone("keys_handed_over", "Keys handed over")),
            listOf(EstateDocument("demo-d1", "Agreement of sale", "under_review"),
                EstateDocument("demo-d2", "Proof of funds", "required"),
                EstateDocument("demo-d3", "Address confirmation", "rejected", "Example: document date is not visible.")))),
        commitments = listOf(EstateCommitment("demo-task1", "demo-b1", "Confirm viewing access", LocalDate.now(zone))),
    )
}
