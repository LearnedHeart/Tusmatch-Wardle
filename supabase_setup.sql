-- 1. Création de la table (si tu ne l'as pas fait via l'interface)
-- Mais je te conseille de le faire via l'interface "Table Editor" comme expliqué dans le guide.
-- Nom de la table : solutions
-- Colonnes : id (int8, primary key), mot (text)

-- 2. Fonction RPC pour récupérer le mot du jour
-- Cette version inclut un paramètre "offset_jours" pour tester !
-- Par défaut, offset_jours vaut 0 (aujourd'hui).
-- Si tu mets 1, c'est demain, etc.

create or replace function get_mot_du_jour(offset_jours int default 0)
returns text
language plpgsql
as $$
declare
  -- Date de lancement de ton jeu (change la date si tu veux)
  start_date date := '2025-01-01';
  -- Variable pour stocker le numéro du jour
  day_index integer;
  -- Variable pour le mot trouvé
  le_mot text;
  -- Nombre total de solutions
  total_solutions integer;
begin
  -- On compte combien on a de mots
  select count(*) into total_solutions from solutions;

  -- Calcul : (Date d'aujourd'hui + offset) - Date de début
  day_index := (current_date + offset_jours - start_date);

  -- Sécurité : Si le jeu dure longtemps, on boucle
  -- Le +1 c'est parce que les IDs commencent à 1
  -- On utilise ABS() pour éviter les soucis si on teste des dates passées
  day_index := (abs(day_index) % total_solutions) + 1;

  -- On récupère LE mot qui correspond à l'ID du jour
  select mot into le_mot
  from solutions
  where id = day_index;

  return le_mot;
end;
$$;