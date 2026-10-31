package com.segmiq.sales.core.audio

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.StatFs
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.segmiq.sales.MainActivity
import com.segmiq.sales.core.notify.SalesNotifier

/**
 * Microphone foreground service. Started only from the record button in the foreground.
 * The notification does not include customer names.
 */
class MeetingRecordingService : Service() {
    private val recorder by lazy {
        MeetingRecorder(MediaRecorderCapture(this), freeBytes = { freeBytes() })
    }
    private val library by lazy { RecordingLibrary(this) }
    private val handler = Handler(Looper.getMainLooper())
    private var focus: AudioFocusRequest? = null
    private var foreground = false
    private var userId = ""
    private var orgId = ""
    private var recordingId = ""
    private var title = "Meeting"
    private var customerId: String? = null
    private var customerLabel: String? = null
    private var propertyLabel: String? = null
    private var propertyId: String? = null
    private val tick = object : Runnable {
        override fun run() {
            recorder.tick()
            RecordingSessionBus.publish(recorder.snapshot)
            val phase = recorder.snapshot.phase
            if (phase == CapturePhase.RECORDING || phase == CapturePhase.PAUSED) handler.postDelayed(this, 120)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> begin(intent)
            ACTION_PAUSE -> { recorder.pause(); publish(); if (!holdingMic()) stopSelf() }
            ACTION_RESUME -> { recorder.resume(); handler.post(tick); publish(); if (!holdingMic()) stopSelf() }
            ACTION_STOP -> finish(keep = true)
            ACTION_DISCARD -> finish(keep = false)
            else -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun begin(intent: Intent) {
        startInForeground()
        userId = intent.getStringExtra(EXTRA_USER).orEmpty()
        orgId = intent.getStringExtra(EXTRA_ORG).orEmpty()
        title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Meeting" }
        customerId = intent.getStringExtra(EXTRA_CUSTOMER_ID)
        customerLabel = intent.getStringExtra(EXTRA_CUSTOMER_LABEL)
        propertyLabel = intent.getStringExtra(EXTRA_PROPERTY_LABEL)
        propertyId = intent.getStringExtra(EXTRA_PROPERTY_ID)?.takeUnless { it.isBlank() || it.startsWith("demo-") }
        if (userId.isBlank() || orgId.isBlank()) {
            RecordingSessionBus.publish(CaptureSnapshot(CapturePhase.ERROR, error = "Sign in before recording."))
            endForeground()
            stopSelf()
            return
        }
        if (recorder.snapshot.phase == CapturePhase.RECORDING || recorder.snapshot.phase == CapturePhase.PAUSED) return
        val (id, file) = library.newFile(userId, orgId)
        recordingId = id
        library.writeMarker(userId, orgId, id, file.name)
        requestFocus()
        recorder.start(file)
        RecordingSessionBus.markSaved(null)
        publish()
        if (recorder.snapshot.phase == CapturePhase.ERROR) {
            library.clearMarker(userId, orgId)
            endForeground()
            stopSelf()
            return
        }
        handler.post(tick)
    }

    private fun finish(keep: Boolean) {
        handler.removeCallbacks(tick)
        abandonFocus()
        if (!keep) {
            recorder.discard()
            library.clearMarker(userId, orgId)
            RecordingSessionBus.publish(CaptureSnapshot())
        } else {
            val elapsed = recorder.snapshot.let {
                if (it.phase == CapturePhase.PAUSED) it.elapsedMs else it.elapsedMs
            }
            val file = recorder.stop()
            if (file != null) {
                library.save(StoredRecording(
                    id = recordingId, ownerUserId = userId, ownerOrgId = orgId, title = title,
                    fileName = file.name, createdAtEpochMs = System.currentTimeMillis(),
                    durationMs = recorder.snapshot.elapsedMs.takeIf { it > 0 } ?: elapsed,
                    notes = "", customerId = customerId, customerLabel = customerLabel,
                    propertyId = propertyId, propertyLabel = propertyLabel,
                    uploadState = "not_available", transcriptionState = "not_available",
                ))
                library.clearMarker(userId, orgId)
                RecordingSessionBus.markSaved(recordingId)
                RecordingSessionBus.publish(CaptureSnapshot(CapturePhase.READY, elapsedMs = recorder.snapshot.elapsedMs, file = file))
            } else {
                library.clearMarker(userId, orgId)
                RecordingSessionBus.publish(recorder.snapshot)
            }
        }
        endForeground()
        stopSelf()
    }

    private fun holdingMic() = recorder.snapshot.phase == CapturePhase.RECORDING || recorder.snapshot.phase == CapturePhase.PAUSED

    private fun endForeground() {
        if (!foreground) return
        stopForeground(STOP_FOREGROUND_REMOVE)
        foreground = false
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        abandonFocus()
        if (recorder.snapshot.phase == CapturePhase.RECORDING || recorder.snapshot.phase == CapturePhase.PAUSED) {
            val file = recorder.stop()
            if (file != null && userId.isNotBlank()) {
                library.save(StoredRecording(
                    id = recordingId.ifBlank { file.nameWithoutExtension }, ownerUserId = userId, ownerOrgId = orgId,
                    title = title, fileName = file.name, createdAtEpochMs = System.currentTimeMillis(),
                    durationMs = recorder.snapshot.elapsedMs, notes = "Recording ended because the recorder service stopped.",
                    customerId = customerId, customerLabel = customerLabel, propertyId = propertyId, propertyLabel = propertyLabel,
                    uploadState = "not_available", transcriptionState = "not_available",
                ))
            }
            library.clearMarker(userId, orgId)
            RecordingSessionBus.publish(CaptureSnapshot())
        }
        super.onDestroy()
    }

    private fun publish() { RecordingSessionBus.publish(recorder.snapshot) }

    private fun startInForeground() {
        val notification = ongoing()
        if (Build.VERSION.SDK_INT >= 30) {
            startForeground(SalesNotifier.RECORDING_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(SalesNotifier.RECORDING_ID, notification)
        }
        foreground = true
    }

    private fun ongoing(): Notification {
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        return SalesNotifier.recordingNotification(this, open)
    }

    private fun requestFocus() {
        val manager = getSystemService(AudioManager::class.java)
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setOnAudioFocusChangeListener { change ->
                if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                    if (recorder.snapshot.phase == CapturePhase.RECORDING) recorder.pause()
                    publish()
                }
            }.build()
        focus = request
        manager.requestAudioFocus(request)
    }

    private fun abandonFocus() {
        focus?.let { getSystemService(AudioManager::class.java).abandonAudioFocusRequest(it) }
        focus = null
    }

    private fun freeBytes(): Long = runCatching {
        val stats = StatFs(filesDir.absolutePath)
        stats.availableBlocksLong * stats.blockSizeLong
    }.getOrDefault(Long.MAX_VALUE)

    companion object {
        const val ACTION_START = "com.segmiq.sales.RECORD_START"
        const val ACTION_PAUSE = "com.segmiq.sales.RECORD_PAUSE"
        const val ACTION_RESUME = "com.segmiq.sales.RECORD_RESUME"
        const val ACTION_STOP = "com.segmiq.sales.RECORD_STOP"
        const val ACTION_DISCARD = "com.segmiq.sales.RECORD_DISCARD"
        const val EXTRA_USER = "user"
        const val EXTRA_ORG = "org"
        const val EXTRA_TITLE = "title"
        const val EXTRA_CUSTOMER_ID = "customerId"
        const val EXTRA_CUSTOMER_LABEL = "customerLabel"
        const val EXTRA_PROPERTY_LABEL = "propertyLabel"
        const val EXTRA_PROPERTY_ID = "propertyId"

        fun start(context: Context, userId: String, orgId: String, title: String, customerId: String?, customerLabel: String?, propertyLabel: String?, propertyId: String? = null) {
            val intent = Intent(context, MeetingRecordingService::class.java).setAction(ACTION_START)
                .putExtra(EXTRA_USER, userId).putExtra(EXTRA_ORG, orgId).putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_CUSTOMER_ID, customerId).putExtra(EXTRA_CUSTOMER_LABEL, customerLabel)
                .putExtra(EXTRA_PROPERTY_LABEL, propertyLabel)
                .putExtra(EXTRA_PROPERTY_ID, propertyId)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
        }

        fun command(context: Context, action: String) {
            context.startService(Intent(context, MeetingRecordingService::class.java).setAction(action))
        }
    }
}
