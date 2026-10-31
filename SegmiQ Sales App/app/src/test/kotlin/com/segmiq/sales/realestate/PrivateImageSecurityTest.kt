package com.segmiq.sales.realestate

import com.segmiq.sales.core.estate.*
import com.segmiq.sales.core.network.*
import kotlinx.coroutines.runBlocking
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class PrivateImageSecurityTest {
    private val now = Instant.parse("2026-10-31T09:00:00Z")
    private fun metadata(url: String = "https://private.example.test/photo?signature=synthetic", expiry: Instant = now.plusSeconds(300)) =
        SignedImageDto(url, expiry.toString())
    @Test fun storageDownloadHasNoSalesTokenCookiesOrRedirects() = runBlocking {
        var calls = 0
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            calls++
            assertNull(chain.request().header("Authorization"))
            assertNull(chain.request().header("Cookie"))
            assertNull(chain.request().tag(AuthRequired::class.java))
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(302).message("Redirect")
                .header("Location", "https://other.example.test/steal")
                .body("".toResponseBody()).build()
        }.build()
        val result = PrivateListingImageClient("private.example.test", client) { now }.fetch(metadata())
        assertTrue(result is ApiResult.Failure); assertEquals(1, calls)
    }
    @Test fun hostileDestinationsAndExpiredUrlsFailBeforeNetwork() = runBlocking {
        var calls = 0
        val client = OkHttpClient.Builder().addInterceptor { calls++; error("Network must not run") }.build()
        val downloader = PrivateListingImageClient("private.example.test", client) { now }
        for (url in listOf("http://private.example.test/photo", "https://other.example.test/photo",
            "https://user:password@private.example.test/photo", "https://private.example.test:8443/photo")) {
            assertTrue(downloader.fetch(metadata(url)) is ApiResult.Failure)
        }
        assertTrue(downloader.fetch(metadata(expiry = now.minusSeconds(1))) is ApiResult.Failure)
        assertTrue(downloader.fetch(metadata(expiry = now.plusSeconds(3600))) is ApiResult.Failure)
        assertEquals(0, calls)
    }
    @Test fun wrongMimeAndOversizedImageFailClosed() = runBlocking {
        fun client(type: String, size: Long) = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .header("Content-Type", type).body(object : ResponseBody() {
                    override fun contentType() = type.toMediaType()
                    override fun contentLength() = size
                    override fun source() = okio.Buffer().writeUtf8("not-a-real-image")
                }).build()
        }.build()
        assertTrue(PrivateListingImageClient("private.example.test", client("text/html", 16)) { now }.fetch(metadata()) is ApiResult.Failure)
        assertTrue(PrivateListingImageClient("private.example.test", client("image/jpeg", 21L * 1024 * 1024)) { now }.fetch(metadata()) is ApiResult.Failure)
    }
}
