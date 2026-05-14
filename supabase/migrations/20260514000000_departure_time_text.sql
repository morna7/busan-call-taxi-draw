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
