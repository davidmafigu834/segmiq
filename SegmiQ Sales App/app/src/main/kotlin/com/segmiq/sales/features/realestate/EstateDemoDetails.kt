package com.segmiq.sales.features.realestate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.design.*
import com.segmiq.sales.features.live.formatAmount
import java.time.format.DateTimeFormatter

@Composable
fun EstateDemoDetail(kind: String, id: String, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit, buyerContext: String? = null) {
    when (kind) {
        "property" -> state.properties.firstOrNull { it.id == id }?.let { PropertyDetail(it, state, vm, go, buyerContext) } ?: UnavailableExample()
        "buyer", "inquiry" -> state.buyers.firstOrNull { it.id == id && it.owner == "demo-agent" }?.let { BuyerDetail(it, state, vm, go, kind == "inquiry") } ?: UnavailableExample()
        "viewing" -> state.viewings.firstOrNull { it.id == id }?.let { ViewingDetail(it, state, vm, go) } ?: UnavailableExample()
        "offer" -> state.offers.firstOrNull { it.id == id }?.let { OfferDetail(it, state, vm, go) } ?: UnavailableExample()
        "introduction" -> state.introductions.firstOrNull { it.id == id }?.let { IntroductionDetail(it, state, vm, go) } ?: UnavailableExample()
        "transaction", "compliance" -> state.transactions.firstOrNull { it.id == id }?.let { TransactionDetail(it, state, vm, go, kind == "compliance") } ?: UnavailableExample()
        else -> UnavailableExample()
    }
}

@Composable
private fun UnavailableExample() = Page { EstateGateNotice("Record unavailable", "This fictional record is not available to this demo agent.") }

@Composable
private fun PropertyDetail(property: EstateProperty, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit, buyerContext: String?) {
    val pager = rememberPagerState { 3 }
    Page {
        HorizontalPager(pager, modifier = Modifier.fillMaxWidth().height(208.dp)) { page -> EstateDemoPhoto(property.id, Modifier.fillMaxSize(), page) }
        Text("Concept gallery ${pager.currentPage + 1} / 3 · generated architecture",
            style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        EstatePageHeader(property.address, property.suburb)
        Text(formatAmount(property.price, "USD"), style = MaterialTheme.typography.headlineLarge)
        EstateStatusBadge("available")
        Text("${property.bedrooms} bedrooms · ${property.bathrooms} bathrooms · ${property.size} m²")
        Text(property.description, style = MaterialTheme.typography.bodyLarge)
        SegmiqPrimaryButton("Schedule demo viewing", { go(demoForm("viewing", property.id, buyerContext ?: "-")) }, Modifier.fillMaxWidth())
        OutlinedButton({ go(demoForm("offer", property.id, buyerContext ?: "-")) }, Modifier.fillMaxWidth()) { Text("Prepare demo offer") }
        SectionTitle("Buyer context")
        state.buyers.filter { it.owner == "demo-agent" }.forEach { buyer ->
            EstateContextRow(buyer.name, "Fictional candidate · no AI match percentage") { go(demoDetail("buyer", buyer.id)) }
        }
        SectionTitle("Related inquiries")
        state.buyers.filter { it.owner == "demo-agent" }.take(1).forEach { buyer ->
            EstateContextRow(buyer.name, "Example enquiry · view requirements and next steps") { go(demoDetail("inquiry", buyer.id)) }
        }
        SectionTitle("Activity")
        EstateTimeline(listOf("Fictional listing prepared", "Example buyer brief linked"))
        OutlinedButton({ vm.requestIntroduction(property.id) }, enabled = !state.busy) { Text("Request demo introduction") }
        Text("A private buyer's contact details are not disclosed by requesting an introduction.", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun BuyerDetail(buyer: EstateBuyer, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit, inquiry: Boolean) {
    var tab by rememberSaveable { mutableStateOf("Overview") }
    var note by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(buyer.notes) { if (buyer.notes.lastOrNull() == note) note = "" }
    Page {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            SegmiqAvatar(buyer.name)
            Column { Text(buyer.name, style = MaterialTheme.typography.headlineMedium); Text(if (inquiry) "Fictional inquiry · referral" else "Fictional buyer · assigned to you") }
        }
        FilterChips(listOf("Overview", "Requirements", "Matches", "Activity", "Notes"), tab) { tab = it }
        when (tab) {
            "Overview" -> {
                EstateStatusBadge("active")
                Text("${buyer.intent} · ${estateAmount(buyer.budget)}", style = MaterialTheme.typography.titleLarge)
                Text("${buyer.location.ifBlank { "Location not specified" }} · ${buyer.bedrooms?.let { "$it bedrooms" } ?: "Bedrooms not specified"}")
                SegmiqPrimaryButton("Schedule demo viewing", { go(demoForm("viewing", buyer = buyer.id)) }, Modifier.fillMaxWidth())
                EstateContextRow("Create follow-up", "Choose a date and review before saving") { go(demoForm("followup", buyer = buyer.id)) }
                EstateContextRow("Prepare offer", "Keep the property and buyer linked") { go(demoForm("offer", buyer = buyer.id)) }
                SectionTitle("Viewings")
                val viewings = state.viewings.filter { it.buyerId == buyer.id }
                if (viewings.isEmpty()) Text("No fictional viewings yet.")
                viewings.forEach { viewing -> EstateContextRow(state.properties.first { it.id == viewing.propertyId }.address,
                    viewing.at.atZone(vm.zone).format(DateTimeFormatter.ofPattern("EEE d MMM · HH:mm"))) { go(demoDetail("viewing", viewing.id)) } }
                SectionTitle("Offers")
                state.offers.filter { it.buyerId == buyer.id }.forEach { offer ->
                    EstateContextRow(estateAmount(offer.amount), offer.status) { go(demoDetail("offer", offer.id)) }
                }
                DemoCopilotContext(go)
                EstateGateNotice("Communication stays with SegmiQ", "The fictional example has no real phone number or conversation. Exit preview to call or open your authorised live inquiry.")
            }
            "Requirements" -> {
                SegmiqCard {
                    Text("Budget: ${estateAmount(buyer.budget)}")
                    Text("Location: ${buyer.location}")
                    Text("Minimum budget: ${estateAmount(buyer.budgetMin)}")
                    Text("Bedrooms: ${buyer.bedrooms ?: "Not specified"}")
                    Text("Bathrooms: ${buyer.bathrooms ?: "Not specified"}")
                    Text("Property type: ${buyer.propertyType ?: "Not specified"}")
                    if (buyer.features.isNotBlank()) Text(buyer.features)
                    if (buyer.requirementsNotes.isNotBlank()) Text(buyer.requirementsNotes)
                    Text("Intent: ${buyer.intent}")
                }
                SegmiqPrimaryButton("Edit demo requirements", { go(demoForm("requirements", buyer = buyer.id)) })
            }
            "Matches" -> {
                SegmiqImageFeatureCard(com.segmiq.sales.R.drawable.estate_buyer_matching_feature, "Find the right fit",
                    "Fictional candidates illustrate the workflow. These are not AI recommendations.", badge = "DECORATIVE · GENERATED", minHeight = 180)
                state.properties.forEach { property -> EstatePropertyMiniCard(property) { go(demoDetail("property", property.id, buyer.id)) } }
            }
            "Activity" -> {
                EstateTimeline(listOf("Fictional inquiry received", "Requirements reviewed") + buyer.notes.map { "Internal note: $it" })
                state.commitments.filter { it.buyerId == buyer.id }.forEach { task -> SegmiqCard { Text(task.title); Text(task.date.toString()) } }
            }
            else -> {
                OutlinedTextField(note, { note = it.take(2000) }, Modifier.fillMaxWidth(), minLines = 4, label = { Text("Demo note") }, enabled = !state.busy)
                SegmiqPrimaryButton("Save demo note", { vm.addNote(buyer.id, note) }, enabled = note.isNotBlank() && !state.busy)
                buyer.notes.forEach { text -> SegmiqCard { Text(text) } }
            }
        }
    }
}

@Composable
private fun ViewingDetail(viewing: EstateViewing, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit) {
    var feedback by rememberSaveable { mutableStateOf(viewing.notes) }
    var outcome by rememberSaveable { mutableStateOf(viewing.outcome ?: "interested") }
    var confirm by remember { mutableStateOf<String?>(null) }
    val property = state.properties.first { it.id == viewing.propertyId }
    val buyer = state.buyers.first { it.id == viewing.buyerId }
    Page {
        EstateDemoPhoto(property.id, Modifier.fillMaxWidth().height(164.dp))
        EstatePageHeader(property.address, viewing.at.atZone(vm.zone).format(DateTimeFormatter.ofPattern("EEEE d MMMM · HH:mm")))
        EstateStatusBadge(viewing.status)
        Text("Meeting point: ${viewing.location}")
        Text("Assigned agent: Fictional demo agent")
        EstateContextRow(buyer.name, "Open buyer requirements") { go(demoDetail("buyer", buyer.id)) }
        EstateContextRow("Property overview", property.suburb) { go(demoDetail("property", property.id)) }
        Text(viewing.notes.ifBlank { "No viewing notes." })
        Text("This example uses a fictional address; map navigation is unavailable. Live location intents require an authorised real address.", style = MaterialTheme.typography.bodyMedium)
        if (viewing.status == "scheduled") {
            OutlinedButton({ go(demoForm("viewing", viewing.propertyId, viewing.buyerId, viewing.id)) }, enabled = !state.busy) { Text("Reschedule demo viewing") }
            Text("Viewing outcome", style = MaterialTheme.typography.titleMedium)
            FilterChips(com.segmiq.sales.core.estate.VIEWING_OUTCOMES.map(::estateDisplayLabel), estateDisplayLabel(outcome), { label ->
                outcome = com.segmiq.sales.core.estate.VIEWING_OUTCOMES.first { estateDisplayLabel(it) == label }
            })
            OutlinedTextField(feedback, { feedback = it.take(2000) }, Modifier.fillMaxWidth(), minLines = 3, label = { Text("Viewing outcome and feedback") })
            SegmiqPrimaryButton("Review completion", { confirm = "complete" }, enabled = !state.busy && feedback.isNotBlank())
            TextButton({ confirm = "cancel" }, enabled = !state.busy) { Text("Cancel demo viewing") }
        }
        EstateContextRow("Create follow-up", "Keep the buyer conversation moving") { go(demoForm("followup", buyer = buyer.id)) }
        EstateContextRow("Prepare offer", "For this property and buyer") { go(demoForm("offer", property.id, buyer.id)) }
        DemoCopilotContext(go)
        EstateGateNotice("Meeting recording unavailable", "Audio capture has not been implemented and verified. No recording is started.")
    }
    confirm?.let { action -> DemoConfirmation(
        if (action == "complete") "Complete this fictional viewing?" else "Cancel this fictional viewing?",
        "Only the local preview changes. No customer notification is sent.",
        { confirm = null }, { confirm = null; if (action == "complete") vm.completeViewing(viewing.id, feedback, outcome) else vm.cancelViewing(viewing.id) }) }
}

@Composable
private fun OfferDetail(offer: EstateOffer, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit) {
    var confirmation by remember { mutableStateOf<String?>(null) }
    var amount by rememberSaveable { mutableStateOf(offer.amount.toPlainString()) }
    val property = state.properties.first { it.id == offer.propertyId }
    Page {
        EstateDemoPhoto(property.id, Modifier.fillMaxWidth().height(164.dp))
        EstatePageHeader(property.address, "Fictional negotiation · USD")
        Text(estateAmount(offer.amount), style = MaterialTheme.typography.headlineLarge)
        EstateStatusBadge(offer.status)
        Text(offer.conditions.ifBlank { "No conditions in this example." })
        EstateContextRow("Buyer context", state.buyers.first { it.id == offer.buyerId }.name) { go(demoDetail("buyer", offer.buyerId)) }
        SectionTitle("Negotiation history")
        EstateTimeline(offer.history)
        if (offer.status == "draft") SegmiqPrimaryButton("Review demo submission", { confirmation = "submitted" }, enabled = !state.busy)
        if (offer.status in setOf("submitted", "countered", "negotiating")) {
            OutlinedTextField(amount, { amount = it.take(16) }, label = { Text("Demo counteroffer · USD") },
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal))
            OutlinedButton({ confirmation = "countered" }, enabled = !state.busy && estateDecimal(amount)?.signum() == 1) { Text("Review counteroffer") }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button({ confirmation = "accepted" }, enabled = !state.busy) { Text("Review acceptance") }
                OutlinedButton({ confirmation = "rejected" }, enabled = !state.busy) { Text("Review decline") }
            }
        }
        if (offer.status == "accepted") {
            val txn = state.transactions.firstOrNull { it.offerId == offer.id }
            if (txn != null) EstateContextRow("Transaction progress", "Open linked milestones and documents") { go(demoDetail("transaction", txn.id)) }
            else SegmiqPrimaryButton("Create demo transaction", { vm.startTransaction(offer.id) }, enabled = !state.busy)
        }
        EstateContextRow("Create follow-up", "Review a next action for the buyer") { go(demoForm("followup", buyer = offer.buyerId)) }
        DemoCopilotContext(go)
    }
    confirmation?.let { next -> DemoConfirmation("Review fictional offer decision",
        "Set this example to $next${if (next == "countered") " at USD $amount" else ""}? No financial commitment or message is sent.",
        { confirmation = null }, { confirmation = null; vm.changeOffer(offer.id, offer.status, next, if (next == "countered") estateDecimal(amount) else null) }) }
}

@Composable
private fun IntroductionDetail(intro: EstateIntroduction, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit) {
    var reason by rememberSaveable { mutableStateOf("") }
    var confirm by remember { mutableStateOf<String?>(null) }
    val received = intro.reviewer == "demo-agent" && intro.requester != "demo-agent"
    Page {
        EstatePageHeader("Agent introduction", state.properties.first { it.id == intro.propertyId }.address)
        EstateStatusBadge(intro.status)
        Text(if (received) "Requested by: Fictional partner agent\nReviewer: You" else "Requested by: You\nReviewer: Fictional listing agent")
        Text("Purpose: introduce a relevant buyer for this property.")
        if (received) EstateContextRow("Your buyer", "Review requirements before deciding") { go(demoDetail("buyer", intro.buyerId)) }
        else EstateGateNotice("Private buyer", "Names, phone numbers and the full buyer workspace are not disclosed by a pending introduction.")
        EstateTimeline(listOf("Fictional request created") + if (intro.status != "pending") listOf("Decision: ${intro.status}", intro.reason) else emptyList())
        if (received && intro.status == "pending") {
            OutlinedTextField(reason, { reason = it.take(500) }, Modifier.fillMaxWidth(), label = { Text("Decision reason (required to decline)") }, minLines = 2)
            SegmiqPrimaryButton("Review approval", { confirm = "accepted" }, enabled = !state.busy)
            OutlinedButton({ confirm = "declined" }, enabled = !state.busy && reason.isNotBlank()) { Text("Review decline") }
        } else Text("You cannot submit another decision for this request.", style = MaterialTheme.typography.bodyMedium)
    }
    confirm?.let { decision -> DemoConfirmation("Confirm fictional decision", "A request can be decided once. This changes only the local example.",
        { confirm = null }, { confirm = null; vm.decideIntroduction(intro.id, intro.status, decision, reason) }) }
}

@Composable
private fun TransactionDetail(txn: EstateTransaction, state: EstateDemoState, vm: EstateDemoViewModel, go: (String) -> Unit, compliance: Boolean) {
    var milestone by remember { mutableStateOf<EstateMilestone?>(null) }
    Page {
        EstateDemoPhoto(txn.propertyId, Modifier.fillMaxWidth().height(164.dp), page = 2)
        EstatePageHeader(if (compliance) "Compliance review" else "Transaction progress", state.properties.first { it.id == txn.propertyId }.address)
        EstateStatusBadge(txn.status)
        if (!compliance) {
            SectionTitle("Milestones")
            EstateMilestoneProgress(txn.milestones) { if (it.status != "done") milestone = it }
            Text("Example milestones follow SegmiQ's published sale workflow. Production stages must come from the server.", style = MaterialTheme.typography.bodyMedium)
            EstateContextRow("Compliance checklist", "Review example requirements and document state") { go(demoDetail("compliance", txn.id)) }
        } else {
            EstateGateNotice("Review required", "Submitted documents are not verified. A permitted reviewer must make any production compliance decision.")
            Text("Responsible party: Fictional compliance reviewer")
        }
        SectionTitle("Documents")
        txn.documents.forEach { document -> EstateDocumentRow(document) { go("document/${txn.id}/${document.id}") } }
        OutlinedButton({ vm.attachExample(txn.id) }, enabled = !state.busy) { Text("Add example attachment") }
        Text("Records fictional metadata only. No private file is selected, uploaded or approved.", style = MaterialTheme.typography.labelSmall)
        EstateContextRow("Related offer", "Open the accepted offer and history") { go(demoDetail("offer", txn.offerId)) }
        EstateContextRow("Buyer", "Open authorised fictional requirements") { go(demoDetail("buyer", txn.buyerId)) }
        EstateContextRow("Create follow-up", "Add a reviewed buyer commitment") { go(demoForm("followup", buyer = txn.buyerId)) }
        DemoCopilotContext(go)
    }
    milestone?.let { row -> DemoConfirmation("Review example milestone", "Mark “${row.label}” done only in this fictional preview? This cannot complete a real transaction.",
        { milestone = null }, { milestone = null; vm.milestone(txn.id, row.id) }) }
}

@Composable
fun EstateDemoDocument(transactionId: String, documentId: String, state: EstateDemoState) {
    val document = state.transactions.firstOrNull { it.id == transactionId }?.documents?.firstOrNull { it.id == documentId }
    Page {
        if (document == null) EstateGateNotice("Document unavailable", "No document is accessible in this example.")
        else {
            EstatePageHeader(document.title, "Fictional document preview")
            EstateStatusBadge(document.status)
            document.reason?.let { SegmiqErrorCard(it) }
            SegmiqCard {
                Icon(Icons.Rounded.Description, null, Modifier.size(48.dp))
                Text("SEGMIQ · FICTIONAL DOCUMENT", style = MaterialTheme.typography.titleLarge)
                Text("This is example document metadata. There is no customer identity document or downloadable file behind this preview.")
                HorizontalDivider()
                Text("Uploading does not mean approval. Production file viewing requires an authorised, expiring URL and app-private temporary storage.")
            }
            EstateGateNotice("Production file access gated", "No private document is downloaded, copied to a gallery, shared or retained.")
        }
    }
}

@Composable
private fun DemoCopilotContext(go: (String) -> Unit) = EstateContextRow("Sales Copilot", "No generated recommendations in this fictional preview") { go("copilot") }

@Composable
fun DemoConfirmation(title: String, message: String, dismiss: () -> Unit, confirm: () -> Unit) {
    AlertDialog(onDismissRequest = dismiss, title = { Text(title) }, text = { Text(message) },
        confirmButton = { TextButton(confirm) { Text("Confirm demo action") } },
        dismissButton = { TextButton(dismiss) { Text("Keep editing") } })
}
