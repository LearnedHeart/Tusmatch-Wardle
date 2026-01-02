-- Add friend_code to user_stats
alter table public.user_stats 
add column if not exists friend_code text unique;

-- Function to generate random friend code
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

-- Trigger to assign friend_code on insert if null
create or replace function set_friend_code() returns trigger as $$
begin
  if new.friend_code is null then
    new.friend_code := generate_friend_code();
    -- Ensure uniqueness (simple retry loop logic could be added here but collision prob is low for now)
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_user_stats_insert_code on public.user_stats;
create trigger on_user_stats_insert_code
  before insert on public.user_stats
  for each row execute procedure set_friend_code();

-- Backfill existing users
update public.user_stats set friend_code = generate_friend_code() where friend_code is null;


-- FRIENDS TABLE
create table if not exists public.friends (
  id uuid default gen_random_uuid() primary key,
  user_id_1 uuid references auth.users not null,
  user_id_2 uuid references auth.users not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id_1, user_id_2)
);

alter table public.friends enable row level security;

-- Policies for friends
-- Users can see their own friendships
create policy "Users can view their own friendships" on public.friends
  for select using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- Users can insert friendship request (as user_id_1)
create policy "Users can send friend requests" on public.friends
  for insert with check (auth.uid() = user_id_1);

-- Users can update friendship (accept) if they are involved
create policy "Users can update their friendships" on public.friends
  for update using (auth.uid() = user_id_1 or auth.uid() = user_id_2);


-- GAME INVITES TABLE
create table if not exists public.game_invites (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users not null,
  receiver_id uuid references auth.users not null,
  room_code text not null,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.game_invites enable row level security;

-- Policies for invites
create policy "Users can view their invites" on public.game_invites
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send invites" on public.game_invites
  for insert with check (auth.uid() = sender_id);

create policy "Users can update invites" on public.game_invites
  for update using (auth.uid() = receiver_id);
