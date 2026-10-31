package com.segmiq.sales.features.realestate

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.segmiq.sales.core.design.SegmiqAvatar
import com.segmiq.sales.core.estate.EstateResource

/** Presentation-only mapping. It never changes server statuses or permitted actions. */
internal fun estateDisplayLabel(value: String) = value.replace('_', ' ')
    .replaceFirstChar { it.uppercase() }

internal fun estateWorkspaceIcon(resource: EstateResource): ImageVector = when (resource) {
    EstateResource.PROPERTIES -> Icons.Rounded.HomeWork
    EstateResource.BUYERS -> Icons.Rounded.People
    EstateResource.VIEWINGS -> Icons.Rounded.EventAvailable
    EstateResource.INTRODUCTIONS -> Icons.Rounded.PersonAddAlt
    EstateResource.OFFERS -> Icons.Rounded.Description
    EstateResource.TRANSACTIONS -> Icons.Rounded.FactCheck
    EstateResource.CALENDAR -> Icons.Rounded.CalendarMonth
    EstateResource.COMPLIANCE -> Icons.Rounded.VerifiedUser
}

@Composable
internal fun EstateFactRows(facts: List<Pair<String, String>>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        facts.forEachIndexed { index, (label, value) ->
            if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                val icon = when {
                    label.contains("price", true) || label == "Budget" -> Icons.Rounded.Payments
                    label.contains("location", true) -> Icons.Rounded.LocationOn
                    label.contains("agent", true) || label == "Customer" -> Icons.Rounded.PersonOutline
                    label.contains("bedroom", true) -> Icons.Rounded.Bed
                    label.contains("bathroom", true) -> Icons.Rounded.Bathtub
                    label == "Size" -> Icons.Rounded.SquareFoot
                    label.contains("updated", true) || label.contains("action", true) -> Icons.Rounded.Schedule
                    else -> Icons.Rounded.Info
                }
                Icon(icon, null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (label == "Status") EstateStatusBadge(value)
                    else Text(value, style = if (label == "Budget" || label.startsWith("Price"))
                        MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

@Composable
internal fun EstateRecordIdentity(card: EstateServerCard) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        if (card.link.resource == EstateResource.BUYERS) SegmiqAvatar(card.title)
        else if (card.listing == null) {
            Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                Icon(estateWorkspaceIcon(card.link.resource), null, Modifier.padding(12.dp).size(24.dp),
                    tint = MaterialTheme.colorScheme.primary)
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(card.title, style = MaterialTheme.typography.titleMedium)
            Text(card.subtitle, style = if (card.link.resource in setOf(EstateResource.OFFERS, EstateResource.TRANSACTIONS))
                MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            card.status?.let { EstateStatusBadge(it) }
        }
        Icon(Icons.Rounded.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
