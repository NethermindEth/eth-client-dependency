'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/libraries', label: 'Libraries' },
  { href: '/clients', label: 'Clients' },
  { href: '/ecosystems', label: 'Ecosystems' },
  { href: '/native', label: 'Native Deps' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border sticky top-0 z-10 bg-bg/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-8 h-14">
          <span className="font-bold text-text tracking-tight">
            eth-dependency
          </span>
          <nav className="flex items-center gap-1">
            {LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname === link.href
                    ? 'bg-surface text-text'
                    : 'text-muted hover:text-text'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
