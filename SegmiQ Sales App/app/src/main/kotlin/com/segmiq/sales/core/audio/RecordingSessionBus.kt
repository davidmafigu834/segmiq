package com.segmiq.sales.core.audio

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Process-wide view of the microphone service. Ready means the microphone is not held. */
object RecordingSessionBus {
    private val _phase = MutableStateFlow(CaptureSnapshot())
    val phase: StateFlow<CaptureSnapshot> = _phase.asStateFlow()

    fun publish(snapshot: CaptureSnapshot) { _phase.value = snapshot }

    var savedId: String? = null
        private set

    fun markSaved(id: String?) { savedId = id }
}
