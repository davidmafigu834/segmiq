package com.segmiq.sales

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.provider.MediaStore
import androidx.test.platform.app.InstrumentationRegistry

/** QA-only fictional screenshots survive Gradle's app uninstall. Never called by production code. */
internal fun savePremiumCapture(context: Context, name: String, bitmap: Bitmap) {
    check(Build.VERSION.SDK_INT >= 29) { "Premium capture suite requires an API 29+ emulator" }
    val resolver = context.contentResolver
    val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, "$name.png")
        put(MediaStore.Downloads.MIME_TYPE, "image/png")
        val folder = InstrumentationRegistry.getArguments().getString("premiumCaptureDirectory") ?: "segmiq-premium-ui"
        put(MediaStore.Downloads.RELATIVE_PATH, "Download/$folder")
        put(MediaStore.Downloads.IS_PENDING, 1)
    }
    val uri = checkNotNull(resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values))
    try {
        checkNotNull(resolver.openOutputStream(uri)).use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        resolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
    } catch (failure: Throwable) {
        resolver.delete(uri, null, null)
        throw failure
    }
}
