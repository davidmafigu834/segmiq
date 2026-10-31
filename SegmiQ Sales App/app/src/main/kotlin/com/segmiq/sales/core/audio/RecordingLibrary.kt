package com.segmiq.sales.core.audio

import android.content.Context
import java.io.File
import java.util.UUID

/**
 * Local meeting audio for one signed-in user and organisation.
 * Upload and transcription stay `not_available` until a verified SegmiQ contract exists.
 * Sign-out deletes this owner's rows and files. That does not delete a server copy, because none is created.
 */
class RecordingLibrary(private val context: Context) {
    private val db = RecordingDatabase(context)

    fun list(userId: String, orgId: String): List<StoredRecording> = db.list(userId, orgId)

    fun get(id: String, userId: String, orgId: String): StoredRecording? = db.get(id, userId, orgId)

    fun file(row: StoredRecording): File = File(recordingDirectory(context, row.ownerUserId, row.ownerOrgId), row.fileName)

    fun newFile(userId: String, orgId: String): Pair<String, File> {
        val id = UUID.randomUUID().toString()
        return id to File(recordingDirectory(context, userId, orgId), "$id.m4a")
    }

    fun save(row: StoredRecording) {
        db.insert(row.copy(uploadState = "not_available", transcriptionState = "not_available"))
    }

    fun rename(id: String, userId: String, orgId: String, title: String, notes: String) {
        db.updateNotes(id, userId, orgId, title.trim().ifBlank { "Meeting" }, notes)
    }

    fun delete(id: String, userId: String, orgId: String): Boolean {
        val row = db.get(id, userId, orgId) ?: return false
        file(row).delete()
        db.delete(id, userId, orgId)
        return true
    }

    fun wipe(userId: String, orgId: String) {
        val names = db.clearOwner(userId, orgId)
        deleteOwnerFiles(context, userId, orgId, names)
        clearMarker(userId, orgId)
    }

    fun writeMarker(userId: String, orgId: String, id: String, fileName: String) {
        markerFile().writeText("$userId\n$orgId\n$id\n$fileName")
    }

    fun clearMarker(userId: String, orgId: String) {
        val marker = readMarker() ?: return
        if (marker.userId == userId && marker.orgId == orgId) markerFile().delete()
    }

    /** A process death leaves a marker. A non-empty file is kept as interrupted, never as a clean save. */
    fun recoverInterrupted() {
        val marker = readMarker() ?: return
        if (RecordingSessionBus.phase.value.phase == CapturePhase.RECORDING ||
            RecordingSessionBus.phase.value.phase == CapturePhase.PAUSED
        ) return
        val file = File(recordingDirectory(context, marker.userId, marker.orgId), marker.fileName)
        if (file.exists() && file.length() > 0 && db.get(marker.id, marker.userId, marker.orgId) == null) {
            db.insert(StoredRecording(
                id = marker.id, ownerUserId = marker.userId, ownerOrgId = marker.orgId,
                title = "Interrupted meeting", fileName = marker.fileName,
                createdAtEpochMs = file.lastModified(), durationMs = 0, notes = "Recording stopped unexpectedly. Duration was not confirmed.",
                customerId = null, customerLabel = null, propertyId = null, propertyLabel = null,
                uploadState = "not_available", transcriptionState = "not_available",
            ))
        } else if (!file.exists() || file.length() == 0L) {
            file.delete()
        }
        markerFile().delete()
    }

    private fun markerFile() = File(context.filesDir, "recordings/active.txt").apply { parentFile?.mkdirs() }

    private fun readMarker(): ActiveMarker? {
        val file = markerFile()
        if (!file.exists()) return null
        val lines = file.readLines()
        if (lines.size < 4) { file.delete(); return null }
        return ActiveMarker(lines[0], lines[1], lines[2], lines[3])
    }

    private data class ActiveMarker(val userId: String, val orgId: String, val id: String, val fileName: String)
}
