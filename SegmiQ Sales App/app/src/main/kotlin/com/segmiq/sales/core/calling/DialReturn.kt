package com.segmiq.sales.core.calling

/**
 * Call review is offered only after SegmiQ was left and resumed.
 * Opening the dialer does not mean a call connected.
 */
data class DialReturnState(
    val pending: Boolean = false,
    val leftApp: Boolean = false,
    val review: Boolean = false,
)

fun dialReturnAfter(state: DialReturnState, event: String): DialReturnState = when (event) {
    "stop" -> if (state.pending) state.copy(leftApp = true) else state
    "start" -> if (state.pending && state.leftApp) DialReturnState(review = true) else state
    else -> state
}
