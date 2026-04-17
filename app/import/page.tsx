'use client'

import * as React from 'react'
import { UploadIcon, CheckCircleIcon, AlertCircleIcon, FileJsonIcon, ChevronDownIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────

interface IngredientImport {
  nom: string
  quantite?: string
  unite?: string
  groupe?: string   // nom de la section (ex: "Émulsion", "Maki de poireau")
  famille?: string
  saisons?: string[]
  allergenes?: string[]
}

interface EtapeSectionImport {
  nom: string       // ex: "Mise en oeuvre", "Dressage", "Sauce" — '' si section principale
  etapes: string[]
}

interface RecetteImport {
  titre: string
  descriptif?: string
  declinaisons?: string
  materiel?: string
  conservation?: string
  conseils?: string
  nb_personnes?: number
  temps_preparation?: number
  temps_cuisson?: number
  temps_repos?: number
  types_plat?: string[]
  techniques?: string[]
  saisons?: string[]
  contraintes_alimentaires?: string[]
  etapes_sections?: EtapeSectionImport[]
  etapes?: string[]  // fallback si pas de sections
  ingredients?: IngredientImport[]
}

type EtatLigne = 'attente' | 'en_cours' | 'ok' | 'erreur'
interface ResultatImport { titre: string; etat: EtatLigne; message?: string }

// ─── Prompt ───────────────────────────────────────────────────────────────

const PROMPT = `Tu vas analyser un lot de photos de fiches recettes de cuisine professionnelles.

Les photos sont dans l'ORDRE : si une recette occupe plusieurs pages consécutives, les images se suivront naturellement.

RÈGLES DE DÉCOUPAGE :
- Nouvelle recette = nouveau titre en haut de page, séparateur visuel, changement de style
- Suite de recette = pas de titre, liste ou phrase qui continue, numérotation qui continue
- Plusieurs recettes sur une image = extrait-les séparément

CHAMPS À EXTRAIRE (tous optionnels sauf titre) :
- titre : nom de la recette
- descriptif : description courte si présente
- conseils : tout ce qui relève du "conseil du chef", "concept", "techniques/objectifs", notes pédagogiques — concaténer en un seul bloc de texte
- materiel : liste du matériel nécessaire (texte libre)
- conservation : durée et mode de conservation
- declinaisons : variantes, alternatives, substitutions d'ingrédients, propositions de déclinaisons
- nb_personnes : entier
- temps_preparation, temps_cuisson, temps_repos : entiers en minutes
- types_plat : tableau parmi → Entrée, Plat, Dessert, Snack, Sauce, Base, Boisson
- techniques : tableau de techniques utilisées (ex: ["Cuisson vapeur", "Émulsion"])
- saisons : tableau parmi → Printemps, Été, Automne, Hiver
- contraintes_alimentaires : tableau (ex: ["Vegan", "Sans gluten", "Sans lactose"])

INGRÉDIENTS — utilise "groupe" pour les sections (ex: "Maki de poireau", "Émulsion", "Mimosa") :
- si la recette n'a qu'une liste, laisse groupe vide ou omets-le
- si plusieurs sections, indique le nom de la section dans "groupe"
- allergenes : uniquement parmi → Gluten, Crustacés, Œufs, Poissons, Arachides, Soja, Lait, Fruits à coque, Céleri, Moutarde, Graines de sésame, Anhydride sulfureux et sulfites, Lupin, Mollusques

PRÉPARATION — utilise "etapes_sections" pour les sections :
- nom de section : "Mise en oeuvre", "Dressage", "Topping", "Sauce", "Émulsion", ou tout autre titre présent
- si une seule section sans titre, utilise nom: ""
- les étapes sont numérotées par section (recommencer à 1 à chaque nouvelle section)
- inclure le dressage, les toppings et la finition dans leur propre section si c'est indiqué séparément

Retourne UNIQUEMENT un tableau JSON valide, sans texte autour, sans markdown :

[
  {
    "titre": "Maki de poireau, mimosa de tofu, sauce verte",
    "descriptif": "Recette froide façon maki avec poireau vapeur et tofu émulsionné",
    "conseils": "Cuisson vapeur / pochage / façonnage. Banane remplace en partie les œufs. Attention à ne pas trop écraser.",
    "materiel": "Vitaliseur, mixeur plongeant, verre doseur à bord haut, poche pâtissière",
    "conservation": "3 jours au frais",
    "declinaisons": "Au printemps, remplacer les poireaux par des asperges blanches. Miso à la place de la moutarde.",
    "nb_personnes": 4,
    "temps_preparation": 50,
    "temps_cuisson": 20,
    "temps_repos": 30,
    "types_plat": ["Entrée"],
    "techniques": ["Cuisson vapeur", "Émulsion", "Façonnage"],
    "saisons": ["Automne", "Hiver"],
    "contraintes_alimentaires": ["Vegan"],
    "ingredients": [
      { "nom": "Poireau", "quantite": "1", "unite": "pièce", "groupe": "Maki de poireau" },
      { "nom": "Feuille d'algue nori", "quantite": "0.5", "unite": "feuille", "groupe": "Maki de poireau" },
      { "nom": "Lait de soja", "quantite": "75", "unite": "g", "groupe": "Émulsion", "allergenes": ["Soja"] },
      { "nom": "Moutarde", "quantite": "1.5", "unite": "càs", "groupe": "Émulsion", "allergenes": ["Moutarde"] },
      { "nom": "Tofu ferme", "quantite": "75", "unite": "g", "groupe": "Mimosa", "allergenes": ["Soja"] }
    ],
    "etapes_sections": [
      {
        "nom": "Maki de poireau",
        "etapes": [
          "Nettoyer et parer les poireaux.",
          "Cuire les poireaux à la vapeur 10 à 15 minutes puis laisser refroidir.",
          "Rouler chaque poireau dans une feuille d'algues nori et envelopper dans du film alimentaire.",
          "Réserver au froid."
        ]
      },
      {
        "nom": "Émulsion",
        "etapes": [
          "Dans un verre doseur, ajouter tous les ingrédients dans l'ordre puis émulsionner au mixer plongeant sans trop incorporer d'air.",
          "Réserver au froid dans une poche munie d'une petite douille ronde."
        ]
      },
      {
        "nom": "Dressage",
        "etapes": [
          "Trancher le maki de poireau et dresser sur l'assiette.",
          "Pocher l'émulsion et parsemer le mimosa de tofu."
        ]
      }
    ]
  }
]

Si une information est illisible ou absente, omets le champ. Ne pas inventer.`

// ─── Composant principal ───────────────────────────────────────────────────

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
        // ── Construire etapes_sections + etapes plat ──
        let etapes_sections: EtapeSectionImport[] = []
        if (rec.etapes_sections?.length) {
          etapes_sections = rec.etapes_sections
        } else if (rec.etapes?.length) {
          etapes_sections = [{ nom: '', etapes: rec.etapes }]
        }
        const etapes_flat = etapes_sections.flatMap((s) => s.etapes)

        // ── Déduire les allergènes depuis les ingrédients ──
        const allergenes = Array.from(new Set(
          rec.ingredients?.flatMap((i) => i.allergenes ?? []) ?? []
        ))

        // ── Insérer la recette ──
        const { data: recetteData, error: errRecette } = await supabase
          .from('recettes')
          .insert({
            titre: rec.titre || 'Sans titre',
            descriptif: rec.descriptif ?? null,
            declinaisons: rec.declinaisons ?? null,
            materiel: rec.materiel ?? null,
            conservation: rec.conservation ?? null,
            conseils: rec.conseils ?? null,
            nb_personnes: rec.nb_personnes ?? null,
            temps_preparation: rec.temps_preparation ?? null,
            temps_cuisson: rec.temps_cuisson ?? null,
            temps_repos: rec.temps_repos ?? null,
            types_plat: rec.types_plat ?? [],
            techniques: rec.techniques ?? [],
            saisons: rec.saisons ?? [],
            contraintes_alimentaires: rec.contraintes_alimentaires ?? [],
            allergenes,
            etapes: etapes_flat,
            etapes_sections: etapes_sections.length > 0 ? etapes_sections : null,
          })
          .select()
          .single()

        if (errRecette || !recetteData) throw new Error(errRecette?.message || 'Erreur création recette')

        // ── Insérer les ingrédients avec groupe et ordre ──
        if (rec.ingredients?.length) {
          for (let ii = 0; ii < rec.ingredients.length; ii++) {
            const ing = rec.ingredients[ii]
            const { data: ingrData, error: errIngr } = await supabase
              .from('ingredients')
              .upsert(
                { nom: ing.nom, famille: ing.famille ?? null, saisons: ing.saisons ?? [], allergenes: ing.allergenes ?? [] },
                { onConflict: 'nom' }
              )
              .select()
              .single()
            if (errIngr || !ingrData) continue

            await supabase.from('recette_ingredients').upsert(
              {
                recette_id: recetteData.id,
                ingredient_id: ingrData.id,
                quantite: ing.quantite ?? '',
                unite: ing.unite ?? '',
                groupe: ing.groupe?.trim() || null,
                ordre: ii,
              },
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
              detail: 'Claude ne peut pas traiter 197 images en une fois. Faites 7–10 sessions de ~25 photos. Glissez-déposez les images directement dans claude.ai.',
            },
            {
              n: '3',
              titre: 'Collez le prompt ci-dessous + vos photos',
              detail: 'Un seul prompt gère tous les cas : recettes sur 1 page, sur 2 pages, plusieurs recettes par page, sections d\'ingrédients, dressage…',
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
            <span>Voir le prompt à coller dans Claude</span>
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
