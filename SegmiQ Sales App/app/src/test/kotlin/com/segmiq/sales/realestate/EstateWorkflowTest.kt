package com.segmiq.sales.realestate

import com.segmiq.sales.features.realestate.*
import com.segmiq.sales.core.live.SalesTaskDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import java.time.*

@OptIn(ExperimentalCoroutinesApi::class)
class EstateWorkflowTest {
    private val dispatcher = StandardTestDispatcher()
    @Before fun setup() { Dispatchers.setMain(dispatcher) }
    @After fun cleanup() { Dispatchers.resetMain() }

    @Test fun failedSaveDoesNotApplyAndRetryAppliesOnce() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        val count = vm.state.value.offers.size
        vm.failNext()
        vm.createOffer("demo-p1", "demo-b1", "220000".toBigDecimal(), "Subject to inspection")
        advanceUntilIdle()
        assertEquals(count, vm.state.value.offers.size)
        assertNotNull(vm.state.value.error)
        vm.createOffer("demo-p1", "demo-b1", "220000".toBigDecimal(), "Subject to inspection")
        vm.createOffer("demo-p1", "demo-b1", "220000".toBigDecimal(), "Repeated click")
        advanceUntilIdle()
        assertEquals(count + 1, vm.state.value.offers.size)
        assertEquals("draft", vm.state.value.offers.last().status)
    }

    @Test fun privateBuyerCannotBeBookedOrChanged() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        val before = vm.state.value
        vm.schedule("demo-p1", "demo-private-buyer", Instant.parse("2099-01-01T10:00:00Z"), "Entrance", "")
        advanceUntilIdle()
        assertEquals(before.viewings, vm.state.value.viewings)
        assertNotNull(vm.state.value.error)
        vm.addNote("demo-private-buyer", "A note")
        advanceUntilIdle()
        assertEquals(before.buyers, vm.state.value.buyers)
    }

    @Test fun nonFiniteFinancialInputIsRejected() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        val before = vm.state.value.offers
        assertNull(estateDecimal("Infinity"))
        assertNull(estateDecimal("NaN"))
        vm.createOffer("demo-p1", "demo-b1", null, "")
        advanceUntilIdle()
        assertEquals(before, vm.state.value.offers)
        assertNotNull(vm.state.value.error)
    }

    @Test fun requesterCannotApproveOwnRequest() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        vm.decideIntroduction("demo-i2", "pending", "accepted", "")
        advanceUntilIdle()
        assertEquals("pending", vm.state.value.introductions.first { it.id == "demo-i2" }.status)
        assertNotNull(vm.state.value.error)
    }

    @Test fun introductionDecisionIsSingleUseAndReassignmentBlocksOldReviewer() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        vm.decideIntroduction("demo-i1", "pending", "accepted", "")
        advanceUntilIdle()
        vm.decideIntroduction("demo-i1", "pending", "declined", "Changed mind")
        advanceUntilIdle()
        assertEquals("accepted", vm.state.value.introductions.first { it.id == "demo-i1" }.status)
        assertNotNull(vm.state.value.error)
        val data = estateFixtures()
        val reassigned = EstateDemoViewModel(data.copy(introductions = data.introductions.map { it.copy(reviewer = "demo-reassigned-agent") }))
        reassigned.decideIntroduction("demo-i1", "pending", "accepted", "")
        advanceUntilIdle()
        assertEquals("pending", reassigned.state.value.introductions.first().status)
    }

    @Test fun offerRequiresCurrentStateAndTransactionKeepsContext() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        vm.changeOffer("demo-o1", "draft", "accepted")
        advanceUntilIdle()
        assertEquals("submitted", vm.state.value.offers.first().status)
        vm.changeOffer("demo-o1", "submitted", "accepted")
        advanceUntilIdle()
        vm.startTransaction("demo-o1")
        advanceUntilIdle()
        val txn = vm.state.value.transactions.last()
        assertEquals("demo-p1", txn.propertyId)
        assertEquals("demo-b1", txn.buyerId)
        assertEquals("pending_compliance", txn.status)
        assertEquals(11, txn.milestones.size)
        val count = vm.state.value.transactions.size
        vm.startTransaction("demo-o1")
        advanceUntilIdle()
        assertEquals(count, vm.state.value.transactions.size)
    }

    @Test fun exampleAttachmentNeverMeansApproved() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        vm.attachExample("demo-t1")
        advanceUntilIdle()
        assertEquals("submitted", vm.state.value.transactions.single().documents.last().status)
        assertNotEquals("approved", vm.state.value.transactions.single().documents.last().status)
    }

    @Test fun calendarRespectsOrganisationDayBoundaryAndDateOnlyTasks() {
        val zone = ZoneId.of("Africa/Harare")
        val rows = listOf(SalesTaskDto("one", "lead", "Timed", dueAt = "2026-10-30T22:30:00Z"),
            SalesTaskDto("two", "lead", "Date only", dueAt = "2026-10-30"))
        assertEquals(listOf("two"), calendarTasks(rows, LocalDate.of(2026, 10, 30), zone, false).map { it.id })
        assertEquals(listOf("one"), calendarTasks(rows, LocalDate.of(2026, 10, 31), zone, false).map { it.id })
        assertEquals(2, calendarTasks(rows, LocalDate.of(2026, 10, 30), zone, true).size)
    }
}
