import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Route appelée par le cron Vercel tous les jours
// pour éviter la mise en veille automatique de Supabase (free tier)

export async function GET() {
  const { error } = await supabase
    .from('recettes')
    .select('id')
    .limit(1)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, date: new Date().toISOString() })
}
