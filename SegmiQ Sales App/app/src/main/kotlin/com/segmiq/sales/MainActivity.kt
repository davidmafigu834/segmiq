package com.segmiq.sales

import android.content.Intent
import android.os.Bundle
import com.segmiq.sales.core.notify.SalesNotifier
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.segmiq.sales.ui.theme.SegmiQSalesTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    acceptReminder(intent)

    enableEdgeToEdge()
    if (android.os.Build.VERSION.SDK_INT >= 29) window.isNavigationBarContrastEnforced = false
    setContent {
      SegmiQSalesTheme { Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { MainNavigation() } }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    acceptReminder(intent)
  }

  private fun acceptReminder(intent: Intent?) {
    val lead = intent?.getStringExtra("segmiq_lead") ?: return
    val user = intent.getStringExtra("segmiq_user") ?: return
    val org = intent.getStringExtra("segmiq_org") ?: return
    if (!SalesNotifier.accountMatches(this, user, org)) return
    appContainer.pendingRoute.value = "live/lead/$lead"
    intent.removeExtra("segmiq_lead")
  }

  override fun onStart() {
    super.onStart()
    appContainer.session.onForeground()
  }
}
