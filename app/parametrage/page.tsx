'use client'

import * as React from 'react'
import { PlusIcon, PencilIcon, Trash2Icon, CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import type { TypeListe } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface Item {
  id: string
  nom: string
  type: TypeListe
}

const SECTIONS: { type: TypeListe; label: string; description: string }[] = [
  { type: 'allergene', label: 'Allergènes', description: '14 allergènes réglementaires européens + vos ajouts' },
  { type: 'type_plat', label: 'Types de plat', description: 'Entrée, plat, dessert, sauce…' },
  { type: 'technique', label: 'Techniques', description: 'Snacké, braisé, basse température…' },
  { type: 'contrainte_alimentaire', label: 'Contraintes alimentaires', description: 'Sans gluten, vegan…' },
  { type: 'famille_ingredient', label: "Familles d'ingrédients", description: 'Légume, viande, poisson…' },
]

function SectionListe({
  type,
  label,
  description,
  items,
  onRefresh,
}: {
  type: TypeListe
  label: string
  description: string
  items: Item[]
  onRefresh: () => void
}) {
  const [nouveauNom, setNouveauNom] = React.useState('')
  const [ajoutEnCours, setAjoutEnCours] = React.useState(false)
  const [edition, setEdition] = React.useState<{ id: string; nom: string } | null>(null)

  async function ajouter() {
    if (!nouveauNom.trim()) return
    const { error } = await supabase
      .from('listes_reference')
      .insert({ nom: nouveauNom.trim(), type })
    if (error) { toast.error('Erreur lors de l\'ajout'); return }
    toast.success('Élément ajouté')
    setNouveauNom('')
    setAjoutEnCours(false)
    onRefresh()
  }

  async function sauvegarderEdition() {
    if (!edition || !edition.nom.trim()) return
    const { error } = await supabase
      .from('listes_reference')
      .update({ nom: edition.nom.trim() })
      .eq('id', edition.id)
    if (error) { toast.error('Erreur lors de la modification'); return }
    toast.success('Élément modifié')
    setEdition(null)
    onRefresh()
  }

  async function supprimer(id: string) {
    const { error } = await supabase.from('listes_reference').delete().eq('id', id)
    if (error) { toast.error('Erreur lors de la suppression'); return }
    toast.success('Élément supprimé')
    onRefresh()
  }

  const liste = items.filter((i) => i.type === type)

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-semibold">{label}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAjoutEnCours(true)}
          className="shrink-0"
        >
          <PlusIcon className="size-4" />
          Ajouter
        </Button>
      </div>

      {/* Formulaire ajout */}
      {ajoutEnCours && (
        <div className="mb-3 flex gap-2">
          <Input
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            placeholder="Nouveau nom…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouter() } }}
            autoFocus
          />
          <Button size="icon" onClick={ajouter}>
            <CheckIcon className="size-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => { setAjoutEnCours(false); setNouveauNom('') }}>
            <XIcon className="size-4" />
          </Button>
        </div>
      )}

      {/* Liste */}
      {liste.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun élément.</p>
      ) : (
        <ul className="space-y-1">
          {liste.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/40">
              {edition?.id === item.id ? (
                <>
                  <Input
                    value={edition.nom}
                    onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                    className="h-7 flex-1 text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sauvegarderEdition() } }}
                    autoFocus
                  />
                  <Button size="icon" className="size-7" onClick={sauvegarderEdition}>
                    <CheckIcon className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" className="size-7" onClick={() => setEdition(null)}>
                    <XIcon className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{item.nom}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => setEdition({ id: item.id, nom: item.nom })}
                  >
                    <PencilIcon className="size-3.5 text-muted-foreground" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button size="icon" variant="ghost" className="size-7">
                          <Trash2Icon className="size-3.5 text-muted-foreground" />
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer «&nbsp;{item.nom}&nbsp;» ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette valeur sera retirée de la liste. Les recettes qui l'utilisent déjà ne seront pas modifiées.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => supprimer(item.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function PageParametrage() {
  const [items, setItems] = React.useState<Item[]>([])
  const [loading, setLoading] = React.useState(true)

  async function charger() {
    setLoading(true)
    const { data } = await supabase
      .from('listes_reference')
      .select('*')
      .order('nom')
    setItems((data as Item[]) ?? [])
    setLoading(false)
  }

  React.useEffect(() => { charger() }, [])

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Paramétrage</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Gérez les listes de valeurs utilisées dans vos recettes.
      </p>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map(({ type, label, description }) => (
            <SectionListe
              key={type}
              type={type}
              label={label}
              description={description}
              items={items}
              onRefresh={charger}
            />
          ))}
        </div>
      )}
    </div>
  )
}
