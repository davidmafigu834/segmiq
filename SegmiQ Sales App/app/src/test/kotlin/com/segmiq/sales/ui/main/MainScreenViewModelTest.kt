package com.segmiq.sales.ui.main

import com.segmiq.sales.core.data.*
import org.junit.Assert.*
import org.junit.Test

class MainScreenViewModelTest {
    @Test fun allOpenTaskFilterExcludesCompleted() {
        val tasks = DemoFixtures.tasks + SalesTask("done", "tapiwa", "Done", "Today", "Normal", true)
        assertEquals(DemoFixtures.tasks, filterTasks(tasks, "My tasks"))
    }
    @Test fun emptyTaskListsRemainEmptyForEveryFilter() {
        listOf("Today", "Upcoming", "Completed", "My tasks").forEach { assertTrue(filterTasks(emptyList(), it).isEmpty()) }
    }
}
