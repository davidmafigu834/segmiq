package com.segmiq.sales.core.inbox

enum class InboxFilter { ALL, UNREAD, OPEN, MINE }

/** Accepted by SegmiQ is not delivery. A demo provider id is never a WhatsApp send. */
fun describeSend(ok: Boolean, providerId: String?): String = when {
    !ok -> "SegmiQ did not accept the message. The draft is still here."
    providerId == "demo-simulated" -> "This workspace simulated the send. It was not delivered to WhatsApp."
    else -> "SegmiQ accepted the message. Delivery is not confirmed until the conversation shows a delivery state."
}

/** Only statuses the server actually documents. Anything else is omitted. */
fun deliveryLabel(status: String?): String? = when (status) {
    "pending" -> "Pending"
    "sent" -> "Sent"
    "delivered" -> "Delivered"
    "read" -> "Read"
    "failed" -> "Failed"
    else -> null
}

fun messageSide(direction: String): String = when (direction) {
    "customer" -> "received"
    "rep" -> "sent"
    else -> "other"
}

fun inboxVisible(row: InboxConversationDto, filter: InboxFilter, query: String, userId: String): Boolean {
    val matchesFilter = when (filter) {
        InboxFilter.ALL -> true
        InboxFilter.UNREAD -> row.unread > 0
        InboxFilter.OPEN -> row.conversationStatus.equals("OPEN", true)
        InboxFilter.MINE -> row.assignedToId == userId
    }
    if (!matchesFilter) return false
    if (query.isBlank()) return true
    val haystack = listOfNotNull(row.name, row.phone, row.lastMessage, row.assignee?.name).joinToString(" ")
    return haystack.contains(query.trim(), ignoreCase = true)
}

/** A route is returned only when the payload contains that record id. */
fun notificationDestination(leadId: String?, introductionId: String?, estateIntroductionsOpen: Boolean): String? {
    val lead = leadId?.trim()?.takeIf { it.isNotEmpty() && !it.startsWith("demo-") }
    if (lead != null) return "live/lead/$lead"
    val intro = introductionId?.trim()?.takeIf { it.isNotEmpty() && !it.startsWith("demo-") }
    if (estateIntroductionsOpen && intro != null) return "live/estate/INTRODUCTIONS/$intro"
    return null
}
