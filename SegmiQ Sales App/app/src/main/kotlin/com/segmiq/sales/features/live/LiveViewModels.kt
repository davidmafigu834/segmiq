package com.segmiq.sales.features.live

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.live.CompletionPlan
import com.segmiq.sales.core.live.ContactMatch
import com.segmiq.sales.core.live.CopilotAction
import com.segmiq.sales.core.live.WorkItemResponse
import com.segmiq.sales.core.live.presentCopilot
import com.segmiq.sales.core.live.CreateLeadResult
import com.segmiq.sales.core.live.DailyWorkspaceDto
import com.segmiq.sales.core.live.DuplicateExisting
import com.segmiq.sales.core.live.LeadDirectoryRow
import com.segmiq.sales.core.live.LeadRowDto
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.NewLeadInput
import com.segmiq.sales.core.live.SalesDashboardDto
import com.segmiq.sales.core.live.SalesTaskDto
import com.segmiq.sales.core.live.SalesTasksDto
import com.segmiq.sales.core.live.ScopedCache
import com.segmiq.sales.core.live.TimelineItemDto
import com.segmiq.sales.core.live.completionPlan
import com.segmiq.sales.core.live.get
import com.segmiq.sales.core.network.ApiError
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.network.ErrorKind
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZonedDateTime

data class Loadable<T>(
    val value: T? = null,
    val loading: Boolean = false,
    val error: ApiError? = null,
    val updatedAt: Instant? = null,
)

private fun <T> Loadable<T>.started() = copy(loading = true, error = null)
private fun <T> Loadable<T>.finished(result: ApiResult<T>, at: Instant) = when (result) {
    is ApiResult.Success -> Loadable(result.value, false, null, at)
    is ApiResult.Failure -> if (result.deniesAccess()) Loadable<T>(error = result.error) else copy(loading = false, error = result.error)
}

private fun ApiResult<*>.deniesAccess() = this is ApiResult.Failure && error.kind in setOf(ErrorKind.FORBIDDEN, ErrorKind.NOT_FOUND, ErrorKind.SESSION_ENDED)

data class MyDayState(
    val dashboard: Loadable<SalesDashboardDto> = Loadable(),
    val workspace: Loadable<DailyWorkspaceDto> = Loadable(),
    val tasks: Loadable<SalesTasksDto> = Loadable(),
    val refreshing: Boolean = false,
) {
    val updatedAt: Instant? get() = listOfNotNull(dashboard.updatedAt, workspace.updatedAt, tasks.updatedAt).minOrNull()
}

class MyDayViewModel(
    private val api: LiveSalesApi,
    private val cache: ScopedCache,
    private val workspace: LiveWorkspace,
    private val now: () -> Instant = Instant::now,
) : ViewModel() {
    private val scope = workspace.scope
    private val _state = MutableStateFlow(
        MyDayState(
            dashboard = cache.get<SalesDashboardDto>(scope, "dashboard")?.let { Loadable(it) } ?: Loadable(),
            workspace = cache.get<DailyWorkspaceDto>(scope, "workspace")?.let { Loadable(it) } ?: Loadable(),
            tasks = cache.get<SalesTasksDto>(scope, "tasks")?.let { Loadable(it) } ?: Loadable(),
        )
    )
    val state: StateFlow<MyDayState> = _state.asStateFlow()

    init { load(refresh = false) }

    fun load(refresh: Boolean = true) {
        if (_state.value.refreshing) return
        _state.update {
            it.copy(dashboard = it.dashboard.started(), workspace = it.workspace.started(), tasks = it.tasks.started(), refreshing = refresh)
        }
        viewModelScope.launch {
            val visitId = cache.get<String>(scope, "visitId")
            val d = async { api.dashboard() }
            val w = async { api.workspace(visitId) }
            val t = async { if (workspace.navigation.allows(com.segmiq.sales.core.bootstrap.LiveModule.TASKS)) api.tasks() else ApiResult.Success(SalesTasksDto()) }
            val dr = d.await(); val wr = w.await(); val tr = t.await()
            val at = now()
            if (dr.deniesAccess()) cache.remove(scope, "dashboard")
            if (wr.deniesAccess()) cache.remove(scope, "workspace")
            if (tr.deniesAccess()) cache.remove(scope, "tasks")
            (dr as? ApiResult.Success)?.let { cache.put(scope, "dashboard", it.value) }
            (wr as? ApiResult.Success)?.let { r ->
                cache.put(scope, "workspace", r.value)
                r.value.visitId?.let { cache.put(scope, "visitId", it) }
            }
            (tr as? ApiResult.Success)?.let { cache.put(scope, "tasks", it.value) }
            _state.update {
                it.copy(dashboard = it.dashboard.finished(dr, at), workspace = it.workspace.finished(wr, at),
                    tasks = it.tasks.finished(tr, at), refreshing = false)
            }
        }
    }
}

class PipelineViewModel(private val api: LiveSalesApi, private val cache: ScopedCache, workspace: LiveWorkspace) : ViewModel() {
    private val scope = workspace.scope
    private val _state = MutableStateFlow(cache.get<SalesDashboardDto>(scope, "dashboard")?.let { Loadable(it) } ?: Loadable())
    val state: StateFlow<Loadable<SalesDashboardDto>> = _state.asStateFlow()
    init { load() }
    fun load() {
        _state.update { it.started() }
        viewModelScope.launch {
            val r = api.dashboard()
            if (r.deniesAccess()) cache.remove(scope, "dashboard")
            (r as? ApiResult.Success)?.let { cache.put(scope, "dashboard", it.value) }
            _state.update { it.finished(r, Instant.now()) }
        }
    }
}

/** Server stage filters for `/api/sales/leads` (lib/sales/leads-directory/filters.ts). */
val LEAD_STAGE_FILTERS = listOf(
    "all" to "All", "NEW" to "New", "CONTACTED" to "Contacted", "NEGOTIATING" to "Negotiating",
    "PROPOSAL_SENT" to "Proposal sent", "WON" to "Won", "LOST" to "Lost", "NOT_QUALIFIED" to "Not qualified",
)

fun leadStatusLabel(status: String?): String = when (status) {
    null -> "Unknown"
    "QUALIFIED" -> "Qualified"
    "CONVERTED_TO_DEAL" -> "Converted to deal"
    else -> LEAD_STAGE_FILTERS.firstOrNull { it.first == status }?.second ?: status.lowercase().replace('_', ' ').replaceFirstChar { it.uppercase() }
}

data class LeadsState(
    val query: String = "",
    val stage: String = "all",
    val items: List<LeadDirectoryRow> = emptyList(),
    val page: Int = 0,
    val total: Int = 0,
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val error: ApiError? = null,
    val loadedOnce: Boolean = false,
) {
    val canLoadMore: Boolean get() = items.size < total && !loading && !loadingMore
}

class LeadsViewModel(private val api: LiveSalesApi) : ViewModel() {
    private val _state = MutableStateFlow(LeadsState())
    val state: StateFlow<LeadsState> = _state.asStateFlow()
    private var searchJob: Job? = null

    init { reload() }

    fun setQuery(query: String) {
        _state.update { it.copy(query = query) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch { delay(350); reloadNow() }
    }

    fun setStage(stage: String) {
        _state.update { it.copy(stage = stage) }
        reload()
    }

    fun reload() {
        searchJob?.cancel()
        searchJob = viewModelScope.launch { reloadNow() }
    }

    private suspend fun reloadNow() {
        val s = _state.value
        _state.update { it.copy(loading = true, error = null) }
        when (val r = api.leads(s.query, s.stage, page = 1)) {
            is ApiResult.Success -> _state.update {
                it.copy(items = r.value.leads, page = 1, total = r.value.meta?.totalFiltered ?: r.value.leads.size,
                    loading = false, loadedOnce = true)
            }
            is ApiResult.Failure -> _state.update { it.copy(loading = false, error = r.error, loadedOnce = true) }
        }
    }

    fun loadMore() {
        val s = _state.value
        if (!s.canLoadMore) return
        _state.update { it.copy(loadingMore = true, error = null) }
        viewModelScope.launch {
            when (val r = api.leads(s.query, s.stage, page = s.page + 1)) {
                is ApiResult.Success -> _state.update { st ->
                    st.copy(items = (st.items + r.value.leads).distinctBy { it.id }, page = s.page + 1,
                        total = r.value.meta?.totalFiltered ?: st.total, loadingMore = false)
                }
                is ApiResult.Failure -> _state.update { it.copy(loadingMore = false, error = r.error) }
            }
        }
    }
}

data class LeadDetailState(
    val lead: Loadable<LeadRowDto> = Loadable(),
    val timeline: List<TimelineItemDto> = emptyList(),
    val timelineCursor: String? = null,
    val timelineHasMore: Boolean = false,
    val timelineError: ApiError? = null,
    val timelineLoading: Boolean = false,
    val saving: Boolean = false,
    val actionError: String? = null,
    val actionMessage: String? = null,
)

class LeadDetailViewModel(private val api: LiveSalesApi, private val leadId: String, private val expectedOrganisationId: String? = null) : ViewModel() {
    private val _state = MutableStateFlow(LeadDetailState())
    val state: StateFlow<LeadDetailState> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.update { it.copy(lead = it.lead.started()) }
        viewModelScope.launch {
            val received = api.lead(leadId)
            val r = if (received is ApiResult.Success && expectedOrganisationId != null && received.value.lead.client_id != expectedOrganisationId)
                ApiResult.Failure(ApiError(ErrorKind.FORBIDDEN, "This inquiry is not available in your organisation."))
                else received
            _state.update { it.copy(lead = when (r) {
                is ApiResult.Success -> Loadable(r.value.lead, updatedAt = Instant.now())
                is ApiResult.Failure -> if (r.error.kind in setOf(ErrorKind.FORBIDDEN, ErrorKind.NOT_FOUND, ErrorKind.SESSION_ENDED))
                    Loadable(error = r.error) else it.lead.copy(loading = false, error = r.error)
            }) }
            if (r is ApiResult.Success) loadTimeline(reset = true)
            else if (r is ApiResult.Failure && r.error.kind in setOf(ErrorKind.FORBIDDEN, ErrorKind.NOT_FOUND, ErrorKind.SESSION_ENDED))
                _state.update { it.copy(timeline = emptyList(), timelineCursor = null, timelineHasMore = false) }
        }
    }

    fun loadTimeline(reset: Boolean = false) {
        val s = _state.value
        if (s.timelineLoading) return
        _state.update { it.copy(timelineLoading = true, timelineError = null) }
        viewModelScope.launch {
            when (val r = api.timeline(leadId, if (reset) null else s.timelineCursor)) {
                is ApiResult.Success -> _state.update { st ->
                    val merged = if (reset) r.value.pinned + r.value.items else st.timeline + r.value.items
                    st.copy(timeline = merged.distinctBy { it.id }, timelineCursor = r.value.nextCursor,
                        timelineHasMore = r.value.hasMore, timelineLoading = false)
                }
                is ApiResult.Failure -> _state.update { it.copy(timelineLoading = false, timelineError = r.error) }
            }
        }
    }

    private fun mutate(success: String, call: suspend () -> ApiResult<*>) {
        if (_state.value.saving) return
        _state.update { it.copy(saving = true, actionError = null, actionMessage = null) }
        viewModelScope.launch {
            when (val r = call()) {
                is ApiResult.Success -> {
                    _state.update { it.copy(saving = false, actionMessage = success) }
                    load()
                }
                is ApiResult.Failure -> _state.update { it.copy(saving = false, actionError = r.error.message) }
            }
        }
    }

    fun addNote(note: String) {
        if (note.isBlank()) { _state.update { it.copy(actionError = "Write a note first.") }; return }
        mutate("Note saved") { api.addNote(leadId, note.trim().take(2000)) }
    }
    fun setFollowUp(date: LocalDate) = mutate("Follow-up set for $date") { api.setFollowUp(leadId, date) }
    fun clearFollowUp() = mutate("Follow-up completed") { api.clearFollowUp(leadId) }
    fun setStatus(status: String) = mutate("Status updated") { api.setStatus(leadId, status) }
    fun dismissMessage() = _state.update { it.copy(actionMessage = null, actionError = null) }
}

data class AddLeadState(
    val saving: Boolean = false,
    val checking: Boolean = false,
    val match: ContactMatch? = null,
    val checkedPhone: String? = null,
    val duplicate: DuplicateExisting? = null,
    val createdLeadId: String? = null,
    val error: String? = null,
    val fieldError: String? = null,
)

class AddLeadViewModel(private val api: LiveSalesApi) : ViewModel() {
    private val _state = MutableStateFlow(AddLeadState())
    val state: StateFlow<AddLeadState> = _state.asStateFlow()

    fun lookup(phone: String) {
        val trimmed = phone.trim()
        if (trimmed.length < 3 || trimmed == _state.value.checkedPhone) return
        _state.update { it.copy(checking = true, error = null) }
        viewModelScope.launch {
            when (val r = api.lookupContact(trimmed)) {
                is ApiResult.Success -> _state.update { it.copy(checking = false, match = r.value.match, checkedPhone = trimmed) }
                is ApiResult.Failure -> _state.update { it.copy(checking = false, match = null, error = r.error.message) }
            }
        }
    }

    fun submit(input: NewLeadInput, forceNew: Boolean = false) {
        if (_state.value.saving) return
        val phoneDigits = input.phone.count(Char::isDigit)
        if (phoneDigits < 6) { _state.update { it.copy(fieldError = "Enter a valid phone number.") }; return }
        if (input.name.isBlank()) { _state.update { it.copy(fieldError = "Enter the customer's name.") }; return }
        _state.update { it.copy(saving = true, error = null, fieldError = null) }
        viewModelScope.launch {
            when (val r = api.createLead(input, forceNew)) {
                is CreateLeadResult.Created -> _state.update { it.copy(saving = false, createdLeadId = r.leadId, duplicate = null) }
                is CreateLeadResult.Duplicate -> _state.update { it.copy(saving = false, duplicate = r.existing) }
                is CreateLeadResult.Failed -> _state.update {
                    it.copy(saving = false, error = r.error.message, fieldError = r.error.field?.let { f -> "Check the $f field." })
                }
            }
        }
    }

    fun clearDuplicate() = _state.update { it.copy(duplicate = null) }
}

data class TasksState(
    val data: Loadable<SalesTasksDto> = Loadable(),
    val busyIds: Set<String> = emptySet(),
    val message: String? = null,
    val notice: String? = null,
    val simulated: Boolean = false,
    val error: String? = null,
)

class TasksViewModel(private val api: LiveSalesApi, private val cache: ScopedCache, workspace: LiveWorkspace) : ViewModel() {
    private val scope = workspace.scope
    private val _state = MutableStateFlow(TasksState(cache.get<SalesTasksDto>(scope, "tasks")?.let { Loadable(it) } ?: Loadable()))
    val state: StateFlow<TasksState> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.update { it.copy(data = it.data.started()) }
        viewModelScope.launch {
            val r = api.tasks()
            if (r.deniesAccess()) cache.remove(scope, "tasks")
            (r as? ApiResult.Success)?.let { cache.put(scope, "tasks", it.value) }
            _state.update { it.copy(data = it.data.finished(r, Instant.now())) }
        }
    }

    private fun run(id: String, success: String, call: suspend () -> ApiResult<*>) {
        if (id in _state.value.busyIds) return
        _state.update { it.copy(busyIds = it.busyIds + id, error = null, message = null) }
        viewModelScope.launch {
            val r = call()
            when (r) {
                is ApiResult.Success -> _state.update { it.copy(busyIds = it.busyIds - id, message = success) }
                is ApiResult.Failure -> _state.update {
                    val msg = if (r.error.kind == ErrorKind.STALE || r.error.status == 409) "${r.error.message} The list has been refreshed."
                    else r.error.message
                    it.copy(busyIds = it.busyIds - id, error = msg)
                }
            }
            // Always reload from the server: success shows the confirmed state, 409 shows the current one.
            if (r is ApiResult.Success || r.isConflict()) load()
        }
    }

    private fun ApiResult<*>.isConflict() = (this as? ApiResult.Failure)?.error?.status == 409

    /** Never marks a task done locally: the row changes only after the server confirms. */
    fun complete(task: SalesTaskDto): Boolean = when (val plan = task.completionPlan()) {
        is CompletionPlan.ClearFollowUp -> { run(task.id, "Task completed") { api.clearFollowUp(plan.leadId) }; true }
        is CompletionPlan.CompleteWorkItem -> { runCopilot(task.id, CopilotAction.COMPLETE) { api.copilotAction(plan.workItemId, CopilotAction.COMPLETE) }; true }
        CompletionPlan.ReviewFirst -> { _state.update { it.copy(error = "Review this Copilot suggestion before completing it.") }; false }
        CompletionPlan.AlreadyDone -> false
    }

    fun followUp(task: SalesTaskDto, date: LocalDate) =
        run(task.id, "Follow-up set for $date") { api.setFollowUp(task.leadId, date) }

    fun copilot(task: SalesTaskDto, action: CopilotAction, snoozeUntil: ZonedDateTime? = null) {
        val item = task.copilot ?: return
        runCopilot(task.id, action) { api.copilotAction(item.workItemId, action, snoozeUntil?.toInstant()?.toString()) }
    }

    private fun runCopilot(id: String, action: CopilotAction, call: suspend () -> ApiResult<WorkItemResponse>) {
        if (id in _state.value.busyIds) return
        _state.update { it.copy(busyIds = it.busyIds + id, error = null, message = null, notice = null, simulated = false) }
        viewModelScope.launch {
            when (val result = call()) {
                is ApiResult.Success -> {
                    val presentation = presentCopilot(action, result.value)
                    _state.update {
                        it.copy(busyIds = it.busyIds - id, message = presentation.headline, notice = presentation.detail, simulated = presentation.simulated)
                    }
                    load()
                }
                is ApiResult.Failure -> _state.update { it.copy(busyIds = it.busyIds - id, error = result.error.message) }
            }
        }
    }

    fun dismissMessage() = _state.update { it.copy(message = null, notice = null, simulated = false, error = null) }
}
