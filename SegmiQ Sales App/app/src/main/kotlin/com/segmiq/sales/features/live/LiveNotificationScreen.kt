package com.segmiq.sales.features.live

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.segmiq.sales.app.Page
import com.segmiq.sales.core.bootstrap.Experience
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.design.SegmiqErrorCard
import com.segmiq.sales.core.design.SegmiqPrimaryButton
import com.segmiq.sales.core.design.SegmiqSkeleton
import com.segmiq.sales.core.estate.EstateAccess
import com.segmiq.sales.core.estate.EstateResource
import com.segmiq.sales.core.inbox.AppNotificationDto
import com.segmiq.sales.core.inbox.notificationDestination
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class NotificationListState(
    val loading: Boolean = true,
    val error: String? = null,
    val items: List<AppNotificationDto> = emptyList(),
    val unread: Int = 0,
    val ownerId: String = "",
)

class NotificationsViewModel(private val api: LiveSalesApi, val userId: String) : ViewModel() {
    private val stateFlow = MutableStateFlow(NotificationListState(ownerId = userId))
    val state = stateFlow.asStateFlow()

    fun load() {
        stateFlow.update { it.copy(loading = true, error = null, ownerId = userId) }
        viewModelScope.launch {
            when (val result = api.notifications()) {
                is ApiResult.Success -> stateFlow.value = NotificationListState(
                    loading = false, items = result.value.notifications, unread = result.value.unreadCount, ownerId = userId,
                )
                is ApiResult.Failure -> stateFlow.update { it.copy(loading = false, error = result.error.message, ownerId = userId) }
            }
        }
    }
}

@Composable
fun LiveNotificationScreen(workspace: LiveWorkspace, api: LiveSalesApi, go: (String) -> Unit = {}) {
    val context = LocalContext.current
    val vm = viewModel(key = "notes-${workspace.scope.salespersonId}") { NotificationsViewModel(api, workspace.scope.salespersonId) }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(vm.userId) { if (state.items.isEmpty()) vm.load() }
    var granted by remember {
        mutableStateOf(Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    val introductionsOpen = workspace.experience == Experience.REAL_ESTATE &&
        EstateAccess(workspace, api.baseUrl()).reason(EstateResource.INTRODUCTIONS) == null
    val visible = if (state.ownerId == workspace.scope.salespersonId) state.items else emptyList()
    Page {
        Text("Notifications", style = MaterialTheme.typography.headlineMedium)
        Text("Loaded for this sign-in. This is not push delivery, and this phone is not registered for Firebase.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(if (state.unread > 0) "${state.unread} unread" else "No unread count above zero", style = MaterialTheme.typography.labelLarge)
        TextButton(vm::load, enabled = !state.loading) { Text("Refresh") }
        when {
            state.loading && visible.isEmpty() -> SegmiqSkeleton(3)
            state.error != null && visible.isEmpty() -> SegmiqErrorCard(state.error!!, vm::load)
            visible.isEmpty() -> Text("No notifications were returned.")
            else -> visible.forEach { item ->
                val route = notificationDestination(item.leadId, item.introductionId, introductionsOpen)
                Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                    androidx.compose.foundation.layout.Column(Modifier.padding(14.dp)) {
                        Text(item.message.ifBlank { item.type.ifBlank { "Notification" } })
                        Text(listOfNotNull(item.type.takeIf { it.isNotBlank() }, stamp(item.createdAt), if (item.read) "Read" else "Unread").joinToString(" · "),
                            style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (route != null) TextButton({ go(route) }) { Text("Open record") }
                    }
                }
            }
        }
        Text("Local reminders still use the follow-up already loaded in Tasks. Android may deliver one later than the listed time.",
            style = MaterialTheme.typography.bodySmall)
        if (granted) Text("Local reminders are allowed on this phone.")
        else SegmiqPrimaryButton("Allow local reminders", { ask.launch(Manifest.permission.POST_NOTIFICATIONS) }, Modifier.fillMaxWidth())
        Text(workspace.organisationName, style = MaterialTheme.typography.labelLarge)
    }
}

private fun stamp(value: String) = runCatching {
    Instant.parse(value).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("d MMM, HH:mm"))
}.getOrDefault(value)
