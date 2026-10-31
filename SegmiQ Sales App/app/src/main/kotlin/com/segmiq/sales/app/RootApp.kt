package com.segmiq.sales.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.segmiq.sales.app.session.AppState
import com.segmiq.sales.appContainer
import com.segmiq.sales.features.auth.BlockedScreen
import com.segmiq.sales.features.auth.ConnectingScreen
import com.segmiq.sales.features.auth.LoginScreen
import com.segmiq.sales.features.auth.MfaScreen
import com.segmiq.sales.features.live.LiveSalesApp

/**
 * Top-level switch. The live workspace and the local demo are separate trees with separate
 * state holders: demo screens never receive the network client, and live screens never read
 * the demo repository.
 */
@Composable
fun RootApp() {
    val container = LocalContext.current.appContainer
    val session = container.session
    val state by session.state.collectAsStateWithLifecycle()
    val signIn by session.signIn.collectAsStateWithLifecycle()
    val baseUrl = container.http.config.baseUrl

    when (val s = state) {
        AppState.Starting -> ConnectingScreen("Starting SegmiQ Sales…")
        AppState.Connecting -> ConnectingScreen("Loading your workspace…")
        is AppState.SignedOut -> LoginScreen(
            notice = s.notice,
            ui = signIn,
            serverHost = baseUrl.host,
            onSignIn = session::signIn,
            onEdit = session::clearSignInError,
            onExploreDemo = session::enterDemo,
            forgotPasswordUrl = baseUrl.newBuilder().addPathSegment("forgot-password").build().toString(),
        )
        is AppState.Mfa -> MfaScreen(s.email, signIn, session::completeMfa, session::clearSignInError, session::cancelMfa)
        is AppState.Blocked -> BlockedScreen(s, onRetry = session::retry, onSignOut = { session.signOut() })
        // Keyed by scope so a different account never inherits another account's screen state.
        is AppState.Live -> key(s.workspace.scope) {
            LiveSalesApp(s.workspace, container.api, container.cache, container.connectivity.online, onSignOut = { session.signOut() })
        }
        AppState.Demo -> SalesApp(onLeaveDemo = session::leaveDemo)
    }
}
