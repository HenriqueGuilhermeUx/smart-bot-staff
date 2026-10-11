begin;

alter table public.staff_profiles
  add column if not exists reservation_name text,
  add column if not exists reservation_phone text,
  add column if not exists web_actions_enabled boolean not null default true;

revoke all privileges on table public.staff_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.staff_profiles to authenticated;

drop policy if exists "staff_profiles_select_own" on public.staff_profiles;
drop policy if exists "staff_profiles_insert_own" on public.staff_profiles;
drop policy if exists "staff_profiles_update_own" on public.staff_profiles;
drop policy if exists "staff_profiles_delete_own" on public.staff_profiles;

create policy "staff_profiles_select_own"
on public.staff_profiles for select to authenticated
using ((select auth.uid())::text = user_id::text);

create policy "staff_profiles_insert_own"
on public.staff_profiles for insert to authenticated
with check ((select auth.uid())::text = user_id::text);

create policy "staff_profiles_update_own"
on public.staff_profiles for update to authenticated
using ((select auth.uid())::text = user_id::text)
with check ((select auth.uid())::text = user_id::text);

create policy "staff_profiles_delete_own"
on public.staff_profiles for delete to authenticated
using ((select auth.uid())::text = user_id::text);

create table if not exists public.staff_web_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_text text not null check (char_length(request_text) between 1 and 4000),
  intent text not null check (intent in ('restaurant_reservation','web_lookup')),
  risk_level text not null default 'low' check (risk_level in ('read_only','low','blocked')),
  status text not null default 'queued' check (status in (
    'queued','running','needs_profile','needs_confirmation','completed','failed','cancelled'
  )),
  provider text not null default 'browser-use',
  external_task_id uuid,
  external_session_id uuid,
  result_summary text,
  result_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_web_actions_user_created_idx
  on public.staff_web_actions(user_id, created_at desc);
create index if not exists staff_web_actions_external_task_idx
  on public.staff_web_actions(external_task_id)
  where external_task_id is not null;

alter table public.staff_web_actions enable row level security;

revoke all privileges on table public.staff_web_actions from public, anon, authenticated;
grant select on public.staff_web_actions to authenticated;

drop policy if exists "staff_web_actions_select_own" on public.staff_web_actions;
create policy "staff_web_actions_select_own"
on public.staff_web_actions for select to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists staff_web_actions_updated_at on public.staff_web_actions;
create trigger staff_web_actions_updated_at
before update on public.staff_web_actions
for each row execute function public.staff_set_updated_at();

comment on table public.staff_web_actions is 'Auditoria das ações web do Staff. Nunca armazena credenciais, cartões, OTPs ou segredos do navegador.';
comment on column public.staff_profiles.reservation_phone is 'Telefone fornecido pelo usuário para reservas simples; não usar para pagamentos ou autenticação.';

commit;
