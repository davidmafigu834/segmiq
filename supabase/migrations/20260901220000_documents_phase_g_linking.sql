-- SegmiQ Documents — Phase G: CRM entity linking.

CREATE TABLE IF NOT EXISTS public.document_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'CUSTOMER', 'LEAD', 'DEAL', 'QUOTATION',
      'PRODUCT', 'PACKAGE', 'PROJECT', 'USER', 'TEAM', 'SUPPORT_CASE'
    )),
  entity_id uuid NOT NULL,
  link_type text NOT NULL DEFAULT 'RELATED'
    CHECK (link_type IN (
      'PRIMARY_CUSTOMER', 'RELATED_CUSTOMER', 'SOURCE_LEAD', 'SOURCE_DEAL',
      'SOURCE_QUOTATION', 'GENERATED_FROM', 'RELATED', 'MANUAL'
    )),
  confidence text NOT NULL DEFAULT 'LOW'
    CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  source text NOT NULL DEFAULT 'AGENT'
    CHECK (source IN ('HUMAN', 'AGENT')),
  confirmed boolean NOT NULL DEFAULT false,
  match_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_document_entity_links_document
  ON public.document_entity_links (document_id, confirmed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_entity_links_entity
  ON public.document_entity_links (client_id, entity_type, entity_id);

ALTER TABLE public.document_entity_links ENABLE ROW LEVEL SECURITY;
