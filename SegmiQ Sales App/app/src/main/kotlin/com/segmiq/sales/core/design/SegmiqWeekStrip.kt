package com.segmiq.sales.core.design

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.segmiq.sales.ui.theme.Ink
import com.segmiq.sales.ui.theme.Lime
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** A scrollable seven-day strip preserves 48dp targets and large text on compact phones. */
@Composable
fun SegmiqWeekStrip(date: LocalDate, markedDates: Set<LocalDate>, onSelect: (LocalDate) -> Unit) =
    SegmiqWeekStrip(date, markedDates, onSelect, null)

@Composable
fun SegmiqWeekStrip(date: LocalDate, markedDates: Set<LocalDate>, onSelect: (LocalDate) -> Unit,
    knownDates: Set<LocalDate>?) {
    val days = remember(date.with(DayOfWeek.MONDAY)) { (0..6).map { date.with(DayOfWeek.MONDAY).plusDays(it.toLong()) } }
    val scroll = rememberLazyListState()
    LaunchedEffect(date) { scroll.animateScrollToItem(days.indexOf(date).coerceAtLeast(0)) }
    LazyRow(state = scroll, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items(days, key = { it.toString() }) { day ->
            val selected = day == date
            val background by animateColorAsState(if (selected) Lime else MaterialTheme.colorScheme.surface, tween(180), label = "Selected date")
            Surface(onClick = { onSelect(day) }, shape = RoundedCornerShape(16.dp), color = background,
                contentColor = if (selected) Ink else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.widthIn(min = 52.dp).semantics {
                    contentDescription = day.format(DateTimeFormatter.ofPattern("EEEE d MMMM")) +
                        (if (day in markedDates) ", scheduled activities" else if (knownDates != null && day !in knownDates) ", schedule not loaded" else ", no scheduled activities") +
                        (if (selected) ", selected" else "")
                }) {
                Column(Modifier.padding(horizontal = 10.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(day.format(DateTimeFormatter.ofPattern("EEE")), style = MaterialTheme.typography.labelSmall)
                    Text(day.dayOfMonth.toString(), style = MaterialTheme.typography.titleLarge)
                    Text(if (day in markedDates) "•" else " ", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}
