'use client'

import * as React from 'react'
import { PlusIcon, SearchIcon, ArrowUpDownIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Tip } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

const PER_PAGE = 12

type Tri = 'recent' | 'ancien' | 'alpha'

const TRIS: { value: Tri; label: string }[] = [
  { value: 'recent', label: 'Plus récent' },
  { value: 'ancien', label: 'Plus ancien' },
  { value: 'alpha',  label: 'A → Z' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function CardSkeleton() {
  return <div className="h-36 animate-pulse rounded-xl border border-border bg-muted" />
}

export default function PageTips() {
  const [tips, setTips] = React.useState<Tip[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [recherche, setRecherche] = React.useState('')
  const [tri, setTri] = React.useState<Tri>('recent')

  const rechercheDebounced = useDebounce(recherche, 300)

  React.useEffect(() => { setPage(1) }, [rechercheDebounced, tri])
  React.useEffect(() => { charger() }, [rechercheDebounced, tri, page]) // eslint-disable-line react-hooks/exhaustive-deps

  async function charger() {
    setLoading(true)
    let query = supabase.from('tips').select('*', { count: 'exact' })
    if (rechercheDebounced.trim()) query = query.ilike('titre', `%${rechercheDebounced.trim()}%`)
    if (tri === 'recent') query = query.order('created_at', { ascending: false })
    else if (tri === 'ancien') query = query.order('created_at', { ascending: true })
    else query = query.order('titre', { ascending: true })

    const from = (page - 1) * PER_PAGE
    const { data, count, error } = await query.range(from, from + PER_PAGE - 1)
    if (error) toast.error('Erreur lors du chargement des tips')
    setTips((data as Tip[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  const nbPages = Math.ceil(total / PER_PAGE)

  // ── Création ─────────────────────────────────────────────────────────────

  const [creationOuverte, setCreationOuverte] = React.useState(false)
  const [nouveauTitre, setNouveauTitre] = React.useState('')
  const [nouveauContenu, setNouveauContenu] = React.useState('')
  const [creationEnCours, setCreationEnCours] = React.useState(false)

  async function creerTip() {
    if (!nouveauTitre.trim()) { toast.error('Le titre est obligatoire'); return }
    setCreationEnCours(true)
    const { error } = await supabase
      .from('tips')
      .insert({ titre: nouveauTitre.trim(), contenu: nouveauContenu.trim() || null })
    setCreationEnCours(false)
    if (error) { toast.error('Erreur lors de la création'); return }
    toast.success('Tip créé !')
    setNouveauTitre('')
    setNouveauContenu('')
    setCreationOuverte(false)
    charger()
  }

  // ── Détail / édition ─────────────────────────────────────────────────────

  const [tipSelectionne, setTipSelectionne] = React.useState<Tip | null>(null)
  const [modeEdition, setModeEdition] = React.useState(false)
  const [editionTitre, setEditionTitre] = React.useState('')
  const [editionContenu, setEditionContenu] = React.useState('')
  const [sauvegardeEnCours, setSauvegardeEnCours] = React.useState(false)

  function ouvrirTip(tip: Tip) {
    setTipSelectionne(tip)
    setModeEdition(false)
    setEditionTitre(tip.titre)
    setEditionContenu(tip.contenu ?? '')
  }

  function fermerTip() {
    setTipSelectionne(null)
    setModeEdition(false)
  }

  async function sauvegarderEdition() {
    if (!tipSelectionne || !editionTitre.trim()) { toast.error('Le titre est obligatoire'); return }
    setSauvegardeEnCours(true)
    const { error } = await supabase
      .from('tips')
      .update({ titre: editionTitre.trim(), contenu: editionContenu.trim() || null })
      .eq('id', tipSelectionne.id)
    setSauvegardeEnCours(false)
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }
    toast.success('Tip mis à jour')
    fermerTip()
    charger()
  }

  // ── Suppression ──────────────────────────────────────────────────────────

  const [tipASupprimer, setTipASupprimer] = React.useState<Tip | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = React.useState(false)

  async function confirmerSuppression() {
    if (!tipASupprimer) return
    setSuppressionEnCours(true)
    const { error } = await supabase.from('tips').delete().eq('id', tipASupprimer.id)
    setSuppressionEnCours(false)
    if (error) { toast.error('Erreur lors de la suppression'); return }
    toast.success('Tip supprimé')
    setTipASupprimer(null)
    fermerTip()
    charger()
  }

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Tips</h1>
        <Button onClick={() => setCreationOuverte(true)}>
          <PlusIcon className="size-4" />
          Nouveau tip
        </Button>
      </div>

      {/* Recherche + Tri */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un tip…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="relative">
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="h-8 appearance-none rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            {TRIS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <ArrowUpDownIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Grille */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : tips.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <span className="text-5xl">💡</span>
          <p className="text-lg font-medium">Aucun tip trouvé</p>
          <p className="text-sm">Modifiez votre recherche ou ajoutez un nouveau tip.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {tips.map((tip) => (
              <Card
                key={tip.id}
                className="cursor-pointer transition-shadow hover:shadow-md hover:ring-primary/30"
                onClick={() => ouvrirTip(tip)}
              >
                <CardHeader>
                  <CardTitle className="break-words font-semibold leading-snug">{tip.titre}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                    {tip.contenu || 'Aucune description.'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {nbPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3">
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

      {/* ── Dialog création ── */}
      <Dialog open={creationOuverte} onOpenChange={setCreationOuverte}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau tip</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="nouveau-titre">Titre <span className="text-destructive">*</span></Label>
              <Input
                id="nouveau-titre"
                value={nouveauTitre}
                onChange={(e) => setNouveauTitre(e.target.value)}
                placeholder="Ex : Bien émulsionner une vinaigrette"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="nouveau-contenu">Description</Label>
              <Textarea
                id="nouveau-contenu"
                value={nouveauContenu}
                onChange={(e) => setNouveauContenu(e.target.value)}
                placeholder="Détaillez votre astuce…"
                className="mt-1"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={creerTip} disabled={creationEnCours}>
              {creationEnCours ? 'Création…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog détail / édition ── */}
      <Dialog open={!!tipSelectionne} onOpenChange={(open) => { if (!open) fermerTip() }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {tipSelectionne && (
            modeEdition ? (
              <>
                <DialogHeader>
                  <DialogTitle>Modifier le tip</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edition-titre">Titre <span className="text-destructive">*</span></Label>
                    <Input
                      id="edition-titre"
                      value={editionTitre}
                      onChange={(e) => setEditionTitre(e.target.value)}
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="edition-contenu">Description</Label>
                    <Textarea
                      id="edition-contenu"
                      value={editionContenu}
                      onChange={(e) => setEditionContenu(e.target.value)}
                      className="mt-1"
                      rows={6}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModeEdition(false)} disabled={sauvegardeEnCours}>
                    Annuler
                  </Button>
                  <Button onClick={sauvegarderEdition} disabled={sauvegardeEnCours}>
                    {sauvegardeEnCours ? 'Sauvegarde…' : 'Enregistrer'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="break-words">{tipSelectionne.titre}</DialogTitle>
                </DialogHeader>
                <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {tipSelectionne.contenu || 'Aucune description.'}
                </p>
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setTipASupprimer(tipSelectionne)}
                  >
                    <Trash2Icon className="size-4" />
                    Supprimer
                  </Button>
                  <Button onClick={() => setModeEdition(true)}>
                    <PencilIcon className="size-4" />
                    Modifier
                  </Button>
                </DialogFooter>
              </>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmation suppression ── */}
      <AlertDialog open={!!tipASupprimer} onOpenChange={(open) => { if (!open) setTipASupprimer(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer «&nbsp;{tipASupprimer?.titre}&nbsp;» ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suppressionEnCours}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmerSuppression} disabled={suppressionEnCours}>
              {suppressionEnCours ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
