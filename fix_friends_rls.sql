-- Script pour configurer les politiques RLS de la table friends
-- Exécutez dans l'éditeur SQL de Supabase

-- 1. Activer RLS sur la table friends
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can insert friend requests" ON public.friends;
DROP POLICY IF EXISTS "Users can update their friendships" ON public.friends;
DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friends;

-- 3. Créer les politiques RLS appropriées

-- Politique SELECT : Les utilisateurs peuvent voir leurs propres relations d'amitié
CREATE POLICY "Users can view their friendships"
ON public.friends
FOR SELECT
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Politique INSERT : Les utilisateurs authentifiés peuvent créer des demandes d'ami
CREATE POLICY "Users can insert friend requests"
ON public.friends
FOR INSERT
WITH CHECK (auth.uid() = user_id_1);

-- Politique UPDATE : Les utilisateurs peuvent mettre à jour les friendships où ils sont impliqués
CREATE POLICY "Users can update their friendships"
ON public.friends
FOR UPDATE
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2)
WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Politique DELETE : Les utilisateurs peuvent supprimer leurs amitiés
CREATE POLICY "Users can delete their friendships"
ON public.friends
FOR DELETE
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
