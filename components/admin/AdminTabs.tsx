'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatNumber } from '@/lib/utils'
import { ROLE_LABELS } from '@/types'
import type { Product, RawMaterial, ProductionLine, RawMaterialLot } from '@/types'
import { Plus, Trash2, Package } from 'lucide-react'

interface Profile {
  id: string
  name: string
  email: string
  roles: { name: string } | null
}

interface Role {
  id: string
  name: string
}

interface Props {
  products: Product[]
  rawMaterials: RawMaterial[]
  lines: ProductionLine[]
  users: Profile[]
  roles: Role[]
  rawMaterialLots: (RawMaterialLot & { raw_materials: { name: string } | null })[]
}

type Tab = 'products' | 'materials' | 'lines' | 'lots' | 'users'

export default function AdminTabs({ products, rawMaterials, lines, users, roles, rawMaterialLots }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const router = useRouter()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'products', label: 'Produits finis' },
    { key: 'materials', label: 'Matières premières' },
    { key: 'lines', label: 'Lignes production' },
    { key: 'lots', label: 'Lots matières' },
    { key: 'users', label: 'Utilisateurs' },
  ]

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === t.key
                ? 'bg-white text-amber-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'products' && <ProductsTab products={products} onRefresh={() => router.refresh()} />}
      {activeTab === 'materials' && <MaterialsTab materials={rawMaterials} onRefresh={() => router.refresh()} />}
      {activeTab === 'lines' && <LinesTab lines={lines} onRefresh={() => router.refresh()} />}
      {activeTab === 'lots' && <LotsTab lots={rawMaterialLots} materials={rawMaterials} onRefresh={() => router.refresh()} />}
      {activeTab === 'users' && <UsersTab users={users} roles={roles} onRefresh={() => router.refresh()} />}
    </div>
  )
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab({ products, onRefresh }: { products: Product[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', unit: 'kg' })
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('products').insert(form)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Produit créé')
    setForm({ name: '', code: '', unit: 'kg' })
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce produit ?')) return
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Produit supprimé')
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Ajouter un produit fini</p>
        <div className="grid grid-cols-3 gap-3">
          <input required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Nom du produit" className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <input required value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))}
            placeholder="Code (ex: PPC-025)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <div className="flex gap-2">
            <select value={form.unit} onChange={(e) => setForm(p => ({ ...p, unit: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="tonne">tonne</option>
              <option value="litre">litre</option>
            </select>
            <button type="submit" disabled={loading}
              className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Code</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Unité</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.code}</td>
                <td className="px-4 py-2.5 text-gray-500">{p.unit}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Materials Tab ────────────────────────────────────────────────────────────
function MaterialsTab({ materials, onRefresh }: { materials: RawMaterial[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', unit: 'kg' })
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('raw_materials').insert(form)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Matière créée')
    setForm({ name: '', code: '', unit: 'kg' })
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette matière ?')) return
    const supabase = createClient()
    const { error } = await supabase.from('raw_materials').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Matière supprimée')
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Ajouter une matière première</p>
        <div className="grid grid-cols-3 gap-3">
          <input required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Nom de la matière" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <input required value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))}
            placeholder="Code (ex: FCB-001)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <div className="flex gap-2">
            <select value={form.unit} onChange={(e) => setForm(p => ({ ...p, unit: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="tonne">tonne</option>
              <option value="litre">litre</option>
            </select>
            <button type="submit" disabled={loading}
              className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Code</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Unité</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {materials.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{m.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{m.code}</td>
                <td className="px-4 py-2.5 text-gray-500">{m.unit}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Lines Tab ────────────────────────────────────────────────────────────────
function LinesTab({ lines, onRefresh }: { lines: ProductionLine[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', capacity: '', capacity_unit: 'kg/h' })
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('production_lines').insert({
      name: form.name,
      code: form.code || null,
      capacity: form.capacity ? parseFloat(form.capacity) : null,
      capacity_unit: form.capacity_unit,
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ligne créée')
    setForm({ name: '', code: '', capacity: '', capacity_unit: 'kg/h' })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Ajouter une ligne de production</p>
        <div className="grid grid-cols-4 gap-3">
          <input required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Nom de la ligne" className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <input value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))}
            placeholder="Code (ex: LB-001)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <div className="flex gap-2">
            <input type="number" value={form.capacity} onChange={(e) => setForm(p => ({ ...p, capacity: e.target.value }))}
              placeholder="Capacité" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            <button type="submit" disabled={loading}
              className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-2 rounded-lg text-sm">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500">Code</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500">Capacité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">{l.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{l.code || '—'}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {l.capacity ? `${formatNumber(l.capacity)} ${l.capacity_unit}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Lots Tab ─────────────────────────────────────────────────────────────────
function LotsTab({ lots, materials, onRefresh }: {
  lots: (RawMaterialLot & { raw_materials: { name: string } | null })[]
  materials: RawMaterial[]
  onRefresh: () => void
}) {
  const [form, setForm] = useState({
    lot_number: '',
    raw_material_id: '',
    initial_quantity: '',
    reception_date: new Date().toISOString().split('T')[0],
    supplier: '',
  })
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const qty = parseFloat(form.initial_quantity)
    const { error } = await supabase.from('raw_material_lots').insert({
      lot_number: form.lot_number,
      raw_material_id: form.raw_material_id,
      initial_quantity: qty,
      available_quantity: qty,
      reception_date: form.reception_date,
      supplier: form.supplier || null,
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Lot créé')
    setForm({ lot_number: '', raw_material_id: '', initial_quantity: '', reception_date: new Date().toISOString().split('T')[0], supplier: '' })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-amber-700" />
          <p className="text-sm font-medium text-gray-700">Réceptionner un lot de matière première</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input required value={form.lot_number} onChange={(e) => setForm(p => ({ ...p, lot_number: e.target.value }))}
            placeholder="N° lot (ex: LMP-20260313-001)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <select required value={form.raw_material_id} onChange={(e) => setForm(p => ({ ...p, raw_material_id: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none">
            <option value="">Matière première…</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>[{m.code}] {m.name}</option>
            ))}
          </select>
          <input required type="number" value={form.initial_quantity} onChange={(e) => setForm(p => ({ ...p, initial_quantity: e.target.value }))}
            placeholder="Quantité (kg)" min="0.01" step="0.01" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <input type="date" value={form.reception_date} onChange={(e) => setForm(p => ({ ...p, reception_date: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <input value={form.supplier} onChange={(e) => setForm(p => ({ ...p, supplier: e.target.value }))}
            placeholder="Fournisseur" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
          <button type="submit" disabled={loading}
            className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Création…' : 'Réceptionner'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500">N° Lot</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Matière</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500">Initial</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500">Disponible</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Réception</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Fournisseur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lots.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-900">{l.lot_number}</td>
                  <td className="px-4 py-2.5 text-gray-700">{l.raw_materials?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{formatNumber(l.initial_quantity)} kg</td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    <span className={l.available_quantity < l.initial_quantity * 0.1 ? 'text-red-600' : 'text-green-700'}>
                      {formatNumber(l.available_quantity)} kg
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(l.reception_date)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{l.supplier || '—'}</td>
                </tr>
              ))}
              {lots.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun lot enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({ users, roles, onRefresh }: { users: Profile[]; roles: Role[]; onRefresh: () => void }) {
  async function handleRoleChange(userId: string, roleId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ role_id: roleId })
      .eq('id', userId)
    if (error) { toast.error(error.message); return }
    toast.success('Rôle mis à jour')
    onRefresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-xs text-gray-500">Nom</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500">Email</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500">Rôle actuel</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500">Changer le rôle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => {
            const roleName = (u.roles as { name: string } | null)?.name || 'operator'
            return (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    {ROLE_LABELS[roleName] || roleName}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    defaultValue={roles.find((r) => r.name === roleName)?.id || ''}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] || r.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
