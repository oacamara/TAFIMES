import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatDate } from '@/lib/utils'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types'
import {
  Factory,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Dashboard data queries in parallel
  const [
    { data: activeOrdersData },
    { data: todayEntriesData },
    { data: recentOrders },
    { data: closedOrders },
  ] = await Promise.all([
    supabase
      .from('production_orders')
      .select('id, status')
      .in('status', ['validated', 'materials_allocated', 'in_production']),
    supabase
      .from('production_entries')
      .select('produced_quantity, rejected_quantity, production_losses(quantity)')
      .gte('created_at', today + 'T00:00:00'),
    supabase
      .from('production_orders')
      .select(`
        id, order_number, status, planned_date, planned_quantity,
        products(name, unit)
      `)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('production_orders')
      .select('planned_quantity, production_entries(produced_quantity)')
      .eq('status', 'closed')
      .gte('planned_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
  ])

  const todayProduction = todayEntriesData?.reduce((sum, e) => sum + (e.produced_quantity || 0), 0) ?? 0
  const activeOrders = activeOrdersData?.length ?? 0
  const todayLosses = todayEntriesData?.reduce((sum, e) => {
    const losses = Array.isArray(e.production_losses)
      ? e.production_losses.reduce((ls: number, l: { quantity: number }) => ls + (l.quantity || 0), 0)
      : 0
    return sum + losses
  }, 0) ?? 0

  let avgYield = 0
  if (closedOrders && closedOrders.length > 0) {
    const yields = closedOrders
      .map((o) => {
        const planned = o.planned_quantity || 0
        const entries = Array.isArray(o.production_entries) ? o.production_entries : []
        const produced = entries.reduce((s: number, e: { produced_quantity: number }) => s + (e.produced_quantity || 0), 0)
        return planned > 0 ? (produced / planned) * 100 : 0
      })
      .filter((y) => y > 0)
    avgYield = yields.length > 0 ? yields.reduce((a, b) => a + b, 0) / yields.length : 0
  }

  const stats = [
    {
      label: 'Production du jour',
      value: `${formatNumber(todayProduction)} kg`,
      icon: Factory,
      color: 'bg-amber-50 text-amber-700',
      iconBg: 'bg-amber-100',
    },
    {
      label: 'Ordres actifs',
      value: String(activeOrders),
      icon: ClipboardList,
      color: 'bg-blue-50 text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      label: 'Pertes du jour',
      value: `${formatNumber(todayLosses)} kg`,
      icon: TrendingDown,
      color: 'bg-red-50 text-red-700',
      iconBg: 'bg-red-100',
    },
    {
      label: 'Rendement moyen (30j)',
      value: `${formatNumber(avgYield, 1)}%`,
      icon: TrendingUp,
      color: 'bg-green-50 text-green-700',
      iconBg: 'bg-green-100',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {formatDate(new Date().toISOString(), 'EEEE d MMMM yyyy')} – Vue d&apos;ensemble de la production
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                  <Icon className={`w-5 h-5 ${stat.color.split(' ')[1]}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Ordres récents</h2>
          <Link
            href="/orders"
            className="text-sm text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            Voir tous <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">N° Ordre</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders?.map((order) => {
                const product = order.products as { name: string; unit: string } | null
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs font-medium text-gray-900">{order.order_number}</td>
                    <td className="px-6 py-3 text-gray-700">{product?.name || '-'}</td>
                    <td className="px-6 py-3 text-right text-gray-700">
                      {formatNumber(order.planned_quantity)} {product?.unit || 'kg'}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{formatDate(order.planned_date)}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-amber-700 hover:text-amber-800 text-xs font-medium"
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {(!recentOrders || recentOrders.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Aucun ordre de production
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
