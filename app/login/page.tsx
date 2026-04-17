'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function PageLogin() {
  const router = useRouter()
  const [password, setPassword] = React.useState('')
  const [visible, setVisible] = React.useState(false)
  const [erreur, setErreur] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setLoading(true)

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setErreur('Code d\'accès incorrect.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* En-tête */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🍽️</div>
          <h1 className="text-2xl font-semibold text-foreground">Carnet de Recettes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accès privé</p>
        </div>

        {/* Formulaire */}
        <form
          onSubmit={soumettre}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-4">
            <Label htmlFor="password" className="mb-1.5 block">
              Code d'accès
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={visible ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {visible
                  ? <EyeOffIcon className="size-4" />
                  : <EyeIcon className="size-4" />
                }
              </button>
            </div>
          </div>

          {erreur && (
            <p className="mb-3 text-sm text-destructive">{erreur}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? 'Vérification…' : 'Entrer'}
          </Button>
        </form>
      </div>
    </div>
  )
}
