-- 048_customer_hub_contacts.sql
-- Customer Hub foundation: contacts table + leads.contact_id + backfill.
-- Additive only. Modifies/removes no existing column or data.
-- Safe to re-run: backfill only touches leads where contact_id IS NULL.

-- 1. contacts table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         text,
  phone        text,            -- best-effort canonical E.164 (e.g. +263772123456)
  email        text,
  location     text,
  source       text,            -- acquisition source (mirrors leads.source values)
  lead_origin  text NOT NULL DEFAULT 'client'
                 CHECK (lead_origin IN ('segmiq','client')),
  lifecycle    text NOT NULL DEFAULT 'lead'
                 CHECK (lifecycle IN ('lead','customer')),
  notes        text,
  tags         text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS: match the dominant CRM pattern — enable, no policies, service-role + app auth.
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_contacts_client_id        ON contacts (client_id);
CREATE INDEX IF NOT EXISTS idx_contacts_client_phone     ON contacts (client_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_client_lifecycle ON contacts (client_id, lifecycle);

-- 2. leads.contact_id --------------------------------------------------------
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_id uuid
  REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads (contact_id);

-- 3. backfill ----------------------------------------------------------------
-- One contact per (client_id, canonical phone). Leads with no phone each get
-- their own contact. Repeat numbers within a client collapse to one contact.
WITH unlinked AS MATERIALIZED (
  SELECT
    l.id, l.client_id, l.name, l.email, l.source, l.status, l.created_at,
    CASE
      WHEN p.digits = ''                              THEN NULL
      WHEN left(p.digits, length(p.dc)) = p.dc        THEN p.digits
      WHEN left(p.digits, 1) = '0'                    THEN p.dc || substr(p.digits, 2)
      ELSE p.dc || p.digits
    END AS canon
  FROM leads l
  JOIN clients c ON c.id = l.client_id
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN left(rd.raw_digits, 2) = '00' THEN substr(rd.raw_digits, 3)
           ELSE rd.raw_digits END AS digits,
      rd.dc
    FROM (
      SELECT
        regexp_replace(COALESCE(l.phone, ''),       '\D', '', 'g') AS raw_digits,
        regexp_replace(COALESCE(c.dial_code, '263'), '\D', '', 'g') AS dc
    ) rd
  ) p
  WHERE l.contact_id IS NULL
),
keyed AS MATERIALIZED (
  SELECT *, COALESCE(canon, 'lead:' || id::text) AS gkey
  FROM unlinked
),
new_contacts AS MATERIALIZED (
  SELECT
    gen_random_uuid() AS new_id,
    client_id,
    gkey,
    CASE WHEN MAX(canon) IS NULL THEN NULL ELSE '+' || MAX(canon) END AS canon_phone,
    (array_agg(name  ORDER BY created_at DESC) FILTER (WHERE name  IS NOT NULL AND name  <> ''))[1] AS name,
    (array_agg(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL AND email <> ''))[1] AS email,
    (array_agg(source ORDER BY created_at ASC))[1] AS first_source,
    bool_or(status = 'WON') AS is_customer,
    MIN(created_at) AS created_at
  FROM keyed
  GROUP BY client_id, gkey
),
ins AS (
  INSERT INTO contacts
    (id, client_id, name, phone, email, source, lead_origin, lifecycle, created_at, updated_at)
  SELECT
    new_id, client_id, name, canon_phone, email, first_source,
    CASE WHEN first_source IN ('LANDING_PAGE','FACEBOOK') THEN 'segmiq' ELSE 'client' END,
    CASE WHEN is_customer THEN 'customer' ELSE 'lead' END,
    created_at, now()
  FROM new_contacts
  RETURNING 1
)
UPDATE leads l
SET contact_id = nc.new_id
FROM new_contacts nc
JOIN keyed k ON k.client_id = nc.client_id AND k.gkey = nc.gkey
WHERE l.id = k.id AND l.contact_id IS NULL;
