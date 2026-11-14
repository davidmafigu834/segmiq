-- Listing funnels: one bespoke, SegmiQ-built sales page per listing, and one public handle per agent.
-- Visits, enquiries, and attribution reuse re_agent_listing_shares and re_listing_marketing_events.
-- Access is through SegmiQ server routes (service role). RLS is enabled with no anon policies.

CREATE TABLE IF NOT EXISTS re_listing_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'building'
    CHECK (status IN ('building', 'review', 'live', 'paused')),
  html text,
  html_version integer NOT NULL DEFAULT 0 CHECK (html_version >= 0),
  share_title text,
  share_summary text,
  share_image_url text,
  brief text,
  published_at timestamptz,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT re_listing_funnels_html_size CHECK (html IS NULL OR octet_length(html) <= 2000000),
  CONSTRAINT re_listing_funnels_live_html CHECK (status <> 'live' OR html IS NOT NULL),
  CONSTRAINT re_listing_funnels_title_len CHECK (share_title IS NULL OR char_length(share_title) <= 120),
  CONSTRAINT re_listing_funnels_summary_len CHECK (share_summary IS NULL OR char_length(share_summary) <= 300),
  CONSTRAINT re_listing_funnels_image_https CHECK (share_image_url IS NULL OR share_image_url ~ '^(https://|/)'),
  CONSTRAINT re_listing_funnels_brief_len CHECK (brief IS NULL OR char_length(brief) <= 4000)
);

COMMENT ON TABLE re_listing_funnels IS
  'SegmiQ-authored sales page for one listing. html is a full document served only inside a sandboxed frame with an opaque origin.';
COMMENT ON COLUMN re_listing_funnels.html IS
  'Bespoke document. {{agent.*}}, {{agency.*}} and {{property.*}} placeholders are filled server-side with escaped values.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_listing_funnels_listing ON re_listing_funnels (listing_id);
CREATE INDEX IF NOT EXISTS idx_re_listing_funnels_client ON re_listing_funnels (client_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS re_agent_funnel_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  handle text NOT NULL,
  whatsapp_digits text,
  personal_line text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT re_agent_funnel_profiles_handle_format CHECK (handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(handle) BETWEEN 2 AND 30),
  CONSTRAINT re_agent_funnel_profiles_whatsapp_format CHECK (whatsapp_digits IS NULL OR whatsapp_digits ~ '^[1-9][0-9]{7,14}$'),
  CONSTRAINT re_agent_funnel_profiles_line_len CHECK (personal_line IS NULL OR char_length(personal_line) <= 160)
);

COMMENT ON TABLE re_agent_funnel_profiles IS
  'Public identity an agent chose for funnel links: /property/{slug}/{handle}. WhatsApp number is shown publicly by the agent''s choice.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_re_agent_funnel_profiles_handle ON re_agent_funnel_profiles (client_id, handle);

ALTER TABLE re_listing_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_agent_funnel_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_re_listing_funnels_updated ON re_listing_funnels;
CREATE TRIGGER trg_re_listing_funnels_updated
  BEFORE UPDATE ON re_listing_funnels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_re_agent_funnel_profiles_updated ON re_agent_funnel_profiles;
CREATE TRIGGER trg_re_agent_funnel_profiles_updated
  BEFORE UPDATE ON re_agent_funnel_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
