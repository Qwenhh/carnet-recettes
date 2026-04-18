'use client'

import * as React from 'react'
import Link from 'next/link'
import { PencilIcon, CheckIcon, XIcon, SearchIcon, ChevronRightIcon, ArrowRightIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Ingredient, Saison } from '@/types'
import { SAISONS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const SAISON_EMOJIS: Record<Saison, string> = {
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
}

interface EditionState {
  id: string
  famille: string
  saisons: Saison[]
}

interface RecetteAssociee {
  id: string
  titre: string
}

export default function PageIngredients() {
  const [ingredients, setIngredients] = React.useState<Ingredient[]>([])
  const [loading, setLoading] = React.useState(true)
  const [recherche, setRecherche] = React.useState('')
  const [edition, setEdition] = React.useState<EditionState | null>(null)
  const [familles, setFamilles] = React.useState<string[]>([])

  // Panneau recettes associées
  const [ingrSelectionne, setIngrSelectionne] = React.useState<Ingredient | null>(null)
  const [recettesAssociees, setRecettesAssociees] = React.useState<RecetteAssociee[]>([])
  const [loadingRecettes, setLoadingRecettes] = React.useState(false)

  React.useEffect(() => {
    charger()
  }, [])

  async function charger() {
    setLoading(true)
    const [{ data: ingrs }, { data: listes }] = await Promise.all([
      supabase.from('ingredients').select('*').order('nom'),
      supabase.from('listes_reference').select('nom').eq('type', 'famille_ingredient').order('nom'),
    ])
    setIngredients((ingrs as Ingredient[]) ?? [])
    setFamilles(listes?.map((l) => l.nom) ?? [])
    setLoading(false)
  }

  async function ouvrirRecettes(ingr: Ingredient) {
    setIngrSelectionne(ingr)
    setRecettesAssociees([])
    setLoadingRecettes(true)

    const { data } = await supabase
      .from('recette_ingredients')
      .select('recettes(id, titre)')
      .eq('ingredient_id', ingr.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recettes = (data ?? []).map((row: any) => row.recettes).filter(Boolean) as RecetteAssociee[]
    recettes.sort((a, b) => a.titre.localeCompare(b.titre))
    setRecettesAssociees(recettes)
    setLoadingRecettes(false)
  }

  const filtres = recherche
    ? ingredients.filter((i) => i.nom.toLowerCase().includes(recherche.toLowerCase()))
    : ingredients

  function commencerEdition(ingr: Ingredient) {
    setEdition({ id: ingr.id, famille: ingr.famille ?? '', saisons: ingr.saisons as Saison[] })
  }

  function annulerEdition() {
    setEdition(null)
  }

  async function sauvegarderEdition() {
    if (!edition) return
    const { error } = await supabase
      .from('ingredients')
      .update({ famille: edition.famille || null, saisons: edition.saisons })
      .eq('id', edition.id)
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }
    toast.success('Ingrédient mis à jour')
    setEdition(null)
    charger()
  }

  function toggleSaisonEdition(s: Saison) {
    if (!edition) return
    const next = edition.saisons.includes(s)
      ? edition.saisons.filter((x) => x !== s)
      : [...edition.saisons, s]
    setEdition({ ...edition, saisons: next })
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Ingrédients</h1>

      {/* Recherche */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un ingrédient…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="pl-9"
        />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {filtres.length} ingrédient{filtres.length !== 1 ? 's' : ''}
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtres.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Aucun ingrédient trouvé.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Famille</th>
                <th className="px-4 py-3 text-left">Saisons</th>
                <th className="px-4 py-3 text-left">Allergènes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtres.map((ingr) => {
                const enEdition = edition?.id === ingr.id
                return (
                  <tr key={ingr.id} className="border-t border-border hover:bg-muted/30">

                    {/* Nom — cliquable pour voir les recettes */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => ouvrirRecettes(ingr)}
                        className="flex items-center gap-1 font-medium hover:text-primary transition-colors group"
                      >
                        {ingr.nom}
                        <ChevronRightIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>

                    {/* Famille */}
                    <td className="px-4 py-3">
                      {enEdition ? (
                        <select
                          value={edition.famille}
                          onChange={(e) => setEdition({ ...edition, famille: e.target.value })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          <option value="">—</option>
                          {familles.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">{ingr.famille || '—'}</span>
                      )}
                    </td>

                    {/* Saisons */}
                    <td className="px-4 py-3">
                      {enEdition ? (
                        <div className="flex flex-wrap gap-1">
                          {SAISONS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSaisonEdition(s)}
                              className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                                edition.saisons.includes(s)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-secondary'
                              }`}
                            >
                              {SAISON_EMOJIS[s]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          {(ingr.saisons as Saison[]).map((s) => (
                            <span key={s} title={s}>{SAISON_EMOJIS[s]}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Allergènes */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ingr.allergenes.slice(0, 2).map((a) => (
                          <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                        ))}
                        {ingr.allergenes.length > 2 && (
                          <Badge variant="outline" className="text-xs">+{ingr.allergenes.length - 2}</Badge>
                        )}
                      </div>
                    </td>

                    {/* Actions édition */}
                    <td className="px-4 py-3">
                      {enEdition ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={sauvegarderEdition}>
                            <CheckIcon className="size-4 text-accent" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={annulerEdition}>
                            <XIcon className="size-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => commencerEdition(ingr)}>
                          <PencilIcon className="size-4 text-muted-foreground" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Panneau recettes associées ── */}
      <Sheet open={!!ingrSelectionne} onOpenChange={(open) => { if (!open) setIngrSelectionne(null) }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{ingrSelectionne?.nom}</SheetTitle>
          </SheetHeader>

          <div className="mt-6">
            {loadingRecettes ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : recettesAssociees.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune recette n&apos;utilise cet ingrédient.
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {recettesAssociees.length} recette{recettesAssociees.length > 1 ? 's' : ''}
                </p>
                <ul className="space-y-2">
                  {recettesAssociees.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/recettes/${r.id}`}
                        onClick={() => setIngrSelectionne(null)}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors"
                      >
                        {r.titre}
                        <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
