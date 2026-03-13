import { createClient } from '@/lib/supabase/server'
import NewOrderForm from '@/components/orders/NewOrderForm'

export default async function NewOrderPage() {
  const supabase = await createClient()

  const [{ data: products }, { data: lines }] = await Promise.all([
    supabase.from('products').select('id, name, code, unit').eq('is_active', true).order('name'),
    supabase.from('production_lines').select('id, name, code').eq('is_active', true).order('name'),
  ])

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nouvel Ordre de Production</h1>
        <p className="text-sm text-gray-500 mt-1">Remplissez les informations pour créer un ordre</p>
      </div>
      <NewOrderForm products={products || []} lines={lines || []} />
    </div>
  )
}
