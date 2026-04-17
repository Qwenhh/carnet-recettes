import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ClockIcon, UsersIcon, PencilIcon, ArrowLeftIcon } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { mapRecetteAny } from '@/lib/mappers'
import type { Saison } from '@/types'
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
    .select('*, recette_ingredients(quantite, unite, groupe, ordre, ingredients(id, nom, famille, saisons, allergenes))')
    .eq('id', id)
    .single()

  if (error || !data) notFound()
  const recette = mapRecetteAny(data)

  const tempsPrep = formatTemps(recette.temps_preparation, 'Préparation')
  const tempsCuis = formatTemps(recette.temps_cuisson, 'Cuisson')
  const tempsRep = formatTemps(recette.temps_repos, 'Repos')

  // Grouper les ingrédients par section
  type GroupeIngr = { nom: string; items: typeof recette.ingredients }
  const groupesIngredients: GroupeIngr[] = []
  const seenGroupes = new Map<string, GroupeIngr>()
  for (const ri of recette.ingredients) {
    const g = ri.groupe ?? ''
    if (!seenGroupes.has(g)) {
      const grp: GroupeIngr = { nom: g, items: [] }
      groupesIngredients.push(grp)
      seenGroupes.set(g, grp)
    }
    seenGroupes.get(g)!.items.push(ri)
  }

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
        <p className="mb-4 text-base leading-relaxed text-foreground/80">{recette.descriptif}</p>
      )}

      {/* Conseils & concept */}
      {recette.conseils && (
        <div className="mb-4 rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conseils &amp; concept</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{recette.conseils}</p>
        </div>
      )}

      {/* Matériel + Conservation sur une ligne */}
      {(recette.materiel || recette.conservation) && (
        <div className="mb-4 flex flex-wrap gap-4">
          {recette.materiel && (
            <div className="flex-1 rounded-lg border border-border bg-muted/50 px-4 py-3 min-w-[200px]">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matériel</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{recette.materiel}</p>
            </div>
          )}
          {recette.conservation && (
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conservation</p>
              <p className="text-sm leading-relaxed">{recette.conservation}</p>
            </div>
          )}
        </div>
      )}

      {(recette.descriptif || recette.conseils || recette.materiel || recette.conservation) && (
        <Separator className="mb-6" />
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">

        {/* ── Ingrédients ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Ingrédients</h2>
          {recette.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ingrédient renseigné.</p>
          ) : (
            <div className="space-y-4">
              {groupesIngredients.map(({ nom, items }, gi) => (
                <div key={gi}>
                  {nom && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {nom}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {items.map(({ ingredient, quantite, unite }) => (
                      <li key={ingredient.id} className="flex items-baseline gap-2 text-sm">
                        <span className="font-medium text-primary">
                          {quantite} {unite}
                        </span>
                        <span>{ingredient.nom}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Préparation ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Préparation</h2>
          {recette.etapes_sections.every((s) => s.etapes.length === 0) ? (
            <p className="text-sm text-muted-foreground">Aucune étape renseignée.</p>
          ) : (
            <div className="space-y-6">
              {recette.etapes_sections.map((section, si) => (
                <div key={si}>
                  {section.nom && (
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.nom}
                    </p>
                  )}
                  <ol className="space-y-4">
                    {section.etapes.map((etape, ei) => (
                      <li key={ei} className="flex gap-4">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {ei + 1}
                        </span>
                        <p className="text-sm leading-relaxed">{etape}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
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

      {/* Déclinaisons */}
      {recette.declinaisons && (
        <>
          <Separator className="my-6" />
          <section>
            <h2 className="mb-3 text-lg font-semibold">Déclinaisons &amp; alternatives</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {recette.declinaisons}
            </p>
          </section>
        </>
      )}
    </article>
  )
}
