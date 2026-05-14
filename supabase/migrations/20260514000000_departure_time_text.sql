drop view if exists public.public_draws;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'draws'
      and column_name = 'departure_time'
      and data_type = 'timestamp with time zone'
  ) then
    alter table public.draws
      alter column departure_time type text
      using case
        when departure_time is null then null
        else to_char(departure_time at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
      end;
  end if;
end $$;

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

grant select on public.public_draws to anon, authenticated;
