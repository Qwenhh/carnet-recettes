import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'carnet_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const expected = process.env.ACCESS_PASSWORD

  if (!expected) {
    return NextResponse.json({ error: 'Mot de passe non configuré' }, { status: 500 })
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, 'ok', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}
