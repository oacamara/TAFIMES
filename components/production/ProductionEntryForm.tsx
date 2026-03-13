'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LOSS_TYPE_LABELS } from '@/types'
import { Plus, Trash2 } from 'lucide-react'

interface Loss {
  loss_type: string
  quantity: string
  description: string
}

interface Props {
  orderId: string
  product: { name: string; code: string; unit: string } | null
}

export default function ProductionEntryForm({ orderId, product }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const now = new Date()
  const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const [form, setForm] = useState({
    start_time: toLocal(now),
    end_time: '',
    produced_quantity: '',
    rejected_quantity: '',
    observations: '',
  })
  const [losses, setLosses] = useState<Loss[]>([])

  function addLoss() {
    setLosses((prev) => [...prev, { loss_type: 'process_loss', quantity: '', description: '' }])
  }

  function updateLoss(index: number, field: keyof Loss, value: string) {
    setLosses((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  function removeLoss(index: number) {
    setLosses((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.produced_quantity || parseFloat(form.produced_quantity) < 0) {
      toast.error('Quantité produite invalide')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/production-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_order_id: orderId,
          start_time: form.start_time,
          end_time: form.end_time || null,
          produced_quantity: parseFloat(form.produced_quantity),
          rejected_quantity: parseFloat(form.rejected_quantity || '0'),
          observations: form.observations || null,
          losses: losses
            .filter((l) => l.quantity && parseFloat(l.quantity) > 0)
            .map((l) => ({
              loss_type: l.loss_type,
              quantity: parseFloat(l.quantity),
              description: l.description || null,
            })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la saisie')
      toast.success('Saisie de production enregistrée')
      router.push(`/orders/${orderId}`)
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
        {/* Timing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heure début <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
            <input
              type="datetime-local"
              value={form.end_time}
              onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
              min={form.start_time}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Quantities */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité produite ({product?.unit || 'kg'}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.produced_quantity}
              onChange={(e) => setForm((p) => ({ ...p, produced_quantity: e.target.value }))}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg font-bold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité rejetée ({product?.unit || 'kg'})
            </label>
            <input
              type="number"
              value={form.rejected_quantity}
              onChange={(e) => setForm((p) => ({ ...p, rejected_quantity: e.target.value }))}
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Pertes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Pertes déclarées</label>
            <button
              type="button"
              onClick={addLoss}
              className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une perte
            </button>
          </div>

          {losses.length > 0 && (
            <div className="space-y-3 mb-2">
              {losses.map((loss, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <select
                      value={loss.loss_type}
                      onChange={(e) => updateLoss(i, 'loss_type', e.target.value)}
                      className="px-2 py-1.5 text-sm border border-red-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      {Object.entries(LOSS_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={loss.quantity}
                      onChange={(e) => updateLoss(i, 'quantity', e.target.value)}
                      placeholder="Quantité (kg)"
                      min="0.01"
                      step="0.01"
                      className="px-2 py-1.5 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeLoss(i)}
                      className="flex items-center justify-center text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={loss.description}
                    onChange={(e) => updateLoss(i, 'description', e.target.value)}
                    placeholder="Description (ex: problème température, arrêt machine…)"
                    className="w-full px-2 py-1.5 text-sm border border-red-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Observations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
          <textarea
            value={form.observations}
            onChange={(e) => setForm((p) => ({ ...p, observations: e.target.value }))}
            rows={3}
            placeholder="Commentaires, incidents, observations de production…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {loading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Enregistrement…
            </>
          ) : (
            'Enregistrer la saisie'
          )}
        </button>
      </form>
    </div>
  )
}
