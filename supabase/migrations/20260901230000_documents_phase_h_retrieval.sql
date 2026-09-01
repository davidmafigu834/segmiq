-- SegmiQ Documents — Phase H: search audit trail for retrieval.

CREATE TABLE IF NOT EXISTS public.document_search_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  document_ids uuid[] NOT NULL DEFAULT '{}',
  chunk_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_search_audit_client
  ON public.document_search_audit (client_id, created_at DESC);

ALTER TABLE public.document_search_audit ENABLE ROW LEVEL SECURITY;
