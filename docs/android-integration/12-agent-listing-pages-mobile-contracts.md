# Agent listing pages — Android contracts

The Android app uses the existing Sales Bearer JWT. `clientId` comes from bootstrap. The server uses the token's user. Do not send an agent id as proof of ownership. Do not render the public page inside a second backend. Open the returned `publicUrl` or the Android share sheet.

Base: `/api/clients/{clientId}`

Errors keep `{ "error": string, "code": string }`.

| Status | Meaning |
| --- | --- |
| 400 | Invalid body or range |
| 401 | Missing or rejected Bearer token |
| 403 | `FORBIDDEN`, `CROSS_TENANT_ACCESS`, `FEATURE_DISABLED`, `NOT_AVAILABLE` |
| 404 | Unknown link or organisation |
| 409 | `CAMPAIGN_LIMIT` or already revoked replay is 200 |
| 503 | `MIGRATION_REQUIRED` or `SERVICE_UNAVAILABLE` |

## List links

`GET /listing-shares?page=1&limit=40&status=active&listingId={uuid}&q=`

`status` is `active` or `revoked`. Agents receive only their links. Managers receive the organisation.

```json
{
  "ok": true,
  "page": 1,
  "limit": 40,
  "shares": [
    {
      "id": "8d2c2c4e-1c0a-4d1e-9c1a-0d0c6e0a1111",
      "listingId": "4b1c2d3e-1111-4222-8333-444444444444",
      "agentId": "5c1c2d3e-1111-4222-8333-555555555555",
      "agentName": "Tariro Moyo",
      "campaignLabel": null,
      "status": "active",
      "createdAt": "2026-11-02T18:00:00.000Z",
      "revokedAt": null,
      "publicPath": "/property/borrowdale-a1b2c3d4?ref=opaque",
      "publicUrl": "https://www.segmiq.com/property/borrowdale-a1b2c3d4?ref=opaque",
      "canonicalPath": "/property/borrowdale-a1b2c3d4",
      "listing": {
        "address": "12 Stonechat Lane",
        "suburb": "Borrowdale",
        "status": "available",
        "approvalStatus": "approved",
        "price": 250000,
        "hasAuthorisedPhoto": true
      }
    }
  ]
}
```

`publicUrl` is the share target. `agentName` is the display name stored for that user in the same organisation. Phone numbers are not included. Photographs for the in-app card still use the existing private image endpoint. This payload does not include a signed storage URL.

## Generate or reuse

`POST /listing-shares`

Default link. Repeat calls return the same active link with `reused: true` and HTTP 200. The first create is HTTP 201.

```json
{ "listingId": "4b1c2d3e-1111-4222-8333-444444444444", "campaignLabel": null }
```

Campaign link:

```json
{ "listingId": "4b1c2d3e-1111-4222-8333-444444444444", "campaignLabel": "WhatsApp Status" }
```

```json
{
  "ok": true,
  "reused": false,
  "caption": "Borrowdale. Enquire with Haven Properties.",
  "share": {
    "id": "8d2c2c4e-1c0a-4d1e-9c1a-0d0c6e0a1111",
    "listingId": "4b1c2d3e-1111-4222-8333-444444444444",
    "agentId": "5c1c2d3e-1111-4222-8333-555555555555",
    "campaignLabel": "WhatsApp Status",
    "status": "active",
    "createdAt": "2026-11-02T18:00:00.000Z",
    "revokedAt": null,
    "publicPath": "/property/borrowdale-a1b2c3d4?ref=opaque",
    "publicUrl": "https://www.segmiq.com/property/borrowdale-a1b2c3d4?ref=opaque",
    "canonicalPath": "/property/borrowdale-a1b2c3d4"
  }
}
```

Pass `publicUrl` and `caption` to the Android share sheet. Do not post to a network without the user's share action.

## One link

`GET /listing-shares/{shareId}` → `{ "ok": true, "share": { } }` using the same share object as the list.

## Revoke

`POST /listing-shares/{shareId}/revoke`

```json
{ "reason": "Campaign ended" }
```

```json
{ "ok": true, "status": "revoked" }
```

A second revoke returns the same body. Historical analytics remain. The public ref then shows the unavailable page.

## QR

`GET /listing-shares/{shareId}/qr` → `image/png` for an active link. This is optional for the share sheet.

## Link analytics

`GET /listing-shares/{shareId}/analytics?preset=30d&timeZone=Africa/Harare`

`preset` is `7d`, `30d`, `90d`, or `custom`. Custom also sends `from` and `to` as `YYYY-MM-DD`.

```json
{
  "ok": true,
  "from": "2026-10-04T22:00:00.000Z",
  "to": "2026-11-03T22:00:00.000Z",
  "dayBoundary": "UTC",
  "totals": {
    "visits": 24,
    "previewFetches": 11,
    "engagedViews": 9,
    "uniqueVisitors": 16,
    "whatsappClicks": 4,
    "confirmedWhatsappLeads": 0,
    "enquiries": 3,
    "viewingRequests": 1,
    "linkToEnquiryRate": 12.5
  },
  "series": [{ "day": "2026-11-02", "visits": 6 }],
  "insights": ["Your link received 24 visits in this period."],
  "outcomeNote": null
}
```

`uniqueVisitors` is null when the sample is capped. `whatsappClicks` are taps, not messages. `confirmedWhatsappLeads` stays 0 until a stored inbound message is linked. `viewingRequests` are not booked viewings. `outcomeNote` is present only when a lead is marked won or a transaction row exists, and it says when marketing attribution and ownership differ.

## Summary

`GET /listing-shares/summary?preset=30d&timeZone=Africa/Harare`

```json
{
  "ok": true,
  "from": "2026-10-04T22:00:00.000Z",
  "to": "2026-11-03T22:00:00.000Z",
  "dayBoundary": "UTC",
  "uniqueVisitors": null,
  "activeLinks": 2,
  "listingsMarketed": 2,
  "totals": {
    "visits": 24,
    "previewFetches": 11,
    "engagedViews": 9,
    "uniqueVisitors": null,
    "whatsappClicks": 4,
    "confirmedWhatsappLeads": 0,
    "enquiries": 3,
    "viewingRequests": 1,
    "linkToEnquiryRate": 12.5
  },
  "insights": [],
  "byAgent": [{ "agentId": "5c1c2d3e-1111-4222-8333-555555555555", "agentName": "Tariro Moyo", "links": 2 }]
}
```

`byAgent` is empty for a salesperson. It is an internal count of active links, not a rank.

## Attributed leads

`GET /listing-shares/leads?shareId={uuid}`

`shareId` may be omitted. Agents only receive rows where they are the marketing agent.

```json
{
  "ok": true,
  "leads": [
    {
      "id": "9a1c2d3e-1111-4222-8333-666666666666",
      "lead_id": "7a1c2d3e-1111-4222-8333-777777777777",
      "share_id": "8d2c2c4e-1c0a-4d1e-9c1a-0d0c6e0a1111",
      "listing_id": "4b1c2d3e-1111-4222-8333-444444444444",
      "marketing_agent_id": "5c1c2d3e-1111-4222-8333-555555555555",
      "operational_owner_id": "5c1c2d3e-1111-4222-8333-888888888888",
      "kind": "enquiry",
      "created_at": "2026-11-02T18:04:00.000Z"
    }
  ]
}
```

`kind` is `enquiry` or `viewing_request`. Open the existing lead APIs for the customer record. Do not treat `marketing_agent_id` as the assignee when it differs from `operational_owner_id`.

## Settings and permissions

`GET /listing-pages/settings` for an agent or manager.

`PATCH /listing-pages/settings` is manager-only.

```json
{
  "ok": true,
  "stored": true,
  "suggestedWebsite": "https://haven.example",
  "settings": {
    "enabled": true,
    "agentsMayGenerate": true,
    "publicAgencyName": "Haven Properties",
    "showAgentName": true,
    "showAgentPhoto": true,
    "showAgentPhone": false,
    "publicContactPolicy": "enquiry_form",
    "enquiryRouting": "assign_marketing_agent",
    "catalogueUrl": null,
    "verifiedWebsite": "https://haven.example/",
    "attributionWindowDays": 30,
    "maxCampaignLinks": 8
  }
}
```

`publicContactPolicy`: `enquiry_form`, `agency_whatsapp`, `agent_whatsapp_if_allowed`.

`enquiryRouting`: `assign_marketing_agent`, `agency_assignment`.

If `enabled` or `agentsMayGenerate` is false, create returns `FEATURE_DISABLED`. Reading existing links remains allowed.

## Share status

`share.status` is `active` or `revoked`. A link can also be inactive for new enquiries when the agent is deactivated even before a manager revokes it. The public page enforces that. The list status field stays `active` until someone revokes it, so the app should treat a failed public enquiry as `LINK_INACTIVE` rather than rewriting history.

## Not in this contract

The public enquiry form is the web page. Android does not submit enquiries on behalf of anonymous visitors. Android does not receive a service-role key, a signed listing URL, or another user's analytics.
