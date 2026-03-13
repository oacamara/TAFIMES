import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await params

    // Fetch the order to get product_id and planned_quantity
    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select('id, product_id, planned_quantity, status')
      .eq('id', orderId)
      .single()

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Production order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Fetch all allocations with nested raw_material_lots -> raw_materials join
    const { data: allocations, error: allocationsError } = await supabase
      .from('material_allocations')
      .select(`
        id,
        production_order_id,
        raw_material_lot_id,
        quantity_allocated,
        allocated_by,
        created_at,
        raw_material_lots (
          id,
          lot_number,
          available_quantity,
          expiry_date,
          raw_materials (
            id,
            name,
            code,
            unit
          )
        )
      `)
      .eq('production_order_id', orderId)

    if (allocationsError) {
      return NextResponse.json({ error: allocationsError.message }, { status: 500 })
    }

    // Fetch recipe requirements for the product
    const { data: recipe, error: recipeError } = await supabase
      .from('product_recipes')
      .select('id, raw_material_id, quantity_required, raw_materials ( id, name, code, unit )')
      .eq('product_id', order.product_id)

    if (recipeError) {
      return NextResponse.json({ error: recipeError.message }, { status: 500 })
    }

    // Build a map of raw_material_id -> total quantity_allocated
    const allocatedByMaterial: Record<string, number> = {}
    for (const alloc of allocations ?? []) {
      const rml = alloc.raw_material_lots as { raw_material_id?: string; raw_materials?: { id: string } } | null
      const rawMaterialId =
        (rml?.raw_materials as { id: string } | null)?.id ?? undefined
      if (rawMaterialId) {
        allocatedByMaterial[rawMaterialId] =
          (allocatedByMaterial[rawMaterialId] ?? 0) + (alloc.quantity_allocated ?? 0)
      }
    }

    // Compute theoretical needs and allocated amounts per recipe item
    const recipeRequirements = (recipe ?? []).map((item) => {
      const theoreticalNeed = (item.quantity_required ?? 0) * (order.planned_quantity ?? 0)
      const allocated = allocatedByMaterial[item.raw_material_id] ?? 0
      return {
        recipe_id: item.id,
        raw_material_id: item.raw_material_id,
        raw_material: item.raw_materials,
        quantity_required_per_unit: item.quantity_required,
        theoretical_need: theoreticalNeed,
        quantity_allocated: allocated,
        fulfilled: allocated >= theoreticalNeed,
        fulfillment_pct:
          theoreticalNeed > 0 ? Math.round((allocated / theoreticalNeed) * 10000) / 100 : 0,
      }
    })

    return NextResponse.json({
      order_id: orderId,
      planned_quantity: order.planned_quantity,
      status: order.status,
      allocations: allocations ?? [],
      recipe_requirements: recipeRequirements,
    })
  } catch (err) {
    console.error('GET /api/allocations/[orderId]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
