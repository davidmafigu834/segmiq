-- Harden public Data API exposure for form schema / testimonials / project views.
-- App serves these via service_role APIs; anon should not read all tenants.

DROP POLICY IF EXISTS form_fields_public_read ON public.form_fields;
DROP POLICY IF EXISTS form_steps_public_read ON public.form_steps;
DROP POLICY IF EXISTS testimonials_public_read ON public.testimonials;
DROP POLICY IF EXISTS project_views_public_insert ON public.project_views;

REVOKE ALL ON public.form_fields FROM anon, authenticated;
REVOKE ALL ON public.form_steps FROM anon, authenticated;
REVOKE ALL ON public.testimonials FROM anon, authenticated;
REVOKE ALL ON public.project_views FROM anon, authenticated;

-- Invalidate any leftover plaintext password-reset tokens (hashed storage going forward).
UPDATE public.password_reset_tokens
SET used = true
WHERE used = false
  AND length(token) = 64
  AND token !~ '^[0-9a-f]{64}$';

-- Also invalidate unused tokens that look like raw hex (legacy plaintext length 64).
-- New hashed tokens are also 64 hex chars, so expire unused tokens older than 1 hour.
UPDATE public.password_reset_tokens
SET used = true
WHERE used = false
  AND created_at < now() - interval '1 hour';

COMMENT ON COLUMN public.password_reset_tokens.token IS
  'SHA-256 hex digest of reset token (segmiq-reset:<raw>). Never store plaintext.';
