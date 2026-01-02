-- Fix for "policy already exists" error
-- We drop the policies if they exist, then recreate them.
-- This ensures the script is idempotent.

do $$
begin
  -- Drop policies if they exist
  if exists (select 1 from pg_policies where tablename = 'user_stats' and policyname = 'Users can view their own stats') then
    drop policy "Users can view their own stats" on public.user_stats;
  end if;
  
  if exists (select 1 from pg_policies where tablename = 'user_stats' and policyname = 'Users can update their own stats') then
    drop policy "Users can update their own stats" on public.user_stats;
  end if;
  
  if exists (select 1 from pg_policies where tablename = 'user_stats' and policyname = 'Users can insert their own stats') then
    drop policy "Users can insert their own stats" on public.user_stats;
  end if;
end $$;

-- Create table if not exists (this part was fine)
create table if not exists public.user_stats (
  user_id uuid references auth.users not null primary key,
  
  -- Daily Word Stats
  daily_played int default 0,
  daily_wins int default 0,
  daily_current_streak int default 0,
  daily_max_streak int default 0,
  daily_distribution jsonb default '[0,0,0,0,0,0]'::jsonb,
  
  -- Multiplayer Stats
  multiplayer_played int default 0,
  multiplayer_wins int default 0,
  multiplayer_rounds_played int default 0,
  multiplayer_total_score int default 0,
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_stats enable row level security;

-- Re-create policies
create policy "Users can view their own stats" on public.user_stats
  for select using (auth.uid() = user_id);

create policy "Users can update their own stats" on public.user_stats
  for update using (auth.uid() = user_id);

create policy "Users can insert their own stats" on public.user_stats
  for insert with check (auth.uid() = user_id);

-- Function to handle new user creation (optional, but good practice)
create or replace function public.handle_new_user_stats() 
returns trigger as $$
begin
  insert into public.user_stats (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create stats row when a user is created
-- Drop trigger first to avoid error if exists
drop trigger if exists on_auth_user_created_stats on auth.users;
create trigger on_auth_user_created_stats
  after insert on auth.users
  for each row execute procedure public.handle_new_user_stats();
