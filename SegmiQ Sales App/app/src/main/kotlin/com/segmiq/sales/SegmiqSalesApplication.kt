package com.segmiq.sales

import android.app.Application
import android.content.Context
import android.os.Build
import com.segmiq.sales.app.session.SessionController
import com.segmiq.sales.core.auth.AuthRepository
import com.segmiq.sales.core.auth.DeviceIdentity
import com.segmiq.sales.core.auth.EncryptedSessionStore
import com.segmiq.sales.core.auth.SessionStore
import android.content.Intent
import com.segmiq.sales.core.audio.CaptureSnapshot
import com.segmiq.sales.core.audio.MeetingRecordingService
import com.segmiq.sales.core.audio.RecordingLibrary
import com.segmiq.sales.core.audio.RecordingSessionBus
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.ScopedCache
import com.segmiq.sales.core.notify.SalesNotifier
import kotlinx.coroutines.flow.MutableStateFlow
import com.segmiq.sales.core.network.ApiConfig
import com.segmiq.sales.core.network.ConnectivityMonitor
import com.segmiq.sales.core.network.SegmiqHttp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Manual dependency container. One instance per process; live and demo paths share nothing. */
class AppContainer(
    context: Context,
    config: ApiConfig,
    store: SessionStore = EncryptedSessionStore(context),
    device: DeviceIdentity = DeviceIdentity.load(context),
) {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val cache = ScopedCache()
    val connectivity = ConnectivityMonitor(context)

    private lateinit var sessionRef: SessionController
    private lateinit var authRef: AuthRepository

    val pendingRoute = MutableStateFlow<String?>(null)
    val http = SegmiqHttp(config, tokens = { authRef.currentToken() }, sessionProblems = { sessionRef.onSessionProblem(it) })
    val api = LiveSalesApi(http)
    val auth: AuthRepository = AuthRepository(http, store, device).also { authRef = it }
    val session: SessionController = SessionController(auth, { api }, cache, appScope, onLocalSignOut = { userId, orgId ->
        context.stopService(Intent(context, MeetingRecordingService::class.java))
        RecordingLibrary(context).wipe(userId, orgId)
        SalesNotifier.clearAccount(context)
        RecordingSessionBus.publish(CaptureSnapshot())
        RecordingSessionBus.markSaved(null)
    }).also { sessionRef = it }
}

class SegmiqSalesApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        val config = ApiConfig.create(
            rawBaseUrl = BuildConfig.SEGMIQ_BASE_URL,
            userAgent = "SegmiQSales-Android/${BuildConfig.VERSION_NAME} (Android ${Build.VERSION.RELEASE})",
            allowLocalCleartext = BuildConfig.DEBUG,
        )
        container = AppContainer(this, config)
        container.session.start()
    }
}

val Context.appContainer: AppContainer
    get() = (applicationContext as SegmiqSalesApplication).container
