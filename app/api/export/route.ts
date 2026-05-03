import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Route d'export de toutes les recettes au format JSON réimportable

export async function GET() {
  const { data, error } = await supabase
    .from('recettes')
    .select(`
      titre, descriptif, declinaisons, materiel, conservation, conseils,
      nb_personnes, temps_preparation, temps_cuisson, temps_repos,
      types_plat, techniques, saisons, contraintes_alimentaires,
      etapes, etapes_sections,
      recette_ingredients (
        quantite, unite, groupe, ordre,
        ingredients ( nom, famille )
      )
    `)
    .order('titre', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Reformater au format import
  const recettes = (data ?? []).map((r: any) => {
    // Ingrédients triés par ordre, avec groupe
    const sorted = [...(r.recette_ingredients ?? [])].sort(
      (a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0)
    )
    const ingredients = sorted
      .filter((ri: any) => ri.ingredients)
      .map((ri: any) => ({
        nom: ri.ingredients.nom,
        quantite: ri.quantite || undefined,
        unite: ri.unite || undefined,
        groupe: ri.groupe || undefined,
        famille: ri.ingredients.famille || undefined,
      }))

    // Étapes : priorité à etapes_sections
    const etapes_sections = r.etapes_sections?.length
      ? r.etapes_sections
      : undefined

    const etapes = (!etapes_sections && r.etapes?.length)
      ? r.etapes
      : undefined

    return {
      titre: r.titre,
      ...(r.descriptif && { descriptif: r.descriptif }),
      ...(r.declinaisons && { declinaisons: r.declinaisons }),
      ...(r.materiel && { materiel: r.materiel }),
      ...(r.conservation && { conservation: r.conservation }),
      ...(r.conseils && { conseils: r.conseils }),
      ...(r.nb_personnes && { nb_personnes: r.nb_personnes }),
      ...(r.temps_preparation && { temps_preparation: r.temps_preparation }),
      ...(r.temps_cuisson && { temps_cuisson: r.temps_cuisson }),
      ...(r.temps_repos && { temps_repos: r.temps_repos }),
      ...(r.types_plat?.length && { types_plat: r.types_plat }),
      ...(r.techniques?.length && { techniques: r.techniques }),
      ...(r.saisons?.length && { saisons: r.saisons }),
      ...(r.contraintes_alimentaires?.length && { contraintes_alimentaires: r.contraintes_alimentaires }),
      ...(etapes_sections && { etapes_sections }),
      ...(etapes && { etapes }),
      ...(ingredients.length && { ingredients }),
    }
  })

  const json = JSON.stringify(recettes, null, 2)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="recettes-${date}.json"`,
    },
  })
}
