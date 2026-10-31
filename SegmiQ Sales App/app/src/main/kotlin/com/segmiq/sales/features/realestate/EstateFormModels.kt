package com.segmiq.sales.features.realestate

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID

/** Plain decimal entry only: no NaN, Infinity, exponents, commas or binary floating point. */
fun estateDecimal(text: String): BigDecimal? = text.trim().takeIf {
    it.length <= 30 && it.matches(Regex("[0-9]+(\\.[0-9]{1,6})?"))
}?.toBigDecimalOrNull()

fun estateAmount(value: BigDecimal?): String = value?.let {
    java.text.NumberFormat.getCurrencyInstance(java.util.Locale.US).apply { maximumFractionDigits = 6 }.format(it)
} ?: "Not specified"

data class RequirementsDraft(
    val budgetMin: String = "", val budgetMax: String = "", val locations: String = "",
    val propertyType: String = "", val bedrooms: String = "", val bathrooms: String = "",
    val features: String = "", val notes: String = "",
) {
    fun errors(): Map<String, String> = buildMap {
        val min = estateDecimal(budgetMin); val max = estateDecimal(budgetMax)
        if (budgetMin.isNotBlank() && min == null) put("budgetMin", "Enter a non-negative decimal amount.")
        if (budgetMax.isNotBlank() && max == null) put("budgetMax", "Enter a non-negative decimal amount.")
        if (min != null && max != null && min > max) put("budgetMax", "Maximum must be at least the minimum.")
        val places = locationValues()
        if (places.size > 12 || places.any { it.length > 120 }) put("locations", "Use up to 12 locations, each at most 120 characters.")
        if (propertyType.length > 100) put("propertyType", "Use at most 100 characters.")
        listOf("bedrooms" to bedrooms, "bathrooms" to bathrooms).forEach { (key, value) ->
            if (value.isNotBlank() && value.toIntOrNull() !in 0..100) put(key, "Enter a whole number from 0 to 100, or leave blank.")
        }
        if (features.length > 2000) put("features", "Use at most 2000 characters.")
        if (notes.length > 5000) put("notes", "Use at most 5000 characters.")
    }
    fun locationValues() = locations.split(',').map(String::trim).filter(String::isNotEmpty).distinct()
}

/** One intended booking, preserved across recomposition and saveable form restoration. */
data class BookingIdentity(val fingerprint: String = "", val key: String = "") {
    fun forIntent(value: String) = if (value == fingerprint && key.isNotBlank()) this
        else BookingIdentity(value, UUID.randomUUID().toString())
}
fun viewingTimeError(at: Instant?, now: Instant = Instant.now()): String? =
    when { at == null -> "Choose a date and time."; at <= now -> "Choose a future date and time."; else -> null }

/** Reject invalid/ambiguous wall times rather than silently shifting a booking at a DST boundary. */
fun viewingInstant(local: LocalDateTime, zone: ZoneId): Instant? =
    zone.rules.getValidOffsets(local).singleOrNull()?.let { local.toInstant(it) }
