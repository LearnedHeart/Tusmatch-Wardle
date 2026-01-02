-- Script pour réparer tous les comptes qui n'ont pas d'entrée user_stats
-- Exécutez dans l'éditeur SQL de Supabase

-- Fonction pour générer un code ami unique
CREATE OR REPLACE FUNCTION generate_unique_friend_code()
RETURNS TEXT AS $$
DECLARE
    letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    numbers TEXT := '0123456789';
    result TEXT := '';
    i INT;
    code_exists BOOLEAN := TRUE;
BEGIN
    WHILE code_exists LOOP
        result := '';
        -- 3 lettres
        FOR i IN 1..3 LOOP
            result := result || substr(letters, floor(random() * length(letters) + 1)::int, 1);
        END LOOP;
        -- 3 chiffres
        FOR i IN 1..3 LOOP
            result := result || substr(numbers, floor(random() * length(numbers) + 1)::int, 1);
        END LOOP;
        
        -- Vérifier si le code existe déjà
        SELECT EXISTS(SELECT 1 FROM public.user_stats WHERE friend_code = result) INTO code_exists;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Créer les entrées manquantes pour tous les utilisateurs
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
    generate_unique_friend_code(),
    COALESCE(
        u.raw_user_meta_data->>'display_name', 
        u.raw_user_meta_data->>'full_name', 
        split_part(u.email, '@', 1)
    ),
    COALESCE((u.raw_user_meta_data->>'custom_avatar_index')::int, 1),
    0, 0, 0, 0, 0, 0, 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- Afficher le résultat
SELECT 
    COUNT(*) as total_users,
    (SELECT COUNT(*) FROM public.user_stats) as users_with_stats
FROM auth.users;
