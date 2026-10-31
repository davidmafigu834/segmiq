package com.segmiq.sales

import androidx.test.core.app.ApplicationProvider
import com.segmiq.sales.core.data.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class DemoPersistenceTest {
    @Test fun localRepositoryPersistsEditsAcrossInstances() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val repository = LocalDemoRepository(context)
        val original = repository.state.first()
        val updated = original.copy(notes = original.notes + Note("persistence-check", "tapiwa", "Local persistence check"))
        try {
            repository.save(updated)
            val restored = LocalDemoRepository(context).state.first()
            assertTrue(restored.notes.any { it.id == "persistence-check" && it.customerId == "tapiwa" })
            assertEquals(original.customers, restored.customers)
            assertEquals(original.meetings, restored.meetings)
        } finally { repository.save(original) }
    }
}
