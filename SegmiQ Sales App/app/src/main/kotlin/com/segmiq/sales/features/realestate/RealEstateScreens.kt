package com.segmiq.sales.features.realestate

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.segmiq.sales.R
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.design.*
import com.segmiq.sales.features.live.vector
import okhttp3.HttpUrl

@Composable
fun EstateBrandTitle() {
    Image(painterResource(R.drawable.segmiq_official_logo_transparent), "SegmiQ Sales",
        Modifier.background(Color(0xFF0C0C0C), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 6.dp).width(110.dp).height(32.dp))
}

/** Milestone A entry states. These screens deliberately have no API/repository dependency. */
@Composable
fun EstateModuleEntry(item: NavItem, workspace: LiveWorkspace, baseUrl: HttpUrl, onPreview: (() -> Unit)? = null) {
    val uri = LocalUriHandler.current
        val message = "The native screen is in the app. Records stay unloaded until this revision passes security verification for your role."
        val destination = workspace.bootstrap.navigation.destinations.firstOrNull { it.id in item.destinationIds }
        val short = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp < 700
        Page {
            val decoration = when (item.module) {
            LiveModule.PROPERTIES -> R.drawable.estate_discovery_feature
            LiveModule.BUYERS_TENANTS -> R.drawable.estate_buyer_matching_feature
            LiveModule.VIEWINGS -> R.drawable.estate_viewing_feature
            LiveModule.TRANSACTIONS -> R.drawable.estate_transaction_feature
            else -> null
        }
        decoration?.let {
            SegmiqImageFeatureCard(it, item.label, "Decorative image. No live records.",
                badge = "DECORATIVE IMAGE · NO LIVE RECORDS", minHeight = if (short) 72 else 112)
        }
        SegmiqLabel("MOBILE ROLLOUT GATED · WEB AVAILABLE")
        EstateNotice(item.label, message, item.icon.vector())
        Text(estateGateReason(item.module), style = MaterialTheme.typography.bodyMedium)
        workspace.bootstrap.release?.let { release ->
            Text("Server contract ${release.contractVersion} · ${release.deployedVerification.replace('_', ' ')}",
                style = MaterialTheme.typography.labelMedium)
        }
        if (onPreview != null) SegmiqPrimaryButton("Open fictional training data", onPreview, Modifier.fillMaxWidth())
        Text("No customer records have been loaded for this module.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        destination?.webPath?.takeIf { it.startsWith("/") && !it.startsWith("//") }?.let { path ->
            OutlinedButton({ uri.openUri(baseUrl.newBuilder().encodedPath(path).build().toString()) },
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp), shape = RoundedCornerShape(16.dp)) {
                Icon(Icons.AutoMirrored.Rounded.OpenInNew, null, Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Open ${item.label.lowercase()} on web")
            }
            Text("You may need to sign in to your browser.",
                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun EstateSettings(workspace: LiveWorkspace, server: String, onSignOut: () -> Unit, onPreview: (() -> Unit)? = null) {
    var confirm by remember { mutableStateOf(false) }
    Page {
        SegmiqGradientHero("Your SegmiQ workspace", workspace.organisationName) {
            SegmiqBrandLogo(Modifier.width(128.dp))
        }
        SegmiqAvatar(workspace.userName)
        Text(workspace.userName, style = MaterialTheme.typography.headlineLarge)
        Text(workspace.organisationName, style = MaterialTheme.typography.bodyLarge)
        SegmiqCard {
            Text("Your workspace", style = MaterialTheme.typography.titleLarge)
            Text("Real Estate · ${if (workspace.bootstrap.user.role == "SALESPERSON") "Agent" else "Selling manager"}")
            Text("Time zone: ${workspace.zone.id}")
            Text("Currency: ${workspace.currencyCode ?: "Not configured"}")
            workspace.bootstrap.release?.let { release ->
                Text("Backend contract: ${release.contractVersion}")
                Text("Release: ${release.revision ?: "Not supplied"}", style = MaterialTheme.typography.bodyMedium)
                Text("Rollout: ${release.deployedVerification.replace('_', ' ')}", style = MaterialTheme.typography.labelMedium)
            }
            Text("Connected to $server", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        EstateNotice("Managed by your organisation",
            "Your industry, access and sales configuration come from SegmiQ. Contact your administrator to change workspace settings.",
            Icons.Rounded.AdminPanelSettings)
        if (onPreview != null) SegmiqPrimaryButton("Open fictional training data", onPreview, Modifier.fillMaxWidth())
        OutlinedButton({ confirm = true }, Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Sign out") }
    }
    if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("Sign out of SegmiQ Sales?") },
        text = { Text("This removes your session and loaded customer data from this phone.") },
        confirmButton = { TextButton({ confirm = false; onSignOut() }) { Text("Sign out") } },
        dismissButton = { TextButton({ confirm = false }) { Text("Cancel") } })
}
