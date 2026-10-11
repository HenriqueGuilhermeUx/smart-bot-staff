-- Staff 2.4.0 — Smart Inbox final hardening v2
-- Applied to Supabase Staff on 2026-10-11 as migration staff_smart_inbox_final_hardening_v2.
-- Completes the reconciled PR #38 schema and tightens least-privilege/RLS.

begin;

alter table public.staff_document_links
  add column if not exists entity_id text;

alter table public.staff_document_actions
  drop constraint if exists staff_document_actions_action_type_check;
alter table public.staff_document_actions
  add constraint staff_document_actions_action_type_check
  check (action_type in (
    'REGISTER_EXPENSE','CREATE_REMINDER','SAVE_DOCUMENT','ADD_MEMORY',
    'LINK_PERSON','LINK_FINANCIAL_ENTRY','ADD_EVENT','IGNORE','CONFIRM','DELETE'
  ));

alter table public.staff_document_links
  drop constraint if exists staff_document_links_entity_type_check;
alter table public.staff_document_links
  add constraint staff_document_links_entity_type_check
  check (entity_type in ('person','financial_entry'));

create unique index if not exists staff_document_links_target_unique_idx
  on public.staff_document_links(user_id, document_id, entity_type, entity_id)
  where entity_id is not null;

create index if not exists staff_document_actions_document_idx
  on public.staff_document_actions(document_id);
create index if not exists staff_document_links_document_idx
  on public.staff_document_links(document_id);
create index if not exists staff_documents_duplicate_of_idx
  on public.staff_documents(duplicate_of)
  where duplicate_of is not null;
create index if not exists staff_financial_entries_source_document_idx
  on public.staff_financial_entries(source_document_id)
  where source_document_id is not null;
create index if not exists staff_memories_source_document_only_idx
  on public.staff_memories(source_document_id)
  where source_document_id is not null;

revoke all privileges on table
  public.staff_documents,
  public.staff_financial_entries,
  public.staff_document_actions,
  public.staff_document_links,
  public.staff_telemetry_events
from public, anon, authenticated;

grant select, insert, update, delete
  on public.staff_documents,
     public.staff_financial_entries,
     public.staff_document_actions,
     public.staff_document_links
to authenticated;

grant select, insert, delete
  on public.staff_telemetry_events
to authenticated;

revoke all privileges on table public.staff_telemetry_daily
from public, anon, authenticated;
grant select on public.staff_telemetry_daily to authenticated;

revoke all privileges on sequence public.staff_telemetry_events_id_seq
from public, anon, authenticated;
grant usage, select on sequence public.staff_telemetry_events_id_seq
to authenticated;

drop policy if exists "staff_documents_all_own" on public.staff_documents;
create policy "staff_documents_all_own"
on public.staff_documents
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "staff_financial_entries_all_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_select_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_insert_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_update_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_delete_own" on public.staff_financial_entries;

create policy "staff_financial_entries_select_own"
on public.staff_financial_entries
for select to authenticated
using ((select auth.uid())::text = user_id::text);

create policy "staff_financial_entries_insert_own"
on public.staff_financial_entries
for insert to authenticated
with check (
  (select auth.uid())::text = user_id::text
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id
        and d.user_id::text = (select auth.uid())::text
    )
  )
);

create policy "staff_financial_entries_update_own"
on public.staff_financial_entries
for update to authenticated
using ((select auth.uid())::text = user_id::text)
with check (
  (select auth.uid())::text = user_id::text
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id
        and d.user_id::text = (select auth.uid())::text
    )
  )
);

create policy "staff_financial_entries_delete_own"
on public.staff_financial_entries
for delete to authenticated
using ((select auth.uid())::text = user_id::text);

drop policy if exists "staff_document_actions_all_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_select_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_insert_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_update_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_delete_own" on public.staff_document_actions;

create policy "staff_document_actions_select_own"
on public.staff_document_actions
for select to authenticated
using ((select auth.uid())::text = user_id::text);

create policy "staff_document_actions_insert_own"
on public.staff_document_actions
for insert to authenticated
with check (
  (select auth.uid())::text = user_id::text
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id
      and d.user_id::text = (select auth.uid())::text
  )
  and (
    coalesce(target_type, '') <> 'financial_entry'
    or (
      target_id is not null
      and exists (
        select 1 from public.staff_financial_entries f
        where f.id::text = target_id
          and f.user_id::text = (select auth.uid())::text
      )
    )
  )
);

create policy "staff_document_actions_update_own"
on public.staff_document_actions
for update to authenticated
using ((select auth.uid())::text = user_id::text)
with check (
  (select auth.uid())::text = user_id::text
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id
      and d.user_id::text = (select auth.uid())::text
  )
  and (
    coalesce(target_type, '') <> 'financial_entry'
    or (
      target_id is not null
      and exists (
        select 1 from public.staff_financial_entries f
        where f.id::text = target_id
          and f.user_id::text = (select auth.uid())::text
      )
    )
  )
);

create policy "staff_document_actions_delete_own"
on public.staff_document_actions
for delete to authenticated
using ((select auth.uid())::text = user_id::text);

drop policy if exists "staff_document_links_all_own" on public.staff_document_links;
drop policy if exists "staff_document_links_select_own" on public.staff_document_links;
drop policy if exists "staff_document_links_insert_own" on public.staff_document_links;
drop policy if exists "staff_document_links_update_own" on public.staff_document_links;
drop policy if exists "staff_document_links_delete_own" on public.staff_document_links;

create policy "staff_document_links_select_own"
on public.staff_document_links
for select to authenticated
using ((select auth.uid())::text = user_id::text);

create policy "staff_document_links_insert_own"
on public.staff_document_links
for insert to authenticated
with check (
  (select auth.uid())::text = user_id::text
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id
      and d.user_id::text = (select auth.uid())::text
  )
  and (
    entity_type <> 'financial_entry'
    or (
      entity_id is not null
      and exists (
        select 1 from public.staff_financial_entries f
        where f.id::text = entity_id
          and f.user_id::text = (select auth.uid())::text
      )
    )
  )
);

create policy "staff_document_links_update_own"
on public.staff_document_links
for update to authenticated
using ((select auth.uid())::text = user_id::text)
with check (
  (select auth.uid())::text = user_id::text
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id
      and d.user_id::text = (select auth.uid())::text
  )
  and (
    entity_type <> 'financial_entry'
    or (
      entity_id is not null
      and exists (
        select 1 from public.staff_financial_entries f
        where f.id::text = entity_id
          and f.user_id::text = (select auth.uid())::text
      )
    )
  )
);

create policy "staff_document_links_delete_own"
on public.staff_document_links
for delete to authenticated
using ((select auth.uid())::text = user_id::text);

drop policy if exists "staff_memories_all_own" on public.staff_memories;
drop policy if exists "staff_memories_select_own" on public.staff_memories;
drop policy if exists "staff_memories_insert_own" on public.staff_memories;
drop policy if exists "staff_memories_update_own" on public.staff_memories;
drop policy if exists "staff_memories_delete_own" on public.staff_memories;

create policy "staff_memories_select_own"
on public.staff_memories
for select to authenticated
using ((select auth.uid())::text = user_id::text);

create policy "staff_memories_insert_own"
on public.staff_memories
for insert to authenticated
with check (
  (select auth.uid())::text = user_id::text
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id
        and d.user_id::text = (select auth.uid())::text
    )
  )
);

create policy "staff_memories_update_own"
on public.staff_memories
for update to authenticated
using ((select auth.uid())::text = user_id::text)
with check (
  (select auth.uid())::text = user_id::text
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id
        and d.user_id::text = (select auth.uid())::text
    )
  )
);

create policy "staff_memories_delete_own"
on public.staff_memories
for delete to authenticated
using ((select auth.uid())::text = user_id::text);

drop policy if exists "staff_telemetry_events_select_own" on public.staff_telemetry_events;
drop policy if exists "staff_telemetry_events_insert_own" on public.staff_telemetry_events;
drop policy if exists "staff_telemetry_events_delete_own" on public.staff_telemetry_events;

create policy "staff_telemetry_events_select_own"
on public.staff_telemetry_events
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "staff_telemetry_events_insert_own"
on public.staff_telemetry_events
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "staff_telemetry_events_delete_own"
on public.staff_telemetry_events
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "staff_documents_storage_select_own" on storage.objects;
drop policy if exists "staff_documents_storage_insert_own" on storage.objects;
drop policy if exists "staff_documents_storage_update_own" on storage.objects;
drop policy if exists "staff_documents_storage_delete_own" on storage.objects;

create policy "staff_documents_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'staff-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "staff_documents_storage_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'staff-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "staff_documents_storage_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'staff-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'staff-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "staff_documents_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'staff-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
