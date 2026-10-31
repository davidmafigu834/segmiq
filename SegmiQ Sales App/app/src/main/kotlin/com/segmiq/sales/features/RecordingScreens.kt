package com.segmiq.sales.features

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MicNone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.data.Customer
import com.segmiq.sales.core.design.*
import com.segmiq.sales.ui.theme.*

enum class TranscriptStatus { NotAvailable, NotRequested, Processing, Completed, Failed }
data class TranscriptSegment(val startMs: Long, val endMs: Long, val speaker: String?, val text: String)
data class RecordingInsights(val summary: String?, val decisions: List<String>, val objections: List<String>, val suggestedActions: List<String>)
interface TranscriptionService {
    suspend fun request(recordingId: String): TranscriptStatus
    suspend fun segments(recordingId: String): List<TranscriptSegment>
}
sealed interface RecorderState {
    data object Unavailable : RecorderState
    data object Ready : RecorderState
    data class Recording(val elapsedMs: Long) : RecorderState
    data class Paused(val elapsedMs: Long) : RecorderState
    data object Finalising : RecorderState
    data class Saved(val recordingId: String) : RecorderState
    data class Error(val message: String) : RecorderState
}

@Composable
fun RecorderScreen(customers: List<Customer>, initialCustomer: String = "") {
    var title by rememberSaveable { mutableStateOf("Customer meeting") }
    var customer by rememberSaveable { mutableStateOf(customers.firstOrNull { it.id == initialCustomer }?.name ?: "Standalone") }
    var type by rememberSaveable { mutableStateOf("Meeting") }
    var participants by rememberSaveable { mutableStateOf("") }
    var purpose by rememberSaveable { mutableStateOf("") }
    var consent by rememberSaveable { mutableStateOf(false) }
    var notice by rememberSaveable { mutableStateOf(false) }
    SegmiqDarkWorkspace { Page {
        SegmiqGradientHero("Meeting recorder", "Microphone inactive · capture is not enabled.") {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                SegmiqBrandLogo(Modifier.size(40.dp), qOnly = true)
                SegmiqLabel("RECORDER PREVIEW · NO AUDIO CAPTURE", true)
            }
        }
        OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), label = { Text("Recording title") }, singleLine = true)
        SectionTitle("Related customer")
        FilterChips(listOf("Standalone") + customers.map { it.name }, customer) {
            customer = it
            title = if (it == "Standalone") "Customer meeting" else "Meeting with $it"
        }
        FilterChips(listOf("Meeting", "Site visit", "Voice note"), type) { type = it }
        OutlinedTextField(participants, { participants = it }, Modifier.fillMaxWidth(), label = { Text("Participants (optional)") })
        OutlinedTextField(purpose, { purpose = it }, Modifier.fillMaxWidth(), label = { Text("Meeting purpose") }, minLines = 2)
        Row {
            Checkbox(consent, { consent = it })
            Text("I will notify participants and obtain consent required by my organisation before recording.", Modifier.padding(top = 12.dp))
        }
        OutlinedButton({ notice = true }, Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("View recording availability") }
        Text("This demo does not open the microphone. Signed-in meeting recording uses the phone microphone and stays on the device.", style = MaterialTheme.typography.bodyMedium)
        if (notice) SegmiqEmptyState("Microphone stays off", "No audio file is created in this demo.")
    }
} }
@Composable
fun RecordingsScreen(go: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    Page {
        SegmiqGradientHero("Recordings", "This demo library does not record. Signed-in meetings use the phone microphone.")
        SegmiqSearchField(query, { query = it }, "Search recordings")
        SegmiqEmptyState("No demo recordings", "Nothing is stored here. The setup screen does not open the microphone.")
        SegmiqPrimaryButton("Open recorder setup", { go("recorder") }, Modifier.fillMaxWidth())
    }
}
