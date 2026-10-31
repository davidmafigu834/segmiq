package com.segmiq.sales.core.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/** AAC in an M4A container. Pause requires API 24; this app’s minimum is 26. */
class MediaRecorderCapture(private val context: Context) : AudioCapture {
    private var recorder: MediaRecorder? = null

    override fun open(file: File) {
        release()
        val created = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
        created.setAudioSource(MediaRecorder.AudioSource.MIC)
        created.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        created.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        created.setAudioEncodingBitRate(64_000)
        created.setAudioSamplingRate(44_100)
        created.setOutputFile(file.absolutePath)
        created.prepare()
        recorder = created
    }

    override fun start() { recorder?.start() ?: error("Recorder is not open") }
    override fun pause() { recorder?.pause() ?: error("Recorder is not open") }
    override fun resume() { recorder?.resume() ?: error("Recorder is not open") }
    override fun stop() { recorder?.stop() ?: error("Recorder is not open") }
    override fun amplitude(): Int = recorder?.maxAmplitude ?: 0
    override fun release() {
        runCatching { recorder?.reset() }
        runCatching { recorder?.release() }
        recorder = null
    }
}
