package com.segmiq.sales.core.design

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.annotation.DrawableRes
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.segmiq.sales.R
import com.segmiq.sales.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Only bundled decorative/generated artwork enters this cache. No URLs, tokens or customer images.
private object ArtworkCache {
    val bitmaps = object : LruCache<Int, Bitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: Int, value: Bitmap) = value.allocationByteCount
    }
}
object SegmiqGradients {
    val ForestHero get() = Brush.linearGradient(listOf(Color(0xFF09150F), Color(0xFF183825)))
    val PhotoScrim get() = Brush.verticalGradient(listOf(Color.Black.copy(alpha = .48f), Color(0xFF07100B).copy(alpha = .62f), Color(0xFF07100B).copy(alpha = .96f)))
}

/** Bounded asynchronous decode. Missing artwork shows a deliberate architectural fallback. */
@Composable
fun SegmiqArtwork(@DrawableRes resource: Int, modifier: Modifier = Modifier, description: String? = null) {
    val resources = LocalContext.current.resources
    var failed by remember(resource) { mutableStateOf(false) }
    val bitmap by produceState<Bitmap?>(ArtworkCache.bitmaps.get(resource), resource) {
        value = withContext(Dispatchers.IO) {
            ArtworkCache.bitmaps.get(resource) ?: runCatching {
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeResource(resources, resource, bounds)
                var sample = 1
                while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1440) sample *= 2
                BitmapFactory.decodeResource(resources, resource, BitmapFactory.Options().apply {
                    inSampleSize = sample; inScaled = false
                })?.also { ArtworkCache.bitmaps.put(resource, it) }
            }.getOrNull()
        }
        failed = value == null
    }
    val alpha by animateFloatAsState(if (bitmap == null) 0f else 1f, tween(260), label = "Artwork reveal")
    Box(modifier.background(ForestDeep).testTag(if (bitmap == null && !failed) "artwork-loading" else "artwork-ready")) {
        if (bitmap == null) {
            if (failed && resource != R.drawable.estate_listing_placeholder)
                SegmiqArtwork(R.drawable.estate_listing_placeholder, Modifier.fillMaxSize(), "Architectural placeholder; image unavailable")
            else SegmiqEmptyIllustration("property", Modifier.fillMaxSize())
        }
        if (failed) Surface(Modifier.align(Alignment.BottomStart).padding(12.dp), color = Ink, contentColor = Color.White, shape = RoundedCornerShape(8.dp)) {
            Text("Image unavailable", Modifier.padding(horizontal = 10.dp, vertical = 6.dp), style = MaterialTheme.typography.labelSmall)
        }
        bitmap?.let { Image(it.asImageBitmap(), description, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alpha = alpha) }
    }
}

@Composable
fun SegmiqBrandLogo(modifier: Modifier = Modifier, qOnly: Boolean = false) {
    Image(painterResource(if (qOnly) R.drawable.segmiq_official_q_transparent else R.drawable.segmiq_official_logo_transparent),
        if (qOnly) "SegmiQ Q" else "SegmiQ", modifier)
}

@Composable
fun SegmiqGradientHero(title: String, description: String, modifier: Modifier = Modifier,
                       content: @Composable ColumnScope.() -> Unit = {}) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = ForestDeep, contentColor = Color.White) {
        Column(Modifier.background(SegmiqGradients.ForestHero).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.headlineSmall)
            Text(description, color = Color(0xFFD1DED4), style = MaterialTheme.typography.bodyMedium)
            content()
        }
    }
}

/** Decorative images may appear in live banners; record photographs must use a separate authorised adapter. */
@Composable
fun SegmiqImageFeatureCard(@DrawableRes resource: Int, heading: String, description: String,
                           modifier: Modifier = Modifier, badge: String? = null, minHeight: Int = 200,
                           content: @Composable ColumnScope.() -> Unit = {}) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = ForestDeep, contentColor = Color.White) {
        Box {
            SegmiqArtwork(resource, Modifier.matchParentSize())
            Box(Modifier.matchParentSize().background(SegmiqGradients.PhotoScrim))
            Column(Modifier.fillMaxWidth().heightIn(min = minHeight.dp).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (badge != null) Text(badge, style = MaterialTheme.typography.labelSmall, color = Lime)
                Spacer(Modifier.height(12.dp))
                Text(heading, style = MaterialTheme.typography.headlineSmall)
                Text(description, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFE2E8E0))
                content()
            }
        }
    }
}

@Composable
fun SegmiqCopilotHeader(subtitle: String) {
    SegmiqGradientHero("Your priorities today", subtitle) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SegmiqBrandLogo(Modifier.size(44.dp), qOnly = true)
            Text("Sales Copilot", style = MaterialTheme.typography.titleMedium, color = Lime)
        }
    }
}

/** Eight quiet geometric motifs; no characters or invented customer portraits. */
@Composable
fun SegmiqEmptyIllustration(kind: String, modifier: Modifier = Modifier) {
    val line = MaterialTheme.colorScheme.onSurfaceVariant
    val accent = MaterialTheme.colorScheme.primary
    Canvas(modifier) {
        val w = size.width; val h = size.height; val cx = w / 2; val cy = h / 2
        val r = minOf(w, h) * .27f; val stroke = Stroke(2.dp.toPx())
        drawCircle(line.copy(alpha = .08f), r * 1.5f, Offset(cx, cy))
        when (kind) {
            "property" -> {
                drawLine(line, Offset(cx-r, cy), Offset(cx, cy-r), 2.dp.toPx())
                drawLine(line, Offset(cx, cy-r), Offset(cx+r, cy), 2.dp.toPx())
                drawRect(line, Offset(cx-r*.7f, cy), androidx.compose.ui.geometry.Size(r*1.4f, r), style = stroke)
                drawRect(accent, Offset(cx-r*.12f, cy+r*.4f), androidx.compose.ui.geometry.Size(r*.24f, r*.6f))
            }
            "buyer" -> { drawCircle(line, r*.42f, Offset(cx, cy-r*.4f), style = stroke)
                drawArc(line, 190f, 160f, false, Offset(cx-r,cy), androidx.compose.ui.geometry.Size(r*2,r*1.5f), style = stroke) }
            "transaction" -> {
                drawLine(line, Offset(cx-r*.65f,cy-r),Offset(cx-r*.65f,cy+r),2.dp.toPx())
                repeat(3) { i -> val y=cy-r+i*r
                    drawCircle(if (i==0) accent else line,r*.16f,Offset(cx-r*.65f,y),style=stroke)
                    drawLine(line,Offset(cx-r*.2f,y),Offset(cx+r,y),2.dp.toPx()) }
            }
            "copilot" -> repeat(3) { i ->
                drawRoundRect(if (i==2) accent else line,Offset(cx-r+i*r*.35f,cy-r+i*r*.35f),
                    androidx.compose.ui.geometry.Size(r*1.3f,r*1.3f),androidx.compose.ui.geometry.CornerRadius(5.dp.toPx()),style=stroke)
            }
            "inquiry" -> {
                drawRoundRect(line,Offset(cx-r,cy-r*.8f),androidx.compose.ui.geometry.Size(r*2,r*1.4f),
                    androidx.compose.ui.geometry.CornerRadius(7.dp.toPx()),style=stroke)
                drawLine(line,Offset(cx-r*.6f,cy+r*.6f),Offset(cx-r*.9f,cy+r),2.dp.toPx())
                repeat(3) { i -> drawCircle(if(i==2) accent else line,r*.08f,Offset(cx+(i-1)*r*.5f,cy-r*.1f)) }
            }
            "viewing" -> {
                drawRoundRect(line,Offset(cx-r,cy-r),androidx.compose.ui.geometry.Size(r*2,r*2),
                    androidx.compose.ui.geometry.CornerRadius(6.dp.toPx()),style=stroke)
                drawLine(line,Offset(cx-r,cy-r*.4f),Offset(cx+r,cy-r*.4f),2.dp.toPx())
                drawLine(accent,Offset(cx-r*.4f,cy+r*.2f),Offset(cx-r*.05f,cy+r*.55f),2.dp.toPx())
                drawLine(accent,Offset(cx-r*.05f,cy+r*.55f),Offset(cx+r*.55f,cy-r*.05f),2.dp.toPx())
            }
            "recording" -> repeat(7) { i -> val d = (1f-kotlin.math.abs(i-3)/4f)*r
                drawLine(line, Offset(cx+(i-3)*r*.3f,cy-d),Offset(cx+(i-3)*r*.3f,cy+d),3.dp.toPx()) }
            else -> {
                drawRoundRect(line, Offset(cx-r, cy-r), androidx.compose.ui.geometry.Size(r*2,r*2), androidx.compose.ui.geometry.CornerRadius(8.dp.toPx()), style = stroke)
                repeat(3) { i -> drawLine(if (i==0) accent else line, Offset(cx-r*.55f,cy-r*.45f+i*r*.45f),
                    Offset(cx+r*.55f,cy-r*.45f+i*r*.45f),2.dp.toPx()) }
            }
        }
        drawCircle(accent, 4.dp.toPx(), Offset(cx+r*1.25f,cy-r*.9f))
    }
}
