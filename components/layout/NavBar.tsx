'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Leaf, Settings, Upload } from 'lucide-react'

const navItems = [
  { href: '/',            label: 'Recettes',     icon: BookOpen },
  { href: '/ingredients', label: 'Ingrédients',  icon: Leaf     },
  { href: '/import',      label: 'Import',       icon: Upload   },
  { href: '/parametrage', label: 'Paramétrage',  icon: Settings },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg text-primary">
          <span className="text-2xl">🍽️</span>
          <span className="hidden sm:inline">Carnet de Recettes</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
