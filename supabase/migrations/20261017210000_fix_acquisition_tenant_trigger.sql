-- Saving an opportunity runs re_acq_enforce_tenant.
-- The function also guards inspections and mandates, which have listing_id.
-- Opportunities do not. PL/pgSQL looks up NEW.listing_id while preparing the
-- AND expression, before the table-name check can skip it, and raises
-- record "new" has no field "listing_id".
-- Read listing_id only inside the branch for tables that have the column.

CREATE OR REPLACE FUNCTION public.re_acq_enforce_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  contact_client uuid;
  listing_client uuid;
  listing_text text;
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    SELECT client_id INTO contact_client FROM contacts WHERE id = NEW.contact_id;
    IF contact_client IS NULL OR contact_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'acquisition contact belongs to another organisation';
    END IF;
  END IF;

  IF TG_TABLE_NAME IN ('real_estate_inspections', 'real_estate_mandates') THEN
    listing_text := to_jsonb(NEW)->>'listing_id';
    IF listing_text IS NOT NULL AND listing_text <> '' THEN
      SELECT client_id INTO listing_client FROM listings WHERE id = listing_text::uuid;
      IF listing_client IS NULL OR listing_client IS DISTINCT FROM NEW.client_id THEN
        RAISE EXCEPTION 'listing belongs to another organisation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
