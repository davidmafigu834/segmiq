package com.segmiq.sales.features.live

import com.segmiq.sales.core.bootstrap.Experience
import com.segmiq.sales.core.bootstrap.LiveModule
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.estate.EstateAccess
import com.segmiq.sales.features.realestate.estateResource

enum class ModulePresence { NATIVE, GATED, WEB_ONLY, UNAVAILABLE }

fun modulePresence(module: LiveModule, workspace: LiveWorkspace, access: EstateAccess): ModulePresence {
    if (module == LiveModule.INBOX) return ModulePresence.NATIVE
    val resource = estateResource(module)
    if (workspace.experience == Experience.REAL_ESTATE && resource != null) {
        val reason = access.reason(resource) ?: return ModulePresence.NATIVE
        return if (reason.contains("not granted") || reason.contains("not available for your workspace"))
            ModulePresence.UNAVAILABLE else ModulePresence.GATED
    }
    if (module.implemented) return ModulePresence.NATIVE
    return ModulePresence.WEB_ONLY
}

fun moduleStatusLine(module: LiveModule, workspace: LiveWorkspace, access: EstateAccess): String {
    val label = workspace.navigation.find(module)?.label ?: module.name.lowercase().replace('_', ' ')
    return when (modulePresence(module, workspace, access)) {
        ModulePresence.NATIVE -> if (module == LiveModule.INBOX) "WhatsApp conversations" else "Open ${label.lowercase()}"
        ModulePresence.GATED -> "Native screen is ready. This release is waiting for security verification."
        ModulePresence.UNAVAILABLE -> "Not available for this account."
        ModulePresence.WEB_ONLY -> if (workspace.experience == Experience.REAL_ESTATE) "Continue on SegmiQ web." else "Not in the app yet"
    }
}
