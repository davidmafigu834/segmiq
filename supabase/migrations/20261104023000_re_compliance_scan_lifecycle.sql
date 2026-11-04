-- Scan lifecycle and a private reviewer note.
-- Additive. Do not apply to production until the release is authorised.
-- customer_message remains the only correction text sent to a customer.

ALTER TABLE public.compliance_case_requirements
  ADD COLUMN IF NOT EXISTS internal_note text;

COMMENT ON COLUMN public.compliance_case_requirements.internal_note IS
  'Reviewer-only note. Never copy this into invitation email or the customer portal.';

ALTER TABLE public.compliance_evidence_versions
  DROP CONSTRAINT IF EXISTS compliance_evidence_versions_scan_status_check;

ALTER TABLE public.compliance_evidence_versions
  ADD CONSTRAINT compliance_evidence_versions_scan_status_check
  CHECK (scan_status IN ('unscanned', 'scanning', 'clean', 'infected', 'scan_failed', 'quarantined'));

COMMENT ON COLUMN public.compliance_evidence_versions.scan_status IS
  'Set only by the server-side scanner. A client request cannot mark a file clean.';
