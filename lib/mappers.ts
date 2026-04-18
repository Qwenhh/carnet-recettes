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

// ─── Normalisation d'une étape ────────────────────────────────────────────
// Claude peut retourner les étapes sous plusieurs formes :
//   - string simple          : "Faire bouillir l'eau"
//   - objet { texte, numero }: { "texte": "...", "numero": 1 }
//   - string JSON stringifié : "{\"texte\":\"...\",\"numero\":1}"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliserEtape(etape: any): string {
  if (typeof etape === 'string') {
    // Tenter de parser si c'est un objet JSON stringifié
    const trimmed = etape.trim()
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === 'object' && 'texte' in parsed) {
          return String(parsed.texte)
        }
      } catch { /* pas du JSON, on garde tel quel */ }
    }
    return etape
  }
  // Objet direct { texte, ... }
  if (typeof etape === 'object' && etape !== null && 'texte' in etape) {
    return String(etape.texte)
  }
  return String(etape ?? '')
}

// ─── Calcul des sections d'étapes ─────────────────────────────────────────

function computeEtapesSections(raw: RawRecette): EtapeSection[] {
  // Priorité : colonne etapes_sections si présente et non vide
  if (raw.etapes_sections && raw.etapes_sections.length > 0) {
    return raw.etapes_sections.map((s) => ({
      nom: s.nom ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      etapes: ((s.etapes ?? []) as any[]).map(normaliserEtape).filter(Boolean),
    }))
  }
  // Sinon, on wrap le tableau plat dans une section sans nom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const etapes = ((raw.etapes ?? []) as any[]).map(normaliserEtape).filter(Boolean)
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
    // Ignorer les lignes avec une référence d'ingrédient cassée
    if (!ri.ingredients) continue

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
