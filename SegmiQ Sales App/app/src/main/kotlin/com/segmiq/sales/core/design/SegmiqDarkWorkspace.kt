package com.segmiq.sales.core.design

import android.app.Activity
import android.view.Window
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import java.util.WeakHashMap

private data class DarkBarLease(val lightStatus: Boolean, val lightNavigation: Boolean, var count: Int = 0)
private val darkBarLeases = WeakHashMap<Window, DarkBarLease>()

/**
 * Normal screens retain ComponentActivity's automatic bar styling. Forced-dark screens use a
 * shared lease so an outgoing navigation animation cannot restore dark icons over an incoming call.
 */
@Composable
fun SegmiqDarkSystemBars() {
    val view = LocalView.current
    DisposableEffect(view) {
        val window = (view.context as? Activity)?.window
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        val lease = if (window != null && controller != null) {
            darkBarLeases.getOrPut(window) {
                DarkBarLease(controller.isAppearanceLightStatusBars, controller.isAppearanceLightNavigationBars)
            }.also {
                it.count++
                controller.isAppearanceLightStatusBars = false
                controller.isAppearanceLightNavigationBars = false
            }
        } else null
        onDispose {
            if (window != null && controller != null && lease != null) {
                lease.count--
                if (lease.count == 0) {
                    controller.isAppearanceLightStatusBars = lease.lightStatus
                    controller.isAppearanceLightNavigationBars = lease.lightNavigation
                    darkBarLeases.remove(window)
                }
            }
        }
    }
}

@Composable
fun SegmiqDarkWorkspace(content: @Composable () -> Unit) {
    SegmiqDarkSystemBars()
    SegmiQSalesTheme(darkTheme = true) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background, content = content)
    }
}
