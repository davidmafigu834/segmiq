ALTER TABLE re_listing_funnels ADD COLUMN IF NOT EXISTS price_label text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 're_listing_funnels_price_label_len') THEN
    ALTER TABLE re_listing_funnels
      ADD CONSTRAINT re_listing_funnels_price_label_len CHECK (price_label IS NULL OR char_length(price_label) <= 40);
  END IF;
END $$;

COMMENT ON COLUMN re_listing_funnels.price_label IS
  'Price exactly as the funnel shows it, for agent share messages and status images.';
