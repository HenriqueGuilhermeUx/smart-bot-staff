-- Staff 2.3.0 — Família, Estudos e Desafios Kids
-- Execute no SQL Editor do projeto Supabase do Staff.

create extension if not exists pgcrypto;

create table if not exists public.staff_children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  age_group text not null check (age_group in ('3-5','6-8','9-11','12-13')),
  school_grade text,
  avatar_emoji text not null default '🧒',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_children_user_idx on public.staff_children(user_id);

create table if not exists public.staff_study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.staff_children(id) on delete cascade,
  title text not null,
  subject text not null default 'Estudos',
  file_path text,
  file_name text not null,
  mime_type text not null,
  source_only boolean not null default true,
  study_pack jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_study_materials_user_child_idx on public.staff_study_materials(user_id, child_id, created_at desc);

create table if not exists public.staff_kids_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.staff_children(id) on delete cascade,
  deck_id text not null,
  score integer not null default 0 check (score >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  started_at timestamptz not null,
  ended_at timestamptz not null
);

create index if not exists staff_kids_game_sessions_user_child_idx on public.staff_kids_game_sessions(user_id, child_id, started_at desc);

create table if not exists public.staff_study_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references public.staff_children(id) on delete cascade,
  material_id uuid not null references public.staff_study_materials(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  created_at timestamptz not null default now()
);

create index if not exists staff_study_attempts_user_child_idx on public.staff_study_attempts(user_id, child_id, created_at desc);

alter table public.staff_children enable row level security;
alter table public.staff_study_materials enable row level security;
alter table public.staff_kids_game_sessions enable row level security;
alter table public.staff_study_attempts enable row level security;

drop policy if exists "staff_children_select_own" on public.staff_children;
create policy "staff_children_select_own" on public.staff_children for select using (auth.uid() = user_id);
drop policy if exists "staff_children_insert_own" on public.staff_children;
create policy "staff_children_insert_own" on public.staff_children for insert with check (auth.uid() = user_id);
drop policy if exists "staff_children_update_own" on public.staff_children;
create policy "staff_children_update_own" on public.staff_children for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "staff_children_delete_own" on public.staff_children;
create policy "staff_children_delete_own" on public.staff_children for delete using (auth.uid() = user_id);

drop policy if exists "staff_study_materials_select_own" on public.staff_study_materials;
create policy "staff_study_materials_select_own" on public.staff_study_materials for select using (auth.uid() = user_id);
drop policy if exists "staff_study_materials_insert_own" on public.staff_study_materials;
create policy "staff_study_materials_insert_own" on public.staff_study_materials for insert with check (
  auth.uid() = user_id and exists (select 1 from public.staff_children c where c.id = child_id and c.user_id = auth.uid())
);
drop policy if exists "staff_study_materials_update_own" on public.staff_study_materials;
create policy "staff_study_materials_update_own" on public.staff_study_materials for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "staff_study_materials_delete_own" on public.staff_study_materials;
create policy "staff_study_materials_delete_own" on public.staff_study_materials for delete using (auth.uid() = user_id);

drop policy if exists "staff_kids_game_sessions_select_own" on public.staff_kids_game_sessions;
create policy "staff_kids_game_sessions_select_own" on public.staff_kids_game_sessions for select using (auth.uid() = user_id);
drop policy if exists "staff_kids_game_sessions_insert_own" on public.staff_kids_game_sessions;
create policy "staff_kids_game_sessions_insert_own" on public.staff_kids_game_sessions for insert with check (
  auth.uid() = user_id and exists (select 1 from public.staff_children c where c.id = child_id and c.user_id = auth.uid())
);

drop policy if exists "staff_study_attempts_select_own" on public.staff_study_attempts;
create policy "staff_study_attempts_select_own" on public.staff_study_attempts for select using (auth.uid() = user_id);
drop policy if exists "staff_study_attempts_insert_own" on public.staff_study_attempts;
create policy "staff_study_attempts_insert_own" on public.staff_study_attempts for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.staff_children c where c.id = child_id and c.user_id = auth.uid())
  and exists (select 1 from public.staff_study_materials m where m.id = material_id and m.user_id = auth.uid())
);

-- Bucket privado. O primeiro diretório do objeto é sempre o auth.uid().
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-study-materials',
  'staff-study-materials',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff_study_storage_select_own" on storage.objects;
create policy "staff_study_storage_select_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'staff-study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "staff_study_storage_insert_own" on storage.objects;
create policy "staff_study_storage_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'staff-study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "staff_study_storage_delete_own" on storage.objects;
create policy "staff_study_storage_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'staff-study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on table public.staff_children is 'Perfis infantis gerenciados exclusivamente pela conta autenticada do responsável.';
comment on table public.staff_study_materials is 'Materiais escolares enviados pelo responsável e pacotes de estudo gerados a partir deles.';
comment on table public.staff_kids_game_sessions is 'Sessões temporizadas dos Desafios Kids.';
comment on table public.staff_study_attempts is 'Resultados de revisões e simulados realizados com material previamente preparado.';
