package com.segmiq.sales.core.live

import com.segmiq.sales.core.bootstrap.SalesAppBootstrap
import com.segmiq.sales.core.network.ApiError
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.network.ErrorKind
import com.segmiq.sales.core.network.HttpMethod
import com.segmiq.sales.core.network.SegmiqHttp
import com.segmiq.sales.core.network.SegmiqJson
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate

/** Request bodies contain only fields defined by the existing server contracts. */
class LiveSalesApi(private val http: SegmiqHttp) {

    fun baseUrl(): okhttp3.HttpUrl = http.config.baseUrl

    fun estate(workspace: com.segmiq.sales.core.bootstrap.LiveWorkspace) =
        com.segmiq.sales.core.estate.EstateRepository(http, workspace)

    suspend fun bootstrap() =
        http.request(HttpMethod.GET, "/api/sales/app/bootstrap", SalesAppBootstrap.serializer())

    suspend fun dashboard(background: Boolean = false) =
        http.request(HttpMethod.GET, "/api/sales/dashboard", SalesDashboardDto.serializer(), background = background)

    suspend fun workspace(visitId: String?, background: Boolean = false) = http.request(
        HttpMethod.GET, "/api/sales/dashboard/workspace", DailyWorkspaceDto.serializer(),
        query = mapOf("visitId" to visitId), background = background,
    )

    suspend fun tasks() = http.request(
        HttpMethod.GET, "/api/sales/tasks", SalesTasksDto.serializer(), query = mapOf("view" to "mine"),
    )

    suspend fun leads(search: String, stage: String, page: Int) = http.request(
        HttpMethod.GET, "/api/sales/leads", LeadsDirectoryDto.serializer(),
        query = mapOf(
            "period" to "all",
            "stage" to stage,
            "search" to search.trim().ifEmpty { null },
            "page" to page.toString(),
            "pageSize" to "20",
        ),
    )

    suspend fun lead(leadId: String) =
        http.request(HttpMethod.GET, "/api/leads/$leadId", LeadEnvelope.serializer())

    suspend fun timeline(leadId: String, cursor: String?) = http.request(
        HttpMethod.GET, "/api/leads/$leadId/timeline", TimelineDto.serializer(),
        query = mapOf("limit" to "30", "cursor" to cursor),
    )

    suspend fun addNote(leadId: String, note: String) = http.request(
        HttpMethod.POST, "/api/leads/$leadId/internal-note", OkResponse.serializer(),
        body = buildJsonObject { put("note", note) },
    )

    /** Completes a follow-up task: the web clears `follow_up_date` the same way. */
    suspend fun clearFollowUp(leadId: String) = http.request(
        HttpMethod.PATCH, "/api/leads/$leadId", OkResponse.serializer(),
        body = buildJsonObject { put("follow_up_date", JsonNull) },
    )

    /** `follow_up_date` is a date column; the server stores no time of day. */
    suspend fun setFollowUp(leadId: String, date: LocalDate) = http.request(
        HttpMethod.PATCH, "/api/leads/$leadId", OkResponse.serializer(),
        body = buildJsonObject { put("follow_up_date", date.toString()) },
    )

    suspend fun setStatus(leadId: String, status: String) = http.request(
        HttpMethod.PATCH, "/api/leads/$leadId", OkResponse.serializer(),
        body = buildJsonObject { put("status", status) },
    )

    suspend fun lookupContact(phone: String) = http.request(
        HttpMethod.GET, "/api/contacts/lookup", ContactLookupDto.serializer(), query = mapOf("phone" to phone.trim()),
    )

    suspend fun createLead(input: NewLeadInput, forceNew: Boolean): CreateLeadResult {
        val body = buildJsonObject {
            put("type", "lead")
            input.name.trim().takeIf { it.isNotEmpty() }?.let { put("name", it) }
            put("phone", input.phone.trim())
            input.email.trim().takeIf { it.isNotEmpty() }?.let { put("email", it) }
            put("source", input.source)
            input.notes.trim().takeIf { it.isNotEmpty() }?.let { put("notes", it) }
            if (forceNew) put("forceNew", true)
        }
        return when (val result = http.request(HttpMethod.POST, "/api/contacts", CreateLeadDto.serializer(), body = body)) {
            is ApiResult.Success -> result.value.leadId?.let { CreateLeadResult.Created(it) }
                ?: CreateLeadResult.Failed(ApiError(ErrorKind.DECODING, "The lead was saved but no lead id was returned."))
            is ApiResult.Failure -> duplicateFrom(result.error) ?: CreateLeadResult.Failed(result.error)
        }
    }

    private fun duplicateFrom(error: ApiError): CreateLeadResult.Duplicate? {
        if (error.status != 409) return null
        val existing = error.body?.get("existing") ?: return null
        return runCatching {
            CreateLeadResult.Duplicate(SegmiqJson.decodeFromJsonElement(DuplicateExisting.serializer(), existing.jsonObject))
        }.getOrNull()
    }

    suspend fun copilotAction(workItemId: String, action: CopilotAction, snoozeUntil: String? = null) = http.request(
        HttpMethod.POST, "/api/sales/copilot/work-items/$workItemId", WorkItemResponse.serializer(),
        body = buildJsonObject {
            put("action", action.wire)
            if (action == CopilotAction.SNOOZE && snoozeUntil != null) put("snoozeUntil", snoozeUntil)
        },
    )

    suspend fun inboxConversations() = http.request(
        HttpMethod.GET, "/api/inbox/conversations", com.segmiq.sales.core.inbox.InboxListDto.serializer(),
    )

    suspend fun inboxMessages(leadId: String, before: String? = null) = http.request(
        HttpMethod.GET, "/api/inbox/conversations/${pathId(leadId)}/messages",
        com.segmiq.sales.core.inbox.InboxMessagesDto.serializer(),
        query = mapOf("limit" to "50", "before" to before),
    )

    suspend fun quickReplies() = http.request(
        HttpMethod.GET, "/api/inbox/quick-replies", com.segmiq.sales.core.inbox.QuickRepliesDto.serializer(),
    )

    /** Text only. Attachment upload is not offered by this route. */
    suspend fun sendInboxMessage(leadId: String, text: String): ApiResult<com.segmiq.sales.core.inbox.SendMessageResult> {
        if (!pathIdOrNull(leadId) || text.isBlank())
            return ApiResult.Failure(ApiError(ErrorKind.VALIDATION, "Enter a message for a real inquiry."))
        return http.request(
            HttpMethod.POST, "/api/leads/${pathId(leadId)}/send-message",
            com.segmiq.sales.core.inbox.SendMessageResult.serializer(), retries = 0,
            body = buildJsonObject { put("text", text) },
        )
    }

    suspend fun notifications() = http.request(
        HttpMethod.GET, "/api/notifications", com.segmiq.sales.core.inbox.NotificationsDto.serializer(),
    )

    private fun pathIdOrNull(id: String) = id.isNotBlank() && id.length <= 80 && !id.startsWith("demo-") && id.none { it in "/?#%" }
    private fun pathId(id: String): String { require(pathIdOrNull(id)); return id }
}

data class NewLeadInput(
    val name: String,
    val phone: String,
    val email: String,
    val source: String,
    val notes: String,
)

/** Sources offered by the web "Add to hub" sheet, minus Walk-in (it needs an intake outcome flow). */
val LEAD_SOURCES = listOf("Referral", "Phone call", "WhatsApp", "Repeat customer", "Other")

sealed interface CreateLeadResult {
    data class Created(val leadId: String) : CreateLeadResult
    data class Duplicate(val existing: DuplicateExisting) : CreateLeadResult
    data class Failed(val error: ApiError) : CreateLeadResult
}

enum class CopilotAction(val wire: String) {
    APPROVE("approve"),
    DISMISS("dismiss"),
    SNOOZE("snooze"),
    COMPLETE("complete"),
}
