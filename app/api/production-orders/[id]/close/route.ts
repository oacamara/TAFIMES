import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orderId } = await params

    // Step 1: Get current order
    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select('*, production_lots ( id, lot_number ), products ( id, name, code )')
      .eq('id', orderId)
      .single()

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    if (order.status === 'closed') {
      return NextResponse.json({ error: 'Order is already closed' }, { status: 400 })
    }

    if (!['completed', 'in_production'].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot close an order with status '${order.status}'` },
        { status: 422 }
      )
    }

    // Step 2: Check order has production entries
    const { data: productionEntries, error: entriesError } = await supabase
      .from('production_entries')
      .select('id, produced_quantity, rejected_quantity')
      .eq('production_order_id', orderId)

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    if (!productionEntries || productionEntries.length === 0) {
      return NextResponse.json(
        { error: 'Cannot close order: no production entries found' },
        { status: 400 }
      )
    }

    // Step 3: Get all material allocations with raw_material_lot details
    const { data: allocations, error: allocationsError } = await supabase
      .from('material_allocations')
      .select(`
        id,
        raw_material_lot_id,
        quantity_allocated,
        raw_material_lots ( id, lot_number, raw_material_id )
      `)
      .eq('production_order_id', orderId)

    if (allocationsError) {
      return NextResponse.json({ error: allocationsError.message }, { status: 500 })
    }

    // Step 4: Get production losses
    const entryIds = productionEntries.map((e) => e.id)
    const { data: losses, error: lossesError } = await supabase
      .from('production_losses')
      .select('id, quantity, loss_type')
      .in('production_entry_id', entryIds)

    if (lossesError) {
      return NextResponse.json({ error: lossesError.message }, { status: 500 })
    }

    // Step 5: Calculate totals
    const totalProduced = productionEntries.reduce(
      (sum, e) => sum + (e.produced_quantity ?? 0),
      0
    )
    const totalRawUsed = (allocations ?? []).reduce(
      (sum, a) => sum + (a.quantity_allocated ?? 0),
      0
    )
    const yieldPct =
      order.planned_quantity > 0
        ? Math.round((totalProduced / order.planned_quantity) * 10000) / 100
        : 0

    // Get the finished lot
    const finishedLot = order.production_lots?.[0]
    if (!finishedLot) {
      return NextResponse.json(
        { error: 'No production lot associated with this order' },
        { status: 400 }
      )
    }

    // Step 6: Create stock movements
    const stockMovements = []

    // OUT movements for each raw material allocation
    for (const allocation of allocations ?? []) {
      const rml = allocation.raw_material_lots as { id: string; lot_number: string; raw_material_id: string } | null
      if (!rml) continue

      stockMovements.push({
        item_id: rml.raw_material_id,
        item_type: 'raw_material' as const,
        lot_id: allocation.raw_material_lot_id,
        movement_type: 'OUT' as const,
        quantity: allocation.quantity_allocated,
        reference: order.order_number,
        production_order_id: orderId,
        moved_by: user.id,
      })
    }

    // IN movement for produced finished lot
    stockMovements.push({
      item_id: order.product_id,
      item_type: 'product' as const,
      lot_id: finishedLot.id,
      movement_type: 'IN' as const,
      quantity: totalProduced,
      reference: order.order_number,
      production_order_id: orderId,
      moved_by: user.id,
    })

    if (stockMovements.length > 0) {
      const { error: movementsError } = await adminSupabase
        .from('stock_movements')
        .insert(stockMovements)

      if (movementsError) {
        return NextResponse.json({ error: movementsError.message }, { status: 500 })
      }
    }

    // Step 7: Create lot_traceability entries
    const traceabilityEntries = (allocations ?? [])
      .filter((a) => a.raw_material_lot_id)
      .map((a) => ({
        finished_lot_id: finishedLot.id,
        raw_material_lot_id: a.raw_material_lot_id,
        quantity_used: a.quantity_allocated,
      }))

    if (traceabilityEntries.length > 0) {
      const { error: traceError } = await adminSupabase
        .from('lot_traceability')
        .insert(traceabilityEntries)

      if (traceError) {
        return NextResponse.json({ error: traceError.message }, { status: 500 })
      }
    }

    // Step 8: Update order status to 'closed'
    const { error: closeError } = await adminSupabase
      .from('production_orders')
      .update({ status: 'closed' })
      .eq('id', orderId)

    if (closeError) {
      return NextResponse.json({ error: closeError.message }, { status: 500 })
    }

    // Step 9: Log to audit_logs
    await adminSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'close_order',
      entity_type: 'production_orders',
      entity_id: orderId,
      details: {
        order_number: order.order_number,
        totalProduced,
        totalRawUsed,
        yield: yieldPct,
      },
    })

    // Step 10: Return result
    return NextResponse.json({
      success: true,
      yield: yieldPct,
      totalProduced,
      totalRawUsed,
    })
  } catch (err) {
    console.error('POST /api/production-orders/[id]/close:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
