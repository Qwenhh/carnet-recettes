import type { Recette, Ingredient, Saison } from '@/types'

// ─── Types bruts retournés par Supabase ────────────────────────────────────
// Supabase retourne recette_ingredients[].ingredients (noms des tables)
// Notre type Recette attend ingredients[].ingredient (renommé)

interface RawIngredient {
  id: string
  nom: string
  famille: string | null
  saisons: string[]
  allergenes: string[]
}

interface RawRecetteIngredient {
  quantite: string
  unite: string
  ingredients: RawIngredient  // nom de la table Supabase
}

interface RawRecette {
  id: string
  titre: string
  descriptif: string | null
  nb_personnes: number | null
  temps_preparation: number | null
  temps_cuisson: number | null
  temps_repos: number | null
  types_plat: string[]
  techniques: string[]
  saisons: string[]
  contraintes_alimentaires: string[]
  allergenes: string[]
  etapes: string[]
  created_at: string
  updated_at: string
  recette_ingredients: RawRecetteIngredient[]  // nom de la table de liaison
}

// ─── Fonction de mapping ───────────────────────────────────────────────────

export function mapRecette(raw: RawRecette): Recette {
  return {
    ...raw,
    saisons: (raw.saisons ?? []) as Saison[],
    ingredients: (raw.recette_ingredients ?? []).map((ri) => ({
      ingredient: {
        id: ri.ingredients.id,
        nom: ri.ingredients.nom,
        famille: ri.ingredients.famille ?? '',
        saisons: (ri.ingredients.saisons ?? []) as Saison[],
        allergenes: ri.ingredients.allergenes ?? [],
      } satisfies Ingredient,
      quantite: ri.quantite ?? '',
      unite: ri.unite ?? '',
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRecetteAny(raw: any): Recette {
  return mapRecette(raw as RawRecette)
}
