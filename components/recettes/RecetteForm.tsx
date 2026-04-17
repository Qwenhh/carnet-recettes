'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, Trash2Icon, GripVerticalIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { Recette, Ingredient, Saison, EtapeSection } from '@/types'
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

interface SectionIngredient {
  nom: string
  ingredients: LigneIngredient[]
}

interface FormData {
  titre: string
  descriptif: string
  declinaisons: string
  materiel: string
  conservation: string
  conseils: string
  nb_personnes: string
  temps_preparation: string
  temps_cuisson: string
  temps_repos: string
  types_plat: string[]
  techniques: string[]
  saisons: Saison[]
  contraintes_alimentaires: string[]
  allergenes: string[]
  sections: SectionIngredient[]
  etapes_sections: EtapeSection[]
}

const FORM_VIDE: FormData = {
  titre: '',
  descriptif: '',
  declinaisons: '',
  materiel: '',
  conservation: '',
  conseils: '',
  nb_personnes: '',
  temps_preparation: '',
  temps_cuisson: '',
  temps_repos: '',
  types_plat: [],
  techniques: [],
  saisons: [],
  contraintes_alimentaires: [],
  allergenes: [],
  sections: [{ nom: '', ingredients: [] }],
  etapes_sections: [{ nom: '', etapes: [''] }],
}

const SAISON_EMOJIS: Record<Saison, string> = {
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function tousIngredients(sections: SectionIngredient[]): LigneIngredient[] {
  return sections.flatMap((s) => s.ingredients)
}

function recetteToSections(recette: Recette): SectionIngredient[] {
  const sections: SectionIngredient[] = []
  const seen = new Map<string, SectionIngredient>()

  for (const ri of recette.ingredients) {
    const g = ri.groupe ?? ''
    if (!seen.has(g)) {
      const s: SectionIngredient = { nom: g, ingredients: [] }
      sections.push(s)
      seen.set(g, s)
    }
    seen.get(g)!.ingredients.push({
      ingredient_id: ri.ingredient.id,
      nom: ri.ingredient.nom,
      quantite: ri.quantite,
      unite: ri.unite,
      allergenes: ri.ingredient.allergenes,
      saisons: ri.ingredient.saisons as Saison[],
    })
  }

  return sections.length > 0 ? sections : [{ nom: '', ingredients: [] }]
}

// ─── Sous-composants ───────────────────────────────────────────────────────

function SectionTitre({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold text-foreground">{children}</h2>
  )
}

function SectionDivider({ nom, onRename, onDelete, showDelete }: {
  nom: string
  onRename: (val: string) => void
  onDelete: () => void
  showDelete: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-1">
        <Input
          value={nom}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Nom de la section…"
          className="h-7 w-44 text-xs font-semibold"
        />
        {showDelete && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2Icon className="size-3" />
          </Button>
        )}
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────────

export function RecetteForm({ recette }: { recette?: Recette }) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)

  const [opts, setOpts] = React.useState({
    types_plat: [] as string[],
    techniques: [] as string[],
    contraintes_alimentaires: [] as string[],
    allergenes: [] as string[],
  })

  const [ingredientsConnus, setIngredientsConnus] = React.useState<Ingredient[]>([])
  const [recherche, setRecherche] = React.useState('')
  const [suggestions, setSuggestions] = React.useState<Ingredient[]>([])
  const [sectionActive, setSectionActive] = React.useState<number>(0)

  const [form, setForm] = React.useState<FormData>(() => {
    if (!recette) return FORM_VIDE
    return {
      titre: recette.titre,
      descriptif: recette.descriptif ?? '',
      declinaisons: recette.declinaisons ?? '',
      materiel: recette.materiel ?? '',
      conservation: recette.conservation ?? '',
      conseils: recette.conseils ?? '',
      nb_personnes: recette.nb_personnes?.toString() ?? '',
      temps_preparation: recette.temps_preparation?.toString() ?? '',
      temps_cuisson: recette.temps_cuisson?.toString() ?? '',
      temps_repos: recette.temps_repos?.toString() ?? '',
      types_plat: recette.types_plat,
      techniques: recette.techniques,
      saisons: recette.saisons,
      contraintes_alimentaires: recette.contraintes_alimentaires,
      allergenes: recette.allergenes,
      sections: recetteToSections(recette),
      etapes_sections: recette.etapes_sections.length > 0
        ? recette.etapes_sections.map((s) => ({
            nom: s.nom,
            etapes: s.etapes.length > 0 ? s.etapes : [''],
          }))
        : [{ nom: '', etapes: [''] }],
    }
  })

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

  // ─── Sections d'ingrédients ───────────────────────────────────────────────

  function ajouterSection() {
    set('sections', [...form.sections, { nom: '', ingredients: [] }])
    setSectionActive(form.sections.length)
    setRecherche('')
    setSuggestions([])
  }

  function renommerSection(si: number, nom: string) {
    const next = form.sections.map((s, i) => i === si ? { ...s, nom } : s)
    set('sections', next)
  }

  function supprimerSection(si: number) {
    const next = form.sections.filter((_, i) => i !== si)
    set('sections', next)
    const all = tousIngredients(next)
    set('allergenes', Array.from(new Set(all.flatMap((i) => i.allergenes))))
    set('saisons', Array.from(new Set(all.flatMap((i) => i.saisons))) as Saison[])
    if (sectionActive >= next.length) setSectionActive(Math.max(0, next.length - 1))
  }

  function selectionnerIngredient(ingr: Ingredient) {
    if (tousIngredients(form.sections).some((i) => i.ingredient_id === ingr.id)) {
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
    const nextSections = form.sections.map((s, i) =>
      i === sectionActive ? { ...s, ingredients: [...s.ingredients, ligne] } : s
    )
    set('sections', nextSections)
    const all = tousIngredients(nextSections)
    set('allergenes', Array.from(new Set(all.flatMap((i) => i.allergenes))))
    set('saisons', Array.from(new Set(all.flatMap((i) => i.saisons))) as Saison[])
    setRecherche('')
    setSuggestions([])
  }

  async function selectionnerNouvelIngredient() {
    if (!recherche.trim()) return
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

  function modifierLigneIngredient(si: number, ii: number, key: 'quantite' | 'unite', val: string) {
    const next = form.sections.map((s, i) => {
      if (i !== si) return s
      const ingrs = [...s.ingredients]
      ingrs[ii] = { ...ingrs[ii], [key]: val }
      return { ...s, ingredients: ingrs }
    })
    set('sections', next)
  }

  function supprimerIngredient(si: number, ii: number) {
    const next = form.sections.map((s, i) => {
      if (i !== si) return s
      return { ...s, ingredients: s.ingredients.filter((_, j) => j !== ii) }
    })
    set('sections', next)
    const all = tousIngredients(next)
    set('allergenes', Array.from(new Set(all.flatMap((i) => i.allergenes))))
    set('saisons', Array.from(new Set(all.flatMap((i) => i.saisons))) as Saison[])
  }

  // ─── Sections d'étapes ────────────────────────────────────────────────────

  function ajouterEtapeSection() {
    set('etapes_sections', [...form.etapes_sections, { nom: '', etapes: [''] }])
  }

  function renommerEtapeSection(si: number, nom: string) {
    set('etapes_sections', form.etapes_sections.map((s, i) => i === si ? { ...s, nom } : s))
  }

  function supprimerEtapeSection(si: number) {
    if (form.etapes_sections.length === 1) return
    set('etapes_sections', form.etapes_sections.filter((_, i) => i !== si))
  }

  function ajouterEtape(si: number) {
    set('etapes_sections', form.etapes_sections.map((s, i) =>
      i === si ? { ...s, etapes: [...s.etapes, ''] } : s
    ))
  }

  function modifierEtape(si: number, ei: number, val: string) {
    set('etapes_sections', form.etapes_sections.map((s, i) => {
      if (i !== si) return s
      const etapes = [...s.etapes]
      etapes[ei] = val
      return { ...s, etapes }
    }))
  }

  function supprimerEtape(si: number, ei: number) {
    const s = form.etapes_sections[si]
    if (s.etapes.length === 1 && form.etapes_sections.length === 1) return
    if (s.etapes.length === 1) {
      supprimerEtapeSection(si)
      return
    }
    set('etapes_sections', form.etapes_sections.map((sec, i) =>
      i === si ? { ...sec, etapes: sec.etapes.filter((_, j) => j !== ei) } : sec
    ))
  }

  // ─── Sauvegarde ──────────────────────────────────────────────────────────

  async function sauvegarder(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titre.trim()) { toast.error('Le titre est obligatoire'); return }
    setSaving(true)

    // Nettoyer les sections d'étapes (supprimer étapes vides)
    const etapes_sections_clean = form.etapes_sections
      .map((s) => ({ nom: s.nom, etapes: s.etapes.filter((e) => e.trim()) }))
      .filter((s) => s.etapes.length > 0 || s.nom.trim())
    const etapes_flat = etapes_sections_clean.flatMap((s) => s.etapes)

    const payload = {
      titre: form.titre.trim(),
      descriptif: form.descriptif.trim() || null,
      declinaisons: form.declinaisons.trim() || null,
      materiel: form.materiel.trim() || null,
      conservation: form.conservation.trim() || null,
      conseils: form.conseils.trim() || null,
      nb_personnes: form.nb_personnes ? parseInt(form.nb_personnes) : null,
      temps_preparation: form.temps_preparation ? parseInt(form.temps_preparation) : null,
      temps_cuisson: form.temps_cuisson ? parseInt(form.temps_cuisson) : null,
      temps_repos: form.temps_repos ? parseInt(form.temps_repos) : null,
      types_plat: form.types_plat,
      techniques: form.techniques,
      saisons: form.saisons,
      contraintes_alimentaires: form.contraintes_alimentaires,
      allergenes: form.allergenes,
      etapes: etapes_flat,
      etapes_sections: etapes_sections_clean,
    }

    let recetteId: string

    if (recette) {
      const { error } = await supabase.from('recettes').update(payload).eq('id', recette.id)
      if (error) { toast.error('Erreur lors de la sauvegarde'); setSaving(false); return }
      recetteId = recette.id
      await supabase.from('recette_ingredients').delete().eq('recette_id', recetteId)
    } else {
      const { data, error } = await supabase.from('recettes').insert(payload).select().single()
      if (error || !data) { toast.error('Erreur lors de la création'); setSaving(false); return }
      recetteId = data.id
    }

    // Insérer les ingrédients avec groupe et ordre
    const allIngrs = tousIngredients(form.sections)
    if (allIngrs.length > 0) {
      const lignes = form.sections.flatMap((section, si) =>
        section.ingredients.map((ing, ii) => ({
          recette_id: recetteId,
          ingredient_id: ing.ingredient_id,
          quantite: ing.quantite,
          unite: ing.unite,
          groupe: section.nom.trim() || null,
          ordre: si * 1000 + ii,
        }))
      )
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
        <div className="space-y-6">
          {form.sections.map((section, si) => (
            <div key={si} className="space-y-3">
              {/* En-tête de section (affiché dès qu'il y en a plusieurs) */}
              {form.sections.length > 1 && (
                <SectionDivider
                  nom={section.nom}
                  onRename={(v) => renommerSection(si, v)}
                  onDelete={() => supprimerSection(si)}
                  showDelete={form.sections.length > 1}
                />
              )}

              {/* Lignes d'ingrédients */}
              {section.ingredients.map((ing, ii) => (
                <div key={ing.ingredient_id} className="flex items-center gap-2">
                  <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="w-40 truncate text-sm font-medium">{ing.nom}</span>
                  <Input
                    value={ing.quantite}
                    onChange={(e) => modifierLigneIngredient(si, ii, 'quantite', e.target.value)}
                    placeholder="Qté"
                    className="w-20"
                  />
                  <Input
                    value={ing.unite}
                    onChange={(e) => modifierLigneIngredient(si, ii, 'unite', e.target.value)}
                    placeholder="Unité"
                    className="w-24"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => supprimerIngredient(si, ii)}>
                    <Trash2Icon className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}

              {/* Recherche pour cette section */}
              {sectionActive === si ? (
                <div className="relative">
                  <Input
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Ajouter un ingrédient…"
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
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => { setSectionActive(si); setRecherche(''); setSuggestions([]) }}
                >
                  <PlusIcon className="size-3.5" />
                  Ajouter un ingrédient
                </Button>
              )}
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={ajouterSection}>
            <PlusIcon className="size-4" />
            Ajouter une section d'ingrédients
          </Button>
        </div>
      </section>

      <Separator />

      {/* Étapes */}
      <section>
        <SectionTitre>Préparation</SectionTitre>
        <div className="space-y-8">
          {form.etapes_sections.map((section, si) => (
            <div key={si} className="space-y-3">
              {/* En-tête de section (affiché dès qu'il y en a plusieurs) */}
              {form.etapes_sections.length > 1 && (
                <SectionDivider
                  nom={section.nom}
                  onRename={(v) => renommerEtapeSection(si, v)}
                  onDelete={() => supprimerEtapeSection(si)}
                  showDelete={form.etapes_sections.length > 1}
                />
              )}

              {section.etapes.map((etape, ei) => (
                <div key={ei} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground mt-2">
                    {ei + 1}
                  </span>
                  <Textarea
                    value={etape}
                    onChange={(e) => modifierEtape(si, ei, e.target.value)}
                    placeholder={`Étape ${ei + 1}…`}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => supprimerEtape(si, ei)}
                    className="mt-1"
                  >
                    <Trash2Icon className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={() => ajouterEtape(si)}>
                <PlusIcon className="size-4" />
                Ajouter une étape
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={ajouterEtapeSection}>
            <PlusIcon className="size-4" />
            Ajouter une section (Dressage, Sauce…)
          </Button>
        </div>
      </section>

      <Separator />

      {/* Infos complémentaires */}
      <section>
        <SectionTitre>Infos complémentaires</SectionTitre>
        <div className="space-y-4">
          <div>
            <Label htmlFor="materiel">Matériel</Label>
            <Textarea
              id="materiel"
              value={form.materiel}
              onChange={(e) => set('materiel', e.target.value)}
              placeholder="Ex : mixeur plongeant, poche pâtissière, plaque de cuisson…"
              className="mt-1"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="conservation">Conservation</Label>
            <Textarea
              id="conservation"
              value={form.conservation}
              onChange={(e) => set('conservation', e.target.value)}
              placeholder="Ex : 3 jours au frais, à consommer dans les 24h…"
              className="mt-1"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="conseils">Conseils &amp; concept</Label>
            <Textarea
              id="conseils"
              value={form.conseils}
              onChange={(e) => set('conseils', e.target.value)}
              placeholder="Conseil du chef, objectifs techniques, concept pédagogique…"
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Déclinaisons */}
      <section>
        <SectionTitre>Déclinaisons &amp; alternatives</SectionTitre>
        <Textarea
          id="declinaisons"
          value={form.declinaisons}
          onChange={(e) => set('declinaisons', e.target.value)}
          placeholder="Variantes possibles, substitutions d'ingrédients, adaptations saisonnières…"
          rows={4}
        />
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
