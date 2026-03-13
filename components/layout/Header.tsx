'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        // Prefer display name from metadata, fall back to email
        const displayName =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email ??
          null
        setUserName(displayName)
      }
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
      {/* Page title */}
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>

      {/* User info + logout */}
      <div className="flex items-center gap-4">
        {userName && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <span>{userName}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Se déconnecter"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {loggingOut ? 'Déconnexion…' : 'Déconnexion'}
        </button>
      </div>
    </header>
  )
}
