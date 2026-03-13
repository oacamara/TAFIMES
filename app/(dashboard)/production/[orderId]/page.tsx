import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { formatNumber } from '@/lib/utils'
import ProductionEntryForm from '@/components/production/ProductionEntryForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function ProductionEntryPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('production_orders')
    .select('*, products(name, code, unit), production_lots(lot_number)')
    .eq('id', orderId)
    .single()

  if (!order) notFound()
  if (!['materials_allocated', 'in_production'].includes(order.status)) {
    redirect(`/orders/${orderId}`)
  }

  const product = order.products as { name: string; code: string; unit: string } | null
  const lot = Array.isArray(order.production_lots) ? order.production_lots[0] : null

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/orders/${orderId}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;ordre
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Saisie de Production</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
          <span>{order.order_number}</span>
          <span>·</span>
          <span>{product?.name}</span>
          <span>·</span>
          <span>Prévu: {formatNumber(order.planned_quantity)} {product?.unit}</span>
          {lot && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{lot.lot_number}</span>}
        </div>
      </div>

      <ProductionEntryForm orderId={orderId} product={product} />
    </div>
  )
}
