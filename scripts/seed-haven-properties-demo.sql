-- Seed: Haven Properties — polished real-estate demo for sales pitches
-- Password for both users: DemoEstate2026!
-- Idempotent: deletes prior havenproperties.demo seed if present.

DO $$
DECLARE
  v_client_id uuid := 'a1000001-e57a-4e00-8000-000000000001';
  v_manager_id uuid := 'a1000001-e57a-4e00-8000-000000000002';
  v_agent_id uuid := 'a1000001-e57a-4e00-8000-000000000003';
  v_dev_id uuid := 'a1000001-e57a-4e00-8000-000000000010';
  v_pw text := '$2a$12$jC38ZxVb6Sj50eUwsTKd2e2MVPQgTxE/HgF6gFbsbJcbgj4t9H5iK';
  v_now timestamptz := now();
BEGIN
  -- Wipe previous demo seed (safe: fixed UUIDs only)
  DELETE FROM viewings WHERE id::text LIKE 'a1000001-e57a-4e00-8000-%'
     OR listing_id IN (SELECT id FROM listings WHERE client_id = v_client_id)
     OR contact_id IN (SELECT id FROM contacts WHERE client_id = v_client_id);
  DELETE FROM call_logs WHERE lead_id IN (SELECT id FROM leads WHERE client_id = v_client_id);
  DELETE FROM lead_events WHERE client_id = v_client_id;
  DELETE FROM win_analysis WHERE client_id = v_client_id;
  DELETE FROM leads WHERE client_id = v_client_id;
  DELETE FROM listings WHERE client_id = v_client_id;
  DELETE FROM developments WHERE client_id = v_client_id;
  DELETE FROM contacts WHERE client_id = v_client_id;
  DELETE FROM users WHERE id IN (v_manager_id, v_agent_id)
     OR email IN ('chipo@havenproperties.demo', 'farai@havenproperties.demo');
  DELETE FROM clients WHERE id = v_client_id OR slug = 'haven-properties';

  INSERT INTO clients (
    id, name, industry, slug, mode, business_type, assignment_mode, dial_code,
    setup_status, is_active, is_archived, signup_source, plan,
    primary_color, response_time_limit_hours, round_robin_index,
    send_prospect_confirmation, created_at, updated_at
  ) VALUES (
    v_client_id,
    'Haven Properties',
    'Real Estate',
    'haven-properties',
    'team',
    'real_estate',
    'direct',
    '263',
    'active',
    true,
    false,
    'agency',
    'business',
    '#D4FF4F',
    2,
    0,
    true,
    v_now - interval '90 days',
    v_now
  );

  INSERT INTO users (id, name, email, password, role, client_id, phone, is_active, also_sells, round_robin_order, created_at)
  VALUES
    (v_manager_id, 'Chipo Ndoro', 'chipo@havenproperties.demo', v_pw, 'CLIENT_MANAGER', v_client_id, '+263771234501', true, false, 0, v_now - interval '90 days'),
    (v_agent_id, 'Farai Mutasa', 'farai@havenproperties.demo', v_pw, 'SALESPERSON', v_client_id, '+263772445566', true, false, 1, v_now - interval '60 days');

  INSERT INTO developments (id, client_id, name, description, total_units, completion_date, location, created_at, updated_at)
  VALUES (
    v_dev_id, v_client_id,
    'Borrowdale Heights',
    'Gated cluster homes with solar-ready roofs, fibre, and shared gardens — 3km from Borrowdale Brooke.',
    24, '2026-11-30', 'Borrowdale, Harare',
    v_now - interval '45 days', v_now
  );

  -- Listings
  INSERT INTO listings (
    id, client_id, agent_id, development_id, transaction_type, status,
    price, bedrooms, bathrooms, size_sqm, address, suburb, description,
    photos, mandate_type, mandate_expiry_date, lease_term_months, external_reference,
    created_at, updated_at
  ) VALUES
  ('a1000001-e57a-4e00-8000-000000000101', v_client_id, v_agent_id, NULL, 'sale', 'available',
    285000, 4, 3, 320, '12 Greendale Avenue', 'Greendale',
    'Renovated family home with pool, borehole, and double garage. Quiet cul-de-sac.',
    '["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 45), NULL, 'HVN-S-1201', v_now - interval '12 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000102', v_client_id, v_agent_id, NULL, 'sale', 'under_offer',
    420000, 5, 4, 480, '8 Ridgeway Close', 'Borrowdale',
    'Executive home on 2,000m² stand. Staff quarters, generator, and manicured gardens.',
    '["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 20), NULL, 'HVN-S-0808', v_now - interval '20 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000103', v_client_id, v_agent_id, NULL, 'sale', 'available',
    165000, 3, 2, 180, '45 Samora Machel Extension', 'Eastlea',
    'Solid lock-up-and-go townhouse. Ideal for first-time buyers or investors.',
    '["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"]'::jsonb,
    'joint', (CURRENT_DATE + 60), NULL, 'HVN-S-4503', v_now - interval '5 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000104', v_client_id, v_agent_id, NULL, 'rental', 'available',
    1800, 3, 2, 160, '2A Coronation Drive', 'Avondale',
    'Furnished rental near Avondale Shopping Centre. Borehole, DSTV, and secure parking.',
    '["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"]'::jsonb,
    'open', NULL, 12, 'HVN-R-02A', v_now - interval '8 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000105', v_client_id, v_agent_id, NULL, 'rental', 'let',
    2500, 4, 3, 240, '19 Quorn Avenue', 'Mount Pleasant',
    'Spacious family rental with garden cottage. Let to corporate tenant.',
    '[]'::jsonb, 'sole', NULL, 24, 'HVN-R-1919', v_now - interval '40 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000106', v_client_id, v_agent_id, v_dev_id, 'new_development', 'available',
    195000, 3, 2, 145, 'Unit 7 — Borrowdale Heights', 'Borrowdale',
    'Brand-new cluster unit. Transfer ready Q4 2026. Includes solar geyser.',
    '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 90), NULL, 'BH-U07', v_now - interval '3 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000107', v_client_id, v_agent_id, v_dev_id, 'new_development', 'reserved',
    210000, 3, 3, 155, 'Unit 12 — Borrowdale Heights', 'Borrowdale',
    'Corner unit with extra garden. Deposit paid — reservation held.',
    '[]'::jsonb, 'sole', (CURRENT_DATE + 90), NULL, 'BH-U12', v_now - interval '10 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000108', v_client_id, v_agent_id, v_dev_id, 'new_development', 'sold',
    225000, 4, 3, 175, 'Unit 3 — Borrowdale Heights', 'Borrowdale',
    'Sold off-plan to returning Haven client.',
    '[]'::jsonb, 'sole', NULL, NULL, 'BH-U03', v_now - interval '35 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000109', v_client_id, v_agent_id, NULL, 'sale', 'available',
    98000, 2, 1, 95, 'Flat 4B, Kensington Court', 'Belvedere',
    'Affordable sectional title flat. Perfect starter or rental yield play.',
    '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"]'::jsonb,
    'open', (CURRENT_DATE + 30), NULL, 'HVN-S-4B', v_now - interval '2 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000110', v_client_id, v_agent_id, NULL, 'sale', 'available',
    550000, 6, 5, 620, '1 Highlands Road', 'Highlands',
    'Statement property with tennis court, guest wing, and panoramic city views.',
    '["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800"]'::jsonb,
    'sole', (CURRENT_DATE + 15), NULL, 'HVN-S-0101', v_now - interval '18 days', v_now);

  -- Contacts (buyers / tenants / sellers)
  INSERT INTO contacts (
    id, client_id, name, phone, email, location, source, lead_origin, lifecycle, notes, tags,
    buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference, buyer_timeline,
    interested_listing_ids, created_at, updated_at
  ) VALUES
  ('a1000001-e57a-4e00-8000-000000000201', v_client_id, 'Tatenda Chirwa', '+263773111201', 'tatenda.chirwa@email.com', 'Harare', 'WEBSITE', 'segmiq', 'pipeline',
    'Looking for family home near good schools. Prefers Greendale/Borrowdale.', ARRAY['buyer','hot'],
    250000, 320000, 4, 'Greendale', '1-3 months',
    '["a1000001-e57a-4e00-8000-000000000101"]'::jsonb, v_now - interval '6 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000202', v_client_id, 'Melissa & John Banda', '+263774222302', 'melissa.banda@email.com', 'Harare', 'REFERRAL', 'client', 'pipeline',
    'Expat couple relocating from Joburg. Cash buyers.', ARRAY['buyer','expat'],
    350000, 480000, 5, 'Borrowdale', 'ASAP',
    '["a1000001-e57a-4e00-8000-000000000102"]'::jsonb, v_now - interval '18 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000203', v_client_id, 'Grace Nyathi', '+263775333403', 'grace.nyathi@email.com', 'Harare', 'FACEBOOK_AD', 'segmiq', 'aware',
    'First-time buyer. Pre-approved for USD 170k.', ARRAY['buyer','ftb'],
    140000, 180000, 3, 'Eastlea', '3-6 months',
    '["a1000001-e57a-4e00-8000-000000000103"]'::jsonb, v_now - interval '4 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000204', v_client_id, 'Kudzanai Moyo', '+263776444504', 'k.moyo@email.com', 'Harare', 'WHATSAPP_INBOUND', 'client', 'pipeline',
    'Corporate relocation — needs furnished rental immediately.', ARRAY['tenant'],
    1500, 2200, 3, 'Avondale', 'This month',
    '["a1000001-e57a-4e00-8000-000000000104"]'::jsonb, v_now - interval '2 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000205', v_client_id, 'Dr. Blessing Sibanda', '+263777555605', 'b.sibanda@email.com', 'Harare', 'REFERRAL', 'client', 'pipeline',
    'Interested in off-plan Borrowdale Heights Unit 7.', ARRAY['buyer','off-plan'],
    180000, 220000, 3, 'Borrowdale', '6-12 months',
    '["a1000001-e57a-4e00-8000-000000000106"]'::jsonb, v_now - interval '3 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000206', v_client_id, 'Anesu Dube', '+263778666706', 'anesu.dube@email.com', 'Harare', 'WEBSITE', 'segmiq', 'cold',
    'Browsing flats under $100k.', ARRAY['buyer'],
    80000, 110000, 2, 'Belvedere', 'Flexible',
    '["a1000001-e57a-4e00-8000-000000000109"]'::jsonb, v_now - interval '1 day', v_now),
  ('a1000001-e57a-4e00-8000-000000000207', v_client_id, 'Patricia Gumbo', '+263779777807', 'patricia.gumbo@email.com', 'Harare', 'MANUAL', 'client', 'customer',
    'Bought Unit 3 Borrowdale Heights — closed last month.', ARRAY['buyer','won'],
    NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, v_now - interval '40 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000208', v_client_id, 'Tendai Madziva', '+263771888908', 'tendai.madziva@email.com', 'Harare', 'FACEBOOK', 'segmiq', 'pipeline',
    'Seller of Greendale listing — considering downsizing.', ARRAY['seller'],
    NULL, NULL, NULL, 'Greendale', NULL,
    '["a1000001-e57a-4e00-8000-000000000101"]'::jsonb, v_now - interval '25 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000209', v_client_id, 'Rutendo Chari', '+263772999109', 'rutendo.chari@email.com', 'Harare', 'WEBSITE', 'segmiq', 'aware',
    'Wants Highlands statement home for family returning from UK.', ARRAY['buyer','diaspora'],
    450000, 600000, 5, 'Highlands', '3 months',
    '["a1000001-e57a-4e00-8000-000000000110"]'::jsonb, v_now - interval '7 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000210', v_client_id, 'Simon Ncube', '+263773000210', 'simon.ncube@email.com', 'Harare', 'REFERRAL', 'client', 'pipeline',
    'Offer submitted on Ridgeway Close — awaiting counter.', ARRAY['buyer','offer'],
    380000, 450000, 5, 'Borrowdale', 'ASAP',
    '["a1000001-e57a-4e00-8000-000000000102"]'::jsonb, v_now - interval '15 days', v_now),
  ('a1000001-e57a-4e00-8000-000000000211', v_client_id, 'Nyasha Phiri', '+263774111311', 'nyasha.phiri@email.com', 'Harare', 'LANDING_PAGE', 'segmiq', 'cold',
    'New inquiry overnight — no contact yet.', ARRAY['buyer'],
    150000, 200000, 3, 'Eastlea', 'Soon',
    '[]'::jsonb, v_now - interval '3 hours', v_now),
  ('a1000001-e57a-4e00-8000-000000000212', v_client_id, 'Linda Zhou', '+263775222412', 'linda.zhou@email.com', 'Harare', 'WHATSAPP_INBOUND', 'client', 'aware',
    'Follow-up due today for second viewing.', ARRAY['buyer'],
    160000, 190000, 3, 'Eastlea', '1 month',
    '["a1000001-e57a-4e00-8000-000000000103"]'::jsonb, v_now - interval '9 days', v_now);

  -- Leads / pipeline deals
  INSERT INTO leads (
    id, client_id, assigned_to_id, contact_id, source, status, form_data,
    name, phone, email, budget, project_type, timeline,
    deal_value, deal_value_source, follow_up_date, score, is_stale, stale_since,
    manual_priority, is_archived, deal_side, linked_listing_id,
    offer_amount, offer_status, listing_agent_commission_pct, selling_agent_commission_pct,
    expected_close_date, created_at, updated_at
  ) VALUES
  -- Hot family home inquiry
  ('a1000001-e57a-4e00-8000-000000000301', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000201',
    'WEBSITE', 'NEGOTIATING', '{"message":"Loved the Greendale listing — can we view Saturday?"}'::jsonb,
    'Tatenda Chirwa', '+263773111201', 'tatenda.chirwa@email.com', '250-320k', '4-bed Greendale', '1-3 months',
    285000, 'manual', CURRENT_DATE + 1, 82, false, NULL, 'hot', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000101', NULL, NULL, 2.5, 2.5,
    CURRENT_DATE + 21, v_now - interval '6 days', v_now - interval '2 hours'),
  -- Under offer
  ('a1000001-e57a-4e00-8000-000000000302', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000210',
    'REFERRAL', 'PROPOSAL_SENT', '{}'::jsonb,
    'Simon Ncube', '+263773000210', 'simon.ncube@email.com', '380-450k', '5-bed Borrowdale', 'ASAP',
    410000, 'manual', CURRENT_DATE, 91, false, NULL, 'hot', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000102', 405000, 'submitted', 2.5, 2.5,
    CURRENT_DATE + 14, v_now - interval '15 days', v_now - interval '1 day'),
  -- FTB
  ('a1000001-e57a-4e00-8000-000000000303', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000203',
    'FACEBOOK_AD', 'CONTACTED', '{}'::jsonb,
    'Grace Nyathi', '+263775333403', 'grace.nyathi@email.com', '140-180k', '3-bed townhouse', '3-6 months',
    165000, 'manual', CURRENT_DATE + 2, 64, false, NULL, 'warm', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000103', NULL, NULL, NULL, NULL,
    CURRENT_DATE + 45, v_now - interval '4 days', v_now - interval '1 day'),
  -- Rental
  ('a1000001-e57a-4e00-8000-000000000304', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000204',
    'WHATSAPP_INBOUND', 'CONTACTED', '{"message":"Need furnished 3-bed this week"}'::jsonb,
    'Kudzanai Moyo', '+263776444504', 'k.moyo@email.com', '$1800/mo', '3-bed rental', 'Immediate',
    1800, 'manual', CURRENT_DATE, 78, false, NULL, 'hot', false,
    'tenant_side', 'a1000001-e57a-4e00-8000-000000000104', NULL, NULL, NULL, NULL,
    CURRENT_DATE + 7, v_now - interval '2 days', v_now - interval '4 hours'),
  -- Off-plan
  ('a1000001-e57a-4e00-8000-000000000305', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000205',
    'REFERRAL', 'NEGOTIATING', '{}'::jsonb,
    'Dr. Blessing Sibanda', '+263777555605', 'b.sibanda@email.com', '180-220k', 'Borrowdale Heights U7', 'Q4',
    195000, 'manual', CURRENT_DATE + 3, 75, false, NULL, 'hot', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000106', NULL, NULL, 3.0, 2.0,
    CURRENT_DATE + 60, v_now - interval '3 days', v_now),
  -- New uncontacted (manager focus)
  ('a1000001-e57a-4e00-8000-000000000306', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000211',
    'LANDING_PAGE', 'NEW', '{"message":"Saw Eastlea townhouses online"}'::jsonb,
    'Nyasha Phiri', '+263774111311', 'nyasha.phiri@email.com', '150-200k', '3-bed Eastlea', 'Soon',
    NULL, NULL, NULL, 55, false, NULL, 'warm', false,
    'buy_side', NULL, NULL, NULL, NULL, NULL,
    NULL, v_now - interval '3 hours', v_now - interval '3 hours'),
  -- Flat inquiry new
  ('a1000001-e57a-4e00-8000-000000000307', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000206',
    'WEBSITE', 'NEW', '{}'::jsonb,
    'Anesu Dube', '+263778666706', 'anesu.dube@email.com', '80-110k', '2-bed flat', 'Flexible',
    98000, 'manual', NULL, 48, false, NULL, 'cold', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000109', NULL, NULL, NULL, NULL,
    NULL, v_now - interval '1 day', v_now - interval '1 day'),
  -- Follow-up due today
  ('a1000001-e57a-4e00-8000-000000000308', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000212',
    'WHATSAPP_INBOUND', 'CONTACTED', '{}'::jsonb,
    'Linda Zhou', '+263775222412', 'linda.zhou@email.com', '160-190k', 'Eastlea townhouse', '1 month',
    165000, 'manual', CURRENT_DATE, 70, false, NULL, 'warm', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000103', NULL, NULL, NULL, NULL,
    CURRENT_DATE + 30, v_now - interval '9 days', v_now - interval '1 day'),
  -- Highlands diaspora
  ('a1000001-e57a-4e00-8000-000000000309', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000209',
    'WEBSITE', 'NEGOTIATING', '{}'::jsonb,
    'Rutendo Chari', '+263772999109', 'rutendo.chari@email.com', '450-600k', 'Highlands estate', '3 months',
    550000, 'manual', CURRENT_DATE + 4, 88, false, NULL, 'hot', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000110', NULL, NULL, 2.5, 2.5,
    CURRENT_DATE + 40, v_now - interval '7 days', v_now - interval '5 hours'),
  -- Stale lead
  ('a1000001-e57a-4e00-8000-000000000310', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000208',
    'FACEBOOK', 'CONTACTED', '{}'::jsonb,
    'Tendai Madziva', '+263771888908', 'tendai.madziva@email.com', NULL, 'Seller — Greendale', NULL,
    285000, 'manual', CURRENT_DATE - 5, 40, true, v_now - interval '12 days', 'cold', false,
    'sell_side', 'a1000001-e57a-4e00-8000-000000000101', NULL, NULL, 2.5, NULL,
    NULL, v_now - interval '25 days', v_now - interval '14 days'),
  -- Won last month
  ('a1000001-e57a-4e00-8000-000000000311', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000207',
    'REFERRAL', 'WON', '{}'::jsonb,
    'Patricia Gumbo', '+263779777807', 'patricia.gumbo@email.com', '225k', 'Borrowdale Heights U3', 'Closed',
    225000, 'manual', NULL, 95, false, NULL, 'hot', false,
    'buy_side', 'a1000001-e57a-4e00-8000-000000000108', 225000, 'accepted', 3.0, 2.0,
    CURRENT_DATE - 20, v_now - interval '40 days', v_now - interval '20 days'),
  -- Expat Bandas — won this month (closed purchase — separate from Ridgeway under-offer)
  ('a1000001-e57a-4e00-8000-000000000312', v_client_id, v_agent_id, 'a1000001-e57a-4e00-8000-000000000202',
    'REFERRAL', 'WON', '{}'::jsonb,
    'Melissa & John Banda', '+263774222302', 'melissa.banda@email.com', '420k', '6 Ballantyne Park', 'Closed',
    420000, 'manual', NULL, 93, false, NULL, 'hot', false,
    'buy_side', NULL, 415000, 'accepted', 2.5, 2.5,
    CURRENT_DATE - 5, v_now - interval '18 days', v_now - interval '5 days'),
  -- Lost
  ('a1000001-e57a-4e00-8000-000000000313', v_client_id, v_agent_id, NULL,
    'FACEBOOK', 'LOST', '{}'::jsonb,
    'Brian Mhlanga', '+263776121212', 'brian.m@email.com', '120k', '2-bed', NULL,
    NULL, NULL, NULL, 30, false, NULL, 'cold', false,
    'buy_side', NULL, NULL, 'rejected', NULL, NULL,
    NULL, v_now - interval '22 days', v_now - interval '10 days');

  UPDATE leads SET lost_reason = 'Bought with another agency' WHERE id = 'a1000001-e57a-4e00-8000-000000000313';

  -- Viewings this week
  INSERT INTO viewings (id, contact_id, listing_id, agent_id, scheduled_at, status, feedback_text, feedback_sentiment, created_at)
  VALUES
  ('a1000001-e57a-4e00-8000-000000000401', 'a1000001-e57a-4e00-8000-000000000201',
    'a1000001-e57a-4e00-8000-000000000101', v_agent_id,
    date_trunc('day', v_now) + interval '1 day' + interval '10 hours', 'scheduled', NULL, NULL, v_now - interval '1 day'),
  ('a1000001-e57a-4e00-8000-000000000402', 'a1000001-e57a-4e00-8000-000000000204',
    'a1000001-e57a-4e00-8000-000000000104', v_agent_id,
    date_trunc('day', v_now) + interval '2 days' + interval '15 hours', 'scheduled', NULL, NULL, v_now - interval '12 hours'),
  ('a1000001-e57a-4e00-8000-000000000403', 'a1000001-e57a-4e00-8000-000000000205',
    'a1000001-e57a-4e00-8000-000000000106', v_agent_id,
    date_trunc('day', v_now) + interval '3 days' + interval '11 hours', 'scheduled', NULL, NULL, v_now - interval '6 hours'),
  ('a1000001-e57a-4e00-8000-000000000404', 'a1000001-e57a-4e00-8000-000000000212',
    'a1000001-e57a-4e00-8000-000000000103', v_agent_id,
    v_now - interval '2 days', 'completed', 'Loved the layout — wants to bring partner for second look.', 'positive', v_now - interval '2 days'),
  ('a1000001-e57a-4e00-8000-000000000405', 'a1000001-e57a-4e00-8000-000000000209',
    'a1000001-e57a-4e00-8000-000000000110', v_agent_id,
    date_trunc('day', v_now) + interval '5 days' + interval '14 hours', 'scheduled', NULL, NULL, v_now - interval '3 hours');

  -- Call logs (today + recent) for agent activity
  INSERT INTO call_logs (id, lead_id, user_id, outcome, reach_outcome, result, reason, notes, follow_up_date, callback_at, created_at)
  VALUES
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000301', v_agent_id, 'FOLLOW_UP', 'reached', 'follow_up', 'Waiting on decision maker',
    'Confirmed Saturday viewing at Greendale.', CURRENT_DATE + 1, (v_now + interval '1 day'), v_now - interval '2 hours'),
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000304', v_agent_id, 'FOLLOW_UP', 'reached', 'follow_up', 'Need more info',
    'Sending rental brochure + lease terms.', CURRENT_DATE, v_now + interval '3 hours', v_now - interval '4 hours'),
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000302', v_agent_id, 'ANSWERED', 'reached', 'follow_up', 'Waiting on decision maker',
    'Offer with seller — expecting counter today.', CURRENT_DATE, v_now + interval '6 hours', v_now - interval '1 day'),
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000308', v_agent_id, 'NO_ANSWER', 'no_answer', NULL, NULL,
    'Tried morning — will call again.', CURRENT_DATE, NULL, v_now - interval '5 hours'),
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000309', v_agent_id, 'FOLLOW_UP', 'reached', 'follow_up', 'Need more info',
    'Diaspora buyer watching Highlands walkthrough video.', CURRENT_DATE + 4, v_now + interval '4 days', v_now - interval '5 hours'),
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000303', v_agent_id, 'ANSWERED', 'reached', 'follow_up', 'Need more info',
    'Pre-approval confirmed with bank.', CURRENT_DATE + 2, NULL, v_now - interval '1 day'),
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000312', v_agent_id, 'WON', 'reached', 'won', NULL,
    'Deal closed — keys handover booked.', NULL, NULL, v_now - interval '5 days'),
  (gen_random_uuid(), 'a1000001-e57a-4e00-8000-000000000311', v_agent_id, 'WON', 'reached', 'won', NULL,
    'Off-plan Unit 3 completed.', NULL, NULL, v_now - interval '20 days');

  -- Timeline events (incl. assets sent for dashboard)
  INSERT INTO lead_events (lead_id, client_id, actor_id, actor_name, actor_role, event_type, event_data, created_at)
  VALUES
  ('a1000001-e57a-4e00-8000-000000000301', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'LEAD_CREATED',
    '{"source":"WEBSITE"}'::jsonb, v_now - interval '6 days'),
  ('a1000001-e57a-4e00-8000-000000000301', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'DOCUMENT_SENT',
    '{"document_type":"PORTFOLIO","document_name":"Haven featured homes"}'::jsonb, v_now - interval '5 days'),
  ('a1000001-e57a-4e00-8000-000000000303', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'DOCUMENT_SENT',
    '{"document_type":"PRICING_PACKAGE","document_name":"Eastlea townhouse pack"}'::jsonb, v_now - interval '3 days'),
  ('a1000001-e57a-4e00-8000-000000000304', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'DOCUMENT_SENT',
    '{"document_type":"DOCUMENT","document_name":"Lease draft"}'::jsonb, v_now - interval '1 day'),
  ('a1000001-e57a-4e00-8000-000000000309', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'DOCUMENT_SENT',
    '{"document_type":"PROJECT","document_name":"Highlands Road brochure"}'::jsonb, v_now - interval '2 days'),
  ('a1000001-e57a-4e00-8000-000000000305', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'CALL_LOGGED',
    '{"outcome":"FOLLOW_UP"}'::jsonb, v_now - interval '1 day'),
  ('a1000001-e57a-4e00-8000-000000000312', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'STATUS_CHANGED',
    '{"from_status":"PROPOSAL_SENT","to_status":"WON"}'::jsonb, v_now - interval '5 days'),
  ('a1000001-e57a-4e00-8000-000000000311', v_client_id, v_agent_id, 'Farai Mutasa', 'SALESPERSON', 'STATUS_CHANGED',
    '{"from_status":"NEGOTIATING","to_status":"WON"}'::jsonb, v_now - interval '20 days');

  INSERT INTO win_analysis (
    lead_id, client_id, salesperson_id, salesperson_name, days_to_close,
    total_calls, calls_answered, portfolio_sent, projects_sent, pricing_sent,
    documents_sent, custom_messages_sent, deal_value, source, project_type, budget_range, created_at
  ) VALUES
  ('a1000001-e57a-4e00-8000-000000000312', v_client_id, v_agent_id, 'Farai Mutasa', 13,
    4, 3, true, 1, false, 1, 1, 420000, 'REFERRAL', '5-bed Borrowdale', '380-450k', v_now - interval '5 days'),
  ('a1000001-e57a-4e00-8000-000000000311', v_client_id, v_agent_id, 'Farai Mutasa', 20,
    5, 4, true, 1, true, 2, 2, 225000, 'REFERRAL', 'Borrowdale Heights U3', '225k', v_now - interval '20 days');

END $$;

SELECT 'Haven Properties demo ready' AS status,
  (SELECT count(*) FROM listings WHERE client_id = 'a1000001-e57a-4e00-8000-000000000001') AS listings,
  (SELECT count(*) FROM contacts WHERE client_id = 'a1000001-e57a-4e00-8000-000000000001') AS contacts,
  (SELECT count(*) FROM leads WHERE client_id = 'a1000001-e57a-4e00-8000-000000000001') AS leads,
  (SELECT count(*) FROM viewings v JOIN listings l ON l.id = v.listing_id WHERE l.client_id = 'a1000001-e57a-4e00-8000-000000000001') AS viewings;
