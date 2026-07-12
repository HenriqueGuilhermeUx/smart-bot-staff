-- Staff v2 core: memória de conversa, tarefas, lembretes e preferências.
-- Execute no SQL Editor do Supabase do projeto Staff.

create extension if not exists pgcrypto;

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  nexa_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  notes text,
  category text not null default 'pessoal' check (category in (
    'pessoal', 'financas', 'saude', 'familia', 'casa', 'trabalho',
    'veiculos', 'documentos', 'investimentos', 'eventos', 'estudos',
    'viagens', 'metas'
  )),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_at timestamptz,
  remind_at timestamptz,
  recurrence text,
  source text not null default 'manual' check (source in ('chat', 'manual', 'integration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_key text not null default 'main',
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);

create table if not exists public.staff_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'pessoal',
  content text not null,
  importance smallint not null default 1 check (importance between 1 and 5),
  source_message_id uuid references public.staff_messages(id) on delete set null,
  user_confirmed boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  daily_summary_enabled boolean not null default false,
  daily_summary_time time not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_tasks_user_status_idx on public.staff_tasks(user_id, status);
create index if not exists staff_tasks_user_due_idx on public.staff_tasks(user_id, due_at);
create index if not exists staff_messages_user_thread_idx on public.staff_messages(user_id, thread_key, created_at);
create index if not exists staff_memories_user_idx on public.staff_memories(user_id, archived, importance desc);

create or replace function public.staff_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_profiles_updated_at on public.staff_profiles;
create trigger staff_profiles_updated_at before update on public.staff_profiles
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_tasks_updated_at on public.staff_tasks;
create trigger staff_tasks_updated_at before update on public.staff_tasks
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_memories_updated_at on public.staff_memories;
create trigger staff_memories_updated_at before update on public.staff_memories
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_notification_preferences_updated_at on public.staff_notification_preferences;
create trigger staff_notification_preferences_updated_at before update on public.staff_notification_preferences
for each row execute function public.staff_set_updated_at();

alter table public.staff_profiles enable row level security;
alter table public.staff_tasks enable row level security;
alter table public.staff_messages enable row level security;
alter table public.staff_memories enable row level security;
alter table public.staff_notification_preferences enable row level security;

grant select, insert, update, delete on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.staff_tasks to authenticated;
grant select, insert, update, delete on public.staff_messages to authenticated;
grant select, insert, update, delete on public.staff_memories to authenticated;
grant select, insert, update, delete on public.staff_notification_preferences to authenticated;

drop policy if exists "staff_profiles_select_own" on public.staff_profiles;
create policy "staff_profiles_select_own" on public.staff_profiles for select using (auth.uid() = user_id);
drop policy if exists "staff_profiles_insert_own" on public.staff_profiles;
create policy "staff_profiles_insert_own" on public.staff_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "staff_profiles_update_own" on public.staff_profiles;
create policy "staff_profiles_update_own" on public.staff_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "staff_profiles_delete_own" on public.staff_profiles;
create policy "staff_profiles_delete_own" on public.staff_profiles for delete using (auth.uid() = user_id);

drop policy if exists "staff_tasks_all_own" on public.staff_tasks;
create policy "staff_tasks_all_own" on public.staff_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "staff_messages_all_own" on public.staff_messages;
create policy "staff_messages_all_own" on public.staff_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "staff_memories_all_own" on public.staff_memories;
create policy "staff_memories_all_own" on public.staff_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "staff_notification_preferences_all_own" on public.staff_notification_preferences;
create policy "staff_notification_preferences_all_own" on public.staff_notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cria automaticamente o perfil básico após o cadastro.
create or replace function public.staff_create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists staff_on_auth_user_created on auth.users;
create trigger staff_on_auth_user_created
after insert on auth.users
for each row execute function public.staff_create_profile_for_new_user();

-- Garante perfil para usuários já existentes.
insert into public.staff_profiles (user_id, display_name)
select id, coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1))
from auth.users
on conflict (user_id) do nothing;
