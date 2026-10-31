package com.segmiq.sales.core.auth

import android.content.Context
import android.os.Build
import java.util.UUID

/** Random per-install id (not a hardware id) and a readable device name for the session list. */
data class DeviceIdentity(val deviceId: String, val deviceName: String) {
    companion object {
        fun load(context: Context): DeviceIdentity {
            val prefs = context.applicationContext.getSharedPreferences("segmiq_device", Context.MODE_PRIVATE)
            val id = prefs.getString("device_id", null) ?: UUID.randomUUID().toString().also {
                prefs.edit().putString("device_id", it).apply()
            }
            val maker = Build.MANUFACTURER.orEmpty().replaceFirstChar { it.uppercase() }
            val model = Build.MODEL.orEmpty()
            val name = if (model.startsWith(maker, ignoreCase = true)) model else "$maker $model".trim()
            return DeviceIdentity(id, name.ifBlank { "Android device" }.take(120))
        }
    }
}
