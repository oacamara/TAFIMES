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

    // Find the production lot by lot_number, join to production_order and product
    const { data: productionLot, error: lotError } = await supabase
      .from('production_lots')
      .select(`
        id,
        lot_number,
        production_order_id,
        created_at,
        production_orders (
          id,
          order_number,
          status,
          planned_quantity,
          planned_date,
          products (
            id,
            name,
            code,
            unit
          )
        )
      `)
      .eq('lot_number', lotNumber)
      .single()

    if (lotError) {
      if (lotError.code === 'PGRST116') {
        return NextResponse.json(
          { error: `Finished lot '${lotNumber}' not found` },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: lotError.message }, { status: 500 })
    }

    // Find lot_traceability entries for this finished lot, join to raw_material_lots and raw_materials
    const { data: traceability, error: traceError } = await supabase
      .from('lot_traceability')
      .select(`
        id,
        quantity_used,
        raw_material_lot_id,
        raw_material_lots (
          id,
          lot_number,
          expiry_date,
          raw_material_id,
          raw_materials (
            id,
            name,
            code,
            unit
          )
        )
      `)
      .eq('finished_lot_id', productionLot.id)

    if (traceError) {
      return NextResponse.json({ error: traceError.message }, { status: 500 })
    }

    const order = productionLot.production_orders as {
      id: string
      order_number: string
      status: string
      planned_quantity: number
      planned_date: string
      products: { id: string; name: string; code: string; unit: string } | null
    } | null

    const rawMaterialsUsed = (traceability ?? []).map((trace) => {
      const rml = trace.raw_material_lots as {
        id: string
        lot_number: string
        expiry_date: string | null
        raw_material_id: string
        raw_materials: { id: string; name: string; code: string; unit: string } | null
      } | null

      return {
        material: rml?.raw_materials ?? null,
        lot_number: rml?.lot_number ?? null,
        lot_id: trace.raw_material_lot_id,
        expiry_date: rml?.expiry_date ?? null,
        quantity_used: trace.quantity_used,
      }
    })

    return NextResponse.json({
      lot: {
        id: productionLot.id,
        lot_number: productionLot.lot_number,
        created_at: productionLot.created_at,
      },
      order: order
        ? {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            planned_quantity: order.planned_quantity,
            planned_date: order.planned_date,
          }
        : null,
      product: order?.products ?? null,
      rawMaterialsUsed,
    })
  } catch (err) {
    console.error('GET /api/traceability/finished-lot/[lot]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
