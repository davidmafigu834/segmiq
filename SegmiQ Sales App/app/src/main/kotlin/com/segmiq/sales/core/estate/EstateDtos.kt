package com.segmiq.sales.core.estate

import kotlinx.serialization.*
import kotlinx.serialization.json.*
import java.math.BigDecimal

/** Decode exact JSON decimal lexemes. Never route money through Double. */
object DecimalSerializer : KSerializer<BigDecimal> {
    override val descriptor = JsonPrimitive.serializer().descriptor
    override fun deserialize(decoder: kotlinx.serialization.encoding.Decoder): BigDecimal {
        val value = (decoder as JsonDecoder).decodeJsonElement().jsonPrimitive
        return value.content.toBigDecimal()
    }
    override fun serialize(encoder: kotlinx.serialization.encoding.Encoder, value: BigDecimal) {
        (encoder as JsonEncoder).encodeJsonElement(JsonPrimitive(value))
    }
}
typealias Decimal = @Serializable(with = DecimalSerializer::class) BigDecimal
@Serializable data class NamedParty(val id: String? = null, val name: String? = null, val phone: String? = null)
@Serializable data class ImageReference(val index: Int, val cover: Boolean = false, val endpoint: String)
@Serializable data class ListingActions(val read: Boolean = false, val edit: Boolean = false,
    val approve: Boolean = false, val delete: Boolean = false)
@Serializable data class ListingDto(
    val id: String, val client_id: String? = null, val agent_id: String? = null,
    val address: String? = null, val suburb: String? = null, val description: String? = null,
    val status: String? = null, val approval_status: String? = null, val transaction_type: String? = null,
    val property_category: String? = null, val price: Decimal? = null,
    val bedrooms: Int? = null, val bathrooms: Int? = null, val size_sqm: Decimal? = null,
    val images: List<ImageReference> = emptyList(), val legacyImagesGated: Boolean = false,
    val agent: NamedParty? = null, val updated_at: String? = null,
    val permittedActions: ListingActions = ListingActions(),
)
@Serializable data class ListingsDto(val listings: List<ListingDto>, val page: Int, val limit: Int, val total: Int)
@Serializable data class ListingDetailDto(val listing: ListingDto)
@Serializable data class BuyerSearchDto(
    val id: String, val client_id: String? = null, val contact_id: String? = null,
    val contact_name: String? = null, val phone: String? = null, val assigned_agent_id: String? = null,
    val agent_name: String? = null, val intent: String? = null, val property_type: String? = null,
    val budget_min: Decimal? = null, val budget_max: Decimal? = null, val currency: String? = null,
    val locations: List<String> = emptyList(), val bedrooms: Int? = null, val bathrooms: Int? = null,
    val pipeline_stage: String? = null, val status: String? = null,
    @SerialName("other_requirements") val notes: String? = null, val features: String? = null,
    val next_action_at: String? = null, val next_action_note: String? = null, val updated_at: String? = null,
)
@Serializable data class BuyersDto(val searches: List<BuyerSearchDto>, val page: Int, val pageSize: Int, val total: Int)
data class BuyerRequirementDetails(val propertyType: String?, val bathrooms: Int?, val features: String?, val notes: String?)
@Serializable data class BuyerDetailDto(val search: BuyerSearchDto, val contact: NamedParty? = null)
@Serializable data class PropertyMatchDto(val listingId: String, val listing: ListingDto? = null,
    val reasons: List<String> = emptyList(), val strength: String? = null)
@Serializable data class MatchesDto(val matches: List<PropertyMatchDto>, val incomplete: Boolean = false,
    val truncated: Boolean = false, val notice: String? = null)
@Serializable data class ViewingDto(
    val id: String, val listing_id: String, val agent_id: String? = null, val scheduled_at: String,
    val status: String, val access: String, val buyer_search_id: String? = null, val contact_id: String? = null,
    val listing: ListingDto? = null, val contact: NamedParty? = null, val instructions: String? = null,
    val confirmation_status: String? = null, val outcome: String? = null, val feedback_text: String? = null,
    val updated_at: String? = null, val permittedActions: List<String> = emptyList(),
)
@Serializable data class ViewingsDto(val viewings: List<ViewingDto>, val timezone: String,
    val page: Int, val limit: Int, val total: Int, val incomplete: Boolean)
@Serializable data class ViewingDetailDto(val viewing: ViewingDto, val timezone: String)
@Serializable data class IntroductionDto(
    val id: String, val status: String, val listingId: String, val listingLabel: String,
    val searchId: String, val createdAt: String, val decidedAt: String? = null,
    val requestingAgentName: String, val responsibleAgentName: String? = null,
    val requirementsSummary: String = "", val matchReasons: List<String> = emptyList(),
    val contactName: String? = null, val phone: String? = null,
    val canApprove: Boolean = false, val canDecline: Boolean = false, val ownRequest: Boolean,
)
@Serializable data class IntroductionsDto(val items: List<IntroductionDto>)
@Serializable data class IntroductionDetailDto(val introduction: IntroductionDto)
@Serializable data class ListCompleteness(val bounded: Boolean = true, val sourceLimit: Int? = null, val exhaustive: Boolean = false)
@Serializable data class OfferRowDto(
    val id: String, val listingId: String, val propertyLabel: String,
    val buyerName: String? = null, val contactId: String? = null, val leadId: String? = null,
    val currentAmount: Decimal, val currency: String, val status: String, val statusLabel: String,
    val nextActionLabel: String? = null, val lastActivityAt: String? = null,
)
@Serializable data class OffersDto(val offers: List<OfferRowDto>, val listCompleteness: ListCompleteness)
@Serializable data class OfferSnapshotDto(
    val id: String, val client_id: String? = null, val listing_id: String, val contact_id: String? = null,
    val buyer_search_id: String? = null, val current_offer_amount: Decimal? = null,
    val currency: String, val status: String, val updated_at: String,
    val conditions: String? = null, @SerialName("internal_notes") val notes: String? = null, val permittedActions: List<String> = emptyList(),
)
@Serializable data class OfferMutationDto(val offer: OfferSnapshotDto)
@Serializable data class TransactionMutationDto(val transaction: TransactionSnapshotDto)
@Serializable data class OfferEventDto(val id: String, val label: String, val createdAt: String,
    val note: String? = null, val amount: Decimal? = null)
@Serializable data class OfferDetailDto(val offer: OfferSnapshotDto, val events: List<OfferEventDto> = emptyList(),
    val listing: ListingDto? = null, val contact: NamedParty? = null)
@Serializable data class TransactionRowDto(
    val id: String, val listingId: String, val propertyLabel: String, val buyerName: String? = null,
    val offerId: String? = null, val status: String, val statusLabel: String, val agreedPrice: Decimal,
    val currency: String, val expectedCompletionDate: String? = null, val milestonesDone: Int, val milestonesTotal: Int,
)
@Serializable data class TransactionsDto(val rows: List<TransactionRowDto>, val listCompleteness: ListCompleteness)
@Serializable data class TransactionSnapshotDto(
    val id: String, val client_id: String? = null, val listing_id: String, val offer_id: String? = null,
    val status: String, val updated_at: String, @SerialName("internal_notes") val notes: String? = null,
    val permittedActions: List<String> = emptyList(),
)
@Serializable data class MilestoneDto(val id: String, val key: String, val label: String, val status: String,
    val dueAt: String? = null, val completedAt: String? = null, val updatedAt: String? = null, val notes: String? = null)
@Serializable data class TransactionDetailDto(val transaction: TransactionSnapshotDto,
    val milestones: List<MilestoneDto> = emptyList(), val listing: ListingDto? = null, val contact: NamedParty? = null)
@Serializable data class CalendarEntityDto(val type: String, val id: String)
@Serializable data class CalendarEventDto(val id: String, val type: String, val title: String,
    val startAt: String? = null, val allDay: Boolean, val date: String? = null, val timezone: String,
    val relatedEntity: CalendarEntityDto, val permittedActions: List<String> = emptyList())
@Serializable data class CalendarDto(val events: List<CalendarEventDto>, val timezone: String,
    val page: Int, val limit: Int, val total: Int, val incomplete: Boolean = true,
    val completenessReason: String? = null, val viewingsIncomplete: Boolean = true,
    val sourceCoverage: List<String> = emptyList(), val standaloneMeetingsSupported: Boolean = false)
@Serializable data class SignedImageDto(val url: String, val expiresAt: String)
/** Creation acknowledgement is not the permission-filtered GET projection. */
@Serializable data class CreatedViewingReceiptDto(val id: String)
@Serializable data class CreatedRecordDto(val id: String)
@Serializable data class ListingCreatedDto(val listing: CreatedRecordDto)
@Serializable data class OfferCreatedDto(val offer: CreatedRecordDto)
@Serializable data class IntroductionCreatedDto(val ok: Boolean = false, val introduction: CreatedRecordDto)
@Serializable data class ConfirmedActionDto(val ok: Boolean = false, val status: String? = null,
    val viewing: CreatedViewingReceiptDto? = null, val notificationEffects: NotificationEffects? = null)
@Serializable data class NotificationEffects(val customerNotification: String, val provider: String? = null)
