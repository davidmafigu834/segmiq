package com.segmiq.sales.core.live

import com.segmiq.sales.core.data.AuthorisedScope

/**
 * In-memory cache for live data, bound to one user and organisation. Reading with a different
 * scope returns nothing, and writing with a new scope drops everything cached for the previous
 * account, so switching accounts can never show another account's data. Nothing is written to disk.
 */
class ScopedCache {
    private var scope: AuthorisedScope? = null
    private val values = HashMap<String, Any>()

    @Synchronized
    fun <T : Any> get(scope: AuthorisedScope, key: String, type: Class<T>): T? =
        if (scope == this.scope) values[key]?.let { type.cast(it) } else null

    @Synchronized
    fun put(scope: AuthorisedScope, key: String, value: Any) {
        if (scope != this.scope) {
            values.clear()
            this.scope = scope
        }
        values[key] = value
    }

    @Synchronized
    fun remove(scope: AuthorisedScope, key: String) {
        if (scope == this.scope) values.remove(key)
    }

    @Synchronized
    fun clear() {
        values.clear()
        scope = null
    }

    @Synchronized
    fun size(): Int = values.size
}

inline fun <reified T : Any> ScopedCache.get(scope: AuthorisedScope, key: String): T? = get(scope, key, T::class.java)
