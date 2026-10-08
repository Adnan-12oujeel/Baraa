-- OPTIONAL: Run in Supabase > SQL Editor only if you want wishes shared between visitors.
-- Public visitors can INSERT pending wishes, but SELECT only approved ones.
-- NEVER expose your Supabase secret/service_role key in client JavaScript.

create extension if not exists pgcrypto;

create table if not exists public.wedding_wishes (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null check (char_length(btrim(guest_name)) between 2 and 60),
  message text not null check (char_length(btrim(message)) between 5 and 500),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wedding_wishes_approved_created_at_idx
  on public.wedding_wishes (approved, created_at desc);

alter table public.wedding_wishes enable row level security;

-- Remove any existing named policies to make the script safe to re-run.
drop policy if exists "Guests may see approved wishes" on public.wedding_wishes;
drop policy if exists "Guests may submit unapproved wishes" on public.wedding_wishes;

create policy "Guests may see approved wishes"
  on public.wedding_wishes for select to anon
  using (approved = true);

create policy "Guests may submit unapproved wishes"
  on public.wedding_wishes for insert to anon
  with check (approved = false);

-- Restrict anonymous access to SELECT of safe public columns and INSERT of wish columns only.
revoke all on public.wedding_wishes from anon;
grant select (guest_name, message, created_at, approved) on public.wedding_wishes to anon;
grant insert (guest_name, message, approved) on public.wedding_wishes to anon;

-- Supabase project owners can review messages in Table Editor and set approved = true.
-- For a public website consider adding server-side rate limiting or CAPTCHA
-- (e.g. Supabase Edge Function) before advertising widely.
