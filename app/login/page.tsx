'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Factory, Eye, EyeOff } from 'lucide-react'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect'
          : error.message
      )
      setLoading(false)
      return
    }
    toast.success('Connexion réussie')
    router.push('/dashboard')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Veuillez saisir votre nom')
      return
    }
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })
    if (error) {
      if (error.status === 500) {
        toast.error('Erreur serveur Supabase. Vérifiez que la migration SQL a été exécutée et que la confirmation email est désactivée dans Supabase Auth.')
      } else if (error.message.includes('already registered')) {
        toast.error('Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.')
      } else {
        toast.error(error.message)
      }
      setLoading(false)
      return
    }
    if (data.user && !data.session) {
      toast.success('Vérifiez votre email pour confirmer votre compte.')
    } else {
      toast.success('Compte créé avec succès ! Vous pouvez vous connecter.')
    }
    setMode('login')
    setPassword('')
    setLoading(false)
  }

  const isLogin = mode === 'login'

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-800 to-amber-600 px-8 py-8 text-white text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 p-3 rounded-full">
              <Factory className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">TAFIMES MES</h1>
          <p className="text-amber-100 text-sm mt-1">Gestion de Production Agroalimentaire</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              isLogin
                ? 'text-amber-800 border-b-2 border-amber-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Se connecter
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !isLogin
                ? 'text-amber-800 border-b-2 border-amber-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Créer un compte
          </button>
        </div>

        {/* Form */}
        <div className="px-8 py-8">
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-5">

            {/* Name field (register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  placeholder="Jean Dupont"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe <span className="text-red-500">*</span>
                {!isLogin && <span className="text-gray-400 font-normal ml-1">(min. 6 caractères)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {isLogin ? 'Connexion...' : 'Création...'}
                </>
              ) : (
                isLogin ? 'Se connecter' : 'Créer mon compte'
              )}
            </button>
          </form>

          {/* Info box for new accounts */}
          {!isLogin && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                <strong>Note :</strong> Les nouveaux comptes ont le rôle <strong>Opérateur</strong> par défaut.
                Un administrateur peut modifier votre rôle dans le panneau d&apos;administration.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            TAFIMES MES v1.0 – Système de Gestion de Production
          </p>
        </div>
      </div>
    </div>
  )
}
