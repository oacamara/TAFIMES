export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/** postgrest-js exige une cle `Relationships` sur chaque table/vue pour que le
 *  schema satisfasse `GenericSchema`. Sans elle, tout `.from()` retourne `never`
 *  et les embeds PostgREST (`select('*, roles(name)')`) ne se resolvent pas.
 *
 *  A remplacer par `supabase gen types typescript` des que la base est a jour :
 *  le generateur produit ces relations automatiquement. */
type FK<Col extends string, Ref extends string> = {
  foreignKeyName: string
  columns: [Col]
  isOneToOne: false
  referencedRelation: Ref
  referencedColumns: ['id']
}

type Relations = {
  profiles: [FK<'role_id', 'roles'>]
  recipes: [FK<'product_id', 'products'>, FK<'raw_material_id', 'raw_materials'>]
  raw_material_lots: [FK<'raw_material_id', 'raw_materials'>]
  production_orders: [
    FK<'product_id', 'products'>,
    FK<'line_id', 'production_lines'>,
    FK<'created_by', 'profiles'>,
  ]
  production_lots: [FK<'production_order_id', 'production_orders'>]
  material_allocations: [
    FK<'production_order_id', 'production_orders'>,
    FK<'raw_material_lot_id', 'raw_material_lots'>,
    FK<'allocated_by', 'profiles'>,
  ]
  production_entries: [
    FK<'production_order_id', 'production_orders'>,
    FK<'entered_by', 'profiles'>,
  ]
  production_losses: [FK<'production_entry_id', 'production_entries'>]
  stock_movements: [
    FK<'production_order_id', 'production_orders'>,
    FK<'moved_by', 'profiles'>,
  ]
  lot_traceability: [
    FK<'finished_lot_id', 'production_lots'>,
    FK<'raw_material_lot_id', 'raw_material_lots'>,
  ]
  audit_logs: [FK<'user_id', 'profiles'>]
  conversations: [FK<'created_by', 'profiles'>]
  conversation_members: [FK<'conversation_id', 'conversations'>, FK<'user_id', 'profiles'>]
  messages: [FK<'conversation_id', 'conversations'>, FK<'sender_id', 'profiles'>]
  message_attachments: [FK<'message_id', 'messages'>]
  push_subscriptions: [FK<'user_id', 'profiles'>]
}

type WithRel<T> = {
  [K in keyof T]: T[K] & {
    Relationships: K extends keyof Relations ? Relations[K] : []
  }
}

export type Database = {
  public: {
    Tables: WithRel<{
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

      // ---------- Messagerie interne ----------
      conversations: {
        Row: {
          id: string
          type: 'channel' | 'dm'
          name: string | null
          slug: string | null
          description: string | null
          visibility: 'public' | 'private'
          dm_key: string | null
          created_by: string | null
          last_message_at: string
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        // Creation via RPC uniquement (create_channel / get_or_create_dm) :
        // l'INSERT direct est revoque pour garantir qu'un canal a toujours un owner.
        Insert: never
        Update: {
          name?: string | null
          description?: string | null
          visibility?: 'public' | 'private'
          archived_at?: string | null
        }
      }
      conversation_members: {
        Row: {
          conversation_id: string
          user_id: string
          role: 'owner' | 'member'
          last_read_at: string
          muted: boolean
          joined_at: string
        }
        Insert: { conversation_id: string; user_id: string; role?: 'owner' | 'member' }
        Update: { last_read_at?: string; muted?: boolean }
      }
      messages: {
        Row: {
          id: string
          seq: number
          conversation_id: string
          sender_id: string
          body: string
          has_attachments: boolean
          created_at: string
          edited_at: string | null
        }
        Insert: {
          conversation_id: string
          sender_id: string
          body?: string
          has_attachments?: boolean
        }
        Update: { body?: string; edited_at?: string | null }
      }
      message_attachments: {
        Row: {
          id: string
          message_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          created_at: string
        }
        Insert: {
          message_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
        }
        Update: never
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          last_success_at: string | null
        }
        Insert: {
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
        }
        Update: { last_success_at?: string | null }
      }
    }>
    Views: WithRel<{
      user_directory: {
        Row: {
          id: string
          name: string
          avatar_url: string | null
          role_name: string
        }
      }
    }>
    Functions: {
      generate_order_number: {
        Args: Record<string, never>
        Returns: string
      }
      generate_lot_number: {
        Args: Record<string, never>
        Returns: string
      }
      create_channel: {
        Args: { _name: string; _description?: string | null; _visibility?: 'public' | 'private' }
        Returns: string
      }
      get_or_create_dm: {
        Args: { _other_user_id: string }
        Returns: string
      }
      get_unread_counts: {
        Args: Record<string, never>
        Returns: { conversation_id: string; unread_count: number }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
