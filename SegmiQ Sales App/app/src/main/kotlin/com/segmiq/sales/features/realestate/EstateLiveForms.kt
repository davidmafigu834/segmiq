package com.segmiq.sales.features.realestate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.estate.*
import com.segmiq.sales.core.network.*
import com.segmiq.sales.features.live.DateTimeDialog
import java.time.Instant

/** These sheets are unreachable without the existing per-origin/revision read/write acceptance. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateLiveRequirementsSheet(vm: EstateServerViewModel, dismiss: () -> Unit) {
    val s by vm.state.collectAsStateWithLifecycle()
    val row = s.page?.buyer ?: return
    if (vm.repository.access.reason(EstateResource.BUYERS, write = true) != null) return
    var min by rememberSaveable(row.id) { mutableStateOf(row.budget_min?.toPlainString().orEmpty()) }
    var max by rememberSaveable(row.id) { mutableStateOf(row.budget_max?.toPlainString().orEmpty()) }
    var locations by rememberSaveable(row.id) { mutableStateOf(row.locations.joinToString()) }
    var type by rememberSaveable(row.id) { mutableStateOf(row.property_type.orEmpty()) }
    var beds by rememberSaveable(row.id) { mutableStateOf(row.bedrooms?.toString().orEmpty()) }
    var baths by rememberSaveable(row.id) { mutableStateOf(row.bathrooms?.toString().orEmpty()) }
    var notes by rememberSaveable(row.id) { mutableStateOf(row.notes.orEmpty()) }
    var features by rememberSaveable(row.id) { mutableStateOf(row.features.orEmpty()) }
    var review by rememberSaveable { mutableStateOf(false) }
    var sent by rememberSaveable { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val draft = RequirementsDraft(min, max, locations, type, beds, baths, features, notes)
    LaunchedEffect(s.saved, s.pending) { if (sent && s.saved && !s.pending) dismiss() }
    ModalBottomSheet(onDismissRequest = { if (!s.pending) dismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            EstatePageHeader(if (review) "Review requirements" else "Buyer requirements", row.contact_name ?: "Authorised buyer")
            if (!review) {
                EstateRequirementsFields(draft, {
                    min = it.budgetMin; max = it.budgetMax; locations = it.locations
                    type = it.propertyType; beds = it.bedrooms; baths = it.bathrooms; features = it.features; notes = it.notes
                }, !s.pending)
                Text("Review the latest requirements before saving. Conflicting edits cannot be reconciled automatically; failed changes are not retried.")
                SegmiqPrimaryButton("Review changes", { focus.clearFocus(); review = true }, Modifier.fillMaxWidth(), draft.errors().isEmpty())
            } else {
                Text("Currency: ${row.currency ?: "not configured"}\nBudget $min – $max\n$locations\n$type\n$beds bedrooms · $baths bathrooms\n$notes")
                SegmiqPrimaryButton(if (s.pending) "Waiting for SegmiQ…" else "Save with SegmiQ",
                    { sent = true; vm.saveRequirements(draft) }, Modifier.fillMaxWidth(), !s.pending)
                TextButton({ review = false }, enabled = !s.pending) { Text("Keep editing") }
            }
            OutlinedButton(dismiss, Modifier.fillMaxWidth(), enabled = !s.pending) { Text("Cancel editing") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateLiveBookingSheet(vm: EstateServerViewModel, dismiss: () -> Unit, go: (String) -> Unit) {
    val s by vm.state.collectAsStateWithLifecycle()
    val choices by vm.bookingChoices.collectAsStateWithLifecycle()
    val receipt by vm.bookingReceipt.collectAsStateWithLifecycle()
    val existing = s.page?.viewing
    // A denied/stale reschedule must never turn into a new booking form.
    val rescheduling = vm.target.resource == EstateResource.VIEWINGS && vm.target.id != null
    if (rescheduling && existing == null && receipt == null) return
    val access = vm.repository.access
    if (access.reason(EstateResource.VIEWINGS, write = true) != null) return
    if (!rescheduling && (access.reason(EstateResource.PROPERTIES) != null || access.reason(EstateResource.BUYERS) != null)) return
    val focus = LocalFocusManager.current
    var property by rememberSaveable { mutableStateOf(s.page?.listing?.id.orEmpty()) }
    var buyer by rememberSaveable { mutableStateOf(s.page?.buyer?.id ?: vm.target.buyerContext.orEmpty()) }
    var propertyQuery by rememberSaveable { mutableStateOf("") }
    var buyerQuery by rememberSaveable { mutableStateOf("") }
    var atText by rememberSaveable { mutableStateOf("") }
    var instructions by rememberSaveable { mutableStateOf("") }
    var pickTime by remember { mutableStateOf(false) }
    var review by rememberSaveable { mutableStateOf(false) }
    var key by rememberSaveable { mutableStateOf("") }
    var fingerprint by rememberSaveable { mutableStateOf("") }
    val at = runCatching { Instant.parse(atText) }.getOrNull()
    LaunchedEffect(vm) { vm.bookingReceipt.value = null; if (existing == null) vm.loadBookingChoices() }
    val properties = (choices.properties + listOfNotNull(s.page?.listing)).distinctBy { it.id }
    val buyers = (choices.buyers + listOfNotNull(s.page?.buyer)).distinctBy { it.id }
    val valid = viewingTimeError(at) == null && (existing != null ||
        (properties.any { it.id == property } && buyers.any { it.id == buyer })) && instructions.length <= 2000
    ModalBottomSheet(onDismissRequest = { if (!s.pending) dismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            EstatePageHeader(if (rescheduling) "Reschedule viewing" else "Schedule viewing",
                "Organisation time zone · ${vm.repository.workspace.zone}")
            if (receipt != null && !s.pending) {
                Text("Confirmed by SegmiQ", Modifier.semantics { liveRegion = LiveRegionMode.Polite }, style = MaterialTheme.typography.titleLarge)
                Text(if (receipt?.notificationEffects?.customerNotification == "NOT_REQUESTED")
                    "No customer notification requested." else "No confirmed customer-notification result is available.")
                val id = receipt?.viewing?.id ?: if (rescheduling) vm.target.id else null
                if (id != null) SegmiqPrimaryButton("Open confirmed viewing", {
                    dismiss(); go(estateServerRoute(EstateLink(EstateResource.VIEWINGS, id)))
                })
                OutlinedButton(dismiss) { Text("Done") }
            } else {
                if (existing == null && !review) {
                    SegmiqSearchField(propertyQuery, { propertyQuery = it }, "Search authorised properties")
                    SegmiqSearchField(buyerQuery, { buyerQuery = it }, "Search authorised buyers")
                    TextButton({ vm.loadBookingChoices(propertyQuery, buyerQuery) }, enabled = !choices.loading) { Text("Search selections") }
                    if (choices.loading) SegmiqSkeleton(2)
                    choices.error?.let { SegmiqErrorCard(it.message) { vm.loadBookingChoices(propertyQuery, buyerQuery) } }
                    if (!choices.loading && choices.error == null) {
                        if (properties.isEmpty() || buyers.isEmpty()) SegmiqEmptyState("Selections unavailable", "Search for an authorised property and buyer. SegmiQ rechecks ownership when booking.")
                        Text("Property", style = MaterialTheme.typography.titleMedium)
                        properties.forEach { p -> FilterChip(property == p.id, { property = p.id },
                            label = { Text(p.address ?: "Authorised property") }, enabled = !s.pending) }
                        Text("Buyer search", style = MaterialTheme.typography.titleMedium)
                        buyers.forEach { b -> FilterChip(buyer == b.id, { buyer = b.id },
                            label = { Text(b.contact_name ?: "Authorised buyer search") }, enabled = !s.pending) }
                        Row {
                            if (choices.page > 1) TextButton({ vm.loadBookingChoices(propertyQuery, buyerQuery, choices.page - 1) }) { Text("Previous selections") }
                            if (choices.more) TextButton({ vm.loadBookingChoices(propertyQuery, buyerQuery, choices.page + 1) }) { Text("More selections") }
                        }
                    }
                }
                existing?.let { Text("Original: ${it.scheduled_at}\nProperty: ${it.listing?.address ?: "Authorised property"}") }
                if (!review) {
                    OutlinedButton({ pickTime = true }, enabled = !s.pending) { Text(at?.atZone(vm.repository.workspace.zone)?.toString() ?: "Choose date and time") }
                    if (atText.isNotBlank()) viewingTimeError(at)?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    if (existing == null) EstateEntry("Access instructions", instructions, { instructions = it.take(2000) }, !s.pending, multiline = true)
                    Text("Mobile booking does not request a customer WhatsApp. A time clash is shown for review and is not overridden unless you confirm it.")
                    SegmiqPrimaryButton("Review booking", {
                        focus.clearFocus()
                        val identity = BookingIdentity(fingerprint, key).forIntent(listOf(property, buyer, atText, instructions).joinToString("") { "${it.length}:$it" })
                        fingerprint = identity.fingerprint; key = identity.key; review = true
                    }, Modifier.fillMaxWidth(), valid && !choices.loading && !s.pending)
                } else {
                    Text("${properties.firstOrNull { it.id == property }?.address ?: existing?.listing?.address}\n${buyers.firstOrNull { it.id == buyer }?.contact_name.orEmpty()}\n${at?.atZone(vm.repository.workspace.zone)}\n$instructions\nNo customer notification requested.")
                    SegmiqPrimaryButton(if (s.pending) "Waiting for SegmiQ…" else "Confirm with SegmiQ", {
                        if (existing != null) vm.reschedule(requireNotNull(at), false)
                        else vm.submitBooking(buyer, property, requireNotNull(at), instructions, key, false)
                    }, Modifier.fillMaxWidth(), valid && !s.pending)
                    TextButton({ review = false }, enabled = !s.pending) { Text("Keep editing") }
                }
                s.error?.let { error ->
                    SegmiqErrorCard(error.screenMessage())
                    if (isOverlapConflict(error)) SegmiqPrimaryButton("Book both times", {
                        if (existing != null) vm.reschedule(requireNotNull(at), true)
                        else vm.submitBooking(buyer, property, requireNotNull(at), instructions, key, true)
                    }, Modifier.fillMaxWidth(), valid && !s.pending)
                }
                OutlinedButton(dismiss, Modifier.fillMaxWidth(), enabled = !s.pending) { Text("Cancel editing") }
            }
        }
    }
    if (pickTime) DateTimeDialog("Viewing time", vm.repository.workspace.zone, { pickTime = false }) {
        atText = it.toInstant().toString(); pickTime = false
    }
}
