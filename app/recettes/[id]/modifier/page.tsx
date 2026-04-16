import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { mapRecetteAny } from '@/lib/mappers'
import { Button } from '@/components/ui/button'
import { RecetteForm } from '@/components/recettes/RecetteForm'

export default async function PageModifierRecette({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data, error } = await supabase
    .from('recettes')
    .select('*, recette_ingredients(quantite, unite, ingredients(id, nom, famille, saisons, allergenes))')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href={`/recettes/${id}`} />}>
          <ArrowLeftIcon className="size-4" />
          Retour
        </Button>
        <h1 className="text-2xl font-semibold">Modifier la recette</h1>
      </div>
      <RecetteForm recette={mapRecetteAny(data)} />
    </div>
  )
}
