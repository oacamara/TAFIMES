'use client'

import { useState } from 'react'
import { formatNumber, formatDate } from '@/lib/utils'
import { Search } from 'lucide-react'

interface FinishedLotTrace {
  lot: { lot_number: string }
  order: { order_number: string; planned_date: string }
  product: { name: string }
  rawMaterialsUsed: Array<{
    material: string
    lot_number: string
    quantity_used: number
    unit: string
  }>
}

interface RawMaterialTrace {
  rawMaterial: { name: string }
  lot: { lot_number: string; reception_date: string }
  productsManufactured: Array<{
    product: string
    finished_lot: string
    order: string
    date: string
  }>
}

export default function TraceabilitySearch() {
  const [searchType, setSearchType] = useState<'finished' | 'raw'>('finished')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FinishedLotTrace | RawMaterialTrace | null>(null)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const endpoint = searchType === 'finished'
        ? `/api/traceability/finished-lot/${encodeURIComponent(query.trim())}`
        : `/api/traceability/raw-material/${encodeURIComponent(query.trim())}`

      const res = await fetch(endpoint)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lot non trouvé')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Traçabilité des lots</h2>
      </div>
      <div className="p-6">
        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <select
            value={searchType}
            onChange={(e) => { setSearchType(e.target.value as 'finished' | 'raw'); setResult(null); setError('') }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="finished">Lot produit fini (LPF-…)</option>
            <option value="raw">Lot matière première (LMP-…)</option>
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchType === 'finished' ? 'ex: LPF-20260312-001' : 'ex: LMP-20260301-001'}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Recherche…' : 'Rechercher'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {result && searchType === 'finished' && (() => {
          const r = result as FinishedLotTrace
          return (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">Lot produit fini</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Numéro lot</p>
                    <p className="font-mono font-bold">{r.lot?.lot_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Ordre de production</p>
                    <p className="font-mono">{r.order?.order_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Produit</p>
                    <p className="font-medium">{r.product?.name}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Matières premières utilisées :</p>
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">Matière</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">Lot</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">Quantité utilisée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {r.rawMaterialsUsed?.map((m, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">{m.material}</td>
                        <td className="px-4 py-2 font-mono text-xs">{m.lot_number}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(m.quantity_used)} {m.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {result && searchType === 'raw' && (() => {
          const r = result as RawMaterialTrace
          return (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 mb-2">Lot matière première</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Matière</p>
                    <p className="font-medium">{r.rawMaterial?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Numéro lot</p>
                    <p className="font-mono font-bold">{r.lot?.lot_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date réception</p>
                    <p>{r.lot?.reception_date ? formatDate(r.lot.reception_date) : '—'}</p>
                  </div>
                </div>
              </div>
              {r.productsManufactured?.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Produits fabriqués avec ce lot :</p>
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-gray-500">Produit</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500">Lot fini</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500">Ordre</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {r.productsManufactured.map((p, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">{p.product}</td>
                          <td className="px-4 py-2 font-mono text-xs">{p.finished_lot}</td>
                          <td className="px-4 py-2 font-mono text-xs">{p.order}</td>
                          <td className="px-4 py-2 text-gray-500">{p.date ? formatDate(p.date) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Ce lot n&apos;a pas encore été utilisé en production</p>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
