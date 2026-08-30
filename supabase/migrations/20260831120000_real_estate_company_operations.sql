-- Company-manager operations for real estate.
-- Additive: listing approval, property management stock, customer complaints.
-- Does not change website ingest or public-site publishing.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_transaction_type_check;
ALTER TABLE listings
  ADD CONSTRAINT listings_transaction_type_check
  CHECK (transaction_type IN ('sale', 'rental', 'new_development', 'property_management'));

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings
  ADD CONSTRAINT listings_status_check
  CHECK (status IN (
    'available',
    'under_offer',
    'reserved',
    'sold',
    'let',
    'rented',
    'under_management'
  ));

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_for_approval_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_approval_status_check;
ALTER TABLE listings
  ADD CONSTRAINT listings_approval_status_check
  CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_listings_client_approval
  ON listings (client_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_listings_client_type
  ON listings (client_id, transaction_type);

COMMENT ON COLUMN listings.approval_status IS
  'Internal CRM approval before a listing is treated as live stock. Existing rows default to approved.';
COMMENT ON COLUMN listings.transaction_type IS
  'sale | rental | new_development | property_management';

CREATE TABLE IF NOT EXISTS customer_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'service'
    CHECK (category IN ('service', 'listing', 'agent', 'transaction', 'other')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_client_status
  ON customer_complaints (client_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_agent
  ON customer_complaints (agent_id)
  WHERE agent_id IS NOT NULL;

COMMENT ON TABLE customer_complaints IS
  'Owner/admin register for customer complaints. Separate from viewing feedback and testimonials.';

ALTER TABLE customer_complaints ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS customer_complaints_set_updated_at ON customer_complaints;
CREATE TRIGGER customer_complaints_set_updated_at
  BEFORE UPDATE ON customer_complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
