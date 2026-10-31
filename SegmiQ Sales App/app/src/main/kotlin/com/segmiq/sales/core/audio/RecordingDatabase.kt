package com.segmiq.sales.core.audio

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File

data class StoredRecording(
    val id: String,
    val ownerUserId: String,
    val ownerOrgId: String,
    val title: String,
    val fileName: String,
    val createdAtEpochMs: Long,
    val durationMs: Long,
    val notes: String,
    val customerId: String?,
    val customerLabel: String?,
    val propertyId: String?,
    val propertyLabel: String?,
    val uploadState: String,
    val transcriptionState: String,
)

/** App-private SQLite. Recordings are never written to public Downloads or Music. */
class RecordingDatabase(context: Context) : SQLiteOpenHelper(context, "meeting_recordings.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE recordings (
              id TEXT PRIMARY KEY,
              owner_user_id TEXT NOT NULL,
              owner_org_id TEXT NOT NULL,
              title TEXT NOT NULL,
              file_name TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              duration_ms INTEGER NOT NULL,
              notes TEXT NOT NULL,
              customer_id TEXT,
              customer_label TEXT,
              property_id TEXT,
              property_label TEXT,
              upload_state TEXT NOT NULL,
              transcription_state TEXT NOT NULL
            )
        """.trimIndent())
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    fun insert(row: StoredRecording) {
        writableDatabase.insertWithOnConflict("recordings", null, row.values(), SQLiteDatabase.CONFLICT_REPLACE)
    }
    fun updateNotes(id: String, ownerUserId: String, ownerOrgId: String, title: String, notes: String) {
        writableDatabase.update("recordings", ContentValues().apply {
            put("title", title); put("notes", notes)
        }, "id=? AND owner_user_id=? AND owner_org_id=?", arrayOf(id, ownerUserId, ownerOrgId))
    }
    fun list(ownerUserId: String, ownerOrgId: String): List<StoredRecording> {
        val rows = mutableListOf<StoredRecording>()
        readableDatabase.query("recordings", null, "owner_user_id=? AND owner_org_id=?",
            arrayOf(ownerUserId, ownerOrgId), null, null, "created_at DESC").use { cursor ->
            while (cursor.moveToNext()) rows += cursor.toRow()
        }
        return rows
    }
    fun get(id: String, ownerUserId: String, ownerOrgId: String): StoredRecording? =
        list(ownerUserId, ownerOrgId).firstOrNull { it.id == id }
    fun delete(id: String, ownerUserId: String, ownerOrgId: String) {
        writableDatabase.delete("recordings", "id=? AND owner_user_id=? AND owner_org_id=?", arrayOf(id, ownerUserId, ownerOrgId))
    }
    fun clearOwner(ownerUserId: String, ownerOrgId: String): List<String> {
        val names = list(ownerUserId, ownerOrgId).map { it.fileName }
        writableDatabase.delete("recordings", "owner_user_id=? AND owner_org_id=?", arrayOf(ownerUserId, ownerOrgId))
        return names
    }

    private fun StoredRecording.values() = ContentValues().apply {
        put("id", id); put("owner_user_id", ownerUserId); put("owner_org_id", ownerOrgId)
        put("title", title); put("file_name", fileName); put("created_at", createdAtEpochMs)
        put("duration_ms", durationMs); put("notes", notes); put("customer_id", customerId)
        put("customer_label", customerLabel); put("property_id", propertyId); put("property_label", propertyLabel)
        put("upload_state", uploadState); put("transcription_state", transcriptionState)
    }
    private fun android.database.Cursor.toRow() = StoredRecording(
        id = getString(getColumnIndexOrThrow("id")),
        ownerUserId = getString(getColumnIndexOrThrow("owner_user_id")),
        ownerOrgId = getString(getColumnIndexOrThrow("owner_org_id")),
        title = getString(getColumnIndexOrThrow("title")),
        fileName = getString(getColumnIndexOrThrow("file_name")),
        createdAtEpochMs = getLong(getColumnIndexOrThrow("created_at")),
        durationMs = getLong(getColumnIndexOrThrow("duration_ms")),
        notes = getString(getColumnIndexOrThrow("notes")),
        customerId = getString(getColumnIndexOrThrow("customer_id")),
        customerLabel = getString(getColumnIndexOrThrow("customer_label")),
        propertyId = getString(getColumnIndexOrThrow("property_id")),
        propertyLabel = getString(getColumnIndexOrThrow("property_label")),
        uploadState = getString(getColumnIndexOrThrow("upload_state")),
        transcriptionState = getString(getColumnIndexOrThrow("transcription_state")),
    )
}

fun recordingDirectory(context: Context, userId: String, orgId: String): File =
    File(context.filesDir, "recordings/$orgId/$userId").apply { mkdirs() }

fun deleteOwnerFiles(context: Context, userId: String, orgId: String, names: List<String>) {
    val dir = recordingDirectory(context, userId, orgId)
    names.forEach { File(dir, it).delete() }
}
