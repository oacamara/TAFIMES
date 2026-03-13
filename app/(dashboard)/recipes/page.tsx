import { createClient } from '@/lib/supabase/server'
import RecipesManager from '@/components/recipes/RecipesManager'

export default async function RecipesPage() {
  const supabase = await createClient()

  const [{ data: recipes }, { data: products }, { data: rawMaterials }] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, products(id, name, code, unit), raw_materials(id, name, code, unit)')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, name, code, unit')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('raw_materials')
      .select('id, name, code, unit')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recettes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gérez les matières premières requises par produit fini
        </p>
      </div>
      <RecipesManager
        initialRecipes={recipes ?? []}
        products={products ?? []}
        rawMaterials={rawMaterials ?? []}
      />
    </div>
  )
}
