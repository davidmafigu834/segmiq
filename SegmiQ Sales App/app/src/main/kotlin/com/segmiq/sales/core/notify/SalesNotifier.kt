package com.segmiq.sales.core.notify

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.segmiq.sales.MainActivity
import com.segmiq.sales.R
import com.segmiq.sales.core.live.SalesTaskDto
import java.time.Instant
import java.time.format.DateTimeParseException

/**
 * Local reminders only. SegmiQ has no verified device-token or FCM contract, so this does not
 * register for push. Alarms are inexact and may be deferred by Android.
 */
object SalesNotifier {
    const val RECORDING_ID = 70
    const val REMINDER_ID = 71
    private const val CHANNEL_RECORDING = "meeting_recording"
    private const val CHANNEL_REMINDERS = "sales_reminders"
    private const val PREFS = "segmiq_local_reminders"
    private const val STAMP = "segmiq_account_stamp"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_RECORDING, "Meeting recording", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shown while a meeting is being recorded on this phone."
        })
        manager.createNotificationChannel(NotificationChannel(CHANNEL_REMINDERS, "Sales reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Follow-ups loaded from your SegmiQ tasks. Not a push service."
        })
    }

    fun recordingNotification(context: Context, open: PendingIntent): Notification {
        ensureChannels(context)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL_RECORDING) else Notification.Builder(context)
        return builder
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("SegmiQ is recording a meeting")
            .setContentText("The microphone is in use. Tap to return to SegmiQ.")
            .setOngoing(true)
            .setContentIntent(open)
            .build()
    }

    fun rememberAccount(context: Context, userId: String, orgId: String) {
        context.getSharedPreferences(STAMP, Context.MODE_PRIVATE).edit().putString("user", userId).putString("org", orgId).apply()
    }

    fun clearAccount(context: Context) {
        context.getSharedPreferences(STAMP, Context.MODE_PRIVATE).edit().clear().apply()
        cancelReminder(context)
    }

    fun accountMatches(context: Context, userId: String, orgId: String): Boolean {
        val prefs = context.getSharedPreferences(STAMP, Context.MODE_PRIVATE)
        return prefs.getString("user", null) == userId && prefs.getString("org", null) == orgId
    }

    /** Replaces any previous local reminder. Only the next future task is scheduled. */
    fun scheduleNext(context: Context, userId: String, orgId: String, tasks: List<SalesTaskDto>) {
        ensureChannels(context)
        cancelReminder(context)
        val next = tasks.mapNotNull { task ->
            val at = parse(task.schedule?.at ?: task.deadlineAt ?: task.dueAt) ?: return@mapNotNull null
            if (task.completed || !at.isAfter(Instant.now())) null else task to at
        }.minByOrNull { it.second } ?: return
        val (task, at) = next
        val intent = Intent(context, SalesReminderReceiver::class.java)
            .putExtra("user", userId).putExtra("org", orgId).putExtra("lead", task.leadId).putExtra("title", task.title)
        val pending = PendingIntent.getBroadcast(context, REMINDER_ID, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val alarm = context.getSystemService(AlarmManager::class.java)
        alarm.set(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), pending)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("task", task.id).apply()
    }

    fun cancelReminder(context: Context) {
        val intent = Intent(context, SalesReminderReceiver::class.java)
        val pending = PendingIntent.getBroadcast(context, REMINDER_ID, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        context.getSystemService(AlarmManager::class.java).cancel(pending)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    private fun parse(raw: String?): Instant? {
        if (raw.isNullOrBlank()) return null
        return try { Instant.parse(raw) } catch (_: DateTimeParseException) {
            try { Instant.parse(raw + "T09:00:00Z") } catch (_: DateTimeParseException) { null }
        }
    }
}

class SalesReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val user = intent.getStringExtra("user") ?: return
        val org = intent.getStringExtra("org") ?: return
        if (!SalesNotifier.accountMatches(context, user, org)) return
        val lead = intent.getStringExtra("lead") ?: return
        val title = intent.getStringExtra("title")?.take(80) ?: "Follow-up"
        SalesNotifier.ensureChannels(context)
        val open = PendingIntent.getActivity(context, 2, Intent(context, MainActivity::class.java)
            .putExtra("segmiq_lead", lead).putExtra("segmiq_user", user).putExtra("segmiq_org", org)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, "sales_reminders") else Notification.Builder(context)
        val notification = builder
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("SegmiQ follow-up")
            .setContentText(title)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(SalesNotifier.REMINDER_ID, notification)
    }
}
