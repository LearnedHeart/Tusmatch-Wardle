-- Fix for Game Invites and Policies

-- 1. Ensure game_invites table exists
CREATE TABLE IF NOT EXISTS public.game_invites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    room_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Sender can insert invite" ON public.game_invites;
DROP POLICY IF EXISTS "Receiver can view invites" ON public.game_invites;
DROP POLICY IF EXISTS "Receiver can delete invites" ON public.game_invites;
DROP POLICY IF EXISTS "Sender can delete invites" ON public.game_invites;

-- 4. Create Policies
-- Sender can insert
CREATE POLICY "Sender can insert invite" ON public.game_invites
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Receiver can view their invites
CREATE POLICY "Receiver can view invites" ON public.game_invites
    FOR SELECT USING (auth.uid() = receiver_id);

-- Receiver can delete their invites (when accepting/declining)
CREATE POLICY "Receiver can delete invites" ON public.game_invites
    FOR DELETE USING (auth.uid() = receiver_id);

-- Sender can delete invites (cancel)
CREATE POLICY "Sender can delete invites" ON public.game_invites
    FOR DELETE USING (auth.uid() = sender_id);

-- 5. Enable Realtime for this table
-- Note: This usually needs to be done in the Dashboard (Replication), but we can try via SQL if supported.
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;
-- If the above fails, the user must enable Realtime in the Dashboard for 'game_invites'.
