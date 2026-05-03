import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'carnet_auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Laisser passer : page de login, API de login, assets statiques
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/ping') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Vérifier le cookie d'authentification
  const auth = request.cookies.get(COOKIE_NAME)?.value
  if (auth === 'ok') {
    return NextResponse.next()
  }

  // Rediriger vers la page de login
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
