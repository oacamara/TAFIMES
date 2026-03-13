import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatDate } from '@/lib/utils'
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/types'
import Link from 'next/link'
import { Play } from 'lucide-react'

export default async function ProductionPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('production_orders')
    .select('id, order_number, planned_quantity, status, planned_date, products(name, unit)')
    .in('status', ['materials_allocated', 'in_production'])
    .order('planned_date', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Saisie de Production</h1>
        <p className="text-sm text-gray-500 mt-1">Ordres prêts pour la saisie atelier</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders?.map((order) => {
          const product = order.products as { name: string; unit: string } | null
          return (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                <span className="text-xs text-gray-400">{formatDate(order.planned_date)}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{product?.name}</h3>
              <p className="text-xs font-mono text-gray-500 mb-3">{order.order_number}</p>
              <p className="text-2xl font-bold text-amber-700 mb-4">
                {formatNumber(order.planned_quantity)} <span className="text-sm font-normal text-gray-500">{product?.unit}</span>
              </p>
              <Link
                href={`/production/${order.id}`}
                className="flex items-center justify-center gap-2 w-full bg-amber-700 hover:bg-amber-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                Saisir production
              </Link>
            </div>
          )
        })}
        {(!orders || orders.length === 0) && (
          <div className="col-span-3 text-center py-12 text-gray-400">
            Aucun ordre en attente de saisie
          </div>
        )}
      </div>
    </div>
  )
}
