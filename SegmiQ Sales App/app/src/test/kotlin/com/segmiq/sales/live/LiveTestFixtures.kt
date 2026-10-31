package com.segmiq.sales.live

import com.segmiq.sales.core.auth.AuthRepository
import com.segmiq.sales.core.auth.DeviceIdentity
import com.segmiq.sales.core.auth.SessionStore
import com.segmiq.sales.core.auth.StoredSession
import com.segmiq.sales.core.bootstrap.SalesAppBootstrap
import com.segmiq.sales.core.network.ApiConfig
import com.segmiq.sales.core.network.SegmiqHttp
import com.segmiq.sales.core.network.SegmiqJson
import com.segmiq.sales.core.network.SessionProblemListener
import com.segmiq.sales.core.network.TokenProvider
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import java.util.concurrent.TimeUnit

/** All identifiers and tokens here are synthetic; tests never contact a real SegmiQ server. */
object Fake {
    const val TOKEN = "fake-session-token-for-tests"
    const val USER = "user-test-1"
    const val ORG = "org-test-1"
    val DEVICE = DeviceIdentity("device-test-1", "Test Phone")

    fun session(expiresAt: String = "2099-01-01T00:00:00Z", userId: String = USER, clientId: String = ORG) =
        StoredSession(TOKEN, expiresAt, userId, clientId, "session-test-1", "SALESPERSON", "Test Seller")
}

fun MockWebServer.config(): ApiConfig = ApiConfig("http://127.0.0.1:$port/".toHttpUrl(), "SegmiQSales-Test")

fun MockWebServer.http(tokens: TokenProvider = TokenProvider { null }, problems: SessionProblemListener? = null) =
    SegmiqHttp(config(), tokens, problems)

fun MockWebServer.auth(store: SessionStore): AuthRepository {
    lateinit var repo: AuthRepository
    repo = AuthRepository(http(TokenProvider { repo.currentToken() }), store, Fake.DEVICE)
    return repo
}

fun json(body: String, status: Int = 200): MockResponse =
    MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body)

fun html(status: Int = 404): MockResponse =
    MockResponse().setResponseCode(status).setHeader("Content-Type", "text/html").setBody("<html>Not found</html>")

fun MockWebServer.next(): RecordedRequest = takeRequest(5, TimeUnit.SECONDS) ?: error("No request was made")

fun bootstrapJson(
    experience: String = "GENERAL",
    modules: List<String> = listOf("PIPELINE", "LEADS", "TASKS", "QUOTES", "WHATSAPP"),
    userId: String = Fake.USER,
    orgId: String = Fake.ORG,
    salesAccess: String = "ALLOWED",
    salesOperations: String = "ALLOWED",
    schemaVersion: Int = 1,
    zone: String = "Africa/Harare",
    homeVariant: String = "TEAM",
    demo: Boolean = false,
): String {
    val mods = modules.joinToString(",") { "\"$it\"" }
    return """
    {
      "schemaVersion": $schemaVersion,
      "generatedAt": "2026-10-30T08:00:00.000Z",
      "session": {"sessionId": "session-test-1", "sessionType": "mobile_sales", "expiresAt": "2099-01-01T00:00:00Z", "refreshSupported": false},
      "user": {"id": "$userId", "displayName": "Test Seller", "role": "SALESPERSON", "alsoSells": false, "avatarUrl": null},
      "organisation": {"id": "$orgId", "name": "Test Organisation", "businessType": "general", "workspaceMode": "${if (demo) "demo" else "live"}", "futureField": 1},
      "subscription": {"product": "SALES", "status": "ACTIVE", "salesAccess": "$salesAccess"},
      "experience": {"id": "$experience", "resolvedBy": "test", "homeVariant": "$homeVariant"},
      "capabilities": {
        "modules": [$mods],
        "permissions": [],
        "featureFlags": {"realEstateWorkflow": ${experience == "REAL_ESTATE"}, "solarWorkflow": ${experience == "SOLAR"}, "demoWorkspace": $demo},
        "restrictions": {"salesOperations": "$salesOperations", "leadVisibility": "ASSIGNED", "leadModification": "ASSIGNED"}
      },
      "navigation": {"home": "MY_DAY", "primary": [], "sections": [], "destinations": [{"id": "QUOTES", "label": "Quotations", "webPath": "/sales/quotations"}]},
      "salesConfiguration": {
        "pipeline": {"model": "standard", "configurable": false, "stages": [{"id": "NEW", "label": "New"}]},
        "timeZone": {"configured": "$zone", "effective": "$zone", "source": "organisation"},
        "currency": {"quotationDefault": "USD", "supported": ["USD"], "source": "organisation"}
      }
    }
    """.trimIndent()
}

fun bootstrap(vararg args: Pair<String, Any>): SalesAppBootstrap {
    val map = args.toMap()
    @Suppress("UNCHECKED_CAST")
    val json = bootstrapJson(
        experience = map["experience"] as String? ?: "GENERAL",
        modules = map["modules"] as List<String>? ?: listOf("PIPELINE", "LEADS", "TASKS", "QUOTES", "WHATSAPP"),
        salesAccess = map["salesAccess"] as String? ?: "ALLOWED",
        salesOperations = map["salesOperations"] as String? ?: "ALLOWED",
        schemaVersion = map["schemaVersion"] as Int? ?: 1,
        zone = map["zone"] as String? ?: "Africa/Harare",
        homeVariant = map["homeVariant"] as String? ?: "TEAM",
        demo = map["demo"] as Boolean? ?: false,
    )
    return SegmiqJson.decodeFromString(SalesAppBootstrap.serializer(), json)
}
