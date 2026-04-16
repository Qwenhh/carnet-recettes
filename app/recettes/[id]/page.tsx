import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ClockIcon, UsersIcon, PencilIcon, ArrowLeftIcon } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import type { Recette, Saison } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BoutonSupprimer } from '@/components/recettes/BoutonSupprimer'

const SAISON_EMOJIS: Record<Saison, string> = {
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
}

function formatTemps(min: number | null, label: string) {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  const duree = h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`
  return `${label} : ${duree}`
}

export default async function PageDetail({
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
  const recette = data as Recette

  const tempsPrep = formatTemps(recette.temps_preparation, 'Préparation')
  const tempsCuis = formatTemps(recette.temps_cuisson, 'Cuisson')
  const tempsRep = formatTemps(recette.temps_repos, 'Repos')

  return (
    <article className="mx-auto max-w-3xl">
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" render={<Link href="/" />}>
          <ArrowLeftIcon className="size-4" />
          Retour
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/recettes/${id}/modifier`} />}>
            <PencilIcon className="size-4" />
            Modifier
          </Button>
          <BoutonSupprimer id={id} />
        </div>
      </div>

      {/* Titre + badges */}
      <header className="mb-6">
        <h1 className="mb-3 text-3xl font-semibold leading-tight">{recette.titre}</h1>
        <div className="flex flex-wrap gap-2">
          {recette.types_plat.map((t) => (
            <Badge key={t} variant="default">{t}</Badge>
          ))}
          {recette.saisons.map((s) => (
            <Badge key={s} variant="secondary">
              {SAISON_EMOJIS[s]} {s}
            </Badge>
          ))}
          {recette.contraintes_alimentaires.map((c) => (
            <Badge key={c} variant="outline">{c}</Badge>
          ))}
        </div>
      </header>

      {/* Méta */}
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {recette.nb_personnes && (
          <span className="flex items-center gap-1.5">
            <UsersIcon className="size-4" />
            {recette.nb_personnes} personne{recette.nb_personnes > 1 ? 's' : ''}
          </span>
        )}
        {[tempsPrep, tempsCuis, tempsRep].filter(Boolean).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <ClockIcon className="size-4" />
            {t}
          </span>
        ))}
      </div>

      {/* Descriptif */}
      {recette.descriptif && (
        <>
          <p className="mb-6 text-base leading-relaxed text-foreground/80">{recette.descriptif}</p>
          <Separator className="mb-6" />
        </>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        {/* Ingrédients */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Ingrédients</h2>
          {recette.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ingrédient renseigné.</p>
          ) : (
            <ul className="space-y-2">
              {recette.ingredients.map(({ ingredient, quantite, unite }) => (
                <li key={ingredient.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-primary">
                    {quantite} {unite}
                  </span>
                  <span>{ingredient.nom}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Étapes */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Préparation</h2>
          {recette.etapes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune étape renseignée.</p>
          ) : (
            <ol className="space-y-4">
              {recette.etapes.map((etape, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{etape}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Techniques + Allergènes */}
      {(recette.techniques.length > 0 || recette.allergenes.length > 0) && (
        <>
          <Separator className="my-6" />
          <div className="flex flex-wrap gap-6">
            {recette.techniques.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Techniques</p>
                <div className="flex flex-wrap gap-1">
                  {recette.techniques.map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {recette.allergenes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Allergènes</p>
                <div className="flex flex-wrap gap-1">
                  {recette.allergenes.map((a) => (
                    <Badge key={a} variant="destructive">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  )
}
