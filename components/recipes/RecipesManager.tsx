'use client'
import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { formatNumber } from '@/lib/utils'

interface Product {
  id: string
  name: string
  code: string
  unit: string
}

interface RawMaterial {
  id: string
  name: string
  code: string
  unit: string
}

interface Recipe {
  id: string
  product_id: string
  raw_material_id: string
  quantity_required: number
  unit: string
  created_at: string
  products: Product | null
  raw_materials: RawMaterial | null
}

interface Props {
  initialRecipes: Recipe[]
  products: Product[]
  rawMaterials: RawMaterial[]
}

interface FormState {
  product_id: string
  raw_material_id: string
  quantity_required: string
  unit: string
}

const UNITS = ['kg', 'g', 'L', 'mL', 'pièce', 'unité']

export default function RecipesManager({ initialRecipes, products, rawMaterials }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [form, setForm] = useState<FormState>({
    product_id: '',
    raw_material_id: '',
    quantity_required: '',
    unit: 'kg',
  })
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [serverError, setServerError] = useState('')

  // Group recipes by product
  const byProduct = useMemo(() => {
    const map = new Map<string, Recipe[]>()
    for (const r of recipes) {
      const pid = r.product_id
      if (!map.has(pid)) map.set(pid, [])
      map.get(pid)!.push(r)
    }
    return map
  }, [recipes])

  function toggleProduct(productId: string) {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  function openCreate() {
    setEditingRecipe(null)
    setForm({ product_id: '', raw_material_id: '', quantity_required: '', unit: 'kg' })
    setErrors({})
    setServerError('')
    setModalOpen(true)
  }

  function openEdit(recipe: Recipe) {
    setEditingRecipe(recipe)
    setForm({
      product_id: recipe.product_id,
      raw_material_id: recipe.raw_material_id,
      quantity_required: String(recipe.quantity_required),
      unit: recipe.unit,
    })
    setErrors({})
    setServerError('')
    setModalOpen(true)
  }

  function validate(): boolean {
    const e: Partial<FormState> = {}
    if (!form.product_id) e.product_id = 'Produit requis'
    if (!form.raw_material_id) e.raw_material_id = 'Matière première requise'
    if (!form.quantity_required || isNaN(Number(form.quantity_required)) || Number(form.quantity_required) <= 0)
      e.quantity_required = 'Quantité invalide'
    if (!form.unit) e.unit = 'Unité requise'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setServerError('')
    try {
      if (editingRecipe) {
        const res = await fetch(`/api/recipes/${editingRecipe.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity_required: Number(form.quantity_required),
            unit: form.unit,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setServerError(data.error); return }
        setRecipes((prev) => prev.map((r) => (r.id === editingRecipe.id ? data : r)))
      } else {
        const res = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: form.product_id,
            raw_material_id: form.raw_material_id,
            quantity_required: Number(form.quantity_required),
            unit: form.unit,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setServerError(data.error); return }
        setRecipes((prev) => [data, ...prev])
        setExpandedProducts((prev) => new Set(prev).add(form.product_id))
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(recipe: Recipe) {
    if (!confirm(`Supprimer ${recipe.raw_materials?.name} de la recette ?`)) return
    setDeletingId(recipe.id)
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error)
        return
      }
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id))
    } finally {
      setDeletingId(null)
    }
  }

  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))
  const rmOptions = rawMaterials.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))
  const unitOptions = UNITS.map((u) => ({ value: u, label: u }))

  // Products that have at least one recipe or all products for display
  const productList = products.filter((p) => byProduct.has(p.id))
  const noRecipes = productList.length === 0

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Ajouter un ingrédient
        </Button>
      </div>

      {noRecipes ? (
        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Aucune recette. Cliquez sur &quot;Ajouter un ingrédient&quot; pour commencer.
        </div>
      ) : (
        <div className="space-y-3">
          {productList.map((product) => {
            const lines = byProduct.get(product.id) ?? []
            const expanded = expandedProducts.has(product.id)
            return (
              <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleProduct(product.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-medium text-gray-900">{product.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{product.code}</span>
                  </div>
                  <span className="text-sm text-gray-500">{lines.length} ingrédient{lines.length > 1 ? 's' : ''}</span>
                </button>
                {expanded && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-gray-100 bg-white">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Matière première</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qté / unité produit</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{r.raw_materials?.name}</td>
                          <td className="px-4 py-2 text-gray-500">{r.raw_materials?.code}</td>
                          <td className="px-4 py-2 text-right text-gray-900">{formatNumber(r.quantity_required)}</td>
                          <td className="px-4 py-2 text-gray-500">{r.unit}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(r)}
                                className="p-1.5 rounded text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                disabled={deletingId === r.id}
                                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRecipe ? 'Modifier l\'ingrédient' : 'Ajouter un ingrédient'}
        size="md"
      >
        <div className="space-y-4">
          {serverError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {serverError}
            </div>
          )}
          <Select
            label="Produit fini"
            options={productOptions}
            placeholder="Sélectionner un produit"
            value={form.product_id}
            onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
            error={errors.product_id}
            disabled={!!editingRecipe}
          />
          <Select
            label="Matière première"
            options={rmOptions}
            placeholder="Sélectionner une matière"
            value={form.raw_material_id}
            onChange={(e) => setForm((f) => ({ ...f, raw_material_id: e.target.value }))}
            error={errors.raw_material_id}
            disabled={!!editingRecipe}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantité par unité produit"
              type="number"
              min="0"
              step="0.0001"
              value={form.quantity_required}
              onChange={(e) => setForm((f) => ({ ...f, quantity_required: e.target.value }))}
              error={errors.quantity_required}
              placeholder="ex: 0.5"
            />
            <Select
              label="Unité"
              options={unitOptions}
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              error={errors.unit}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingRecipe ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
