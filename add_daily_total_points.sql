-- Migration : Classement par points réels (daily_total_points)
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter la colonne daily_total_points si elle n'existe pas déjà
ALTER TABLE public.user_stats
ADD COLUMN IF NOT EXISTS daily_total_points INTEGER NOT NULL DEFAULT 0;

-- 2. Migrer les données existantes :
--    Pour chaque victoire déjà enregistrée → on crédite le score maximum possible
--    Score max (mot 5 lettres, trouvé en 1 essai) :
--       - 5 × 10 (tuiles rouges)   = 50
--       - +50 (bonus victoire)     = 50
--       - +5 lignes non utilisées × 30 = 150
--    Total = 250 pts par victoire
UPDATE public.user_stats
SET daily_total_points = daily_wins * 250
WHERE daily_total_points = 0 AND daily_wins > 0;

-- 3. Vérification (optionnel) : voir les données migrées
-- SELECT pseudo, daily_wins, daily_played, daily_total_points
-- FROM public.user_stats
-- ORDER BY daily_total_points DESC
-- LIMIT 20;
