package com.segmiq.sales.core.design

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalView
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Backspace
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val KEYS = listOf(
    listOf("1" to "", "2" to "ABC", "3" to "DEF"),
    listOf("4" to "GHI", "5" to "JKL", "6" to "MNO"),
    listOf("7" to "PQRS", "8" to "TUV", "9" to "WXYZ"),
    listOf("*" to "", "0" to "+", "#" to ""),
)

/**
 * Number display plus on-screen keypad. The display is not a text field, so the system keyboard
 * never opens over the keypad. Keys are compact enough that the call action stays visible on a
 * 360 × 640 dp phone. Long-press 0 for "+".
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DialPad(number: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    val view = LocalView.current
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 6.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                number.ifEmpty { "Enter number" },
                Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                style = if (number.isEmpty()) MaterialTheme.typography.titleMedium else MaterialTheme.typography.headlineMedium,
                color = if (number.isEmpty()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                maxLines = 1, overflow = TextOverflow.StartEllipsis,
            )
            if (number.isNotEmpty()) {
                Surface(
                    Modifier.size(48.dp).combinedClickable(onClick = { onChange(number.dropLast(1)) }, onLongClick = { onChange("") })
                        .semantics { contentDescription = "Delete last digit"; role = Role.Button },
                    shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceVariant,
                ) { Box(contentAlignment = Alignment.Center) { Icon(Icons.AutoMirrored.Rounded.Backspace, null) } }
            }
        }
        KEYS.forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (digit, letters) ->
                    val interaction = remember { MutableInteractionSource() }
                    val pressed by interaction.collectIsPressedAsState()
                    val scale by animateFloatAsState(if (pressed) .96f else 1f, tween(SegmiqMotion.Press), label = "Key press")
                    Surface(
                        Modifier.weight(1f).heightIn(min = if (compact) 48.dp else 54.dp).graphicsLayer { scaleX = scale; scaleY = scale }
                            .combinedClickable(interactionSource = interaction, indication = LocalIndication.current,
                                onClick = { view.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP); if (number.length < 20) onChange(number + digit) },
                                onLongClick = { view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS); if (number.length < 20) onChange(number + if (digit == "0") "+" else digit) },
                            )
                            .semantics(mergeDescendants = true) { role = Role.Button },
                        shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface,
                    ) {
                        Column(Modifier.padding(vertical = if (compact) 2.dp else 4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Text(digit, fontSize = if (compact) 22.sp else 24.sp, fontWeight = FontWeight.Medium)
                            if (letters.isNotEmpty()) Text(letters, style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}
