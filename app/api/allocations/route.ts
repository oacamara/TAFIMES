import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { production_order_id, raw_material_lot_id, quantity_allocated } = body

    if (!production_order_id || !raw_material_lot_id || quantity_allocated == null) {
      return NextResponse.json(
        { error: 'production_order_id, raw_material_lot_id, and quantity_allocated are required' },
        { status: 400 }
      )
    }

    if (quantity_allocated <= 0) {
      return NextResponse.json(
        { error: 'quantity_allocated must be greater than zero' },
        { status: 400 }
      )
    }

    // Check raw_material_lot has enough available_quantity
    const { data: rawLot, error: rawLotError } = await supabase
      .from('raw_material_lots')
      .select('id, lot_number, available_quantity, raw_material_id')
      .eq('id', raw_material_lot_id)
      .single()

    if (rawLotError) {
      if (rawLotError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Raw material lot not found' }, { status: 404 })
      }
      return NextResponse.json({ error: rawLotError.message }, { status: 500 })
    }

    if ((rawLot.available_quantity ?? 0) < quantity_allocated) {
      return NextResponse.json(
        {
          error: `Insufficient stock: available ${rawLot.available_quantity}, requested ${quantity_allocated}`,
        },
        { status: 422 }
      )
    }

    // Check production_order status allows allocation
    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select('id, status, product_id, planned_quantity')
      .eq('id', production_order_id)
      .single()

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Production order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    const allocatableStatuses = ['validated', 'materials_allocated']
    if (!allocatableStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Cannot allocate materials to an order with status '${order.status}'. Order must be in: ${allocatableStatuses.join(', ')}`,
        },
        { status: 422 }
      )
    }

    // Upsert into material_allocations
    const { data: allocation, error: allocationError } = await adminSupabase
      .from('material_allocations')
      .upsert(
        {
          production_order_id,
          raw_material_lot_id,
          quantity_allocated,
          allocated_by: user.id,
        },
        { onConflict: 'production_order_id,raw_material_lot_id' }
      )
      .select()
      .single()

    if (allocationError) {
      return NextResponse.json({ error: allocationError.message }, { status: 500 })
    }

    // Decrement raw_material_lots.available_quantity
    const { error: decrementError } = await adminSupabase
      .from('raw_material_lots')
      .update({ available_quantity: (rawLot.available_quantity ?? 0) - quantity_allocated })
      .eq('id', raw_material_lot_id)

    if (decrementError) {
      return NextResponse.json({ error: decrementError.message }, { status: 500 })
    }

    // Check if all recipe requirements are met
    const { data: recipe, error: recipeError } = await supabase
      .from('product_recipes')
      .select('raw_material_id, quantity_required')
      .eq('product_id', order.product_id)

    if (!recipeError && recipe && recipe.length > 0) {
      // Get current allocations for this order (grouped by raw_material_id via lot join)
      const { data: currentAllocations } = await supabase
        .from('material_allocations')
        .select('quantity_allocated, raw_material_lots ( raw_material_id )')
        .eq('production_order_id', production_order_id)

      // Build a map of raw_material_id -> total allocated
      const allocatedMap: Record<string, number> = {}
      for (const alloc of currentAllocations ?? []) {
        const rml = alloc.raw_material_lots as { raw_material_id: string } | null
        if (!rml) continue
        const rmId = rml.raw_material_id
        allocatedMap[rmId] = (allocatedMap[rmId] ?? 0) + (alloc.quantity_allocated ?? 0)
      }

      // Check each recipe requirement
      const allMet = recipe.every((item) => {
        const required = item.quantity_required * order.planned_quantity
        const allocated = allocatedMap[item.raw_material_id] ?? 0
        return allocated >= required
      })

      if (allMet && order.status === 'validated') {
        await adminSupabase
          .from('production_orders')
          .update({ status: 'materials_allocated' })
          .eq('id', production_order_id)
      }
    }

    // Log to audit_logs
    await adminSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'create_allocation',
      entity_type: 'material_allocations',
      entity_id: allocation.id,
      details: {
        production_order_id,
        raw_material_lot_id,
        quantity_allocated,
        lot_number: rawLot.lot_number,
      },
    })

    return NextResponse.json(allocation, { status: 201 })
  } catch (err) {
    console.error('POST /api/allocations:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
