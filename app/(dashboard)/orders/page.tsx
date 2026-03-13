import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatDate } from '@/lib/utils'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('production_orders')
    .select(`
      id, order_number, planned_quantity, status, planned_date, created_at,
      products(name, code, unit),
      production_lines(name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordres de Production</h1>
          <p className="text-sm text-gray-500 mt-1">{orders?.length || 0} ordres au total</p>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel ordre
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">N° Ordre</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ligne</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Qté prévue</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date planifiée</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders?.map((order) => {
                const product = order.products as { name: string; code: string; unit: string } | null
                const line = order.production_lines as { name: string } | null
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-xs font-semibold text-gray-900">{order.order_number}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div>
                        <p className="font-medium text-gray-900">{product?.name || '-'}</p>
                        <p className="text-xs text-gray-400">{product?.code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-gray-600">{line?.name || '-'}</td>
                    <td className="px-6 py-3.5 text-right text-gray-700 font-medium">
                      {formatNumber(order.planned_quantity)} {product?.unit || 'kg'}
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">{formatDate(order.planned_date)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-amber-700 hover:text-amber-800 text-xs font-medium hover:underline"
                      >
                        Détails →
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {(!orders || orders.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-400 mb-3">Aucun ordre de production</p>
                    <Link
                      href="/orders/new"
                      className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      Créer le premier ordre
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
