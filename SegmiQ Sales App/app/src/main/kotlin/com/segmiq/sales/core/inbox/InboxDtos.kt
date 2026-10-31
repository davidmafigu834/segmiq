package com.segmiq.sales.core.inbox

import kotlinx.serialization.Serializable

/** Fields used by the phone. Extra server fields are ignored. */
@Serializable
data class InboxListDto(
    val conversations: List<InboxConversationDto> = emptyList(),
    val agentEnabled: Boolean = false,
)

@Serializable
data class InboxAssigneeDto(val id: String = "", val name: String = "")

@Serializable
data class InboxConversationDto(
    val id: String,
    val name: String? = null,
    val phone: String? = null,
    val source: String? = null,
    val status: String = "",
    val assignee: InboxAssigneeDto? = null,
    val assignedToId: String? = null,
    val lastMessage: String = "",
    val lastMessageAt: String = "",
    val unread: Int = 0,
    val conversationStatus: String = "",
)

@Serializable
data class InboxMessagesDto(
    val messages: List<InboxMessageDto> = emptyList(),
    val sessionOpen: Boolean = false,
    val isWhatsApp: Boolean = false,
    val hasMore: Boolean = false,
    val nextBefore: String? = null,
)

@Serializable
data class InboxMessageDto(
    val id: String,
    val direction: String = "",
    val text: String = "",
    val createdAt: String = "",
    val kind: String = "message",
    val status: String? = null,
    val mediaUrl: String? = null,
    val mediaMimeType: String? = null,
    val systemTitle: String? = null,
)

@Serializable
data class QuickRepliesDto(val replies: List<QuickReplyDto> = emptyList())

@Serializable
data class QuickReplyDto(
    val id: String,
    val title: String,
    val body: String,
    val isDefault: Boolean = false,
)

@Serializable
data class SendMessageResult(
    val ok: Boolean = false,
    val providerId: String? = null,
    val mode: String? = null,
)

@Serializable
data class NotificationsDto(
    val notifications: List<AppNotificationDto> = emptyList(),
    val unreadCount: Int = 0,
)

@Serializable
data class AppNotificationDto(
    val id: String,
    val type: String = "",
    val message: String = "",
    val read: Boolean = false,
    @kotlinx.serialization.SerialName("lead_id") val leadId: String? = null,
    @kotlinx.serialization.SerialName("introduction_id") val introductionId: String? = null,
    @kotlinx.serialization.SerialName("quotation_id") val quotationId: String? = null,
    @kotlinx.serialization.SerialName("created_at") val createdAt: String = "",
)
