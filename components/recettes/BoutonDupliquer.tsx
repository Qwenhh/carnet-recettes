'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Recette } from '@/types'
import { Button } from '@/components/ui/button'

export function BoutonDupliquer({ recette }: { recette: Recette }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  async function dupliquer() {
    setLoading(true)

    const { data: nouvelleRecette, error: errRecette } = await supabase
      .from('recettes')
      .insert({
        titre: `${recette.titre} (copie)`,
        descriptif: recette.descriptif,
        photo_url: recette.photo_url,
        declinaisons: recette.declinaisons,
        materiel: recette.materiel,
        conservation: recette.conservation,
        conseils: recette.conseils,
        nb_personnes: recette.nb_personnes,
        temps_preparation: recette.temps_preparation,
        temps_cuisson: recette.temps_cuisson,
        temps_repos: recette.temps_repos,
        types_plat: recette.types_plat,
        saisons: recette.saisons,
        contraintes_alimentaires: recette.contraintes_alimentaires,
        allergenes: recette.allergenes,
        verifiee: false,
        etapes: recette.etapes,
        etapes_sections: recette.etapes_sections,
      })
      .select()
      .single()

    if (errRecette || !nouvelleRecette) {
      toast.error('Erreur lors de la duplication')
      setLoading(false)
      return
    }

    if (recette.ingredients.length > 0) {
      const lignes = recette.ingredients.map((ri, ii) => ({
        recette_id: nouvelleRecette.id,
        ingredient_id: ri.ingredient.id,
        quantite: ri.quantite,
        unite: ri.unite,
        groupe: ri.groupe || null,
        ordre: ii,
      }))
      const { error: errIngr } = await supabase.from('recette_ingredients').insert(lignes)
      if (errIngr) {
        toast.error("Recette dupliquée, mais erreur lors de la copie des ingrédients")
        setLoading(false)
        router.push(`/recettes/${nouvelleRecette.id}/modifier`)
        return
      }
    }

    toast.success('Recette dupliquée !')
    router.push(`/recettes/${nouvelleRecette.id}/modifier`)
  }

  return (
    <Button variant="outline" size="sm" onClick={dupliquer} disabled={loading}>
      <CopyIcon className="size-4" />
      {loading ? 'Duplication…' : 'Dupliquer'}
    </Button>
  )
}
