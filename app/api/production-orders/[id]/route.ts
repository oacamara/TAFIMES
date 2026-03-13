import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type OrderStatus = 'draft' | 'validated' | 'materials_allocated' | 'in_production' | 'completed' | 'closed'

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['validated'],
  validated: ['materials_allocated', 'draft'],
  materials_allocated: ['in_production', 'validated'],
  in_production: ['completed'],
  completed: ['closed'],
  closed: [],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data, error } = await supabase
      .from('production_orders')
      .select(`
        *,
        products ( id, name, code, unit ),
        production_lines ( id, name, code ),
        production_lots ( id, lot_number ),
        profiles!production_orders_created_by_fkey ( id, name, email )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('GET /api/production-orders/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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

    const { id } = await params
    const body = await request.json()
    const { product_id, line_id, planned_quantity, planned_date, notes, status } = body

    // Fetch current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('production_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Validate status transition if status is being changed
    if (status && status !== currentOrder.status) {
      const allowedTransitions = VALID_TRANSITIONS[currentOrder.status as OrderStatus] ?? []
      if (!allowedTransitions.includes(status as OrderStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from '${currentOrder.status}' to '${status}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
          },
          { status: 422 }
        )
      }
    }

    const updatePayload: Record<string, unknown> = {}
    if (product_id !== undefined) updatePayload.product_id = product_id
    if (line_id !== undefined) updatePayload.line_id = line_id
    if (planned_quantity !== undefined) updatePayload.planned_quantity = planned_quantity
    if (planned_date !== undefined) updatePayload.planned_date = planned_date
    if (notes !== undefined) updatePayload.notes = notes
    if (status !== undefined) updatePayload.status = status

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updatedOrder, error: updateError } = await adminSupabase
      .from('production_orders')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        products ( id, name, code, unit ),
        production_lines ( id, name, code ),
        production_lots ( id, lot_number )
      `)
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log status changes to audit
    if (status && status !== currentOrder.status) {
      await adminSupabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'update_order_status',
        entity_type: 'production_orders',
        entity_id: id,
        details: { from: currentOrder.status, to: status },
      })
    }

    return NextResponse.json(updatedOrder)
  } catch (err) {
    console.error('PUT /api/production-orders/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
