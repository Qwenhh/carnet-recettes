import type { Recette, Ingredient, Saison, EtapeSection } from '@/types'

// ─── Types bruts retournés par Supabase ────────────────────────────────────

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
  groupe: string | null
  ordre: number | null
  ingredients: RawIngredient
}

interface RawRecette {
  id: string
  titre: string
  descriptif: string | null
  declinaisons: string | null
  materiel: string | null
  conservation: string | null
  conseils: string | null
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
  etapes_sections: EtapeSection[] | null
  created_at: string
  updated_at: string
  recette_ingredients: RawRecetteIngredient[]
}

// ─── Calcul des sections d'étapes ─────────────────────────────────────────

function computeEtapesSections(raw: RawRecette): EtapeSection[] {
  // Priorité : colonne etapes_sections si présente et non vide
  if (raw.etapes_sections && raw.etapes_sections.length > 0) {
    return raw.etapes_sections
  }
  // Sinon, on wrap le tableau plat dans une section sans nom
  const etapes = raw.etapes ?? []
  if (etapes.length === 0) return [{ nom: '', etapes: [] }]
  return [{ nom: '', etapes }]
}

// ─── Fonction de mapping ───────────────────────────────────────────────────

export function mapRecette(raw: RawRecette): Recette {
  // Trier les ingrédients par ordre d'insertion
  const sorted = [...(raw.recette_ingredients ?? [])].sort(
    (a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)
  )

  // Reconstruire les groupes en préservant l'ordre d'apparition
  const ingredientsMap = new Map<string, { ingredient: Ingredient; quantite: string; unite: string; groupe: string }[]>()
  const groupOrder: string[] = []

  for (const ri of sorted) {
    const g = ri.groupe ?? ''
    if (!ingredientsMap.has(g)) {
      ingredientsMap.set(g, [])
      groupOrder.push(g)
    }
    ingredientsMap.get(g)!.push({
      ingredient: {
        id: ri.ingredients.id,
        nom: ri.ingredients.nom,
        famille: ri.ingredients.famille ?? '',
        saisons: (ri.ingredients.saisons ?? []) as Saison[],
        allergenes: ri.ingredients.allergenes ?? [],
      } satisfies Ingredient,
      quantite: ri.quantite ?? '',
      unite: ri.unite ?? '',
      groupe: g,
    })
  }

  // Aplatir en gardant l'ordre des groupes
  const ingredients = groupOrder.flatMap((g) => ingredientsMap.get(g)!)

  return {
    ...raw,
    saisons: (raw.saisons ?? []) as Saison[],
    declinaisons: raw.declinaisons ?? null,
    materiel: raw.materiel ?? null,
    conservation: raw.conservation ?? null,
    conseils: raw.conseils ?? null,
    etapes: raw.etapes ?? [],
    etapes_sections: computeEtapesSections(raw),
    ingredients,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRecetteAny(raw: any): Recette {
  return mapRecette(raw as RawRecette)
}
