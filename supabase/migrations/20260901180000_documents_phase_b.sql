-- SegmiQ Documents — Phase B: core document foundation.
-- Company-scoped intelligent document storage (distinct from legacy client_documents sales collateral).

-- ---------------------------------------------------------------------------
-- System + company document types
CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (client_id, code)
);

COMMENT ON TABLE public.document_types IS
  'Document type taxonomy. client_id NULL = system type; non-null = company custom type.';

-- ---------------------------------------------------------------------------
-- Hierarchical categories (separate from type)
CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES public.document_categories(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  creation_source text NOT NULL DEFAULT 'HUMAN'
    CHECK (creation_source IN ('HUMAN', 'AGENT')),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'MERGED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_categories_client
  ON public.document_categories (client_id, status);

-- ---------------------------------------------------------------------------
-- Core document record
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  original_file_name text NOT NULL,
  document_type_id uuid REFERENCES public.document_types(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.document_categories(id) ON DELETE SET NULL,
  lifecycle_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (lifecycle_status IN (
      'DRAFT', 'UNDER_REVIEW', 'FINAL', 'SIGNED', 'ACTIVE',
      'EXPIRED', 'TERMINATED', 'SUPERSEDED', 'ARCHIVED'
    )),
  processing_status text NOT NULL DEFAULT 'UPLOADED'
    CHECK (processing_status IN (
      'UPLOADED', 'QUEUED', 'EXTRACTING', 'ANALYZING', 'INDEXING',
      'READY', 'NEEDS_REVIEW', 'FAILED'
    )),
  current_version_id uuid,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  owning_team_id uuid,
  source text NOT NULL DEFAULT 'UPLOAD'
    CHECK (source IN (
      'UPLOAD', 'EMAIL_IMPORT', 'CRM_GENERATED', 'AGENT_GENERATED',
      'EXTERNAL_INTEGRATION', 'MIGRATION'
    )),
  description text,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  legacy_source_table text,
  legacy_source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_documents_client_active
  ON public.documents (client_id, updated_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_client_lifecycle
  ON public.documents (client_id, lifecycle_status)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type
  ON public.documents (client_id, document_type_id)
  WHERE archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- Immutable file versions
CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  storage_key text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 text NOT NULL,
  extracted_text_status text NOT NULL DEFAULT 'PENDING'
    CHECK (extracted_text_status IN ('PENDING', 'EXTRACTED', 'PARTIAL', 'FAILED', 'SKIPPED')),
  processing_status text NOT NULL DEFAULT 'UPLOADED'
    CHECK (processing_status IN (
      'UPLOADED', 'QUEUED', 'EXTRACTING', 'ANALYZING', 'INDEXING',
      'READY', 'NEEDS_REVIEW', 'FAILED'
    )),
  version_label text,
  is_current boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  supersedes_version_id uuid REFERENCES public.document_versions(id) ON DELETE SET NULL,
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document
  ON public.document_versions (document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_checksum
  ON public.document_versions (client_id, checksum_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_versions_one_current
  ON public.document_versions (document_id)
  WHERE is_current = true;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.document_versions(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Per-document access policy (default visibility on upload)
CREATE TABLE IF NOT EXISTS public.document_access_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  scope_type text NOT NULL DEFAULT 'COMPANY'
    CHECK (scope_type IN ('COMPANY', 'TEAM', 'ROLE', 'USER', 'PRIVATE', 'LINKED_RECORD')),
  scope_id text,
  classification text NOT NULL DEFAULT 'GENERAL'
    CHECK (classification IN (
      'GENERAL', 'FINANCIAL', 'LEGAL', 'HR', 'EXECUTIVE', 'CONFIDENTIAL'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_access_policies_client
  ON public.document_access_policies (client_id, scope_type);

-- ---------------------------------------------------------------------------
-- Company-level documents module settings
CREATE TABLE IF NOT EXISTS public.document_company_settings (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  default_scope_type text NOT NULL DEFAULT 'COMPANY'
    CHECK (default_scope_type IN ('COMPANY', 'TEAM', 'ROLE', 'USER', 'PRIVATE', 'LINKED_RECORD')),
  default_classification text NOT NULL DEFAULT 'GENERAL'
    CHECK (default_classification IN (
      'GENERAL', 'FINANCIAL', 'LEGAL', 'HR', 'EXECUTIVE', 'CONFIDENTIAL'
    )),
  auto_classify boolean NOT NULL DEFAULT true,
  auto_create_category boolean NOT NULL DEFAULT false,
  auto_link_high_confidence boolean NOT NULL DEFAULT true,
  analyze_automatically boolean NOT NULL DEFAULT true,
  extract_obligations boolean NOT NULL DEFAULT true,
  extract_key_terms boolean NOT NULL DEFAULT true,
  expiry_alerts boolean NOT NULL DEFAULT true,
  expiry_alert_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_company_settings IS
  'Per-company SegmiQ Documents feature flag and intelligence defaults.';

-- ---------------------------------------------------------------------------
-- Async processing queue (extraction, classification, indexing)
CREATE TABLE IF NOT EXISTS public.document_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  job_type text NOT NULL DEFAULT 'FULL_PIPELINE'
    CHECK (job_type IN ('FULL_PIPELINE', 'REPROCESS', 'INDEX_ONLY')),
  status text NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  fingerprint text NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  extractor_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_due
  ON public.document_processing_jobs (scheduled_at)
  WHERE status IN ('QUEUED', 'RUNNING');
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_processing_jobs_fingerprint
  ON public.document_processing_jobs (fingerprint);

-- ---------------------------------------------------------------------------
-- Activity audit (upload, download, view, metadata edit)
CREATE TABLE IF NOT EXISTS public.document_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.document_versions(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL
    CHECK (action IN (
      'UPLOADED', 'DOWNLOADED', 'VIEWED', 'METADATA_EDITED', 'ARCHIVED',
      'VERSION_ADDED', 'PROCESSING_STARTED', 'PROCESSING_COMPLETED', 'PROCESSING_FAILED'
    )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_activity_document
  ON public.document_activity (document_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed system document types
INSERT INTO public.document_types (code, label, is_system, display_order) VALUES
  ('CONTRACT', 'Contract', true, 10),
  ('PROPOSAL', 'Proposal', true, 20),
  ('PURCHASE_ORDER', 'Purchase Order', true, 30),
  ('INVOICE', 'Invoice', true, 40),
  ('COMPANY_POLICY', 'Company Policy', true, 50),
  ('CERTIFICATE', 'Certificate', true, 60),
  ('LICENCE', 'Licence', true, 70),
  ('INSURANCE', 'Insurance', true, 80),
  ('NDA', 'NDA', true, 90),
  ('SLA', 'SLA', true, 100),
  ('EMPLOYEE_DOCUMENT', 'Employee Document', true, 110),
  ('TECHNICAL_DOCUMENT', 'Technical Document', true, 120),
  ('PROJECT_DOCUMENT', 'Project Document', true, 130),
  ('SUPPLIER_DOCUMENT', 'Supplier Document', true, 140),
  ('CUSTOMER_DOCUMENT', 'Customer Document', true, 150),
  ('TENDER_DOCUMENT', 'Tender Document', true, 160),
  ('REPORT', 'Report', true, 170),
  ('OTHER', 'Other', true, 999)
ON CONFLICT DO NOTHING;

-- RLS: service-role + app auth (same pattern as CRM tables)
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;
