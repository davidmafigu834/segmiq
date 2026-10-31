package com.segmiq.sales

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import com.segmiq.sales.core.bootstrap.*
import com.segmiq.sales.core.estate.*
import com.segmiq.sales.core.network.*
import com.segmiq.sales.features.realestate.*
import com.segmiq.sales.ui.theme.SegmiQSalesTheme
import okhttp3.mockwebserver.*
import org.junit.*
import org.junit.Assert.*
import java.util.concurrent.CopyOnWriteArrayList

/** Real Compose/HTTP rendering, synthetic API responses only. Not live verification. */
class EstateServerUiTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = MockWebServer()
    private val requests = CopyOnWriteArrayList<RecordedRequest>()
    @After fun stop() = server.shutdown()

    @Test fun nativeBuyerMatchingJourneyBackStackReturnsThroughEachParent() {
        val listing = """{"id":"nav-property","client_id":"nav-org","address":"Navigation property","status":"available","images":[]}"""
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                requests.add(request)
                val path = request.requestUrl!!.encodedPath
                val body = when {
                    path == "/api/sales/dashboard" -> """{"commercial":{"newEnquiriesToday":1}}"""
                    path == "/api/sales/dashboard/workspace" -> """{"greetingPart":"morning","actions":[]}"""
                    path == "/api/sales/tasks" -> """{"tasks":[]}"""
                    path.endsWith("/buyer-searches") -> """{"searches":[{"id":"nav-search","contact_name":"Navigation buyer","status":"active"}],"page":1,"pageSize":25,"total":1}"""
                    path.endsWith("/buyer-searches/nav-search") -> """{"search":{"id":"nav-search","contact_name":"Navigation buyer","status":"active"}}"""
                    path.endsWith("/matching") -> """{"matches":[{"listingId":"nav-property","listing":$listing,"reasons":["Recorded requirements"],"strength":"strong"}]}"""
                    path.endsWith("/listings/nav-property") -> """{"listing":$listing}"""
                    else -> return MockResponse().setResponseCode(404).setHeader("Content-Type","application/json").setBody("""{"error":"Not found"}""")
                }
                return MockResponse().setHeader("Content-Type","application/json").setBody(body)
            }
        }
        server.start()
        val mods = listOf("LISTINGS","BUYERS","TASKS")
        val w = LiveWorkspace.from(SalesAppBootstrap(1, release = BackendRelease(1,"synthetic-nav"),
            user = BootstrapUser("nav-agent","Navigation Agent","SALESPERSON"),
            organisation = BootstrapOrganisation("nav-org","Synthetic navigation agency"), subscription = BootstrapSubscription(),
            experience = BootstrapExperience("REAL_ESTATE"),
            capabilities = BootstrapCapabilities(mods, featureFlags = FeatureFlags(realEstateWorkflow = true,
                realEstatePropertiesRead = true, realEstateBuyerSearchRead = true)),
            navigation = BootstrapNavigation(destinations = mods.map { NavDestination(it,it) }),
            salesConfiguration = SalesConfiguration()))
        val url = server.url("/")
        val http = SegmiqHttp(ApiConfig(url,"Synthetic-navigation"), TokenProvider { "synthetic-token" })
        val repository = EstateRepository(http, w, EstateAccess(w,url,listOf(EstateAcceptance(
            "${url.scheme}://${url.host}:${url.port}","synthetic-nav",setOf(EstateResource.PROPERTIES,EstateResource.BUYERS)))))
        compose.setContent { SegmiQSalesTheme {
            com.segmiq.sales.features.live.LiveSalesWorkspace(w, com.segmiq.sales.core.live.LiveSalesApi(http),
                com.segmiq.sales.core.live.ScopedCache(), kotlinx.coroutines.flow.MutableStateFlow(true), {}, repository)
        } }
        compose.onNodeWithText("Buyers").performClick()
        compose.waitUntil(15000) { compose.onAllNodesWithText("Navigation buyer").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Navigation buyer").performClick()
        compose.waitUntil(15000) { compose.onAllNodesWithText("Matching properties").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("estate-server-list").performScrollToNode(hasText("Matching properties"))
        compose.onNodeWithText("Matching properties").performClick()
        compose.waitUntil(15000) { compose.onAllNodesWithText("Navigation property").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("estate-server-list").performScrollToNode(hasText("Navigation property"))
        compose.onNodeWithText("Navigation property").performClick()
        compose.waitUntil(15000) { compose.onAllNodesWithText("Navigation property").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("estate-server-list").performScrollToNode(hasText("Return to buyer requirements"))
        compose.onNodeWithText("Return to buyer requirements").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithTag("estate-server-list").performScrollToIndex(0)
        compose.onNodeWithText("Matching properties").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithTag("estate-server-list").performScrollToIndex(0)
        compose.onNodeWithText("Navigation buyer").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithTag("estate-server-list").performScrollToIndex(0)
        compose.onNodeWithText("Buyers & tenants").assertIsDisplayed()
        compose.onNodeWithContentDescription("Primary navigation").assertExists()
        assertTrue(requests.all { it.method == "GET" })
    }

    @Test fun typedServerScreensRenderAndKeepBuyerContextWithoutExposingRedactedFields() {
        val qaViewingAt = java.time.LocalDate.now(java.time.ZoneId.of("Africa/Harare")).atTime(16, 0)
            .atZone(java.time.ZoneId.of("Africa/Harare")).toInstant().toString()
        val property = """{"id":"qa-property","client_id":"qa-org","address":"Synthetic Borrowdale property","suburb":"Borrowdale","price":175000.50,"bedrooms":3,"bathrooms":2,"size_sqm":240,"status":"available","images":[],"description":"Synthetic API listing for Android verification."}"""
        val buyer = """{"id":"qa-search","contact_name":"Synthetic buyer","budget_min":150000,"budget_max":200000,"currency":"USD","locations":["Borrowdale"],"intent":"purchase","bedrooms":3,"status":"active"}"""
        val viewing = """{"id":"qa-viewing","listing_id":"qa-property","access":"listing_only","scheduled_at":"$qaViewingAt","status":"scheduled","listing":$property,"permittedActions":[]}"""
        val intro = """{"id":"qa-introduction","status":"requested","listingId":"qa-property","listingLabel":"Synthetic Borrowdale property","searchId":"qa-search","createdAt":"2026-10-31T09:00:00Z","requestingAgentName":"Synthetic agent","responsibleAgentName":"Review agent","requirementsSummary":"Three-bedroom property","ownRequest":true,"canApprove":false,"canDecline":false,"contactName":null,"phone":null}"""
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                requests.add(request)
                val path = request.requestUrl!!.encodedPath
                if (request.requestUrl!!.queryParameter("q") == "none")
                    return MockResponse().setHeader("Content-Type","application/json")
                        .setBody("""{"listings":[],"page":1,"limit":20,"total":0}""")
                if (request.requestUrl!!.queryParameter("q") == "failure")
                    return MockResponse().setResponseCode(503).setHeader("Content-Type","application/json")
                        .setBody("""{"error":"Sensitive SQL service details must not appear"}""")
                val body = when {
                    path.endsWith("/listings/qa-property") -> """{"listing":$property}"""
                    path.endsWith("/listings") -> """{"listings":[$property],"page":1,"limit":20,"total":1}"""
                    path.endsWith("/buyer-searches/qa-search") -> """{"search":$buyer}"""
                    path.endsWith("/buyer-searches") -> """{"searches":[$buyer],"page":1,"pageSize":25,"total":1}"""
                    path.endsWith("/matching") -> """{"matches":[{"listingId":"qa-property","listing":$property,"reasons":["Within the recorded budget"],"strength":"strong"}]}"""
                    path.endsWith("/viewings/qa-viewing") -> """{"viewing":$viewing,"timezone":"Africa/Harare"}"""
                    path.endsWith("/viewings") -> """{"viewings":[$viewing],"timezone":"Africa/Harare","page":1,"limit":40,"total":1,"incomplete":false}"""
                    path.endsWith("/introductions/qa-introduction") -> """{"introduction":$intro}"""
                    path.endsWith("/introductions") -> """{"items":[$intro]}"""
                    path.endsWith("/offers/qa-offer") -> """{"offer":{"id":"qa-offer","client_id":"qa-org","listing_id":"qa-property","current_offer_amount":170000.25,"currency":"USD","status":"submitted","updated_at":"2026-10-31T09:00:00Z"},"listing":$property,"events":[{"id":"event-1","label":"Synthetic offer submitted","createdAt":"2026-10-31T09:00:00Z"}]}"""
                    path.endsWith("/offers") -> """{"offers":[{"id":"qa-offer","listingId":"qa-property","propertyLabel":"Synthetic Borrowdale property","currentAmount":170000.25,"currency":"USD","status":"submitted","statusLabel":"Submitted"}],"listCompleteness":{"bounded":true,"sourceLimit":500,"exhaustive":false}}"""
                    path.endsWith("/transactions/qa-transaction") -> """{"transaction":{"id":"qa-transaction","client_id":"qa-org","listing_id":"qa-property","offer_id":"qa-offer","status":"in_progress","updated_at":"2026-10-31T09:00:00Z"},"listing":$property,"milestones":[{"id":"m1","key":"synthetic-server-key","label":"Server-supplied milestone","status":"pending"}]}"""
                    path.endsWith("/transactions") -> """{"rows":[{"id":"qa-transaction","listingId":"qa-property","propertyLabel":"Synthetic Borrowdale property","status":"in_progress","statusLabel":"In progress","agreedPrice":170000.25,"currency":"USD","milestonesDone":0,"milestonesTotal":1}],"listCompleteness":{"bounded":true,"sourceLimit":500,"exhaustive":false}}"""
                    path == "/api/sales/calendar" -> """{"events":[{"id":"viewing:qa-viewing","type":"viewing","title":"Synthetic property viewing","startAt":"$qaViewingAt","allDay":false,"timezone":"Africa/Harare","relatedEntity":{"type":"viewing","id":"qa-viewing"}}],"timezone":"Africa/Harare","page":1,"limit":100,"total":1,"incomplete":true,"standaloneMeetingsSupported":false}"""
                    else -> return MockResponse().setResponseCode(404).setHeader("Content-Type","application/json").setBody("""{"error":"Not found"}""")
                }
                return MockResponse().setHeader("Content-Type", "application/json").setBody(body)
            }
        }
        server.start()
        val mods = listOf("LISTINGS","BUYERS","VIEWINGS","INTRODUCTIONS","OFFERS","TRANSACTIONS","TASKS","CALENDAR")
        val flags = FeatureFlags(realEstateWorkflow = true, realEstatePropertiesRead = true,
            realEstateBuyerSearchRead = true, realEstateViewingsRead = true, realEstateIntroductions = true,
            realEstateOffers = true, realEstateTransactionsRead = true, salespersonCalendarRead = true)
        val workspace = LiveWorkspace.from(SalesAppBootstrap(1,
            release = BackendRelease(1, "synthetic-only"),
            user = BootstrapUser("qa-agent","Synthetic Agent","SALESPERSON"),
            organisation = BootstrapOrganisation("qa-org","Synthetic Agency"), subscription = BootstrapSubscription(),
            experience = BootstrapExperience("REAL_ESTATE"), capabilities = BootstrapCapabilities(mods, featureFlags = flags),
            navigation = BootstrapNavigation(destinations = mods.map { NavDestination(it,it) }),
            salesConfiguration = SalesConfiguration(timeZone = TimeZoneConfig(effective = "Africa/Harare"),
                currency = CurrencyConfig(quotationDefault = "USD"))))
        val url = server.url("/")
        val access = EstateAccess(workspace, url, listOf(EstateAcceptance(
            "${url.scheme}://${url.host}:${url.port}", "synthetic-only", EstateResource.entries.toSet())))
        val repository = EstateRepository(SegmiqHttp(ApiConfig(url,"Synthetic-QA"), TokenProvider { "synthetic-token" }), workspace, access)
        var target by mutableStateOf(EstateLink(EstateResource.PROPERTIES))
        var latest: EstateServerViewModel? = null
        var lastNavigation: String? = null
        compose.setContent { SegmiQSalesTheme {
            Column(Modifier.fillMaxSize().safeDrawingPadding()) {
                Text("SYNTHETIC API · NO LIVE CUSTOMER DATA", Modifier.padding(12.dp), style = MaterialTheme.typography.labelMedium)
                key(target) {
                    val vm = remember { EstateServerViewModel(repository, target) }
                    latest = vm
                    EstateServerScreen(vm) { lastNavigation = it }
                }
            }
        } }
        fun show(link: EstateLink, name: String) {
            compose.runOnIdle { target = link }
            compose.waitUntil(15000) { latest?.target == link && latest?.state?.value?.page != null }
            compose.waitForIdle()
            val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
            savePremiumCapture(compose.activity, name, bitmap)
            bitmap.recycle()
        }
        show(EstateLink(EstateResource.PROPERTIES), "41-api-properties")
        show(EstateLink(EstateResource.PROPERTIES,"qa-property"), "42-api-property-detail")
        show(EstateLink(EstateResource.BUYERS), "43-api-buyers")
        show(EstateLink(EstateResource.BUYERS,"qa-search"), "44-api-buyer-detail")
        compose.onNodeWithText("Matching properties").performScrollTo().performClick()
        assertTrue(lastNavigation!!.contains("buyer=qa-search"))
        show(EstateLink(EstateResource.PROPERTIES,buyerContext="qa-search"), "45-api-matches")
        compose.onNodeWithText("Synthetic Borrowdale property").performClick()
        assertTrue(lastNavigation!!.contains("qa-property?buyer=qa-search"))
        show(EstateLink(EstateResource.VIEWINGS), "46-api-viewings")
        show(EstateLink(EstateResource.VIEWINGS,"qa-viewing"), "47-api-viewing-detail")
        compose.onNodeWithTag("estate-server-list").performScrollToNode(hasText("Buyer details are private."))
        compose.onNodeWithText("Buyer details are private.").assertIsDisplayed()
        show(EstateLink(EstateResource.INTRODUCTIONS), "48-api-introductions")
        show(EstateLink(EstateResource.INTRODUCTIONS,"qa-introduction"), "49-api-introduction-detail")
        compose.onNodeWithText("Review approval").assertDoesNotExist()
        show(EstateLink(EstateResource.OFFERS), "50-api-offers")
        show(EstateLink(EstateResource.OFFERS,"qa-offer"), "51-api-offer-detail")
        show(EstateLink(EstateResource.TRANSACTIONS), "52-api-transactions")
        show(EstateLink(EstateResource.TRANSACTIONS,"qa-transaction"), "53-api-transaction-detail")
        show(EstateLink(EstateResource.CALENDAR), "54-api-calendar")
        compose.onNodeWithContentDescription("Choose date").performClick()
        compose.onNodeWithText("Cancel").assertIsDisplayed().performClick()
        compose.runOnIdle { target = EstateLink(EstateResource.PROPERTIES) }
        compose.waitUntil(15000) { latest?.target == target && latest?.state?.value?.page != null }
        compose.runOnIdle { latest!!.search("none") }
        compose.waitUntil(15000) { latest?.state?.value?.page?.cards?.isEmpty() == true && latest?.state?.value?.loading == false }
        compose.onNodeWithText("No properties").assertExists()
        compose.onRoot().captureToImage().asAndroidBitmap().let { savePremiumCapture(compose.activity, "56-api-empty", it); it.recycle() }
        compose.runOnIdle { latest!!.search("failure") }
        compose.waitUntil(15000) { latest?.state?.value?.error != null }
        compose.onNodeWithText("Sensitive SQL", substring = true).assertDoesNotExist()
        compose.onRoot().captureToImage().asAndroidBitmap().let { savePremiumCapture(compose.activity, "57-api-error", it); it.recycle() }
        assertTrue(requests.all { it.method == "GET" && it.getHeader("Authorization") == "Bearer synthetic-token" })
        assertTrue(requests.none { it.path!!.contains("/images/") })
    }
}
