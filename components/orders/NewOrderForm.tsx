'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Product, ProductionLine } from '@/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props {
  products: Product[]
  lines: ProductionLine[]
}

export default function NewOrderForm({ products, lines }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    product_id: '',
    line_id: '',
    planned_quantity: '',
    planned_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product_id || !form.planned_quantity || !form.planned_date) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          planned_quantity: parseFloat(form.planned_quantity),
          line_id: form.line_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création')
      toast.success(`Ordre ${data.order_number} créé avec succès`)
      router.push(`/orders/${data.id}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produit fini <span className="text-red-500">*</span>
          </label>
          <select
            name="product_id"
            value={form.product_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Sélectionner un produit…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Production line */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ligne de production
          </label>
          <select
            name="line_id"
            value={form.line_id}
            onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Sélectionner une ligne (optionnel)…</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} {l.code ? `(${l.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Planned quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantité prévue (kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="planned_quantity"
            value={form.planned_quantity}
            onChange={handleChange}
            required
            min="0.01"
            step="0.01"
            placeholder="ex: 1000"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Planned date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date planifiée <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="planned_date"
            value={form.planned_date}
            onChange={handleChange}
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Informations complémentaires…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/orders"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="ml-auto inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Création…
              </>
            ) : (
              'Créer l\'ordre'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
