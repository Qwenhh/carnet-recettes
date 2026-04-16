import { supabase } from './supabase'
import type { FiltresRecettes, Recette, Ingredient, ListeReference, TypeListe } from '@/types'

// ─── Recettes ──────────────────────────────────────────────────────────────

export async function getRecettes(filtres: Partial<FiltresRecettes> = {}, page = 1, perPage = 20) {
  let query = supabase
    .from('recettes')
    .select(`
      *,
      recette_ingredients (
        quantite, unite,
        ingredients ( id, nom, famille, saisons, allergenes )
      )
    `, { count: 'exact' })
    .order('titre')

  if (filtres.saisons?.length) {
    query = query.overlaps('saisons', filtres.saisons)
  }
  if (filtres.types_plat?.length) {
    query = query.overlaps('types_plat', filtres.types_plat)
  }
  if (filtres.techniques?.length) {
    query = query.overlaps('techniques', filtres.techniques)
  }
  if (filtres.contraintes_alimentaires?.length) {
    query = query.overlaps('contraintes_alimentaires', filtres.contraintes_alimentaires)
  }
  if (filtres.allergenes_exclure?.length) {
    query = query.not('allergenes', 'ov', `{${filtres.allergenes_exclure.join(',')}}`)
  }
  if (filtres.temps_preparation_max && filtres.temps_preparation_max < 240) {
    query = query.lte('temps_preparation', filtres.temps_preparation_max)
  }
  if (filtres.temps_cuisson_max && filtres.temps_cuisson_max < 240) {
    query = query.lte('temps_cuisson', filtres.temps_cuisson_max)
  }
  if (filtres.nb_personnes_tranche) {
    const [min, max] = filtres.nb_personnes_tranche.split('-').map(Number)
    query = query.gte('nb_personnes', min).lte('nb_personnes', max)
  }

  const from = (page - 1) * perPage
  query = query.range(from, from + perPage - 1)

  return query
}

export async function getRecetteById(id: string) {
  return supabase
    .from('recettes')
    .select(`
      *,
      recette_ingredients (
        quantite, unite,
        ingredients ( id, nom, famille, saisons, allergenes )
      )
    `)
    .eq('id', id)
    .single()
}

export async function createRecette(data: Partial<Recette>) {
  return supabase.from('recettes').insert(data).select().single()
}

export async function updateRecette(id: string, data: Partial<Recette>) {
  return supabase.from('recettes').update(data).eq('id', id).select().single()
}

export async function deleteRecette(id: string) {
  return supabase.from('recettes').delete().eq('id', id)
}

// ─── Ingrédients ───────────────────────────────────────────────────────────

export async function getIngredients() {
  return supabase.from('ingredients').select('*').order('nom')
}

export async function upsertIngredient(data: Partial<Ingredient>) {
  return supabase.from('ingredients').upsert(data, { onConflict: 'nom' }).select().single()
}

// ─── Listes de référence ───────────────────────────────────────────────────

export async function getListe(type: TypeListe) {
  return supabase.from('listes_reference').select('*').eq('type', type).order('nom')
}

export async function addListeItem(nom: string, type: TypeListe) {
  return supabase.from('listes_reference').insert({ nom, type }).select().single()
}

export async function updateListeItem(id: string, nom: string) {
  return supabase.from('listes_reference').update({ nom }).eq('id', id).select().single()
}

export async function deleteListeItem(id: string) {
  return supabase.from('listes_reference').delete().eq('id', id)
}
