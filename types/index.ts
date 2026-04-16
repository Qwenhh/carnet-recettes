// ─── Types de base ─────────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  nom: string
  famille: string
  saisons: Saison[]
  allergenes: string[]
}

export interface RecetteIngredient {
  ingredient: Ingredient
  quantite: string
  unite: string
}

export interface Recette {
  id: string
  titre: string
  descriptif: string | null
  nb_personnes: number | null
  temps_preparation: number | null
  temps_cuisson: number | null
  temps_repos: number | null
  types_plat: string[]
  techniques: string[]
  saisons: Saison[]
  contraintes_alimentaires: string[]
  allergenes: string[]
  etapes: string[]
  ingredients: RecetteIngredient[]
  created_at: string
  updated_at: string
}

// ─── Listes de référence ───────────────────────────────────────────────────

export type Saison = 'Printemps' | 'Été' | 'Automne' | 'Hiver'
export const SAISONS: Saison[] = ['Printemps', 'Été', 'Automne', 'Hiver']

export interface ListeReference {
  id: string
  nom: string
  type: TypeListe
}

export type TypeListe =
  | 'allergene'
  | 'technique'
  | 'contrainte_alimentaire'
  | 'type_plat'
  | 'famille_ingredient'

// ─── Filtres ───────────────────────────────────────────────────────────────

export interface FiltresRecettes {
  ingredients: string[]
  familles: string[]
  saisons: Saison[]
  types_plat: string[]
  techniques: string[]
  contraintes_alimentaires: string[]
  allergenes_inclure: string[]
  allergenes_exclure: string[]
  temps_preparation_max: number
  temps_cuisson_max: number
  nb_personnes_tranche: string | null
}

export const FILTRES_DEFAUT: FiltresRecettes = {
  ingredients: [],
  familles: [],
  saisons: [],
  types_plat: [],
  techniques: [],
  contraintes_alimentaires: [],
  allergenes_inclure: [],
  allergenes_exclure: [],
  temps_preparation_max: 240,
  temps_cuisson_max: 240,
  nb_personnes_tranche: null,
}

export const TRANCHES_PERSONNES = [
  { label: '1–2 pers.', min: 1, max: 2 },
  { label: '4–6 pers.', min: 4, max: 6 },
  { label: '8–10 pers.', min: 8, max: 10 },
  { label: '10+ pers.', min: 10, max: 999 },
]
