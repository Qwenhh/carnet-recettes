import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Route appelée par le cron Vercel toutes les 5 jours
// pour éviter la mise en veille automatique de Supabase (free tier)

export async function GET(request: Request) {
  // Vérifier que l'appel vient bien de Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('recettes')
    .select('id')
    .limit(1)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, date: new Date().toISOString() })
}
