-- Provider-neutral WhatsApp connections and temporary linked-device beta.
-- Existing Meta Cloud API configuration remains valid and is treated as the
-- legacy primary connection until a connection row is explicitly created.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS whatsapp_temporary_web_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('META_CLOUD', 'TEMPORARY_WEB', 'META_COEXISTENCE')),
  status text NOT NULL DEFAULT 'DISCONNECTED' CHECK (status IN (
    'DISCONNECTED', 'INITIALIZING', 'AWAITING_QR', 'CONNECTING', 'CONNECTED',
    'DEGRADED', 'RECONNECTING', 'RECONNECT_REQUIRED', 'DISCONNECTING', 'ERROR'
  )),
  is_primary boolean NOT NULL DEFAULT true,
  display_name text,
  phone_number text,
  provider_account_id text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_seen_at timestamptz,
  last_requested_at timestamptz,
  last_error_code text,
  last_error_message text,
  reconnect_attempts integer NOT NULL DEFAULT 0,
  session_ciphertext text,
  session_iv text,
  session_auth_tag text,
  session_key_version integer NOT NULL DEFAULT 1,
  worker_id text,
  worker_lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_connections_primary_client
  ON whatsapp_connections (client_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_status
  ON whatsapp_connections (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_connection_qr_challenges (
  connection_id uuid PRIMARY KEY REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  qr_ciphertext text NOT NULL,
  qr_iv text NOT NULL,
  qr_auth_tag text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_connection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  safe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connection_events_connection
  ON whatsapp_connection_events (connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_gateway_nonces (
  nonce text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'META_CLOUD',
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sender_source text CHECK (
    sender_source IS NULL OR sender_source IN ('CUSTOMER', 'SEGMIQ_USER', 'EXTERNAL_BUSINESS_DEVICE', 'SYSTEM')
  );

DROP INDEX IF EXISTS idx_whatsapp_messages_provider_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_provider_identity
  ON whatsapp_messages (client_id, provider_type, provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_connection_created
  ON whatsapp_messages (connection_id, created_at DESC)
  WHERE connection_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_external_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  whatsapp_message_id uuid REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  provider_type text NOT NULL,
  provider_message_id text NOT NULL,
  remote_chat_id text,
  sender_source text NOT NULL CHECK (
    sender_source IN ('CUSTOMER', 'SEGMIQ_USER', 'EXTERNAL_BUSINESS_DEVICE', 'SYSTEM')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, provider_type, provider_message_id)
);

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connection_qr_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_gateway_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_external_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN whatsapp_connections.session_ciphertext IS
  'AES-256-GCM encrypted provider authentication state. Never return to browser clients.';
COMMENT ON TABLE whatsapp_connection_qr_challenges IS
  'Short-lived encrypted QR payloads. Accessible only through service-role APIs.';
