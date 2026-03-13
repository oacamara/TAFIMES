import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quantity_required, unit } = body

    if (quantity_required == null) {
      return NextResponse.json({ error: 'quantity_required est requis' }, { status: 400 })
    }

    if (quantity_required <= 0) {
      return NextResponse.json(
        { error: 'quantity_required doit être supérieur à zéro' },
        { status: 400 }
      )
    }

    const { data, error } = await adminSupabase
      .from('recipes')
      .update({ quantity_required, unit })
      .eq('id', id)
      .select('*, products(id, name, code, unit), raw_materials(id, name, code, unit)')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('PUT /api/recipes/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await adminSupabase
      .from('recipes')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/recipes/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
