import { createClient } from '@/lib/supabase/server'
import { formatNumber, formatDate } from '@/lib/utils'
import { LOSS_TYPE_LABELS } from '@/types'
import TraceabilitySearch from '@/components/reports/TraceabilitySearch'
import { BarChart3 } from 'lucide-react'

export default async function ReportsPage() {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { data: closedOrders },
    { data: lossesByType },
    { data: productionByProduct },
  ] = await Promise.all([
    // Orders with entries for yield report
    supabase
      .from('production_orders')
      .select(`
        id, order_number, planned_quantity, planned_date, status,
        products(name, unit),
        production_entries(produced_quantity, rejected_quantity)
      `)
      .in('status', ['completed', 'closed'])
      .gte('planned_date', thirtyDaysAgo)
      .order('planned_date', { ascending: false }),

    // Losses by category
    supabase
      .from('production_losses')
      .select('loss_type, quantity')
      .gte('created_at', thirtyDaysAgo + 'T00:00:00'),

    // Production by product
    supabase
      .from('production_orders')
      .select(`
        planned_quantity,
        products(name, unit),
        production_entries(produced_quantity)
      `)
      .gte('planned_date', thirtyDaysAgo),
  ])

  // Yield by order
  const yieldData = closedOrders?.map((o) => {
    const entries = Array.isArray(o.production_entries) ? o.production_entries : []
    const produced = entries.reduce((s: number, e: { produced_quantity: number }) => s + (e.produced_quantity || 0), 0)
    const yieldPct = o.planned_quantity > 0 ? (produced / o.planned_quantity) * 100 : 0
    const product = o.products as { name: string; unit: string } | null
    return {
      order_number: o.order_number,
      product_name: product?.name || '—',
      planned: o.planned_quantity,
      produced,
      yield_pct: yieldPct,
      date: o.planned_date,
      unit: product?.unit || 'kg',
    }
  }) || []

  // Losses by category aggregation
  const lossAgg: Record<string, number> = {}
  lossesByType?.forEach((l) => {
    lossAgg[l.loss_type] = (lossAgg[l.loss_type] || 0) + (l.quantity || 0)
  })
  const totalLoss = Object.values(lossAgg).reduce((a, b) => a + b, 0)

  // Production by product aggregation
  const prodByProduct: Record<string, { name: string; unit: string; produced: number }> = {}
  productionByProduct?.forEach((o) => {
    const p = o.products as { name: string; unit: string } | null
    if (!p) return
    if (!prodByProduct[p.name]) prodByProduct[p.name] = { name: p.name, unit: p.unit, produced: 0 }
    const entries = Array.isArray(o.production_entries) ? o.production_entries : []
    entries.forEach((e: { produced_quantity: number }) => {
      prodByProduct[p.name].produced += e.produced_quantity || 0
    })
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
        <p className="text-sm text-gray-500 mt-1">Données des 30 derniers jours</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Production by product */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
            <BarChart3 className="w-4 h-4 text-amber-700" />
            <h2 className="font-semibold text-gray-900">Production par produit (30j)</h2>
          </div>
          <div className="p-4 space-y-3">
            {Object.values(prodByProduct).sort((a, b) => b.produced - a.produced).map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 truncate">{p.name}</span>
                    <span className="text-sm font-bold text-gray-900 ml-2">{formatNumber(p.produced)} {p.unit}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (p.produced / Math.max(...Object.values(prodByProduct).map((x) => x.produced))) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(prodByProduct).length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* Losses by category */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Pertes par catégorie (30j)</h2>
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(lossAgg).map(([type, qty]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {LOSS_TYPE_LABELS[type as keyof typeof LOSS_TYPE_LABELS] || type}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-red-700">{formatNumber(qty)} kg</span>
                      <span className="text-xs text-gray-400">
                        ({totalLoss > 0 ? ((qty / totalLoss) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${totalLoss > 0 ? (qty / totalLoss) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(lossAgg).length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Aucune perte enregistrée</p>
            )}
          </div>
          {totalLoss > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-600">Total pertes: </span>
              <span className="font-bold text-red-700">{formatNumber(totalLoss)} kg</span>
            </div>
          )}
        </div>
      </div>

      {/* Yield by order table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Rendement par ordre (30j)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">N° Ordre</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Produit</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Date</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Planifié</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Produit</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Rendement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {yieldData.map((row) => (
                <tr key={row.order_number} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-xs font-semibold text-gray-900">{row.order_number}</td>
                  <td className="px-6 py-3 text-gray-700">{row.product_name}</td>
                  <td className="px-6 py-3 text-gray-500">{formatDate(row.date)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.planned)} {row.unit}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.produced)} {row.unit}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`font-bold ${row.yield_pct >= 90 ? 'text-green-700' : row.yield_pct >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatNumber(row.yield_pct, 1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {yieldData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Aucune donnée</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Traceability search */}
      <TraceabilitySearch />
    </div>
  )
}
