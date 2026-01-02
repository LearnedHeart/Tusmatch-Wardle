-- Script pour activer les nouveaux comptes Google
-- Exécutez ces commandes dans l'éditeur SQL de Supabase

-- 1. Ajouter les colonnes manquantes si nécessaire
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS pseudo TEXT;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS avatar_index INT DEFAULT 1;

-- 2. Créer une fonction qui génère un code ami unique (format: 3 lettres + 3 chiffres)
CREATE OR REPLACE FUNCTION generate_friend_code()
RETURNS TEXT AS $$
DECLARE
    letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Sans I, O pour éviter confusion
    numbers TEXT := '0123456789';
    result TEXT := '';
    i INT;
BEGIN
    -- 3 lettres
    FOR i IN 1..3 LOOP
        result := result || substr(letters, floor(random() * length(letters) + 1)::int, 1);
    END LOOP;
    -- 3 chiffres
    FOR i IN 1..3 LOOP
        result := result || substr(numbers, floor(random() * length(numbers) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Créer ou remplacer le trigger pour auto-créer les stats des nouveaux utilisateurs
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN := TRUE;
    user_pseudo TEXT;
BEGIN
    -- Générer un code ami unique
    WHILE code_exists LOOP
        new_code := generate_friend_code();
        SELECT EXISTS(SELECT 1 FROM public.user_stats WHERE friend_code = new_code) INTO code_exists;
    END LOOP;

    -- Extraire le pseudo de l'utilisateur
    user_pseudo := COALESCE(
        NEW.raw_user_meta_data->>'display_name', 
        NEW.raw_user_meta_data->>'full_name', 
        split_part(NEW.email, '@', 1)
    );

    -- Créer l'entrée user_stats pour le nouvel utilisateur
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
    ) VALUES (
        NEW.id,
        new_code,
        user_pseudo,
        1,
        0, 0, 0, 0, 0, 0, 0
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log l'erreur mais ne bloque pas la création du compte
        RAISE WARNING 'Erreur lors de la création des stats utilisateur: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Supprimer l'ancien trigger s'il existe et en créer un nouveau
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- 5. (Optionnel) Réparer les comptes existants sans stats
INSERT INTO public.user_stats (user_id, friend_code, pseudo, avatar_index, daily_wins, daily_played, daily_current_streak, multiplayer_wins, multiplayer_played, multiplayer_rounds_played, multiplayer_total_score)
SELECT 
    u.id,
    upper(substring(md5(random()::text || u.id::text) from 1 for 3)) || lpad(floor(random() * 1000)::text, 3, '0'),
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    1,
    0, 0, 0, 0, 0, 0, 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- 6. Générer des codes ami pour les comptes qui n'en ont pas
UPDATE public.user_stats 
SET friend_code = upper(substring(md5(random()::text || user_id::text) from 1 for 3)) || lpad(floor(random() * 1000)::text, 3, '0')
WHERE friend_code IS NULL OR friend_code = '';
