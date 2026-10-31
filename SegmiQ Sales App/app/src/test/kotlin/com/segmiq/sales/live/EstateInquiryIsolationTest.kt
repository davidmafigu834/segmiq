package com.segmiq.sales.live

import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.network.ErrorKind
import com.segmiq.sales.core.network.TokenProvider
import com.segmiq.sales.features.live.LeadDetailViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import okhttp3.mockwebserver.MockWebServer
import org.junit.*
import org.junit.Assert.*
import java.util.concurrent.Executors

@OptIn(ExperimentalCoroutinesApi::class)
class EstateInquiryIsolationTest {
    private val main = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
    private val server = MockWebServer()
    @Before fun start() { Dispatchers.setMain(main); server.start() }
    @After fun stop() { server.shutdown(); Dispatchers.resetMain(); main.close() }

    @Test fun crossTenantBodyIsRejectedBeforeTimelineRequest() = runBlocking {
        server.enqueue(json("""{"lead":{"id":"test-lead","client_id":"another-tenant","assigned_to_id":"another-user","name":"Must not display"}}"""))
        val vm = LeadDetailViewModel(LiveSalesApi(server.http(TokenProvider { Fake.TOKEN })), "test-lead", Fake.ORG)
        val state = withTimeout(10_000) { vm.state.first { it.lead.error != null } }
        assertNull(state.lead.value)
        assertEquals(ErrorKind.FORBIDDEN, state.lead.error!!.kind)
        assertTrue(state.timeline.isEmpty())
        assertEquals(1, server.requestCount)
    }

    @Test fun calendarTaskDenialEvictsPrivateCache() = runBlocking {
        val workspace = com.segmiq.sales.core.bootstrap.LiveWorkspace.from(bootstrap())
        val cache = com.segmiq.sales.core.live.ScopedCache()
        cache.put(workspace.scope, "tasks", com.segmiq.sales.core.live.SalesTasksDto(tasks = listOf(
            com.segmiq.sales.core.live.SalesTaskDto("cached", "lead", "Private cached task"))))
        server.enqueue(json("""{"error":"Forbidden"}""", 403))
        val vm = com.segmiq.sales.features.live.TasksViewModel(LiveSalesApi(server.http(TokenProvider { Fake.TOKEN })), cache, workspace)
        val denied = withTimeout(10_000) { vm.state.first { it.data.error != null } }
        assertNull(denied.data.value)
        assertEquals(0, cache.size())
    }

    @Test fun forbiddenRefreshClearsPreviouslyLoadedPrivateInquiryAndTimeline() = runBlocking {
        server.enqueue(json("""{"lead":{"id":"test-lead","client_id":"${Fake.ORG}","assigned_to_id":"${Fake.USER}","name":"Synthetic customer"}}"""))
        server.enqueue(json("""{"items":[{"id":"event","title":"Synthetic private note"}]}"""))
        val vm = LeadDetailViewModel(LiveSalesApi(server.http(TokenProvider { Fake.TOKEN })), "test-lead", Fake.ORG)
        withTimeout(10_000) { vm.state.first { it.timeline.isNotEmpty() } }
        server.enqueue(json("""{"error":"Access no longer permitted"}""", 403))
        vm.load()
        val denied = withTimeout(10_000) { vm.state.first { it.lead.error != null } }
        // Await the associated privacy cleanup, which follows the lead-state update.
        val cleared = withTimeout(10_000) { vm.state.first { it.lead.value == null && it.timeline.isEmpty() } }
        assertEquals(ErrorKind.FORBIDDEN, denied.lead.error!!.kind)
        assertNull(cleared.lead.value)
        assertEquals(3, server.requestCount)
    }
}
