package com.segmiq.sales.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

data class Customer(val id: String, val name: String, val company: String, val phone: String, val email: String, val location: String)
data class Opportunity(val id: String, val customerId: String, val title: String, val amount: Int, val stage: String, val nextAction: String)
data class SalesTask(val id: String, val customerId: String, val title: String, val due: String, val priority: String, val completed: Boolean = false)
data class Message(val id: String, val customerId: String, val text: String, val outgoing: Boolean, val time: String)
data class Note(val id: String, val customerId: String, val text: String)
data class CallReview(val id: String, val customerId: String, val outcome: String, val notes: String, val seconds: Int, val createdAt: String = java.time.Instant.now().toString())
data class DemoState(
    val customers: List<Customer> = DemoFixtures.customers,
    val tasks: List<SalesTask> = DemoFixtures.tasks,
    val messages: List<Message> = DemoFixtures.messages,
    val notes: List<Note> = emptyList(),
    val reviews: List<CallReview> = emptyList(),
    val meetings: List<Meeting> = listOf(
        Meeting("meeting1", "tapiwa", "Proposal review", "Today · 14:00", "Customer office", null),
        Meeting("meeting2", "chipo", "Site visit", "Tomorrow · 10:00", "Avondale site", null)
    )
)
object DemoFixtures {
    val customers = listOf(
        Customer("tapiwa", "Tapiwa Moyo", "Moyo Fresh Markets", "+263771234501", "tapiwa@example.com", "Borrowdale, Harare"),
        Customer("chipo", "Chipo Dube", "Dube Properties", "+263772234502", "chipo@example.com", "Avondale, Harare"),
        Customer("tendai", "Tendai Ncube", "Ncube Engineering", "+263773234503", "tendai@example.com", "Belmont, Bulawayo")
    )
    val tasks = listOf(
        SalesTask("call-1", "tapiwa", "Call about the revised proposal", "Today · 09:30", "High"),
        SalesTask("quote-1", "tendai", "Follow up on equipment quotation", "Today · 11:00", "High"),
        SalesTask("visit-1", "chipo", "Confirm tomorrow’s site visit", "Tomorrow · 10:00", "Normal")
    )
    val messages = listOf(
        Message("m1", "tapiwa", "Thanks for the proposal. Could we discuss the delivery options?", false, "09:12"),
        Message("m2", "chipo", "The site visit tomorrow works well for me.", false, "08:45"),
        Message("m3", "tendai", "Please include installation in the quotation.", false, "Yesterday")
    )
    val opportunities = listOf(
        Opportunity("o1", "tapiwa", "Retail expansion supply", 12800, "Proposal", "Discuss delivery options"),
        Opportunity("o2", "chipo", "Commercial property enquiry", 45000, "Discovery", "Confirm the site visit"),
        Opportunity("o3", "tendai", "Workshop equipment", 8600, "Negotiation", "Review installation costs")
    )
    val stages = listOf("All", "Discovery", "Proposal", "Negotiation")
}
fun filterTasks(tasks: List<SalesTask>, filter: String) = tasks.filter {
    when (filter) {
        "Completed" -> it.completed
        "Today" -> !it.completed && it.due.startsWith("Today")
        "Upcoming" -> !it.completed && !it.due.startsWith("Today")
        else -> !it.completed
    }
}
fun validPhone(value: String) = value.trim().matches(Regex("[+]?[0-9 ()-]{3,25}")) && value.count(Char::isDigit) in 3..15

/** Demo-only persistence. Production adapters must enforce server organisation and assignment scopes. */
interface SalesRepository {
    val state: Flow<DemoState>
    suspend fun save(state: DemoState)
}
private val Context.demoStore by preferencesDataStore("segmiq_demo_v1")
class LocalDemoRepository(private val context: Context) : SalesRepository {
    private val key = stringPreferencesKey("state")
    override val state = context.demoStore.data.map { prefs -> prefs[key]?.let(::decode) ?: DemoState() }
    override suspend fun save(state: DemoState) {
        context.demoStore.edit { it[key] = encode(state) }
    }
    private fun encode(s: DemoState): String = JSONObject().apply {
        put("tasks", JSONArray().apply { s.tasks.forEach { t -> put(JSONObject().apply {
            put("id", t.id); put("customer", t.customerId); put("title", t.title); put("due", t.due); put("priority", t.priority); put("done", t.completed)
        }) } })
        put("messages", JSONArray().apply { s.messages.forEach { m -> put(JSONObject().apply {
            put("id", m.id); put("customer", m.customerId); put("text", m.text); put("outgoing", m.outgoing); put("time", m.time)
        }) } })
        put("notes", JSONArray().apply { s.notes.forEach { n -> put(JSONObject().apply {
            put("id", n.id); put("customer", n.customerId); put("text", n.text)
        }) } })
        put("reviews", JSONArray().apply { s.reviews.forEach { r -> put(JSONObject().apply {
            put("id", r.id); put("customer", r.customerId); put("outcome", r.outcome); put("notes", r.notes); put("seconds", r.seconds); put("createdAt", r.createdAt)
        }) } })
        put("meetings", JSONArray().apply { s.meetings.forEach { m -> put(JSONObject().apply {
            put("id", m.id); put("customer", m.customerId); put("title", m.title); put("starts", m.startsAt); put("location", m.location)
        }) } })
        put("customers", JSONArray().apply { s.customers.forEach { c -> put(JSONObject().apply {
            put("id", c.id); put("name", c.name); put("company", c.company); put("phone", c.phone); put("email", c.email); put("location", c.location)
        }) } })
    }.toString()
    private fun decode(raw: String): DemoState {
        val j = JSONObject(raw)
        fun <T> list(key: String, block: (JSONObject) -> T): List<T> {
            val a = j.getJSONArray(key)
            return (0 until a.length()).map { block(a.getJSONObject(it)) }
        }
        return DemoState(
            customers = list("customers") { Customer(it.getString("id"), it.getString("name"), it.getString("company"), it.getString("phone"), it.getString("email"), it.getString("location")) },
            tasks = list("tasks") { SalesTask(it.getString("id"), it.getString("customer"), it.getString("title"), it.getString("due"), it.getString("priority"), it.getBoolean("done")) },
            messages = list("messages") { Message(it.getString("id"), it.getString("customer"), it.getString("text"), it.getBoolean("outgoing"), it.getString("time")) },
            notes = list("notes") { Note(it.getString("id"), it.getString("customer"), it.getString("text")) },
            reviews = list("reviews") { CallReview(it.getString("id"), it.getString("customer"), it.getString("outcome"), it.getString("notes"), it.getInt("seconds"), it.optString("createdAt", "")) },
            meetings = if (j.has("meetings")) list("meetings") { Meeting(it.getString("id"), it.optString("customer"), it.getString("title"), it.getString("starts"), it.optString("location"), null) } else DemoState().meetings
        )
    }
}
