'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
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

export function BoutonSupprimer({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  async function supprimer() {
    setLoading(true)
    const { error } = await supabase.from('recettes').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
      setLoading(false)
      return
    }
    toast.success('Recette supprimée')
    router.push('/')
    router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm" disabled={loading}>
            <Trash2Icon className="size-4" />
            Supprimer
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette recette ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. La recette sera définitivement supprimée.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={supprimer}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
