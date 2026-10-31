package com.segmiq.sales.live

import com.segmiq.sales.core.calling.DialReturnState
import com.segmiq.sales.core.calling.dialReturnAfter
import com.segmiq.sales.core.estate.CalendarEntityDto
import com.segmiq.sales.core.estate.CalendarEventDto
import com.segmiq.sales.core.estate.EstateResource
import com.segmiq.sales.core.inbox.InboxFilter
import com.segmiq.sales.core.inbox.InboxConversationDto
import com.segmiq.sales.core.inbox.SendMessageResult
import com.segmiq.sales.core.inbox.deliveryLabel
import com.segmiq.sales.core.inbox.describeSend
import com.segmiq.sales.core.inbox.inboxVisible
import com.segmiq.sales.core.inbox.messageSide
import com.segmiq.sales.core.inbox.notificationDestination
import com.segmiq.sales.core.live.CopilotAction
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.live.WorkItemResponse
import com.segmiq.sales.core.live.presentCopilot
import com.segmiq.sales.core.network.ApiResult
import com.segmiq.sales.core.network.ErrorKind
import com.segmiq.sales.core.network.ErrorMapper
import com.segmiq.sales.core.network.SegmiqJson
import com.segmiq.sales.core.network.TokenProvider
import com.segmiq.sales.features.auth.loginUsesCompactLayout
import com.segmiq.sales.features.live.ModulePresence
import com.segmiq.sales.features.live.modulePresence
import com.segmiq.sales.features.live.moduleStatusLine
import com.segmiq.sales.features.realestate.eventLink
import com.segmiq.sales.features.realestate.revealedPhone
import com.segmiq.sales.core.bootstrap.LiveModule
import com.segmiq.sales.core.bootstrap.LiveWorkspace
import com.segmiq.sales.core.estate.EstateAccess
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test

class CompletionSprintTest {
    @Test fun copilotSimulationIsNeverAConfirmedAction() {
        val simulated = presentCopilot(CopilotAction.APPROVE, WorkItemResponse(simulated = true, notice = "Preview only"))
        assertTrue(simulated.simulated)
        assertTrue(simulated.headline.contains("Simulated"))
        assertTrue(simulated.detail!!.contains("Preview only"))
        assertFalse(simulated.headline.contains("Approved on SegmiQ"))
        val real = presentCopilot(CopilotAction.COMPLETE, WorkItemResponse(simulated = false, notice = "Follow-up cleared"))
        assertFalse(real.simulated)
        assertEquals("Completed on SegmiQ.", real.headline)
        assertEquals("Follow-up cleared", real.detail)
    }

    @Test fun callReviewWaitsUntilTheAppWasLeft() {
        val armed = DialReturnState(pending = true)
        assertFalse(dialReturnAfter(armed, "start").review)
        val away = dialReturnAfter(armed, "stop")
        assertTrue(away.leftApp)
        assertFalse(away.review)
        assertTrue(dialReturnAfter(away, "start").review)
        assertFalse(dialReturnAfter(DialReturnState(), "start").review)
    }

    @Test fun loginCompactLayoutKeepsActionsReachable() {
        assertTrue(loginUsesCompactLayout(430, false))
        assertTrue(loginUsesCompactLayout(900, true))
        assertFalse(loginUsesCompactLayout(800, false))
    }

    @Test fun buyerPhoneIsShownOnlyWhenTheServerReturnedIt() {
        assertNull(revealedPhone(null))
        assertNull(revealedPhone("  "))
        assertEquals("+263700000000", revealedPhone(" +263700000000 "))
    }

    @Test fun unknownCalendarEventsDoNotInventADestination() {
        fun event(type: String, id: String = "rec-1") = CalendarEventDto(
            "event-1", "reminder", "Title", "2099-01-01T10:00:00Z", false, null, "Africa/Harare",
            CalendarEntityDto(type, id),
        )
        assertNull(eventLink(event("reminder")))
        assertNull(eventLink(event("demo-task", "demo-1")))
        assertEquals(EstateResource.VIEWINGS, eventLink(event("viewing"))?.resource)
        assertEquals(EstateResource.OFFERS, eventLink(event("offer"))?.resource)
        assertTrue(eventLink(event("lead"))?.sharedRoute.orEmpty().startsWith("live/lead/"))
    }

    @Test fun inboxListAndDeliveryUseOnlyServerFields() {
        val row = SegmiqJson.decodeFromString(InboxConversationDto.serializer(),
            """{"id":"lead-1","name":"Ada","phone":"+263","lastMessage":"Hello","unread":2,"conversationStatus":"OPEN","assignedToId":"user-test-1","extra":true}""")
        assertEquals(2, row.unread)
        assertTrue(inboxVisible(row, InboxFilter.UNREAD, "ada", "user-test-1"))
        assertFalse(inboxVisible(row, InboxFilter.MINE, "", "someone-else"))
        assertEquals("received", messageSide("customer"))
        assertEquals("sent", messageSide("rep"))
        assertNull(deliveryLabel(null))
        assertNull(deliveryLabel("seen-by-agent"))
        assertEquals("Delivered", deliveryLabel("delivered"))
        val simulated = SegmiqJson.decodeFromString(SendMessageResult.serializer(), """{"ok":true,"providerId":"demo-simulated","mode":"session"}""")
        assertTrue(describeSend(simulated.ok, simulated.providerId).contains("not delivered"))
        assertTrue(describeSend(false, null).contains("draft"))
    }

    @Test fun failedSendDoesNotClaimDelivery() = runBlocking {
        val server = MockWebServer()
        server.start()
        try {
            val api = LiveSalesApi(server.http(TokenProvider { Fake.TOKEN }))
            server.enqueue(json("""{"error":"WhatsApp session is closed","code":"SESSION_CLOSED"}""", 502))
            val failed = api.sendInboxMessage("11111111-1111-1111-1111-111111111111", "Hello")
            assertTrue(failed is ApiResult.Failure)
            assertEquals("Hello", server.next().body.readUtf8().let { SegmiqJson.parseToJsonElement(it).toString() }.contains("Hello").let { if (it) "Hello" else "missing" })
            val blocked = api.sendInboxMessage("demo-lead", "Hello")
            assertTrue(blocked is ApiResult.Failure)
            assertEquals(1, server.requestCount)
        } finally { server.shutdown() }
    }

    @Test fun notificationsOpenOnlyKnownRecordsAndStayWithTheSignedInUser() {
        assertEquals("live/lead/lead-1", notificationDestination("lead-1", null, false))
        assertNull(notificationDestination(null, "intro-1", false))
        assertEquals("live/estate/INTRODUCTIONS/intro-1", notificationDestination(null, "intro-1", true))
        assertNull(notificationDestination("demo-lead", null, true))
        assertNull(notificationDestination(null, null, true))
    }

    @Test fun moreMenuDistinguishesNativeGatedAndWebModules() {
        val revision = "7e743eb43fd2995636c8b2f7133d606a1d2c3cb6"
        val modules = listOf("LISTINGS", "BUYERS", "VIEWINGS", "INTRODUCTIONS", "OFFERS", "TRANSACTIONS", "TASKS", "CALENDAR", "WHATSAPP", "LEADS")
        val seller = LiveWorkspace.from(bootstrap("experience" to "REAL_ESTATE", "modules" to modules).let { b ->
            b.copy(
                release = com.segmiq.sales.core.bootstrap.BackendRelease(1, revision),
                navigation = b.navigation.copy(destinations = modules.map { com.segmiq.sales.core.bootstrap.NavDestination(it, it) }),
                capabilities = b.capabilities.copy(featureFlags = b.capabilities.featureFlags.copy(
                    realEstatePropertiesRead = true, realEstateBuyerSearchRead = true, realEstateViewingsRead = true,
                    realEstateOffers = true, realEstateTransactionsRead = true, realEstateIntroductions = true,
                    salespersonCalendarRead = true)),
            )
        })
        val url = "https://www.segmiq.com/".toHttpUrl()
        val access = EstateAccess(seller, url)
        assertEquals(ModulePresence.NATIVE, modulePresence(LiveModule.PROPERTIES, seller, access))
        assertTrue(moduleStatusLine(LiveModule.PROPERTIES, seller, access).startsWith("Open"))
        val other = LiveWorkspace.from(seller.bootstrap.copy(release = com.segmiq.sales.core.bootstrap.BackendRelease(1, "other-revision")))
        assertEquals(ModulePresence.GATED, modulePresence(LiveModule.PROPERTIES, other, EstateAccess(other, url)))
        assertEquals(ModulePresence.NATIVE, modulePresence(LiveModule.INBOX, seller, access))
        assertEquals(ModulePresence.WEB_ONLY, modulePresence(LiveModule.QUOTATIONS, seller, access))
        val solar = LiveWorkspace.from(seller.bootstrap.copy(experience = seller.bootstrap.experience.copy(id = "SOLAR")))
        assertEquals(ModulePresence.WEB_ONLY, modulePresence(LiveModule.SOLAR_PIPELINE, solar, EstateAccess(solar, url)))
        assertEquals(ModulePresence.WEB_ONLY, modulePresence(LiveModule.QUOTATIONS, LiveWorkspace.from(bootstrap("experience" to "GENERAL")), EstateAccess(LiveWorkspace.from(bootstrap()), url)))
    }

    @Test fun serverBodiesStayGenericWhileConflictsStaySpecific() {
        val internal = ErrorMapper.fromHttp(503, """{"error":"Sensitive SQL service details must not appear"}""", "application/json")
        assertEquals(ErrorKind.SERVER, internal.kind)
        assertFalse(internal.screenMessage().contains("SQL"))
        val overlap = ErrorMapper.fromHttp(409, """{"error":"This agent already has a viewing within 90 minutes. Confirm only if the times can both be kept."}""", "application/json")
        assertEquals(ErrorKind.CONFLICT, overlap.kind)
        assertTrue(overlap.screenMessage().contains("90 minutes"))
    }
}
