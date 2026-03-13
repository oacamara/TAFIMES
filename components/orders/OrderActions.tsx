'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import type { OrderStatus } from '@/types'
import { CheckCircle, Play, Package, Lock } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  status: OrderStatus
}

export default function OrderActions({ order }: { order: Order }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function updateStatus(newStatus: OrderStatus) {
    setLoading(newStatus)
    try {
      const res = await fetch(`/api/production-orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success('Statut mis à jour')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(null)
    }
  }

  async function closeOrder() {
    setLoading('close')
    try {
      const res = await fetch(`/api/production-orders/${order.id}/close`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la clôture')
      toast.success(`Ordre clôturé — Rendement: ${data.yield?.toFixed(1)}%`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(null)
    }
  }

  const btnBase = 'inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50'

  return (
    <div className="flex flex-wrap gap-2">
      {order.status === 'draft' && (
        <button
          onClick={() => updateStatus('validated')}
          disabled={loading === 'validated'}
          className={`${btnBase} bg-blue-600 hover:bg-blue-700 text-white`}
        >
          <CheckCircle className="w-4 h-4" />
          {loading === 'validated' ? 'Validation…' : 'Valider'}
        </button>
      )}

      {order.status === 'validated' && (
        <Link
          href={`/allocations/${order.id}`}
          className={`${btnBase} bg-yellow-600 hover:bg-yellow-700 text-white`}
        >
          <Package className="w-4 h-4" />
          Allouer matières
        </Link>
      )}

      {order.status === 'materials_allocated' && (
        <>
          <Link
            href={`/production/${order.id}`}
            className={`${btnBase} bg-orange-600 hover:bg-orange-700 text-white`}
          >
            <Play className="w-4 h-4" />
            Saisir production
          </Link>
        </>
      )}

      {order.status === 'in_production' && (
        <>
          <Link
            href={`/production/${order.id}`}
            className={`${btnBase} bg-orange-600 hover:bg-orange-700 text-white`}
          >
            <Play className="w-4 h-4" />
            Saisir production
          </Link>
          <button
            onClick={() => updateStatus('completed')}
            disabled={loading === 'completed'}
            className={`${btnBase} bg-green-600 hover:bg-green-700 text-white`}
          >
            <CheckCircle className="w-4 h-4" />
            {loading === 'completed' ? '…' : 'Terminer'}
          </button>
        </>
      )}

      {order.status === 'completed' && (
        <button
          onClick={closeOrder}
          disabled={loading === 'close'}
          className={`${btnBase} bg-purple-700 hover:bg-purple-800 text-white`}
        >
          <Lock className="w-4 h-4" />
          {loading === 'close' ? 'Clôture…' : 'Clôturer'}
        </button>
      )}
    </div>
  )
}
