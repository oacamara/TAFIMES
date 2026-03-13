import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('recipes')
      .select('*, products(id, name, code, unit), raw_materials(id, name, code, unit)')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    console.error('GET /api/recipes:', err)
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
    const { product_id, raw_material_id, quantity_required, unit } = body

    if (!product_id || !raw_material_id || quantity_required == null) {
      return NextResponse.json(
        { error: 'product_id, raw_material_id et quantity_required sont requis' },
        { status: 400 }
      )
    }

    if (quantity_required <= 0) {
      return NextResponse.json(
        { error: 'quantity_required doit être supérieur à zéro' },
        { status: 400 }
      )
    }

    const { data, error } = await adminSupabase
      .from('recipes')
      .insert({ product_id, raw_material_id, quantity_required, unit: unit ?? 'kg' })
      .select('*, products(id, name, code, unit), raw_materials(id, name, code, unit)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Cette matière première est déjà dans la recette de ce produit' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('POST /api/recipes:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
