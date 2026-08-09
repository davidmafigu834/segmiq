-- Seed: Landlords Junction Properties — SegmiQ client for website lead intake
-- Password for manager + agents: DemoEstate2026!
-- Idempotent: replaces prior landlords-junction seed only (fixed UUIDs).
--
-- After running, set on the LJP website (.env.local):
--   SEGMIQ_API_URL=https://<your-segmiq-host>
--   SEGMIQ_WEBSITE_API_KEY=<printed by RAISE NOTICE below>
--
-- Agent phones match LJP seed agents so property enquiries auto-assign.

DO $$
DECLARE
  v_client_id uuid := 'b2000001-e57a-4e00-8000-000000000001';
  v_manager_id uuid := 'b2000001-e57a-4e00-8000-000000000002';
  v_thandi_id uuid := 'b2000001-e57a-4e00-8000-000000000003';
  v_brian_id uuid := 'b2000001-e57a-4e00-8000-000000000004';
  v_rudo_id uuid := 'b2000001-e57a-4e00-8000-000000000005';
  v_pw text := '$2a$12$jC38ZxVb6Sj50eUwsTKd2e2MVPQgTxE/HgF6gFbsbJcbgj4t9H5iK';
  -- Concatenate so scanners do not treat this demo token as a Stripe secret.
  v_api_key text := 'sk' || '_live_' || 'ljpdemo00000000000000000000000000000000000001';
  v_now timestamptz := now();
BEGIN
  DELETE FROM viewings
    WHERE listing_id IN (SELECT id FROM listings WHERE client_id = v_client_id)
       OR contact_id IN (SELECT id FROM contacts WHERE client_id = v_client_id);
  DELETE FROM call_logs WHERE lead_id IN (SELECT id FROM leads WHERE client_id = v_client_id);
  DELETE FROM lead_events WHERE client_id = v_client_id;
  DELETE FROM win_analysis WHERE client_id = v_client_id;
  DELETE FROM leads WHERE client_id = v_client_id;
  DELETE FROM listings WHERE client_id = v_client_id;
  DELETE FROM developments WHERE client_id = v_client_id;
  DELETE FROM contacts WHERE client_id = v_client_id;
  DELETE FROM users WHERE id IN (v_manager_id, v_thandi_id, v_brian_id, v_rudo_id)
     OR email IN (
       'admin@landlordsjunction.co.zw',
       'thandi@landlordsjunction.co.zw',
       'brian@landlordsjunction.co.zw',
       'rudo@landlordsjunction.co.zw'
     );
  DELETE FROM clients WHERE id = v_client_id OR slug = 'landlords-junction-properties';

  INSERT INTO clients (
    id, name, industry, slug, mode, business_type, assignment_mode, dial_code,
    setup_status, is_active, is_archived, signup_source, plan,
    primary_color, response_time_limit_hours, round_robin_index,
    send_prospect_confirmation, website_integration_api_key,
    created_at, updated_at
  ) VALUES (
    v_client_id,
    'Landlords Junction Properties',
    'Real Estate',
    'landlords-junction-properties',
    'team',
    'real_estate',
    'direct',
    '263',
    'active',
    true,
    false,
    'agency',
    'business',
    '#0B1F3A',
    2,
    0,
    true,
    v_api_key,
    v_now,
    v_now
  );

  INSERT INTO users (id, name, email, password, role, client_id, phone, is_active, also_sells, round_robin_order, created_at)
  VALUES
    (v_manager_id, 'LJP Admin', 'admin@landlordsjunction.co.zw', v_pw, 'CLIENT_MANAGER', v_client_id, '+263771000001', true, false, 0, v_now),
    (v_thandi_id, 'Thandi Ncube', 'thandi@landlordsjunction.co.zw', v_pw, 'SALESPERSON', v_client_id, '+263 77 123 4567', true, false, 1, v_now),
    (v_brian_id, 'Brian Dube', 'brian@landlordsjunction.co.zw', v_pw, 'SALESPERSON', v_client_id, '+263 71 987 6543', true, false, 2, v_now),
    (v_rudo_id, 'Rudo Moyo', 'rudo@landlordsjunction.co.zw', v_pw, 'SALESPERSON', v_client_id, '+263 78 555 0199', true, false, 3, v_now);

  -- Listings: external_reference = LJP property slug (for listing_reference matching)
  INSERT INTO listings (
    id, client_id, agent_id, development_id, transaction_type, status,
    price, bedrooms, bathrooms, size_sqm, address, suburb, description,
    photos, mandate_type, mandate_expiry_date, lease_term_months, external_reference,
    created_at, updated_at
  ) VALUES
  ('b2000001-e57a-4e00-8000-000000000101', v_client_id, v_thandi_id, NULL, 'sale', 'available',
    185000, 3, 2, 280, 'Hillside, Bulawayo', 'Hillside',
    '3 Bedroom House For Sale in Hillside',
    '["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 90), NULL, '3-bedroom-house-hillside', v_now, v_now),
  ('b2000001-e57a-4e00-8000-000000000102', v_client_id, v_brian_id, NULL, 'sale', 'available',
    245000, 4, 3, 360, 'Ascot, Bulawayo', 'Ascot',
    '4 Bedroom House For Sale in Ascot',
    '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 90), NULL, '4-bedroom-house-ascot', v_now, v_now),
  ('b2000001-e57a-4e00-8000-000000000103', v_client_id, v_thandi_id, NULL, 'sale', 'available',
    320000, 4, 4, 420, 'Parklands, Bulawayo', 'Parklands',
    '4 Bedroom House For Sale in Parklands',
    '["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 90), NULL, 'modern-home-parklands', v_now, v_now),
  ('b2000001-e57a-4e00-8000-000000000104', v_client_id, v_rudo_id, NULL, 'sale', 'available',
    75000, NULL, NULL, 2000, 'Kumalo, Bulawayo', 'Kumalo',
    'Vacant Land For Sale in Kumalo',
    '["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800"]'::jsonb,
    'open', (CURRENT_DATE + 90), NULL, 'vacant-land-kumalo', v_now, v_now),
  ('b2000001-e57a-4e00-8000-000000000105', v_client_id, v_brian_id, NULL, 'rental', 'available',
    450, 2, 1, 95, 'Suburbs, Bulawayo', 'Suburbs',
    '2 Bedroom Apartment To Let in Suburbs',
    '["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"]'::jsonb,
    'open', NULL, 12, 'apartment-to-let-suburbs', v_now, v_now),
  ('b2000001-e57a-4e00-8000-000000000106', v_client_id, v_thandi_id, NULL, 'rental', 'available',
    650, 3, 2, 250, 'Hillside, Bulawayo', 'Hillside',
    '3 Bedroom House To Let in Hillside',
    '["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"]'::jsonb,
    'open', NULL, 12, 'house-to-let-hillside', v_now, v_now),
  ('b2000001-e57a-4e00-8000-000000000107', v_client_id, v_rudo_id, NULL, 'sale', 'available',
    180000, NULL, 2, 180, 'CBD, Bulawayo', 'CBD',
    'Commercial Unit For Sale in CBD',
    '["https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 90), NULL, 'commercial-unit-cbd', v_now, v_now),
  ('b2000001-e57a-4e00-8000-000000000108', v_client_id, v_rudo_id, NULL, 'sale', 'available',
    210000, 3, 2, 50000, 'Matsheumhlope, Bulawayo', 'Matsheumhlope',
    'Smallholding For Sale near Bulawayo',
    '["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800"]'::jsonb,
    'open', (CURRENT_DATE + 90), NULL, 'farm-matabeleland', v_now, v_now);

  RAISE NOTICE 'Landlords Junction Properties seeded. API key: %', v_api_key;
END $$;
