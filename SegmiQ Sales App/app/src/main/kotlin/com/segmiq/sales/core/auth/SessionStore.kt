package com.segmiq.sales.core.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.segmiq.sales.core.network.SegmiqJson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** The signed-in mobile session. Never logged; persisted only through [SessionStore]. */
@Serializable
data class StoredSession(
    val token: String,
    val expiresAt: String,
    val userId: String,
    val clientId: String,
    val sessionId: String? = null,
    val role: String,
    val name: String,
) {
    override fun toString(): String = "StoredSession(userId=$userId, clientId=$clientId, token=<redacted>)"
}

interface SessionStore {
    suspend fun read(): StoredSession?
    suspend fun write(session: StoredSession)
    suspend fun clear()
}

/** Encrypts and decrypts small secrets. The production implementation uses Android Keystore. */
interface SecretCipher {
    fun encrypt(plain: ByteArray): ByteArray
    fun decrypt(sealed: ByteArray): ByteArray
    fun destroyKey()
}

/**
 * AES-256-GCM with a non-exportable key held in Android Keystore. The ciphertext is stored with
 * a 12-byte IV prefix. Key material never leaves the Keystore.
 */
class KeystoreSecretCipher(private val alias: String = "segmiq_sales_session_v1") : SecretCipher {
    private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private fun key(): SecretKey {
        (keyStore().getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    override fun encrypt(plain: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val iv = cipher.iv
        return iv + cipher.doFinal(plain)
    }

    override fun decrypt(sealed: ByteArray): ByteArray {
        require(sealed.size > IV_BYTES) { "Sealed value is too short" }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, sealed.copyOfRange(0, IV_BYTES)))
        return cipher.doFinal(sealed.copyOfRange(IV_BYTES, sealed.size))
    }

    override fun destroyKey() {
        runCatching { keyStore().deleteEntry(alias) }
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
    }
}

/**
 * Stores the session as Keystore-encrypted ciphertext in a dedicated private preferences file,
 * separate from the demo DataStore. Backups exclude all shared preferences (see backup rules).
 * Any decryption failure (e.g. key invalidated) is treated as signed out.
 */
class EncryptedSessionStore(
    context: Context,
    private val cipher: SecretCipher = KeystoreSecretCipher(),
) : SessionStore {
    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    override suspend fun read(): StoredSession? = withContext(Dispatchers.IO) {
        val sealed = prefs.getString(KEY, null) ?: return@withContext null
        runCatching {
            val plain = cipher.decrypt(Base64.decode(sealed, Base64.NO_WRAP))
            SegmiqJson.decodeFromString(StoredSession.serializer(), plain.decodeToString())
        }.getOrElse {
            prefs.edit().remove(KEY).commit()
            null
        }
    }

    override suspend fun write(session: StoredSession) = withContext(Dispatchers.IO) {
        val plain = SegmiqJson.encodeToString(StoredSession.serializer(), session).encodeToByteArray()
        val sealed = Base64.encodeToString(cipher.encrypt(plain), Base64.NO_WRAP)
        check(prefs.edit().putString(KEY, sealed).commit()) { "Session could not be saved" }
    }

    override suspend fun clear() = withContext(Dispatchers.IO) {
        prefs.edit().clear().commit()
        cipher.destroyKey()
    }

    private companion object {
        const val FILE = "segmiq_secure_session"
        const val KEY = "session_v1"
    }
}

class InMemorySessionStore(initial: StoredSession? = null) : SessionStore {
    @Volatile private var value: StoredSession? = initial
    override suspend fun read() = value
    override suspend fun write(session: StoredSession) { value = session }
    override suspend fun clear() { value = null }
}
