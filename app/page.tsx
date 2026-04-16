'use client'

import * as React from 'react'
import Link from 'next/link'
import { PlusIcon, SearchIcon } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import type { FiltresRecettes, Recette } from '@/types'
import { FILTRES_DEFAUT } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RecetteCard } from '@/components/recettes/RecetteCard'
import { PanneauFiltres } from '@/components/filtres/PanneauFiltres'

const PER_PAGE = 20

type Options = {
  types_plat: string[]
  techniques: string[]
  contraintes_alimentaires: string[]
  allergenes: string[]
  familles: string[]
}

function CardSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl border border-border bg-muted" />
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function PageListe() {
  const [recettes, setRecettes] = React.useState<Recette[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [recherche, setRecherche] = React.useState('')
  const [filtres, setFiltres] = React.useState<FiltresRecettes>(FILTRES_DEFAUT)
  const [options, setOptions] = React.useState<Options>({
    types_plat: [],
    techniques: [],
    contraintes_alimentaires: [],
    allergenes: [],
    familles: [],
  })

  // Charger les listes de référence une seule fois
  React.useEffect(() => {
    async function chargerOptions() {
      const { data } = await supabase
        .from('listes_reference')
        .select('nom, type')
        .order('nom')
      if (!data) return
      const grouped: Options = { types_plat: [], techniques: [], contraintes_alimentaires: [], allergenes: [], familles: [] }
      for (const item of data) {
        if (item.type === 'type_plat') grouped.types_plat.push(item.nom)
        else if (item.type === 'technique') grouped.techniques.push(item.nom)
        else if (item.type === 'contrainte_alimentaire') grouped.contraintes_alimentaires.push(item.nom)
        else if (item.type === 'allergene') grouped.allergenes.push(item.nom)
        else if (item.type === 'famille_ingredient') grouped.familles.push(item.nom)
      }
      setOptions(grouped)
    }
    chargerOptions()
  }, [])

  const filtresDebounced = useDebounce(filtres, 300)

  React.useEffect(() => { setPage(1) }, [filtresDebounced, recherche])
  React.useEffect(() => { fetchRecettes() }, [filtresDebounced, page]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchRecettes() {
    setLoading(true)
    let query = supabase
      .from('recettes')
      .select('*, recette_ingredients(quantite, unite, ingredients(id, nom, famille, saisons, allergenes))', { count: 'exact' })
      .order('titre')

    if (filtresDebounced.saisons.length) query = query.overlaps('saisons', filtresDebounced.saisons)
    if (filtresDebounced.types_plat.length) query = query.overlaps('types_plat', filtresDebounced.types_plat)
    if (filtresDebounced.techniques.length) query = query.overlaps('techniques', filtresDebounced.techniques)
    if (filtresDebounced.contraintes_alimentaires.length) query = query.overlaps('contraintes_alimentaires', filtresDebounced.contraintes_alimentaires)
    if (filtresDebounced.allergenes_exclure.length) query = query.not('allergenes', 'ov', `{${filtresDebounced.allergenes_exclure.join(',')}}`)
    if (filtresDebounced.temps_preparation_max < 240) query = query.lte('temps_preparation', filtresDebounced.temps_preparation_max)
    if (filtresDebounced.temps_cuisson_max < 240) query = query.lte('temps_cuisson', filtresDebounced.temps_cuisson_max)
    if (filtresDebounced.nb_personnes_tranche) {
      const [min, max] = filtresDebounced.nb_personnes_tranche.split('-').map(Number)
      query = query.gte('nb_personnes', min).lte('nb_personnes', max)
    }

    const from = (page - 1) * PER_PAGE
    const { data, count } = await query.range(from, from + PER_PAGE - 1)
    setRecettes((data as Recette[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  const recettesFiltrees = recherche.trim()
    ? recettes.filter((r) => r.titre.toLowerCase().includes(recherche.toLowerCase()))
    : recettes

  const nbPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Mes recettes</h1>
        <Button render={<Link href="/recettes/nouvelle" />}>
          <PlusIcon className="size-4" />
          Nouvelle recette
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher une recette…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Layout */}
      <div className="flex gap-6">
        <PanneauFiltres
          filtres={filtres}
          onChange={(p) => setFiltres((prev) => ({ ...prev, ...p }))}
          options={options}
          nbResultats={total}
        />

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : recettesFiltrees.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <span className="text-5xl">🍽️</span>
              <p className="text-lg font-medium">Aucune recette trouvée</p>
              <p className="text-sm">Modifiez vos filtres ou ajoutez une nouvelle recette.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recettesFiltrees.map((r) => <RecetteCard key={r.id} recette={r} />)}
              </div>
              {nbPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    Précédent
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page} / {nbPages}</span>
                  <Button variant="outline" size="sm" disabled={page === nbPages} onClick={() => setPage((p) => p + 1)}>
                    Suivant
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
