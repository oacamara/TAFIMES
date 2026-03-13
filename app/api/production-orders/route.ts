import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('production_orders')
      .select(`
        *,
        products ( id, name, code, unit ),
        production_lines ( id, name, code ),
        production_lots ( id, lot_number )
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('GET /api/production-orders:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
    const { product_id, line_id, planned_quantity, planned_date, notes } = body

    if (!product_id || !planned_quantity || !planned_date) {
      return NextResponse.json(
        { error: 'product_id, planned_quantity, and planned_date are required' },
        { status: 400 }
      )
    }

    // Generate order number
    const { data: orderNumberData, error: orderNumberError } = await adminSupabase
      .rpc('generate_order_number')

    if (orderNumberError) {
      return NextResponse.json({ error: 'Failed to generate order number' }, { status: 500 })
    }

    const order_number = orderNumberData as string

    // Insert production order
    const { data: order, error: orderError } = await adminSupabase
      .from('production_orders')
      .insert({
        order_number,
        product_id,
        line_id: line_id ?? null,
        planned_quantity,
        planned_date,
        notes: notes ?? null,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Generate lot number
    const { data: lotNumberData, error: lotNumberError } = await adminSupabase
      .rpc('generate_lot_number')

    if (lotNumberError) {
      return NextResponse.json({ error: 'Failed to generate lot number' }, { status: 500 })
    }

    const lot_number = lotNumberData as string

    // Insert production lot
    const { data: lot, error: lotError } = await adminSupabase
      .from('production_lots')
      .insert({
        lot_number,
        production_order_id: order.id,
      })
      .select()
      .single()

    if (lotError) {
      return NextResponse.json({ error: lotError.message }, { status: 500 })
    }

    // Log to audit_logs
    await adminSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'create_order',
      entity_type: 'production_orders',
      entity_id: order.id,
      details: { order_number, lot_number },
    })

    return NextResponse.json({ ...order, production_lots: [lot] }, { status: 201 })
  } catch (err) {
    console.error('POST /api/production-orders:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
