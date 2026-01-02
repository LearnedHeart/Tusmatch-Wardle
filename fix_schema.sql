-- 1. Ensure user_stats exists for all users (Trigger on Signup)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.user_stats (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid duplication errors during recreation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Backfill user_stats for existing users who don't have it
insert into public.user_stats (user_id)
select id from auth.users
where id not in (select user_id from public.user_stats);

-- 3. Add last_daily_date column to user_stats to track daily plays
alter table public.user_stats 
add column if not exists last_daily_date date;

-- 4. Ensure friend_code logic is present (from previous step, just in case)
alter table public.user_stats 
add column if not exists friend_code text unique;

create or replace function generate_friend_code() returns text as $$
declare
  chars text[] := '{A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z,2,3,4,5,6,7,8,9}';
  result text := '';
  i integer := 0;
begin
  for i in 1..6 loop
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  end loop;
  return result;
end;
$$ language plpgsql;

create or replace function set_friend_code() returns trigger as $$
begin
  if new.friend_code is null then
    new.friend_code := generate_friend_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_user_stats_insert_code on public.user_stats;
create trigger on_user_stats_insert_code
  before insert on public.user_stats
  for each row execute procedure set_friend_code();

-- Backfill friend codes for existing stats that might be null
update public.user_stats set friend_code = generate_friend_code() where friend_code is null;
