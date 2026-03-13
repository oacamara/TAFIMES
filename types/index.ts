import type { Database } from './database'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Role = Tables<'roles'>
export type Profile = Tables<'profiles'>
export type ProductionLine = Tables<'production_lines'>
export type Product = Tables<'products'>
export type RawMaterial = Tables<'raw_materials'>
export type Recipe = Tables<'recipes'>
export type RawMaterialLot = Tables<'raw_material_lots'>
export type ProductionOrder = Tables<'production_orders'>
export type ProductionLot = Tables<'production_lots'>
export type MaterialAllocation = Tables<'material_allocations'>
export type ProductionEntry = Tables<'production_entries'>
export type ProductionLoss = Tables<'production_losses'>
export type StockMovement = Tables<'stock_movements'>
export type LotTraceability = Tables<'lot_traceability'>
export type AuditLog = Tables<'audit_logs'>

export type OrderStatus = ProductionOrder['status']
export type LossType = ProductionLoss['loss_type']
export type MovementType = StockMovement['movement_type']

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  materials_allocated: 'Matières allouées',
  in_production: 'En production',
  completed: 'Terminé',
  closed: 'Clôturé',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  validated: 'bg-blue-100 text-blue-700',
  materials_allocated: 'bg-yellow-100 text-yellow-700',
  in_production: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
}

export const LOSS_TYPE_LABELS: Record<LossType, string> = {
  process_loss: 'Perte process',
  scrap: 'Rebut',
  breakage: 'Casse',
  other: 'Autre',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  production_manager: 'Gestionnaire Production',
  stock_manager: 'Gestionnaire Stock',
  operator: 'Opérateur',
}

// Extended types with joins
export type ProductionOrderWithDetails = ProductionOrder & {
  products: Product
  production_lines: ProductionLine | null
  production_lots: ProductionLot[]
  profiles: Profile | null
}

export type MaterialAllocationWithDetails = MaterialAllocation & {
  raw_material_lots: RawMaterialLot & {
    raw_materials: RawMaterial
  }
}

export type RecipeWithMaterial = Recipe & {
  raw_materials: RawMaterial
}

export type ProductionEntryWithLosses = ProductionEntry & {
  production_losses: ProductionLoss[]
}

export type DashboardStats = {
  todayProduction: number
  activeOrders: number
  todayLosses: number
  avgYield: number
}
