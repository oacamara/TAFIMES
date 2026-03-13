import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatDate } from '@/lib/utils'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types'
import Link from 'next/link'
import { Package } from 'lucide-react'

export default async function AllocationsPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('production_orders')
    .select('id, order_number, planned_quantity, status, planned_date, products(name, unit)')
    .in('status', ['validated', 'materials_allocated'])
    .order('planned_date', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Allocation des Matières</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ordres en attente d&apos;allocation ou partiellement alloués
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">N° Ordre</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Produit</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Quantité</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders?.map((order) => {
                const product = order.products as { name: string; unit: string } | null
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-gray-900">{order.order_number}</td>
                    <td className="px-6 py-3.5 text-gray-700">{product?.name}</td>
                    <td className="px-6 py-3.5 text-right">{formatNumber(order.planned_quantity)} {product?.unit}</td>
                    <td className="px-6 py-3.5 text-gray-500">{formatDate(order.planned_date)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        href={`/allocations/${order.id}`}
                        className="inline-flex items-center gap-1.5 text-sm bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        <Package className="w-3.5 h-3.5" />
                        Allouer
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {(!orders || orders.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    Aucun ordre en attente d&apos;allocation
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
