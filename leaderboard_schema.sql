-- Enable public read access to user_stats for Leaderboards
-- We drop existing policies that might conflict or be too restrictive
drop policy if exists "Users can view their own stats" on public.user_stats;
drop policy if exists "User stats are viewable by everyone" on public.user_stats;

-- Create a policy that allows everyone (even anon if needed, but usually auth) to read stats
-- We need this so users can see the Global Leaderboard
create policy "User stats are viewable by everyone" on public.user_stats
  for select using (true);

-- Ensure update is still restricted to own user
drop policy if exists "Users can update their own stats" on public.user_stats;
create policy "Users can update their own stats" on public.user_stats
  for update using (auth.uid() = user_id);

-- Ensure insert is restricted (usually handled by trigger, but good to have)
drop policy if exists "Users can insert their own stats" on public.user_stats;
create policy "Users can insert their own stats" on public.user_stats
  for insert with check (auth.uid() = user_id);
