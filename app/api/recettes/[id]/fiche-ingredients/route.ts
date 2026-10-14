import { NextResponse } from 'next/server'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

import { supabase } from '@/lib/supabase'
import { mapRecetteAny } from '@/lib/mappers'
import {
  LOGO_VILLA_YOGA_BASE64,
  LOGO_VILLA_YOGA_WIDTH_PX,
  LOGO_VILLA_YOGA_HEIGHT_PX,
} from '@/lib/logo-villa-yoga'

// ─── Fiche ingrédients (export Word aux couleurs de Villa Yoga) ─────────────
// Une seule page A4, quel que soit le nombre d'ingrédients : Word n'a pas de
// « ajuster à la page », donc on estime la hauteur du contenu et on choisit
// le nombre de colonnes et la taille du texte pour que tout tienne.

// ─── Constantes de mise en page (en points, 1 pt = 20 twips) ────────────────

const PAGE_LARGEUR_PT = 595.3
const PAGE_HAUTEUR_PT = 841.9
const MARGE_PT = 56.7 // 2 cm
const LARGEUR_UTILE_PT = PAGE_LARGEUR_PT - 2 * MARGE_PT
const PAGE_LARGEUR_TW = 11906
const PAGE_HAUTEUR_TW = 16838
const MARGE_TW = 1134
const LARGEUR_UTILE_TW = PAGE_LARGEUR_TW - 2 * MARGE_TW

// Marge de sécurité : l'estimation de hauteur n'est pas exacte au pixel
const HAUTEUR_MAX_PT = PAGE_HAUTEUR_PT * 0.96

const CREME = 'F6F0E8'
const NOIR = '000000'

const LOGO_LARGEUR_PX = 150
const LOGO_HAUTEUR_PX = Math.round((LOGO_LARGEUR_PX * LOGO_VILLA_YOGA_HEIGHT_PX) / LOGO_VILLA_YOGA_WIDTH_PX)

const TAILLES_INGREDIENTS = [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7]
const TAILLES_TITRE = [24, 22, 20, 18, 16]
const INTERLIGNE = 1.45
const RETRAIT_TIRET_PT = 12
const FS_ALLERGENES = 11

const pt = (v: number) => Math.round(v * 20)

const AUCUNE_BORDURE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
}
const AUCUNE_BORDURE_TABLE = {
  ...AUCUNE_BORDURE,
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
}

// ─── Estimation de la hauteur ───────────────────────────────────────────────

// Liste à plat : sans doublons (même nom à la casse et aux accents près,
// la première écriture est conservée) et triée par ordre alphabétique
function listerIngredients(noms: string[]): string[] {
  const parCle = new Map<string, string>()
  for (const brut of noms) {
    const nom = brut.trim()
    const cle = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    if (cle && !parCle.has(cle)) parCle.set(cle, nom)
  }
  return Array.from(parCle.values()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
}

function nbLignes(texte: string, largeurPt: number, fs: number, facteurLargeur = 0.55): number {
  const caracteresParLigne = Math.max(8, Math.floor(largeurPt / (fs * facteurLargeur)))
  return Math.max(1, Math.ceil(texte.length / caracteresParLigne))
}

// Répartit les éléments dans N colonnes en les équilibrant (les premières
// colonnes reçoivent l'éventuel élément en plus)
function repartir<T>(items: T[], colonnes: number): T[][] {
  const base = Math.floor(items.length / colonnes)
  const reste = items.length % colonnes
  const resultat: T[][] = []
  let debut = 0
  for (let c = 0; c < colonnes; c++) {
    const taille = base + (c < reste ? 1 : 0)
    resultat.push(items.slice(debut, debut + taille))
    debut += taille
  }
  return resultat
}

function hauteurIngredients(ingredients: string[], fs: number, colonnes: number): number {
  const largeurTexte = LARGEUR_UTILE_PT / colonnes - RETRAIT_TIRET_PT - 8
  const parColonne = repartir(ingredients, colonnes)
  const maxLignes = Math.max(
    0,
    ...parColonne.map((col) => col.reduce((somme, item) => somme + nbLignes(item, largeurTexte, fs), 0))
  )
  return maxLignes * fs * INTERLIGNE
}

function choisirMiseEnPage(params: {
  ingredients: string[]
  titre: string
  texteAllergenes: string
}) {
  const { ingredients, titre, texteAllergenes } = params

  // Titre : on réduit la taille s'il prendrait plus de 3 lignes
  let fsTitre = TAILLES_TITRE[TAILLES_TITRE.length - 1]
  for (const fs of TAILLES_TITRE) {
    if (nbLignes(titre, LARGEUR_UTILE_PT, fs, 0.6) <= 3) { fsTitre = fs; break }
  }
  const lignesTitre = nbLignes(titre, LARGEUR_UTILE_PT, fsTitre, 0.6)

  const hauteurLogoPt = LOGO_HAUTEUR_PX * 0.75
  const hauteurBandeau = 28 + hauteurLogoPt + 18 + lignesTitre * fsTitre * 1.2 + 24

  const lignesAllergenes = nbLignes(texteAllergenes, LARGEUR_UTILE_PT - 28, FS_ALLERGENES, 0.6)
  const hauteurAllergenes = 20 + lignesAllergenes * FS_ALLERGENES * 1.5

  // espace sous le bandeau + libellé Ingrédients + espace + libellé Allergènes + encadré + marge basse
  const fixe = hauteurBandeau + 26 + 27 + 20 + 27 + hauteurAllergenes + 36

  for (const fs of TAILLES_INGREDIENTS) {
    const colonnesPossibles = fs > 10 ? [1, 2] : [1, 2, 3]
    for (const colonnes of colonnesPossibles) {
      if (fixe + hauteurIngredients(ingredients, fs, colonnes) <= HAUTEUR_MAX_PT) {
        return { fsTitre, fsIngredients: fs, colonnes }
      }
    }
  }
  return { fsTitre, fsIngredients: 7, colonnes: 3 }
}

// ─── Construction du document ───────────────────────────────────────────────

function libelle(texte: string) {
  return new Paragraph({
    indent: { left: MARGE_TW, right: MARGE_TW },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NOIR, space: 4 } },
    spacing: { line: pt(14), lineRule: LineRuleType.EXACT, after: pt(8) },
    children: [new TextRun({ text: texte, bold: true, size: 16, characterSpacing: 40 })],
  })
}

function espace(hauteurPt: number) {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: pt(hauteurPt), lineRule: LineRuleType.EXACT },
    children: [],
  })
}

// Tableau pleine largeur de page, avec une colonne d'espacement de chaque côté
// pour retrouver les marges de 2 cm. On évite volontairement le retrait de
// tableau (indent), interprété différemment selon le mode de compatibilité de
// Word et les logiciels qui ouvrent le fichier.
function tableauAvecMarges(largeursColonnes: number[], cellulesCentre: TableCell[]) {
  const espacement = () =>
    new TableCell({
      width: { size: MARGE_TW, type: WidthType.DXA },
      borders: AUCUNE_BORDURE,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [] })],
    })

  return new Table({
    width: { size: PAGE_LARGEUR_TW, type: WidthType.DXA },
    columnWidths: [MARGE_TW, ...largeursColonnes, MARGE_TW],
    layout: TableLayoutType.FIXED,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: AUCUNE_BORDURE_TABLE,
    rows: [new TableRow({ cantSplit: true, children: [espacement(), ...cellulesCentre, espacement()] })],
  })
}

// Largeurs de colonnes dont la somme fait exactement la largeur utile
function largeursEgales(colonnes: number): number[] {
  const base = Math.floor(LARGEUR_UTILE_TW / colonnes)
  const largeurs = Array(colonnes).fill(base)
  largeurs[colonnes - 1] += LARGEUR_UTILE_TW - base * colonnes
  return largeurs
}

function nomFichier(titre: string): { ascii: string; utf8: string } {
  const utf8 = `Fiche ingrédients - ${titre}`.replace(/[\\/:*?"<>|]/g, '-').trim()
  const ascii = utf8.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '_')
  return { ascii, utf8 }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('recettes')
    .select('*, recette_ingredients(quantite, unite, groupe, ordre, ingredients(id, nom, saisons, allergenes))')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 })
  }

  const recette = mapRecetteAny(data)

  const ingredients = listerIngredients(recette.ingredients.map((ri) => ri.ingredient.nom))

  const texteAllergenes = recette.allergenes.length > 0
    ? recette.allergenes.join(', ')
    : 'Aucun allergène renseigné'

  const { fsTitre, fsIngredients, colonnes } = choisirMiseEnPage({
    ingredients,
    titre: recette.titre,
    texteAllergenes,
  })

  // ── Bandeau crème : logo + titre ──
  const bandeau = new Table({
    width: { size: PAGE_LARGEUR_TW, type: WidthType.DXA },
    columnWidths: [PAGE_LARGEUR_TW],
    layout: TableLayoutType.FIXED,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: AUCUNE_BORDURE_TABLE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE_LARGEUR_TW, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: CREME },
            borders: AUCUNE_BORDURE,
            margins: { top: pt(28), bottom: pt(24), left: MARGE_TW, right: MARGE_TW },
            children: [
              new Paragraph({
                spacing: { after: pt(18) },
                children: [
                  new ImageRun({
                    type: 'png',
                    data: Buffer.from(LOGO_VILLA_YOGA_BASE64, 'base64'),
                    transformation: { width: LOGO_LARGEUR_PX, height: LOGO_HAUTEUR_PX },
                    altText: { name: 'Logo Villa Yoga', title: 'Logo Villa Yoga', description: 'Logo Villa Yoga' },
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: pt(fsTitre * 1.2), lineRule: LineRuleType.EXACT },
                children: [new TextRun({ text: recette.titre, bold: true, size: Math.round(fsTitre * 2) })],
              }),
            ],
          }),
        ],
      }),
    ],
  })

  // ── Liste des ingrédients (une seule liste, en colonnes si besoin) ──
  const largeursIngredients = largeursEgales(colonnes)

  const listeIngredients =
    ingredients.length === 0
      ? new Paragraph({
          indent: { left: MARGE_TW, right: MARGE_TW },
          children: [new TextRun({ text: 'Aucun ingrédient renseigné', italics: true, size: Math.round(fsIngredients * 2) })],
        })
      : tableauAvecMarges(
          largeursIngredients,
          repartir(ingredients, colonnes).map(
            (colonne, c) =>
              new TableCell({
                width: { size: largeursIngredients[c], type: WidthType.DXA },
                borders: AUCUNE_BORDURE,
                margins: { top: 0, bottom: 0, left: 0, right: pt(8) },
                children:
                  colonne.length > 0
                    ? colonne.map(
                        (nom) =>
                          new Paragraph({
                            numbering: { reference: 'tirets', level: 0 },
                            spacing: { before: 0, after: 0, line: pt(fsIngredients * INTERLIGNE), lineRule: LineRuleType.EXACT },
                            children: [new TextRun({ text: nom, size: Math.round(fsIngredients * 2) })],
                          })
                      )
                    : [new Paragraph({ children: [] })],
              })
          )
        )

  // ── Encadré des allergènes ──
  const encadreAllergenes = tableauAvecMarges(
    [LARGEUR_UTILE_TW],
    [
      new TableCell({
        width: { size: LARGEUR_UTILE_TW, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: CREME },
        borders: AUCUNE_BORDURE,
        margins: { top: pt(10), bottom: pt(10), left: pt(14), right: pt(14) },
        children: [
          new Paragraph({
            spacing: { line: pt(FS_ALLERGENES * 1.5), lineRule: LineRuleType.EXACT },
            children: [new TextRun({ text: texteAllergenes, bold: true, size: FS_ALLERGENES * 2 })],
          }),
        ],
      }),
    ]
  )

  const doc = new Document({
    creator: 'Carnet de recettes',
    title: `Fiche ingrédients - ${recette.titre}`,
    compatibility: { version: 15 },
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    numbering: {
      config: [
        {
          reference: 'tirets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '–',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: pt(RETRAIT_TIRET_PT), hanging: pt(RETRAIT_TIRET_PT) } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_LARGEUR_TW, height: PAGE_HAUTEUR_TW },
            margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 },
          },
        },
        children: [
          bandeau,
          espace(26),
          libelle('INGRÉDIENTS'),
          listeIngredients,
          espace(20),
          libelle('ALLERGÈNES'),
          encadreAllergenes,
          espace(1),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const { ascii, utf8 } = nomFichier(recette.titre)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${ascii}.docx"; filename*=UTF-8''${encodeURIComponent(utf8)}.docx`,
    },
  })
}
