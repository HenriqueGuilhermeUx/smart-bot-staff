-- Staff Agenda Avançada + Automações v1
-- Compatível com user_id armazenado como text ou uuid nas tabelas antigas.
-- Execute no SQL Editor do Supabase antes de publicar o módulo.

begin;

create extension if not exists pgcrypto;

create table if not exists public.staff_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  series_id uuid,
  parent_event_id uuid references public.staff_events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  category text not null default 'pessoal',
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  all_day boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'chat', 'automation', 'integration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.staff_event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.staff_events(id) on delete cascade,
  user_id text not null,
  minutes_before integer not null default 30 check (minutes_before between 0 and 43200),
  channel text not null default 'local' check (channel in ('local', 'in_app', 'push')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, minutes_before, channel)
);

create table if not exists public.staff_event_recurrences (
  event_id uuid primary key references public.staff_events(id) on delete cascade,
  user_id text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval_value integer not null default 1 check (interval_value between 1 and 365),
  weekdays smallint[] not null default '{}',
  month_day smallint,
  until_at timestamptz,
  count_limit integer check (count_limit between 1 and 366),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_automations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  template_key text,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  enabled boolean not null default false,
  trigger_type text not null default 'schedule' check (trigger_type in ('schedule', 'event', 'task')),
  trigger_config jsonb not null default '{}'::jsonb,
  action_type text not null check (action_type in ('daily_brief', 'morning_plan', 'weekly_review', 'overdue_tasks', 'tomorrow_events', 'notification')),
  action_config jsonb not null default '{}'::jsonb,
  requires_confirmation boolean not null default false,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, template_key)
);

create table if not exists public.staff_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.staff_automations(id) on delete set null,
  user_id text not null,
  status text not null default 'running' check (status in ('queued', 'running', 'success', 'error', 'skipped')),
  triggered_at timestamptz not null default now(),
  executed_at timestamptz,
  result_json jsonb,
  error_message text
);

create table if not exists public.staff_action_queue (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references public.staff_automations(id) on delete set null,
  user_id text not null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  requires_confirmation boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  automation_id uuid references public.staff_automations(id) on delete set null,
  event_id uuid references public.staff_events(id) on delete set null,
  task_id text,
  title text not null,
  body text not null,
  category text not null default 'assistant',
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_notifications_dedupe_idx on public.staff_notifications(dedupe_key);
create index if not exists staff_events_user_start_idx on public.staff_events(user_id, start_at);
create index if not exists staff_events_series_idx on public.staff_events(series_id, start_at);
create index if not exists staff_event_reminders_due_idx on public.staff_event_reminders(delivered_at, event_id);
create index if not exists staff_automations_due_idx on public.staff_automations(enabled, next_run_at);
create index if not exists staff_automation_runs_user_idx on public.staff_automation_runs(user_id, triggered_at desc);
create index if not exists staff_action_queue_due_idx on public.staff_action_queue(status, scheduled_for);
create index if not exists staff_notifications_user_idx on public.staff_notifications(user_id, read_at, created_at desc);

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

drop trigger if exists staff_events_updated_at on public.staff_events;
create trigger staff_events_updated_at before update on public.staff_events
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_event_recurrences_updated_at on public.staff_event_recurrences;
create trigger staff_event_recurrences_updated_at before update on public.staff_event_recurrences
for each row execute function public.staff_set_updated_at();

drop trigger if exists staff_automations_updated_at on public.staff_automations;
create trigger staff_automations_updated_at before update on public.staff_automations
for each row execute function public.staff_set_updated_at();

alter table public.staff_events enable row level security;
alter table public.staff_event_reminders enable row level security;
alter table public.staff_event_recurrences enable row level security;
alter table public.staff_automations enable row level security;
alter table public.staff_automation_runs enable row level security;
alter table public.staff_action_queue enable row level security;
alter table public.staff_notifications enable row level security;

grant select, insert, update, delete on public.staff_events to authenticated;
grant select, insert, update, delete on public.staff_event_reminders to authenticated;
grant select, insert, update, delete on public.staff_event_recurrences to authenticated;
grant select, insert, update, delete on public.staff_automations to authenticated;
grant select on public.staff_automation_runs to authenticated;
grant select on public.staff_action_queue to authenticated;
grant select, update, delete on public.staff_notifications to authenticated;

create policy "staff_events_all_own" on public.staff_events for all
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "staff_event_reminders_all_own" on public.staff_event_reminders for all
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "staff_event_recurrences_all_own" on public.staff_event_recurrences for all
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "staff_automations_all_own" on public.staff_automations for all
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "staff_automation_runs_select_own" on public.staff_automation_runs for select
using (auth.uid()::text = user_id::text);

create policy "staff_action_queue_select_own" on public.staff_action_queue for select
using (auth.uid()::text = user_id::text);

create policy "staff_notifications_select_own" on public.staff_notifications for select
using (auth.uid()::text = user_id::text);

create policy "staff_notifications_update_own" on public.staff_notifications for update
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "staff_notifications_delete_own" on public.staff_notifications for delete
using (auth.uid()::text = user_id::text);

create or replace function public.staff_seed_automation_templates()
returns setof public.staff_automations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.uid()::text;
  v_timezone text := 'America/Sao_Paulo';
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_daily timestamptz;
  v_morning timestamptz;
  v_evening timestamptz;
  v_weekly timestamptz;
  v_hourly timestamptz;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  v_daily := (v_today + time '07:00') at time zone v_timezone;
  if v_daily <= now() then v_daily := v_daily + interval '1 day'; end if;

  v_morning := (v_today + time '08:00') at time zone v_timezone;
  if v_morning <= now() then v_morning := v_morning + interval '1 day'; end if;

  v_evening := (v_today + time '18:00') at time zone v_timezone;
  if v_evening <= now() then v_evening := v_evening + interval '1 day'; end if;

  v_weekly := ((v_today + ((7 - extract(dow from v_today)::integer) % 7)) + time '18:00') at time zone v_timezone;
  if v_weekly <= now() then v_weekly := v_weekly + interval '7 days'; end if;

  v_hourly := date_trunc('hour', now()) + interval '2 hours';

  insert into public.staff_automations (
    user_id, template_key, name, description, enabled, trigger_type,
    trigger_config, action_type, action_config, next_run_at
  ) values
    (v_user_id, 'daily_brief', 'Resumo diário', 'Resumo de tarefas, atrasos e compromissos do dia.', true, 'schedule',
      jsonb_build_object('frequency','daily','time','07:00','timezone',v_timezone), 'daily_brief', '{}'::jsonb, v_daily),
    (v_user_id, 'morning_plan', 'Planejamento da manhã', 'Sugere a prioridade principal e organiza o início do dia.', false, 'schedule',
      jsonb_build_object('frequency','daily','time','08:00','timezone',v_timezone), 'morning_plan', '{}'::jsonb, v_morning),
    (v_user_id, 'overdue_tasks', 'Tarefas atrasadas', 'Avisa quando existirem tarefas pendentes vencidas.', true, 'schedule',
      jsonb_build_object('frequency','hourly','interval',2,'timezone',v_timezone), 'overdue_tasks', '{}'::jsonb, v_hourly),
    (v_user_id, 'tomorrow_events', 'Compromissos de amanhã', 'No fim do dia, mostra os compromissos do dia seguinte.', true, 'schedule',
      jsonb_build_object('frequency','daily','time','18:00','timezone',v_timezone), 'tomorrow_events', '{}'::jsonb, v_evening),
    (v_user_id, 'weekly_review', 'Revisão semanal', 'Resume a semana concluída e o que ainda está pendente.', false, 'schedule',
      jsonb_build_object('frequency','weekly','weekday',0,'time','18:00','timezone',v_timezone), 'weekly_review', '{}'::jsonb, v_weekly)
  on conflict (user_id, template_key) do nothing;

  return query
  select * from public.staff_automations where user_id = v_user_id order by created_at;
end;
$$;

grant execute on function public.staff_seed_automation_templates() to authenticated;

create or replace function public.staff_process_due_automations(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_automation record;
  v_reminder record;
  v_run_id uuid;
  v_queue_id uuid;
  v_title text;
  v_body text;
  v_frequency text;
  v_timezone text;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_next timestamptz;
  v_count_one integer;
  v_count_two integer;
  v_processed integer := 0;
  v_notifications integer := 0;
  v_should_notify boolean;
begin
  for v_automation in
    select *
    from public.staff_automations
    where enabled = true
      and next_run_at is not null
      and next_run_at <= p_now
    order by next_run_at
    limit 100
    for update skip locked
  loop
    begin
      v_should_notify := true;
      v_title := v_automation.name;
      v_body := coalesce(v_automation.description, 'Automação executada pelo Staff.');
      v_timezone := coalesce(v_automation.trigger_config ->> 'timezone', 'America/Sao_Paulo');
      v_day_start := (date_trunc('day', p_now at time zone v_timezone) at time zone v_timezone);
      v_day_end := v_day_start + interval '1 day';

      insert into public.staff_automation_runs (automation_id, user_id, status, triggered_at)
      values (v_automation.id, v_automation.user_id, 'running', p_now)
      returning id into v_run_id;

      insert into public.staff_action_queue (
        automation_id, user_id, action_type, payload, scheduled_for, status, requires_confirmation
      ) values (
        v_automation.id, v_automation.user_id, v_automation.action_type,
        jsonb_build_object('automation_name', v_automation.name), p_now, 'processing', v_automation.requires_confirmation
      ) returning id into v_queue_id;

      if v_automation.action_type in ('daily_brief', 'morning_plan') then
        select count(*) into v_count_one
        from public.staff_tasks
        where user_id::text = v_automation.user_id::text
          and status = 'pending'
          and due_at >= v_day_start and due_at < v_day_end;

        select count(*) into v_count_two
        from public.staff_events
        where user_id::text = v_automation.user_id::text
          and status = 'scheduled'
          and start_at >= v_day_start and start_at < v_day_end;

        v_title := case when v_automation.action_type = 'daily_brief' then 'Seu resumo de hoje' else 'Vamos planejar sua manhã' end;
        v_body := format('Você tem %s tarefa(s) e %s compromisso(s) para hoje.', v_count_one, v_count_two);

      elsif v_automation.action_type = 'overdue_tasks' then
        select count(*) into v_count_one
        from public.staff_tasks
        where user_id::text = v_automation.user_id::text
          and status = 'pending'
          and due_at is not null
          and due_at < p_now;

        if v_count_one = 0 then
          v_should_notify := false;
        else
          v_title := 'Você tem tarefas atrasadas';
          v_body := format('%s tarefa(s) precisam da sua atenção.', v_count_one);
        end if;

      elsif v_automation.action_type = 'tomorrow_events' then
        select count(*) into v_count_one
        from public.staff_events
        where user_id::text = v_automation.user_id::text
          and status = 'scheduled'
          and start_at >= v_day_end and start_at < v_day_end + interval '1 day';

        if v_count_one = 0 then
          v_should_notify := false;
        else
          v_title := 'Agenda de amanhã';
          v_body := format('Você tem %s compromisso(s) marcado(s) para amanhã.', v_count_one);
        end if;

      elsif v_automation.action_type = 'weekly_review' then
        select count(*) into v_count_one
        from public.staff_tasks
        where user_id::text = v_automation.user_id::text
          and status = 'completed'
          and completed_at >= p_now - interval '7 days';

        select count(*) into v_count_two
        from public.staff_tasks
        where user_id::text = v_automation.user_id::text
          and status = 'pending';

        v_title := 'Sua revisão da semana';
        v_body := format('Você concluiu %s tarefa(s) e mantém %s pendente(s).', v_count_one, v_count_two);
      end if;

      if v_should_notify then
        insert into public.staff_notifications (
          user_id, automation_id, title, body, category, dedupe_key
        ) values (
          v_automation.user_id, v_automation.id, v_title, v_body, 'automation',
          format('automation:%s:%s', v_automation.id, v_automation.next_run_at)
        ) on conflict (dedupe_key) do nothing;
        v_notifications := v_notifications + 1;
      end if;

      v_frequency := coalesce(v_automation.trigger_config ->> 'frequency', 'daily');
      if v_frequency = 'hourly' then
        v_next := greatest(v_automation.next_run_at, p_now)
          + make_interval(hours => greatest(1, coalesce((v_automation.trigger_config ->> 'interval')::integer, 1)));
      elsif v_frequency = 'weekly' then
        v_next := greatest(v_automation.next_run_at, p_now) + interval '7 days';
      else
        v_next := greatest(v_automation.next_run_at, p_now) + interval '1 day';
      end if;

      update public.staff_automations
      set last_run_at = p_now, next_run_at = v_next
      where id = v_automation.id;

      update public.staff_action_queue
      set status = 'completed', processed_at = now(), payload = payload || jsonb_build_object('notified', v_should_notify)
      where id = v_queue_id;

      update public.staff_automation_runs
      set status = case when v_should_notify then 'success' else 'skipped' end,
          executed_at = now(),
          result_json = jsonb_build_object('notified', v_should_notify, 'title', v_title, 'body', v_body)
      where id = v_run_id;

      v_processed := v_processed + 1;
    exception when others then
      if v_queue_id is not null then
        update public.staff_action_queue set status = 'failed', processed_at = now() where id = v_queue_id;
      end if;
      if v_run_id is not null then
        update public.staff_automation_runs set status = 'error', executed_at = now(), error_message = sqlerrm where id = v_run_id;
      end if;
    end;
  end loop;

  for v_reminder in
    select
      r.id as reminder_id,
      r.event_id,
      r.user_id,
      r.minutes_before,
      e.title,
      e.start_at,
      e.location
    from public.staff_event_reminders r
    join public.staff_events e on e.id = r.event_id
    where r.delivered_at is null
      and e.status = 'scheduled'
      and e.start_at - make_interval(mins => r.minutes_before) <= p_now
      and e.start_at > p_now - interval '1 day'
    order by e.start_at
    limit 200
    for update of r skip locked
  loop
    insert into public.staff_notifications (
      user_id, event_id, title, body, category, dedupe_key
    ) values (
      v_reminder.user_id,
      v_reminder.event_id,
      'Compromisso próximo',
      format('%s começa às %s%s.', v_reminder.title, to_char(v_reminder.start_at, 'HH24:MI'),
        case when v_reminder.location is null or v_reminder.location = '' then '' else ' em ' || v_reminder.location end),
      'event',
      format('event:%s:reminder:%s', v_reminder.event_id, v_reminder.minutes_before)
    ) on conflict (dedupe_key) do nothing;

    update public.staff_event_reminders set delivered_at = p_now where id = v_reminder.reminder_id;
    v_notifications := v_notifications + 1;
  end loop;

  return jsonb_build_object(
    'processed_automations', v_processed,
    'created_notifications', v_notifications,
    'processed_at', p_now
  );
end;
$$;

revoke all on function public.staff_process_due_automations(timestamptz) from public;
grant execute on function public.staff_process_due_automations(timestamptz) to service_role;

commit;
