# Website Integration (external estate sites)

SegmiQ accepts leads from a client’s own website (e.g. **Landlords Junction Properties**) via a per-client API key.

## Setup (SegmiQ)

1. Create or open the agency client with `business_type = real_estate`.
2. Add agents (`SALESPERSON`) with phones matching the website agent profiles.
3. Optionally create listings with `external_reference` = the website property **slug**.
4. **Client Settings → Website Integration → Generate key** (`sk_live_…`).
5. Prefer `assignment_mode = direct` when the website sends `agent_reference`, or `round_robin` otherwise.

### Demo seed for Landlords Junction

```bash
# Run in SegmiQ Supabase SQL editor (or psql):
# scripts/seed-landlords-junction.sql
```

Demo API key: run `scripts/seed-landlords-junction.sql` — the script prints the key via `RAISE NOTICE`. Do not commit live keys into docs.

Agent logins (password set in the seed script header):

- `thandi@landlordsjunction.co.zw`
- `brian@landlordsjunction.co.zw`
- `rudo@landlordsjunction.co.zw`
- Manager: `admin@landlordsjunction.co.zw`

## Setup (website)

```env
SEGMIQ_API_URL=https://your-segmiq-host
SEGMIQ_WEBSITE_API_KEY=sk_live_…
```

## Endpoint

`POST /api/external-leads/submit`

**Auth (any one):**

- JSON body: `"api_key": "sk_live_…"`
- Header: `Authorization: Bearer sk_live_…`
- Header: `x-api-key: sk_live_…`

**Body fields:**

| Field | Required | Notes |
|-------|----------|--------|
| `name` / `phone` / `email` | ≥1 | Contact identity |
| `message` | no | Stored on the lead |
| `source` | no | `"website"` (default) |
| `listing_reference` | no | Matches `listings.external_reference` (slug) or address |
| `agent_reference` | no | Matches agent phone → assigns that agent |
| `enquiry_type` | no | `GENERAL` \| `PROPERTY` \| `SELL` (also accepts `type`) |
| `deal_side` | no | Override: `buy_side` \| `sell_side` \| `landlord_side` \| `tenant_side` |

**Enquiry type → deal_side**

| enquiry_type | deal_side |
|--------------|-----------|
| `PROPERTY` | `buy_side` |
| `SELL` | `sell_side` |
| `GENERAL` | *(none)* |

**Success:** `{ "ok": true, "lead_id": "…", "agent_matched": true, "listing_linked": true, … }`  

**Soft failures** often return **HTTP 200** with `{ "ok": false, "soft_fail": true, "error": "…" }` — always check `ok`.

## Example

```bash
curl -X POST https://your-segmiq-host/api/external-leads/submit \
  -H "Content-Type: application/json" \
  -d '{
  "api_key": "sk_live_…",
  "source": "website",
  "enquiry_type": "PROPERTY",
  "listing_reference": "3-bedroom-house-hillside",
  "agent_reference": "+263 77 123 4567",
  "name": "Jane Doe",
  "phone": "+263771111111",
  "email": "jane@example.com",
  "message": "I would like a viewing this weekend."
}'
```
