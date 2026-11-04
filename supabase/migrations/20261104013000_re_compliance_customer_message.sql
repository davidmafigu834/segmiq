-- Customer-facing correction text. Internal reviewer notes must not be stored here.
-- Do not apply this to production until the remediation release is authorised.
ALTER TABLE public.compliance_invitations
  ADD COLUMN IF NOT EXISTS customer_message text;

COMMENT ON COLUMN public.compliance_invitations.customer_message IS
  'Sentence shown to the customer on a correction request. Not an internal investigation note.';
