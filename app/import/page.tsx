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

const PROMPT = `Tu vas analyser un dossier de photos de fiches recettes professionnelles, UNE PAR UNE dans l'ordre.

OBJECTIF : produire à la fin UN SEUL tableau JSON contenant toutes les recettes complètes.

━━━ RÈGLES DE LECTURE ━━━

Analyse chaque photo et détermine sa nature :

1. RECETTE COMPLÈTE sur une page → commence et se termine sur cette image (titre + ingrédients + préparation présents)

2. RECETTE SUR PLUSIEURS PAGES → fréquent ! Une recette peut occuper 2, 3 pages ou plus.
   - Page 1 : titre + début des ingrédients ou du texte, mais préparation absente ou incomplète
   - Pages suivantes : suite des ingrédients, suite de la préparation, dressage… sans nouveau titre
   - Indices d'une suite : pas de titre en haut, liste qui commence au milieu, numérotation qui continue, "suite…"
   - Dans ce cas : ATTENDS d'avoir toutes les pages avant d'ajouter la recette au JSON

3. PLUSIEURS RECETTES sur une même page → titres distincts, séparateurs visuels
   → crée autant d'objets que de recettes

En cas de doute sur une suite : regarde la photo suivante avant de conclure.

━━━ CHAMPS À EXTRAIRE ━━━

- titre : nom de la recette (obligatoire)
- descriptif : description courte si présente
- conseils : tout ce qui relève du "conseil du chef", "concept", "techniques/objectifs", notes pédagogiques — en un seul bloc de texte
- materiel : matériel et équipements nécessaires
- conservation : durée et mode de conservation
- declinaisons : variantes, alternatives, substitutions d'ingrédients
- nb_personnes : entier
- temps_preparation, temps_cuisson, temps_repos : entiers en minutes
- types_plat : tableau parmi → Entrée, Plat, Dessert, Snack, Sauce, Base, Boisson
- techniques : tableau de techniques (ex: ["Cuisson vapeur", "Émulsion", "Façonnage"])
- saisons : tableau parmi → Printemps, Été, Automne, Hiver
- contraintes_alimentaires : tableau (ex: ["Vegan", "Sans gluten", "Sans lactose"])

━━━ INGRÉDIENTS ━━━

Certaines recettes ont plusieurs sections d'ingrédients (ex: "Pour la pâte", "Pour la garniture", "Émulsion", "Mimosa"…).
Utilise le champ "groupe" pour indiquer la section de chaque ingrédient.
Si une seule liste sans titre de section → omets le champ groupe.

allergenes : uniquement parmi ces 14 → Gluten, Crustacés, Œufs, Poissons, Arachides, Soja, Lait, Fruits à coque, Céleri, Moutarde, Graines de sésame, Anhydride sulfureux et sulfites, Lupin, Mollusques

━━━ PRÉPARATION ━━━

Utilise "etapes_sections" pour les sections de préparation.
Chaque section a un "nom" (ex: "Mise en oeuvre", "Dressage", "Topping", "Sauce", "Émulsion") et des "etapes".
Si une seule section sans titre → nom: ""
Le dressage, les toppings et la finition vont dans leur propre section si c'est indiqué séparément sur la fiche.
IMPORTANT : les étapes sont toujours des strings simples, jamais des objets.

━━━ FORMAT DE SORTIE ━━━

Quand tu as parcouru TOUTES les photos, retourne UN SEUL tableau JSON avec toutes les recettes :

[
  {
    "titre": "Bouillon d'épluchures",
    "materiel": "Rondeau haut, couvercle, chinois-étamine",
    "conservation": "3 jours au frais",
    "conseils": "Intégrer des épluchures / réaliser une recette zéro déchet. Varier les légumes selon la saison.",
    "declinaisons": "Varier les légumes et les épluchures en fonction de la saisonnalité.",
    "nb_personnes": 6,
    "temps_preparation": 20,
    "temps_cuisson": 60,
    "temps_repos": 30,
    "techniques": ["Cuisson en bouillon"],
    "contraintes_alimentaires": ["Vegan"],
    "ingredients": [
      { "nom": "Oignon", "quantite": "2", "unite": "pièces", "groupe": "Bouillon" },
      { "nom": "Champignons shiitake déshydratés", "quantite": "3", "unite": "pièces", "groupe": "Garniture aromatique" },
      { "nom": "Sauce soja tamari", "quantite": "2", "unite": "càs", "allergenes": ["Soja"] }
    ],
    "etapes_sections": [
      {
        "nom": "",
        "etapes": [
          "Peler et émincer les oignons. Nettoyer et émincer les champignons.",
          "Faire suer sur feu vif les oignons puis les champignons avec l'huile d'olive.",
          "Mouiller avec la sauce tamari et le vin rouge, remuer jusqu'à évaporation.",
          "Ajouter les épluchures triées, lavées et émincées.",
          "Couvrir d'eau et porter à ébullition. Laisser mijoter 1 heure.",
          "Hors du feu, laisser infuser 30 minutes à couvert puis filtrer au chinois."
        ]
      }
    ]
  },
  {
    "titre": "Maki de poireau, mimosa de tofu",
    "ingredients": [
      { "nom": "Poireau", "quantite": "1", "unite": "pièce/personne", "groupe": "Maki" },
      { "nom": "Lait de soja", "quantite": "75", "unite": "g", "groupe": "Émulsion", "allergenes": ["Soja"] }
    ],
    "etapes_sections": [
      { "nom": "Mise en oeuvre", "etapes": ["Nettoyer et parer les poireaux.", "Cuire à la vapeur 10 à 15 minutes."] },
      { "nom": "Dressage", "etapes": ["Trancher le maki et dresser sur l'assiette.", "Pocher l'émulsion."] }
    ]
  }
]

Ne retourne RIEN avant d'avoir analysé toutes les photos. Pas de texte, pas de commentaires, uniquement le tableau JSON final.
Si une information est illisible, omets le champ. Ne jamais inventer.`

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
              titre: 'Donnez accès au dossier photos à Claude Cowork',
              detail: 'Les photos doivent être nommées dans l\'ordre (ex : 001.jpg, 002.jpg…) pour que Claude les traite dans le bon ordre.',
            },
            {
              n: '2',
              titre: 'Copiez le prompt ci-dessous et donnez-le à Claude Cowork',
              detail: 'Ajoutez : "Lis toutes les photos du dossier une par une dans l\'ordre. Certaines recettes s\'étalent sur plusieurs pages — regroupe-les. Plusieurs recettes peuvent apparaître sur une même page. Retourne à la fin un seul tableau JSON."',
            },
            {
              n: '3',
              titre: 'Claude parcourt toutes les photos et retourne un JSON final',
              detail: 'Il détecte les recettes complètes, les suites de page en page, et les pages multi-recettes. Rien n\'est retourné avant d\'avoir tout lu.',
            },
            {
              n: '4',
              titre: 'Copiez le JSON → importez ici en une fois',
              detail: 'Collez le tableau JSON retourné par Claude dans la zone ci-dessous et cliquez sur Importer. Toutes les recettes sont créées en une opération.',
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
            <span>Voir le prompt à donner à Claude Cowork</span>
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
