package com.segmiq.sales.features.realestate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.design.*
import com.segmiq.sales.features.live.DateTimeDialog
import com.segmiq.sales.features.live.FollowUpDateDialog
import java.time.*
import java.time.format.DateTimeFormatter

@Composable
fun EstateRequirementsFields(draft: RequirementsDraft, update: (RequirementsDraft) -> Unit, enabled: Boolean) {
    val errors = draft.errors()
    EstateEntry("Minimum budget", draft.budgetMin, { update(draft.copy(budgetMin = it)) }, enabled, errors["budgetMin"], KeyboardType.Decimal)
    EstateEntry("Maximum budget", draft.budgetMax, { update(draft.copy(budgetMax = it)) }, enabled, errors["budgetMax"], KeyboardType.Decimal)
    EstateEntry("Preferred locations · comma separated", draft.locations, { update(draft.copy(locations = it)) }, enabled, errors["locations"])
    EstateEntry("Property type", draft.propertyType, { update(draft.copy(propertyType = it)) }, enabled, errors["propertyType"])
    EstateEntry("Bedrooms", draft.bedrooms, { update(draft.copy(bedrooms = it)) }, enabled, errors["bedrooms"], KeyboardType.Number)
    EstateEntry("Bathrooms", draft.bathrooms, { update(draft.copy(bathrooms = it)) }, enabled, errors["bathrooms"], KeyboardType.Number)
    EstateEntry("Required features", draft.features, { update(draft.copy(features = it)) }, enabled, errors["features"], multiline = true)
    EstateEntry("Requirements notes", draft.notes, { update(draft.copy(notes = it)) }, enabled, errors["notes"], multiline = true)
    Text("Blank optional fields remain unspecified. Budgets use the search's currency; this editor does not change currency.",
        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
internal fun EstateEntry(label: String, value: String, change: (String) -> Unit, enabled: Boolean,
                         error: String? = null, keyboard: KeyboardType = KeyboardType.Text, multiline: Boolean = false) {
    OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) },
        enabled = enabled, isError = error != null, minLines = if (multiline) 3 else 1,
        singleLine = !multiline, keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        supportingText = if (error != null) {{ Text(error, Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }} else null)
}

/** Explicit review; scrolls above the IME and never performs a mutation by opening. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateFormReview(title: String, summary: String, busy: Boolean, cancel: () -> Unit, confirm: () -> Unit) {
    ModalBottomSheet(onDismissRequest = { if (!busy) cancel() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
            Text(summary, style = MaterialTheme.typography.bodyLarge)
            SegmiqPrimaryButton(if (busy) "Saving…" else "Confirm demo action", confirm, Modifier.fillMaxWidth(), !busy)
            OutlinedButton(cancel, Modifier.fillMaxWidth(), enabled = !busy) { Text("Keep editing") }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
fun EstateDemoForm(kind: String, propertyId: String, buyerId: String, targetId: String,
                   state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit) {
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    val existing = state.viewings.firstOrNull { it.id == targetId }
    val buyers = state.buyers.filter { it.owner == "demo-agent" }
    if ((targetId != "-" && existing == null) ||
        (buyerId != "-" && buyers.none { it.id == buyerId }) ||
        (propertyId != "-" && state.properties.none { it.id == propertyId })) {
        Page { EstateGateNotice("Selection unavailable", "This record or assignment changed. Return and select an authorised example.") }; return
    }
    if (buyers.isEmpty() || state.properties.isEmpty()) {
        Page { SegmiqEmptyState("No authorised examples", "A property and your assigned fictional buyer are needed.") }
        return
    }
    var property by rememberSaveable { mutableStateOf(existing?.propertyId ?: propertyId.takeIf { id -> state.properties.any { it.id == id } } ?: state.properties.first().id) }
    var buyer by rememberSaveable { mutableStateOf(existing?.buyerId ?: buyerId.takeIf { id -> buyers.any { it.id == id } } ?: buyers.first().id) }
    val buyerRow = buyers.firstOrNull { it.id == buyer }
    val propertyRow = state.properties.firstOrNull { it.id == property }
    if (buyerRow == null || propertyRow == null) {
        Page { EstateGateNotice("Selection unavailable", "Access to a selected example changed. Return and select again.") }; return
    }
    var atText by rememberSaveable { mutableStateOf(existing?.at?.toString().orEmpty()) }
    var dateText by rememberSaveable { mutableStateOf(LocalDate.now(vm.zone).plusDays(1).toString()) }
    var location by rememberSaveable { mutableStateOf(existing?.location ?: "Property entrance") }
    var notes by rememberSaveable { mutableStateOf(existing?.notes.orEmpty()) }
    var amount by rememberSaveable { mutableStateOf("") }
    var min by rememberSaveable { mutableStateOf(buyerRow.budgetMin?.toPlainString().orEmpty()) }
    var max by rememberSaveable { mutableStateOf(buyerRow.budget?.toPlainString().orEmpty()) }
    var places by rememberSaveable { mutableStateOf(buyerRow.location) }
    var type by rememberSaveable { mutableStateOf(buyerRow.propertyType.orEmpty()) }
    var beds by rememberSaveable { mutableStateOf(buyerRow.bedrooms?.toString().orEmpty()) }
    var baths by rememberSaveable { mutableStateOf(buyerRow.bathrooms?.toString().orEmpty()) }
    var features by rememberSaveable { mutableStateOf(buyerRow.features) }
    var requirementsNotes by rememberSaveable { mutableStateOf(buyerRow.requirementsNotes) }
    val draft = RequirementsDraft(min, max, places, type, beds, baths, features, requirementsNotes)
    var title by rememberSaveable { mutableStateOf("") }
    var datePicker by remember { mutableStateOf(false) }
    var timePicker by remember { mutableStateOf(false) }
    var review by rememberSaveable { mutableStateOf(false) }
    var started by rememberSaveable { mutableStateOf(false) }
    var submitted by rememberSaveable { mutableStateOf(false) }
    var intentFingerprint by rememberSaveable { mutableStateOf("") }
    var intentKey by rememberSaveable { mutableStateOf("") }
    var confirmOverlap by rememberSaveable(atText) { mutableStateOf(false) }
    val at = runCatching { Instant.parse(atText) }.getOrNull()
    val overlap = at != null && state.viewings.any { it.id != existing?.id && it.status == "scheduled" && Duration.between(it.at, at).abs() < Duration.ofMinutes(30) }
    LaunchedEffect(state.busy, state.message) {
        if (started && !state.busy && state.message == "Saved in this fictional demo only.") submitted = true
    }
    val editable = !state.busy && !submitted
    val heading = when (kind) {
        "viewing" -> if (existing == null) "Schedule a viewing" else "Reschedule viewing"
        "offer" -> "Prepare an offer"
        "followup" -> "Create a follow-up"
        else -> "Buyer requirements"
    }
    val valid = when (kind) {
        "viewing" -> viewingTimeError(at) == null && location.isNotBlank() && (!overlap || confirmOverlap)
        "offer" -> estateDecimal(amount)?.signum() == 1 && notes.length <= 5000
        "followup" -> title.isNotBlank() && !LocalDate.parse(dateText).isBefore(LocalDate.now(vm.zone))
        else -> draft.errors().isEmpty()
    }
    Page {
        EstatePageHeader(heading, "Fictional preview · no production requests")
        if (kind in setOf("viewing", "offer")) {
            Text("Property", style = MaterialTheme.typography.titleMedium)
            state.properties.forEach { row -> FilterChip(property == row.id,
                { if (editable && existing == null) property = row.id }, enabled = editable && existing == null, label = { Text(row.address) }) }
        }
        if (kind != "requirements") {
            Text("Buyer", style = MaterialTheme.typography.titleMedium)
            buyers.forEach { row -> FilterChip(buyer == row.id,
                { if (editable && existing == null) buyer = row.id }, enabled = editable && existing == null, label = { Text(row.name) }) }
        } else Text(buyerRow.name, style = MaterialTheme.typography.titleLarge)
        when (kind) {
            "viewing" -> {
                existing?.let { Text("Original: ${it.at.atZone(vm.zone).format(DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm"))}") }
                OutlinedButton({ timePicker = true }, enabled = editable) {
                    Text(at?.atZone(vm.zone)?.format(DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm")) ?: "Choose date and time")
                }
                Text("Time zone: ${vm.zone}", style = MaterialTheme.typography.labelSmall)
                if (atText.isNotEmpty()) viewingTimeError(at)?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                EstateEntry("Meeting location · fictional only", location, { location = it.take(200) }, editable)
                EstateEntry("Access instructions and notes", notes, { notes = it.take(2000) }, editable, multiline = true)
                if (overlap) {
                    EstateGateNotice("Appointment overlap", "Another fictional viewing is within 30 minutes. This local warning is not a server availability check.")
                    Row { Checkbox(confirmOverlap, { confirmOverlap = it }, modifier = Modifier.semantics { contentDescription = "I reviewed this overlap" }, enabled = editable)
                        Text("I reviewed this overlap", Modifier.padding(top = 12.dp)) }
                }
                EstateGateNotice("No customer notification", "This preview sends no messages. Mobile booking does not request a customer notification; no message delivery is assumed.")
            }
            "offer" -> {
                EstateEntry("Offer amount · USD (demo)", amount, { amount = it.take(30) }, editable,
                    if (amount.isNotBlank() && estateDecimal(amount)?.signum() != 1) "Enter a positive decimal amount." else null, KeyboardType.Decimal)
                EstateEntry("Conditions and notes", notes, { notes = it.take(5000) }, editable, multiline = true)
                EstateGateNotice("Production creation unavailable", "Live offer creation is not available in this app yet. This creates a fictional draft only; nothing is sent to the customer.")
            }
            "followup" -> {
                EstateEntry("Next action", title, { title = it.take(200) }, editable)
                OutlinedButton({ datePicker = true }, enabled = editable) { Text("Due $dateText") }
                Text("Date-only commitment · no timed appointment or notification.")
            }
            else -> EstateRequirementsFields(draft, {
                min = it.budgetMin; max = it.budgetMax; places = it.locations; type = it.propertyType
                beds = it.bedrooms; baths = it.bathrooms; features = it.features; requirementsNotes = it.notes
            }, editable)
        }
        SegmiqPrimaryButton(if (submitted) "Saved in demo" else if (state.busy) "Saving…" else "Review demo change", {
            focus.clearFocus()
            val fingerprint = listOf(kind, property, buyer, atText, location, notes, amount, targetId).joinToString("") { "${it.length}:$it" }
            val identity = BookingIdentity(intentFingerprint, intentKey).forIntent(fingerprint)
            intentFingerprint = identity.fingerprint; intentKey = identity.key; review = true
        }, Modifier.fillMaxWidth(), valid && editable)
        if (!submitted) OutlinedButton({ go("__back") }, Modifier.fillMaxWidth(), enabled = !state.busy) { Text("Cancel editing") }
        if (submitted) {
            state.completedIntents[intentKey]?.let { savedId ->
                SegmiqPrimaryButton("Open confirmed example", { go(demoDetail(if (kind == "viewing") "viewing" else "offer", savedId)) }, Modifier.fillMaxWidth())
            }
            OutlinedButton({ go(when (kind) {
                "viewing" -> "viewings"; "offer" -> "offers"; "followup" -> "calendar"; else -> demoDetail("buyer", buyer)
            }) }) { Text("Continue workflow") }
        }
        Text("Drafts remain here after failed saves. Back cancels editing; process death discards the fictional session.",
            style = MaterialTheme.typography.labelSmall)
    }
    if (timePicker) DateTimeDialog("Viewing time", vm.zone, { timePicker = false }) { atText = it.toInstant().toString(); timePicker = false }
    if (datePicker) FollowUpDateDialog(LocalDate.parse(dateText), vm.zone, { datePicker = false }) { dateText = it.toString(); datePicker = false }
    if (review) EstateFormReview("Review fictional change", when (kind) {
        "viewing" -> "${propertyRow.address}\n${buyerRow.name}\n${at?.atZone(vm.zone)}\n$location\n$notes\nNo customer notification.${if (overlap) "\nOverlap acknowledged." else ""}"
        "offer" -> "${propertyRow.address}\n${buyerRow.name}\n${estateDecimal(amount)?.let(::estateAmount)}\n$notes\nDraft only · no financial commitment."
        "followup" -> "${buyerRow.name}\n$title\n$dateText"
        else -> "${buyerRow.name}\nUSD $min – $max\n$places\n$type · $beds bedrooms · $baths bathrooms\n$features\n$requirementsNotes"
    }, state.busy, { review = false }, {
        review = false; started = true
        when (kind) {
            "viewing" -> vm.schedule(property, buyer, requireNotNull(at), location, notes, existing?.id, intentKey, confirmOverlap, existing?.at)
            "offer" -> vm.createOffer(property, buyer, estateDecimal(amount), notes, intentKey)
            "followup" -> vm.followUp(buyer, title, LocalDate.parse(dateText))
            else -> vm.updateRequirements(buyer, draft)
        }
    })
}
