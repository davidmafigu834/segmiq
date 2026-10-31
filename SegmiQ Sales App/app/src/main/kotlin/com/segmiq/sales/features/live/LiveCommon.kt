package com.segmiq.sales.features.live

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.segmiq.sales.core.live.parseServerDate
import com.segmiq.sales.core.live.parseServerInstant
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Currency
import java.util.Locale

private val DAY = DateTimeFormatter.ofPattern("EEE d MMM", Locale.getDefault())
private val TIME = DateTimeFormatter.ofPattern("HH:mm", Locale.getDefault())

/** "Today", "Tomorrow", "Yesterday" or a short date, relative to today in the organisation's zone. */
fun friendlyDate(date: LocalDate, zone: ZoneId, now: Instant = Instant.now()): String {
    val today = now.atZone(zone).toLocalDate()
    return when (date) {
        today -> "Today"
        today.plusDays(1) -> "Tomorrow"
        today.minusDays(1) -> "Yesterday"
        else -> date.format(DAY)
    }
}

/** Date plus time of day when the server value carries one; date-only values never get a fake time. */
fun friendlyWhen(value: String?, zone: ZoneId, now: Instant = Instant.now()): String? {
    val date = parseServerDate(value, zone) ?: return null
    val instant = parseServerInstant(value)
    val day = friendlyDate(date, zone, now)
    return if (instant != null) "$day · ${instant.atZone(zone).format(TIME)}" else day
}

fun updatedLabel(at: Instant?, zone: ZoneId): String? = at?.let { "Updated ${it.atZone(zone).format(TIME)}" }

/** Money with the organisation's configured currency only; otherwise a plain number, flagged as such. */
fun formatAmount(value: Double, currencyCode: String?): String {
    if (currencyCode != null) {
        runCatching {
            val f = NumberFormat.getCurrencyInstance(Locale.getDefault())
            f.currency = Currency.getInstance(currencyCode)
            f.maximumFractionDigits = 0
            return f.format(value)
        }
    }
    return NumberFormat.getNumberInstance(Locale.getDefault()).apply { maximumFractionDigits = 0 }.format(value)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FollowUpDateDialog(initial: LocalDate?, zone: ZoneId, onDismiss: () -> Unit, title: String = "Follow-up date", onConfirm: (LocalDate) -> Unit) {
    val today = remember(zone) { LocalDate.now(zone) }
    val state = rememberDatePickerState(
        initialSelectedDateMillis = (initial ?: today.plusDays(1)).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                !Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate().isBefore(today)
        },
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                state.selectedDateMillis?.let { onConfirm(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
            }, enabled = state.selectedDateMillis != null) { Text("Set date") }
        },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    ) {
        DatePicker(state, title = { Text(title, Modifier.padding(start = 24.dp, top = 16.dp)) })
    }
}

/** Date then time, interpreted in the organisation's time zone. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateTimeDialog(title: String, zone: ZoneId, onDismiss: () -> Unit, onConfirm: (ZonedDateTime) -> Unit) {
    var date by remember { mutableStateOf<LocalDate?>(null) }
    if (date == null) {
        FollowUpDateDialog(null, zone, onDismiss, title = title) { date = it }
    } else {
        val time = rememberTimePickerState(initialHour = 9, initialMinute = 0, is24Hour = true)
        val local = java.time.LocalDateTime.of(date, LocalTime.of(time.hour, time.minute))
        val offsets = zone.rules.getValidOffsets(local)
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(title) },
            text = { Column(Modifier.verticalScroll(rememberScrollState())) {
                TimePicker(time)
                if (offsets.size != 1) Text("This time is ambiguous or unavailable in this time zone. Choose another time.", color = MaterialTheme.colorScheme.error)
            } },
            confirmButton = {
                TextButton({ onConfirm(ZonedDateTime.ofStrict(local, offsets.single(), zone)) }, enabled = offsets.size == 1) { Text("Confirm") }
            },
            dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
        )
    }
}
