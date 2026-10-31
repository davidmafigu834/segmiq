package com.segmiq.sales.core.data

/** Integration boundaries for features not yet connected to the SegmiQ backend.
 * Authorised organisation/assignment scope must come from the existing authenticated backend
 * (sign-in + bootstrap), never from a client-selected organisation identifier.
 * Live authentication, bootstrap, My Day, leads, tasks and Copilot are implemented in
 * `core.auth`, `core.bootstrap` and `core.live`.
 */
data class AuthorisedScope(val organisationId: String, val salespersonId: String)
interface ConversationsRepository { suspend fun messages(scope: AuthorisedScope, customerId: String): List<Message> }
interface CallsRepository { suspend fun submit(scope: AuthorisedScope, review: CallReview, idempotencyKey: String) }
interface OpportunitiesRepository { suspend fun assigned(scope: AuthorisedScope): List<Opportunity> }
data class RecordingMetadata(val id: String, val customerId: String?, val meetingId: String?, val title: String, val durationMs: Long, val privateFileName: String, val bytes: Long)
interface RecordingsRepository { suspend fun authorised(scope: AuthorisedScope): List<RecordingMetadata> }
data class Meeting(val id: String, val customerId: String?, val title: String, val startsAt: String, val location: String?, val joinUrl: String?)
interface MeetingsRepository { suspend fun assigned(scope: AuthorisedScope): List<Meeting> }
data class QuotationReference(val id: String, val customerId: String, val title: String, val status: String)
interface QuotationsRepository { suspend fun authorised(scope: AuthorisedScope): List<QuotationReference> }
