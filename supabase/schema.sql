-- Timetrack cloud schema.
-- Paste this whole file into the Supabase SQL editor (Database → SQL) and run it once.
-- Safe to re-run: everything is idempotent (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).

-- ───────────────────────── profiles ─────────────────────────
-- One row per user, created automatically on signup.
-- Exists so future features (teams, sharing, billing) have an anchor table.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────── synced_at trigger ────────────────────
-- Server-side timestamp used as the pull watermark; immune to client clocks.
create or replace function public.touch_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at := now();
  return new;
end; $$;

-- ───────────────────────── projects ─────────────────────────
create table if not exists public.projects (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  client text not null default '',
  description text not null default '',
  quota_hours double precision not null default 0,
  hourly_rate double precision,
  color text not null default '#39ff14',
  status text not null default 'active' check (status in ('active','paused','completed')),
  archived boolean not null default false,
  deleted boolean not null default false,
  created_at bigint not null,          -- epoch ms, client-authored
  updated_at bigint not null,          -- epoch ms, client-authored (conflict resolution)
  synced_at timestamptz not null default now(),
  primary key (user_id, id)            -- users can never collide on ids
);

create index if not exists projects_user_synced on public.projects (user_id, synced_at);

alter table public.projects enable row level security;
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists projects_synced_at on public.projects;
create trigger projects_synced_at
  before insert or update on public.projects
  for each row execute function public.touch_synced_at();

-- ──────────────────────── time_entries ──────────────────────
-- Breaks are embedded as jsonb [{"start": ms, "end": ms}]: they have no
-- identity of their own and are always read/written with their entry, so
-- this keeps each entry's sync atomic (deliberate, documented decision).
create table if not exists public.time_entries (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null,
  start_ms bigint not null,
  end_ms bigint not null,
  note text not null default '',
  breaks jsonb not null default '[]',
  deleted boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, id),
  check (end_ms > start_ms)
);

create index if not exists entries_user_synced on public.time_entries (user_id, synced_at);
create index if not exists entries_user_project on public.time_entries (user_id, project_id);

alter table public.time_entries enable row level security;
drop policy if exists "own entries" on public.time_entries;
create policy "own entries" on public.time_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists entries_synced_at on public.time_entries;
create trigger entries_synced_at
  before insert or update on public.time_entries
  for each row execute function public.touch_synced_at();

-- ─────────────────────────── timers ─────────────────────────
-- Running timers, one per (user, project). Synced by full-state replace.
create table if not exists public.timers (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null,
  started_at bigint not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

alter table public.timers enable row level security;
drop policy if exists "own timers" on public.timers;
create policy "own timers" on public.timers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists timers_synced_at on public.timers;
create trigger timers_synced_at
  before insert or update on public.timers
  for each row execute function public.touch_synced_at();

-- ────────────────────────── settings ────────────────────────
create table if not exists public.settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at bigint not null default 0,
  synced_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.settings enable row level security;
drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists settings_synced_at on public.settings;
create trigger settings_synced_at
  before insert or update on public.settings
  for each row execute function public.touch_synced_at();

-- ───────────── conditional push (true last-updated-wins) ─────────────
-- Plain upsert would let a device that was offline overwrite NEWER data
-- with older edits. These functions only apply a row when its updated_at
-- is newer than what the server has. They run as the calling user
-- (security invoker), so Row Level Security still applies to every write.

create or replace function public.sync_push_projects(rows jsonb)
returns void language plpgsql as $$
begin
  insert into public.projects
    (id, user_id, title, client, description, quota_hours, hourly_rate,
     color, status, archived, deleted, created_at, updated_at)
  select r.id, auth.uid(), r.title, r.client, r.description, r.quota_hours,
         r.hourly_rate, r.color, r.status, r.archived, r.deleted,
         r.created_at, r.updated_at
  from jsonb_to_recordset(rows) as r(
    id text, title text, client text, description text,
    quota_hours double precision, hourly_rate double precision, color text,
    status text, archived boolean, deleted boolean,
    created_at bigint, updated_at bigint)
  on conflict (user_id, id) do update set
    title = excluded.title, client = excluded.client,
    description = excluded.description, quota_hours = excluded.quota_hours,
    hourly_rate = excluded.hourly_rate, color = excluded.color,
    status = excluded.status, archived = excluded.archived,
    deleted = excluded.deleted, updated_at = excluded.updated_at
  where public.projects.updated_at < excluded.updated_at;
end; $$;

create or replace function public.sync_push_entries(rows jsonb)
returns void language plpgsql as $$
begin
  insert into public.time_entries
    (id, user_id, project_id, start_ms, end_ms, note, breaks, deleted,
     created_at, updated_at)
  select r.id, auth.uid(), r.project_id, r.start_ms, r.end_ms, r.note,
         coalesce(r.breaks, '[]'::jsonb), r.deleted, r.created_at, r.updated_at
  from jsonb_to_recordset(rows) as r(
    id text, project_id text, start_ms bigint, end_ms bigint, note text,
    breaks jsonb, deleted boolean, created_at bigint, updated_at bigint)
  on conflict (user_id, id) do update set
    project_id = excluded.project_id, start_ms = excluded.start_ms,
    end_ms = excluded.end_ms, note = excluded.note,
    breaks = excluded.breaks, deleted = excluded.deleted,
    updated_at = excluded.updated_at
  where public.time_entries.updated_at < excluded.updated_at;
end; $$;

create or replace function public.sync_push_settings(rows jsonb)
returns void language plpgsql as $$
begin
  insert into public.settings (user_id, key, value, updated_at)
  select auth.uid(), r.key, r.value, r.updated_at
  from jsonb_to_recordset(rows) as r(key text, value jsonb, updated_at bigint)
  on conflict (user_id, key) do update set
    value = excluded.value, updated_at = excluded.updated_at
  where public.settings.updated_at < excluded.updated_at;
end; $$;
