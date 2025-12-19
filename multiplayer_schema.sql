-- Table 1 : Les salles de jeu (Lobby)
create table public.parties (
  id uuid default gen_random_uuid() primary key,
  code text unique not null, -- Le code "ABCD"
  mot_a_trouver text not null, -- Le mot de la manche
  statut text default 'attente', -- 'attente', 'en_cours', 'fini'
  created_at timestamp with time zone default now(),
  fin_round_at timestamp with time zone -- Pour le timer de stress (30s)
);

-- Table 2 : Les joueurs
create table public.joueurs (
  id uuid default gen_random_uuid() primary key,
  pseudo text not null,
  partie_id uuid references public.parties(id) on delete cascade, -- Si on supprime la partie, on supprime les joueurs
  score int default 0,
  victoires int default 0,
  est_host boolean default false, -- Pour savoir qui a le bouton "Lancer"
  a_fini boolean default false, -- Pour savoir si ce joueur a trouvé le mot
  created_at timestamp with time zone default now()
);

-- Table 3 : Les essais (Ce que les autres voient)
-- On ne stocke PAS les lettres ici, juste le résultat (couleurs)
create table public.essais (
  id uuid default gen_random_uuid() primary key,
  partie_id uuid references public.parties(id) on delete cascade,
  joueur_id uuid references public.joueurs(id) on delete cascade,
  numero_ligne int not null, -- 0 à 5
  pattern text not null, -- Ex: "20102" (2=Vert, 1=Jaune, 0=Gris)
  created_at timestamp with time zone default now()
);

-- Activer la sécurité (optionnel pour l'instant, on laisse ouvert pour le dev)
alter table public.parties enable row level security;
alter table public.joueurs enable row level security;
alter table public.essais enable row level security;

-- Créer des politiques "ouvertes" pour éviter les blocages pendant le dev
create policy "Tout le monde peut tout faire sur parties" on public.parties for all using (true);
create policy "Tout le monde peut tout faire sur joueurs" on public.joueurs for all using (true);
create policy "Tout le monde peut tout faire sur essais" on public.essais for all using (true);
