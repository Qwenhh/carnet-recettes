'use client'

import * as React from 'react'
import { UploadIcon, CheckCircleIcon, AlertCircleIcon, FileJsonIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

// ─── Structure JSON attendue ───────────────────────────────────────────────
// (générée par Claude Cowork depuis les photos de recettes)

interface RecetteImport {
  titre: string
  descriptif?: string
  nb_personnes?: number
  temps_preparation?: number
  temps_cuisson?: number
  temps_repos?: number
  types_plat?: string[]
  techniques?: string[]
  saisons?: string[]
  contraintes_alimentaires?: string[]
  etapes?: string[]
  ingredients?: {
    nom: string
    quantite?: string
    unite?: string
    famille?: string
    saisons?: string[]
    allergenes?: string[]
  }[]
}

type EtatLigne = 'attente' | 'en_cours' | 'ok' | 'erreur'

interface ResultatImport {
  titre: string
  etat: EtatLigne
  message?: string
}

// ─── Format de prompt pour Claude Cowork ──────────────────────────────────

const PROMPT_COWORK = `Tu vas analyser une ou plusieurs photos de recettes de cuisine.

RÈGLES IMPORTANTES :
- Une image peut contenir PLUSIEURS recettes : extrait-les toutes
- Une recette peut s'étaler sur PLUSIEURS images : regroupe-les en un seul objet
- Si tu reçois plusieurs images, analyse l'ensemble et produis un seul tableau JSON

Retourne UNIQUEMENT un tableau JSON valide (même pour une seule recette), sans aucun texte autour :

[
  {
    "titre": "Nom de la recette",
    "descriptif": "Description courte (optionnel)",
    "nb_personnes": 4,
    "temps_preparation": 30,
    "temps_cuisson": 20,
    "temps_repos": 0,
    "types_plat": ["Entrée"],
    "techniques": ["Snacké", "Braisé"],
    "saisons": ["Printemps", "Été"],
    "contraintes_alimentaires": [],
    "etapes": [
      "Première étape.",
      "Deuxième étape."
    ],
    "ingredients": [
      { "nom": "Beurre", "quantite": "50", "unite": "g", "famille": "Matière grasse", "allergenes": ["Lait"] },
      { "nom": "Farine", "quantite": "200", "unite": "g", "famille": "Féculent", "allergenes": ["Gluten"] }
    ]
  }
]

Contraintes :
- temps : entiers en minutes
- saisons : uniquement parmi Printemps, Été, Automne, Hiver
- allergenes possibles : Gluten, Crustacés, Œufs, Poissons, Arachides, Soja, Lait, Fruits à coque, Céleri, Moutarde, Graines de sésame, Anhydride sulfureux et sulfites, Lupin, Mollusques
- si une info est illisible ou inconnue, omets le champ
- ne jamais inventer des informations absentes`

const PROMPT_FUSION = `Ces images montrent différentes parties d'UNE MÊME recette (suite de la recette précédente, ou recto/verso).

Combine toutes les informations visibles et retourne UN SEUL objet JSON dans un tableau :

[
  {
    "titre": "Nom de la recette",
    ...
  }
]

Même format et mêmes contraintes que pour une recette normale. Retourne uniquement le JSON.`

export default function PageImport() {
  const [json, setJson] = React.useState('')
  const [resultats, setResultats] = React.useState<ResultatImport[]>([])
  const [importEnCours, setImportEnCours] = React.useState(false)
  const [promptActif, setPromptActif] = React.useState<'standard' | 'fusion' | null>(null)

  function validerJson(): RecetteImport[] | null {
    try {
      const parsed = JSON.parse(json)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      return arr
    } catch {
      toast.error('JSON invalide — vérifiez la syntaxe')
      return null
    }
  }

  async function importerRecettes() {
    const recettes = validerJson()
    if (!recettes) return
    if (recettes.length === 0) { toast.error('Aucune recette à importer'); return }

    setImportEnCours(true)
    setResultats(recettes.map((r) => ({ titre: r.titre || 'Sans titre', etat: 'attente' })))

    for (let i = 0; i < recettes.length; i++) {
      const rec = recettes[i]
      setResultats((prev) => prev.map((r, idx) => idx === i ? { ...r, etat: 'en_cours' } : r))

      try {
        // Insérer la recette
        const { data: recetteData, error: errRecette } = await supabase
          .from('recettes')
          .insert({
            titre: rec.titre || 'Sans titre',
            descriptif: rec.descriptif ?? null,
            nb_personnes: rec.nb_personnes ?? null,
            temps_preparation: rec.temps_preparation ?? null,
            temps_cuisson: rec.temps_cuisson ?? null,
            temps_repos: rec.temps_repos ?? null,
            types_plat: rec.types_plat ?? [],
            techniques: rec.techniques ?? [],
            saisons: rec.saisons ?? [],
            contraintes_alimentaires: rec.contraintes_alimentaires ?? [],
            allergenes: rec.ingredients?.flatMap((i) => i.allergenes ?? []).filter((v, i, a) => a.indexOf(v) === i) ?? [],
            etapes: rec.etapes ?? [],
          })
          .select()
          .single()

        if (errRecette || !recetteData) throw new Error(errRecette?.message || 'Erreur création recette')

        const recetteId = recetteData.id

        // Insérer les ingrédients
        if (rec.ingredients?.length) {
          for (const ing of rec.ingredients) {
            // Upsert ingrédient
            const { data: ingrData, error: errIngr } = await supabase
              .from('ingredients')
              .upsert(
                {
                  nom: ing.nom,
                  famille: ing.famille ?? null,
                  saisons: ing.saisons ?? [],
                  allergenes: ing.allergenes ?? [],
                },
                { onConflict: 'nom' }
              )
              .select()
              .single()

            if (errIngr || !ingrData) continue

            // Liaison recette-ingrédient
            await supabase.from('recette_ingredients').upsert(
              {
                recette_id: recetteId,
                ingredient_id: ingrData.id,
                quantite: ing.quantite ?? '',
                unite: ing.unite ?? '',
              },
              { onConflict: 'recette_id,ingredient_id' }
            )
          }
        }

        setResultats((prev) =>
          prev.map((r, idx) => idx === i ? { ...r, etat: 'ok' } : r)
        )
      } catch (err) {
        setResultats((prev) =>
          prev.map((r, idx) => idx === i ? { ...r, etat: 'erreur', message: String(err) } : r)
        )
      }
    }

    setImportEnCours(false)
    toast.success('Import terminé !')
  }

  const nbOk = resultats.filter((r) => r.etat === 'ok').length
  const nbErreur = resultats.filter((r) => r.etat === 'erreur').length

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-semibold">Import de recettes</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Collez le JSON généré par Claude Cowork depuis vos photos de recettes.
      </p>

      {/* Aide */}
      <section className="mb-6 space-y-3">

        {/* Cas 1 : standard */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <FileJsonIcon className="size-4 text-primary" />
                <span className="font-medium text-sm">Cas standard</span>
              </div>
              <p className="text-sm text-muted-foreground">
                1+ images avec 1+ recettes chacune → Claude extrait tout en un seul JSON.
              </p>
              <ul className="ml-4 mt-1 list-disc space-y-0.5 text-xs text-muted-foreground">
                <li>Envoyez toutes les images en une seule fois à Claude dans Cowork</li>
                <li>Collez ce prompt, puis copiez le JSON retourné ci-dessous</li>
              </ul>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPromptActif(promptActif === 'standard' ? null : 'standard')}
              className="shrink-0"
            >
              {promptActif === 'standard' ? 'Masquer' : 'Voir le prompt'}
            </Button>
          </div>
          {promptActif === 'standard' && (
            <div className="mt-4 rounded-lg bg-muted p-3">
              <pre className="whitespace-pre-wrap text-xs text-foreground">{PROMPT_COWORK}</pre>
              <Button
                size="sm" variant="outline" className="mt-2"
                onClick={() => { navigator.clipboard.writeText(PROMPT_COWORK); toast.success('Prompt copié !') }}
              >
                Copier
              </Button>
            </div>
          )}
        </div>

        {/* Cas 2 : recette sur 2 images */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <FileJsonIcon className="size-4 text-primary" />
                <span className="font-medium text-sm">Recette sur plusieurs images</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Une recette est répartie sur 2 images ou plus (recto/verso, suite…).
              </p>
              <ul className="ml-4 mt-1 list-disc space-y-0.5 text-xs text-muted-foreground">
                <li>Envoyez les images de cette recette à Claude dans Cowork</li>
                <li>Collez ce prompt (dit à Claude de fusionner en une seule recette)</li>
              </ul>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPromptActif(promptActif === 'fusion' ? null : 'fusion')}
              className="shrink-0"
            >
              {promptActif === 'fusion' ? 'Masquer' : 'Voir le prompt'}
            </Button>
          </div>
          {promptActif === 'fusion' && (
            <div className="mt-4 rounded-lg bg-muted p-3">
              <pre className="whitespace-pre-wrap text-xs text-foreground">{PROMPT_FUSION}</pre>
              <Button
                size="sm" variant="outline" className="mt-2"
                onClick={() => { navigator.clipboard.writeText(PROMPT_FUSION); toast.success('Prompt copié !') }}
              >
                Copier
              </Button>
            </div>
          )}
        </div>

        {/* Rappel workflow */}
        <p className="text-xs text-muted-foreground px-1">
          💡 <strong>Conseil :</strong> pour un lot de 20 photos, envoyez-les toutes d'un coup — Claude identifie et sépare chaque recette automatiquement.
        </p>
      </section>

      {/* Zone JSON */}
      <section className="mb-4">
        <label className="mb-1 block text-sm font-medium">JSON des recettes</label>
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder={'[\n  {\n    "titre": "Ma recette",\n    ...\n  }\n]'}
          rows={14}
          className="font-mono text-xs"
        />
      </section>

      <Button
        onClick={importerRecettes}
        disabled={importEnCours || !json.trim()}
        className="w-full"
        size="lg"
      >
        <UploadIcon className="size-4" />
        {importEnCours ? 'Import en cours…' : 'Importer les recettes'}
      </Button>

      {/* Résultats */}
      {resultats.length > 0 && (
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="font-medium text-sm">Résultats</span>
            {nbOk > 0 && <Badge variant="default">{nbOk} importée{nbOk > 1 ? 's' : ''}</Badge>}
            {nbErreur > 0 && <Badge variant="destructive">{nbErreur} erreur{nbErreur > 1 ? 's' : ''}</Badge>}
          </div>
          <ul className="space-y-2">
            {resultats.map((r, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                {r.etat === 'ok' && <CheckCircleIcon className="size-4 shrink-0 text-green-600" />}
                {r.etat === 'erreur' && <AlertCircleIcon className="size-4 shrink-0 text-destructive" />}
                {r.etat === 'en_cours' && (
                  <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
                {r.etat === 'attente' && <div className="size-4 shrink-0 rounded-full border-2 border-muted-foreground" />}
                <span className={r.etat === 'erreur' ? 'text-destructive' : ''}>{r.titre}</span>
                {r.message && <span className="text-xs text-muted-foreground">{r.message}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
