export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      roles: {
        Row: { id: string; name: string; description: string | null; created_at: string }
        Insert: { id?: string; name: string; description?: string | null }
        Update: { name?: string; description?: string | null }
      }
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          role_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: { id: string; name: string; email: string; role_id?: string | null }
        Update: { name?: string; email?: string; role_id?: string | null }
      }
      production_lines: {
        Row: {
          id: string
          name: string
          code: string | null
          capacity: number | null
          capacity_unit: string | null
          is_active: boolean
          created_at: string
        }
        Insert: { name: string; code?: string | null; capacity?: number | null; capacity_unit?: string | null; is_active?: boolean }
        Update: { name?: string; code?: string | null; capacity?: number | null; is_active?: boolean }
      }
      products: {
        Row: {
          id: string
          name: string
          code: string
          unit: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: { name: string; code: string; unit?: string; description?: string | null; is_active?: boolean }
        Update: { name?: string; code?: string; unit?: string; description?: string | null; is_active?: boolean }
      }
      raw_materials: {
        Row: {
          id: string
          name: string
          code: string
          unit: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: { name: string; code: string; unit?: string; description?: string | null; is_active?: boolean }
        Update: { name?: string; code?: string; unit?: string; description?: string | null; is_active?: boolean }
      }
      recipes: {
        Row: {
          id: string
          product_id: string
          raw_material_id: string
          quantity_required: number
          unit: string
          created_at: string
        }
        Insert: { product_id: string; raw_material_id: string; quantity_required: number; unit?: string }
        Update: { quantity_required?: number; unit?: string }
      }
      raw_material_lots: {
        Row: {
          id: string
          lot_number: string
          raw_material_id: string
          initial_quantity: number
          available_quantity: number
          reception_date: string
          expiry_date: string | null
          supplier: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          lot_number: string
          raw_material_id: string
          initial_quantity: number
          available_quantity: number
          reception_date?: string
          expiry_date?: string | null
          supplier?: string | null
          notes?: string | null
        }
        Update: { available_quantity?: number; expiry_date?: string | null; supplier?: string | null; notes?: string | null }
      }
      production_orders: {
        Row: {
          id: string
          order_number: string
          product_id: string
          line_id: string | null
          planned_quantity: number
          status: 'draft' | 'validated' | 'materials_allocated' | 'in_production' | 'completed' | 'closed'
          planned_date: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          order_number: string
          product_id: string
          line_id?: string | null
          planned_quantity: number
          status?: 'draft' | 'validated' | 'materials_allocated' | 'in_production' | 'completed' | 'closed'
          planned_date: string
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          product_id?: string
          line_id?: string | null
          planned_quantity?: number
          status?: 'draft' | 'validated' | 'materials_allocated' | 'in_production' | 'completed' | 'closed'
          planned_date?: string
          notes?: string | null
        }
      }
      production_lots: {
        Row: { id: string; lot_number: string; production_order_id: string; created_at: string }
        Insert: { lot_number: string; production_order_id: string }
        Update: never
      }
      material_allocations: {
        Row: {
          id: string
          production_order_id: string
          raw_material_lot_id: string
          quantity_allocated: number
          allocated_by: string | null
          allocated_at: string
        }
        Insert: { production_order_id: string; raw_material_lot_id: string; quantity_allocated: number; allocated_by?: string | null }
        Update: { quantity_allocated?: number }
      }
      production_entries: {
        Row: {
          id: string
          production_order_id: string
          start_time: string
          end_time: string | null
          produced_quantity: number
          rejected_quantity: number
          observations: string | null
          entered_by: string | null
          created_at: string
        }
        Insert: {
          production_order_id: string
          start_time: string
          end_time?: string | null
          produced_quantity: number
          rejected_quantity?: number
          observations?: string | null
          entered_by?: string | null
        }
        Update: { end_time?: string | null; produced_quantity?: number; rejected_quantity?: number; observations?: string | null }
      }
      production_losses: {
        Row: {
          id: string
          production_entry_id: string
          loss_type: 'process_loss' | 'scrap' | 'breakage' | 'other'
          quantity: number
          description: string | null
          created_at: string
        }
        Insert: { production_entry_id: string; loss_type: 'process_loss' | 'scrap' | 'breakage' | 'other'; quantity: number; description?: string | null }
        Update: { quantity?: number; description?: string | null }
      }
      stock_movements: {
        Row: {
          id: string
          item_id: string
          item_type: 'product' | 'raw_material'
          lot_id: string | null
          movement_type: 'IN' | 'OUT'
          quantity: number
          reference: string | null
          production_order_id: string | null
          moved_by: string | null
          moved_at: string
        }
        Insert: {
          item_id: string
          item_type: 'product' | 'raw_material'
          lot_id?: string | null
          movement_type: 'IN' | 'OUT'
          quantity: number
          reference?: string | null
          production_order_id?: string | null
          moved_by?: string | null
        }
        Update: never
      }
      lot_traceability: {
        Row: { id: string; finished_lot_id: string; raw_material_lot_id: string; quantity_used: number; created_at: string }
        Insert: { finished_lot_id: string; raw_material_lot_id: string; quantity_used: number }
        Update: never
      }
      audit_logs: {
        Row: { id: string; user_id: string | null; action: string; entity_type: string; entity_id: string | null; details: Json | null; created_at: string }
        Insert: { user_id?: string | null; action: string; entity_type: string; entity_id?: string | null; details?: Json | null }
        Update: never
      }
    }
  }
}
