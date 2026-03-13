-- ============================================================
-- MES Agroalimentaire - Schema initial
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrateur système'),
  ('production_manager', 'Gestionnaire de production'),
  ('stock_manager', 'Gestionnaire de stock'),
  ('operator', 'Opérateur de production')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_id UUID REFERENCES roles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION LINES
-- ============================================================
CREATE TABLE IF NOT EXISTS production_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  capacity NUMERIC(10,2),
  capacity_unit TEXT DEFAULT 'kg/h',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS (finished goods)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RAW MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RECIPES
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity_required NUMERIC(10,4) NOT NULL, -- quantity per unit of product
  unit TEXT NOT NULL DEFAULT 'kg',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, raw_material_id)
);

-- ============================================================
-- RAW MATERIAL LOTS (stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_material_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number TEXT NOT NULL UNIQUE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
  initial_quantity NUMERIC(10,4) NOT NULL,
  available_quantity NUMERIC(10,4) NOT NULL,
  reception_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES products(id),
  line_id UUID REFERENCES production_lines(id),
  planned_quantity NUMERIC(10,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','validated','materials_allocated','in_production','completed','closed')),
  planned_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION LOTS (finished goods lots)
-- ============================================================
CREATE TABLE IF NOT EXISTS production_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number TEXT NOT NULL UNIQUE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATERIAL ALLOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS material_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  raw_material_lot_id UUID NOT NULL REFERENCES raw_material_lots(id),
  quantity_allocated NUMERIC(10,4) NOT NULL,
  allocated_by UUID REFERENCES profiles(id),
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_order_id, raw_material_lot_id)
);

-- ============================================================
-- PRODUCTION ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS production_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  produced_quantity NUMERIC(10,4) NOT NULL DEFAULT 0,
  rejected_quantity NUMERIC(10,4) NOT NULL DEFAULT 0,
  observations TEXT,
  entered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION LOSSES
-- ============================================================
CREATE TABLE IF NOT EXISTS production_losses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_entry_id UUID NOT NULL REFERENCES production_entries(id) ON DELETE CASCADE,
  loss_type TEXT NOT NULL CHECK (loss_type IN ('process_loss','scrap','breakage','other')),
  quantity NUMERIC(10,4) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL, -- product_id or raw_material_id
  item_type TEXT NOT NULL CHECK (item_type IN ('product','raw_material')),
  lot_id UUID, -- production_lot_id or raw_material_lot_id
  movement_type TEXT NOT NULL CHECK (movement_type IN ('IN','OUT')),
  quantity NUMERIC(10,4) NOT NULL,
  reference TEXT, -- order number or reason
  production_order_id UUID REFERENCES production_orders(id),
  moved_by UUID REFERENCES profiles(id),
  moved_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOT TRACEABILITY
-- ============================================================
CREATE TABLE IF NOT EXISTS lot_traceability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finished_lot_id UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  raw_material_lot_id UUID NOT NULL REFERENCES raw_material_lots(id),
  quantity_used NUMERIC(10,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(finished_lot_id, raw_material_lot_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_production_orders_updated_at
  BEFORE UPDATE ON production_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate order number: OP-YYYYMMDD-XXX
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq INT;
  order_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM production_orders
  WHERE order_number LIKE 'OP-' || today || '-%';
  order_num := 'OP-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Generate lot number: LPF-YYYYMMDD-XXX
CREATE OR REPLACE FUNCTION generate_lot_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq INT;
  lot_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM production_lots
  WHERE lot_number LIKE 'LPF-' || today || '-%';
  lot_num := 'LPF-' || today || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN lot_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_traceability ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_material_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see their own, admins see all
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  ));

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Reference tables: all authenticated users can read
CREATE POLICY "roles_select" ON roles FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "raw_materials_select" ON raw_materials FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select" ON recipes FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_lines_select" ON production_lines FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;

-- Products: admin and production_manager can write
CREATE POLICY "products_write" ON products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager')
  ));

CREATE POLICY "raw_materials_write" ON raw_materials FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager')
  ));

CREATE POLICY "recipes_write" ON recipes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager')
  ));

-- Production orders: all authenticated can read
CREATE POLICY "production_orders_select" ON production_orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "production_orders_write" ON production_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager')
  ));

-- Raw material lots: stock_manager and admin
CREATE POLICY "raw_material_lots_select" ON raw_material_lots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "raw_material_lots_write" ON raw_material_lots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'stock_manager')
  ));

-- Material allocations
CREATE POLICY "material_allocations_select" ON material_allocations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "material_allocations_write" ON material_allocations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'stock_manager')
  ));

-- Production entries: operators, production managers, admin
CREATE POLICY "production_entries_select" ON production_entries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "production_entries_write" ON production_entries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager', 'operator')
  ));

-- Production losses
CREATE POLICY "production_losses_select" ON production_losses FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "production_losses_write" ON production_losses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager', 'operator')
  ));

-- Stock movements, lots, traceability: all can read
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "stock_movements_write" ON stock_movements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager', 'stock_manager')
  ));

CREATE POLICY "production_lots_select" ON production_lots FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "production_lots_write" ON production_lots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager')
  ));

CREATE POLICY "lot_traceability_select" ON lot_traceability FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "lot_traceability_write" ON lot_traceability FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'production_manager', 'stock_manager')
  ));

CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  ));
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    (SELECT id FROM roles WHERE name = 'operator' LIMIT 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
