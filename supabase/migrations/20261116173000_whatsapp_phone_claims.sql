-- One in-flight WhatsApp lead create per customer phone.
-- Stops two messages that arrive together from opening two leads for two reps.
-- Service role only. No browser access.

CREATE TABLE IF NOT EXISTS whatsapp_phone_claims (
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone_digits text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, phone_digits)
);

ALTER TABLE whatsapp_phone_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE whatsapp_phone_claims FROM anon, authenticated;
