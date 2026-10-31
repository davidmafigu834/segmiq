package com.segmiq.sales.native

import com.segmiq.sales.core.audio.AudioCapture
import com.segmiq.sales.core.audio.CapturePhase
import com.segmiq.sales.core.audio.MeetingRecorder
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class MeetingRecorderTest {
    @Test fun startPauseResumeStopWritesARealFile() {
        val capture = FakeCapture()
        var now = 1_000L
        val recorder = MeetingRecorder(capture, clock = { now })
        val file = File.createTempFile("meeting", ".m4a")
        recorder.start(file)
        assertEquals(CapturePhase.RECORDING, recorder.snapshot.phase)
        now += 2_000
        recorder.tick()
        assertEquals(2_000, recorder.snapshot.elapsedMs)
        assertTrue(recorder.snapshot.amplitudes.last() > 0)
        recorder.pause()
        assertEquals(CapturePhase.PAUSED, recorder.snapshot.phase)
        now += 5_000
        recorder.tick()
        assertEquals(2_000, recorder.snapshot.elapsedMs)
        recorder.resume()
        now += 1_000
        val saved = recorder.stop()
        assertSame(file, saved)
        assertTrue(file.length() > 0)
        assertEquals(CapturePhase.READY, recorder.snapshot.phase)
        assertFalse(capture.open)
        file.delete()
    }

    @Test fun permissionOrStorageFailureIsNotSaved() {
        val capture = FakeCapture()
        val recorder = MeetingRecorder(capture, freeBytes = { 0 })
        val file = File.createTempFile("meeting", ".m4a")
        recorder.start(file)
        assertEquals(CapturePhase.ERROR, recorder.snapshot.phase)
        assertNull(recorder.stop())
        assertFalse(capture.open)
        file.delete()
    }

    @Test fun captureErrorDeletesTheFile() {
        val capture = FakeCapture(failStart = true)
        val recorder = MeetingRecorder(capture)
        val file = File.createTempFile("meeting", ".m4a")
        recorder.start(file)
        assertEquals(CapturePhase.ERROR, recorder.snapshot.phase)
        assertFalse(file.exists())
    }

    @Test fun stoppedRecorderDoesNotStayActive() {
        val capture = FakeCapture()
        val recorder = MeetingRecorder(capture)
        val file = File.createTempFile("meeting", ".m4a")
        recorder.start(file)
        recorder.stop()
        recorder.tick()
        assertEquals(CapturePhase.READY, recorder.snapshot.phase)
        assertTrue(recorder.snapshot.amplitudes.isEmpty())
        file.delete()
    }
}

private class FakeCapture(private val failStart: Boolean = false) : AudioCapture {
    var open = false
    private lateinit var file: File
    override fun open(file: File) {
        if (failStart) error("Microphone unavailable")
        this.file = file
        open = true
    }
    override fun start() { if (!open) error("not open") }
    override fun pause() {}
    override fun resume() {}
    override fun stop() { file.writeBytes(byteArrayOf(1, 2, 3, 4)) }
    override fun amplitude(): Int = if (open) 8000 else 0
    override fun release() { open = false }
}
