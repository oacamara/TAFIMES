import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Build the start of today and the 30-day lookback boundary in ISO format
    const todayStart = `${today}T00:00:00.000Z`
    const todayEnd = `${today}T23:59:59.999Z`
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const thirtyDaysAgoStart = `${thirtyDaysAgo}T00:00:00.000Z`

    // 1. todayProduction: sum of produced_quantity for entries created today
    const { data: todayProductionData, error: todayProdError } = await supabase
      .from('production_entries')
      .select('produced_quantity')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)

    if (todayProdError) {
      return NextResponse.json({ error: todayProdError.message }, { status: 500 })
    }

    const todayProduction = (todayProductionData ?? []).reduce(
      (sum, row) => sum + (row.produced_quantity ?? 0),
      0
    )

    // 2. activeOrders: count of production_orders where status IN ('validated','materials_allocated','in_production')
    const { count: activeOrders, error: activeOrdersError } = await supabase
      .from('production_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['validated', 'materials_allocated', 'in_production'])

    if (activeOrdersError) {
      return NextResponse.json({ error: activeOrdersError.message }, { status: 500 })
    }

    // 3. todayLosses: sum of production_losses.quantity for entries created today
    // Join through production_entries to filter by date
    const { data: todayEntriesForLosses, error: entriesForLossesError } = await supabase
      .from('production_entries')
      .select('id')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)

    if (entriesForLossesError) {
      return NextResponse.json({ error: entriesForLossesError.message }, { status: 500 })
    }

    const todayEntryIds = (todayEntriesForLosses ?? []).map((e) => e.id)

    let todayLosses = 0
    if (todayEntryIds.length > 0) {
      const { data: lossesData, error: lossesError } = await supabase
        .from('production_losses')
        .select('quantity')
        .in('production_entry_id', todayEntryIds)

      if (lossesError) {
        return NextResponse.json({ error: lossesError.message }, { status: 500 })
      }

      todayLosses = (lossesData ?? []).reduce(
        (sum, row) => sum + (row.quantity ?? 0),
        0
      )
    }

    // 4. avgYield: average of (produced_quantity / planned_quantity * 100)
    //    for completed/closed orders in the last 30 days
    const { data: closedOrdersData, error: closedOrdersError } = await supabase
      .from('production_orders')
      .select('id, planned_quantity')
      .in('status', ['completed', 'closed'])
      .gte('updated_at', thirtyDaysAgoStart)

    if (closedOrdersError) {
      return NextResponse.json({ error: closedOrdersError.message }, { status: 500 })
    }

    let avgYield = 0
    if (closedOrdersData && closedOrdersData.length > 0) {
      const orderIds = closedOrdersData.map((o) => o.id)

      const { data: entriesForYield, error: entriesForYieldError } = await supabase
        .from('production_entries')
        .select('production_order_id, produced_quantity')
        .in('production_order_id', orderIds)

      if (entriesForYieldError) {
        return NextResponse.json({ error: entriesForYieldError.message }, { status: 500 })
      }

      // Sum produced_quantity per order
      const producedByOrder: Record<string, number> = {}
      for (const entry of entriesForYield ?? []) {
        const oid = entry.production_order_id
        producedByOrder[oid] = (producedByOrder[oid] ?? 0) + (entry.produced_quantity ?? 0)
      }

      const yieldValues = closedOrdersData
        .filter((o) => (o.planned_quantity ?? 0) > 0)
        .map((o) => ((producedByOrder[o.id] ?? 0) / o.planned_quantity) * 100)

      if (yieldValues.length > 0) {
        avgYield =
          Math.round(
            (yieldValues.reduce((sum, v) => sum + v, 0) / yieldValues.length) * 100
          ) / 100
      }
    }

    // 5. recentOrders: last 5 production_orders with product name
    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from('production_orders')
      .select(`
        id,
        order_number,
        status,
        planned_quantity,
        planned_date,
        created_at,
        products ( id, name, code )
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentOrdersError) {
      return NextResponse.json({ error: recentOrdersError.message }, { status: 500 })
    }

    return NextResponse.json({
      todayProduction,
      activeOrders: activeOrders ?? 0,
      todayLosses,
      avgYield,
      recentOrders: recentOrders ?? [],
    })
  } catch (err) {
    console.error('GET /api/dashboard:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
