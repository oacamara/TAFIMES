import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface LossItem {
  loss_type: string
  quantity: number
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      production_order_id,
      start_time,
      end_time,
      produced_quantity,
      rejected_quantity,
      observations,
      losses,
    } = body

    if (!production_order_id || produced_quantity == null) {
      return NextResponse.json(
        { error: 'production_order_id and produced_quantity are required' },
        { status: 400 }
      )
    }

    // Validate order exists and has an acceptable status
    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select('id, status')
      .eq('id', production_order_id)
      .single()

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Production order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    const allowedStatuses = ['in_production', 'materials_allocated']
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Cannot create a production entry for an order with status '${order.status}'. Order must be in: ${allowedStatuses.join(', ')}`,
        },
        { status: 422 }
      )
    }

    // If status is 'materials_allocated', advance to 'in_production'
    if (order.status === 'materials_allocated') {
      const { error: statusError } = await adminSupabase
        .from('production_orders')
        .update({ status: 'in_production' })
        .eq('id', production_order_id)

      if (statusError) {
        return NextResponse.json({ error: statusError.message }, { status: 500 })
      }
    }

    // Insert production_entry
    const { data: entry, error: entryError } = await adminSupabase
      .from('production_entries')
      .insert({
        production_order_id,
        start_time: start_time ?? null,
        end_time: end_time ?? null,
        produced_quantity,
        rejected_quantity: rejected_quantity ?? 0,
        observations: observations ?? null,
        entered_by: user.id,
      })
      .select()
      .single()

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 500 })
    }

    // Insert production_losses
    let insertedLosses: unknown[] = []
    if (Array.isArray(losses) && losses.length > 0) {
      const lossRows = losses.map((loss: LossItem) => ({
        production_entry_id: entry.id,
        loss_type: loss.loss_type,
        quantity: loss.quantity,
        description: loss.description ?? null,
      }))

      const { data: lossData, error: lossError } = await adminSupabase
        .from('production_losses')
        .insert(lossRows)
        .select()

      if (lossError) {
        return NextResponse.json({ error: lossError.message }, { status: 500 })
      }

      insertedLosses = lossData ?? []
    }

    // Log to audit_logs
    await adminSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'create_production_entry',
      entity_type: 'production_entries',
      entity_id: entry.id,
      details: {
        production_order_id,
        produced_quantity,
        rejected_quantity: rejected_quantity ?? 0,
        losses_count: insertedLosses.length,
      },
    })

    return NextResponse.json(
      { ...entry, production_losses: insertedLosses },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/production-entry:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
