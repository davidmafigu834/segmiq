package com.segmiq.sales.core.design

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally

/** Finite motion only. Compose's animator-duration scale handles system reduced/disabled motion. */
object SegmiqMotion {
    const val Press = 100
    const val Page = 220
    const val Expand = 240
    fun enter() = fadeIn(tween(Page)) + slideInHorizontally(tween(Page, easing = FastOutSlowInEasing)) { it / 16 }
    fun exit() = fadeOut(tween(160)) + slideOutHorizontally(tween(Page)) { -it / 24 }
    fun backEnter() = fadeIn(tween(Page)) + slideInHorizontally(tween(Page)) { -it / 16 }
    fun backExit() = fadeOut(tween(160)) + slideOutHorizontally(tween(Page)) { it / 24 }
}
