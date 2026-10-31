package com.segmiq.sales.features.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.segmiq.sales.core.inbox.InboxConversationDto
import com.segmiq.sales.core.inbox.InboxMessageDto
import com.segmiq.sales.core.inbox.QuickReplyDto
import com.segmiq.sales.core.inbox.describeSend
import com.segmiq.sales.core.live.LiveSalesApi
import com.segmiq.sales.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class InboxDirectoryState(
    val loading: Boolean = true,
    val error: String? = null,
    val conversations: List<InboxConversationDto> = emptyList(),
)

data class InboxThreadState(
    val loading: Boolean = true,
    val error: String? = null,
    val messages: List<InboxMessageDto> = emptyList(),
    val sessionOpen: Boolean = false,
    val hasMore: Boolean = false,
    val nextBefore: String? = null,
    val sending: Boolean = false,
    val sendNote: String? = null,
    val sendFailed: Boolean = false,
    val replies: List<QuickReplyDto> = emptyList(),
    val name: String? = null,
    val phone: String? = null,
)

class InboxViewModel(private val api: LiveSalesApi, val userId: String) : ViewModel() {
    private val directoryState = MutableStateFlow(InboxDirectoryState())
    val directory: StateFlow<InboxDirectoryState> = directoryState.asStateFlow()
    private val threadState = MutableStateFlow(InboxThreadState())
    val thread: StateFlow<InboxThreadState> = threadState.asStateFlow()

    fun loadDirectory() {
        directoryState.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = api.inboxConversations()) {
                is ApiResult.Success -> directoryState.value = InboxDirectoryState(loading = false, conversations = result.value.conversations)
                is ApiResult.Failure -> directoryState.update { it.copy(loading = false, error = result.error.message) }
            }
        }
    }

    fun open(leadId: String, before: String? = null) {
        if (before == null) threadState.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            val known = directoryState.value.conversations.firstOrNull { it.id == leadId }
            when (val result = api.inboxMessages(leadId, before)) {
                is ApiResult.Success -> threadState.update {
                    val older = if (before == null) emptyList() else it.messages
                    it.copy(
                        loading = false,
                        error = null,
                        messages = (result.value.messages + older).distinctBy { message -> message.id },
                        sessionOpen = result.value.sessionOpen,
                        hasMore = result.value.hasMore,
                        nextBefore = result.value.nextBefore,
                        name = known?.name ?: it.name,
                        phone = known?.phone ?: it.phone,
                    )
                }
                is ApiResult.Failure -> threadState.update { it.copy(loading = false, error = result.error.message) }
            }
            if (before == null && threadState.value.name == null) {
                (api.inboxConversations() as? ApiResult.Success)?.value?.conversations?.firstOrNull { it.id == leadId }?.let { row ->
                    threadState.update { it.copy(name = row.name, phone = row.phone) }
                }
            }
            if (before == null && threadState.value.replies.isEmpty()) {
                (api.quickReplies() as? ApiResult.Success)?.let { replies ->
                    threadState.update { it.copy(replies = replies.value.replies) }
                }
            }
        }
    }

    fun send(leadId: String, text: String) {
        if (threadState.value.sending || text.isBlank()) return
        threadState.update { it.copy(sending = true, sendNote = null, sendFailed = false) }
        viewModelScope.launch {
            when (val result = api.sendInboxMessage(leadId, text)) {
                is ApiResult.Success -> {
                    threadState.update {
                        it.copy(
                            sending = false,
                            sendFailed = !result.value.ok,
                            sendNote = describeSend(result.value.ok, result.value.providerId),
                        )
                    }
                    if (result.value.ok) open(leadId)
                }
                is ApiResult.Failure -> threadState.update {
                    it.copy(sending = false, sendFailed = true, sendNote = result.error.message)
                }
            }
        }
    }

    fun dismissSendNote() = threadState.update { it.copy(sendNote = null, sendFailed = false) }
}
