package com.segmiq.sales.core.network

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

enum class ErrorKind {
    OFFLINE,
    TIMEOUT,
    INVALID_CREDENTIALS,
    RATE_LIMITED,
    /** Token or server session is no longer valid. The user must sign in again. */
    SESSION_ENDED,
    MFA_FAILED,
    MFA_ENROLMENT_REQUIRED,
    INSUFFICIENT_ROLE,
    NO_ORGANISATION,
    ORGANISATION_SUSPENDED,
    SUBSCRIPTION_SUSPENDED,
    UNSUPPORTED_SESSION,
    FORBIDDEN,
    NOT_FOUND,
    /** The server does not provide this endpoint (HTML 404), e.g. an older deployment. */
    ENDPOINT_MISSING,
    CONFLICT,
    STALE,
    VALIDATION,
    SERVER,
    DECODING,
    UNKNOWN,
}

data class ApiError(
    val kind: ErrorKind,
    val message: String,
    val status: Int? = null,
    val code: String? = null,
    val reason: String? = null,
    val field: String? = null,
    /** True for the legacy `{"error":"Unauthorized"}` 401 that carries no diagnostic code. */
    val genericUnauthorized: Boolean = false,
    val body: JsonObject? = null,
) {
    /** Errors that end the authenticated session and require local data to be cleared. */
    val endsSession: Boolean
        get() = kind in SESSION_ENDING

    /**
     * People-facing copy. Validation, conflict and permission sentences stay specific.
     * 5xx and unclassified bodies stay on the generic sentence so an internal `error`
     * string cannot be shown just because it is readable.
     */
    fun screenMessage(): String = when (kind) {
        ErrorKind.SERVER, ErrorKind.UNKNOWN, ErrorKind.DECODING -> ErrorMapper.defaultMessage(kind)
        else -> message
    }

    companion object {
        val SESSION_ENDING = setOf(
            ErrorKind.SESSION_ENDED,
            ErrorKind.INSUFFICIENT_ROLE,
            ErrorKind.NO_ORGANISATION,
            ErrorKind.ORGANISATION_SUSPENDED,
            ErrorKind.MFA_ENROLMENT_REQUIRED,
            ErrorKind.UNSUPPORTED_SESSION,
        )
    }
}

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class Failure(val error: ApiError) : ApiResult<Nothing>
}

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(value))
    is ApiResult.Failure -> this
}

fun <T> ApiResult<T>.valueOrNull(): T? = (this as? ApiResult.Success)?.value
fun <T> ApiResult<T>.errorOrNull(): ApiError? = (this as? ApiResult.Failure)?.error

object ErrorMapper {
    private val CODE_KINDS = mapOf(
        "INVALID_CREDENTIALS" to ErrorKind.INVALID_CREDENTIALS,
        "RATE_LIMITED" to ErrorKind.RATE_LIMITED,
        "TOKEN_INVALID" to ErrorKind.SESSION_ENDED,
        "TOKEN_EXPIRED" to ErrorKind.SESSION_ENDED,
        "SESSION_EXPIRED" to ErrorKind.SESSION_ENDED,
        "SESSION_REVOKED" to ErrorKind.SESSION_ENDED,
        "ACCOUNT_DISABLED" to ErrorKind.SESSION_ENDED,
        "MFA_REQUIRED" to ErrorKind.SESSION_ENDED,
        "MFA_VERIFICATION_FAILED" to ErrorKind.MFA_FAILED,
        "MFA_ENROLMENT_REQUIRED" to ErrorKind.MFA_ENROLMENT_REQUIRED,
        "INSUFFICIENT_ROLE" to ErrorKind.INSUFFICIENT_ROLE,
        "NO_ORGANISATION" to ErrorKind.NO_ORGANISATION,
        "ORGANISATION_SUSPENDED" to ErrorKind.ORGANISATION_SUSPENDED,
        "SUBSCRIPTION_SUSPENDED" to ErrorKind.SUBSCRIPTION_SUSPENDED,
        "UNSUPPORTED_SESSION" to ErrorKind.UNSUPPORTED_SESSION,
        "INVALID_REQUEST" to ErrorKind.VALIDATION,
        "SERVICE_UNAVAILABLE" to ErrorKind.SERVER,
        "SERVER_MISCONFIGURED" to ErrorKind.SERVER,
        "stale" to ErrorKind.STALE,
    )

    fun fromHttp(status: Int, bodyText: String?, contentType: String?): ApiError {
        val obj = parseObject(bodyText, contentType)
        val code = obj?.string("code")
        val legacy = obj?.string("error")
        val serverMessage = obj?.string("message")
        val reason = obj?.string("reason")
        val field = obj?.string("field")
        val byCode = code?.let { CODE_KINDS[it] }
        val generic401 = status == 401 && byCode == null
        val kind = byCode ?: when (status) {
            400, 422 -> ErrorKind.VALIDATION
            401 -> ErrorKind.SESSION_ENDED
            402 -> ErrorKind.SUBSCRIPTION_SUSPENDED
            403 -> ErrorKind.FORBIDDEN
            404 -> if (obj == null) ErrorKind.ENDPOINT_MISSING else ErrorKind.NOT_FOUND
            409 -> ErrorKind.CONFLICT
            429 -> ErrorKind.RATE_LIMITED
            in 500..599 -> ErrorKind.SERVER
            else -> ErrorKind.UNKNOWN
        }
        val message = serverMessage?.takeIf { it.isNotBlank() }
            ?: legacy?.takeIf { it.isReadableSentence() && kind in LEGACY_TEXT_ALLOWED }
            ?: defaultMessage(kind)
        return ApiError(kind, message, status, code, reason, field, generic401, obj)
    }

    fun offline() = ApiError(ErrorKind.OFFLINE, defaultMessage(ErrorKind.OFFLINE))
    fun timeout() = ApiError(ErrorKind.TIMEOUT, defaultMessage(ErrorKind.TIMEOUT))
    fun decoding() = ApiError(ErrorKind.DECODING, defaultMessage(ErrorKind.DECODING))

    /** Legacy `error` strings are shown only where the server writes them for people. */
    private val LEGACY_TEXT_ALLOWED = setOf(
        ErrorKind.VALIDATION, ErrorKind.CONFLICT, ErrorKind.STALE, ErrorKind.SERVER, ErrorKind.FORBIDDEN,
    )

    private fun String.isReadableSentence(): Boolean =
        contains(' ') && length in 8..240 && !equals("Invalid body", ignoreCase = true)

    fun defaultMessage(kind: ErrorKind): String = when (kind) {
        ErrorKind.OFFLINE -> "You're offline. Check your connection and try again."
        ErrorKind.TIMEOUT -> "SegmiQ took too long to respond. Try again."
        ErrorKind.INVALID_CREDENTIALS -> "That email or password is incorrect."
        ErrorKind.RATE_LIMITED -> "Too many attempts. Wait a few minutes before trying again."
        ErrorKind.SESSION_ENDED -> "Your session has ended. Sign in again."
        ErrorKind.MFA_FAILED -> "That code didn't work. Check it and try again."
        ErrorKind.MFA_ENROLMENT_REQUIRED -> "Your organisation requires two-step verification. Set it up on the SegmiQ website, then sign in again."
        ErrorKind.INSUFFICIENT_ROLE -> "SegmiQ Sales is for salespeople and selling managers. Your account does not have sales access."
        ErrorKind.NO_ORGANISATION -> "Your account is not linked to an organisation. Contact your administrator."
        ErrorKind.ORGANISATION_SUSPENDED -> "Your organisation's SegmiQ access is suspended. Contact your administrator."
        ErrorKind.SUBSCRIPTION_SUSPENDED -> "Your organisation's SegmiQ subscription is suspended. Contact your administrator."
        ErrorKind.UNSUPPORTED_SESSION -> "This kind of session cannot be used in the Sales app. Sign in again."
        ErrorKind.FORBIDDEN -> "You don't have access to this."
        ErrorKind.NOT_FOUND -> "This record is not available. It may have been reassigned or removed."
        ErrorKind.ENDPOINT_MISSING -> "This SegmiQ server does not support this feature yet."
        ErrorKind.CONFLICT -> "This changed on the server. Refresh and try again."
        ErrorKind.STALE -> "This suggestion is out of date. Refresh to see the latest."
        ErrorKind.VALIDATION -> "Some details are not valid. Check and try again."
        ErrorKind.SERVER -> "SegmiQ couldn't complete this right now. Try again shortly."
        ErrorKind.DECODING -> "SegmiQ sent a response this app version doesn't understand. Update the app or try again later."
        ErrorKind.UNKNOWN -> "Something went wrong. Try again."
    }

    private fun parseObject(bodyText: String?, contentType: String?): JsonObject? {
        if (bodyText.isNullOrBlank()) return null
        if (contentType != null && !contentType.contains("json", ignoreCase = true)) return null
        return runCatching { SegmiqJson.parseToJsonElement(bodyText).jsonObject }.getOrNull()
    }

    private fun JsonObject.string(key: String): String? =
        (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
}
