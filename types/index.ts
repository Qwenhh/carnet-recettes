// ─── Types de base ─────────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  nom: string
  saisons: Saison[]
  allergenes: string[]
}

export interface RecetteIngredient {
  ingredient: Ingredient
  quantite: string
  unite: string
  groupe: string  // '' = section par défaut (pas de titre)
}

export interface EtapeSection {
  nom: string     // '' = section principale (pas de titre affiché)
  etapes: string[]
}

export interface Tip {
  id: string
  titre: string
  contenu: string | null
  created_at: string
  updated_at: string
}

export interface Recette {
  id: string
  titre: string
  descriptif: string | null
  photo_url: string | null
  verifiee: boolean
  declinaisons: string | null
  materiel: string | null       // équipements nécessaires
  conservation: string | null   // durée et mode de conservation
  conseils: string | null       // conseil du chef, concept, objectifs pédagogiques
  nb_personnes: number | null
  temps_preparation: number | null
  temps_cuisson: number | null
  temps_repos: number | null
  types_plat: string[]
  saisons: Saison[]
  contraintes_alimentaires: string[]
  allergenes: string[]
  etapes: string[]                  // tableau plat conservé pour compat
  etapes_sections: EtapeSection[]   // sections de préparation (calculé)
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
  | 'contrainte_alimentaire'
  | 'type_plat'

// ─── Filtres ───────────────────────────────────────────────────────────────

export type FiltreVerification = 'toutes' | 'verifiees' | 'non_verifiees'

export interface FiltresRecettes {
  ingredients: string[]
  saisons: Saison[]
  types_plat: string[]
  contraintes_alimentaires: string[]
  allergenes_inclure: string[]
  allergenes_exclure: string[]
  temps_preparation_max: number
  temps_cuisson_max: number
  nb_personnes_tranche: string | null
  verification: FiltreVerification
}

export const FILTRES_DEFAUT: FiltresRecettes = {
  ingredients: [],
  saisons: [],
  types_plat: [],
  contraintes_alimentaires: [],
  allergenes_inclure: [],
  allergenes_exclure: [],
  temps_preparation_max: 240,
  temps_cuisson_max: 240,
  nb_personnes_tranche: null,
  verification: 'toutes',
}

export const TRANCHES_PERSONNES = [
  { label: '1–2 pers.', min: 1, max: 2 },
  { label: '4–6 pers.', min: 4, max: 6 },
  { label: '8–10 pers.', min: 8, max: 10 },
  { label: '10+ pers.', min: 10, max: 999 },
]
