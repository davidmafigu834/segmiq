package com.segmiq.sales.realestate

import com.segmiq.sales.features.realestate.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.Assert.*
import java.time.*

@OptIn(ExperimentalCoroutinesApi::class)
class EstateFormTest {
    private val dispatcher = StandardTestDispatcher()
    @Before fun setup() { Dispatchers.setMain(dispatcher) }
    @After fun cleanup() { Dispatchers.resetMain() }

    @Test fun requirementsPreserveOptionalValuesAndRejectInvalidRanges() {
        assertTrue(RequirementsDraft().errors().isEmpty())
        assertTrue(RequirementsDraft("200000.01", "200000.00").errors().containsKey("budgetMax"))
        assertTrue(RequirementsDraft(bathrooms = "-1", bedrooms = "1.5").errors().keys.containsAll(listOf("bedrooms", "bathrooms")))
        assertTrue(RequirementsDraft(locations = (1..13).joinToString { "Location $it" }).errors().containsKey("locations"))
        assertTrue(RequirementsDraft(features = "x".repeat(2001)).errors().containsKey("features"))
        assertNull(estateDecimal("1e9")); assertNull(estateDecimal("NaN")); assertNull(estateDecimal("-5"))
        assertEquals("150000.01", estateDecimal("150000.01")!!.toPlainString())
    }

    @Test fun reviewDisplaysEveryAcceptedFractionalDigit() {
        assertEquals("$175,000.000001", estateAmount(estateDecimal("175000.000001")))
        assertEquals("$175,000.01", estateAmount(estateDecimal("175000.01")))
    }

    @Test fun keySurvivesSameIntentButChangesWhenEdited() {
        val identity = BookingIdentity().forIntent("property-buyer-time-instructions")
        assertEquals(identity, identity.forIntent("property-buyer-time-instructions"))
        assertNotEquals(identity.key, identity.forIntent("different time").key)
        assertEquals(identity, BookingIdentity(identity.fingerprint, identity.key).forIntent(identity.fingerprint))
    }

    @Test fun viewingTimeRejectsPastAndAmbiguousWallClock() {
        val now = Instant.parse("2026-10-31T10:00:00Z")
        assertNotNull(viewingTimeError(now, now))
        assertNull(viewingTimeError(now.plusSeconds(60), now))
        val zone = ZoneId.of("America/New_York")
        assertNull(viewingInstant(LocalDateTime.of(2026, 11, 1, 1, 30), zone))
        assertNull(viewingInstant(LocalDateTime.of(2026, 3, 8, 2, 30), zone))
        assertNotNull(viewingInstant(LocalDateTime.of(2026, 11, 1, 3, 30), zone))
    }

    @Test fun preciseOfferRetryAndDuplicateTapCreateOnlyOneDraft() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        val count = vm.state.value.offers.size
        val key = BookingIdentity().forIntent("same draft").key
        vm.failNext()
        vm.createOffer("demo-p1", "demo-b1", estateDecimal("175000.01"), "Exact cents", key)
        advanceUntilIdle()
        assertEquals(count, vm.state.value.offers.size)
        vm.createOffer("demo-p1", "demo-b1", estateDecimal("175000.01"), "Exact cents", key)
        vm.createOffer("demo-p1", "demo-b1", estateDecimal("175000.01"), "Exact cents", key)
        advanceUntilIdle()
        vm.createOffer("demo-p1", "demo-b1", estateDecimal("175000.01"), "Exact cents", key)
        advanceUntilIdle()
        assertEquals(count + 1, vm.state.value.offers.size)
        assertEquals("175000.01", vm.state.value.offers.last().amount.toPlainString())
    }

    @Test fun overlapNeedsReviewAndRescheduleRejectsStaleOriginal() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        val original = vm.state.value.viewings.first()
        val key = BookingIdentity().forIntent("booking").key
        vm.schedule("demo-p1", "demo-b1", original.at, "Entrance", "", intentKey = key)
        advanceUntilIdle()
        assertEquals(2, vm.state.value.viewings.size)
        assertNotNull(vm.state.value.error)
        vm.schedule("demo-p1", "demo-b1", original.at, "Entrance", "", intentKey = key, confirmOverlap = true)
        advanceUntilIdle()
        vm.schedule("demo-p1", "demo-b1", original.at, "Entrance", "", intentKey = key, confirmOverlap = true)
        advanceUntilIdle()
        assertEquals(3, vm.state.value.viewings.size)
        val before = vm.state.value.viewings
        vm.schedule(original.propertyId, original.buyerId, original.at.plusSeconds(7200), "Entrance", "",
            viewingId = original.id, expectedAt = original.at.minusSeconds(1))
        advanceUntilIdle()
        assertEquals(before, vm.state.value.viewings)
    }

    @Test fun requirementsSaveAllFieldsWithoutBinaryConversion() = runTest(dispatcher) {
        val vm = EstateDemoViewModel()
        vm.updateRequirements("demo-b1", RequirementsDraft("100000.01", "250000.99", "Highlands, Greendale",
            "Townhouse", "3", "2", "Solar backup", "Quiet street"))
        advanceUntilIdle()
        val row = vm.state.value.buyers.first()
        assertEquals("100000.01", row.budgetMin!!.toPlainString())
        assertEquals("250000.99", row.budget!!.toPlainString())
        assertEquals(2, row.bathrooms); assertEquals("Solar backup", row.features)
        assertEquals("Quiet street", row.requirementsNotes)
        vm.updateRequirements("demo-b1", RequirementsDraft())
        advanceUntilIdle()
        assertNull(vm.state.value.buyers.first().budget)
        assertNull(vm.state.value.buyers.first().bedrooms)
    }
}
