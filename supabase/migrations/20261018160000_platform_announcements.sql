-- Platform announcements for Important Messages.
-- Not applied in this change. Drafts stay hidden. Read state is per user.
-- Does not copy buyer introduction rows and does not change the notifications check constraint.

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'whats_new' CHECK (category IN ('whats_new', 'notice')),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'industry', 'role', 'organisation')),
  industry text,
  role_target text,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  href text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcement_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_announcements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_announcement_reads FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.platform_announcements IS
  'Platform-authored Important Messages. Ordinary organisation users cannot publish these.';
