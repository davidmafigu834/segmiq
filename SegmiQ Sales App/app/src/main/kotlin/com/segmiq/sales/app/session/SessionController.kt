package com.segmiq.sales.app.session

import com.segmiq.sales.core.auth.AuthRepository
import com.segmiq.sales.core.auth.MfaChallenge
import com.segmiq.sales.core.auth.SignInOutcome
import com.segmiq.sales.core.auth.StoredSession
import com.segmiq.sales.core.auth.requiresNewMfaChallenge
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.bootstrap.WorkspaceGate
import com.segmiq.sales.core.bootstrap.gateFor
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.ScopedCache
import com.segmiq.sales.core.network.ApiError
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.network.ErrorKind
import com.segmiq.sales.core.network.ErrorMapper
import com.segmiq.sales.core.network.SessionProblemListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Duration
import java.time.Instant

enum class BlockReason { SUBSCRIPTION, SALES_OPERATIONS, UPDATE_REQUIRED, SERVER_NOT_READY, CONNECTION, MFA_ENROLMENT }

sealed interface AppState {
    data object Starting : AppState
    data class SignedOut(val notice: String? = null) : AppState
    data class Mfa(val challenge: MfaChallenge, val email: String) : AppState
    data object Connecting : AppState
    data class Live(val workspace: LiveWorkspace) : AppState
    data class Blocked(val reason: BlockReason, val message: String, val canRetry: Boolean, val signedIn: Boolean) : AppState
    data object Demo : AppState
}

data class SignInUi(val busy: Boolean = false, val error: String? = null, val restartMfa: Boolean = false)

/**
 * Owns authentication and organisation state for the whole app. Live data screens exist only in
 * [AppState.Live]; the local demo only in [AppState.Demo]. Session-ending server responses from any
 * request arrive through [SessionProblemListener] and sign the user out with cached data cleared.
 */
class SessionController(
    private val auth: AuthRepository,
    private val api: () -> LiveSalesApi,
    private val cache: ScopedCache,
    private val scope: CoroutineScope,
    private val now: () -> Instant = Instant::now,
    private val onLocalSignOut: (userId: String, organisationId: String) -> Unit = { _, _ -> },
) : SessionProblemListener {
    private val _state = MutableStateFlow<AppState>(AppState.Starting)
    val state: StateFlow<AppState> = _state.asStateFlow()

    private val _signIn = MutableStateFlow(SignInUi())
    val signIn: StateFlow<SignInUi> = _signIn.asStateFlow()

    private val mutex = Mutex()
    private var lastBootstrapAt: Instant? = null

    fun start() {
        scope.launch {
            mutex.withLock {
                val session = auth.restore()
                if (session == null) {
                    _state.value = AppState.SignedOut()
                } else {
                    connect(session)
                }
            }
        }
    }

    fun signIn(email: String, password: String) {
        if (_signIn.value.busy) return
        if (email.isBlank() || password.isEmpty()) {
            _signIn.value = SignInUi(error = "Enter your email and password.")
            return
        }
        _signIn.value = SignInUi(busy = true)
        scope.launch {
            mutex.withLock {
                when (val outcome = auth.signIn(email, password)) {
                    is SignInOutcome.SignedIn -> { _signIn.value = SignInUi(); connect(outcome.session) }
                    is SignInOutcome.MfaRequired -> {
                        _signIn.value = SignInUi()
                        _state.value = AppState.Mfa(outcome.challenge, email.trim())
                    }
                    SignInOutcome.MfaEnrolmentRequired -> {
                        _signIn.value = SignInUi()
                        _state.value = AppState.Blocked(
                            BlockReason.MFA_ENROLMENT, ErrorMapper.defaultMessage(ErrorKind.MFA_ENROLMENT_REQUIRED),
                            canRetry = false, signedIn = false,
                        )
                    }
                    is SignInOutcome.Failed -> _signIn.value = SignInUi(error = outcome.error.message)
                }
            }
        }
    }

    fun completeMfa(code: String, recovery: Boolean) {
        val current = _state.value as? AppState.Mfa ?: return
        if (_signIn.value.busy) return
        if (code.isBlank()) {
            _signIn.value = SignInUi(error = "Enter the code.")
            return
        }
        _signIn.value = SignInUi(busy = true)
        scope.launch {
            mutex.withLock {
                when (val outcome = auth.completeMfa(current.challenge, code, recovery)) {
                    is SignInOutcome.SignedIn -> { _signIn.value = SignInUi(); connect(outcome.session) }
                    is SignInOutcome.Failed -> {
                        if (outcome.error.requiresNewMfaChallenge()) {
                            _signIn.value = SignInUi()
                            _state.value = AppState.SignedOut("That verification step expired. Sign in again.")
                        } else {
                            _signIn.value = SignInUi(error = outcome.error.message)
                        }
                    }
                    else -> _signIn.value = SignInUi(error = ErrorMapper.decoding().message)
                }
            }
        }
    }

    fun cancelMfa() {
        _signIn.value = SignInUi()
        _state.value = AppState.SignedOut()
    }

    fun clearSignInError() {
        if (_signIn.value.error != null) _signIn.value = _signIn.value.copy(error = null)
    }

    fun enterDemo() {
        if (_state.value is AppState.SignedOut) _state.value = AppState.Demo
    }

    fun leaveDemo() {
        if (_state.value == AppState.Demo) _state.value = AppState.SignedOut()
    }

    fun retry() {
        scope.launch {
            mutex.withLock {
                val session = auth.restore()
                if (session == null) _state.value = AppState.SignedOut() else connect(session)
            }
        }
    }

    fun signOut(notice: String? = null) {
        scope.launch {
            mutex.withLock {
                releaseLocalAccount()
                cache.clear()
                auth.signOut()
                lastBootstrapAt = null
                _state.value = AppState.SignedOut(notice)
            }
        }
    }

    /** Re-validates the organisation configuration after a long pause in the background. */
    fun onForeground() {
        val live = _state.value as? AppState.Live ?: return
        val last = lastBootstrapAt ?: return
        if (Duration.between(last, now()) < Duration.ofMinutes(30)) return
        scope.launch {
            mutex.withLock {
                if (_state.value != live) return@withLock
                val session = auth.restore()
                if (session == null) endSession("Your session has expired. Sign in again.") else connect(session, quiet = true)
            }
        }
    }

    override fun onSessionProblem(error: ApiError) {
        scope.launch {
            if (_state.value !is AppState.Live) return@launch
            if (error.genericUnauthorized) {
                // Older endpoints answer a bare 401; bootstrap reports the exact reason.
                when (val diagnosis = api().bootstrap()) {
                    is ApiResult.Success -> return@launch
                    is ApiResult.Failure -> if (!diagnosis.error.endsSession && diagnosis.error.kind != ErrorKind.ENDPOINT_MISSING) return@launch
                }
            }
            mutex.withLock {
                if (_state.value !is AppState.Live) return@withLock
                if (error.kind == ErrorKind.SUBSCRIPTION_SUSPENDED) {
                    cache.clear()
                    _state.value = AppState.Blocked(BlockReason.SUBSCRIPTION, error.message, canRetry = true, signedIn = true)
                } else {
                    endSession(error.message)
                }
            }
        }
    }

    private suspend fun endSession(message: String) {
        releaseLocalAccount()
        cache.clear()
        auth.clearLocal()
        lastBootstrapAt = null
        _state.value = AppState.SignedOut(message)
    }

    private fun releaseLocalAccount() {
        val live = _state.value as? AppState.Live ?: return
        onLocalSignOut(live.workspace.scope.salespersonId, live.workspace.scope.organisationId)
    }

    private suspend fun connect(session: StoredSession, quiet: Boolean = false) {
        if (!quiet) _state.value = AppState.Connecting
        when (val result = api().bootstrap()) {
            is ApiResult.Success -> {
                val bootstrap = result.value
                if (bootstrap.user.id != session.userId || bootstrap.organisation.id != session.clientId) {
                    onLocalSignOut(session.userId, session.clientId)
                    cache.clear()
                    auth.signOut()
                    _state.value = AppState.SignedOut("Your account details changed. Sign in again.")
                    return
                }
                lastBootstrapAt = now()
                _state.value = when (gateFor(bootstrap)) {
                    WorkspaceGate.Open -> AppState.Live(LiveWorkspace.from(bootstrap))
                    WorkspaceGate.SubscriptionBlocked -> AppState.Blocked(
                        BlockReason.SUBSCRIPTION,
                        "${bootstrap.organisation.name}'s SegmiQ subscription is suspended. Contact your administrator.",
                        canRetry = true, signedIn = true,
                    )
                    WorkspaceGate.SalesOperationsBlocked -> AppState.Blocked(
                        BlockReason.SALES_OPERATIONS,
                        "Sales work is paused for ${bootstrap.organisation.name}. Contact your administrator.",
                        canRetry = true, signedIn = true,
                    )
                    WorkspaceGate.UnsupportedSchema -> AppState.Blocked(
                        BlockReason.UPDATE_REQUIRED,
                        "This version of SegmiQ Sales is out of date. Update the app to continue.",
                        canRetry = false, signedIn = true,
                    )
                }
            }
            is ApiResult.Failure -> {
                val error = result.error
                when {
                    error.endsSession -> endSession(error.message)
                    error.kind == ErrorKind.ENDPOINT_MISSING -> _state.value = AppState.Blocked(
                        BlockReason.SERVER_NOT_READY,
                        "You're signed in, but this SegmiQ server can't yet tell the app which organisation and " +
                            "workspace to load. Live data stays hidden until it can. Ask your SegmiQ administrator to " +
                            "enable the Sales app configuration.",
                        canRetry = true, signedIn = true,
                    )
                    error.kind == ErrorKind.SUBSCRIPTION_SUSPENDED -> _state.value = AppState.Blocked(
                        BlockReason.SUBSCRIPTION, error.message, canRetry = true, signedIn = true,
                    )
                    else -> if (quiet) Unit else _state.value = AppState.Blocked(
                        BlockReason.CONNECTION, error.message, canRetry = true, signedIn = true,
                    )
                }
            }
        }
    }
}
