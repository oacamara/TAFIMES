import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { formatNumber } from '@/lib/utils'
import AllocationForm from '@/components/allocations/AllocationForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AllocationPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('production_orders')
    .select('*, products(id, name, unit)')
    .eq('id', orderId)
    .single()

  if (!order) notFound()
  if (!['validated', 'materials_allocated'].includes(order.status)) {
    redirect(`/orders/${orderId}`)
  }

  const product = order.products as { id: string; name: string; unit: string } | null

  // Recipe requirements
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, raw_materials(id, name, code, unit)')
    .eq('product_id', product?.id || '')

  // Existing allocations
  const { data: allocations } = await supabase
    .from('material_allocations')
    .select('*, raw_material_lots(id, lot_number, available_quantity, raw_materials(name))')
    .eq('production_order_id', orderId)

  // Available lots for each raw material
  const rawMaterialIds = recipes?.map((r) => r.raw_material_id) || []
  const { data: availableLots } = await supabase
    .from('raw_material_lots')
    .select('*, raw_materials(name, unit)')
    .in('raw_material_id', rawMaterialIds)
    .gt('available_quantity', 0)
    .order('reception_date', { ascending: true })

  const requirementsWithAllocations = recipes?.map((r) => {
    const mat = r.raw_materials as { id: string; name: string; code: string; unit: string } | null
    const needed = r.quantity_required * order.planned_quantity
    const currentAllocs = allocations?.filter((a) => {
      const rml = a.raw_material_lots as { raw_materials: { name: string } } | null
      return rml?.raw_materials?.name === mat?.name
    }) || []
    const allocatedQty = currentAllocs.reduce((s, a) => s + a.quantity_allocated, 0)
    const lots = availableLots?.filter((l) => l.raw_material_id === r.raw_material_id) || []

    return {
      recipe: r,
      material: mat,
      needed,
      allocated: allocatedQty,
      lots,
      currentAllocations: currentAllocs,
    }
  }) || []

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/orders/${orderId}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;ordre
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Allocation des Matières</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ordre {order.order_number} – {product?.name} –{' '}
          {formatNumber(order.planned_quantity)} {product?.unit}
        </p>
      </div>

      <AllocationForm
        orderId={orderId}
        requirements={requirementsWithAllocations}
        orderStatus={order.status}
      />
    </div>
  )
}
