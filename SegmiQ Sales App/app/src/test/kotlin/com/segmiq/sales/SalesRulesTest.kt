package com.segmiq.sales

import com.segmiq.sales.core.data.*
import org.junit.Assert.*
import org.junit.Test

class SalesRulesTest {
    @Test fun completedTasksDoNotAppearInTodayPriorities() {
        val tasks = listOf(
            SalesTask("1", "a", "Call", "Today · 10:00", "High", true),
            SalesTask("2", "a", "Visit", "Today · 12:00", "Normal"),
            SalesTask("3", "a", "Quote", "Tomorrow · 11:00", "Normal")
        )
        assertEquals(listOf("2"), filterTasks(tasks, "Today").map { it.id })
        assertEquals(listOf("1"), filterTasks(tasks, "Completed").map { it.id })
        assertEquals(listOf("3"), filterTasks(tasks, "Upcoming").map { it.id })
    }
    @Test fun phoneValidationAcceptsLocalAndInternationalButRejectsInvalidInput() {
        assertTrue(validPhone("+263 77 123 4501"))
        assertTrue(validPhone("0771234501"))
        assertTrue(validPhone("112"))
        assertFalse(validPhone("+"))
        assertFalse(validPhone("abc123"))
        assertFalse(validPhone("1234567890123456"))
    }
}
