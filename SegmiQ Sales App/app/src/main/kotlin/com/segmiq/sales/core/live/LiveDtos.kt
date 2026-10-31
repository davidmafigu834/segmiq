package com.segmiq.sales.core.live

import kotlinx.serialization.Serializable

// Shapes verified against the SegmiQ web repository (route handlers and their TypeScript types).
// Only fields the app reads are declared; unknown fields are ignored.

/** `GET /api/sales/dashboard` → `SalesDashboardData` (lib/sales/get-sales-dashboard-data.ts). */
@Serializable
data class SalesDashboardDto(
    val commercial: DashboardCommercial? = null,
    val pipelineSnapshot: List<PipelineSnapshotStage> = emptyList(),
    val recentActivity: List<ActivityItem> = emptyList(),
    val hasAnyDeals: Boolean = false,
    val hasAnyLeads: Boolean = false,
)

@Serializable
data class DashboardCommercial(
    val newEnquiriesToday: Int = 0,
    val activeDeals: Int = 0,
    val pipelineValueKnown: Double = 0.0,
    val pipelineAwaitingEstimate: Int = 0,
    val followUpsDueToday: Int = 0,
    val followUpsOverdue: Int = 0,
)

@Serializable
data class PipelineSnapshotStage(
    val id: String,
    val label: String,
    val dealCount: Int = 0,
    val knownValue: Double = 0.0,
    val awaitingEstimate: Int = 0,
)

@Serializable
data class ActivityItem(
    val id: String,
    val kind: String? = null,
    val title: String,
    val detail: String? = null,
    val timeLabel: String? = null,
)

/** `GET /api/sales/dashboard/workspace` → `DailyWorkspacePayload` (lib/sales/dashboard/load-daily-workspace.ts). */
@Serializable
data class DailyWorkspaceDto(
    val greetingPart: String? = null,
    val timezone: String? = null,
    val briefing: String? = null,
    val openCount: Int = 0,
    val actions: List<SalesTaskDto> = emptyList(),
    val copilotUnavailable: Boolean = false,
    val updates: WorkspaceUpdates? = null,
    val visitId: String? = null,
    val generatedAt: String? = null,
)

@Serializable
data class WorkspaceUpdates(
    val heading: String? = null,
    val timeframe: String? = null,
    val items: List<RecentUpdateDto> = emptyList(),
    val unavailable: Boolean = false,
)

@Serializable
data class RecentUpdateDto(
    val id: String,
    val at: String? = null,
    val kind: String? = null,
    val leadId: String? = null,
    val leadName: String? = null,
    val detail: String? = null,
    val summary: String? = null,
)

/** `GET /api/sales/tasks` → `SalesTasksPayload` (lib/sales/tasks/types.ts). */
@Serializable
data class SalesTasksDto(
    val meta: TasksMeta? = null,
    val counts: TaskCounts? = null,
    val kpis: TaskKpis? = null,
    val tasks: List<SalesTaskDto> = emptyList(),
    val upcoming: List<SalesTaskDto> = emptyList(),
)

@Serializable
data class TasksMeta(
    val view: String? = null,
    val generatedAt: String? = null,
    val currentUserId: String? = null,
    val timezone: String? = null,
    val copilotUnavailable: Boolean = false,
)

@Serializable
data class TaskCounts(val mine: Int = 0, val assigned: Int = 0, val created: Int = 0, val all: Int = 0)

@Serializable
data class TaskKpis(
    val dueToday: Int = 0,
    val overdue: Int = 0,
    val thisWeek: Int = 0,
    val completedThisWeek: Int = 0,
)

@Serializable
data class TaskScheduleDto(
    val kind: String? = null,
    val label: String? = null,
    val at: String? = null,
    val overdue: Boolean = false,
)

@Serializable
data class SalesTaskDto(
    val id: String,
    val leadId: String,
    val title: String,
    val type: String? = null,
    val typeLabel: String? = null,
    val relatedName: String? = null,
    val relatedSecondary: String? = null,
    val phone: String? = null,
    val dueAt: String? = null,
    val deadlineAt: String? = null,
    val schedule: TaskScheduleDto? = null,
    val priority: String? = null,
    val status: String? = null,
    val completed: Boolean = false,
    val completedAt: String? = null,
    val assignedToId: String? = null,
    val notes: String? = null,
    val copilot: CopilotDto? = null,
)

@Serializable
data class CopilotDto(
    val workItemId: String,
    val queue: String? = null,
    val actionType: String? = null,
    val explanation: String? = null,
    val reviewStatus: String? = null,
    val executionStatus: String? = null,
    val fulfilmentStatus: String? = null,
    val listState: String? = null,
    val waitingActor: String? = null,
    val proposedAt: String? = null,
    val linkedQuotationId: String? = null,
    val linkedFollowUp: Boolean = false,
    val missing: List<String> = emptyList(),
    val executionError: String? = null,
    val primaryLabel: String? = null,
    val actionLabel: String? = null,
    val primaryAction: String? = null,
)

/** `GET /api/sales/leads` → `LeadsDirectoryPayload` (lib/sales/leads-directory/types.ts). */
@Serializable
data class LeadsDirectoryDto(
    val meta: LeadsDirectoryMeta? = null,
    val leads: List<LeadDirectoryRow> = emptyList(),
)

@Serializable
data class LeadsDirectoryMeta(
    val page: Int = 1,
    val pageSize: Int = 20,
    val totalFiltered: Int = 0,
    val allTimeCount: Int = 0,
)

@Serializable
data class LeadDirectoryRow(
    val id: String,
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val company: String? = null,
    val location: String? = null,
    val contextLine: String? = null,
    val sourceLabel: String? = null,
    val status: String? = null,
    val scoreLabel: String? = null,
    val lastContactAt: String? = null,
    val followUpDate: String? = null,
    val createdAt: String? = null,
    val followUpOverdue: Boolean = false,
    val neverContacted: Boolean = false,
)

/** `GET /api/leads/{id}` → `{ lead: LeadRow }` (types/index.ts). */
@Serializable
data class LeadEnvelope(val lead: LeadRowDto)

@Serializable
data class LeadRowDto(
    val id: String,
    val client_id: String? = null,
    val assigned_to_id: String? = null,
    val source: String? = null,
    val status: String? = null,
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val budget: String? = null,
    val project_type: String? = null,
    val follow_up_date: String? = null,
    val deal_value: Double? = null,
    val created_at: String? = null,
    val updated_at: String? = null,
)

/** `GET /api/leads/{id}/timeline` → `LeadTimelineQueryResult` (lib/activity/types.ts). */
@Serializable
data class TimelineDto(
    val items: List<TimelineItemDto> = emptyList(),
    val pinned: List<TimelineItemDto> = emptyList(),
    val nextCursor: String? = null,
    val hasMore: Boolean = false,
)

@Serializable
data class TimelineItemDto(
    val id: String,
    val activityType: String? = null,
    val title: String,
    val summary: String? = null,
    val occurredAt: String? = null,
    val actorName: String? = null,
    val filterCategory: String? = null,
)

/** `GET /api/contacts/lookup?phone=` → `{ match }` (app/api/contacts/lookup/route.ts). */
@Serializable
data class ContactLookupDto(val match: ContactMatch? = null)

@Serializable
data class ContactMatch(
    val id: String,
    val name: String? = null,
    val owner: String? = null,
    val ownedByYou: Boolean = false,
    val leadId: String? = null,
    val leadStatus: String? = null,
)

/** `POST /api/contacts` success → `{ ok, kind, contactId, leadId }`; 409 → `{ error:"duplicate", existing }`. */
@Serializable
data class CreateLeadDto(val ok: Boolean? = null, val kind: String? = null, val contactId: String? = null, val leadId: String? = null)

@Serializable
data class DuplicateExisting(
    val id: String? = null,
    val name: String? = null,
    val leadId: String? = null,
    val leadStatus: String? = null,
    val owner: String? = null,
    val ownedByYou: Boolean = false,
)

@Serializable
data class OkResponse(val ok: Boolean? = null)

/** `POST /api/sales/copilot/work-items/{id}` → `{ item }`; the app reloads tasks afterwards. */
@Serializable
data class WorkItemResponse(val simulated: Boolean? = null, val notice: String? = null)
