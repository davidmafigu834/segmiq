package com.segmiq.sales.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Brand tokens live in Color.kt. Wallpaper colours are intentionally disabled.

private val Light = lightColorScheme(
    primary = Color(0xFF334A00), onPrimary = Color.White,
    primaryContainer = Lime, onPrimaryContainer = Ink,
    secondary = Color(0xFF4B6320), onSecondary = Color.White,
    secondaryContainer = Color(0xFFE9EEE6), onSecondaryContainer = Color(0xFF294132),
    tertiary = Color(0xFF455F4D), onTertiary = Color.White,
    tertiaryContainer = Color(0xFFE5ECE2), onTertiaryContainer = Color(0xFF203E2A),
    surfaceTint = Color.Transparent,
    background = WarmWhite, onBackground = Color(0xFF101512),
    surface = Color.White, onSurface = Color(0xFF101512),
    surfaceVariant = Color(0xFFEEF0EB), onSurfaceVariant = Color(0xFF58635A),
    outline = Color(0xFF738075), outlineVariant = Color(0xFFE7EBE5),
    error = Color(0xFFB32632), onError = Color.White,
    errorContainer = Color(0xFFFFE9E8), onErrorContainer = Color(0xFF68141D),
    // Explicit container roles stop sheets, dialogs and menus falling back to baseline lavender.
    surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFFAFBF7),
    surfaceContainer = Color(0xFFF3F5F0), surfaceContainerHigh = Color(0xFFEEF0EB),
    surfaceContainerHighest = Color(0xFFE8EBE5), surfaceBright = Color.White, surfaceDim = Color(0xFFE3E6E0),
    inverseSurface = Color(0xFF1B211D), inverseOnSurface = WarmWhite, inversePrimary = Lime,
    scrim = Color.Black
)
private val Dark = darkColorScheme(
    primary = Lime, onPrimary = Ink, primaryContainer = Color(0xFF35421B),
    onPrimaryContainer = Lime,
    secondary = Lime, onSecondary = Ink,
    secondaryContainer = Color(0xFF35421B), onSecondaryContainer = Lime,
    tertiary = Color(0xFFBCD0BE), onTertiary = ForestDeep,
    tertiaryContainer = Color(0xFF203E2A), onTertiaryContainer = Color(0xFFE1EFDD),
    surfaceTint = Color.Transparent,
    background = Ink, onBackground = Color(0xFFF6F8F4),
    surface = Forest, onSurface = Color(0xFFF6F8F4),
    surfaceVariant = Color(0xFF202824), onSurfaceVariant = Color(0xFFB3BDB5),
    outline = Muted, outlineVariant = Color(0xFF2C3630), error = Color(0xFFFFA5AD),
    onError = Color(0xFF4A0715), errorContainer = Color(0xFF4E2028), onErrorContainer = Color(0xFFFFDADC),
    surfaceContainerLowest = Color(0xFF090C0B), surfaceContainerLow = Color(0xFF111614),
    surfaceContainer = Forest, surfaceContainerHigh = Color(0xFF1B221E),
    surfaceContainerHighest = Color(0xFF232B27), surfaceBright = Color(0xFF2A332E), surfaceDim = Ink,
    inverseSurface = WarmWhite, inverseOnSurface = Ink, inversePrimary = Color(0xFF334A00),
    scrim = Color.Black
)

@Composable
fun SegmiQSalesTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) Dark else Light, typography = Typography, shapes = Shapes(
        extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
        small = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
        medium = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        large = androidx.compose.foundation.shape.RoundedCornerShape(22.dp),
        extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(28.dp)), content = content)
}
