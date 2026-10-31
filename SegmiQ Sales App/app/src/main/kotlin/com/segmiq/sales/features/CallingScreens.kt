package com.segmiq.sales.features

import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Backspace
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.data.*
import com.segmiq.sales.core.phone.PhoneNumbers
import com.segmiq.sales.core.design.*
import com.segmiq.sales.ui.theme.*
import kotlinx.coroutines.delay

enum class RecordingSupport { Supported, Unsupported, PermissionRequired, ConsentRequired, ConfigurationUnsupported, Error }
interface CallRecordingCapability { fun status(): RecordingSupport }
class DemoCallRecordingCapability : CallRecordingCapability { override fun status() = RecordingSupport.Unsupported }

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DialerScreen(data: DemoState, go: (String) -> Unit) {
    var tab by rememberSaveable { mutableStateOf("Keypad") }
    var number by rememberSaveable { mutableStateOf("") }
    var search by rememberSaveable { mutableStateOf("") }
    SegmiqDarkWorkspace {
        Scaffold(contentWindowInsets = WindowInsets(0, 0, 0, 0), containerColor = Ink,
            bottomBar = { if (tab == "Keypad") Surface(color = Ink) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SegmiqPrimaryButton("Start simulated call", {
                        val matched = data.customers.firstOrNull {
                            val typed = PhoneNumbers.dialable(number)
                            PhoneNumbers.dialable(it.phone) == typed || PhoneNumbers.sameSubscriber(it.phone, number, "ZW")
                        }
                        go("call/${matched?.id ?: "unknown"}?number=${android.net.Uri.encode(number)}")
                    }, Modifier.fillMaxWidth(), validPhone(number))
                    Text("DEMO CALLS ONLY", style = MaterialTheme.typography.labelSmall, color = Lime)
                }
            } }) { padding ->
            Box(Modifier.padding(padding).consumeWindowInsets(padding)) {
                Column(Modifier.widthIn(max = 680.dp).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)) {
                FilterChips(listOf("Keypad", "Contacts", "Recents"), tab) { tab = it }
                if (tab == "Keypad") {
                    DialPad(number, { number = it }, compact = true)
                } else if (tab == "Contacts") {
                    SegmiqSearchField(search, { search = it })
                    Text("Authorised demo CRM contacts only. Device contacts are not accessed.", style = MaterialTheme.typography.bodyMedium)
                    data.customers.filter { "${it.name} ${it.phone}".contains(search, true) }.forEach { c ->
                        CustomerRow(c, c.phone) { go("customer/${c.id}") }
                    }
                } else {
                    if (data.reviews.isEmpty()) SegmiqEmptyState("No demo call reviews yet", "Saved simulated call reviews appear here. Device call history is not accessed.")
                    data.reviews.reversed().forEach { r ->
                        SegmiqCard {
                            SegmiqLabel("SIMULATED · OUTGOING · NO AUDIO")
                            Text(data.customers.firstOrNull { it.id == r.customerId }?.name ?: "Unknown number", style = MaterialTheme.typography.titleMedium)
                            Text("${r.outcome} · ${r.seconds}s")
                            Text(r.createdAt, style = MaterialTheme.typography.labelSmall)
                            Text("Logged on this device", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            } }
        }
    }
}

@Composable
fun LiveCallScreen(customer: Customer?, dialedNumber: String = "", end: (Int) -> Unit) {
    var started by rememberSaveable { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    var seconds by rememberSaveable { mutableIntStateOf(0) }
    var mute by rememberSaveable { mutableStateOf(false) }
    var speaker by rememberSaveable { mutableStateOf(false) }
    var hold by rememberSaveable { mutableStateOf(false) }
    var keypad by rememberSaveable { mutableStateOf(false) }
    var digits by rememberSaveable { mutableStateOf("") }
    var confirm by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { while (true) { seconds = ((SystemClock.elapsedRealtime() - started).coerceAtLeast(0) / 1000).toInt(); delay(1000) } }
    BackHandler { confirm = true }
    SegmiqDarkWorkspace {
        Surface(Modifier.fillMaxSize(), color = Ink) {
            Page {
                SegmiqLabel("SIMULATED CALL · NO PHONE CONNECTION", true)
                Spacer(Modifier.height(16.dp))
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SegmiqAvatar(customer?.name ?: "Demo caller", Modifier)
                    Text(customer?.name ?: "Demo number", style = MaterialTheme.typography.headlineLarge)
                    Text(customer?.company ?: "Local demonstration")
                    Text(customer?.phone ?: dialedNumber.ifBlank { "No number dialled" }, color = Muted)
                    Text(if (hold) "Simulated hold" else "Demo in progress", color = Lime)
                    Text("%02d:%02d".format(seconds / 60, seconds % 60), fontSize = 52.sp, fontWeight = FontWeight.Light)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    CallControl("Mute", Icons.Rounded.MicOff, mute) { mute = !mute }
                    CallControl("Keypad", Icons.Rounded.Dialpad, keypad) { keypad = !keypad }
                    CallControl("Speaker", Icons.AutoMirrored.Rounded.VolumeUp, speaker) { speaker = !speaker }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { CallControl("Hold", Icons.Rounded.Pause, hold) { hold = !hold } }
                if (keypad) {
                    Text(digits.ifBlank { "Demo keypad · no tones sent" })
                    listOf("123", "456", "789", "*0#").forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) { row.forEach { d -> TextButton({ digits += d }) { Text("$d", color = WarmWhite, fontSize = 24.sp) } } }
                    }
                }
                SegmiqCard {
                    Text("Customer context", style = MaterialTheme.typography.titleMedium)
                    Text(DemoFixtures.opportunities.firstOrNull { it.customerId == customer?.id }?.nextAction ?: "Review the customer’s next step after this demo.")
                    Text("Controls change demo UI only. No audio is captured.", style = MaterialTheme.typography.bodyMedium)
                }
                Button({ end(seconds) }, Modifier.fillMaxWidth().heightIn(min = 56.dp), colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color(0xFFF04D57))) {
                    Icon(Icons.Rounded.CallEnd, null); Spacer(Modifier.width(8.dp)); Text("End simulated call")
                }
            }
        }
        if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("End simulated call?") },
            text = { Text("Continue to the call review to save the outcome locally.") },
            confirmButton = { TextButton({ confirm = false; end(seconds) }) { Text("End demo") } },
            dismissButton = { TextButton({ confirm = false }) { Text("Continue") } })
    }
}
@Composable
fun CallControl(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, selected: Boolean, click: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        FilledTonalIconToggleButton(selected, { click() }, Modifier.size(56.dp)) { Icon(icon, label) }
        Text(label, style = MaterialTheme.typography.labelSmall)
    }
}
@Composable
fun CallReviewScreen(customer: Customer?, seconds: Int, saved: Boolean, saving: Boolean, go: (String) -> Unit, save: (String, String) -> Unit) {
    var outcome by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    Page {
        SegmiqLabel("SIMULATED CALL · NO AUDIO", true)
        Text(customer?.name ?: "Demo number", style = MaterialTheme.typography.headlineLarge)
        SegmiqGradientHero("Review the conversation", "Outgoing demo · ${seconds}s · Ended") {
            Text("No phone activity was observed. This duration belongs only to the simulation.", style = MaterialTheme.typography.bodyMedium)
        }
        if (saved) {
            SegmiqEmptyState("Review saved on this device", "No production call log was created.")
            SegmiqPrimaryButton("Back to My Day", { go("home") })
        } else {
            SectionTitle("How did it go?")
            FilterChips(listOf("Interested", "Not now", "No answer", "Busy", "Meeting booked",
                "Proposal requested", "Follow-up required", "Not interested", "Wrong number"), outcome) { outcome = it }
            OutlinedTextField(notes, { notes = it }, Modifier.fillMaxWidth(), label = { Text("Write what happened during the call…") }, minLines = 4)
            Text("No recording exists for this simulated call.", style = MaterialTheme.typography.bodyMedium)
            SegmiqPrimaryButton(if (saving) "Saving…" else "Save review locally", { save(outcome, notes) }, Modifier.fillMaxWidth(), outcome.isNotEmpty() && !saving)
        }
        SectionTitle("Next action")
        SegmiqActionRow("Create follow-up", "Choose a customer and due time", Icons.Rounded.CheckCircleOutline) { go("followup?customer=${customer?.id.orEmpty()}") }
        SegmiqActionRow("Plan meeting", "Review the sample schedule", Icons.Rounded.Event) { go("meetings") }
        SegmiqActionRow("Prepare quotation", "Check service availability", Icons.Rounded.Description) { go("quotation") }
    }
}
