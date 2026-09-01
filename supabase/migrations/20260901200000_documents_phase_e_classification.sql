-- SegmiQ Documents — Phase E: tags, classification audit, category settings.

ALTER TABLE public.document_company_settings
  ADD COLUMN IF NOT EXISTS suggest_categories_when_uncertain boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_auto_create_category_confidence text NOT NULL DEFAULT 'HIGH'
    CHECK (min_auto_create_category_confidence IN ('HIGH', 'MEDIUM', 'LOW'));

CREATE TABLE IF NOT EXISTS public.document_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_client
  ON public.document_tags (client_id);

CREATE TABLE IF NOT EXISTS public.document_tag_links (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.document_tags(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'AGENT'
    CHECK (source IN ('HUMAN', 'AGENT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_document_tag_links_tag
  ON public.document_tag_links (tag_id);

CREATE TABLE IF NOT EXISTS public.document_classification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  document_type_code text,
  document_type_id uuid REFERENCES public.document_types(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.document_categories(id) ON DELETE SET NULL,
  suggested_category_name text,
  category_action text NOT NULL DEFAULT 'NONE'
    CHECK (category_action IN ('NONE', 'REUSED', 'AUTO_CREATED', 'SUGGESTED', 'SKIPPED')),
  type_confidence text NOT NULL DEFAULT 'LOW'
    CHECK (type_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  category_confidence text NOT NULL DEFAULT 'LOW'
    CHECK (category_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  tags text[] NOT NULL DEFAULT '{}',
  classifier_version text NOT NULL,
  model text,
  needs_review boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_classification_audit_document
  ON public.document_classification_audit (document_id, created_at DESC);

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_classification_audit ENABLE ROW LEVEL SECURITY;
