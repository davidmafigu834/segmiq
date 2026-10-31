package com.segmiq.sales.features.realestate

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.segmiq.sales.core.design.*
import com.segmiq.sales.features.live.formatAmount
import com.segmiq.sales.ui.theme.Lime

@Composable
fun EstatePageHeader(title: String, description: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.headlineLarge, modifier = Modifier.semantics { heading() })
        Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun EstateStatusBadge(value: String) {
    val label = estateDisplayLabel(value)
    Surface(color = if (value in setOf("done", "accepted", "approved", "completed")) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(8.dp)) {
        Text(label, Modifier.padding(horizontal = 10.dp, vertical = 6.dp), style = MaterialTheme.typography.labelSmall)
    }
}

/** Neutral architectural placeholder: never evidence of an advertised property. */
@Composable
fun EstatePropertyIllustration(modifier: Modifier = Modifier) {
    SegmiqArtwork(com.segmiq.sales.R.drawable.estate_listing_placeholder, modifier.clip(RoundedCornerShape(18.dp)),
        "Architectural placeholder; no listing photograph")
}

/** Generated photography is restricted to the isolated fictional workflow. */
@Composable
fun EstateDemoPhoto(propertyId: String, modifier: Modifier = Modifier, page: Int = 0) {
    val covers = if (propertyId == "demo-p1") listOf(com.segmiq.sales.R.drawable.estate_home_feature,
        com.segmiq.sales.R.drawable.estate_viewing_feature, com.segmiq.sales.R.drawable.estate_transaction_feature)
        else listOf(com.segmiq.sales.R.drawable.estate_discovery_feature,
        com.segmiq.sales.R.drawable.estate_viewing_feature, com.segmiq.sales.R.drawable.estate_transaction_feature)
    Box(modifier.clip(RoundedCornerShape(20.dp))) {
        SegmiqArtwork(covers[page.mod(covers.size)], Modifier.fillMaxSize(), "Generated fictional architecture")
        Box(Modifier.matchParentSize().background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(
            Color.Transparent, Color.Transparent, Color.Black.copy(alpha = .35f)))))
        Surface(Modifier.align(Alignment.BottomStart).padding(10.dp), color = Color(0xDD0C0C0C),
            contentColor = Color.White, shape = RoundedCornerShape(6.dp)) {
            Text("FICTIONAL · GENERATED IMAGE", Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                style = MaterialTheme.typography.labelSmall)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EstatePropertyMiniCard(property: EstateProperty, onClick: () -> Unit) {
    Surface(onClick, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.fillMaxWidth()) {
            EstateDemoPhoto(property.id, Modifier.fillMaxWidth().height(148.dp))
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(formatAmount(property.price, "USD"), style = MaterialTheme.typography.headlineMedium)
                Text(property.address, style = MaterialTheme.typography.titleMedium)
                Text(property.suburb, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    EstateAttribute(Icons.Rounded.Bed, "${property.bedrooms} beds")
                    EstateAttribute(Icons.Rounded.Bathtub, "${property.bathrooms} baths")
                    EstateAttribute(Icons.Rounded.SquareFoot, "${property.size} m²")
                }
            }
        }
    }
}

@Composable
internal fun EstateAttribute(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.labelSmall)
    }
}

private fun demoCover(propertyId: String) = when (propertyId) {
    "demo-p1" -> com.segmiq.sales.R.drawable.estate_home_feature
    "demo-p2" -> com.segmiq.sales.R.drawable.estate_discovery_feature
    else -> com.segmiq.sales.R.drawable.estate_listing_placeholder
}

@Composable
fun EstateWorkCard(property: EstateProperty, title: String, context: String, onClick: () -> Unit) {
    Surface(onClick, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically) {
            SegmiqArtwork(demoCover(property.id), Modifier.width(80.dp).height(88.dp).clip(RoundedCornerShape(12.dp)),
                "Generated fictional property thumbnail")
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                if (title != property.address) Text(property.address, style = MaterialTheme.typography.bodyMedium)
                Text(context, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun EstateBuyerRow(buyer: EstateBuyer, onClick: () -> Unit) {
    Surface(onClick, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SegmiqAvatar(buyer.name)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(buyer.name, style = MaterialTheme.typography.titleMedium)
                Text(estateAmount(buyer.budget), style = MaterialTheme.typography.titleLarge)
                Text("${buyer.location.ifBlank { "Location not specified" }} · ${buyer.bedrooms?.let { "$it bedrooms" } ?: "Bedrooms not specified"}", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                EstateStatusBadge(buyer.intent)
            }
        }
    }
}

@Composable
fun EstateTimeline(entries: List<String>) {
    entries.forEachIndexed { index, entry ->
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(if (index == entries.lastIndex) Icons.Rounded.RadioButtonChecked else Icons.Rounded.CheckCircleOutline,
                null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
            Text(entry, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun EstateMilestoneProgress(milestones: List<EstateMilestone>, onReview: (EstateMilestone) -> Unit) {
    val done = milestones.count { it.status == "done" }
    Text("$done of ${milestones.size} milestones complete", style = MaterialTheme.typography.titleMedium)
    LinearProgressIndicator(progress = { if (milestones.isEmpty()) 0f else done.toFloat() / milestones.size },
        modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
        color = MaterialTheme.colorScheme.primary)
    milestones.forEach { milestone ->
        Surface(onClick = { onReview(milestone) }, shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surface) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(if (milestone.status == "done") Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked,
                    null, tint = MaterialTheme.colorScheme.primary)
                Column(Modifier.weight(1f)) { Text(milestone.label, style = MaterialTheme.typography.titleMedium); EstateStatusBadge(milestone.status) }
            }
        }
    }
}

@Composable
fun EstateDocumentRow(document: EstateDocument, onClick: () -> Unit) {
    Surface(onClick, shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Rounded.Description, null, tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(document.title, style = MaterialTheme.typography.titleMedium)
                EstateStatusBadge(document.status)
                document.reason?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
            }
            Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, Modifier.size(18.dp))
        }
    }
}

@Composable
fun EstateContextRow(title: String, detail: String, onClick: () -> Unit) =
    EstateModuleRow(title, detail, Icons.Rounded.ChevronRight, onClick)

@Composable
fun EstateGateNotice(title: String, message: String) {
    EstateNotice(title, message, Icons.Rounded.Lock)
}

fun estateGateReason(module: com.segmiq.sales.core.bootstrap.LiveModule): String = when (module) {
    com.segmiq.sales.core.bootstrap.LiveModule.PROPERTIES, com.segmiq.sales.core.bootstrap.LiveModule.BUYERS_TENANTS ->
        "Property and buyer access are being verified for the mobile app. Live records are unavailable in this version."
    com.segmiq.sales.core.bootstrap.LiveModule.VIEWINGS ->
        "Live viewing schedules and appointment changes are unavailable in this version. No customer notification is sent here."
    com.segmiq.sales.core.bootstrap.LiveModule.INTRODUCTIONS ->
        "Live introduction requests and decisions are not connected. No private buyer contact details are loaded here."
    com.segmiq.sales.core.bootstrap.LiveModule.OFFERS ->
        "Live offers are not connected. No financial commitment can be sent from this version."
    com.segmiq.sales.core.bootstrap.LiveModule.TRANSACTIONS ->
        "Live transactions and private documents are not connected. Continue in your authorised SegmiQ web workspace."
    else -> "This mobile workflow is not connected yet."
}
