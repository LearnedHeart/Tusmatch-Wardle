-- Script pour configurer les politiques RLS (Row Level Security) de user_stats
-- Exécutez dans l'éditeur SQL de Supabase

-- 1. Activer RLS sur la table user_stats (si pas déjà fait)
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view their own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Public can view all user_stats" ON public.user_stats;
DROP POLICY IF EXISTS "Service role can do anything" ON public.user_stats;

-- 3. Créer les politiques RLS appropriées

-- Politique SELECT : Tout le monde peut lire toutes les stats (pour classements/amis)
CREATE POLICY "Anyone can view all user stats"
ON public.user_stats
FOR SELECT
USING (true);

-- Politique INSERT : Les utilisateurs authentifiés peuvent créer leur propre ligne
CREATE POLICY "Users can insert their own stats"
ON public.user_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Politique UPDATE : Les utilisateurs peuvent mettre à jour leurs propres stats
CREATE POLICY "Users can update their own stats"
ON public.user_stats
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Donner les permissions au service role pour le trigger
GRANT ALL ON public.user_stats TO service_role;

-- 5. Réparer manuellement les comptes sans entrée user_stats
INSERT INTO public.user_stats (
    user_id, 
    friend_code,
    pseudo,
    avatar_index,
    daily_wins,
    daily_played,
    daily_current_streak,
    multiplayer_wins,
    multiplayer_played,
    multiplayer_rounds_played,
    multiplayer_total_score
)
SELECT 
    u.id,
    upper(substring(md5(random()::text || u.id::text) from 1 for 3)) || lpad(floor(random() * 1000)::text, 3, '0'),
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    1,
    0, 0, 0, 0, 0, 0, 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = u.id)
ON CONFLICT (user_id) DO UPDATE SET
    friend_code = COALESCE(EXCLUDED.friend_code, public.user_stats.friend_code),
    pseudo = COALESCE(EXCLUDED.pseudo, public.user_stats.pseudo),
    avatar_index = COALESCE(EXCLUDED.avatar_index, public.user_stats.avatar_index);
