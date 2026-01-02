-- Create a table to store user statistics
create table if not exists public.user_stats (
  user_id uuid references auth.users not null primary key,
  
  -- Daily Word Stats
  daily_played int default 0,
  daily_wins int default 0,
  daily_current_streak int default 0,
  daily_max_streak int default 0,
  daily_distribution jsonb default '[0,0,0,0,0,0]'::jsonb, -- Array of 6 integers
  
  -- Multiplayer Stats
  multiplayer_played int default 0, -- Number of full matches played
  multiplayer_wins int default 0,   -- Number of matches won (1st place)
  multiplayer_rounds_played int default 0, -- Total rounds played
  multiplayer_total_score int default 0,   -- Total score accumulated
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_stats enable row level security;

-- Create policies
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
create trigger on_auth_user_created_stats
  after insert on auth.users
  for each row execute procedure public.handle_new_user_stats();
