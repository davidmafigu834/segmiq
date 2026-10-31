package com.segmiq.sales.features.realestate

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.core.estate.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.core.network.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate

const val ESTATE_SERVER_ROUTE = "live/estate/{resource}/{id}?buyer={buyer}"
fun estateServerRoute(link: EstateLink): String = link.sharedRoute ?: "live/estate/${link.resource.name}/${Uri.encode(link.id ?: "_directory")}" +
    (link.buyerContext?.let { "?buyer=${Uri.encode(it)}" } ?: "")
fun estateResource(module: com.segmiq.sales.core.bootstrap.LiveModule): EstateResource? =
    EstateResource.entries.firstOrNull { it.module == module && it != EstateResource.COMPLIANCE }

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun EstateServerScreen(vm: EstateServerViewModel, go: (String) -> Unit) {
    val s by vm.state.collectAsStateWithLifecycle()
    val transactionLookup by vm.transactionLookup.collectAsStateWithLifecycle()
    var query by rememberSaveable { mutableStateOf("") }
    var review by remember { mutableStateOf<String?>(null) }
    var reason by rememberSaveable { mutableStateOf("") }
    var offerReview by remember { mutableStateOf<String?>(null) }
    var offerAmount by rememberSaveable { mutableStateOf("") }
    var noteReview by remember { mutableStateOf(false) }
    var outcome by rememberSaveable { mutableStateOf("interested") }
    var pickDate by remember { mutableStateOf(false) }
    var editRequirements by rememberSaveable { mutableStateOf(false) }
    var booking by rememberSaveable { mutableStateOf(false) }
    var listingForm by rememberSaveable { mutableStateOf(false) }
    var introForm by rememberSaveable { mutableStateOf(false) }
    var offerForm by rememberSaveable { mutableStateOf(false) }
    val access = vm.repository.access
    val blocked = access.reason(vm.target.resource)
    val page = s.page
    val created by vm.createdRecord.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(created) {
        val link = created ?: return@LaunchedEffect
        vm.clearCreated()
        listingForm = false; introForm = false; offerForm = false
        go(estateServerRoute(link))
    }
    val fontScale = LocalDensity.current.fontScale.coerceAtLeast(1f)
    val canSearch = vm.target.id == null && vm.target.buyerContext == null &&
        vm.target.resource in setOf(EstateResource.PROPERTIES, EstateResource.BUYERS, EstateResource.OFFERS, EstateResource.TRANSACTIONS)
    LazyColumn(Modifier.fillMaxSize().then(Modifier.testTag("estate-server-list")), contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { EstatePageHeader(page?.heading ?: vm.target.resource.label,
            page?.summary?.let { if (vm.target.id != null && vm.target.resource in setOf(EstateResource.TRANSACTIONS, EstateResource.INTRODUCTIONS)) estateDisplayLabel(it) else it }
                ?: "Your authorised SegmiQ workspace") }
        if (blocked != null) {
            item { EstateGateNotice("Mobile release verification required", blocked) }
            return@LazyColumn
        }
        if (vm.target.id != null && vm.target.resource in setOf(EstateResource.PROPERTIES, EstateResource.BUYERS, EstateResource.VIEWINGS)) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton({ go("live/copilot") }) { Text("Sales Copilot") }
                    if (vm.target.resource == EstateResource.VIEWINGS) TextButton({ go("live/recorder") }) { Text("Record meeting") }
                }
            }
        }
        if (vm.target.resource == EstateResource.CALENDAR) {
            item {
                SegmiqWeekStrip(vm.date, if (page?.cards?.isNotEmpty() == true) setOf(vm.date) else emptySet(), { vm.selectDate(it) }, knownDates = emptySet())
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    IconButton({ vm.selectDate(vm.date.minusWeeks(1)) }) { Icon(Icons.Rounded.ChevronLeft, "Previous week") }
                    OutlinedButton({ vm.selectDate(LocalDate.now(vm.repository.workspace.zone)) }) { Text("Today") }
                    IconButton({ pickDate = true }) { Icon(Icons.Rounded.CalendarMonth, "Choose date") }
                    IconButton({ vm.selectDate(vm.date.plusWeeks(1)) }) { Icon(Icons.Rounded.ChevronRight, "Next week") }
                }
            }
        } else if (vm.target.resource == EstateResource.INTRODUCTIONS && vm.target.id == null) {
            item { FilterChips(listOf("All", "Received", "Sent"), query.ifBlank { "All" }, {
                query = if (it == "All") "" else it
                vm.search(query)
            }) }
        } else if (canSearch) {
            item {
                SegmiqSearchField(query, { query = it }, "Search ${vm.target.resource.label.lowercase()}")
                if (vm.target.resource == EstateResource.PROPERTIES) {
                    var statusLabel by rememberSaveable { mutableStateOf("All") }
                    FilterChips(listOf("All", "Available", "Reserved", "Under offer", "Sold", "Let"), statusLabel) {
                        statusLabel = it
                        vm.search(query, when (it) {
                            "Available" -> "available"
                            "Reserved" -> "reserved"
                            "Under offer" -> "under_offer"
                            "Sold" -> "sold"
                            "Let" -> "let"
                            else -> null
                        })
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextButton({ vm.search(query) }, enabled = !s.loading) { Text("Search") }
                    TextButton({ vm.load() }, enabled = !s.loading && !s.pending) {
                        Icon(Icons.Rounded.Refresh, null); Spacer(Modifier.width(8.dp)); Text("Refresh")
                    }
                }
            }
        }
        if (!canSearch) item {
            TextButton({ vm.load() }, enabled = !s.loading && !s.pending) {
                Icon(Icons.Rounded.Refresh, null); Spacer(Modifier.width(8.dp)); Text("Refresh")
            }
        }
        if (s.loading) item { SegmiqSkeleton(if (vm.target.id == null) 3 else 2) }
        s.error?.let { error ->
            item {
                EstateGateNotice(when (error.kind) {
                    ErrorKind.FORBIDDEN -> "Access unavailable"
                    ErrorKind.SESSION_ENDED -> "Session expired"
                    ErrorKind.CONFLICT, ErrorKind.STALE -> "Record changed · refresh required"
                    ErrorKind.OFFLINE, ErrorKind.TIMEOUT -> "Connection unavailable"
                    else -> "Couldn't load this workspace"
                }, error.screenMessage())
                TextButton({ vm.load() }, enabled = !s.pending) { Text("Retry") }
            }
        }
        if (s.pending) item { Text("Waiting for SegmiQ confirmation…"); LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (s.saved) item { SegmiqLabel("LAST CHANGE CONFIRMED BY SEGMIQ") }
        page?.let { p ->
            if (p.bounded) item { SegmiqLabel("PARTIAL RESULTS · SOME RECORDS MAY NOT BE SHOWN") }
            p.listing?.let { l ->
                item {
                    val pager = rememberPagerState { l.images.size.coerceAtLeast(1) }
                    HorizontalPager(pager, Modifier.fillMaxWidth().height(if (l.images.isEmpty() || access.imageHost() == null) (104 * fontScale).dp else 224.dp)) { index ->
                        EstatePrivatePhoto(vm.repository, l, index, Modifier.fillMaxSize())
                    }
                    if (l.images.isNotEmpty()) Text("${pager.currentPage + 1} / ${l.images.size}", style = MaterialTheme.typography.labelMedium)
                    if (l.legacyImagesGated) Text("Older photographs are unavailable until their private-storage migration is verified.", style = MaterialTheme.typography.bodyMedium)
                }
            }
            if (p.facts.isNotEmpty()) item {
                SegmiqCard { EstateFactRows(p.facts) }
            }
            p.dialPhone?.let { phone ->
                item {
                    OutlinedButton({
                        runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone)))) }
                    }, Modifier.fillMaxWidth()) { Icon(Icons.Rounded.Call, null); Spacer(Modifier.width(8.dp)); Text("Call") }
                }
            }
            if (p.milestones.isNotEmpty()) item {
                SegmiqCard {
                    Text("Transaction milestones", style = MaterialTheme.typography.titleLarge)
                    p.milestones.forEach {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(if (it.status == "done") Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null)
                            Column { Text(it.label, style = MaterialTheme.typography.titleMedium); EstateStatusBadge(it.status)
                                it.notes?.let { note -> Text(note) } }
                        }
                    }
                    Text("Progression remains subject to server validation.", style = MaterialTheme.typography.bodyMedium)
                }
            }
            items(p.paragraphs) { Text(it, style = MaterialTheme.typography.bodyMedium) }
            items(p.cards, key = { it.key }) { card ->
                Surface(onClick = { if (card.opensRecord) go(estateServerRoute(card.link)) }, enabled = card.opensRecord,
                    shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
                    Column {
                        card.listing?.let { listing ->
                            EstatePrivatePhoto(vm.repository, listing, listing.images.indexOfFirst { it.cover }.coerceAtLeast(0),
                                Modifier.fillMaxWidth().height(if (listing.images.isEmpty() || access.imageHost() == null) (80 * fontScale).dp else 168.dp))
                        }
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            EstateRecordIdentity(card)
                            card.listing?.let { l ->
                                l.suburb?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    l.bedrooms?.let { EstateAttribute(Icons.Rounded.Bed, "$it beds") }
                                    l.bathrooms?.let { EstateAttribute(Icons.Rounded.Bathtub, "$it baths") }
                                    l.size_sqm?.let { EstateAttribute(Icons.Rounded.SquareFoot, "${it.toPlainString()} m²") }
                                }
                            }
                        }
                    }
                }
            }
            p.links.forEach { (label, link) ->
                if (access.reason(link.resource) == null) item {
                    EstateContextRow(label, "Open authorised context") { go(estateServerRoute(link)) }
                }
            }
            if (p.cards.isEmpty() && vm.target.id == null && !s.loading && s.error == null) item {
                SegmiqEmptyState("No ${vm.target.resource.label.lowercase()}",
                    "No records were returned for this request. Change your search or refresh.")
            }
            if (p.hasNext) item { SegmiqPrimaryButton("Load more", { vm.nextPage() }, enabled = !s.loading) }
            p.buyer?.let {
                item {
                    if (access.reason(EstateResource.BUYERS, write = true) == null)
                        OutlinedButton({ editRequirements = true }, enabled = !s.pending) { Text("Edit requirements") }
                    else Text("Requirements editing awaits verified production write acceptance.", style = MaterialTheme.typography.bodyMedium)
                    if (access.reason(EstateResource.INTRODUCTIONS, write = true) == null && access.reason(EstateResource.PROPERTIES) == null)
                        OutlinedButton({ introForm = true }, enabled = !s.pending) { Text("Request introduction") }
                    else Text("Introduction requests stay closed until write acceptance for this revision.", style = MaterialTheme.typography.bodyMedium)
                    if (it.contact_id == null) Text("This buyer search has no contact id, so an offer cannot be created.")
                    else if (access.reason(EstateResource.OFFERS, write = true) == null && access.reason(EstateResource.PROPERTIES) == null)
                        OutlinedButton({ offerForm = true }, enabled = !s.pending) { Text("Create offer") }
                    else Text("Offer creation stays closed until write acceptance for this revision.", style = MaterialTheme.typography.bodyMedium)
                }
            }
            p.listing?.let { listing ->
                item {
                    if (listing.permittedActions.edit && access.reason(EstateResource.PROPERTIES, write = true) == null)
                        OutlinedButton({ listingForm = true }, enabled = !s.pending) { Text("Edit property") }
                    else if (!listing.permittedActions.edit) Text("This listing is not editable for your account.", style = MaterialTheme.typography.bodyMedium)
                    else Text(access.reason(EstateResource.PROPERTIES, write = true) ?: "", style = MaterialTheme.typography.bodyMedium)
                    if (access.reason(EstateResource.INTRODUCTIONS, write = true) == null && access.reason(EstateResource.BUYERS) == null)
                        OutlinedButton({ introForm = true }, enabled = !s.pending) { Text("Request introduction") }
                    if (access.reason(EstateResource.OFFERS, write = true) == null && access.reason(EstateResource.BUYERS) == null)
                        OutlinedButton({ offerForm = true }, enabled = !s.pending) { Text("Create offer") }
                }
            }
            if (vm.target.id == null && vm.target.resource == EstateResource.PROPERTIES) item {
                if (access.reason(EstateResource.PROPERTIES, write = true) == null)
                    OutlinedButton({ listingForm = true }, enabled = !s.pending) { Text("New property") }
                else Text("New listings stay closed until write acceptance for this revision.", style = MaterialTheme.typography.bodyMedium)
            }
            if ((p.listing != null || p.buyer != null) && p.viewing == null) item {
                if (access.reason(EstateResource.VIEWINGS, write = true) == null &&
                    access.reason(EstateResource.PROPERTIES) == null && access.reason(EstateResource.BUYERS) == null)
                    SegmiqPrimaryButton("Schedule viewing", { booking = true }, enabled = !s.pending)
                else Text("Viewing scheduling awaits verified booking acceptance.", style = MaterialTheme.typography.bodyMedium)
            }
            p.offer?.let { offer ->
                if (offer.status == "accepted") item {
                    if (access.reason(EstateResource.TRANSACTIONS) == null) {
                        OutlinedButton(vm::findLinkedTransactions, enabled = !transactionLookup.loading) { Text("Find linked transaction") }
                        transactionLookup.records.forEach { transaction ->
                            EstateContextRow(transaction.propertyLabel, transaction.statusLabel) {
                                go(estateServerRoute(EstateLink(EstateResource.TRANSACTIONS, transaction.id)))
                            }
                        }
                        if (transactionLookup.checked && transactionLookup.records.isEmpty())
                            Text("No linked transaction in the returned records. This bounded feed cannot prove that none exists. Continue in your authorised web workspace.")
                        transactionLookup.error?.let { Text(it.message) }
                    } else Text("Transaction discovery awaits verified read acceptance. No transaction is created here.")
                }
                if (access.reason(EstateResource.OFFERS, write = true) == null) {
                    offer.permittedActions.filter { it in setOf("submit", "counter", "accept", "reject", "withdraw", "note") }.forEach { action ->
                        item { OutlinedButton({ reason = ""; offerAmount = ""; offerReview = action }, enabled = !s.pending) {
                            Text("Review " + action.replaceFirstChar { it.uppercase() })
                        } }
                    }
                }
            }
            p.transaction?.let { transaction ->
                if (access.reason(EstateResource.TRANSACTIONS, write = true) == null && "update_notes" in transaction.permittedActions)
                    item { OutlinedButton({ reason = transaction.notes.orEmpty(); noteReview = true }, enabled = !s.pending) { Text("Edit transaction note") } }
            }
            p.viewing?.let { viewing ->
                if (access.reason(EstateResource.VIEWINGS, write = true) == null && viewing.access == "full" &&
                    "reschedule_viewing" in viewing.permittedActions) item {
                    OutlinedButton({ booking = true }, enabled = !s.pending) { Text("Reschedule viewing") }
                }
                if (access.reason(EstateResource.VIEWINGS, write = true) == null && viewing.access == "full" &&
                    "viewing_outcome" in viewing.permittedActions) item {
                    OutlinedButton({ reason = ""; review = "viewing" }, enabled = !s.pending) { Text("Review viewing outcome") }
                }
            }
            p.introduction?.let { intro ->
                if (access.reason(EstateResource.INTRODUCTIONS, write = true) == null && !intro.ownRequest && intro.status == "requested") {
                    if (intro.canApprove) item { SegmiqPrimaryButton("Review approval", { review = "accepted" }, enabled = !s.pending) }
                    if (intro.canDecline) item { OutlinedButton({ review = "declined" }, enabled = !s.pending) { Text("Review decline") } }
                }
            }
        }
    }
    if (editRequirements && s.page?.buyer != null) EstateLiveRequirementsSheet(vm) { editRequirements = false }
    if (booking) EstateLiveBookingSheet(vm, { booking = false }, go)
    if (listingForm) EstateListingSheet(vm) { listingForm = false }
    if (introForm) EstateIntroductionSheet(vm) { introForm = false }
    if (offerForm) EstateOfferSheet(vm) { offerForm = false }
    review?.let { decision ->
        AlertDialog(onDismissRequest = { if (!s.pending) review = null },
            title = { Text(if (decision == "viewing") "Save viewing outcome?" else if (decision == "accepted") "Approve introduction?" else "Decline introduction?") },
            text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("SegmiQ rechecks your permissions and the current state. No customer WhatsApp is requested.")
                if (decision == "viewing") FilterChips(VIEWING_OUTCOMES.toList(), outcome, { outcome = it })
                OutlinedTextField(reason, { reason = it.take(500) }, label = { Text("Reason ${if (decision == "declined") "(required)" else "(optional)"}") })
            } },
            confirmButton = { TextButton({
                if (decision == "viewing") vm.completeViewing(outcome, reason) else vm.reviewIntroduction(decision, reason)
                review = null
            }, enabled = !s.pending && (decision != "declined" || reason.isNotBlank())) { Text("Confirm") } },
            dismissButton = { TextButton({ review = null }) { Text("Cancel") } })
    }
    if (pickDate) {
        val dateState = rememberDatePickerState(initialSelectedDateMillis = vm.date.toEpochDay() * 86_400_000L)
        DatePickerDialog(onDismissRequest = { pickDate = false },
            confirmButton = { TextButton({
                dateState.selectedDateMillis?.let { vm.selectDate(LocalDate.ofEpochDay(it / 86_400_000L)) }
                pickDate = false
            }) { Text("Select date") } },
            dismissButton = { TextButton({ pickDate = false }) { Text("Cancel") } }) { DatePicker(dateState) }
    }
    offerReview?.let { action ->
        OfferConfirmation(action, offerAmount, { offerAmount = it }, reason, { reason = it }, s.pending,
            cancel = { offerReview = null },
            confirm = { vm.offerAction(action, offerAmount.toBigDecimalOrNull(), reason); offerReview = null })
    }
    if (noteReview) AlertDialog(onDismissRequest = { noteReview = false },
        title = { Text("Save transaction note?") },
        text = { OutlinedTextField(reason, { reason = it.take(5000) }, label = { Text("Notes · maximum 5000 characters") }) },
        confirmButton = { TextButton({ vm.transactionNote(reason); noteReview = false }, enabled = !s.pending) { Text("Save with SegmiQ") } },
        dismissButton = { TextButton({ noteReview = false }) { Text("Cancel") } })
}

@Composable
private fun OfferConfirmation(action: String, amount: String, setAmount: (String) -> Unit, note: String,
    setNote: (String) -> Unit, pending: Boolean, cancel: () -> Unit, confirm: () -> Unit) {
    val validAmount = amount.toBigDecimalOrNull()?.signum() == 1
    AlertDialog(onDismissRequest = cancel, title = { Text("Confirm " + action.replace('_', ' ') + "?") },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("SegmiQ must confirm the decision before it changes. Acceptance can reserve the property and start a transaction. No separate notification request is sent.")
            if (action == "counter") OutlinedTextField(amount, { setAmount(it.take(30)) }, label = { Text("Counter amount") }, singleLine = true)
            OutlinedTextField(note, { setNote(it.take(2000)) }, label = { Text("Note / reason") })
        } },
        confirmButton = { TextButton(confirm, enabled = !pending && (action != "counter" || validAmount)) { Text("Confirm with SegmiQ") } },
        dismissButton = { TextButton(cancel, enabled = !pending) { Text("Cancel") } })
}

/** Neutral placeholder until BOTH release and private bucket/host acceptance exist. */
@Composable
fun EstatePrivatePhoto(repository: EstateRepository, listing: ListingDto, position: Int, modifier: Modifier) {
    var retry by remember(listing.id, position) { mutableIntStateOf(0) }
    val reference = listing.images.getOrNull(position)
    val host = repository.access.imageHost()
    val bitmap by produceState<Bitmap?>(null, repository, listing.id, reference?.index, retry) {
        value = null
        if (reference != null && host != null) {
            val metadata = repository.image(listing.id, reference.index)
            if (metadata is ApiResult.Success) {
                val result = PrivateListingImageClient(host).fetch(metadata.value)
                if (result is ApiResult.Success) value = withContext(Dispatchers.IO) {
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeByteArray(result.value, 0, result.value.size, bounds)
                    if (bounds.outWidth <= 0 || bounds.outHeight <= 0 ||
                        bounds.outWidth.toLong() * bounds.outHeight > 80_000_000L) null else {
                        var sample = 1
                        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1440) sample *= 2
                        BitmapFactory.decodeByteArray(result.value, 0, result.value.size,
                            BitmapFactory.Options().apply { inSampleSize = sample })
                    }
                }
            }
        }
    }
    val photoAlpha by animateFloatAsState(if (bitmap == null) 0f else 1f, tween(260), label = "Private photo reveal")
    Box(modifier.clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center) {
        bitmap?.let { image ->
            Image(image.asImageBitmap(), listing.address?.let { "Property at $it" } ?: "Authorised property photograph",
                Modifier.fillMaxSize().graphicsLayer { alpha = photoAlpha }, contentScale = ContentScale.Crop)
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = .18f)))))
        } ?: Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Rounded.HomeWork, null, Modifier.size(40.dp))
            Text("No listing photograph available", style = MaterialTheme.typography.labelMedium)
            if (reference != null && host != null) TextButton({ retry++ }) { Text("Retry photograph") }
        }
    }
}
