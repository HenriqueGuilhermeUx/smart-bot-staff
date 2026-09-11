-- Staff 2.4.0 — Smart Inbox security hardening
-- Execute depois de 20260910_staff_smart_inbox_v1.sql.
-- Reforça ownership cruzado entre documento, finanças, ações, vínculos e memória.

begin;

-- FINANÇAS: um lançamento do usuário só pode apontar para documento do próprio usuário.
drop policy if exists "staff_financial_entries_all_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_select_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_insert_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_update_own" on public.staff_financial_entries;
drop policy if exists "staff_financial_entries_delete_own" on public.staff_financial_entries;

create policy "staff_financial_entries_select_own" on public.staff_financial_entries
for select using (auth.uid() = user_id);

create policy "staff_financial_entries_insert_own" on public.staff_financial_entries
for insert with check (
  auth.uid() = user_id
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id and d.user_id = auth.uid()
    )
  )
);

create policy "staff_financial_entries_update_own" on public.staff_financial_entries
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id and d.user_id = auth.uid()
    )
  )
);

create policy "staff_financial_entries_delete_own" on public.staff_financial_entries
for delete using (auth.uid() = user_id);

-- AÇÕES: não é permitido criar trilha para documento pertencente a outro usuário.
drop policy if exists "staff_document_actions_all_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_select_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_insert_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_update_own" on public.staff_document_actions;
drop policy if exists "staff_document_actions_delete_own" on public.staff_document_actions;

create policy "staff_document_actions_select_own" on public.staff_document_actions
for select using (auth.uid() = user_id);

create policy "staff_document_actions_insert_own" on public.staff_document_actions
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id and d.user_id = auth.uid()
  )
);

create policy "staff_document_actions_update_own" on public.staff_document_actions
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id and d.user_id = auth.uid()
  )
);

create policy "staff_document_actions_delete_own" on public.staff_document_actions
for delete using (auth.uid() = user_id);

-- VÍNCULOS: a pessoa/entidade só pode ser vinculada a documento do próprio usuário.
drop policy if exists "staff_document_links_all_own" on public.staff_document_links;
drop policy if exists "staff_document_links_select_own" on public.staff_document_links;
drop policy if exists "staff_document_links_insert_own" on public.staff_document_links;
drop policy if exists "staff_document_links_update_own" on public.staff_document_links;
drop policy if exists "staff_document_links_delete_own" on public.staff_document_links;

create policy "staff_document_links_select_own" on public.staff_document_links
for select using (auth.uid() = user_id);

create policy "staff_document_links_insert_own" on public.staff_document_links
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id and d.user_id = auth.uid()
  )
);

create policy "staff_document_links_update_own" on public.staff_document_links
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.staff_documents d
    where d.id = document_id and d.user_id = auth.uid()
  )
);

create policy "staff_document_links_delete_own" on public.staff_document_links
for delete using (auth.uid() = user_id);

-- MEMÓRIA: preserva o comportamento antigo, mas impede apontar a fonte para documento alheio.
drop policy if exists "staff_memories_all_own" on public.staff_memories;
drop policy if exists "staff_memories_select_own" on public.staff_memories;
drop policy if exists "staff_memories_insert_own" on public.staff_memories;
drop policy if exists "staff_memories_update_own" on public.staff_memories;
drop policy if exists "staff_memories_delete_own" on public.staff_memories;

create policy "staff_memories_select_own" on public.staff_memories
for select using (auth.uid() = user_id);

create policy "staff_memories_insert_own" on public.staff_memories
for insert with check (
  auth.uid() = user_id
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id and d.user_id = auth.uid()
    )
  )
);

create policy "staff_memories_update_own" on public.staff_memories
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    source_document_id is null
    or exists (
      select 1 from public.staff_documents d
      where d.id = source_document_id and d.user_id = auth.uid()
    )
  )
);

create policy "staff_memories_delete_own" on public.staff_memories
for delete using (auth.uid() = user_id);

commit;
