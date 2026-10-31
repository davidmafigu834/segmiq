package com.segmiq.sales.core.live

import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeParseException

enum class TaskBucket { OVERDUE, TODAY, UPCOMING, UNDATED, COMPLETED }

enum class TaskFilter(val label: String) {
    TODAY("Today"),
    UPCOMING("Upcoming"),
    OVERDUE("Overdue"),
    COMPLETED("Completed"),
    MINE("All open"),
    CUSTOMER_LINKED("Customer-linked"),
}

/** Parses an ISO date (`2026-10-30`) or timestamp into a calendar date in the organisation's zone. */
fun parseServerDate(value: String?, zone: ZoneId): LocalDate? {
    if (value.isNullOrBlank()) return null
    return try {
        if (value.length == 10) LocalDate.parse(value)
        else Instant.parse(value).atZone(zone).toLocalDate()
    } catch (e: DateTimeParseException) {
        runCatching { OffsetDateTime.parse(value).atZoneSameInstant(zone).toLocalDate() }.getOrNull()
    }
}

fun parseServerInstant(value: String?): Instant? {
    if (value.isNullOrBlank() || value.length == 10) return null
    return runCatching { Instant.parse(value) }.getOrElse {
        runCatching { OffsetDateTime.parse(value).toInstant() }.getOrNull()
    }
}

/** The task's real date: its schedule, else its deadline, else its due date. */
fun SalesTaskDto.effectiveDate(zone: ZoneId): LocalDate? =
    parseServerDate(schedule?.at, zone) ?: parseServerDate(deadlineAt, zone) ?: parseServerDate(dueAt, zone)

fun SalesTaskDto.bucket(today: LocalDate, zone: ZoneId): TaskBucket {
    if (completed || status == "completed") return TaskBucket.COMPLETED
    val date = effectiveDate(zone)
    if (schedule?.overdue == true || status == "overdue") return TaskBucket.OVERDUE
    return when {
        date == null -> TaskBucket.UNDATED
        date.isBefore(today) -> TaskBucket.OVERDUE
        date == today -> TaskBucket.TODAY
        else -> TaskBucket.UPCOMING
    }
}

fun filterLiveTasks(tasks: List<SalesTaskDto>, filter: TaskFilter, today: LocalDate, zone: ZoneId): List<SalesTaskDto> {
    val distinct = tasks.distinctBy { it.id }
    val selected = distinct.filter {
        val bucket = it.bucket(today, zone)
        when (filter) {
            TaskFilter.TODAY -> bucket == TaskBucket.TODAY
            TaskFilter.UPCOMING -> bucket == TaskBucket.UPCOMING
            TaskFilter.OVERDUE -> bucket == TaskBucket.OVERDUE
            TaskFilter.COMPLETED -> bucket == TaskBucket.COMPLETED
            TaskFilter.MINE -> bucket != TaskBucket.COMPLETED
            TaskFilter.CUSTOMER_LINKED -> bucket != TaskBucket.COMPLETED && it.leadId.isNotBlank()
        }
    }
    return selected.sortedWith(compareBy(nullsLast()) { it.effectiveDate(zone) })
}

sealed interface CompletionPlan {
    /** Plain follow-up: clear the lead's follow-up date (same request the web makes). */
    data class ClearFollowUp(val leadId: String) : CompletionPlan
    /** Approved Copilot work item: complete it through the work-item endpoint. */
    data class CompleteWorkItem(val workItemId: String) : CompletionPlan
    /** Copilot item that must be reviewed first; completion is not offered. */
    data object ReviewFirst : CompletionPlan
    data object AlreadyDone : CompletionPlan
}

fun SalesTaskDto.completionPlan(): CompletionPlan {
    if (completed) return CompletionPlan.AlreadyDone
    val c = copilot ?: return CompletionPlan.ClearFollowUp(leadId)
    return if (CopilotPolicy.canComplete(c)) CompletionPlan.CompleteWorkItem(c.workItemId) else CompletionPlan.ReviewFirst
}

/**
 * What the Android app lets a salesperson do with a Copilot work item. Approval is offered only
 * for actions whose server execution is a follow-up date or a review mark. Actions that would
 * prepare quotations, appointments or listing choices must be reviewed on the web.
 */
object CopilotPolicy {
    private val APPROVABLE = setOf("follow_up", "answer_question", "open_commitment", "send_quotation")
    private val WEB_ONLY = setOf("quotation_draft", "quotation_choice", "quotation_missing", "listing_shortlist", "appointment")
    private val CLOSED_REVIEW = setOf("dismissed", "stale")

    private fun isOpen(c: CopilotDto) = c.reviewStatus !in CLOSED_REVIEW && c.fulfilmentStatus != "fulfilled" &&
        c.fulfilmentStatus != "obsolete"

    fun requiresWeb(c: CopilotDto): Boolean = c.actionType in WEB_ONLY

    fun canApprove(c: CopilotDto): Boolean =
        isOpen(c) && c.actionType in APPROVABLE && c.reviewStatus != "approved" && c.missing.isEmpty()

    fun canComplete(c: CopilotDto): Boolean =
        isOpen(c) && c.primaryAction == "complete" && c.reviewStatus == "approved" && c.executionStatus != "failed"

    fun canDismiss(c: CopilotDto): Boolean = isOpen(c)

    fun canSnooze(c: CopilotDto): Boolean = isOpen(c) && c.reviewStatus != "approved"
}

data class CopilotPresentation(val headline: String, val detail: String?, val simulated: Boolean)

/** A simulated work-item response is never presented as a confirmed customer action. */
fun presentCopilot(action: CopilotAction, response: WorkItemResponse): CopilotPresentation {
    val simulated = response.simulated == true
    val verb = when (action) {
        CopilotAction.APPROVE -> "Approval"
        CopilotAction.DISMISS -> "Dismissal"
        CopilotAction.SNOOZE -> "Snooze"
        CopilotAction.COMPLETE -> "Completion"
    }
    val headline = if (simulated) "Simulated $verb. Nothing was confirmed with the customer."
    else when (action) {
        CopilotAction.APPROVE -> "Approved on SegmiQ."
        CopilotAction.DISMISS -> "Dismissed on SegmiQ."
        CopilotAction.SNOOZE -> "Snoozed on SegmiQ."
        CopilotAction.COMPLETE -> "Completed on SegmiQ."
    }
    val notice = response.notice?.trim()?.takeIf { it.isNotEmpty() }
    val detail = when {
        simulated && notice != null -> "Simulated outcome. $notice"
        simulated -> "No quotation, appointment, or customer commitment was created."
        else -> notice
    }
    return CopilotPresentation(headline, detail, simulated)
}
