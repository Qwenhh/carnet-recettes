import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { RecetteForm } from '@/components/recettes/RecetteForm'

export default function PageNouvelleRecette() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/" />}>
          <ArrowLeftIcon className="size-4" />
          Retour
        </Button>
        <h1 className="text-2xl font-semibold">Nouvelle recette</h1>
      </div>
      <RecetteForm />
    </div>
  )
}
