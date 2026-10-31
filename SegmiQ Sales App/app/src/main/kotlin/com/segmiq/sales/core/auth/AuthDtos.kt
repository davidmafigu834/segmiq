package com.segmiq.sales.core.auth

import kotlinx.serialization.Serializable

/** `user` object returned by sign-in and MFA completion (docs/android-integration/01 §2–3). */
@Serializable
data class AuthUserDto(
    val userId: String,
    val name: String? = null,
    val clientId: String? = null,
    val role: String,
    val clientMode: String? = null,
    val alsoSells: Boolean = false,
    val sessionId: String? = null,
)

/**
 * Union of sign-in responses A (signed in), B (`mfaRequired`) and C (`mfaEnrolmentRequired`),
 * plus MFA completion (`ok`). Fields absent from a variant decode as null.
 */
@Serializable
data class AuthResponseDto(
    val ok: Boolean? = null,
    val token: String? = null,
    val expiresAt: String? = null,
    val user: AuthUserDto? = null,
    val mfaRequired: Boolean? = null,
    val challengeId: String? = null,
    val challengeToken: String? = null,
    val mfaEnrolmentRequired: Boolean? = null,
) {
    override fun toString(): String =
        "AuthResponseDto(mfaRequired=$mfaRequired, mfaEnrolmentRequired=$mfaEnrolmentRequired, user=${user?.userId})"
}

@Serializable
data class OkDto(val ok: Boolean? = null)

data class MfaChallenge(
    val challengeId: String,
    val challengeToken: String,
    val expiresAt: String?,
) {
    override fun toString(): String = "MfaChallenge(challengeId=$challengeId, challengeToken=<redacted>)"
}
