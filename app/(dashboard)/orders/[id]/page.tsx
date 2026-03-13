import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatNumber, formatDate, formatDateTime, calcYield } from '@/lib/utils'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, LOSS_TYPE_LABELS } from '@/types'
import OrderActions from '@/components/orders/OrderActions'
import Link from 'next/link'
import { ArrowLeft, Package, ClipboardList, Factory } from 'lucide-react'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('production_orders')
    .select(`
      *,
      products(id, name, code, unit),
      production_lines(name, code),
      production_lots(id, lot_number, created_at),
      profiles(name, email)
    `)
    .eq('id', id)
    .single()

  if (!order) notFound()

  const product = order.products as { id: string; name: string; code: string; unit: string } | null

  // Fetch recipe requirements
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, raw_materials(id, name, code, unit)')
    .eq('product_id', product?.id || '')

  // Fetch allocations
  const { data: allocations } = await supabase
    .from('material_allocations')
    .select('*, raw_material_lots(lot_number, raw_materials(name, unit))')
    .eq('production_order_id', id)

  // Fetch production entries with losses
  const { data: entries } = await supabase
    .from('production_entries')
    .select('*, production_losses(*), profiles(name)')
    .eq('production_order_id', id)
    .order('created_at', { ascending: false })

  const lot = Array.isArray(order.production_lots) ? order.production_lots[0] : null
  const line = order.production_lines as { name: string; code: string } | null
  const creator = order.profiles as { name: string; email: string } | null

  const totalProduced = entries?.reduce((s, e) => s + (e.produced_quantity || 0), 0) ?? 0
  const totalRejected = entries?.reduce((s, e) => s + (e.rejected_quantity || 0), 0) ?? 0
  const totalAllocated = allocations?.reduce((s, a) => s + (a.quantity_allocated || 0), 0) ?? 0
  const yieldPct = calcYield(totalProduced, totalAllocated)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/orders" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Retour aux ordres
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            {lot && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                <Package className="w-3 h-3" /> Lot: <span className="font-mono font-medium">{lot.lot_number}</span>
              </span>
            )}
          </div>
        </div>
        <OrderActions order={order} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Produit</p>
          <p className="font-semibold text-gray-900">{product?.name}</p>
          <p className="text-xs text-gray-400">{product?.code}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Quantité prévue</p>
          <p className="font-semibold text-gray-900 text-lg">{formatNumber(order.planned_quantity)} {product?.unit}</p>
          <p className="text-xs text-gray-400">Ligne: {line?.name || 'Non assigné'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Date planifiée</p>
          <p className="font-semibold text-gray-900">{formatDate(order.planned_date)}</p>
          <p className="text-xs text-gray-400">Créé par: {creator?.name || 'Inconnu'}</p>
        </div>
      </div>

      {/* Matières premières (recette + allocations) */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
          <Package className="w-4 h-4 text-amber-700" />
          <h2 className="font-semibold text-gray-900">Matières premières</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Matière</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Besoin théorique</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">Alloué</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Lot</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recipes?.map((r) => {
                const mat = r.raw_materials as { id: string; name: string; code: string; unit: string } | null
                const needed = r.quantity_required * order.planned_quantity
                const alloc = allocations?.filter((a) => {
                  const rml = a.raw_material_lots as { raw_materials: { name: string } } | null
                  return rml?.raw_materials?.name === mat?.name
                })
                const allocatedQty = alloc?.reduce((s, a) => s + a.quantity_allocated, 0) ?? 0
                const isFulfilled = allocatedQty >= needed
                const allocLots = alloc?.map((a) => {
                  const lot = a.raw_material_lots as { lot_number: string } | null
                  return lot?.lot_number
                }).filter(Boolean)

                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{mat?.name}</p>
                      <p className="text-xs text-gray-400">{mat?.unit}</p>
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-700">
                      {formatNumber(needed)} {mat?.unit}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-700">
                      {allocatedQty > 0 ? `${formatNumber(allocatedQty)} ${mat?.unit}` : '—'}
                    </td>
                    <td className="px-6 py-3 text-xs font-mono text-gray-500">
                      {allocLots?.join(', ') || '—'}
                    </td>
                    <td className="px-6 py-3">
                      {allocatedQty === 0 ? (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Non alloué</span>
                      ) : isFulfilled ? (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Complet</span>
                      ) : (
                        <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">Partiel</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(!recipes || recipes.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-gray-400 text-sm">
                    Aucune recette définie pour ce produit
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {order.status === 'validated' && (
          <div className="px-6 py-3 border-t border-gray-200 bg-yellow-50">
            <Link
              href={`/allocations/${id}`}
              className="text-sm text-amber-700 hover:text-amber-800 font-medium"
            >
              → Aller à l&apos;allocation des matières
            </Link>
          </div>
        )}
      </div>

      {/* Production entries */}
      {entries && entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
            <ClipboardList className="w-4 h-4 text-amber-700" />
            <h2 className="font-semibold text-gray-900">Saisies de production</h2>
            <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
              <span>Produit: <strong className="text-gray-900">{formatNumber(totalProduced)} kg</strong></span>
              <span>Rejeté: <strong className="text-red-700">{formatNumber(totalRejected)} kg</strong></span>
              {totalAllocated > 0 && (
                <span>Rendement: <strong className="text-green-700">{formatNumber(yieldPct, 1)}%</strong></span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const operator = entry.profiles as { name: string } | null
              return (
                <div key={entry.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 text-sm">
                        <Factory className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {formatDateTime(entry.start_time)}
                          {entry.end_time && ` → ${formatDateTime(entry.end_time)}`}
                        </span>
                      </div>
                      {entry.observations && (
                        <p className="text-sm text-gray-500 mt-1">{entry.observations}</p>
                      )}
                      {Array.isArray(entry.production_losses) && entry.production_losses.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.production_losses.map((loss: { id: string; loss_type: string; quantity: number; description: string | null }) => (
                            <span key={loss.id} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                              {LOSS_TYPE_LABELS[loss.loss_type as keyof typeof LOSS_TYPE_LABELS]}: {formatNumber(loss.quantity)} kg
                              {loss.description ? ` (${loss.description})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-green-700">{formatNumber(entry.produced_quantity)} kg</p>
                      {entry.rejected_quantity > 0 && (
                        <p className="text-xs text-red-600">Rejeté: {formatNumber(entry.rejected_quantity)} kg</p>
                      )}
                      {operator && (
                        <p className="text-xs text-gray-400 mt-1">{operator.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">Notes</p>
          <p className="text-sm text-amber-700">{order.notes}</p>
        </div>
      )}
    </div>
  )
}
