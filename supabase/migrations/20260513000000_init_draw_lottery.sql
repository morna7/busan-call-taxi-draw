create extension if not exists pgcrypto;

create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  public_code text unique not null,
  title text not null,
  origin text not null,
  destination text not null,
  departure_time text,
  estimated_fare text,
  customer_request text,
  admin_memo text,
  status text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_seconds integer default 180 not null,
  winner_participant_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  drawn_at timestamptz,
  cancelled_at timestamptz,
  constraint draws_status_check check (status in ('scheduled', 'open', 'drawing', 'completed', 'cancelled')),
  constraint draws_duration_check check (duration_seconds between 30 and 3600),
  constraint draws_time_check check (end_at > start_at)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  name text not null,
  phone_last4 text,
  joined_at timestamptz default now() not null,
  user_agent_hash text,
  is_winner boolean default false not null,
  constraint participants_name_check check (length(btrim(name)) > 0),
  constraint participants_phone_last4_check check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$')
);

alter table public.draws
  add constraint draws_winner_participant_id_fkey
  foreign key (winner_participant_id)
  references public.participants(id)
  on delete set null;

create table if not exists public.draw_audit_logs (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  action text not null,
  details jsonb,
  created_at timestamptz default now() not null
);

create index if not exists draws_status_end_at_idx on public.draws(status, end_at);
create index if not exists draws_public_code_idx on public.draws(public_code);
create index if not exists participants_draw_joined_at_idx on public.participants(draw_id, joined_at);
create index if not exists participants_draw_winner_idx on public.participants(draw_id, is_winner);

create unique index if not exists participants_draw_name_phone_unique
  on public.participants (draw_id, lower(btrim(name)), coalesce(phone_last4, ''));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists draws_set_updated_at on public.draws;
create trigger draws_set_updated_at
before update on public.draws
for each row
execute function public.set_updated_at();

create or replace function public.complete_draw_with_winner(
  p_draw_id uuid,
  p_winner_participant_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw public.draws%rowtype;
begin
  select * into v_draw
  from public.draws
  where id = p_draw_id
  for update;

  if not found then
    raise exception 'draw_not_found';
  end if;

  if v_draw.status = 'completed' then
    return;
  end if;

  if v_draw.status <> 'drawing' then
    raise exception 'draw_not_in_drawing_state';
  end if;

  if not exists (
    select 1
    from public.participants
    where id = p_winner_participant_id
      and draw_id = p_draw_id
  ) then
    raise exception 'winner_not_in_draw';
  end if;

  update public.participants
  set is_winner = (id = p_winner_participant_id)
  where draw_id = p_draw_id;

  update public.draws
  set
    status = 'completed',
    winner_participant_id = p_winner_participant_id,
    drawn_at = now(),
    updated_at = now()
  where id = p_draw_id;

  insert into public.draw_audit_logs (draw_id, action, details)
  values (
    p_draw_id,
    'draw_completed',
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object('winnerParticipantId', p_winner_participant_id)
  );
end;
$$;

create or replace function public.complete_draw_without_winner(
  p_draw_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw public.draws%rowtype;
begin
  select * into v_draw
  from public.draws
  where id = p_draw_id
  for update;

  if not found then
    raise exception 'draw_not_found';
  end if;

  if v_draw.status = 'completed' then
    return;
  end if;

  if v_draw.status <> 'drawing' then
    raise exception 'draw_not_in_drawing_state';
  end if;

  update public.participants
  set is_winner = false
  where draw_id = p_draw_id;

  update public.draws
  set
    status = 'completed',
    winner_participant_id = null,
    drawn_at = now(),
    updated_at = now()
  where id = p_draw_id;

  insert into public.draw_audit_logs (draw_id, action, details)
  values (
    p_draw_id,
    'draw_completed_without_winner',
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.complete_draw_with_winner(uuid, uuid, jsonb) from public;
revoke all on function public.complete_draw_without_winner(uuid, jsonb) from public;
grant execute on function public.complete_draw_with_winner(uuid, uuid, jsonb) to service_role;
grant execute on function public.complete_draw_without_winner(uuid, jsonb) to service_role;

create or replace view public.public_draws as
select
  id,
  public_code,
  title,
  origin,
  destination,
  departure_time,
  estimated_fare,
  status,
  start_at,
  end_at,
  duration_seconds,
  winner_participant_id,
  drawn_at,
  cancelled_at,
  created_at,
  updated_at
from public.draws;

create or replace view public.public_draw_results as
select
  d.id,
  d.public_code,
  d.status,
  d.drawn_at,
  d.winner_participant_id,
  p.name as winner_name
from public.draws d
left join public.participants p on p.id = d.winner_participant_id;

grant select on public.public_draws to anon, authenticated;
grant select on public.public_draw_results to anon, authenticated;
grant insert on public.participants to anon;
grant all on public.draws to authenticated;
grant all on public.participants to authenticated;
grant all on public.draw_audit_logs to authenticated;

alter table public.draws enable row level security;
alter table public.participants enable row level security;
alter table public.draw_audit_logs enable row level security;

drop policy if exists "Authenticated admins can manage draws" on public.draws;
create policy "Authenticated admins can manage draws"
on public.draws
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can manage participants" on public.participants;
create policy "Authenticated admins can manage participants"
on public.participants
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can join open draws" on public.participants;
create policy "Public can join open draws"
on public.participants
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.draws d
    where d.id = draw_id
      and d.status = 'open'
      and now() >= d.start_at
      and now() < d.end_at
  )
);

drop policy if exists "Authenticated admins can manage audit logs" on public.draw_audit_logs;
create policy "Authenticated admins can manage audit logs"
on public.draw_audit_logs
for all
to authenticated
using (true)
with check (true);

do $$
begin
  alter publication supabase_realtime add table public.draws;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.participants;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
