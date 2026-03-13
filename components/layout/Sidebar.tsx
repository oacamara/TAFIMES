'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Factory,
  BarChart3,
  Settings,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Ordres de Production', href: '/orders', icon: ClipboardList },
  { label: 'Recettes', href: '/recipes', icon: BookOpen },
  { label: 'Allocation Matières', href: '/allocations', icon: Package },
  { label: 'Saisie Production', href: '/production', icon: Factory },
  { label: 'Rapports', href: '/reports', icon: BarChart3 },
  { label: 'Admin', href: '/admin', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-gray-200 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
        <span className="text-2xl" aria-hidden="true">🏭</span>
        <span className="text-lg font-bold text-amber-800 tracking-tight">TAFIMES MES</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navigation principale">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  isActive ? 'text-amber-700' : 'text-gray-400',
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
