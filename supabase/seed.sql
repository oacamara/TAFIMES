-- ============================================================
-- Seed data for MES Agroalimentaire
-- Run AFTER creating a first admin user via Supabase Auth
-- ============================================================

-- Production Lines
INSERT INTO production_lines (name, code, capacity, capacity_unit) VALUES
  ('Ligne Broyage Cacao', 'LB-001', 500, 'kg/h'),
  ('Ligne Pressage Beurre', 'LP-002', 300, 'kg/h'),
  ('Ligne Mélange Poudre', 'LM-003', 400, 'kg/h'),
  ('Ligne Conditionnement', 'LC-004', 200, 'kg/h')
ON CONFLICT DO NOTHING;

-- Products
INSERT INTO products (name, code, unit, description) VALUES
  ('Poudre Chocolatée 25%', 'PPC-025', 'kg', 'Poudre chocolatée avec 25% de cacao'),
  ('Poudre Cacao Maigre', 'PCM-001', 'kg', 'Poudre de cacao dégraissée'),
  ('Beurre de Cacao Brut', 'BCB-001', 'kg', 'Beurre de cacao première pression'),
  ('Beurre de Cacao Raffiné', 'BCR-001', 'kg', 'Beurre de cacao raffiné'),
  ('Chocolat Noir 70%', 'CN-070', 'kg', 'Chocolat noir 70% cacao')
ON CONFLICT DO NOTHING;

-- Raw Materials
INSERT INTO raw_materials (name, code, unit, description) VALUES
  ('Fèves de Cacao Brutes', 'FCB-001', 'kg', 'Fèves de cacao non traitées'),
  ('Masse de Cacao', 'MC-001', 'kg', 'Masse de cacao pure'),
  ('Sucre Blanc', 'SB-001', 'kg', 'Sucre cristallisé blanc'),
  ('Lait en Poudre Entier', 'LPE-001', 'kg', 'Lait en poudre 26% MG'),
  ('Lécithine de Soja', 'LS-001', 'kg', 'Lécithine de soja E322'),
  ('Vanilline', 'VA-001', 'kg', 'Vanilline synthétique'),
  ('Beurre de Cacao Brut', 'BCB-RM-001', 'kg', 'Beurre de cacao pour mélange')
ON CONFLICT DO NOTHING;

-- Recipes
-- Poudre Chocolatée 25%: 250g masse cacao + 550g sucre + 180g lait + 15g lécithine + 5g vanilline per kg
INSERT INTO recipes (product_id, raw_material_id, quantity_required, unit)
SELECT p.id, r.id, 0.250, 'kg'
FROM products p, raw_materials r
WHERE p.code = 'PPC-025' AND r.code = 'MC-001'
ON CONFLICT DO NOTHING;

INSERT INTO recipes (product_id, raw_material_id, quantity_required, unit)
SELECT p.id, r.id, 0.550, 'kg'
FROM products p, raw_materials r
WHERE p.code = 'PPC-025' AND r.code = 'SB-001'
ON CONFLICT DO NOTHING;

INSERT INTO recipes (product_id, raw_material_id, quantity_required, unit)
SELECT p.id, r.id, 0.180, 'kg'
FROM products p, raw_materials r
WHERE p.code = 'PPC-025' AND r.code = 'LPE-001'
ON CONFLICT DO NOTHING;

INSERT INTO recipes (product_id, raw_material_id, quantity_required, unit)
SELECT p.id, r.id, 0.015, 'kg'
FROM products p, raw_materials r
WHERE p.code = 'PPC-025' AND r.code = 'LS-001'
ON CONFLICT DO NOTHING;

INSERT INTO recipes (product_id, raw_material_id, quantity_required, unit)
SELECT p.id, r.id, 0.005, 'kg'
FROM products p, raw_materials r
WHERE p.code = 'PPC-025' AND r.code = 'VA-001'
ON CONFLICT DO NOTHING;

-- Beurre de Cacao Brut: 1.1kg fèves per kg (pressage)
INSERT INTO recipes (product_id, raw_material_id, quantity_required, unit)
SELECT p.id, r.id, 1.100, 'kg'
FROM products p, raw_materials r
WHERE p.code = 'BCB-001' AND r.code = 'FCB-001'
ON CONFLICT DO NOTHING;

-- Poudre Cacao Maigre: 0.9kg fèves per kg
INSERT INTO recipes (product_id, raw_material_id, quantity_required, unit)
SELECT p.id, r.id, 0.900, 'kg'
FROM products p, raw_materials r
WHERE p.code = 'PCM-001' AND r.code = 'FCB-001'
ON CONFLICT DO NOTHING;

-- Sample Raw Material Lots
INSERT INTO raw_material_lots (lot_number, raw_material_id, initial_quantity, available_quantity, reception_date, supplier) VALUES
  ('LMP-20260301-001', (SELECT id FROM raw_materials WHERE code = 'FCB-001'), 5000, 4800, '2026-03-01', 'Cacao Ivoire SA'),
  ('LMP-20260305-001', (SELECT id FROM raw_materials WHERE code = 'MC-001'), 2000, 1950, '2026-03-05', 'Chocolaterie du Nord'),
  ('LMP-20260305-002', (SELECT id FROM raw_materials WHERE code = 'SB-001'), 10000, 9500, '2026-03-05', 'Sucrerie Nationale'),
  ('LMP-20260307-001', (SELECT id FROM raw_materials WHERE code = 'LPE-001'), 3000, 2900, '2026-03-07', 'Laiterie Centrale'),
  ('LMP-20260307-002', (SELECT id FROM raw_materials WHERE code = 'LS-001'), 500, 480, '2026-03-07', 'Additifs Alimentaires SA'),
  ('LMP-20260308-001', (SELECT id FROM raw_materials WHERE code = 'VA-001'), 100, 95, '2026-03-08', 'Arômes & Saveurs'),
  ('LMP-20260310-001', (SELECT id FROM raw_materials WHERE code = 'FCB-001'), 3000, 3000, '2026-03-10', 'Cacao Ghana Ltd')
ON CONFLICT DO NOTHING;
