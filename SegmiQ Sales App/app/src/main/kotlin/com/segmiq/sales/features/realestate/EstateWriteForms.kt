package com.segmiq.sales.features.realestate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.estate.*
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateListingSheet(vm: EstateServerViewModel, dismiss: () -> Unit) {
    val existing = vm.state.collectAsStateWithLifecycle().value.page?.listing
    val editing = existing != null
    if (vm.repository.access.reason(EstateResource.PROPERTIES, write = true) != null) return
    if (editing && existing?.permittedActions?.edit != true) return
    var type by rememberSaveable { mutableStateOf(existing?.transaction_type ?: "sale") }
    var address by rememberSaveable { mutableStateOf(existing?.address.orEmpty()) }
    var suburb by rememberSaveable { mutableStateOf(existing?.suburb.orEmpty()) }
    var description by rememberSaveable { mutableStateOf(existing?.description.orEmpty()) }
    var price by rememberSaveable { mutableStateOf(existing?.price?.toPlainString().orEmpty()) }
    var beds by rememberSaveable { mutableStateOf(existing?.bedrooms?.toString().orEmpty()) }
    var baths by rememberSaveable { mutableStateOf(existing?.bathrooms?.toString().orEmpty()) }
    var size by rememberSaveable { mutableStateOf(existing?.size_sqm?.toPlainString().orEmpty()) }
    var category by rememberSaveable { mutableStateOf(existing?.property_category.orEmpty()) }
    var review by rememberSaveable { mutableStateOf(false) }
    val s by vm.state.collectAsStateWithLifecycle()
    val priceOk = price.isBlank() || runCatching { java.math.BigDecimal(price.trim()) }.isSuccess
    val ready = address.isNotBlank() && priceOk && (editing || type in LISTING_TRANSACTION_TYPES)
    ModalBottomSheet(onDismissRequest = { if (!s.pending) dismiss() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(if (editing) "Edit property" else "New property", style = MaterialTheme.typography.titleLarge)
            Text("SegmiQ confirms the save. Assignment and approval are not set from this phone.", style = MaterialTheme.typography.bodySmall)
            if (!review) {
                if (!editing) FilterChips(LISTING_TRANSACTION_TYPES.toList(), type) { type = it }
                EstateEntry("Address", address, { address = it.take(500) }, !s.pending)
                EstateEntry("Suburb", suburb, { suburb = it.take(200) }, !s.pending)
                EstateEntry("Price", price, { price = it.take(20) }, !s.pending)
                if (!priceOk) Text("Enter the price as a decimal.", color = MaterialTheme.colorScheme.error)
                EstateEntry("Bedrooms", beds, { beds = it.filter(Char::isDigit).take(3) }, !s.pending)
                EstateEntry("Bathrooms", baths, { baths = it.filter(Char::isDigit).take(3) }, !s.pending)
                EstateEntry("Size m²", size, { size = it.take(12) }, !s.pending)
                FilterChips(listOf("None") + LISTING_CATEGORIES.toList(), category.ifBlank { "None" }) { category = if (it == "None") "" else it }
                EstateEntry("Description", description, { description = it.take(5000) }, !s.pending, multiline = true)
                SegmiqPrimaryButton("Review", { review = true }, Modifier.fillMaxWidth(), ready && !s.pending)
            } else {
                Text("$type\n$address\n${suburb.ifBlank { "No suburb" }}\n${price.ifBlank { "No price" }}")
                SegmiqPrimaryButton(if (s.pending) "Waiting for SegmiQ…" else "Save on SegmiQ", {
                    if (editing) vm.updateListing(address, suburb, description, price, beds, baths, size, category)
                    else vm.createListing(type, address, suburb, description, price, beds, baths, size, category)
                }, Modifier.fillMaxWidth(), ready && !s.pending)
                TextButton({ review = false }, enabled = !s.pending) { Text("Keep editing") }
            }
            s.error?.let { SegmiqErrorCard(it.message) }
            OutlinedButton(dismiss, Modifier.fillMaxWidth(), enabled = !s.pending) { Text("Close") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateIntroductionSheet(vm: EstateServerViewModel, dismiss: () -> Unit) {
    if (vm.repository.access.reason(EstateResource.INTRODUCTIONS, write = true) != null) return
    val s by vm.state.collectAsStateWithLifecycle()
    val choices by vm.bookingChoices.collectAsStateWithLifecycle()
    val listing = s.page?.listing
    val buyer = s.page?.buyer
    var property by rememberSaveable { mutableStateOf(listing?.id.orEmpty()) }
    var search by rememberSaveable { mutableStateOf(buyer?.id.orEmpty()) }
    var review by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { if (choices.properties.isEmpty() || choices.buyers.isEmpty()) vm.loadBookingChoices() }
    val ready = runCatching { UUID.fromString(property); UUID.fromString(search) }.isSuccess
    ModalBottomSheet(onDismissRequest = { if (!s.pending) dismiss() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Request introduction", style = MaterialTheme.typography.titleLarge)
            Text("The other agent's buyer phone stays hidden unless SegmiQ later discloses it.", style = MaterialTheme.typography.bodySmall)
            if (listing == null) choices.properties.forEach { row ->
                FilterChip(property == row.id, { property = row.id }, label = { Text(row.address ?: "Property") }, enabled = !s.pending)
            }
            if (buyer == null) choices.buyers.forEach { row ->
                FilterChip(search == row.id, { search = row.id }, label = { Text(row.contact_name ?: "Buyer search") }, enabled = !s.pending)
            }
            if (!review) SegmiqPrimaryButton("Review request", { review = true }, Modifier.fillMaxWidth(), ready && !s.pending)
            else {
                Text("Property and buyer search will be sent. No phone number is included.")
                SegmiqPrimaryButton(if (s.pending) "Waiting for SegmiQ…" else "Send request", {
                    vm.requestIntroduction(property, search)
                }, Modifier.fillMaxWidth(), ready && !s.pending)
            }
            s.error?.let { SegmiqErrorCard(it.message) }
            OutlinedButton(dismiss, Modifier.fillMaxWidth(), enabled = !s.pending) { Text("Close") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EstateOfferSheet(vm: EstateServerViewModel, dismiss: () -> Unit) {
    if (vm.repository.access.reason(EstateResource.OFFERS, write = true) != null) return
    val s by vm.state.collectAsStateWithLifecycle()
    val choices by vm.bookingChoices.collectAsStateWithLifecycle()
    val listing = s.page?.listing
    val buyer = s.page?.buyer
    var property by rememberSaveable { mutableStateOf(listing?.id.orEmpty()) }
    var search by rememberSaveable { mutableStateOf(buyer?.id.orEmpty()) }
    var amount by rememberSaveable { mutableStateOf("") }
    var conditions by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var submit by rememberSaveable { mutableStateOf(false) }
    var review by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { if (listing == null || buyer == null) vm.loadBookingChoices() }
    val selectedBuyer = buyer ?: choices.buyers.firstOrNull { it.id == search }
    val contact = selectedBuyer?.contact_id
    val amountOk = runCatching { java.math.BigDecimal(amount.trim()) }.getOrNull()?.signum() == 1
    val ready = amountOk && contact != null && runCatching { UUID.fromString(property); UUID.fromString(contact) }.isSuccess
    ModalBottomSheet(onDismissRequest = { if (!s.pending) dismiss() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Create offer", style = MaterialTheme.typography.titleLarge)
            Text("Amount is sent as a decimal. Currency is the organisation currency when SegmiQ has one.", style = MaterialTheme.typography.bodySmall)
            if (listing == null) choices.properties.forEach { row ->
                FilterChip(property == row.id, { property = row.id }, label = { Text(row.address ?: "Property") })
            }
            if (buyer == null) choices.buyers.forEach { row ->
                FilterChip(search == row.id, { search = row.id }, enabled = row.contact_id != null,
                    label = { Text(row.contact_name ?: "Buyer") })
            }
            if (contact == null) Text("This buyer search has no contact id, so an offer cannot be created.")
            EstateEntry("Amount", amount, { amount = it.take(20) }, !s.pending)
            EstateEntry("Conditions", conditions, { conditions = it.take(5000) }, !s.pending, multiline = true)
            EstateEntry("Notes", notes, { notes = it.take(5000) }, !s.pending, multiline = true)
            if (!review) SegmiqPrimaryButton("Review offer", { review = true }, Modifier.fillMaxWidth(), ready && !s.pending)
            else {
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Checkbox(submit, { submit = it }, enabled = !s.pending)
                    Text("Submit after SegmiQ creates it. Leave this off to keep it unsent.")
                }
                SegmiqPrimaryButton(if (s.pending) "Waiting for SegmiQ…" else "Create on SegmiQ", {
                    vm.createOffer(property, requireNotNull(contact), selectedBuyer?.id, amount,
                        vm.repository.workspace.currencyCode?.takeIf { it.length == 3 }, conditions, notes, submit)
                }, Modifier.fillMaxWidth(), ready && !s.pending)
            }
            s.error?.let { SegmiqErrorCard(it.message) }
            OutlinedButton(dismiss, Modifier.fillMaxWidth(), enabled = !s.pending) { Text("Close") }
        }
    }
}
