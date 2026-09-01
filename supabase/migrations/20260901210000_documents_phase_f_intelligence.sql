-- SegmiQ Documents — Phase F: document intelligence (summary, facts, obligations, dates).

CREATE TABLE IF NOT EXISTS public.document_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  summary text,
  purpose text,
  detected_language text,
  extraction_confidence text NOT NULL DEFAULT 'LOW'
    CHECK (extraction_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  generator_version text NOT NULL,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id)
);

CREATE INDEX IF NOT EXISTS idx_document_intelligence_document
  ON public.document_intelligence (document_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS public.document_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  fact_type text NOT NULL,
  label text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL DEFAULT 'LOW'
    CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  page integer,
  section text,
  clause text,
  source_chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  source_excerpt text,
  status text NOT NULL DEFAULT 'EXTRACTED'
    CHECK (status IN ('EXTRACTED', 'CONFIRMED', 'CORRECTED', 'REJECTED')),
  corrected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  corrected_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_facts_document
  ON public.document_facts (document_id, version_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_document_facts_type
  ON public.document_facts (client_id, fact_type)
  WHERE status IN ('EXTRACTED', 'CONFIRMED', 'CORRECTED');

CREATE TABLE IF NOT EXISTS public.document_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  responsible_party_type text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (responsible_party_type IN ('COMPANY', 'CUSTOMER', 'SUPPLIER', 'THIRD_PARTY', 'UNKNOWN')),
  responsible_party_text text,
  action text NOT NULL,
  trigger_type text,
  trigger_description text,
  due_date date,
  due_rule_json jsonb,
  status text NOT NULL DEFAULT 'DETECTED'
    CHECK (status IN ('DETECTED', 'CONFIRMED', 'PENDING', 'COMPLETED', 'WAIVED', 'OVERDUE', 'CANCELLED')),
  page integer,
  clause text,
  source_chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  source_excerpt text,
  linked_task_id uuid,
  confidence text NOT NULL DEFAULT 'LOW'
    CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_obligations_document
  ON public.document_obligations (document_id, version_id);

CREATE TABLE IF NOT EXISTS public.document_important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  date_type text NOT NULL
    CHECK (date_type IN (
      'EFFECTIVE', 'EXPIRY', 'RENEWAL', 'NOTICE', 'DELIVERY',
      'REVIEW', 'SUBMISSION', 'PAYMENT', 'OTHER'
    )),
  label text NOT NULL,
  date_value date,
  date_text text,
  confidence text NOT NULL DEFAULT 'LOW'
    CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  page integer,
  clause text,
  source_chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  source_excerpt text,
  status text NOT NULL DEFAULT 'DETECTED'
    CHECK (status IN ('DETECTED', 'CONFIRMED', 'CORRECTED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_important_dates_document
  ON public.document_important_dates (document_id, version_id, date_type);

CREATE TABLE IF NOT EXISTS public.document_fact_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fact_id uuid NOT NULL REFERENCES public.document_facts(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  field_name text NOT NULL DEFAULT 'value',
  original_value_json jsonb NOT NULL,
  corrected_value_json jsonb NOT NULL,
  document_type_code text,
  extractor_version text,
  corrected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_fact_corrections_fact
  ON public.document_fact_corrections (fact_id, created_at DESC);

ALTER TABLE public.document_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_important_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_fact_corrections ENABLE ROW LEVEL SECURITY;
