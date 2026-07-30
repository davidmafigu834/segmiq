-- Leadstaq seed data — run in Supabase SQL Editor after 001_initial_schema.sql
-- Login: admin@leadstaq.com / admin123
--
-- Password hash matches scripts/seed.ts (bcrypt cost 12 for "admin123").
-- Re-running may duplicate leads (same as npm run seed); delete from public.leads first if needed.

begin;

-- Same bcrypt as bcrypt.hash("admin123", 12) from Node
with pwd as (
  select '$2a$12$Moznq14sUiU0Q9K9A7wb9efTqF85NcpRf1mRQt469G4BY2mt6I3oW'::text as h
),
c as (
  insert into public.clients (name, industry, slug, primary_color)
  values
    ('JD Construction', 'Construction', 'jd-construction', '#00D4FF'),
    ('Bright Solar', 'Solar Installation', 'bright-solar', '#7B61FF')
  on conflict (slug) do update set
    name = excluded.name,
    industry = excluded.industry,
    primary_color = excluded.primary_color
  returning id, slug
)
insert into public.users (name, email, password, role, client_id, phone, is_active)
select 'Super Admin', 'admin@leadstaq.com', pwd.h, 'SUPER_ADMIN', null, '+10000000000', true
from pwd
on conflict (email) do update set
  name = excluded.name,
  password = excluded.password,
  role = excluded.role,
  client_id = excluded.client_id,
  phone = excluded.phone,
  is_active = excluded.is_active;

-- Client users + forms + landing pages + leads (per client)
do $$
declare
  pwd text := '$2a$12$Moznq14sUiU0Q9K9A7wb9efTqF85NcpRf1mRQt469G4BY2mt6I3oW';
  jd_id uuid;
  bs_id uuid;
  jd_mgr uuid;
  jd_s1 uuid;
  jd_s2 uuid;
  bs_mgr uuid;
  bs_s1 uuid;
  bs_s2 uuid;
  i int;
  st text;
  src text;
  sid uuid;
  statuses text[] := array['NEW','CONTACTED','NEGOTIATING','PROPOSAL_SENT','WON'];
begin
  select id into jd_id from public.clients where slug = 'jd-construction';
  select id into bs_id from public.clients where slug = 'bright-solar';

  -- JD users
  insert into public.users (name, email, password, role, client_id, is_active)
  values
    ('JD Manager', 'jd-manager@example.com', pwd, 'CLIENT_MANAGER', jd_id, true),
    ('JD Sales A', 'jd-sales-a@example.com', pwd, 'SALESPERSON', jd_id, true),
    ('JD Sales B', 'jd-sales-b@example.com', pwd, 'SALESPERSON', jd_id, true)
  on conflict (email) do update set
    name = excluded.name,
    password = excluded.password,
    role = excluded.role,
    client_id = excluded.client_id,
    is_active = excluded.is_active;
  select id into jd_mgr from public.users where email = 'jd-manager@example.com';
  select id into jd_s1 from public.users where email = 'jd-sales-a@example.com';
  select id into jd_s2 from public.users where email = 'jd-sales-b@example.com';

  -- Bright users
  insert into public.users (name, email, password, role, client_id, is_active)
  values
    ('Bright Manager', 'bright-manager@example.com', pwd, 'CLIENT_MANAGER', bs_id, true),
    ('Bright Sales A', 'bright-sales-a@example.com', pwd, 'SALESPERSON', bs_id, true),
    ('Bright Sales B', 'bright-sales-b@example.com', pwd, 'SALESPERSON', bs_id, true)
  on conflict (email) do update set
    name = excluded.name,
    password = excluded.password,
    role = excluded.role,
    client_id = excluded.client_id,
    is_active = excluded.is_active;
  select id into bs_mgr from public.users where email = 'bright-manager@example.com';
  select id into bs_s1 from public.users where email = 'bright-sales-a@example.com';
  select id into bs_s2 from public.users where email = 'bright-sales-b@example.com';

  -- Form schemas
  insert into public.form_schemas (client_id, form_title, submit_button_text, thank_you_message, fields)
  values (
    jd_id,
    'JD quote',
    'Get quote',
    'Thanks — we will call you shortly.',
    '[
      {"id":"name","type":"short_text","label":"Full name","required":true},
      {"id":"phone","type":"phone","label":"Phone","required":true},
      {"id":"email","type":"email","label":"Email","required":true}
    ]'::jsonb
  )
  on conflict (client_id) do update set
    form_title = excluded.form_title,
    submit_button_text = excluded.submit_button_text,
    thank_you_message = excluded.thank_you_message,
    fields = excluded.fields;

  insert into public.form_schemas (client_id, form_title, submit_button_text, thank_you_message, fields)
  values (
    bs_id,
    'Bright quote',
    'Get quote',
    'Thanks — we will call you shortly.',
    '[
      {"id":"name","type":"short_text","label":"Full name","required":true},
      {"id":"phone","type":"phone","label":"Phone","required":true},
      {"id":"email","type":"email","label":"Email","required":true}
    ]'::jsonb
  )
  on conflict (client_id) do update set
    form_title = excluded.form_title,
    submit_button_text = excluded.submit_button_text,
    thank_you_message = excluded.thank_you_message,
    fields = excluded.fields;

  -- Landing pages
  insert into public.landing_pages (client_id, hero_headline, hero_subheadline, cta_text, published, primary_color)
  values (jd_id, 'JD — quality service', 'Tell us about your project.', 'Get a free quote today', true, '#00D4FF')
  on conflict (client_id) do update set
    hero_headline = excluded.hero_headline,
    hero_subheadline = excluded.hero_subheadline,
    cta_text = excluded.cta_text,
    published = excluded.published,
    primary_color = excluded.primary_color;

  insert into public.landing_pages (client_id, hero_headline, hero_subheadline, cta_text, published, primary_color)
  values (bs_id, 'Bright — quality service', 'Tell us about your project.', 'Get a free quote today', true, '#00D4FF')
  on conflict (client_id) do update set
    hero_headline = excluded.hero_headline,
    hero_subheadline = excluded.hero_subheadline,
    cta_text = excluded.cta_text,
    published = excluded.published,
    primary_color = excluded.primary_color;

  -- JD leads (matches scripts/seed.ts loop)
  for i in 0..4 loop
    st := statuses[(i % 5) + 1];
    if i % 2 = 0 then src := 'LANDING_PAGE'; else src := 'FACEBOOK'; end if;
    if i % 2 = 0 then sid := jd_s1; else sid := jd_s2; end if;
    insert into public.leads (
      client_id, assigned_to_id, source, status, form_data,
      name, phone, email, budget, project_type, timeline,
      magic_token, magic_token_expires_at
    ) values (
      jd_id,
      sid,
      src,
      st,
      jsonb_build_object('name', 'Lead ' || i, 'phone', '+1555000${i}'),
      'JD Lead ' || (i + 1),
      '+1555000' || (1000 + i)::text,
      'lead' || i || '@example.com',
      '$10k–$25k',
      'Roof',
      '1 month',
      gen_random_uuid(),
      (now() + interval '30 days')
    );
  end loop;

  -- Bright leads
  for i in 0..4 loop
    st := statuses[(i % 5) + 1];
    if i % 2 = 0 then src := 'LANDING_PAGE'; else src := 'FACEBOOK'; end if;
    if i % 2 = 0 then sid := bs_s1; else sid := bs_s2; end if;
    insert into public.leads (
      client_id, assigned_to_id, source, status, form_data,
      name, phone, email, budget, project_type, timeline,
      magic_token, magic_token_expires_at
    ) values (
      bs_id,
      sid,
      src,
      st,
      jsonb_build_object('name', 'Lead ' || i, 'phone', '+1555000${i}'),
      'Bright Lead ' || (i + 1),
      '+1555000' || (1000 + i)::text,
      'lead' || i || '@example.com',
      '$10k–$25k',
      'Roof',
      '1 month',
      gen_random_uuid(),
      (now() + interval '30 days')
    );
  end loop;
end $$;

commit;
