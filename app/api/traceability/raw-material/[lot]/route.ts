import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lot: string }> }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { lot: lotNumber } = await params

    // Find the raw_material_lot by lot_number, join to raw_materials
    const { data: rawLot, error: rawLotError } = await supabase
      .from('raw_material_lots')
      .select(`
        id,
        lot_number,
        available_quantity,
        expiry_date,
        created_at,
        raw_material_id,
        raw_materials (
          id,
          name,
          code,
          unit
        )
      `)
      .eq('lot_number', lotNumber)
      .single()

    if (rawLotError) {
      if (rawLotError.code === 'PGRST116') {
        return NextResponse.json(
          { error: `Raw material lot '${lotNumber}' not found` },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: rawLotError.message }, { status: 500 })
    }

    // Find lot_traceability entries where raw_material_lot_id matches
    // Join finished lots to production orders and products
    const { data: traceability, error: traceError } = await supabase
      .from('lot_traceability')
      .select(`
        id,
        quantity_used,
        finished_lot_id,
        production_lots (
          id,
          lot_number,
          created_at,
          production_order_id,
          production_orders (
            id,
            order_number,
            status,
            planned_date,
            products (
              id,
              name,
              code,
              unit
            )
          )
        )
      `)
      .eq('raw_material_lot_id', rawLot.id)

    if (traceError) {
      return NextResponse.json({ error: traceError.message }, { status: 500 })
    }

    const productsManufactured = (traceability ?? []).map((trace) => {
      const finishedLot = trace.production_lots as {
        id: string
        lot_number: string
        created_at: string
        production_order_id: string
        production_orders: {
          id: string
          order_number: string
          status: string
          planned_date: string
          products: { id: string; name: string; code: string; unit: string } | null
        } | null
      } | null

      const order = finishedLot?.production_orders ?? null

      return {
        product: order?.products ?? null,
        finished_lot: finishedLot
          ? { id: finishedLot.id, lot_number: finishedLot.lot_number }
          : null,
        order: order
          ? {
              id: order.id,
              order_number: order.order_number,
              status: order.status,
            }
          : null,
        date: order?.planned_date ?? finishedLot?.created_at ?? null,
        quantity_used: trace.quantity_used,
      }
    })

    return NextResponse.json({
      rawMaterial: rawLot.raw_materials,
      lot: {
        id: rawLot.id,
        lot_number: rawLot.lot_number,
        available_quantity: rawLot.available_quantity,
        expiry_date: rawLot.expiry_date,
        created_at: rawLot.created_at,
      },
      productsManufactured,
    })
  } catch (err) {
    console.error('GET /api/traceability/raw-material/[lot]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
