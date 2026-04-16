'use client'

import * as React from 'react'
import { SlidersHorizontalIcon, RotateCcwIcon } from 'lucide-react'

import type { FiltresRecettes, Saison } from '@/types'
import { FILTRES_DEFAUT, SAISONS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { MultiSelect } from '@/components/filtres/MultiSelect'

interface Props {
  filtres: FiltresRecettes
  onChange: (f: Partial<FiltresRecettes>) => void
  options: {
    types_plat: string[]
    techniques: string[]
    contraintes_alimentaires: string[]
    allergenes: string[]
    familles: string[]
  }
  nbResultats: number
}

const SAISON_EMOJIS: Record<Saison, string> = {
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
}

const TRANCHES_PERSONNES = [
  { label: '1–2 pers.', value: '1-2' },
  { label: '4–6 pers.', value: '4-6' },
  { label: '8–10 pers.', value: '8-10' },
  { label: '10+ pers.', value: '10-999' },
]

function compterFiltresActifs(filtres: FiltresRecettes): number {
  let n = 0
  if (filtres.saisons.length) n++
  if (filtres.types_plat.length) n++
  if (filtres.techniques.length) n++
  if (filtres.contraintes_alimentaires.length) n++
  if (filtres.allergenes_exclure.length) n++
  if (filtres.temps_preparation_max < 240) n++
  if (filtres.temps_cuisson_max < 240) n++
  if (filtres.nb_personnes_tranche) n++
  return n
}

function ContenuFiltres({ filtres, onChange, options, nbResultats }: Props) {
  const nbActifs = compterFiltresActifs(filtres)

  function toggleSaison(saison: Saison) {
    const next = filtres.saisons.includes(saison)
      ? filtres.saisons.filter((s) => s !== saison)
      : [...filtres.saisons, saison]
    onChange({ saisons: next })
  }

  function toggleTranche(value: string) {
    onChange({ nb_personnes_tranche: filtres.nb_personnes_tranche === value ? null : value })
  }

  function reinitialiser() {
    onChange(FILTRES_DEFAUT)
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-heading text-base font-semibold">Filtres</span>
          {nbActifs > 0 && (
            <Badge variant="default" className="text-xs">
              {nbActifs}
            </Badge>
          )}
        </div>
        {nbActifs > 0 && (
          <Button variant="ghost" size="sm" onClick={reinitialiser} className="h-7 gap-1 text-muted-foreground">
            <RotateCcwIcon />
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Saisons */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Saison</p>
        <div className="flex flex-wrap gap-2">
          {SAISONS.map((saison) => {
            const active = filtres.saisons.includes(saison)
            return (
              <Button
                key={saison}
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleSaison(saison)}
                className="gap-1"
              >
                {SAISON_EMOJIS[saison]} {saison}
              </Button>
            )
          })}
        </div>
      </section>

      {/* Type de plat */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Type de plat</p>
        <MultiSelect
          options={options.types_plat}
          selected={filtres.types_plat}
          onChange={(v) => onChange({ types_plat: v })}
          placeholder="Tous les types"
        />
      </section>

      {/* Techniques */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Techniques</p>
        <MultiSelect
          options={options.techniques}
          selected={filtres.techniques}
          onChange={(v) => onChange({ techniques: v })}
          placeholder="Toutes les techniques"
        />
      </section>

      {/* Contraintes alimentaires */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Contraintes alimentaires</p>
        <MultiSelect
          options={options.contraintes_alimentaires}
          selected={filtres.contraintes_alimentaires}
          onChange={(v) => onChange({ contraintes_alimentaires: v })}
          placeholder="Aucune contrainte"
        />
      </section>

      {/* Allergènes à exclure */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Exclure les allergènes</p>
        <MultiSelect
          options={options.allergenes}
          selected={filtres.allergenes_exclure}
          onChange={(v) => onChange({ allergenes_exclure: v })}
          placeholder="Aucun allergène exclu"
        />
      </section>

      {/* Temps de préparation */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Préparation</p>
          <span className="text-sm font-medium">
            {filtres.temps_preparation_max < 240 ? `≤ ${filtres.temps_preparation_max} min` : 'Sans limite'}
          </span>
        </div>
        <Slider
          min={0}
          max={240}
          step={5}
          value={filtres.temps_preparation_max}
          onValueChange={(v) => onChange({ temps_preparation_max: v as number })}
        />
      </section>

      {/* Temps de cuisson */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cuisson</p>
          <span className="text-sm font-medium">
            {filtres.temps_cuisson_max < 240 ? `≤ ${filtres.temps_cuisson_max} min` : 'Sans limite'}
          </span>
        </div>
        <Slider
          min={0}
          max={240}
          step={5}
          value={filtres.temps_cuisson_max}
          onValueChange={(v) => onChange({ temps_cuisson_max: v as number })}
        />
      </section>

      {/* Nombre de personnes */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Nombre de personnes</p>
        <div className="flex flex-wrap gap-2">
          {TRANCHES_PERSONNES.map(({ label, value }) => {
            const active = filtres.nb_personnes_tranche === value
            return (
              <Button
                key={value}
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTranche(value)}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </section>

      {/* Résultats */}
      <p className="mt-auto pt-2 text-center text-sm text-muted-foreground">
        {nbResultats} recette{nbResultats !== 1 ? 's' : ''} trouvée{nbResultats !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export function PanneauFiltres(props: Props) {
  const nbActifs = compterFiltresActifs(props.filtres)

  return (
    <>
      {/* Desktop : colonne sticky */}
      <aside className="hidden w-72 shrink-0 md:block">
        <div className="sticky top-4 rounded-xl border border-border bg-card">
          <ContenuFiltres {...props} />
        </div>
      </aside>

      {/* Mobile : Sheet via bouton flottant */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button className="gap-2 shadow-lg" />
            }
          >
            <SlidersHorizontalIcon />
            Filtres
            {nbActifs > 0 && (
              <Badge variant="secondary" className="ml-1">
                {nbActifs}
              </Badge>
            )}
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Filtres</SheetTitle>
            </SheetHeader>
            <ContenuFiltres {...props} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
