package com.segmiq.sales.realestate

import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.estate.*
import com.segmiq.sales.core.network.*
import com.segmiq.sales.live.*
import com.segmiq.sales.features.realestate.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.*
import okhttp3.mockwebserver.MockWebServer
import org.junit.*
import org.junit.Assert.*
import java.math.BigDecimal
import java.time.*
import java.util.concurrent.Executors

/** All acceptance evidence, IDs, data and hosts are synthetic. No production acceptance is implied. */
@OptIn(ExperimentalCoroutinesApi::class)
class EstateContractTest {
    private val server = MockWebServer()
    private val main = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
    @Before fun setup() { server.start(); Dispatchers.setMain(main) }
    @After fun cleanup() { server.shutdown(); Dispatchers.resetMain(); main.close() }
    private fun workspace(experience: String = "REAL_ESTATE", revision: String = "synthetic-reviewed-release"): LiveWorkspace {
        val mods = listOf("LISTINGS", "BUYERS", "VIEWINGS", "INTRODUCTIONS", "OFFERS", "TRANSACTIONS", "TASKS", "CALENDAR")
        val b = bootstrap("experience" to experience, "modules" to mods)
        return LiveWorkspace.from(b.copy(release = BackendRelease(1, revision),
            navigation = b.navigation.copy(destinations = mods.map { NavDestination(it, it) }),
            capabilities = b.capabilities.copy(featureFlags = b.capabilities.featureFlags.copy(
                realEstatePropertiesRead = true, realEstateBuyerSearchRead = true, realEstateViewingsRead = true,
                realEstateViewingsWrite = true, realEstateOffers = true, realEstateTransactionsRead = true,
                realEstateTransactionsWrite = true, realEstateIntroductions = true, salespersonCalendarRead = true))))
    }
    private fun repository(accepted: Boolean = true, w: LiveWorkspace = workspace()): EstateRepository {
        val http = server.http(TokenProvider { Fake.TOKEN })
        val url = server.config().baseUrl
        val evidence = if (accepted) listOf(EstateAcceptance("${url.scheme}://${url.host}:${url.port}",
            "synthetic-reviewed-release", EstateResource.entries.toSet(), EstateResource.entries.toSet())) else emptyList()
        return EstateRepository(http, w, EstateAccess(w, url, evidence))
    }
    @Test fun fullRequirementsPatchUsesActualStoredFieldsAndExactAmounts() = runBlocking {
        server.enqueue(json("""{"search":{"id":"search-1","client_id":"${Fake.ORG}","budget_min":100000.01,"budget_max":200000.99,"other_requirements":"Quiet street","features":"Solar backup","bathrooms":2}}"""))
        val response = repository().updateRequirements("search-1", BigDecimal("100000.01"), BigDecimal("200000.99"),
            listOf("Highlands"), 3, BuyerRequirementDetails("Townhouse", 2, "Solar backup", "Quiet street")).valueOrNull()!!
        assertEquals("Quiet street", response.search.notes)
        assertEquals("Solar backup", response.search.features)
        val request = server.next()
        assertEquals("PATCH", request.method)
        val body = request.body.readUtf8()
        assertTrue(body.contains("100000.01")); assertTrue(body.contains("200000.99"))
        assertTrue(body.contains("\"propertyType\":\"Townhouse\"")); assertTrue(body.contains("\"bathrooms\":2"))
        assertFalse(body.contains("expected_updated_at"))
    }

    @Test fun acceptedOfferLookupUsesOnlyAuthorisedFeedAndClearsAfterRevocation() = runBlocking {
        server.enqueue(json("""{"offer":{"id":"offer-1","client_id":"${Fake.ORG}","listing_id":"property-1","status":"accepted","currency":"USD","updated_at":"2026-10-31T09:00:00Z"}}"""))
        val vm = EstateServerViewModel(repository(), EstateLink(EstateResource.OFFERS, "offer-1"))
        withTimeout(5000) { vm.state.first { it.page?.offer != null } }
        server.next()
        server.enqueue(json("""{"rows":[{"id":"transaction-1","listingId":"property-1","propertyLabel":"Synthetic property","offerId":"offer-1","status":"in_progress","statusLabel":"In progress","agreedPrice":170000.01,"currency":"USD","milestonesDone":0,"milestonesTotal":1}],"listCompleteness":{"bounded":true,"exhaustive":false}}"""))
        vm.findLinkedTransactions()
        withTimeout(5000) { vm.transactionLookup.first { it.checked } }
        assertEquals("transaction-1", vm.transactionLookup.value.records.single().id)
        assertEquals("GET", server.next().method)
        server.enqueue(json("""{"rows":[],"listCompleteness":{"bounded":true,"exhaustive":false}}"""))
        vm.findLinkedTransactions()
        withTimeout(5000) { vm.transactionLookup.first { it.checked } }
        assertTrue(vm.transactionLookup.value.records.isEmpty())
        server.next()
        server.enqueue(json("""{"error":"Forbidden","code":"FORBIDDEN"}""", 403))
        vm.load()
        withTimeout(5000) { vm.state.first { it.error != null } }
        assertNull(vm.state.value.page)
        assertTrue(vm.transactionLookup.value.records.isEmpty())
        server.next()
        assertEquals(4, server.requestCount)
    }

    @Test fun flagsAndRevisionNeverUnlockUnattestedProductionRequests() = runBlocking {
        val repo = repository(false)
        assertTrue(repo.properties() is ApiResult.Failure)
        assertTrue(repo.buyers() is ApiResult.Failure)
        assertTrue(repo.viewings() is ApiResult.Failure)
        assertTrue(repo.introductions() is ApiResult.Failure)
        assertTrue(repo.offers() is ApiResult.Failure)
        assertTrue(repo.transactions() is ApiResult.Failure)
        assertTrue(repo.calendar(Instant.now(), Instant.now().plusSeconds(3600)) is ApiResult.Failure)
        assertEquals(0, server.requestCount)
        assertTrue(acceptedEstateReleases.none { it.writes.isNotEmpty() || it.privateImageHost != null })
        assertTrue(acceptedEstateReleases.none { it.origin == "${server.config().baseUrl.scheme}://${server.config().baseUrl.host}:${server.config().baseUrl.port}" })
    }
    @Test fun productionReadReleaseMatchesObservedRevisionAndFailsClosed() {
        val release = acceptedEstateReleases.single()
        assertEquals("https://www.segmiq.com:443", release.origin)
        assertEquals("7e743eb43fd2995636c8b2f7133d606a1d2c3cb6", release.revision)
        assertEquals(setOf("SALESPERSON"), release.roles)
        assertEquals(setOf(EstateResource.PROPERTIES, EstateResource.BUYERS, EstateResource.VIEWINGS,
            EstateResource.INTRODUCTIONS, EstateResource.OFFERS, EstateResource.TRANSACTIONS, EstateResource.CALENDAR), release.reads)
        val url = okhttp3.HttpUrl.Builder().scheme("https").host("www.segmiq.com").build()
        val seller = workspace(revision = release.revision)
        val open = EstateAccess(seller, url)
        for (resource in release.reads) {
            assertNull(open.reason(resource))
            assertNotNull(open.reason(resource, write = true))
        }
        assertNotNull(open.reason(EstateResource.COMPLIANCE))
        assertNull(open.imageHost())
        val manager = LiveWorkspace.from(seller.bootstrap.copy(user = seller.bootstrap.user.copy(role = "CLIENT_MANAGER")))
        assertNotNull(EstateAccess(manager, url).reason(EstateResource.PROPERTIES))
        assertNotNull(EstateAccess(workspace(revision = "ebe1a5807fbaa5c2dd125f6fa779751b5031e0c0"), url).reason(EstateResource.PROPERTIES))
        val staging = okhttp3.HttpUrl.Builder().scheme("https").host("staging.segmiq.com").build()
        assertNotNull(EstateAccess(seller, staging).reason(EstateResource.PROPERTIES))
        assertNotNull(EstateAccess(workspace("SOLAR", release.revision), url).reason(EstateResource.PROPERTIES))
        assertNotNull(EstateAccess(workspace("GENERAL", release.revision), url).reason(EstateResource.PROPERTIES))
    }
    @Test fun solarAndGeneralCannotUseEstateAdaptersEvenWithSyntheticAcceptance() = runBlocking {
        for (experience in listOf("GENERAL", "SOLAR"))
            assertTrue(repository(w = workspace(experience)).properties() is ApiResult.Failure)
        assertEquals(0, server.requestCount)
    }
    @Test fun releaseRevisionMustMatchReviewedOrigin() = runBlocking {
        assertTrue(repository(w = workspace(revision = "different-release")).properties() is ApiResult.Failure)
        assertEquals(0, server.requestCount)
    }
    @Test fun listingSearchPagingBearerAndExactDecimal() = runBlocking {
        server.enqueue(json("""{"listings":[{"id":"property-1","client_id":"${Fake.ORG}","price":123456789012345.67,"bedrooms":null}],"page":2,"limit":20,"total":41}"""))
        val response = repository().properties("Borrowdale & garden", 2).valueOrNull()!!
        assertEquals(BigDecimal("123456789012345.67"), response.listings.single().price)
        assertNull(response.listings.single().bedrooms)
        val request = server.next()
        assertEquals("Bearer ${Fake.TOKEN}", request.getHeader("Authorization"))
        assertEquals("2", request.requestUrl!!.queryParameter("page"))
        assertEquals("Borrowdale & garden", request.requestUrl!!.queryParameter("q"))
        assertEquals("/api/clients/${Fake.ORG}/listings", request.requestUrl!!.encodedPath)
    }
    @Test fun propertyStatusFilterIsSentOnlyWhenSelected() = runBlocking {
        server.enqueue(json("""{"listings":[],"page":1,"limit":20,"total":0}"""))
        assertTrue(repository().properties(status = "available") is ApiResult.Success)
        assertEquals("available", server.next().requestUrl!!.queryParameter("status"))
        server.enqueue(json("""{"listings":[],"page":1,"limit":20,"total":0}"""))
        assertTrue(repository().properties() is ApiResult.Success)
        assertNull(server.next().requestUrl!!.queryParameter("status"))
    }
    @Test fun foreignTenantListAndMismatchedDetailFailClosed() = runBlocking {
        server.enqueue(json("""{"listings":[{"id":"p","client_id":"foreign"}],"page":1,"limit":20,"total":1}"""))
        assertEquals(ErrorKind.FORBIDDEN, repository().properties().errorOrNull()!!.kind)
        server.enqueue(json("""{"listing":{"id":"different","client_id":"${Fake.ORG}"}}"""))
        assertEquals(ErrorKind.FORBIDDEN, repository().property("requested").errorOrNull()!!.kind)
    }
    @Test fun buyerPrivacyDoesNotInventContactOrBudget() = runBlocking {
        server.enqueue(json("""{"searches":[{"id":"s","contact_name":null,"phone":null,"budget_max":null}],"page":1,"pageSize":25,"total":1}"""))
        val buyer = repository().buyers().valueOrNull()!!.searches.single()
        assertNull(buyer.contact_name); assertNull(buyer.phone); assertNull(buyer.budget_max)
    }
    @Test fun matchingUsesSearchIdAndServerExplanation() = runBlocking {
        server.enqueue(json("""{"matches":[{"listingId":"p","reasons":["Within budget"],"strength":"strong","listing":{"id":"p","client_id":"${Fake.ORG}"}}],"incomplete":true}"""))
        val feed = repository().matches("search-1").valueOrNull()!!
        assertTrue(feed.incomplete); assertEquals(listOf("Within budget"), feed.matches.single().reasons)
        assertEquals("search-1", server.next().requestUrl!!.queryParameter("searchId"))
    }
    @Test fun deniedDetailNeverTriggersRelatedPrivateEndpoint() = runBlocking {
        server.enqueue(json("""{"error":"Forbidden","code":"PRIVATE_BUYER"}""", 403))
        assertEquals(ErrorKind.FORBIDDEN, repository().buyer("private-search").errorOrNull()!!.kind)
        assertEquals(1, server.requestCount)
    }
    @Test fun revokedRefreshClearsPrivateScreenContent() = runBlocking {
        server.enqueue(json("""{"listing":{"id":"p","client_id":"${Fake.ORG}","address":"Synthetic listing"}}"""))
        val vm = EstateServerViewModel(repository(), EstateLink(EstateResource.PROPERTIES, "p"))
        withTimeout(10000) { vm.state.first { it.page != null } }
        server.enqueue(json("""{"error":"Forbidden"}""", 403)); vm.load()
        val result = withTimeout(10000) { vm.state.first { it.error != null } }
        assertNull(result.page); assertFalse(result.loading)
    }
    @Test fun ownIntroductionCannotBeApprovedNoRequestMade() = runBlocking {
        val own = IntroductionDto("i", "requested", "p", "Property", "s", "2026-10-31T09:00:00Z",
            requestingAgentName = "Synthetic agent", canApprove = true, ownRequest = true)
        try { repository().reviewIntroduction(own, "accepted", ""); fail("Self-decision must be rejected") }
        catch (_: IllegalArgumentException) { }
        assertEquals(0, server.requestCount)
    }
    @Test fun staleIntroductionDecisionIsNotRetried() = runBlocking {
        server.enqueue(json("""{"error":"Decision already recorded"}""", 409))
        val row = IntroductionDto("i", "requested", "p", "Property", "s", "2026-10-31T09:00:00Z",
            requestingAgentName = "Synthetic agent", canApprove = true, ownRequest = false)
        assertEquals(ErrorKind.CONFLICT, repository().reviewIntroduction(row, "accepted", "").errorOrNull()!!.kind)
        assertEquals(1, server.requestCount)
        assertEquals("review_introduction", SegmiqJson.parseToJsonElement(server.next().body.readUtf8()).toString().let {
            if (it.contains("review_introduction")) "review_introduction" else ""
        })
    }
    @Test fun schedulingCarriesStableKeyAndDoesNotUseLegacyWebRoute() = runBlocking {
        server.enqueue(json("""{"ok":true,"viewing":{"id":"created-viewing","buyer_search_id":"11111111-1111-1111-1111-111111111111","scheduled_at":"2099-01-01T10:00:00Z"},"notificationEffects":{"customerNotification":"NOT_REQUESTED","provider":null}}""", 201))
        val result = repository().scheduleViewing("11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222", Instant.parse("2099-01-01T10:00:00Z"),
            "Meet at entrance", "stable-key-123", false)
        assertEquals("NOT_REQUESTED", result.valueOrNull()!!.notificationEffects!!.customerNotification)
        assertEquals("created-viewing", result.valueOrNull()!!.viewing!!.id)
        val request = server.next()
        assertEquals("stable-key-123", request.getHeader("Idempotency-Key"))
        assertEquals("/api/clients/${Fake.ORG}/buyer-sales/actions", request.requestUrl!!.encodedPath)
        assertTrue(request.body.readUtf8().contains("Meet at entrance"))
    }
    @Test fun expiredTimeAndInvalidBudgetDoNotMutate() = runBlocking {
        try { repository().scheduleViewing("s", "p", Instant.EPOCH, "", "stable-key", false); fail() }
        catch (_: IllegalArgumentException) { }
        try { repository().updateRequirements("s", BigDecimal("20"), BigDecimal("10"), listOf("Highlands"), 3); fail() }
        catch (_: IllegalArgumentException) { }
        assertEquals(0, server.requestCount)
    }
    @Test fun calendarPreservesDateOnlyTimezoneAndViewingIdentity() {
        val e = CalendarEventDto("task:f", "followup", "Synthetic follow-up", allDay = true,
            date = "2026-11-01", timezone = "Africa/Harare", relatedEntity = CalendarEntityDto("lead", "lead-id"))
        assertEquals("2026-11-01 · All day", eventTime(e, ZoneId.of("Pacific/Honolulu")))
        assertEquals("live/lead/lead-id", eventLink(e)!!.sharedRoute)
        val v = e.copy(id = "viewing:v", allDay = false, startAt = "2026-10-31T22:30:00Z",
            relatedEntity = CalendarEntityDto("viewing", "viewing-id"))
        assertEquals("00:30", eventTime(v, ZoneId.of("Africa/Harare")))
        assertEquals("viewing-id", eventLink(v)!!.id)
    }
    @Test fun financialDecisionUsesRevisionAndDoesNotRetryConflict() = runBlocking {
        server.enqueue(json("""{"error":"Stale offer revision"}""", 409))
        val row = OfferSnapshotDto("o", Fake.ORG, "p", currency = "USD", status = "submitted",
            updated_at = "2026-10-31T09:00:00Z", permittedActions = listOf("accept"))
        assertEquals(ErrorKind.CONFLICT, repository().mutateOffer(row, "accept").errorOrNull()!!.kind)
        assertEquals(1, server.requestCount)
        val body = server.next().body.readUtf8()
        assertTrue(body.contains("\"expected_updated_at\":\"2026-10-31T09:00:00Z\""))
        assertTrue(body.contains("\"action\":\"accept\""))
    }
    @Test fun unpermittedFinancialDecisionNeverLeavesDevice() = runBlocking {
        val row = OfferSnapshotDto("o", Fake.ORG, "p", currency = "USD", status = "submitted",
            updated_at = "2026-10-31T09:00:00Z")
        try { repository().mutateOffer(row, "accept"); fail("Action must be server-permitted") }
        catch (_: IllegalArgumentException) { }
        assertEquals(0, server.requestCount)
    }
    @Test fun financialAndDocumentOperationsStayUnavailableWithoutWriteAcceptance() = runBlocking {
        val row = OfferSnapshotDto("o", Fake.ORG, "p", currency = "USD", status = "submitted",
            updated_at = "2026-10-31T09:00:00Z", permittedActions = listOf("accept"))
        assertTrue(repository(false).mutateOffer(row, "accept") is ApiResult.Failure)
        assertEquals(0, server.requestCount)
    }
    @Test fun unexpectedPrivateFieldsInListingOnlyViewingAreRejected() = runBlocking {
        server.enqueue(json("""{"viewing":{"id":"v","listing_id":"p","access":"listing_only","scheduled_at":"2099-01-01T09:00:00Z","status":"scheduled","contact":{"id":"private","name":"Must not display"}},"timezone":"Africa/Harare"}"""))
        assertEquals(ErrorKind.FORBIDDEN, repository().viewing("v").errorOrNull()!!.kind)
    }
    @Test fun viewingOverlapIsExplicitAndNeverAutomaticallyConfirmed() = runBlocking {
        server.enqueue(json("""{"error":"Viewing overlaps another appointment","warning":"Overlap"}""", 409))
        val result = repository().scheduleViewing("11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222", Instant.parse("2099-01-01T10:00:00Z"), "",
            "same-booking-key", false)
        assertEquals(ErrorKind.CONFLICT, result.errorOrNull()!!.kind)
        assertEquals(1, server.requestCount)
        assertTrue(server.next().body.readUtf8().contains("confirmOverlap"))
    }
    @Test fun pendingOfferDecisionIsNotOptimisticAndDuplicateTapDoesNotSubmitTwice() = runBlocking {
        server.enqueue(json("""{"offer":{"id":"o","client_id":"${Fake.ORG}","listing_id":"p","currency":"USD","status":"submitted","updated_at":"2026-10-31T09:00:00Z","permittedActions":["accept"]}}"""))
        val vm = EstateServerViewModel(repository(), EstateLink(EstateResource.OFFERS, "o"))
        withTimeout(10000) { vm.state.first { it.page?.offer != null } }
        server.enqueue(json("""{"error":"Stale revision"}""", 409).setBodyDelay(300, java.util.concurrent.TimeUnit.MILLISECONDS))
        vm.offerAction("accept", null, ""); vm.offerAction("accept", null, "")
        assertTrue(vm.state.value.pending)
        assertEquals("submitted", vm.state.value.page!!.offer!!.status)
        assertFalse(vm.state.value.saved)
        val conflict = withTimeout(10000) { vm.state.first { it.error != null } }
        assertEquals(ErrorKind.CONFLICT, conflict.error!!.kind)
        assertFalse(conflict.saved); assertNull(conflict.page)
        assertEquals(2, server.requestCount)
    }
    @Test fun approvalForAnotherOriginCannotUnlockTheTransport() = runBlocking {
        val w = workspace()
        val wrongOrigin = okhttp3.HttpUrl.Builder().scheme("https").host("different.example.test").build()
        val approved = EstateAcceptance("https://different.example.test:443", "synthetic-reviewed-release", EstateResource.entries.toSet())
        val access = EstateAccess(w, wrongOrigin, listOf(approved))
        val repo = EstateRepository(server.http(TokenProvider { Fake.TOKEN }), w, access)
        assertTrue(repo.properties() is ApiResult.Failure)
        assertEquals(0, server.requestCount)
    }
    @Test fun traversalAndDemoIdentifiersAreRejectedBeforeNetwork() = runBlocking {
        for (id in listOf(".", "..", "foreign/id", "%2e%2e", "demo-p1")) {
            try { repository().property(id); fail("Unsafe identifier must fail locally") }
            catch (_: IllegalArgumentException) { }
        }
        assertEquals(0, server.requestCount)
    }
    @Test fun protectedUiKeySurvivesRecreationButChangesWithScopeAndPermissions() {
        val w = workspace()
        assertEquals(repository(w = w).stateKey, repository(w = w).stateKey)
        val denied = LiveWorkspace.from(w.bootstrap.copy(capabilities = w.bootstrap.capabilities.copy(
            featureFlags = w.bootstrap.capabilities.featureFlags.copy(realEstatePropertiesRead = false))))
        val other = LiveWorkspace.from(w.bootstrap.copy(organisation = w.bootstrap.organisation.copy(id = "other-tenant")))
        assertNotEquals(repository(w = w).stateKey, repository(w = denied).stateKey)
        assertNotEquals(repository(w = w).stateKey, repository(w = other).stateKey)
        assertEquals(0, server.requestCount)
    }
    @Test fun unknownAccessDecisionsAndRolesFailClosedEvenOnAnAcceptedRevision() = runBlocking {
        val b = workspace().bootstrap
        val unknownSubscription = LiveWorkspace.from(b.copy(subscription = b.subscription.copy(salesAccess = "UNKNOWN")))
        val unknownOperations = LiveWorkspace.from(b.copy(capabilities = b.capabilities.copy(
            restrictions = b.capabilities.restrictions.copy(salesOperations = "UNKNOWN"))))
        val unknownRole = LiveWorkspace.from(b.copy(user = b.user.copy(role = "UNSUPPORTED")))
        for (w in listOf(unknownSubscription, unknownOperations, unknownRole))
            assertTrue(repository(w = w).properties() is ApiResult.Failure)
        assertEquals(0, server.requestCount)
    }
    @Test fun storedInternalNotesDecodeWithoutReplacingThemWithEmptyDrafts() {
        val offer = SegmiqJson.decodeFromString(OfferDetailDto.serializer(),
            """{"offer":{"id":"o","listing_id":"p","currency":"USD","status":"submitted","updated_at":"2026-10-31T09:00:00Z","internal_notes":"Existing offer note"}}""")
        val transaction = SegmiqJson.decodeFromString(TransactionDetailDto.serializer(),
            """{"transaction":{"id":"t","listing_id":"p","status":"in_progress","updated_at":"2026-10-31T09:00:00Z","internal_notes":"Existing transaction note"}}""")
        assertEquals("Existing offer note", offer.offer.notes)
        assertEquals("Existing transaction note", transaction.transaction.notes)
    }
    @Test fun noPrivateImagesRequestedWithoutStorageAcceptance() = runBlocking {
        assertTrue(repository().image("p", 0) is ApiResult.Failure)
        assertEquals(0, server.requestCount)
    }

    @Test fun listingOfferAndIntroductionWritesStayClosedWithoutAcceptance() = runBlocking {
        val closed = repository(false)
        val listing = "11111111-1111-1111-1111-111111111111"
        val contact = "22222222-2222-2222-2222-222222222222"
        assertTrue(closed.createListing("sale", "1 Test Street", null, null, BigDecimal("10.50"), null, null, null, null) is ApiResult.Failure)
        assertTrue(closed.createOffer(listing, contact, null, BigDecimal("10.50"), "USD", null, null, false) is ApiResult.Failure)
        assertTrue(closed.requestIntroduction(listing, contact) is ApiResult.Failure)
        assertEquals(0, server.requestCount)
    }

    @Test fun acceptedSyntheticWritesSendExactDecimalsAndNoAssignment() = runBlocking {
        val listing = "11111111-1111-1111-1111-111111111111"
        val contact = "22222222-2222-2222-2222-222222222222"
        val search = "33333333-3333-3333-3333-333333333333"
        server.enqueue(json("""{"listing":{"id":"$listing"}}"""))
        assertEquals(listing, repository().createListing("sale", "1 Test Street", "Hill", null, BigDecimal("1500000.50"), 3, 2, null, "house").valueOrNull()?.listing?.id)
        val created = server.next().body.readUtf8()
        assertTrue(created.contains("1500000.50"))
        assertFalse(created.contains("agent_id"))
        assertFalse(created.contains("approval_status"))
        server.enqueue(json("""{"offer":{"id":"$contact"}}"""))
        assertEquals(contact, repository().createOffer(listing, contact, search, BigDecimal("99.01"), "USD", "Subject to inspection", null, false).valueOrNull()?.offer?.id)
        val offer = server.next().body.readUtf8()
        assertTrue(offer.contains("99.01"))
        assertTrue(offer.contains("\"submit\":false"))
        server.enqueue(json("""{"ok":true,"introduction":{"id":"$search"}}"""))
        assertEquals(search, repository().requestIntroduction(listing, search).valueOrNull()?.introduction?.id)
        assertTrue(server.next().body.readUtf8().contains("\"action\":\"introduction\""))
    }

    @Test fun viewingOverlapConfirmationIsExplicit() = runBlocking {
        val search = "11111111-1111-1111-1111-111111111111"
        val listing = "22222222-2222-2222-2222-222222222222"
        server.enqueue(json("""{"ok":true}"""))
        repository().scheduleViewing(search, listing, Instant.parse("2099-01-01T10:00:00Z"), "Gate", "idem-key-1", true)
        val request = server.next()
        assertTrue(request.body.readUtf8().contains("\"confirmOverlap\":true"))
        assertEquals("idem-key-1", request.getHeader("Idempotency-Key"))
    }
}
