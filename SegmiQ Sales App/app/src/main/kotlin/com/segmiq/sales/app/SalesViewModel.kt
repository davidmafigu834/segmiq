package com.segmiq.sales.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.segmiq.sales.core.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

data class SalesUiState(val loading: Boolean = true, val data: DemoState = DemoState(), val error: String? = null, val saving: Boolean = false)
class SalesViewModel(application: Application) : AndroidViewModel(application) {
    private val repository: SalesRepository = LocalDemoRepository(application)
    private val mutable = MutableStateFlow(SalesUiState())
    val state = mutable.asStateFlow()
    private val mutex = Mutex()
    init { reload() }
    fun reload() {
        viewModelScope.launch {
            repository.state.catch { mutable.value = mutable.value.copy(loading = false, error = "Local data could not be loaded. Try again; your data has not been reset.") }
                .collect { mutable.value = SalesUiState(data = it, loading = false) }
        }
    }
    private fun change(block: (DemoState) -> DemoState) {
        viewModelScope.launch {
            mutex.withLock {
                mutable.value = mutable.value.copy(saving = true, error = null)
                try {
                    val updated = block(mutable.value.data)
                    repository.save(updated)
                    mutable.value = mutable.value.copy(data = updated, saving = false)
                } catch (_: Exception) {
                    mutable.value = mutable.value.copy(saving = false, error = "Could not save on this device. Your changes have not been saved.")
                }
            }
        }
    }
    fun complete(id: String) = change { s -> s.copy(tasks = s.tasks.map { if (it.id == id) it.copy(completed = !it.completed) else it }) }
    fun note(customer: String, text: String) { if (text.isNotBlank()) change { it.copy(notes = it.notes + Note(UUID.randomUUID().toString(), customer, text.trim())) } }
    fun message(customer: String, text: String) { if (text.isNotBlank()) change { it.copy(messages = it.messages + Message(UUID.randomUUID().toString(), customer, text.trim(), true, "Local draft")) } }
    fun task(customer: String, title: String, due: String) { if (title.isNotBlank() && due.isNotBlank()) change { it.copy(tasks = it.tasks + SalesTask(UUID.randomUUID().toString(), customer, title.trim(), due.trim(), "Normal")) } }
    fun meeting(customer: String, title: String, due: String) { if (title.isNotBlank() && due.isNotBlank()) change { it.copy(meetings = it.meetings + Meeting(UUID.randomUUID().toString(), customer, title.trim(), due.trim(), "Location not set", null)) } }
    fun review(review: CallReview) = change { s ->
        if (s.reviews.any { it.id == review.id }) s else s.copy(reviews = s.reviews + review)
    }
    fun lead(name: String, company: String, phone: String) { if (name.isNotBlank() && validPhone(phone)) change { it.copy(customers = it.customers + Customer(UUID.randomUUID().toString(), name.trim(), company.trim(), phone.trim(), "", "")) } }
}
