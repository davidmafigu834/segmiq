package com.segmiq.sales.core.audio

import java.io.File

enum class CapturePhase { READY, RECORDING, PAUSED, STOPPING, ERROR }

data class CaptureSnapshot(
    val phase: CapturePhase = CapturePhase.READY,
    val elapsedMs: Long = 0,
    val amplitudes: List<Int> = emptyList(),
    val error: String? = null,
    val file: File? = null,
)

/** Microphone ownership. Implementations must not invent samples when capture is stopped. */
interface AudioCapture {
    fun open(file: File)
    fun start()
    fun pause()
    fun resume()
    fun stop()
    fun amplitude(): Int
    fun release()
}

/**
 * Recorder state machine. Elapsed time comes from [clock], never from a fake animation timer
 * pretending to be audio. Amplitude samples are read only while [AudioCapture] is recording.
 */
class MeetingRecorder(
    private val capture: AudioCapture,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val minFreeBytes: Long = 20L * 1024 * 1024,
    private val freeBytes: () -> Long = { Long.MAX_VALUE },
) {
    var snapshot = CaptureSnapshot()
        private set
    private var startedAt = 0L
    private var accumulated = 0L
    private var runningSince = 0L

    fun start(file: File) {
        if (snapshot.phase == CapturePhase.RECORDING || snapshot.phase == CapturePhase.PAUSED) return
        if (freeBytes() < minFreeBytes) {
            snapshot = CaptureSnapshot(CapturePhase.ERROR, error = "Not enough free storage to record.")
            return
        }
        try {
            capture.open(file)
            capture.start()
            startedAt = clock()
            accumulated = 0
            runningSince = startedAt
            snapshot = CaptureSnapshot(CapturePhase.RECORDING, file = file)
        } catch (failure: Exception) {
            capture.release()
            file.delete()
            snapshot = CaptureSnapshot(CapturePhase.ERROR, error = failure.message ?: "The microphone could not start.")
        }
    }

    fun tick() {
        val phase = snapshot.phase
        if (phase != CapturePhase.RECORDING && phase != CapturePhase.PAUSED) return
        val elapsed = accumulated + if (phase == CapturePhase.RECORDING) clock() - runningSince else 0
        val levels = if (phase == CapturePhase.RECORDING) {
            (snapshot.amplitudes + capture.amplitude().coerceIn(0, 32767)).takeLast(48)
        } else snapshot.amplitudes
        snapshot = snapshot.copy(elapsedMs = elapsed, amplitudes = levels)
    }

    fun pause() {
        if (snapshot.phase != CapturePhase.RECORDING) return
        capture.pause()
        accumulated += clock() - runningSince
        snapshot = snapshot.copy(phase = CapturePhase.PAUSED, elapsedMs = accumulated)
    }

    fun resume() {
        if (snapshot.phase != CapturePhase.PAUSED) return
        capture.resume()
        runningSince = clock()
        snapshot = snapshot.copy(phase = CapturePhase.RECORDING)
    }

    /** Returns the file only after the capture stops cleanly. A failure is not marked saved. */
    fun stop(): File? {
        val phase = snapshot.phase
        if (phase != CapturePhase.RECORDING && phase != CapturePhase.PAUSED) return null
        val elapsed = if (phase == CapturePhase.PAUSED) accumulated else accumulated + (clock() - runningSince)
        val file = snapshot.file
        snapshot = snapshot.copy(phase = CapturePhase.STOPPING, elapsedMs = elapsed)
        return try {
            capture.stop()
            capture.release()
            accumulated = 0
            if (file != null && file.exists() && file.length() > 0) {
                snapshot = CaptureSnapshot(CapturePhase.READY, elapsedMs = elapsed, file = file)
                file
            } else {
                file?.delete()
                snapshot = CaptureSnapshot(CapturePhase.ERROR, error = "The recording was empty and was not saved.")
                null
            }
        } catch (failure: Exception) {
            capture.release()
            file?.delete()
            accumulated = 0
            snapshot = CaptureSnapshot(CapturePhase.ERROR, error = failure.message ?: "The recording could not be saved.")
            null
        }
    }

    fun discard() {
        capture.release()
        snapshot.file?.delete()
        accumulated = 0
        snapshot = CaptureSnapshot(CapturePhase.READY)
    }

    fun interrupt(reason: String) {
        if (snapshot.phase != CapturePhase.RECORDING && snapshot.phase != CapturePhase.PAUSED) return
        val saved = stop()
        if (saved == null && snapshot.phase == CapturePhase.ERROR) return
        snapshot = snapshot.copy(error = reason)
    }
}
