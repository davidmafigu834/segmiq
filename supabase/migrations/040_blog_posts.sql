-- 040_blog_posts.sql
-- Content store for the Segmiq marketing blog.
-- Public read of PUBLISHED posts; writes restricted (manage via Supabase dashboard or an
-- authenticated admin screen). Adjust the write policy to match how your team will edit.

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  excerpt       text not null,
  body          text not null default '',
  category      text not null check (category in ('insight','product','client','intelligence','announcement')),
  cover_image   text,
  author        text default 'Segmiq',
  read_minutes  int  default 5,
  featured      boolean not null default false,
  status        text not null default 'draft' check (status in ('draft','published')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_category_idx
  on public.blog_posts (category);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists "blog public read published" on public.blog_posts;
create policy "blog public read published"
  on public.blog_posts for select
  using (status = 'published' and (published_at is null or published_at <= now()));

drop policy if exists "blog authenticated manage" on public.blog_posts;
create policy "blog authenticated manage"
  on public.blog_posts for all
  to authenticated
  using (true) with check (true);

insert into public.blog_posts (slug, title, excerpt, body, category, cover_image, read_minutes, featured, status, published_at)
values (
  'segmiq-cloud-is-live',
  'Segmiq Cloud is live: document every project, win the next one',
  'Field workers upload site photos from a phone, every project gets a public share link and a milestone timeline, and a conversational form turns visitors into scored leads.',
  'Replace this with the real article body (markdown).',
  'announcement',
  'https://images.unsplash.com/photo-1745187946672-2c1d8cf26a2b?q=70&w=900&h=560&fit=crop&auto=format',
  5, true, 'published', now()
)
on conflict (slug) do nothing;
