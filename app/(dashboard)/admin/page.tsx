import { createClient } from '@/lib/supabase/server'
import AdminTabs from '@/components/admin/AdminTabs'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, roles(name)')
    .eq('id', user.id)
    .single()

  const role = (profile?.roles as { name: string } | null)?.name
  if (role !== 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Accès réservé aux administrateurs</p>
      </div>
    )
  }

  const [
    { data: products },
    { data: rawMaterials },
    { data: lines },
    { data: users },
    { data: roles },
    { data: rawMaterialLots },
  ] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('raw_materials').select('*').order('name'),
    supabase.from('production_lines').select('*').order('name'),
    supabase.from('profiles').select('*, roles(name)').order('name'),
    supabase.from('roles').select('*').order('name'),
    supabase.from('raw_material_lots').select('*, raw_materials(name)').order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Gestion du référentiel et des utilisateurs</p>
      </div>
      <AdminTabs
        products={products || []}
        rawMaterials={rawMaterials || []}
        lines={lines || []}
        users={users || []}
        roles={roles || []}
        rawMaterialLots={rawMaterialLots || []}
      />
    </div>
  )
}
