'use client'

import * as React from 'react'
import Link from 'next/link'
import { PencilIcon, CheckIcon, XIcon, SearchIcon, ChevronRightIcon, ArrowRightIcon, MergeIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Ingredient, Saison } from '@/types'
import { SAISONS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const SAISON_EMOJIS: Record<Saison, string> = {
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
}

interface EditionState {
  id: string
  nom: string
  saisons: Saison[]
}

interface RecetteAssociee {
  id: string
  titre: string
}

interface FusionEnAttente {
  ancienId: string
  ancienNom: string
  cibleId: string
  cibleNom: string
  saisons: Saison[]
}

type FiltreUtilisation = 'toutes' | 'inutilisees'

export default function PageIngredients() {
  const [ingredients, setIngredients] = React.useState<Ingredient[]>([])
  const [utilisations, setUtilisations] = React.useState<Map<string, number>>(new Map())
  const [filtreUtilisation, setFiltreUtilisation] = React.useState<FiltreUtilisation>('toutes')
  const [loading, setLoading] = React.useState(true)
  const [recherche, setRecherche] = React.useState('')
  const [edition, setEdition] = React.useState<EditionState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [suppressionEnCours, setSuppressionEnCours] = React.useState(false)

  // Panneau recettes associées
  const [ingrSelectionne, setIngrSelectionne] = React.useState<Ingredient | null>(null)
  const [recettesAssociees, setRecettesAssociees] = React.useState<RecetteAssociee[]>([])
  const [loadingRecettes, setLoadingRecettes] = React.useState(false)

  // Fusion en attente de confirmation
  const [fusionEnAttente, setFusionEnAttente] = React.useState<FusionEnAttente | null>(null)

  React.useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    // Supabase plafonne à 1000 lignes par requête : on paginate pour tout récupérer
    const pageSize = 1000

    async function chargerTout<T>(table: string, colonnes: string): Promise<T[]> {
      let all: T[] = []
      let from = 0
      while (true) {
        const { data } = await supabase.from(table).select(colonnes).range(from, from + pageSize - 1)
        if (!data || data.length === 0) break
        all = all.concat(data as T[])
        if (data.length < pageSize) break
        from += pageSize
      }
      return all
    }

    const [ingrs, liaisons] = await Promise.all([
      chargerTout<Ingredient>('ingredients', '*'),
      chargerTout<{ ingredient_id: string }>('recette_ingredients', 'ingredient_id'),
    ])

    const compteur = new Map<string, number>()
    for (const l of liaisons) {
      compteur.set(l.ingredient_id, (compteur.get(l.ingredient_id) ?? 0) + 1)
    }

    setIngredients(ingrs.sort((a, b) => a.nom.localeCompare(b.nom)))
    setUtilisations(compteur)
    setLoading(false)
  }

  async function supprimerIngredient(id: string) {
    setSuppressionEnCours(true)
    const { error } = await supabase.from('ingredients').delete().eq('id', id)
    setSuppressionEnCours(false)
    if (error) { toast.error('Erreur lors de la suppression'); return }
    toast.success('Ingrédient supprimé')
    charger()
  }

  // ── Panneau recettes associées ────────────────────────────────────────────

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

  // ── Édition ───────────────────────────────────────────────────────────────

  function commencerEdition(ingr: Ingredient) {
    setEdition({ id: ingr.id, nom: ingr.nom, saisons: ingr.saisons as Saison[] })
  }

  function annulerEdition() { setEdition(null) }

  function toggleSaisonEdition(s: Saison) {
    if (!edition) return
    const next = edition.saisons.includes(s)
      ? edition.saisons.filter((x) => x !== s)
      : [...edition.saisons, s]
    setEdition({ ...edition, saisons: next })
  }

  async function sauvegarderEdition() {
    if (!edition || !edition.nom.trim()) { toast.error('Le nom est obligatoire'); return }
    setSaving(true)

    const nomNormalise = edition.nom.trim()

    // Si le nom a changé (y compris juste la casse), vérifier s'il existe déjà un autre ingrédient avec ce nom
    const ingrOriginal = ingredients.find((i) => i.id === edition.id)
    if (ingrOriginal && nomNormalise !== ingrOriginal.nom) {
      const doublon = ingredients.find(
        (i) => i.id !== edition.id && i.nom.toLowerCase() === nomNormalise.toLowerCase()
      )
      if (doublon) {
        // Proposer la fusion
        setFusionEnAttente({
          ancienId: edition.id,
          ancienNom: ingrOriginal.nom,
          cibleId: doublon.id,
          cibleNom: doublon.nom,
          saisons: edition.saisons,
        })
        setSaving(false)
        return
      }
    }

    // Pas de doublon : simple mise à jour
    const { error } = await supabase
      .from('ingredients')
      .update({ nom: nomNormalise, saisons: edition.saisons })
      .eq('id', edition.id)

    if (error) { toast.error('Erreur lors de la sauvegarde'); setSaving(false); return }
    toast.success('Ingrédient mis à jour')
    setEdition(null)
    setSaving(false)
    charger()
  }

  // ── Fusion ────────────────────────────────────────────────────────────────

  async function executerFusion() {
    if (!fusionEnAttente) return
    setSaving(true)
    const { ancienId, cibleId, saisons } = fusionEnAttente

    // Fusion exécutée côté base de données en une transaction atomique
    const { error } = await supabase.rpc('fusionner_ingredients', {
      p_ancien_id: ancienId,
      p_cible_id: cibleId,
      p_saisons: saisons,
    })

    if (error) {
      toast.error('Erreur lors de la fusion : ' + error.message)
      setSaving(false)
      return
    }

    toast.success('Ingrédients fusionnés !')
    setFusionEnAttente(null)
    setEdition(null)
    setSaving(false)
    charger()
  }

  // ── Filtrage ──────────────────────────────────────────────────────────────

  const filtres = ingredients
    .filter((i) => !recherche || i.nom.toLowerCase().includes(recherche.toLowerCase()))
    .filter((i) => filtreUtilisation === 'toutes' || (utilisations.get(i.id) ?? 0) === 0)

  const nbInutilisees = ingredients.filter((i) => (utilisations.get(i.id) ?? 0) === 0).length

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Ingrédients</h1>

      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un ingrédient…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filtres.length} ingrédient{filtres.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant={filtreUtilisation === 'toutes' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltreUtilisation('toutes')}
          >
            Tous
          </Button>
          <Button
            variant={filtreUtilisation === 'inutilisees' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltreUtilisation('inutilisees')}
          >
            Non utilisés {nbInutilisees > 0 && `(${nbInutilisees})`}
          </Button>
        </div>
      </div>

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
                <th className="px-4 py-3 text-left">Saisons</th>
                <th className="px-4 py-3 text-left">Allergènes</th>
                <th className="px-4 py-3 text-left">Recettes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtres.map((ingr) => {
                const enEdition = edition?.id === ingr.id
                return (
                  <tr key={ingr.id} className="border-t border-border hover:bg-muted/30">

                    {/* Nom */}
                    <td className="px-4 py-3">
                      {enEdition ? (
                        <Input
                          value={edition.nom}
                          onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                          className="h-8 w-44"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => ouvrirRecettes(ingr)}
                          className="flex items-center gap-1 font-medium hover:text-primary transition-colors group"
                        >
                          {ingr.nom}
                          <ChevronRightIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
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

                    {/* Recettes */}
                    <td className="px-4 py-3">
                      {(() => {
                        const nb = utilisations.get(ingr.id) ?? 0
                        return nb === 0
                          ? <Badge variant="outline" className="text-xs text-muted-foreground">0 recette</Badge>
                          : <span className="text-muted-foreground">{nb}</span>
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {enEdition ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={sauvegarderEdition} disabled={saving}>
                            <CheckIcon className="size-4 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={annulerEdition}>
                            <XIcon className="size-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => commencerEdition(ingr)}>
                            <PencilIcon className="size-4 text-muted-foreground" />
                          </Button>
                          {(utilisations.get(ingr.id) ?? 0) === 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button size="icon" variant="ghost">
                                    <Trash2Icon className="size-4 text-muted-foreground" />
                                  </Button>
                                }
                              />
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer «&nbsp;{ingr.nom}&nbsp;» ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cet ingrédient n&apos;est utilisé dans aucune recette. La suppression est définitive.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={suppressionEnCours}>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => supprimerIngredient(ingr.id)} disabled={suppressionEnCours}>
                                    {suppressionEnCours ? 'Suppression…' : 'Supprimer'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
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
              <p className="text-sm text-muted-foreground">Aucune recette n&apos;utilise cet ingrédient.</p>
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

      {/* ── Confirmation de fusion ── */}
      {fusionEnAttente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-1 flex items-center gap-2">
              <MergeIcon className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Fusionner les ingrédients ?</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">«&nbsp;{fusionEnAttente.cibleNom}&nbsp;»</span> existe déjà.
              Toutes les recettes utilisant <span className="font-medium text-foreground">«&nbsp;{fusionEnAttente.ancienNom}&nbsp;»</span> seront
              rattachées à <span className="font-medium text-foreground">«&nbsp;{fusionEnAttente.cibleNom}&nbsp;»</span>,
              puis l&apos;ancien sera supprimé.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFusionEnAttente(null)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={executerFusion} disabled={saving}>
                <MergeIcon className="size-4" />
                {saving ? 'Fusion…' : 'Fusionner'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
