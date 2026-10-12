begin;

alter table public.staff_web_actions
  alter column user_id drop not null,
  add column if not exists source_app text not null default 'staff',
  add column if not exists external_subject_id text,
  add column if not exists capability text;

alter table public.staff_web_actions
  drop constraint if exists staff_web_actions_intent_check;

alter table public.staff_web_actions
  add constraint staff_web_actions_intent_check
  check (intent in ('restaurant_reservation','web_lookup','appointment_search'));

alter table public.staff_web_actions
  drop constraint if exists staff_web_actions_identity_check;

alter table public.staff_web_actions
  add constraint staff_web_actions_identity_check
  check (
    (source_app = 'staff' and user_id is not null and external_subject_id is null)
    or
    (source_app <> 'staff' and user_id is null and external_subject_id is not null)
  );

create index if not exists staff_web_actions_external_subject_idx
  on public.staff_web_actions(source_app, external_subject_id, created_at desc)
  where source_app <> 'staff' and external_subject_id is not null;

create index if not exists staff_web_actions_capability_status_idx
  on public.staff_web_actions(source_app, external_subject_id, capability, status, created_at desc)
  where source_app <> 'staff';

revoke all privileges on table public.staff_web_actions from public, anon, authenticated;
grant select on public.staff_web_actions to authenticated;
grant select, insert, update, delete on public.staff_web_actions to service_role;

comment on column public.staff_web_actions.source_app is
  'Origem da ação. staff = usuário autenticado no Staff; demais valores são integrações federadas.';
comment on column public.staff_web_actions.external_subject_id is
  'Identificador opaco do usuário na aplicação de origem. Não é PII e não concede acesso ao Staff.';
comment on column public.staff_web_actions.capability is
  'Capability federada solicitada, por exemplo web.restaurant.reserve.';

commit;
