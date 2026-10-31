package com.segmiq.sales.core.phone

import com.google.i18n.phonenumbers.PhoneNumberUtil
import com.google.i18n.phonenumbers.PhoneNumberUtil.MatchType
import com.google.i18n.phonenumbers.Phonenumber

/** International comparison. Short digit suffixes are never treated as the same person. */
object PhoneNumbers {
    private val util = PhoneNumberUtil.getInstance()
    private val regions = mapOf(
        "zimbabwe" to "ZW", "south africa" to "ZA", "zambia" to "ZM", "botswana" to "BW",
        "united states" to "US", "usa" to "US", "united kingdom" to "GB", "uk" to "GB",
    )

    /** ISO region for libphonenumber. Unknown countries stay ZZ so national numbers are not guessed. */
    fun region(country: String?): String {
        val raw = country?.trim().orEmpty()
        if (raw.length == 2 && raw.all { it.isLetter() }) return raw.uppercase()
        return regions[raw.lowercase()] ?: "ZZ"
    }

    fun dialable(raw: String): String = raw.trim().filter { it.isDigit() || it == '+' }

    fun display(raw: String, region: String): String {
        val parsed = parse(raw, region) ?: return raw.trim()
        return util.format(parsed, PhoneNumberUtil.PhoneNumberFormat.INTERNATIONAL)
    }

    /** True only for a full national or international match in [region]. */
    fun sameSubscriber(left: String, right: String, region: String): Boolean {
        val a = parse(left, region) ?: return false
        val b = parse(right, region) ?: return false
        if (!util.isValidNumber(a) || !util.isValidNumber(b)) return false
        return when (util.isNumberMatch(a, b)) {
            MatchType.EXACT_MATCH, MatchType.NSN_MATCH -> true
            else -> false
        }
    }

    private fun parse(raw: String, region: String): Phonenumber.PhoneNumber? {
        val value = raw.trim()
        if (value.count(Char::isDigit) < 7) return null
        return runCatching { util.parse(value, region.uppercase().ifBlank { "ZZ" }) }.getOrNull()
    }
}
