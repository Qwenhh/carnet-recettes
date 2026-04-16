-- ============================================================
-- Schéma Supabase — Carnet de Recettes
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Table : listes_reference ──────────────────────────────────────────────
-- Stocke toutes les listes paramétrables (allergènes, techniques, etc.)
create table public.listes_reference (
  id        uuid primary key default uuid_generate_v4(),
  nom       text not null,
  type      text not null check (type in (
              'allergene',
              'technique',
              'contrainte_alimentaire',
              'type_plat',
              'famille_ingredient'
            )),
  created_at timestamptz default now(),
  unique (nom, type)
);

-- ─── Table : ingredients ───────────────────────────────────────────────────
create table public.ingredients (
  id        uuid primary key default uuid_generate_v4(),
  nom       text not null unique,
  famille   text,
  saisons   text[] default '{}',
  allergenes text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Table : recettes ──────────────────────────────────────────────────────
create table public.recettes (
  id                      uuid primary key default uuid_generate_v4(),
  titre                   text not null,
  descriptif              text,
  nb_personnes            integer,
  temps_preparation       integer,  -- en minutes
  temps_cuisson           integer,  -- en minutes
  temps_repos             integer,  -- en minutes
  types_plat              text[] default '{}',
  techniques              text[] default '{}',
  saisons                 text[] default '{}',
  contraintes_alimentaires text[] default '{}',
  allergenes              text[] default '{}',
  etapes                  text[] default '{}',
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── Table : recette_ingredients ──────────────────────────────────────────
create table public.recette_ingredients (
  id            uuid primary key default uuid_generate_v4(),
  recette_id    uuid not null references public.recettes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantite      text,
  unite         text,
  ordre         integer default 0,
  unique (recette_id, ingredient_id)
);

-- ─── Index ─────────────────────────────────────────────────────────────────
create index on public.recettes using gin(types_plat);
create index on public.recettes using gin(techniques);
create index on public.recettes using gin(saisons);
create index on public.recettes using gin(contraintes_alimentaires);
create index on public.recettes using gin(allergenes);
create index on public.recette_ingredients(recette_id);
create index on public.recette_ingredients(ingredient_id);
create index on public.ingredients(nom);

-- ─── Trigger : updated_at automatique ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recettes_updated_at
  before update on public.recettes
  for each row execute function public.set_updated_at();

create trigger ingredients_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

-- ─── Données initiales : 14 allergènes réglementaires européens ────────────
insert into public.listes_reference (nom, type) values
  ('Gluten',                  'allergene'),
  ('Crustacés',               'allergene'),
  ('Œufs',                    'allergene'),
  ('Poissons',                'allergene'),
  ('Arachides',               'allergene'),
  ('Soja',                    'allergene'),
  ('Lait',                    'allergene'),
  ('Fruits à coque',          'allergene'),
  ('Céleri',                  'allergene'),
  ('Moutarde',                'allergene'),
  ('Graines de sésame',       'allergene'),
  ('Anhydride sulfureux et sulfites', 'allergene'),
  ('Lupin',                   'allergene'),
  ('Mollusques',              'allergene');

-- ─── Données initiales : types de plat ────────────────────────────────────
insert into public.listes_reference (nom, type) values
  ('Entrée',         'type_plat'),
  ('Plat',           'type_plat'),
  ('Dessert',        'type_plat'),
  ('Sauce',          'type_plat'),
  ('Base',           'type_plat'),
  ('Amuse-bouche',   'type_plat'),
  ('Accompagnement', 'type_plat');

-- ─── Données initiales : techniques ───────────────────────────────────────
insert into public.listes_reference (nom, type) values
  ('Snacké',             'technique'),
  ('Braisé',             'technique'),
  ('Basse température',  'technique'),
  ('Vapeur',             'technique'),
  ('Cru',                'technique'),
  ('Poché',              'technique'),
  ('Rôti',               'technique'),
  ('Grillé',             'technique'),
  ('Frit',               'technique'),
  ('Émulsionné',         'technique'),
  ('Fermenté',           'technique'),
  ('Fumé',               'technique');

-- ─── Données initiales : contraintes alimentaires ─────────────────────────
insert into public.listes_reference (nom, type) values
  ('Sans gluten',    'contrainte_alimentaire'),
  ('Sans lactose',   'contrainte_alimentaire'),
  ('Végétarien',     'contrainte_alimentaire'),
  ('Vegan',          'contrainte_alimentaire'),
  ('Sans porc',      'contrainte_alimentaire'),
  ('Sans fruits de mer', 'contrainte_alimentaire');

-- ─── Données initiales : familles d'ingrédients ───────────────────────────
insert into public.listes_reference (nom, type) values
  ('Légume',          'famille_ingredient'),
  ('Viande',          'famille_ingredient'),
  ('Poisson',         'famille_ingredient'),
  ('Fruit de mer',    'famille_ingredient'),
  ('Épice',           'famille_ingredient'),
  ('Herbe aromatique','famille_ingredient'),
  ('Produit laitier', 'famille_ingredient'),
  ('Féculent',        'famille_ingredient'),
  ('Légumineuse',     'famille_ingredient'),
  ('Fruit',           'famille_ingredient'),
  ('Champignon',      'famille_ingredient'),
  ('Condiment',       'famille_ingredient'),
  ('Matière grasse',  'famille_ingredient'),
  ('Autre',           'famille_ingredient');

-- ─── RLS (Row Level Security) ──────────────────────────────────────────────
-- App sans authentification = accès public en lecture/écriture
alter table public.recettes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recette_ingredients enable row level security;
alter table public.listes_reference enable row level security;

create policy "Accès public total" on public.recettes for all using (true) with check (true);
create policy "Accès public total" on public.ingredients for all using (true) with check (true);
create policy "Accès public total" on public.recette_ingredients for all using (true) with check (true);
create policy "Accès public total" on public.listes_reference for all using (true) with check (true);
