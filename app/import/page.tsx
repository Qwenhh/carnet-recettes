'use client'

import * as React from 'react'
import { UploadIcon, CheckCircleIcon, AlertCircleIcon, FileJsonIcon, ChevronDownIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

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
interface ResultatImport { titre: string; etat: EtatLigne; message?: string }

// ─── Prompt unique — gère tous les cas ────────────────────────────────────

const PROMPT = `Tu vas analyser un lot de photos de recettes de cuisine professionnelles.

Les photos sont dans l'ORDRE : si une recette occupe plusieurs pages consécutives, les images se suivront naturellement. Tu dois reconstituer chaque recette complète.

RÈGLES :
- Si une image contient plusieurs recettes distinctes (titre différent), extrait-les séparément
- Si plusieurs images consécutives correspondent à la même recette (suite des ingrédients, suite des étapes, recto/verso), regroupe-les en UN SEUL objet
- Pour identifier une nouvelle recette : cherche un nouveau titre en haut de page, une ligne de séparation, ou un changement de style d'écriture
- Pour identifier une suite : pas de titre, début en milieu de liste ou en milieu de phrase, mention "suite", numérotation qui continue

Retourne UNIQUEMENT un tableau JSON valide, sans texte autour, sans markdown :

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

Contraintes strictes :
- temps : entiers en minutes uniquement
- saisons : uniquement parmi → Printemps, Été, Automne, Hiver
- allergènes : uniquement parmi → Gluten, Crustacés, Œufs, Poissons, Arachides, Soja, Lait, Fruits à coque, Céleri, Moutarde, Graines de sésame, Anhydride sulfureux et sulfites, Lupin, Mollusques
- si une information est illisible ou absente, omets le champ (ne pas inventer)
- retourner uniquement du JSON brut, aucun texte avant ou après`

export default function PageImport() {
  const [json, setJson] = React.useState('')
  const [resultats, setResultats] = React.useState<ResultatImport[]>([])
  const [importEnCours, setImportEnCours] = React.useState(false)
  const [promptOuvert, setPromptOuvert] = React.useState(false)

  function validerJson(): RecetteImport[] | null {
    try {
      const parsed = JSON.parse(json)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      toast.error('JSON invalide — vérifiez la syntaxe')
      return null
    }
  }

  async function importerRecettes() {
    const recettes = validerJson()
    if (!recettes || recettes.length === 0) { toast.error('Aucune recette à importer'); return }

    setImportEnCours(true)
    setResultats(recettes.map((r) => ({ titre: r.titre || 'Sans titre', etat: 'attente' })))

    for (let i = 0; i < recettes.length; i++) {
      const rec = recettes[i]
      setResultats((prev) => prev.map((r, idx) => idx === i ? { ...r, etat: 'en_cours' } : r))

      try {
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
            allergenes: Array.from(new Set(rec.ingredients?.flatMap((i) => i.allergenes ?? []) ?? [])),
            etapes: rec.etapes ?? [],
          })
          .select()
          .single()

        if (errRecette || !recetteData) throw new Error(errRecette?.message || 'Erreur création recette')

        if (rec.ingredients?.length) {
          for (const ing of rec.ingredients) {
            const { data: ingrData, error: errIngr } = await supabase
              .from('ingredients')
              .upsert({ nom: ing.nom, famille: ing.famille ?? null, saisons: ing.saisons ?? [], allergenes: ing.allergenes ?? [] }, { onConflict: 'nom' })
              .select()
              .single()
            if (errIngr || !ingrData) continue
            await supabase.from('recette_ingredients').upsert(
              { recette_id: recetteData.id, ingredient_id: ingrData.id, quantite: ing.quantite ?? '', unite: ing.unite ?? '' },
              { onConflict: 'recette_id,ingredient_id' }
            )
          }
        }

        setResultats((prev) => prev.map((r, idx) => idx === i ? { ...r, etat: 'ok' } : r))
      } catch (err) {
        setResultats((prev) => prev.map((r, idx) => idx === i ? { ...r, etat: 'erreur', message: String(err) } : r))
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
        Analysez vos photos avec Claude, collez le JSON ici, importez.
      </p>

      {/* Workflow */}
      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileJsonIcon className="size-4 text-primary" />
          <span className="font-medium">Workflow pour 197 photos</span>
        </div>

        <ol className="space-y-3">
          {[
            {
              n: '1',
              titre: 'Triez vos photos dans l\'ordre',
              detail: 'Les photos doivent être dans l\'ordre de lecture. Claude détecte automatiquement les débuts et fins de recette.',
            },
            {
              n: '2',
              titre: 'Envoyez par lots de 20–30 photos à Claude',
              detail: 'Claude ne peut pas traiter 197 images en une fois. Faites 7–10 sessions de ~25 photos. Glissez-déposez les images directement dans Cowork.',
            },
            {
              n: '3',
              titre: 'Collez le prompt ci-dessous',
              detail: 'Un seul prompt gère tous les cas : recettes sur 1 page, sur 2 pages, ou plusieurs recettes par page.',
            },
            {
              n: '4',
              titre: 'Copiez le JSON → importez ici',
              detail: 'Collez le JSON retourné par Claude dans la zone ci-dessous et cliquez sur Importer. Répétez pour chaque lot.',
            },
          ].map(({ n, titre, detail }) => (
            <li key={n} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {n}
              </span>
              <div>
                <p className="text-sm font-medium">{titre}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Prompt */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setPromptOuvert((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-medium hover:text-primary"
          >
            <span>Voir le prompt à coller dans Cowork</span>
            <ChevronDownIcon className={`size-4 transition-transform ${promptOuvert ? 'rotate-180' : ''}`} />
          </button>
          {promptOuvert && (
            <div className="mt-3 rounded-lg bg-muted p-3">
              <pre className="whitespace-pre-wrap text-xs text-foreground leading-relaxed">{PROMPT}</pre>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => { navigator.clipboard.writeText(PROMPT); toast.success('Prompt copié !') }}
              >
                Copier le prompt
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Zone JSON */}
      <section className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium">JSON retourné par Claude</label>
          {json.trim() && (
            <button
              type="button"
              onClick={() => setJson('')}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Effacer
            </button>
          )}
        </div>
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder={'[\n  {\n    "titre": "Ma recette",\n    ...\n  }\n]'}
          rows={12}
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
                {r.etat === 'en_cours' && <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                {r.etat === 'attente' && <div className="size-4 shrink-0 rounded-full border-2 border-muted-foreground" />}
                <span className={r.etat === 'erreur' ? 'text-destructive' : ''}>{r.titre}</span>
                {r.message && <span className="text-xs text-muted-foreground truncate">{r.message}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
