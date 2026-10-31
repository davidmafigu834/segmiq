package com.segmiq.sales.live

import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.data.AuthorisedScope
import com.segmiq.sales.core.live.CompletionPlan
import com.segmiq.sales.core.live.CopilotAction
import com.segmiq.sales.core.live.CopilotDto
import com.segmiq.sales.core.live.CopilotPolicy
import com.segmiq.sales.core.live.CreateLeadResult
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.NewLeadInput
import com.segmiq.sales.core.live.SalesTaskDto
import com.segmiq.sales.core.live.ScopedCache
import com.segmiq.sales.core.live.TaskBucket
import com.segmiq.sales.core.live.TaskFilter
import com.segmiq.sales.core.live.TaskScheduleDto
import com.segmiq.sales.core.live.bucket
import com.segmiq.sales.core.live.completionPlan
import com.segmiq.sales.core.live.filterLiveTasks
import com.segmiq.sales.core.live.get
import com.segmiq.sales.core.network.SegmiqJson
import com.segmiq.sales.core.network.TokenProvider
import com.segmiq.sales.features.live.TasksState
import com.segmiq.sales.features.live.TasksViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.Executors

private val HARARE = ZoneId.of("Africa/Harare")
private val TODAY = LocalDate.of(2026, 10, 30)

private fun task(id: String, at: String? = null, completed: Boolean = false, overdue: Boolean = false, copilot: CopilotDto? = null) =
    SalesTaskDto(id = id, leadId = "lead-$id", title = "Follow up $id", schedule = TaskScheduleDto(at = at, overdue = overdue),
        completed = completed, copilot = copilot)

private fun copilot(
    actionType: String = "follow_up",
    reviewStatus: String? = "pending",
    primaryAction: String? = "approve",
    missing: List<String> = emptyList(),
    fulfilmentStatus: String? = null,
) = CopilotDto(workItemId = "wi-1", queue = "needs_review", actionType = actionType, reviewStatus = reviewStatus,
    primaryAction = primaryAction, missing = missing, fulfilmentStatus = fulfilmentStatus)

class TaskRulesTest {
    @Test fun bucketsUseTheOrganisationTimeZone() {
        val lateUtc = task("a", at = "2026-10-30T23:30:00Z")
        assertEquals(TaskBucket.UPCOMING, lateUtc.bucket(TODAY, HARARE))
        assertEquals(TaskBucket.TODAY, lateUtc.bucket(TODAY, ZoneId.of("UTC")))
        assertEquals(TaskBucket.TODAY, task("b", at = "2026-10-30").bucket(TODAY, HARARE))
        assertEquals(TaskBucket.OVERDUE, task("c", at = "2026-10-29").bucket(TODAY, HARARE))
        assertEquals(TaskBucket.OVERDUE, task("d", at = "2026-11-02", overdue = true).bucket(TODAY, HARARE))
        assertEquals(TaskBucket.UNDATED, task("e").bucket(TODAY, HARARE))
        assertEquals(TaskBucket.COMPLETED, task("f", at = "2026-10-30", completed = true).bucket(TODAY, HARARE))
    }

    @Test fun filtersDedupeAndSort() {
        val tasks = listOf(task("late", "2026-11-05"), task("soon", "2026-11-01"), task("soon", "2026-11-01"),
            task("today", "2026-10-30"), task("done", "2026-10-30", completed = true))
        assertEquals(listOf("soon", "late"), filterLiveTasks(tasks, TaskFilter.UPCOMING, TODAY, HARARE).map { it.id })
        assertEquals(listOf("today"), filterLiveTasks(tasks, TaskFilter.TODAY, TODAY, HARARE).map { it.id })
        assertEquals(listOf("done"), filterLiveTasks(tasks, TaskFilter.COMPLETED, TODAY, HARARE).map { it.id })
        assertEquals(listOf("today", "soon", "late"), filterLiveTasks(tasks, TaskFilter.MINE, TODAY, HARARE).map { it.id })
    }

    @Test fun completionPlans() {
        assertEquals(CompletionPlan.ClearFollowUp("lead-a"), task("a").completionPlan())
        assertEquals(CompletionPlan.AlreadyDone, task("a", completed = true).completionPlan())
        assertEquals(CompletionPlan.ReviewFirst, task("a", copilot = copilot()).completionPlan())
        assertEquals(CompletionPlan.CompleteWorkItem("wi-1"),
            task("a", copilot = copilot(reviewStatus = "approved", primaryAction = "complete")).completionPlan())
    }

    @Test fun copilotNeverApprovesWebOnlyActions() {
        listOf("quotation_draft", "quotation_choice", "quotation_missing", "listing_shortlist", "appointment").forEach {
            val c = copilot(actionType = it)
            assertFalse(it, CopilotPolicy.canApprove(c))
            assertTrue(it, CopilotPolicy.requiresWeb(c))
        }
        listOf("follow_up", "answer_question", "open_commitment", "send_quotation").forEach {
            assertTrue(it, CopilotPolicy.canApprove(copilot(actionType = it)))
        }
    }

    @Test fun copilotRulesForMissingInfoAndClosedItems() {
        assertFalse(CopilotPolicy.canApprove(copilot(missing = listOf("date"))))
        assertFalse(CopilotPolicy.canApprove(copilot(reviewStatus = "approved")))
        assertFalse(CopilotPolicy.canDismiss(copilot(reviewStatus = "dismissed")))
        assertFalse(CopilotPolicy.canDismiss(copilot(fulfilmentStatus = "fulfilled")))
        assertFalse(CopilotPolicy.canSnooze(copilot(reviewStatus = "approved")))
        assertTrue(CopilotPolicy.canComplete(copilot(reviewStatus = "approved", primaryAction = "complete")))
        assertFalse(CopilotPolicy.canComplete(copilot(reviewStatus = "pending", primaryAction = "complete")))
    }
}

class ScopedCacheTest {
    private val a = AuthorisedScope("org-a", "user-a")
    private val b = AuthorisedScope("org-b", "user-b")

    @Test fun anotherAccountCannotReadCachedData() {
        val cache = ScopedCache()
        cache.put(a, "tasks", "secret-a")
        assertEquals("secret-a", cache.get<String>(a, "tasks"))
        assertNull(cache.get<String>(b, "tasks"))
        assertNull(cache.get<String>(AuthorisedScope("org-a", "user-b"), "tasks"))
    }

    @Test fun switchingAccountDropsPreviousData() {
        val cache = ScopedCache()
        cache.put(a, "tasks", "secret-a")
        cache.put(a, "dashboard", "dash-a")
        cache.put(b, "tasks", "b")
        assertEquals(1, cache.size())
        assertNull(cache.get<String>(a, "dashboard"))
        cache.clear()
        assertEquals(0, cache.size())
    }
}

class LiveSalesApiTest {
    private val server = MockWebServer()
    private lateinit var api: LiveSalesApi

    @Before fun start() {
        server.start()
        api = LiveSalesApi(server.http(TokenProvider { Fake.TOKEN }))
    }
    @After fun stop() = server.shutdown()

    private fun body() = SegmiqJson.parseToJsonElement(server.next().body.readUtf8()).jsonObject

    @Test fun completingAFollowUpSendsNullDate() = runBlocking {
        server.enqueue(json("""{"ok":true}"""))
        api.clearFollowUp("lead-1")
        val req = server.next()
        assertEquals("PATCH", req.method)
        assertEquals("/api/leads/lead-1", req.path)
        val b = SegmiqJson.parseToJsonElement(req.body.readUtf8()).jsonObject
        assertEquals(setOf("follow_up_date"), b.keys)
        assertEquals(JsonNull, b["follow_up_date"])
    }

    @Test fun followUpIsADateOnly() = runBlocking {
        server.enqueue(json("""{"ok":true}"""))
        api.setFollowUp("lead-1", LocalDate.of(2026, 11, 2))
        assertEquals("2026-11-02", body()["follow_up_date"]!!.jsonPrimitive.content)
    }

    @Test fun leadsQueryIsScopedToTheDirectoryContract() = runBlocking {
        server.enqueue(json("""{"meta":{"page":1,"pageSize":20,"totalFiltered":0,"allTimeCount":0},"leads":[]}"""))
        api.leads(" anna ", "NEW", 2)
        val url = server.next().requestUrl!!
        assertEquals("/api/sales/leads", url.encodedPath)
        assertEquals("all", url.queryParameter("period"))
        assertEquals("anna", url.queryParameter("search"))
        assertEquals("NEW", url.queryParameter("stage"))
        assertEquals("2", url.queryParameter("page"))
        assertEquals("20", url.queryParameter("pageSize"))
    }

    @Test fun duplicateLeadIsParsedFromConflict() = runBlocking {
        server.enqueue(json("""{"error":"duplicate","existing":{"id":"c-1","name":"Anna","lifecycle":"lead","leadId":"lead-9","leadStatus":"NEW","owner":"Other Seller","ownedByYou":false}}""", 409))
        val r = api.createLead(NewLeadInput("Anna", "0771234501", "", "Referral", ""), forceNew = false)
        val dup = (r as CreateLeadResult.Duplicate).existing
        assertEquals("lead-9", dup.leadId)
        assertFalse(dup.ownedByYou)
        assertEquals(setOf("type", "name", "phone", "source"), body().keys)
    }

    @Test fun forceNewIsSentOnlyWhenChosen() = runBlocking {
        server.enqueue(json("""{"ok":true,"kind":"lead","contactId":"c-2","leadId":"lead-2"}"""))
        val r = api.createLead(NewLeadInput("Anna", "0771234501", "a@example.test", "Other", "note"), forceNew = true)
        assertEquals(CreateLeadResult.Created("lead-2"), r)
        assertTrue(body()["forceNew"]!!.jsonPrimitive.content.toBoolean())
    }

    @Test fun copilotSnoozeSendsUntil() = runBlocking {
        server.enqueue(json("""{"item":{}}"""))
        api.copilotAction("wi-1", CopilotAction.SNOOZE, "2026-11-01T08:00:00Z")
        val b = body()
        assertEquals("snooze", b["action"]!!.jsonPrimitive.content)
        assertEquals("2026-11-01T08:00:00Z", b["snoozeUntil"]!!.jsonPrimitive.content)
    }

    @Test fun staleCopilotItemIsReportedAsConflict() = runBlocking {
        server.enqueue(json("""{"error":"This suggestion changed. Refresh and try again.","code":"stale"}""", 409))
        val r = api.copilotAction("wi-1", CopilotAction.APPROVE)
        val e = (r as com.segmiq.sales.core.network.ApiResult.Failure).error
        assertEquals(com.segmiq.sales.core.network.ErrorKind.STALE, e.kind)
        assertEquals(409, e.status)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class TasksViewModelTest {
    private val server = MockWebServer()
    private val main = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
    private val workspace = LiveWorkspace.from(bootstrap())

    @Before fun start() {
        server.start()
        Dispatchers.setMain(main)
    }

    @After fun stop() {
        Dispatchers.resetMain()
        main.close()
        server.shutdown()
    }

    private val tasksJson = """{"meta":{"timezone":"Africa/Harare"},"tasks":[{"id":"t1","leadId":"lead-1","title":"Call back","completed":false}],"upcoming":[]}"""
    private val doneJson = """{"meta":{"timezone":"Africa/Harare"},"tasks":[{"id":"t1","leadId":"lead-1","title":"Call back","completed":true}],"upcoming":[]}"""

    private fun vm() = TasksViewModel(LiveSalesApi(server.http(TokenProvider { Fake.TOKEN })), ScopedCache(), workspace)

    private fun TasksViewModel.await(predicate: (TasksState) -> Boolean) = runBlocking { withTimeout(10_000) { state.first(predicate) } }

    @Test fun failedCompletionLeavesTaskOpen() {
        server.enqueue(json(tasksJson))
        server.enqueue(json("""{"error":"Something failed on the server."}""", 500))
        val vm = vm()
        val loaded = vm.await { it.data.value != null && !it.data.loading }
        val t = loaded.data.value!!.tasks.single()
        assertTrue(vm.complete(t))
        val after = vm.await { it.error != null && it.busyIds.isEmpty() }
        assertFalse(after.data.value!!.tasks.single().completed)
        assertNull(after.message)
        server.next()
        assertEquals("PATCH", server.next().method)
        assertEquals("no reload after a plain failure", 2, server.requestCount)
    }

    @Test fun successfulCompletionReloadsServerState() {
        server.enqueue(json(tasksJson))
        server.enqueue(json("""{"ok":true}"""))
        server.enqueue(json(doneJson))
        val vm = vm()
        val t = vm.await { it.data.value != null && !it.data.loading }.data.value!!.tasks.single()
        vm.complete(t)
        val after = vm.await { it.message != null && it.data.value?.tasks?.single()?.completed == true }
        assertEquals("Task completed", after.message)
        assertEquals(3, server.requestCount)
    }

    @Test fun copilotItemsNeedReviewBeforeCompletion() {
        server.enqueue(json(tasksJson))
        val vm = vm()
        vm.await { it.data.value != null && !it.data.loading }
        assertFalse(vm.complete(task("x", copilot = copilot())))
        assertNotNull(vm.state.value.error)
        assertEquals(1, server.requestCount)
    }
}
