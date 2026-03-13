'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatNumber } from '@/lib/utils'
import type { RawMaterialLot } from '@/types'
import { CheckCircle, AlertCircle } from 'lucide-react'

interface MaterialAlloc {
  raw_material_lots: { id: string; lot_number: string } | null
  quantity_allocated: number
}

interface Requirement {
  recipe: { id: string; raw_material_id: string; quantity_required: number; unit: string }
  material: { id: string; name: string; code: string; unit: string } | null
  needed: number
  allocated: number
  lots: (RawMaterialLot & { raw_materials: { name: string; unit: string } | null })[]
  currentAllocations: MaterialAlloc[]
}

interface Props {
  orderId: string
  requirements: Requirement[]
  orderStatus: string
}

interface RowState {
  lotId: string
  quantity: string
}

export default function AllocationForm({ orderId, requirements, orderStatus }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<Record<string, RowState>>(
    Object.fromEntries(requirements.map((r) => [r.recipe.raw_material_id, { lotId: '', quantity: '' }]))
  )
  const [loading, setLoading] = useState<string | null>(null)

  function setRow(matId: string, field: keyof RowState, value: string) {
    setRows((prev) => ({ ...prev, [matId]: { ...prev[matId], [field]: value } }))
  }

  async function handleAllocate(matId: string) {
    const row = rows[matId]
    if (!row.lotId || !row.quantity || parseFloat(row.quantity) <= 0) {
      toast.error('Sélectionnez un lot et une quantité valide')
      return
    }
    setLoading(matId)
    try {
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_order_id: orderId,
          raw_material_lot_id: row.lotId,
          quantity_allocated: parseFloat(row.quantity),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur allocation')
      toast.success('Matière allouée avec succès')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {requirements.map((req) => {
        const row = rows[req.recipe.raw_material_id] || { lotId: '', quantity: '' }
        const isFulfilled = req.allocated >= req.needed
        const selectedLot = req.lots.find((l) => l.id === row.lotId)

        return (
          <div key={req.recipe.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Material header */}
            <div className={`px-5 py-3 border-b border-gray-200 flex items-center justify-between ${isFulfilled ? 'bg-green-50' : 'bg-amber-50'}`}>
              <div className="flex items-center gap-2">
                {isFulfilled ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span className="font-semibold text-gray-900">{req.material?.name}</span>
                <span className="text-xs text-gray-500">({req.material?.code})</span>
              </div>
              <div className="text-sm text-right">
                <span className="text-gray-500">Besoin: </span>
                <strong>{formatNumber(req.needed)} {req.material?.unit}</strong>
                {req.allocated > 0 && (
                  <span className={`ml-3 ${isFulfilled ? 'text-green-700' : 'text-amber-700'}`}>
                    Alloué: {formatNumber(req.allocated)} {req.material?.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Existing allocations */}
            {req.currentAllocations.length > 0 && (
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Allocations existantes :</p>
                <div className="flex flex-wrap gap-2">
                  {req.currentAllocations.map((a, i) => {
                    const lot = a.raw_material_lots
                    return (
                      <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg">
                        <span className="font-mono">{lot?.lot_number}</span>:{' '}
                        {formatNumber(a.quantity_allocated)} {req.material?.unit}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Allocation form */}
            {!isFulfilled && (
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Lot selector */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs text-gray-500 mb-1">Lot disponible</label>
                    <select
                      value={row.lotId}
                      onChange={(e) => setRow(req.recipe.raw_material_id, 'lotId', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Sélectionner un lot…</option>
                      {req.lots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.lot_number} – Dispo: {formatNumber(lot.available_quantity)} {req.material?.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Quantité ({req.material?.unit})
                      {selectedLot && (
                        <span className="text-gray-400"> · max {formatNumber(selectedLot.available_quantity)}</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={(e) => setRow(req.recipe.raw_material_id, 'quantity', e.target.value)}
                      placeholder={`Reste: ${formatNumber(req.needed - req.allocated)}`}
                      min="0.01"
                      max={selectedLot?.available_quantity}
                      step="0.01"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Action */}
                  <div className="flex items-end">
                    <button
                      onClick={() => handleAllocate(req.recipe.raw_material_id)}
                      disabled={loading === req.recipe.raw_material_id}
                      className="w-full py-2 px-4 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {loading === req.recipe.raw_material_id ? 'Allocation…' : 'Confirmer'}
                    </button>
                  </div>
                </div>

                {req.lots.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠ Aucun lot disponible en stock pour cette matière
                  </p>
                )}
              </div>
            )}

            {isFulfilled && (
              <div className="px-5 py-3 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Besoin en matière satisfait
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
