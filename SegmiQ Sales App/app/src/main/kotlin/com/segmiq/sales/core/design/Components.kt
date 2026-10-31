package com.segmiq.sales.core.design

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.segmiq.sales.ui.theme.*

@Composable
fun SegmiqCard(modifier: Modifier = Modifier, dark: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp),
        color = if (dark) Forest else MaterialTheme.colorScheme.surface,
        contentColor = if (dark) WarmWhite else MaterialTheme.colorScheme.onSurface) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}
@Composable
fun SegmiqPrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(onClick, modifier.heightIn(min = 52.dp), enabled = enabled, shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Lime, contentColor = Ink)) { Text(text, fontWeight = FontWeight.SemiBold) }
}
@Composable
fun SegmiqAvatar(name: String, modifier: Modifier = Modifier) {
    Surface(modifier.size(48.dp), shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant, contentColor = MaterialTheme.colorScheme.onSurface) {
        Box(contentAlignment = Alignment.Center) {
            Text(name.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("").uppercase(), fontWeight = FontWeight.Bold)
        }
    }
}
@Composable
fun SegmiqLabel(text: String, lime: Boolean = false) {
    Surface(shape = RoundedCornerShape(8.dp), color = if (lime) Lime else MaterialTheme.colorScheme.surfaceVariant,
        contentColor = if (lime) Ink else MaterialTheme.colorScheme.onSurfaceVariant) {
        Text(text, Modifier.padding(horizontal = 10.dp, vertical = 6.dp), style = MaterialTheme.typography.labelSmall)
    }
}
@Composable
fun SectionTitle(text: String, action: String? = null, onClick: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(text, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
        if (action != null) TextButton(onClick) { Text(action) }
    }
}
@Composable
fun SegmiqActionRow(title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, Modifier.size(20.dp))
        }
    }
}
@Composable
fun SegmiqEmptyState(title: String, message: String) {
    SegmiqCard {
        val kind = when {
            title.contains("propert", true) -> "property"
            title.contains("buyer", true) -> "buyer"
            title.contains("record", true) -> "recording"
            title.contains("viewing", true) -> "viewing"
            title.contains("offer", true) -> "offer"
            title.contains("transaction", true) -> "transaction"
            title.contains("suggest", true) || title.contains("Copilot", true) -> "copilot"
            else -> "inquiry"
        }
        SegmiqEmptyIllustration(kind, Modifier.size(72.dp))
        Text(title, style = MaterialTheme.typography.titleLarge)
        Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
@Composable
fun SegmiqSearchField(value: String, onChange: (String) -> Unit, label: String = "Search customers") {
    OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), placeholder = { Text(label) },
        leadingIcon = { Icon(Icons.Rounded.Search, null) },
        trailingIcon = { if (value.isNotEmpty()) IconButton({ onChange("") }) { Icon(Icons.Rounded.Close, "Clear search") } },
        singleLine = true, shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant))
}
/** Wraps onto further lines instead of scrolling, so no chip is ever clipped at the screen edge. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FilterChips(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(0.dp)) {
        options.forEach { option -> FilterChip(selected == option, { onSelect(option) }, label = { Text(option) }) }
    }
}
@Composable
fun SegmiqSkeleton(lines: Int = 3, modifier: Modifier = Modifier) {
    val shimmer = MaterialTheme.colorScheme.surfaceVariant
    SegmiqCard(modifier.semantics { contentDescription = "Loading" }) {
        repeat(lines) { i ->
            Box(Modifier.fillMaxWidth(if (i == 0) 0.55f else 0.9f).height(if (i == 0) 20.dp else 14.dp)
                .background(shimmer, RoundedCornerShape(6.dp)))
        }
    }
}
@Composable
fun SegmiqErrorCard(message: String, onRetry: (() -> Unit)? = null) {
    Surface(Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }, shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.errorContainer, contentColor = MaterialTheme.colorScheme.onErrorContainer) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(message, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
            if (onRetry != null) TextButton(onRetry) { Text("Retry") }
        }
    }
}
@Composable
fun SegmiqOfflineBanner() {
    Surface(Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }, shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer, contentColor = MaterialTheme.colorScheme.onTertiaryContainer) {
        Text("You're offline. Showing the last loaded data; changes can't be saved until you reconnect.",
            Modifier.padding(horizontal = 14.dp, vertical = 10.dp), style = MaterialTheme.typography.bodyMedium)
    }
}

/** The bar grows with text, while its single inset owner keeps system navigation clear. */
@Composable
fun SegmiqBottomNavigation(containerColor: Color = MaterialTheme.colorScheme.surface, content: @Composable RowScope.() -> Unit) {
    val scale = androidx.compose.ui.platform.LocalDensity.current.fontScale
    val height = when {
        scale >= 1.75f -> 160.dp
        scale >= 1.25f -> 112.dp
        else -> 80.dp
    }
    NavigationBar(
        modifier = Modifier.background(containerColor).semantics { contentDescription = "Primary navigation" }
            .navigationBarsPadding().height(height),
        containerColor = containerColor, windowInsets = WindowInsets(0, 0, 0, 0), content = content,
    )
}

@Composable
fun SegmiqNavigationLabel(text: String) {
    val scale = androidx.compose.ui.platform.LocalDensity.current.fontScale
    val lines = when { scale >= 1.75f -> 3; scale >= 1.25f -> 2; else -> 1 }
    Box(Modifier.fillMaxWidth().height((16f * scale * lines).dp), contentAlignment = Alignment.TopCenter) {
        Text(text, maxLines = lines, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            style = MaterialTheme.typography.labelMedium.copy(fontSize = 12.sp, lineHeight = 16.sp))
    }
}
