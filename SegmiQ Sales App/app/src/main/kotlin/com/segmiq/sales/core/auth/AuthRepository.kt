package com.segmiq.sales.core.auth

import com.segmiq.sales.core.network.ApiError
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.network.ErrorKind
import com.segmiq.sales.core.network.ErrorMapper
import com.segmiq.sales.core.network.HttpMethod
import com.segmiq.sales.core.network.SegmiqHttp
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

sealed interface SignInOutcome {
    data class SignedIn(val session: StoredSession) : SignInOutcome
    data class MfaRequired(val challenge: MfaChallenge) : SignInOutcome
    /** Restricted token issued; the user must enrol in MFA on the web. The token is revoked immediately. */
    data object MfaEnrolmentRequired : SignInOutcome
    data class Failed(val error: ApiError) : SignInOutcome
}

/** Restarting at the password step is required for these MFA failure reasons (contract §3). */
private val TERMINAL_MFA_REASONS = setOf("challenge_expired", "challenge_consumed", "too_many_attempts")

fun ApiError.requiresNewMfaChallenge(): Boolean =
    kind == ErrorKind.MFA_FAILED && reason in TERMINAL_MFA_REASONS

class AuthRepository(
    private val http: SegmiqHttp,
    private val store: SessionStore,
    private val device: DeviceIdentity,
    private val now: () -> Instant = Instant::now,
) {
    @Volatile private var cached: StoredSession? = null

    /** Token for the Bearer interceptor. Only the in-memory copy is read on the network thread. */
    fun currentToken(): String? = cached?.token

    suspend fun restore(): StoredSession? {
        val stored = store.read() ?: return null
        if (isExpired(stored)) {
            store.clear()
            cached = null
            return null
        }
        cached = stored
        return stored
    }

    suspend fun signIn(email: String, password: String): SignInOutcome {
        val body = buildJsonObject {
            put("email", email.trim())
            put("password", password)
            put("deviceId", device.deviceId)
            put("deviceName", device.deviceName)
        }
        val result = http.request(
            HttpMethod.POST, "/api/sales/app/auth", AuthResponseDto.serializer(), body = body, authenticated = false,
        )
        return when (result) {
            is ApiResult.Failure -> SignInOutcome.Failed(result.error)
            is ApiResult.Success -> handleAuthResponse(result.value)
        }
    }

    suspend fun completeMfa(challenge: MfaChallenge, code: String, isRecoveryCode: Boolean): SignInOutcome {
        val body = buildJsonObject {
            put("action", "complete")
            put("channel", "mobile_sales")
            put("challengeId", challenge.challengeId)
            put("challengeToken", challenge.challengeToken)
            if (isRecoveryCode) put("recoveryCode", code.trim()) else put("totpCode", code.filter(Char::isDigit))
            put("deviceId", device.deviceId)
            put("deviceName", device.deviceName)
        }
        val result = http.request(
            HttpMethod.POST, "/api/auth/mfa/login", AuthResponseDto.serializer(), body = body, authenticated = false,
        )
        return when (result) {
            is ApiResult.Failure -> SignInOutcome.Failed(result.error)
            is ApiResult.Success -> handleAuthResponse(result.value)
        }
    }

    private suspend fun handleAuthResponse(dto: AuthResponseDto): SignInOutcome {
        if (dto.mfaRequired == true) {
            val id = dto.challengeId
            val token = dto.challengeToken
            if (id.isNullOrBlank() || token.isNullOrBlank()) return SignInOutcome.Failed(ErrorMapper.decoding())
            return SignInOutcome.MfaRequired(MfaChallenge(id, token, dto.expiresAt))
        }
        if (dto.mfaEnrolmentRequired == true) {
            // The restricted token is useless in the app; end its server session straight away.
            dto.token?.let { revokeToken(it) }
            return SignInOutcome.MfaEnrolmentRequired
        }
        val token = dto.token
        val user = dto.user
        val expiresAt = dto.expiresAt
        if (token.isNullOrBlank() || user == null || expiresAt == null || user.clientId.isNullOrBlank()) {
            return SignInOutcome.Failed(ErrorMapper.decoding())
        }
        val session = StoredSession(
            token = token,
            expiresAt = expiresAt,
            userId = user.userId,
            clientId = user.clientId,
            sessionId = user.sessionId,
            role = user.role,
            name = user.name.orEmpty(),
        )
        store.write(session)
        cached = session
        return SignInOutcome.SignedIn(session)
    }

    /** Revokes the server session (best effort) and always clears the local token. */
    suspend fun signOut() {
        val token = cached?.token ?: store.read()?.token
        try {
            if (token != null) revokeToken(token)
        } finally {
            clearLocal()
        }
    }

    /** Clears local credentials without a network call (session already ended server-side). */
    suspend fun clearLocal() {
        cached = null
        store.clear()
    }

    private suspend fun revokeToken(token: String) {
        http.request(
            HttpMethod.POST, "/api/auth/session/logout", OkDto.serializer(),
            retries = 0, explicitToken = token, reportSessionProblems = false,
        )
    }

    fun isExpired(session: StoredSession): Boolean {
        val expiry = runCatching { Instant.parse(session.expiresAt) }.getOrNull() ?: return true
        return !expiry.isAfter(now())
    }
}
