-- Real estate final corrections. Additive and safe to re-run.
-- Requires the Phase 1 to Phase 4 real estate migrations.
-- Do not apply to production without explicit approval and a backup.
--
-- Contents:
--   1. Property categories on listings, acquisitions, inspections and buyer searches
--   2. Search-specific property interests
--   3. Match notification invalidation
--   4. Viewing reschedule history and reminder dedupe
--   5. Mandate renewal, revocation and superseding
--   6. Professional valuation evidence
--   7. Transaction document review states
--   8. Commission cumulative amounts, payout history and adjustments
--   9. Idempotent legacy commission backfill (unverified only)
--  10. Handover batches, skipped items and retry safety
--  11. Atomic offer acceptance and transaction completion/release functions
--  12. Property register metrics function

DO $$ BEGIN
  IF to_regclass('public.real_estate_commissions') IS NULL
    OR to_regclass('public.real_estate_mandates') IS NULL
    OR to_regclass('public.real_estate_match_notifications') IS NULL
    OR to_regclass('public.real_estate_listing_status_events') IS NULL THEN
    RAISE EXCEPTION 'Apply the real estate Phase 1 to Phase 4 migrations before the final corrections.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Property categories. Legacy rows stay NULL (unclassified).
-- ---------------------------------------------------------------------------

ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_category text;
ALTER TABLE real_estate_acquisition_opportunities ADD COLUMN IF NOT EXISTS property_category text;
ALTER TABLE real_estate_inspections ADD COLUMN IF NOT EXISTS property_category text;
ALTER TABLE real_estate_buyer_searches
  ADD COLUMN IF NOT EXISTS property_categories text[] NOT NULL DEFAULT '{}';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['listings', 'real_estate_acquisition_opportunities', 'real_estate_inspections'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_property_category_check') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (property_category IS NULL OR property_category IN (%L, %L, %L, %L, %L, %L, %L, %L))',
        t, t || '_property_category_check',
        'house', 'apartment', 'townhouse', 'residential_stand', 'commercial', 'industrial', 'agricultural', 'other'
      );
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'real_estate_buyer_searches_property_categories_check') THEN
    ALTER TABLE real_estate_buyer_searches
      ADD CONSTRAINT real_estate_buyer_searches_property_categories_check
      CHECK (property_categories <@ ARRAY[
        'house', 'apartment', 'townhouse', 'residential_stand', 'commercial', 'industrial', 'agricultural', 'other'
      ]::text[]);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_match_candidates
  ON listings (client_id, status, transaction_type, property_category, price);

CREATE INDEX IF NOT EXISTS idx_re_buyer_searches_match
  ON real_estate_buyer_searches (client_id, status, intent, budget_max);

-- ---------------------------------------------------------------------------
-- 2. Search-specific property interests.
-- The contact-wide unique constraint is replaced. Existing rows are kept.
-- Rows without a search keep one row per contact and listing.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_property_interests
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS reset_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_fingerprint text;

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.real_estate_property_interests'::regclass
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attname)
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
      ) = ARRAY['client_id', 'contact_id', 'listing_id']
  LOOP
    EXECUTE format('ALTER TABLE real_estate_property_interests DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_interests_search_listing
  ON real_estate_property_interests (client_id, search_id, listing_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_interests_unscoped_contact_listing
  ON real_estate_property_interests (client_id, contact_id, listing_id)
  WHERE search_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_re_interests_contact_rejections
  ON real_estate_property_interests (client_id, contact_id, interest_state)
  WHERE interest_state = 'not_interested';

-- ---------------------------------------------------------------------------
-- 3. Match notification invalidation. Rows are kept for history.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_match_notifications
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_reason text;

CREATE INDEX IF NOT EXISTS idx_re_match_notifications_live
  ON real_estate_match_notifications (client_id, listing_id)
  WHERE invalidated_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Viewings: reschedule history and reminder dedupe.
-- ---------------------------------------------------------------------------

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS previous_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_sent_for timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_viewings_client_agent_time
  ON viewings (client_id, agent_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- 5. Mandates: renewal, revocation and superseding.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_mandates
  ADD COLUMN IF NOT EXISTS previous_mandate_id uuid REFERENCES real_estate_mandates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by_id uuid REFERENCES real_estate_mandates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revocation_effective_date date,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revocation_reference text,
  ADD COLUMN IF NOT EXISTS renewal_requested_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_re_mandates_previous
  ON real_estate_mandates (previous_mandate_id)
  WHERE previous_mandate_id IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT listing_id FROM real_estate_mandates
    WHERE status = 'approved' AND listing_id IS NOT NULL
    GROUP BY listing_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped idx_re_mandates_one_approved_listing: some listings have more than one approved mandate. Review them, then re-run.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_re_mandates_one_approved_listing
      ON real_estate_mandates (listing_id)
      WHERE status = 'approved' AND listing_id IS NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Professional valuation evidence. NOT VALID keeps legacy rows.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_price_discussions
  ADD COLUMN IF NOT EXISTS verification_reference text,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 're_price_professional_valuation_evidence') THEN
    ALTER TABLE real_estate_price_discussions
      ADD CONSTRAINT re_price_professional_valuation_evidence
      CHECK (
        price_type <> 'professional_valuation'
        OR document_id IS NOT NULL
        OR nullif(btrim(coalesce(verification_reference, '')), '') IS NOT NULL
      ) NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Transaction documents: review workflow.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_transaction_documents
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS replaces_document_link_id uuid REFERENCES real_estate_transaction_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES real_estate_transaction_milestones(id) ON DELETE SET NULL;

ALTER TABLE real_estate_transaction_documents
  DROP CONSTRAINT IF EXISTS real_estate_transaction_documents_review_status_check;
ALTER TABLE real_estate_transaction_documents
  ADD CONSTRAINT real_estate_transaction_documents_review_status_check
  CHECK (review_status IN (
    'missing', 'uploaded', 'awaiting_review', 'under_review', 'verified', 'rejected', 'replacement_requested'
  ));

ALTER TABLE real_estate_transaction_milestones
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_re_txn_ms_assignee
  ON real_estate_transaction_milestones (client_id, assigned_to_id, status)
  WHERE assigned_to_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_re_participants_txn_active
  ON real_estate_deal_participants (client_id, transaction_id)
  WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- 8. Commissions: cumulative amounts that later statuses never clear.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_commissions
  ADD COLUMN IF NOT EXISTS earned_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoiced_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reported_received_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_received_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_received_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_fields jsonb;

ALTER TABLE real_estate_commission_allocations
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_payout_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusts_allocation_id uuid REFERENCES real_estate_commission_allocations(id) ON DELETE SET NULL;

ALTER TABLE real_estate_commission_allocations
  DROP CONSTRAINT IF EXISTS real_estate_commission_allocations_approval_status_check;
ALTER TABLE real_estate_commission_allocations
  ADD CONSTRAINT real_estate_commission_allocations_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'superseded'));

ALTER TABLE real_estate_commission_disputes
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjustment_allocation_id uuid REFERENCES real_estate_commission_allocations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS real_estate_commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES real_estate_commissions(id) ON DELETE CASCADE,
  allocation_id uuid NOT NULL REFERENCES real_estate_commission_allocations(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'rejected')),
  reference text,
  paid_on date,
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_payouts_allocation
  ON real_estate_commission_payouts (client_id, allocation_id, status);

CREATE INDEX IF NOT EXISTS idx_re_commission_events_commission
  ON real_estate_commission_events (client_id, commission_id, created_at);

CREATE INDEX IF NOT EXISTS idx_re_commissions_txn
  ON real_estate_commissions (client_id, transaction_id);

ALTER TABLE real_estate_commission_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE real_estate_commission_payouts FROM PUBLIC, anon, authenticated;

-- Carry forward amounts already implied by current statuses, once.
UPDATE real_estate_commissions
SET earned_cents = gross_cents, earned_at = coalesce(earned_at, updated_at)
WHERE earned_cents = 0
  AND status IN ('earned', 'invoiced', 'reported_received', 'verified_received', 'allocation_approved', 'partially_paid', 'paid');

UPDATE real_estate_commissions
SET invoiced_cents = gross_cents, invoiced_at = coalesce(invoiced_at, updated_at)
WHERE invoiced_cents = 0
  AND status IN ('invoiced', 'reported_received', 'verified_received', 'allocation_approved', 'partially_paid', 'paid');

UPDATE real_estate_commissions
SET reported_received_cents = gross_cents, reported_received_at = coalesce(reported_received_at, updated_at)
WHERE reported_received_cents = 0
  AND status IN ('reported_received', 'verified_received', 'allocation_approved', 'partially_paid', 'paid');

UPDATE real_estate_commissions
SET verified_received_cents = gross_cents, verified_received_at = coalesce(verified_received_at, updated_at)
WHERE verified_received_cents = 0
  AND status IN ('verified_received', 'allocation_approved', 'partially_paid', 'paid');

-- ---------------------------------------------------------------------------
-- 9. Legacy commission backfill. Unverified only. Safe to re-run.
-- Original amounts, percentages and settlement dates are kept in legacy_fields.
-- commission_settled_at is not treated as a verified receipt.
-- ---------------------------------------------------------------------------

INSERT INTO real_estate_commissions (
  client_id, transaction_id, basis_cents, mode, basis_points, fixed_cents, gross_cents,
  currency, status, provenance, legacy_fields, created_at, updated_at
)
SELECT
  t.client_id,
  t.id,
  round(t.agreed_price * 100)::bigint,
  'fixed',
  NULL,
  round((coalesce(t.listing_agent_commission_amount, 0) + coalesce(t.selling_agent_commission_amount, 0)) * 100)::bigint,
  round((coalesce(t.listing_agent_commission_amount, 0) + coalesce(t.selling_agent_commission_amount, 0)) * 100)::bigint,
  coalesce(t.currency, 'USD'),
  'unverified_legacy',
  'legacy_transaction_fields',
  jsonb_build_object(
    'agreed_price', t.agreed_price,
    'listing_agent_commission_pct', t.listing_agent_commission_pct,
    'selling_agent_commission_pct', t.selling_agent_commission_pct,
    'listing_agent_commission_amount', t.listing_agent_commission_amount,
    'selling_agent_commission_amount', t.selling_agent_commission_amount,
    'commission_settled_at', t.commission_settled_at,
    'commission_notes', t.commission_notes,
    'listing_agent_id', t.listing_agent_id,
    'buyer_agent_id', t.buyer_agent_id,
    'transaction_status', t.status,
    'amounts_recorded', (t.listing_agent_commission_amount IS NOT NULL OR t.selling_agent_commission_amount IS NOT NULL)
  ),
  now(),
  now()
FROM real_estate_transactions t
WHERE (
    t.listing_agent_commission_pct IS NOT NULL
    OR t.selling_agent_commission_pct IS NOT NULL
    OR t.listing_agent_commission_amount IS NOT NULL
    OR t.selling_agent_commission_amount IS NOT NULL
    OR t.commission_settled_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM real_estate_commissions c
    WHERE c.transaction_id = t.id AND c.provenance = 'legacy_transaction_fields'
  )
ON CONFLICT DO NOTHING;

INSERT INTO real_estate_commission_allocations (
  client_id, commission_id, beneficiary_id, participant_role, mode, basis_points, fixed_cents,
  amount_cents, absorbs_remainder, approval_status, notes
)
SELECT
  c.client_id, c.id, t.listing_agent_id, 'listing_agent', 'fixed', NULL,
  round(t.listing_agent_commission_amount * 100)::bigint,
  round(t.listing_agent_commission_amount * 100)::bigint,
  false, 'pending',
  'Imported from legacy transaction fields. Not verified.'
FROM real_estate_commissions c
JOIN real_estate_transactions t ON t.id = c.transaction_id
WHERE c.provenance = 'legacy_transaction_fields'
  AND t.listing_agent_commission_amount IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM real_estate_commission_allocations a
    WHERE a.commission_id = c.id AND a.participant_role = 'listing_agent'
  );

INSERT INTO real_estate_commission_allocations (
  client_id, commission_id, beneficiary_id, participant_role, mode, basis_points, fixed_cents,
  amount_cents, absorbs_remainder, approval_status, notes
)
SELECT
  c.client_id, c.id, t.buyer_agent_id, 'buyer_agent', 'fixed', NULL,
  round(t.selling_agent_commission_amount * 100)::bigint,
  round(t.selling_agent_commission_amount * 100)::bigint,
  false, 'pending',
  'Imported from legacy transaction fields. Not verified.'
FROM real_estate_commissions c
JOIN real_estate_transactions t ON t.id = c.transaction_id
WHERE c.provenance = 'legacy_transaction_fields'
  AND t.selling_agent_commission_amount IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM real_estate_commission_allocations a
    WHERE a.commission_id = c.id AND a.participant_role = 'buyer_agent'
  );

INSERT INTO real_estate_commission_events (client_id, commission_id, event_type, to_value, amount_cents, note)
SELECT c.client_id, c.id, 'legacy_imported', 'unverified_legacy', c.gross_cents,
  'Copied from legacy transaction commission fields. Not a verified receipt.'
FROM real_estate_commissions c
WHERE c.provenance = 'legacy_transaction_fields'
  AND NOT EXISTS (
    SELECT 1 FROM real_estate_commission_events e
    WHERE e.commission_id = c.id AND e.event_type = 'legacy_imported'
  );

-- ---------------------------------------------------------------------------
-- 10. Handovers.
-- ---------------------------------------------------------------------------

ALTER TABLE real_estate_handovers
  ADD COLUMN IF NOT EXISTS to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preview_fingerprint text;

ALTER TABLE real_estate_handovers DROP CONSTRAINT IF EXISTS real_estate_handovers_status_check;
ALTER TABLE real_estate_handovers
  ADD CONSTRAINT real_estate_handovers_status_check
  CHECK (status IN ('draft', 'in_progress', 'completed', 'partial'));

ALTER TABLE real_estate_handover_items
  ADD COLUMN IF NOT EXISTS record_label text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

ALTER TABLE real_estate_handover_items DROP CONSTRAINT IF EXISTS real_estate_handover_items_status_check;
ALTER TABLE real_estate_handover_items
  ADD CONSTRAINT real_estate_handover_items_status_check
  CHECK (status IN ('pending', 'applied', 'failed', 'skipped'));

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM real_estate_handover_items
    GROUP BY handover_id, record_type, record_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped idx_re_handover_items_unique: duplicate handover items exist.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_re_handover_items_unique
      ON real_estate_handover_items (handover_id, record_type, record_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11. Atomic state changes. SECURITY INVOKER: callers need table rights,
-- which only the service role has. Business errors raise 'RE4xx: message'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_accept_offer(
  p_client_id uuid,
  p_offer_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb,
  p_actor_id uuid,
  p_event_amount numeric,
  p_event_note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_offer real_estate_offers%ROWTYPE;
  v_patch real_estate_offers%ROWTYPE;
  v_listing_status text;
  v_other integer;
BEGIN
  SELECT * INTO v_offer FROM real_estate_offers
  WHERE id = p_offer_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Offer not found.'; END IF;

  SELECT status INTO v_listing_status FROM listings
  WHERE id = v_offer.listing_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Listing not found.'; END IF;

  IF v_offer.status = 'accepted' AND coalesce(v_offer.reserves_listing, false) THEN
    RETURN jsonb_build_object('offer', to_jsonb(v_offer), 'idempotent', true, 'listing_status', v_listing_status);
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_offer.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'RE409: This offer was updated by someone else. Refresh and try again.';
  END IF;

  IF v_listing_status IN ('sold', 'let', 'rented', 'under_management') THEN
    RAISE EXCEPTION 'RE409: This listing is already closed. Accepting another offer would contradict that status.';
  END IF;

  SELECT count(*) INTO v_other FROM real_estate_offers
  WHERE client_id = p_client_id AND listing_id = v_offer.listing_id
    AND id <> p_offer_id AND reserves_listing = true;
  IF v_other > 0 THEN
    RAISE EXCEPTION 'RE409: Another accepted offer already reserves this listing. Complete, cancel, or mark that transaction fallen through before accepting a different offer.';
  END IF;

  IF coalesce(v_listing_status, '') NOT IN ('available', 'reserved', 'under_offer', '') THEN
    RAISE EXCEPTION 'RE400: Cannot accept an offer while the listing is %.', v_listing_status;
  END IF;

  v_patch := jsonb_populate_record(NULL::real_estate_offers, p_patch);

  UPDATE real_estate_offers SET
    status = 'accepted',
    accepted_at = coalesce(CASE WHEN p_patch ? 'accepted_at' THEN v_patch.accepted_at END, now()),
    current_offer_amount = CASE WHEN p_patch ? 'current_offer_amount' THEN v_patch.current_offer_amount ELSE current_offer_amount END,
    original_offer_amount = CASE WHEN p_patch ? 'original_offer_amount' THEN v_patch.original_offer_amount ELSE original_offer_amount END,
    conditions = CASE WHEN p_patch ? 'conditions' THEN v_patch.conditions ELSE conditions END,
    expiry_date = CASE WHEN p_patch ? 'expiry_date' THEN v_patch.expiry_date ELSE expiry_date END,
    internal_notes = CASE WHEN p_patch ? 'internal_notes' THEN v_patch.internal_notes ELSE internal_notes END,
    submitted_at = CASE WHEN p_patch ? 'submitted_at' THEN v_patch.submitted_at ELSE submitted_at END,
    reserves_listing = true
  WHERE id = p_offer_id AND client_id = p_client_id
  RETURNING * INTO v_offer;

  IF coalesce(v_listing_status, '') <> 'under_offer' THEN
    UPDATE listings SET status = 'under_offer', updated_at = now()
    WHERE id = v_offer.listing_id AND client_id = p_client_id;
    INSERT INTO real_estate_listing_status_events (client_id, listing_id, from_status, to_status, reason, actor_id, offer_id)
    VALUES (p_client_id, v_offer.listing_id, v_listing_status, 'under_offer', 'offer_accepted', p_actor_id, p_offer_id);
  END IF;

  INSERT INTO real_estate_offer_events (offer_id, client_id, event_type, amount, note, created_by)
  VALUES (p_offer_id, p_client_id, 'OFFER_ACCEPTED', coalesce(p_event_amount, v_offer.current_offer_amount), p_event_note, p_actor_id);

  RETURN jsonb_build_object('offer', to_jsonb(v_offer), 'idempotent', false, 'listing_status', 'under_offer');
END;
$$;

CREATE OR REPLACE FUNCTION public.re_finish_transaction(
  p_client_id uuid,
  p_transaction_id uuid,
  p_action text,
  p_reason text,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_txn real_estate_transactions%ROWTYPE;
  v_listing_status text;
  v_approval text;
  v_target text;
  v_other integer;
  v_agreement boolean;
  v_remaining_offers integer;
  v_held_from text;
  v_next text;
  v_cancelled integer := 0;
  r record;
BEGIN
  IF p_action NOT IN ('complete', 'fallen_through', 'cancel') THEN
    RAISE EXCEPTION 'RE400: Unknown action.';
  END IF;

  SELECT * INTO v_txn FROM real_estate_transactions
  WHERE id = p_transaction_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Transaction not found.'; END IF;

  SELECT status, approval_status INTO v_listing_status, v_approval FROM listings
  WHERE id = v_txn.listing_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RE404: Listing not found.'; END IF;

  IF p_action = 'complete' THEN
    v_target := CASE v_txn.transaction_type
      WHEN 'rental' THEN 'let'
      WHEN 'property_management' THEN 'under_management'
      ELSE 'sold'
    END;

    IF v_txn.status = 'completed' THEN
      IF v_txn.offer_id IS NOT NULL THEN
        UPDATE real_estate_offers SET reserves_listing = false
        WHERE id = v_txn.offer_id AND client_id = p_client_id AND reserves_listing = true;
      END IF;
      RETURN jsonb_build_object('transaction', to_jsonb(v_txn), 'idempotent', true, 'listing_status', v_listing_status);
    END IF;

    IF v_txn.status NOT IN ('draft', 'pending_compliance', 'in_progress') THEN
      RAISE EXCEPTION 'RE400: Cannot complete this transaction.';
    END IF;

    SELECT count(*) INTO v_other FROM real_estate_transactions
    WHERE client_id = p_client_id AND listing_id = v_txn.listing_id AND id <> p_transaction_id
      AND status IN ('draft', 'pending_compliance', 'in_progress');
    IF v_other > 0 THEN
      RAISE EXCEPTION 'RE409: Another active transaction still exists for this listing. Resolve it before completing this one.';
    END IF;

    v_agreement := v_txn.agreement_signed_at IS NOT NULL OR EXISTS (
      SELECT 1 FROM real_estate_transaction_milestones
      WHERE transaction_id = p_transaction_id AND milestone_key = 'agreement_signed' AND status IN ('done', 'skipped')
    );
    IF NOT v_agreement THEN
      RAISE EXCEPTION 'RE400: Record the agreement as signed before completing the transaction.';
    END IF;

    IF v_listing_status IN ('sold', 'let', 'rented', 'under_management') AND v_listing_status <> v_target THEN
      RAISE EXCEPTION 'RE409: Listing is already %. Completing this transaction would not change it to %.', v_listing_status, v_target;
    END IF;
    IF coalesce(v_listing_status, '') NOT IN ('available', 'reserved', 'under_offer', '', v_target) THEN
      RAISE EXCEPTION 'RE400: Cannot complete while the listing status is %.', v_listing_status;
    END IF;

    UPDATE real_estate_transactions SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = p_transaction_id AND client_id = p_client_id
    RETURNING * INTO v_txn;

    INSERT INTO real_estate_transaction_events (transaction_id, client_id, event_type, note, payload, created_by)
    VALUES (p_transaction_id, p_client_id, 'COMPLETION_RECORDED', coalesce(p_reason, 'Transaction completed'),
      jsonb_build_object('listing_status', v_target), p_actor_id);

    IF coalesce(v_listing_status, '') <> v_target THEN
      UPDATE listings SET status = v_target, updated_at = now()
      WHERE id = v_txn.listing_id AND client_id = p_client_id;
      INSERT INTO real_estate_listing_status_events (client_id, listing_id, from_status, to_status, reason, actor_id, offer_id, transaction_id)
      VALUES (p_client_id, v_txn.listing_id, v_listing_status, v_target, 'transaction_completed', p_actor_id, v_txn.offer_id, p_transaction_id);
    END IF;

    IF v_txn.offer_id IS NOT NULL THEN
      UPDATE real_estate_offers SET reserves_listing = false
      WHERE id = v_txn.offer_id AND client_id = p_client_id;
    END IF;

    UPDATE real_estate_match_notifications SET invalidated_at = now(), invalidated_reason = 'listing_' || v_target
    WHERE client_id = p_client_id AND listing_id = v_txn.listing_id AND invalidated_at IS NULL;

    RETURN jsonb_build_object('transaction', to_jsonb(v_txn), 'idempotent', false, 'listing_status', v_target);
  END IF;

  -- fallen_through or cancel
  IF (p_action = 'fallen_through' AND v_txn.status = 'fallen_through')
    OR (p_action = 'cancel' AND v_txn.status = 'cancelled') THEN
    RETURN jsonb_build_object('transaction', to_jsonb(v_txn), 'idempotent', true, 'listing_status', v_listing_status);
  END IF;
  IF v_txn.status NOT IN ('draft', 'pending_compliance', 'in_progress') THEN
    RAISE EXCEPTION 'RE400: This transaction is already %.', v_txn.status;
  END IF;

  IF p_action = 'fallen_through' THEN
    UPDATE real_estate_transactions SET status = 'fallen_through', fallen_through_at = now(),
      fallen_through_reason = p_reason, updated_at = now()
    WHERE id = p_transaction_id AND client_id = p_client_id
    RETURNING * INTO v_txn;
    INSERT INTO real_estate_transaction_events (transaction_id, client_id, event_type, note, created_by)
    VALUES (p_transaction_id, p_client_id, 'FALLEN_THROUGH', coalesce(p_reason, 'Fallen through'), p_actor_id);
  ELSE
    UPDATE real_estate_transactions SET status = 'cancelled', updated_at = now()
    WHERE id = p_transaction_id AND client_id = p_client_id
    RETURNING * INTO v_txn;
    INSERT INTO real_estate_transaction_events (transaction_id, client_id, event_type, note, created_by)
    VALUES (p_transaction_id, p_client_id, 'CANCELLED', coalesce(p_reason, 'Cancelled'), p_actor_id);
  END IF;

  IF v_txn.offer_id IS NOT NULL THEN
    UPDATE real_estate_offers SET reserves_listing = false
    WHERE id = v_txn.offer_id AND client_id = p_client_id;
  END IF;

  SELECT count(*) INTO v_remaining_offers FROM real_estate_offers
  WHERE client_id = p_client_id AND listing_id = v_txn.listing_id AND reserves_listing = true;
  SELECT count(*) INTO v_other FROM real_estate_transactions
  WHERE client_id = p_client_id AND listing_id = v_txn.listing_id AND id <> p_transaction_id
    AND status IN ('draft', 'pending_compliance', 'in_progress');

  v_next := NULL;
  IF v_listing_status NOT IN ('sold', 'let', 'rented', 'under_management') THEN
    IF v_remaining_offers > 0 OR v_other > 0 THEN
      IF v_listing_status IN ('available', 'reserved') THEN v_next := 'under_offer'; END IF;
    ELSIF v_listing_status = 'under_offer' THEN
      IF coalesce(v_approval, 'approved') <> 'approved' THEN
        v_next := 'reserved';
      ELSE
        SELECT from_status INTO v_held_from FROM real_estate_listing_status_events
        WHERE client_id = p_client_id AND listing_id = v_txn.listing_id AND to_status = 'under_offer'
        ORDER BY created_at DESC LIMIT 1;
        IF v_held_from = 'reserved' THEN
          v_next := 'reserved';
        ELSIF v_held_from IN ('sold', 'let', 'rented', 'under_management') THEN
          v_next := NULL;
        ELSE
          v_next := 'available';
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_next IS NOT NULL AND v_next <> v_listing_status THEN
    UPDATE listings SET status = v_next, updated_at = now()
    WHERE id = v_txn.listing_id AND client_id = p_client_id;
    INSERT INTO real_estate_listing_status_events (client_id, listing_id, from_status, to_status, reason, actor_id, offer_id, transaction_id)
    VALUES (p_client_id, v_txn.listing_id, v_listing_status, v_next,
      CASE WHEN p_action = 'fallen_through' THEN 'transaction_fallen_through' ELSE 'transaction_cancelled' END,
      p_actor_id, v_txn.offer_id, p_transaction_id);
  END IF;

  FOR r IN
    SELECT id, status FROM real_estate_commissions
    WHERE client_id = p_client_id AND transaction_id = p_transaction_id
      AND status NOT IN ('cancelled', 'verified_received', 'paid', 'partially_paid')
      AND verified_received_cents = 0
    FOR UPDATE
  LOOP
    UPDATE real_estate_commissions SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = r.id;
    INSERT INTO real_estate_commission_events (client_id, commission_id, event_type, from_value, to_value, actor_id, note)
    VALUES (p_client_id, r.id, 'cancelled_with_transaction', r.status, 'cancelled', p_actor_id,
      'The transaction failed. This commission was not verified as received.');
    v_cancelled := v_cancelled + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'transaction', to_jsonb(v_txn),
    'idempotent', false,
    'listing_status', coalesce(v_next, v_listing_status),
    'commissions_cancelled', v_cancelled
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. Property register metrics, aggregated in one round trip.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_listing_register_metrics(p_client_id uuid, p_listing_ids uuid[])
RETURNS TABLE (
  listing_id uuid,
  interest_count bigint,
  search_count bigint,
  viewing_count bigint,
  upcoming_viewing_count bigint,
  offer_count bigint,
  active_transaction_id uuid,
  mandate_status text,
  mandate_expiry date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    l.id,
    (SELECT count(*) FROM real_estate_property_interests i
      WHERE i.client_id = p_client_id AND i.listing_id = l.id
        AND coalesce(i.interest_state, '') <> 'not_interested'),
    (SELECT count(DISTINCT i.search_id) FROM real_estate_property_interests i
      WHERE i.client_id = p_client_id AND i.listing_id = l.id AND i.search_id IS NOT NULL
        AND coalesce(i.interest_state, '') <> 'not_interested'),
    (SELECT count(*) FROM viewings v WHERE v.listing_id = l.id AND coalesce(v.status, '') <> 'cancelled'),
    (SELECT count(*) FROM viewings v
      WHERE v.listing_id = l.id AND v.status = 'scheduled' AND v.scheduled_at >= now()),
    (SELECT count(*) FROM real_estate_offers o
      WHERE o.client_id = p_client_id AND o.listing_id = l.id
        AND o.status IN ('submitted', 'countered', 'negotiating', 'accepted')),
    (SELECT t.id FROM real_estate_transactions t
      WHERE t.client_id = p_client_id AND t.listing_id = l.id
        AND t.status IN ('draft', 'pending_compliance', 'in_progress')
      ORDER BY t.created_at DESC LIMIT 1),
    (SELECT m.status FROM real_estate_mandates m
      WHERE m.client_id = p_client_id AND m.listing_id = l.id
      ORDER BY (m.status = 'approved') DESC, m.created_at DESC LIMIT 1),
    (SELECT m.expiry_date FROM real_estate_mandates m
      WHERE m.client_id = p_client_id AND m.listing_id = l.id
      ORDER BY (m.status = 'approved') DESC, m.created_at DESC LIMIT 1)
  FROM listings l
  WHERE l.client_id = p_client_id AND l.id = ANY (p_listing_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.re_accept_offer(uuid, uuid, timestamptz, jsonb, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.re_finish_transaction(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.re_listing_register_metrics(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.re_accept_offer(uuid, uuid, timestamptz, jsonb, uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.re_finish_transaction(uuid, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.re_listing_register_metrics(uuid, uuid[]) TO service_role;

COMMENT ON FUNCTION public.re_accept_offer IS
  'Accepts an offer and holds the listing in one transaction. Idempotent for an already accepted, reserving offer.';
COMMENT ON FUNCTION public.re_finish_transaction IS
  'Completes, cancels or marks a transaction fallen through with listing status, events and commission cancellation in one transaction. Never cancels verified or paid commissions.';
COMMENT ON COLUMN real_estate_commissions.verified_received_cents IS
  'Cumulative verified receipt. Later statuses never clear it.';
