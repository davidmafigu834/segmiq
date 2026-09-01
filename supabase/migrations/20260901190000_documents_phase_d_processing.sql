-- SegmiQ Documents — Phase D: extraction storage and chunk index (processing pipeline).

CREATE TABLE IF NOT EXISTS public.document_version_content (
  version_id uuid PRIMARY KEY REFERENCES public.document_versions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  plain_text text,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  char_count integer NOT NULL DEFAULT 0,
  word_count integer NOT NULL DEFAULT 0,
  extractor_version text NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_version_content_document
  ON public.document_version_content (document_id);

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  content text NOT NULL,
  page_number integer,
  section_heading text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document
  ON public.document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_version
  ON public.document_chunks (version_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_document_chunks_search
  ON public.document_chunks USING gin (search_vector);

ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS extraction_error text;

ALTER TABLE public.document_processing_jobs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.document_version_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.document_version_content IS
  'Deterministic text extraction output per document version (pages, tables, plain text).';
COMMENT ON TABLE public.document_chunks IS
  'Business-document chunks for retrieval; search_vector supports lexical search.';
