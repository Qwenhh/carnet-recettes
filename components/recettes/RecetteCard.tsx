'use client'

import Link from 'next/link'
import { ClockIcon, UsersIcon } from 'lucide-react'

import type { Recette, Saison } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RecetteCardProps {
  recette: Recette
}

const SAISON_EMOJIS: Record<Saison, string> = {
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
}

function formatTemps(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

export function RecetteCard({ recette }: RecetteCardProps) {
  const tempsTotal =
    (recette.temps_preparation ?? 0) +
    (recette.temps_cuisson ?? 0) +
    (recette.temps_repos ?? 0)

  const techniquesAffichees = recette.techniques.slice(0, 2)
  const techniquesSup = recette.techniques.length - 2

  const allergenesAffichees = recette.allergenes.slice(0, 3)

  return (
    <Link href={`/recettes/${recette.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="h-full transition-shadow hover:shadow-md hover:ring-primary/30">
        <CardHeader>
          <CardTitle className="font-semibold leading-snug">{recette.titre}</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {/* Types de plat */}
          {recette.types_plat.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recette.types_plat.map((type) => (
                <Badge key={type} variant="default">
                  {type}
                </Badge>
              ))}
            </div>
          )}

          {/* Saisons */}
          {recette.saisons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recette.saisons.map((saison) => (
                <span key={saison} className="text-sm" title={saison}>
                  {SAISON_EMOJIS[saison]}
                </span>
              ))}
            </div>
          )}

          {/* Temps + personnes */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {tempsTotal > 0 && (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3.5" />
                {formatTemps(tempsTotal)}
              </span>
            )}
            {recette.nb_personnes != null && (
              <span className="flex items-center gap-1">
                <UsersIcon className="size-3.5" />
                {recette.nb_personnes} pers.
              </span>
            )}
          </div>

          {/* Techniques */}
          {recette.techniques.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {techniquesAffichees.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
              {techniquesSup > 0 && (
                <Badge variant="secondary">+{techniquesSup}</Badge>
              )}
            </div>
          )}

          {/* Allergènes */}
          {allergenesAffichees.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allergenesAffichees.map((a) => (
                <Badge key={a} variant="destructive">
                  {a}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
