'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, Trash2Icon, GripVerticalIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Recette, Ingredient, Saison } from '@/types'
import { SAISONS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MultiSelect } from '@/components/filtres/MultiSelect'

// ─── Types locaux ──────────────────────────────────────────────────────────

interface LigneIngredient {
  ingredient_id: string
  nom: string
  quantite: string
  unite: string
  allergenes: string[]
  saisons: Saison[]
}

interface FormData {
  titre: string
  descriptif: string
  nb_personnes: string
  temps_preparation: string
  temps_cuisson: string
  temps_repos: string
  types_plat: string[]
  techniques: string[]
  saisons: Saison[]
  contraintes_alimentaires: string[]
  allergenes: string[]
  etapes: string[]
  ingredients: LigneIngredient[]
}

const FORM_VIDE: FormData = {
  titre: '',
  descriptif: '',
  nb_personnes: '',
  temps_preparation: '',
  temps_cuisson: '',
  temps_repos: '',
  types_plat: [],
  techniques: [],
  saisons: [],
  contraintes_alimentaires: [],
  allergenes: [],
  etapes: [''],
  ingredients: [],
}

const SAISON_EMOJIS: Record<Saison, string> = {
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
}

// ─── Sous-composants ───────────────────────────────────────────────────────

function SectionTitre({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold text-foreground">{children}</h2>
  )
}

// ─── Composant principal ───────────────────────────────────────────────────

export function RecetteForm({ recette }: { recette?: Recette }) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)

  // Options des listes de référence
  const [opts, setOpts] = React.useState({
    types_plat: [] as string[],
    techniques: [] as string[],
    contraintes_alimentaires: [] as string[],
    allergenes: [] as string[],
  })

  // Ingrédients connus pour l'autocomplétion
  const [ingredientsConnus, setIngredientsConnus] = React.useState<Ingredient[]>([])
  const [recherche, setRecherche] = React.useState('')
  const [suggestions, setSuggestions] = React.useState<Ingredient[]>([])
  const [indexIngredientActif, setIndexIngredientActif] = React.useState<number | null>(null)

  // Formulaire
  const [form, setForm] = React.useState<FormData>(() => {
    if (!recette) return FORM_VIDE
    return {
      titre: recette.titre,
      descriptif: recette.descriptif ?? '',
      nb_personnes: recette.nb_personnes?.toString() ?? '',
      temps_preparation: recette.temps_preparation?.toString() ?? '',
      temps_cuisson: recette.temps_cuisson?.toString() ?? '',
      temps_repos: recette.temps_repos?.toString() ?? '',
      types_plat: recette.types_plat,
      techniques: recette.techniques,
      saisons: recette.saisons,
      contraintes_alimentaires: recette.contraintes_alimentaires,
      allergenes: recette.allergenes,
      etapes: recette.etapes.length > 0 ? recette.etapes : [''],
      ingredients: recette.ingredients.map((ri) => ({
        ingredient_id: ri.ingredient.id,
        nom: ri.ingredient.nom,
        quantite: ri.quantite,
        unite: ri.unite,
        allergenes: ri.ingredient.allergenes,
        saisons: ri.ingredient.saisons as Saison[],
      })),
    }
  })

  // Charger les données au mount
  React.useEffect(() => {
    async function charger() {
      const [{ data: listes }, { data: ingrs }] = await Promise.all([
        supabase.from('listes_reference').select('nom, type').order('nom'),
        supabase.from('ingredients').select('*').order('nom'),
      ])
      if (listes) {
        const o = { types_plat: [] as string[], techniques: [] as string[], contraintes_alimentaires: [] as string[], allergenes: [] as string[] }
        for (const item of listes) {
          if (item.type === 'type_plat') o.types_plat.push(item.nom)
          else if (item.type === 'technique') o.techniques.push(item.nom)
          else if (item.type === 'contrainte_alimentaire') o.contraintes_alimentaires.push(item.nom)
          else if (item.type === 'allergene') o.allergenes.push(item.nom)
        }
        setOpts(o)
      }
      if (ingrs) setIngredientsConnus(ingrs as Ingredient[])
    }
    charger()
  }, [])

  // Autocomplétion ingrédients
  React.useEffect(() => {
    if (recherche.length < 1) { setSuggestions([]); return }
    setSuggestions(
      ingredientsConnus
        .filter((i) => i.nom.toLowerCase().includes(recherche.toLowerCase()))
        .slice(0, 8)
    )
  }, [recherche, ingredientsConnus])

  // ─── Helpers form ────────────────────────────────────────────────────────

  function set<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function toggleSaison(s: Saison) {
    set('saisons', form.saisons.includes(s) ? form.saisons.filter((x) => x !== s) : [...form.saisons, s])
  }

  // ─── Étapes ──────────────────────────────────────────────────────────────

  function ajouterEtape() { set('etapes', [...form.etapes, '']) }

  function modifierEtape(i: number, val: string) {
    const next = [...form.etapes]
    next[i] = val
    set('etapes', next)
  }

  function supprimerEtape(i: number) {
    if (form.etapes.length === 1) return
    set('etapes', form.etapes.filter((_, idx) => idx !== i))
  }

  // ─── Ingrédients ─────────────────────────────────────────────────────────

  function selectionnerIngredient(ingr: Ingredient) {
    // Vérifier si déjà présent
    if (form.ingredients.some((i) => i.ingredient_id === ingr.id)) {
      toast.info(`${ingr.nom} est déjà dans la liste`)
      setRecherche('')
      setSuggestions([])
      return
    }
    const ligne: LigneIngredient = {
      ingredient_id: ingr.id,
      nom: ingr.nom,
      quantite: '',
      unite: '',
      allergenes: ingr.allergenes,
      saisons: ingr.saisons as Saison[],
    }
    const nextIngredients = [...form.ingredients, ligne]
    set('ingredients', nextIngredients)
    // Déduire allergènes
    const tousAllergenes = Array.from(new Set(nextIngredients.flatMap((i) => i.allergenes)))
    set('allergenes', tousAllergenes)
    // Déduire saisons
    const toutesSaisons = Array.from(new Set(nextIngredients.flatMap((i) => i.saisons))) as Saison[]
    set('saisons', toutesSaisons)
    setRecherche('')
    setSuggestions([])
  }

  async function selectionnerNouvelIngredient() {
    if (!recherche.trim()) return
    // Créer le nouvel ingrédient dans la base
    const { data, error } = await supabase
      .from('ingredients')
      .upsert({ nom: recherche.trim() }, { onConflict: 'nom' })
      .select()
      .single()
    if (error || !data) { toast.error('Erreur création ingrédient'); return }
    const ingr = data as Ingredient
    setIngredientsConnus((prev) => [...prev, ingr])
    selectionnerIngredient(ingr)
  }

  function modifierLigneIngredient(i: number, key: 'quantite' | 'unite', val: string) {
    const next = [...form.ingredients]
    next[i] = { ...next[i], [key]: val }
    set('ingredients', next)
  }

  function supprimerIngredient(i: number) {
    const next = form.ingredients.filter((_, idx) => idx !== i)
    set('ingredients', next)
    const tousAllergenes = Array.from(new Set(next.flatMap((x) => x.allergenes)))
    set('allergenes', tousAllergenes)
    const toutesSaisons = Array.from(new Set(next.flatMap((x) => x.saisons))) as Saison[]
    set('saisons', toutesSaisons)
  }

  // ─── Sauvegarde ──────────────────────────────────────────────────────────

  async function sauvegarder(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titre.trim()) { toast.error('Le titre est obligatoire'); return }
    setSaving(true)

    const payload = {
      titre: form.titre.trim(),
      descriptif: form.descriptif.trim() || null,
      nb_personnes: form.nb_personnes ? parseInt(form.nb_personnes) : null,
      temps_preparation: form.temps_preparation ? parseInt(form.temps_preparation) : null,
      temps_cuisson: form.temps_cuisson ? parseInt(form.temps_cuisson) : null,
      temps_repos: form.temps_repos ? parseInt(form.temps_repos) : null,
      types_plat: form.types_plat,
      techniques: form.techniques,
      saisons: form.saisons,
      contraintes_alimentaires: form.contraintes_alimentaires,
      allergenes: form.allergenes,
      etapes: form.etapes.filter((e) => e.trim()),
    }

    let recetteId: string

    if (recette) {
      // Modification
      const { error } = await supabase.from('recettes').update(payload).eq('id', recette.id)
      if (error) { toast.error('Erreur lors de la sauvegarde'); setSaving(false); return }
      recetteId = recette.id
      // Supprimer les anciens ingrédients
      await supabase.from('recette_ingredients').delete().eq('recette_id', recetteId)
    } else {
      // Création
      const { data, error } = await supabase.from('recettes').insert(payload).select().single()
      if (error || !data) { toast.error('Erreur lors de la création'); setSaving(false); return }
      recetteId = data.id
    }

    // Insérer les ingrédients
    if (form.ingredients.length > 0) {
      const lignes = form.ingredients.map((ing, idx) => ({
        recette_id: recetteId,
        ingredient_id: ing.ingredient_id,
        quantite: ing.quantite,
        unite: ing.unite,
        ordre: idx,
      }))
      const { error } = await supabase.from('recette_ingredients').insert(lignes)
      if (error) toast.error('Erreur sauvegarde ingrédients')
    }

    toast.success(recette ? 'Recette mise à jour !' : 'Recette créée !')
    router.push(`/recettes/${recetteId}`)
    router.refresh()
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={sauvegarder} className="mx-auto max-w-3xl space-y-8">

      {/* Informations générales */}
      <section>
        <SectionTitre>Informations générales</SectionTitre>
        <div className="space-y-4">
          <div>
            <Label htmlFor="titre">Titre <span className="text-destructive">*</span></Label>
            <Input
              id="titre"
              value={form.titre}
              onChange={(e) => set('titre', e.target.value)}
              placeholder="Ex : Tartare de bar, condiment agrumes"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="descriptif">Descriptif</Label>
            <Textarea
              id="descriptif"
              value={form.descriptif}
              onChange={(e) => set('descriptif', e.target.value)}
              placeholder="Description libre de la recette…"
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Temps & couverts */}
      <section>
        <SectionTitre>Temps &amp; couverts</SectionTitre>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { id: 'nb_personnes', label: 'Couverts', placeholder: '4' },
            { id: 'temps_preparation', label: 'Prépa (min)', placeholder: '30' },
            { id: 'temps_cuisson', label: 'Cuisson (min)', placeholder: '20' },
            { id: 'temps_repos', label: 'Repos (min)', placeholder: '0' },
          ].map(({ id, label, placeholder }) => (
            <div key={id}>
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type="number"
                min="0"
                value={form[id as keyof FormData] as string}
                onChange={(e) => set(id as keyof FormData, e.target.value as never)}
                placeholder={placeholder}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Classification */}
      <section>
        <SectionTitre>Classification</SectionTitre>
        <div className="space-y-4">

          {/* Saisons */}
          <div>
            <Label className="mb-2 block">Saisons</Label>
            <div className="flex flex-wrap gap-2">
              {SAISONS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={form.saisons.includes(s) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSaison(s)}
                >
                  {SAISON_EMOJIS[s]} {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block">Types de plat</Label>
              <MultiSelect
                options={opts.types_plat}
                selected={form.types_plat}
                onChange={(v) => set('types_plat', v)}
                placeholder="Sélectionner…"
              />
            </div>
            <div>
              <Label className="mb-1 block">Techniques</Label>
              <MultiSelect
                options={opts.techniques}
                selected={form.techniques}
                onChange={(v) => set('techniques', v)}
                placeholder="Sélectionner…"
              />
            </div>
            <div>
              <Label className="mb-1 block">Contraintes alimentaires</Label>
              <MultiSelect
                options={opts.contraintes_alimentaires}
                selected={form.contraintes_alimentaires}
                onChange={(v) => set('contraintes_alimentaires', v)}
                placeholder="Sélectionner…"
              />
            </div>
            <div>
              <Label className="mb-1 block">Allergènes (déduits des ingrédients)</Label>
              <div className="flex min-h-9 flex-wrap gap-1 rounded-md border border-input bg-muted px-3 py-2">
                {form.allergenes.length === 0
                  ? <span className="text-xs text-muted-foreground">Aucun allergène</span>
                  : form.allergenes.map((a) => (
                    <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Ingrédients */}
      <section>
        <SectionTitre>Ingrédients</SectionTitre>
        <div className="space-y-3">
          {form.ingredients.map((ing, i) => (
            <div key={ing.ingredient_id} className="flex items-center gap-2">
              <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="w-40 truncate text-sm font-medium">{ing.nom}</span>
              <Input
                value={ing.quantite}
                onChange={(e) => modifierLigneIngredient(i, 'quantite', e.target.value)}
                placeholder="Qté"
                className="w-20"
              />
              <Input
                value={ing.unite}
                onChange={(e) => modifierLigneIngredient(i, 'unite', e.target.value)}
                placeholder="Unité"
                className="w-24"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => supprimerIngredient(i)}>
                <Trash2Icon className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ))}

          {/* Ajout d'ingrédient */}
          <div className="relative">
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Ajouter un ingrédient…"
              onFocus={() => setIndexIngredientActif(null)}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                    onClick={() => selectionnerIngredient(s)}
                  >
                    <span>{s.nom}</span>
                    {s.famille && <span className="text-xs text-muted-foreground">{s.famille}</span>}
                  </button>
                ))}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm text-primary hover:bg-secondary"
                  onClick={selectionnerNouvelIngredient}
                >
                  <PlusIcon className="size-3.5" />
                  Créer «&nbsp;{recherche}&nbsp;»
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <Separator />

      {/* Étapes */}
      <section>
        <SectionTitre>Étapes de préparation</SectionTitre>
        <div className="space-y-3">
          {form.etapes.map((etape, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground mt-2">
                {i + 1}
              </span>
              <Textarea
                value={etape}
                onChange={(e) => modifierEtape(i, e.target.value)}
                placeholder={`Étape ${i + 1}…`}
                rows={2}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => supprimerEtape(i)}
                disabled={form.etapes.length === 1}
                className="mt-1"
              >
                <Trash2Icon className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={ajouterEtape}>
            <PlusIcon className="size-4" />
            Ajouter une étape
          </Button>
        </div>
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Sauvegarde…' : recette ? 'Mettre à jour' : 'Créer la recette'}
        </Button>
      </div>
    </form>
  )
}
