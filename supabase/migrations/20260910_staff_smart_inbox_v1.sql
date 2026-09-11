-- Staff 2.4.0 — Smart Inbox / Document Intelligence v1
-- Execute no SQL Editor do projeto Supabase do Staff antes de publicar a versão.

begin;

create extension if not exists pgcrypto;

create table if not exists public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null default 'OTHER' check (document_type in (
    'RECEIPT','INVOICE','BILL','BANK_RECEIPT','CONTRACT','WARRANTY',
    'IDENTITY_DOCUMENT','MEDICAL_DOCUMENT','OTHER'
  )),
  status text not null default 'uploaded' check (status in (
    'uploaded','processing','needs_review','confirmed','archived','ignored','error'
  )),
  title text,
  issuer text,
  issuer_document text,
  recipient text,
  document_number text,
  issue_date date,
  due_date date,
  total_amount numeric(16,2),
  currency text not null default 'BRL',
  payment_method text,
  items jsonb not null default '[]'::jsonb,
  parties jsonb not null default '[]'::jsonb,
  obligations jsonb not null default '[]'::jsonb,
  summary text,
  raw_text text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  file_hash text,
  privacy_class text not null default 'standard' check (privacy_class in ('standard','identity','medical')),
  external_processing_consent boolean not null default false,
  provider text,
  provider_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  duplicate_of uuid references public.staff_documents(id) on delete set null,
  dedupe_fingerprint text,
  error_code text,
  error_message text,
  confirmed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_documents_user_created_idx on public.staff_documents(user_id, created_at desc);
create index if not exists staff_documents_user_status_idx on public.staff_documents(user_id, status, created_at desc);
create index if not exists staff_documents_user_due_idx on public.staff_documents(user_id, due_date) where due_date is not null;
create index if not exists staff_documents_fingerprint_idx on public.staff_documents(user_id, dedupe_fingerprint) where dedupe_fingerprint is not null;
create index if not exists staff_documents_hash_idx on public.staff_documents(user_id, file_hash) where file_hash is not null;

create table if not exists public.staff_financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null default 'expense' check (entry_type in ('expense','income')),
  description text not null,
  amount numeric(16,2) not null check (amount >= 0),
  currency text not null default 'BRL',
  occurred_on date not null,
  category text not null default 'Outros',
  merchant text,
  payment_method text,
  source_document_id uuid references public.staff_documents(id) on delete set null,
  dedupe_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_financial_entries_user_date_idx on public.staff_financial_entries(user_id, occurred_on desc, created_at desc);
create index if not exists staff_financial_entries_fingerprint_idx on public.staff_financial_entries(user_id, dedupe_fingerprint) where dedupe_fingerprint is not null;
create unique index if not exists staff_financial_entries_document_unique_idx
  on public.staff_financial_entries(user_id, source_document_id)
  where source_document_id is not null;

create table if not exists public.staff_document_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.staff_documents(id) on delete cascade,
  action_type text not null check (action_type in (
    'REGISTER_EXPENSE','CREATE_REMINDER','SAVE_DOCUMENT','ADD_MEMORY',
    'LINK_PERSON','ADD_EVENT','IGNORE','CONFIRM','DELETE'
  )),
  status text not null default 'completed' check (status in ('pending','completed','failed','cancelled')),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staff_document_actions_user_doc_idx on public.staff_document_actions(user_id, document_id, created_at desc);

create table if not exists public.staff_document_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.staff_documents(id) on delete cascade,
  entity_type text not null default 'person' check (entity_type in ('person')),
  entity_label text not null check (char_length(entity_label) between 1 and 160),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staff_document_links_user_doc_idx on public.staff_document_links(user_id, document_id);

create table if not exists public.staff_telemetry_events (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'document.uploaded','document.classified','document.extracted','document.confirmed',
    'financial_entry.created_from_document','reminder.created_from_document'
  )),
  entity_id uuid,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (octet_length(properties::text) <= 4096)
);
create index if not exists staff_telemetry_events_user_created_idx on public.staff_telemetry_events(user_id, created_at desc);
create index if not exists staff_telemetry_events_name_created_idx on public.staff_telemetry_events(event_name, created_at desc);

alter table public.staff_memories
  add column if not exists source_document_id uuid references public.staff_documents(id) on delete set null;
create index if not exists staff_memories_source_document_idx on public.staff_memories(user_id, source_document_id) where source_document_id is not null;

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

drop trigger if exists staff_documents_updated_at on public.staff_documents;
create trigger staff_documents_updated_at before update on public.staff_documents
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_financial_entries_updated_at on public.staff_financial_entries;
create trigger staff_financial_entries_updated_at before update on public.staff_financial_entries
for each row execute function public.staff_set_updated_at();

alter table public.staff_documents enable row level security;
alter table public.staff_financial_entries enable row level security;
alter table public.staff_document_actions enable row level security;
alter table public.staff_document_links enable row level security;
alter table public.staff_telemetry_events enable row level security;

grant select, insert, update, delete on public.staff_documents to authenticated;
grant select, insert, update, delete on public.staff_financial_entries to authenticated;
grant select, insert, update, delete on public.staff_document_actions to authenticated;
grant select, insert, update, delete on public.staff_document_links to authenticated;
grant select, insert, delete on public.staff_telemetry_events to authenticated;
grant usage, select on sequence public.staff_telemetry_events_id_seq to authenticated;

drop policy if exists "staff_documents_all_own" on public.staff_documents;
create policy "staff_documents_all_own" on public.staff_documents for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "staff_financial_entries_all_own" on public.staff_financial_entries;
create policy "staff_financial_entries_all_own" on public.staff_financial_entries for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "staff_document_actions_all_own" on public.staff_document_actions;
create policy "staff_document_actions_all_own" on public.staff_document_actions for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "staff_document_links_all_own" on public.staff_document_links;
create policy "staff_document_links_all_own" on public.staff_document_links for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "staff_telemetry_events_select_own" on public.staff_telemetry_events;
create policy "staff_telemetry_events_select_own" on public.staff_telemetry_events for select
using (auth.uid() = user_id);
drop policy if exists "staff_telemetry_events_insert_own" on public.staff_telemetry_events;
create policy "staff_telemetry_events_insert_own" on public.staff_telemetry_events for insert
with check (auth.uid() = user_id);
drop policy if exists "staff_telemetry_events_delete_own" on public.staff_telemetry_events;
create policy "staff_telemetry_events_delete_own" on public.staff_telemetry_events for delete
using (auth.uid() = user_id);

-- Visão agregada preparada para integração futura com AV OS.
-- Não contém texto, arquivo, valores individuais, partes, obrigações ou conteúdo documental.
create or replace view public.staff_telemetry_daily
with (security_invoker = true)
as
select
  user_id,
  (created_at at time zone 'UTC')::date as day,
  event_name,
  count(*)::bigint as event_count
from public.staff_telemetry_events
group by user_id, (created_at at time zone 'UTC')::date, event_name;
grant select on public.staff_telemetry_daily to authenticated;

-- Bucket privado. O primeiro diretório do objeto é sempre auth.uid().
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-documents',
  'staff-documents',
  false,
  12582912,
  array[
    'image/jpeg','image/png','image/webp','application/pdf','text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff_documents_storage_select_own" on storage.objects;
create policy "staff_documents_storage_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "staff_documents_storage_insert_own" on storage.objects;
create policy "staff_documents_storage_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "staff_documents_storage_update_own" on storage.objects;
create policy "staff_documents_storage_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "staff_documents_storage_delete_own" on storage.objects;
create policy "staff_documents_storage_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.staff_documents is 'Smart Inbox: metadados, extração estruturada e referência ao arquivo privado do usuário.';
comment on table public.staff_financial_entries is 'Ledger financeiro do Staff; lançamentos originados por documento exigem confirmação explícita do usuário.';
comment on table public.staff_document_actions is 'Trilha de ações confirmadas pelo usuário a partir de documentos.';
comment on table public.staff_telemetry_events is 'Eventos operacionais sem conteúdo documental; base para métricas agregadas ao AV OS.';

commit;
