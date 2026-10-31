package com.segmiq.sales.features.recorder

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.audio.CapturePhase
import com.segmiq.sales.core.audio.MeetingRecordingService
import com.segmiq.sales.core.audio.RecordingLibrary
import com.segmiq.sales.core.audio.RecordingSessionBus
import com.segmiq.sales.core.audio.StoredRecording
import com.segmiq.sales.core.design.*
import com.segmiq.sales.ui.theme.ForestDeep
import com.segmiq.sales.ui.theme.Ink
import com.segmiq.sales.ui.theme.Lime
import java.text.DateFormat
import java.util.Date

@Composable
fun LiveRecorderScreen(userId: String, orgId: String, customerId: String?, customerLabel: String?, repository: com.segmiq.sales.core.estate.EstateRepository? = null, onSaved: (String) -> Unit) {
    val context = LocalContext.current
    val phase by RecordingSessionBus.phase.collectAsStateWithLifecycle()
    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    var title by rememberSaveable { mutableStateOf(customerLabel?.let { "Meeting with $it" } ?: "Meeting") }
    var property by rememberSaveable { mutableStateOf("") }
    var propertyId by rememberSaveable { mutableStateOf<String?>(null) }
    var listings by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
    var consent by rememberSaveable { mutableStateOf(false) }
    val active = phase.phase == CapturePhase.RECORDING || phase.phase == CapturePhase.PAUSED || phase.phase == CapturePhase.STOPPING
    LaunchedEffect(repository) {
        val repo = repository ?: return@LaunchedEffect
        listings = (repo.properties() as? com.segmiq.sales.core.network.ApiResult.Success)?.value?.listings
            ?.map { it.id to (it.address ?: "Listing") }.orEmpty()
    }
    SegmiqDarkWorkspace {
        Page {
            SegmiqBrandLogo(Modifier.size(36.dp), qOnly = true)
            Text("Meeting recorder", style = MaterialTheme.typography.headlineMedium, color = Lime)
            Text(statusLabel(phase.phase, granted), style = MaterialTheme.typography.titleMedium)
            Text(formatClock(phase.elapsedMs), style = MaterialTheme.typography.displaySmall, color = Warmish)
            AmplitudeWave(
                levels = if (phase.phase == CapturePhase.RECORDING || phase.phase == CapturePhase.PAUSED) phase.amplitudes else emptyList(),
                live = phase.phase == CapturePhase.RECORDING,
                frozen = phase.phase == CapturePhase.PAUSED,
            )
            if (!active) {
                OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), label = { Text("Title") }, singleLine = true)
                OutlinedTextField(property, { property = it; propertyId = null }, Modifier.fillMaxWidth(),
                    label = { Text(if (propertyId == null) "Property label (not a listing link)" else "Property label") }, singleLine = true)
                if (listings.isNotEmpty()) {
                    Text("First page of authorised listings. Choosing one stores that listing id.", style = MaterialTheme.typography.bodySmall, color = Warmish)
                    listings.take(8).forEach { (id, label) ->
                        FilterChip(propertyId == id, { propertyId = id; property = label }, label = { Text(label, maxLines = 1) })
                    }
                } else if (repository == null) {
                    Text("No authorised property list is available. A typed name is a label only.", style = MaterialTheme.typography.bodySmall, color = Warmish)
                }
                customerLabel?.let { Text("Linked customer: $it", color = Lime) }
                Row(Modifier.fillMaxWidth().clickable { consent = !consent }, verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(consent, { consent = it })
                    Text("I will tell everyone in the meeting before recording, and I will follow the law and my company policy.")
                }
            }
            phase.error?.let { SegmiqErrorCard(it) }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                FilledIconButton(
                    onClick = {
                        when (phase.phase) {
                            CapturePhase.RECORDING -> MeetingRecordingService.command(context, MeetingRecordingService.ACTION_PAUSE)
                            CapturePhase.PAUSED -> MeetingRecordingService.command(context, MeetingRecordingService.ACTION_RESUME)
                            else -> {
                                if (!granted) ask.launch(Manifest.permission.RECORD_AUDIO)
                                else MeetingRecordingService.start(context, userId, orgId, title, customerId, customerLabel, property.ifBlank { null }, propertyId)
                            }
                        }
                    },
                    enabled = active || (consent && title.isNotBlank()),
                    modifier = Modifier.size(72.dp),
                    colors = IconButtonDefaults.filledIconButtonColors(containerColor = Lime, contentColor = Ink),
                ) {
                    Icon(when (phase.phase) {
                        CapturePhase.RECORDING -> Icons.Rounded.Pause
                        CapturePhase.PAUSED -> Icons.Rounded.Mic
                        else -> Icons.Rounded.Mic
                    }, contentDescription = when (phase.phase) {
                        CapturePhase.RECORDING -> "Pause"
                        CapturePhase.PAUSED -> "Resume"
                        else -> "Start recording"
                    }, modifier = Modifier.size(32.dp))
                }
                if (active) {
                    OutlinedButton({ MeetingRecordingService.command(context, MeetingRecordingService.ACTION_STOP) }) { Text("Stop and save") }
                    TextButton({ MeetingRecordingService.command(context, MeetingRecordingService.ACTION_DISCARD) }) { Text("Discard") }
                }
            }
            Text("Audio stays on this phone. SegmiQ has no meeting-upload service, so nothing is transcribed or sent.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val saved = RecordingSessionBus.savedId
            if (saved != null && phase.phase == CapturePhase.READY) {
                SegmiqPrimaryButton("Open saved recording", { onSaved(saved) }, Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
fun LiveRecordingsScreen(userId: String, orgId: String, onOpen: (String) -> Unit, onRecord: () -> Unit) {
    val context = LocalContext.current
    val library = remember { RecordingLibrary(context) }
    var query by rememberSaveable { mutableStateOf("") }
    var rows by remember { mutableStateOf(emptyList<StoredRecording>()) }
    LaunchedEffect(userId, orgId) {
        library.recoverInterrupted()
        rows = library.list(userId, orgId)
    }
    Page {
        Text("Recordings", style = MaterialTheme.typography.headlineMedium)
        SegmiqSearchField(query, { query = it }, "Search recordings")
        val shown = rows.filter { "${it.title} ${it.customerLabel.orEmpty()} ${it.propertyLabel.orEmpty()}".contains(query, true) }
        if (shown.isEmpty()) SegmiqEmptyState("No meetings on this phone", "Recordings you save stay in this account. They are removed when you sign out.")
        shown.forEach { row ->
            SegmiqCard {
                Text(row.title, style = MaterialTheme.typography.titleMedium)
                Text(listOfNotNull(row.customerLabel, row.propertyLabel).joinToString(" · ").ifBlank { "Not linked" },
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("${DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(row.createdAtEpochMs))} · ${formatClock(row.durationMs)}",
                    style = MaterialTheme.typography.labelSmall)
                Text("On this phone · Upload unavailable · Transcript unavailable", style = MaterialTheme.typography.labelSmall, color = Lime)
                TextButton({ onOpen(row.id) }) { Icon(Icons.Rounded.PlayArrow, null); Spacer(Modifier.width(6.dp)); Text("Play") }
            }
        }
        SegmiqPrimaryButton("Record a meeting", onRecord, Modifier.fillMaxWidth())
    }
}

@Composable
fun LiveRecordingDetail(userId: String, orgId: String, id: String, onDeleted: () -> Unit, onCopilot: () -> Unit) {
    val context = LocalContext.current
    val library = remember { RecordingLibrary(context) }
    var row by remember { mutableStateOf(library.get(id, userId, orgId)) }
    var title by remember(row?.id) { mutableStateOf(row?.title.orEmpty()) }
    var notes by remember(row?.id) { mutableStateOf(row?.notes.orEmpty()) }
    var confirm by remember { mutableStateOf(false) }
    var playing by remember { mutableStateOf(false) }
    var position by remember { mutableIntStateOf(0) }
    var duration by remember { mutableIntStateOf(0) }
    val player = remember { MediaPlayer() }
    DisposableEffect(id) {
        onDispose { runCatching { player.stop() }; player.release() }
    }
    val current = row
    if (current == null) {
        SegmiqEmptyState("Recording unavailable", "It may belong to another account, or it was deleted on this phone.")
        return
    }
    Page {
        OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), label = { Text("Title") }, singleLine = true)
        val propertyLine = when {
            current.propertyId != null -> "Linked listing · ${current.propertyLabel ?: current.propertyId}"
            current.propertyLabel != null -> "Label only · not a listing record · ${current.propertyLabel}"
            else -> null
        }
        Text(listOfNotNull(current.customerLabel, propertyLine).joinToString(" · ").ifBlank { "Not linked to a customer or property" })
        Text(formatClock(current.durationMs), style = MaterialTheme.typography.headlineMedium)
        if (duration > 0) {
            Slider(position / duration.toFloat(), { player.seekTo((it * duration).toInt()); position = player.currentPosition }, Modifier.fillMaxWidth())
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilledIconButton({
                val file = library.file(current)
                if (!file.exists()) return@FilledIconButton
                if (playing) { player.pause(); playing = false } else {
                    if (duration == 0) {
                        player.reset()
                        player.setDataSource(file.absolutePath)
                        player.prepare()
                        duration = player.duration
                    }
                    player.start()
                    playing = true
                }
            }, colors = IconButtonDefaults.filledIconButtonColors(containerColor = Lime, contentColor = Ink)) {
                Icon(if (playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, if (playing) "Pause playback" else "Play")
            }
            OutlinedButton({
                library.rename(id, userId, orgId, title, notes)
                row = library.get(id, userId, orgId)
            }) { Text("Save notes") }
            TextButton({ confirm = true }) { Icon(Icons.Rounded.Delete, null); Text("Delete") }
        }
        OutlinedTextField(notes, { notes = it }, Modifier.fillMaxWidth(), label = { Text("Meeting notes") }, minLines = 3)
        SegmiqCard {
            Text("Transcript", style = MaterialTheme.typography.titleMedium)
            Text("SegmiQ does not provide meeting transcription for this app yet. No transcript is invented here.")
        }
        TextButton(onCopilot) { Text("Open Sales Copilot") }
        Text("Deleting removes the file on this phone only. There is no server copy.", style = MaterialTheme.typography.bodySmall)
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        title = { Text("Delete this recording?") },
        text = { Text("The audio file on this phone will be removed. This cannot be undone.") },
        confirmButton = { TextButton({ library.delete(id, userId, orgId); confirm = false; onDeleted() }) { Text("Delete") } },
        dismissButton = { TextButton({ confirm = false }) { Text("Cancel") } },
    )
    LaunchedEffect(playing) {
        while (playing) {
            position = player.currentPosition
            if (!player.isPlaying) playing = false
            kotlinx.coroutines.delay(200)
        }
    }
}

@Composable
private fun AmplitudeWave(levels: List<Int>, live: Boolean, frozen: Boolean) {
    Canvas(Modifier.fillMaxWidth().height(72.dp)) {
        if (!live && !frozen) return@Canvas
        val count = 40
        val samples = if (levels.isEmpty()) List(count) { 0 } else List(count) { index -> levels.getOrElse(index * levels.size / count) { 0 } }
        val gap = size.width / count
        samples.forEachIndexed { index, sample ->
            val height = (sample / 32767f).coerceIn(0f, 1f) * size.height
            val shown = height.coerceAtLeast(4f)
            val color = if (live && sample > 0) Lime else ForestDeep
            drawLine(color, Offset(gap * index + gap / 2, size.height / 2 - shown / 2),
                Offset(gap * index + gap / 2, size.height / 2 + shown / 2), strokeWidth = 4f, cap = StrokeCap.Round)
        }
    }
}

private fun statusLabel(phase: CapturePhase, granted: Boolean) = when (phase) {
    CapturePhase.RECORDING -> "Recording"
    CapturePhase.PAUSED -> "Paused"
    CapturePhase.STOPPING -> "Saving"
    CapturePhase.ERROR -> "Not saved"
    CapturePhase.READY -> if (granted) "Ready" else "Microphone permission required"
}

private fun formatClock(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    return "%d:%02d".format(total / 60, total % 60)
}

private val Warmish = androidx.compose.ui.graphics.Color(0xFFF7F4EF)
