import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

import { supabase } from '@/lib/supabase'
import { mapRecetteAny } from '@/lib/mappers'

// ─── V2 (expérimentale) ─────────────────────────────────────────────────────
// Copie indépendante de la V1 (app/api/recettes/[id]/fiche-technique) —
// ne pas toucher à la V1 en modifiant ce fichier. Ajoute un tableau de
// coût de revient avec formules Excel pré-remplies : il ne reste qu'à
// saisir le prix au kg de chaque ingrédient.

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuree(min: number | null): string {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function nomFichier(titre: string): string {
  const nettoye = titre.replace(/[\\/:*?"<>|]/g, '-').trim()
  return `FT_${nettoye}_V2.xlsx`
}

// Extrait un nombre d'une quantité saisie en texte libre : "200" → 200,
// "1/2" → 0.5, "1,5" → 1.5. Retourne null si non interprétable (ex: "QS").
function parserQuantiteNumerique(quantite: string): number | null {
  const nettoye = quantite.trim().replace(',', '.')
  const fraction = nettoye.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (fraction) {
    const num = parseFloat(fraction[1])
    const den = parseFloat(fraction[2])
    if (den) return num / den
  }
  const val = parseFloat(nettoye)
  return isNaN(val) ? null : val
}

const BORDURE_FINE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
}

const FORMAT_EUROS = '#,##0.00" €"'

// ─── Route ──────────────────────────────────────────────────────────────────

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

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Carnet de recettes'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Fiche technique V2', {
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'portrait' },
  })

  sheet.columns = [
    { key: 'A', width: 52 },
    { key: 'B', width: 2 },
    { key: 'C', width: 26 },
    { key: 'D', width: 8 },
    { key: 'E', width: 10 },
    { key: 'F', width: 14 },
    { key: 'G', width: 12 },
  ]

  let r = 1

  // ── Appellation ──
  sheet.mergeCells(`A${r}:E${r}`)
  const cAppellation = sheet.getCell(`A${r}`)
  cAppellation.value = `Appellation : ${recette.titre}`
  cAppellation.font = { bold: true, size: 13 }
  cAppellation.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }
  cAppellation.alignment = { vertical: 'middle' }
  sheet.getRow(r).height = 22
  r += 2

  // ── Descriptif ──
  if (recette.descriptif) {
    const cLabel = sheet.getCell(`A${r}`)
    cLabel.value = 'Descriptif :'
    cLabel.font = { bold: true, underline: true }
    r += 1
    sheet.mergeCells(`A${r}:E${r}`)
    const cVal = sheet.getCell(`A${r}`)
    cVal.value = recette.descriptif
    cVal.alignment = { wrapText: true, vertical: 'top' }
    r += 2
  }

  // ── Allergènes + Coût / Coeff / Prix (vides) ──
  const rAllergenes = r
  sheet.mergeCells(`A${rAllergenes}:B${rAllergenes + 2}`)
  const cAllerg = sheet.getCell(`A${rAllergenes}`)
  cAllerg.value = {
    richText: [
      { text: 'Allergènes : ', font: { bold: true, underline: true } },
      { text: recette.allergenes.join(', ') || 'aucun' },
    ],
  }
  cAllerg.alignment = { wrapText: true, vertical: 'top' }

  const champsCout = ['Coût matières total HT :', 'Coeff multiplicateur', 'Prix de vente / Portion HT']
  champsCout.forEach((label, i) => {
    const row = rAllergenes + i
    const cLabel = sheet.getCell(`C${row}`)
    cLabel.value = label
    cLabel.font = { bold: true, underline: true }
    sheet.mergeCells(`D${row}:E${row}`)
    sheet.getCell(`D${row}`).border = BORDURE_FINE
  })
  r = rAllergenes + 4

  // ── Temps ──
  const temps: [string, string][] = [
    ['Temps de préparation', formatDuree(recette.temps_preparation)],
    ['Temps de cuisson', formatDuree(recette.temps_cuisson)],
    ['Temps de repos', formatDuree(recette.temps_repos)],
  ]
  for (const [label, val] of temps) {
    const cLabel = sheet.getCell(`A${r}`)
    cLabel.value = label
    cLabel.font = { bold: true }
    cLabel.alignment = { horizontal: 'right' }
    cLabel.border = BORDURE_FINE
    const cVal = sheet.getCell(`B${r}`)
    cVal.value = val
    cVal.border = BORDURE_FINE
    r += 1
  }
  r += 1

  // ── En-tête du tableau Techniques / Denrées ──
  const rEntete = r
  sheet.getCell(`A${rEntete}`).value = 'TECHNIQUES'
  sheet.getCell(`A${rEntete}`).font = { bold: true }
  sheet.getCell(`C${rEntete}`).value = 'NATURE'
  sheet.getCell(`C${rEntete}`).font = { bold: true }
  sheet.getCell(`D${rEntete}`).value = 'U'
  sheet.getCell(`D${rEntete}`).font = { bold: true }
  sheet.getCell(`E${rEntete}`).value = 'Quantité'
  sheet.getCell(`E${rEntete}`).font = { bold: true }
  ;['A', 'C', 'D', 'E'].forEach((col) => {
    sheet.getCell(`${col}${rEntete}`).border = { bottom: { style: 'medium' } }
  })
  r += 1
  const rDebutTableau = r

  // ── Colonne Techniques ──
  let rEtapes = rDebutTableau
  const sectionsEtapes = recette.etapes_sections.filter((s) => s.etapes.length > 0)
  const plusieursSectionsEtapes = sectionsEtapes.length > 1
  sectionsEtapes.forEach((section, si) => {
    if (section.nom || plusieursSectionsEtapes) {
      const cTitre = sheet.getCell(`A${rEtapes}`)
      cTitre.value = section.nom ? `${si + 1}/ ${section.nom}` : `${si + 1}/`
      cTitre.font = { bold: true }
      cTitre.border = BORDURE_FINE
      rEtapes += 1
    }
    for (const etape of section.etapes) {
      const c = sheet.getCell(`A${rEtapes}`)
      c.value = `- ${etape}`
      c.alignment = { wrapText: true, vertical: 'top' }
      c.border = BORDURE_FINE
      rEtapes += 1
    }
  })

  // ── Colonnes Denrées (Nature / U / Quantité) ──
  let rIngr = rDebutTableau
  const groupesIngr = new Map<string, typeof recette.ingredients>()
  const ordreGroupes: string[] = []
  for (const ri of recette.ingredients) {
    const g = ri.groupe ?? ''
    if (!groupesIngr.has(g)) { groupesIngr.set(g, []); ordreGroupes.push(g) }
    groupesIngr.get(g)!.push(ri)
  }
  const plusieursGroupesIngr = ordreGroupes.filter((g) => g).length > 0 && ordreGroupes.length > 1

  for (const g of ordreGroupes) {
    if (g && plusieursGroupesIngr) {
      const cTitre = sheet.getCell(`C${rIngr}`)
      cTitre.value = g
      cTitre.font = { bold: true, underline: true }
      ;['C', 'D', 'E'].forEach((col) => { sheet.getCell(`${col}${rIngr}`).border = BORDURE_FINE })
      rIngr += 1
    }
    for (const ri of groupesIngr.get(g)!) {
      sheet.getCell(`C${rIngr}`).value = ri.ingredient.nom
      sheet.getCell(`D${rIngr}`).value = ri.unite
      const cQte = sheet.getCell(`E${rIngr}`)
      cQte.numFmt = '@' // texte : évite qu'Excel transforme "1/4" en date
      cQte.value = ri.quantite
      ;['C', 'D', 'E'].forEach((col) => { sheet.getCell(`${col}${rIngr}`).border = BORDURE_FINE })
      rIngr += 1
    }
  }

  // La colonne la plus courte (étapes ou ingrédients) reçoit des cases vides
  // bordées jusqu'à la hauteur de l'autre, pour garder un tableau visuellement carré
  const rFin = Math.max(rEtapes, rIngr) - 1
  for (let row = rDebutTableau; row <= rFin; row++) {
    if (row >= rEtapes) sheet.getCell(`A${row}`).border = BORDURE_FINE
    if (row >= rIngr) {
      ;['C', 'D', 'E'].forEach((col) => { sheet.getCell(`${col}${row}`).border = BORDURE_FINE })
    }
  }

  // ── ★ NOUVEAU EN V2 : Coût de revient ────────────────────────────────────

  let rc = rFin + 3

  sheet.mergeCells(`C${rc}:G${rc}`)
  const cTitreCout = sheet.getCell(`C${rc}`)
  cTitreCout.value = 'COÛT DE REVIENT'
  cTitreCout.font = { bold: true, size: 12 }
  cTitreCout.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
  sheet.getRow(rc).height = 20
  rc += 1

  const cNote = sheet.getCell(`C${rc}`)
  cNote.value = "Ne reste qu'à remplir le prix au kg (ou au litre pour les liquides) de chaque ingrédient — tout le reste se calcule automatiquement."
  cNote.font = { italic: true, size: 9, color: { argb: 'FF666666' } }
  rc += 2

  const rEnteteCout = rc
  const entetesCout = ['Ingrédient', 'Quantité', 'Unité', 'Prix au kg / litre', 'Coût']
  ;(['C', 'D', 'E', 'F', 'G'] as const).forEach((col, i) => {
    const c = sheet.getCell(`${col}${rEnteteCout}`)
    c.value = entetesCout[i]
    c.font = { bold: true }
    c.border = { bottom: { style: 'medium' } }
  })
  rc += 1

  const rDebutCout = rc
  for (const ri of recette.ingredients) {
    const quantiteNum = parserQuantiteNumerique(ri.quantite)

    sheet.getCell(`C${rc}`).value = ri.ingredient.nom

    const cQte = sheet.getCell(`E${rc}`)
    if (quantiteNum !== null) {
      cQte.value = quantiteNum
    } else {
      cQte.numFmt = '@'
      cQte.value = ri.quantite || ''
    }

    sheet.getCell(`D${rc}`).value = ri.unite

    const cPrix = sheet.getCell(`F${rc}`)
    cPrix.numFmt = FORMAT_EUROS
    // volontairement vide : c'est la seule case à remplir à la main

    // Coût = (quantité convertie en kg ou en litre) × prix au kg/litre.
    // "kg" et "l"/"litre" restent tels quels (déjà dans la bonne unité),
    // "cl" est divisé par 100, tout le reste (g, ml, pièce…) est divisé par
    // 1000. Corrigez la cellule directement si une ligne ne suit pas cette
    // règle (ex: "pièce").
    const cCout = sheet.getCell(`G${rc}`)
    cCout.numFmt = FORMAT_EUROS
    cCout.value = {
      formula: `IF(AND(ISNUMBER(E${rc}), F${rc}<>""), IF(OR(LOWER(D${rc})="kg", LOWER(D${rc})="l", LOWER(D${rc})="litre"), E${rc}, IF(LOWER(D${rc})="cl", E${rc}/100, E${rc}/1000)) * F${rc}, "")`,
    }

    ;['C', 'D', 'E', 'F', 'G'].forEach((col) => { sheet.getCell(`${col}${rc}`).border = BORDURE_FINE })
    rc += 1
  }
  const rFinCout = rc - 1

  rc += 1

  // Nombre de portions (pré-rempli depuis la recette si connu, sinon à saisir)
  const rPortions = rc
  sheet.getCell(`C${rPortions}`).value = 'Nombre de portions'
  sheet.getCell(`C${rPortions}`).font = { bold: true }
  const cPortions = sheet.getCell(`D${rPortions}`)
  cPortions.value = recette.nb_personnes ?? undefined
  cPortions.border = BORDURE_FINE
  rc += 1

  // Coût total matières
  const rTotal = rc
  sheet.getCell(`C${rTotal}`).value = 'Coût total matières'
  sheet.getCell(`C${rTotal}`).font = { bold: true }
  const cTotal = sheet.getCell(`D${rTotal}`)
  cTotal.numFmt = FORMAT_EUROS
  cTotal.font = { bold: true }
  cTotal.value = rFinCout >= rDebutCout ? { formula: `SUM(G${rDebutCout}:G${rFinCout})` } : 0
  rc += 1

  // Coût par portion
  const rParPortion = rc
  sheet.getCell(`C${rParPortion}`).value = 'Coût par portion'
  sheet.getCell(`C${rParPortion}`).font = { bold: true }
  const cParPortion = sheet.getCell(`D${rParPortion}`)
  cParPortion.numFmt = FORMAT_EUROS
  cParPortion.font = { bold: true }
  cParPortion.value = {
    formula: `IFERROR(D${rTotal}/D${rPortions}, "")`,
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nomFichier(recette.titre)}"`,
    },
  })
}
