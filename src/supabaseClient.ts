/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import {
  Supplier, Channel, Machine, ProductCategory, ProductGroup, Product, MaterialCategory, Material, MaterialAlternative, BOMHeader, BOMSlot, BOMOption, SalesPlan, ProductionPlan, SalesActual, ProductionActual, InventorySnapshot, PurchaseOrder, Shipment, MRPResult, VMaterialCoverage, VProductCoverage, VFGPSIAnalysis, VBOMCostDetail, VFGCost, VMaterialWeightedAvgCost, VMaterialEffectiveCost, VMaterialMonthlyProjection, VPlanVsActual, AppUser, SubstitutionProposal
} from './types';

// Let's load credentials from localStorage first, fallback to env vars if present
const STORAGE_URL_KEY = 'sc_planner_supabase_url';
const STORAGE_KEY_KEY = 'sc_planner_supabase_anon_key';

export function getStoredCredentials() {
  const url = localStorage.getItem(STORAGE_URL_KEY) || '';
  const key = localStorage.getItem(STORAGE_KEY_KEY) || '';
  return { url, key };
}

export function saveStoredCredentials(url: string, key: string) {
  localStorage.setItem(STORAGE_URL_KEY, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
}

export function clearStoredCredentials() {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_KEY_KEY);
}

const creds = getStoredCredentials();
export const supabase = creds.url && creds.key ? createClient(creds.url, creds.key) : null;

export function isSupabaseConnected(): boolean {
  const c = getStoredCredentials();
  return !!(c.url && c.key);
}

// ==========================================
// OFFLINE / LOCAL STORAGE SEED DATA (MOCK DB)
// ==========================================

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'S1', name: 'Saudi Pulp Co', default_lead_time_days: 15, default_transit_days: 12, default_customs_clearance_days: 7, status: 'active' },
  { id: 'S2', name: 'Global Polymers Ltd', default_lead_time_days: 20, default_transit_days: 18, default_customs_clearance_days: 10, status: 'active' },
  { id: 'S3', name: 'Al-Aman Packaging', default_lead_time_days: 7, default_transit_days: 3, default_customs_clearance_days: 2, status: 'active' },
  { id: 'S4', name: 'Egypt Cellulose Corp', default_lead_time_days: 10, default_transit_days: 5, default_customs_clearance_days: 3, status: 'active' },
  { id: 'S5', name: 'Suez Chem Industrial', default_lead_time_days: 25, default_transit_days: 14, default_customs_clearance_days: 8, status: 'active' }
];

const INITIAL_CHANNELS: Channel[] = [
  { id: 'C1', name: 'Zeina Distributor', status: 'active' },
  { id: 'C2', name: 'Pharma Chain Co', status: 'active' },
  { id: 'C3', name: 'E-Commerce / Retail', status: 'active' },
  { id: 'C4', name: 'Export Global', status: 'active' }
];

const INITIAL_MACHINES: Machine[] = [
  { id: 'M1', name: 'SOFY', description: 'Feminine hygiene pads high-speed machine', monthly_capacity: 550000 },
  { id: 'M2', name: 'VOXY', description: 'Ultra-thin and panty-liner line', monthly_capacity: 300000 },
  { id: 'M3', name: 'Atlas', description: 'Feminine pad & adult diaper flexible machine', monthly_capacity: 300000 },
  { id: 'M4', name: 'Pants', description: 'Baby pull-up diapers main machine', monthly_capacity: 400000 },
  { id: 'M5', name: 'Import', description: 'Virtual machine for imported finished goods', monthly_capacity: 300000 }
];

const INITIAL_PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 'PC1', name: 'Baby Diapers' },
  { id: 'PC2', name: 'Feminine Care' },
  { id: 'PC3', name: 'Adult Care' }
];

const INITIAL_PRODUCT_GROUPS: ProductGroup[] = [
  { id: 'PG1', name: 'BabyJoy', category_id: 'PC1' },
  { id: 'PG2', name: 'SOFY', category_id: 'PC2' },
  { id: 'PG3', name: 'Moony', category_id: 'PC1' },
  { id: 'PG4', name: 'Teemo', category_id: 'PC1' },
  { id: 'PG5', name: 'Atlas', category_id: 'PC2' }
];

const INITIAL_PRODUCTS: Product[] = [
  { id: 'P1', name: 'BabyJoy Maxi Size 4 Large', sku: 'BJ-M4', description: 'High absorption baby diapers', group_id: 'PG1', category_id: 'PC1', brand: 'BabyJoy', variant: 'Maxi', product_line: 'Pants', pack_type: 'Jumbo', size: 'Size 4', status: 'running', pcs_per_bag: 44, bags_per_carton: 4, selling_price: 18.5, standard_cost: 11.2 },
  { id: 'P2', name: 'SOFY Slim Wings Normal', sku: 'SF-SLW', description: 'Super slim pads with side wings', group_id: 'PG2', category_id: 'PC2', brand: 'SOFY', variant: 'Slim', product_line: 'SOFY', pack_type: 'Single Pack', size: 'Normal', status: 'running', pcs_per_bag: 30, bags_per_carton: 8, selling_price: 12.0, standard_cost: 6.5 },
  { id: 'P3', name: 'Atlas Night Comfort Extra', sku: 'AT-NC', description: 'Longer pads for nighttime coverage', group_id: 'PG5', category_id: 'PC2', brand: 'Atlas', variant: 'Night', product_line: 'Atlas', pack_type: 'Jumbo Pack', size: 'Extra Large', status: 'running', pcs_per_bag: 20, bags_per_carton: 12, selling_price: 14.5, standard_cost: 7.8 },
  { id: 'P4', name: 'Moony Newborn Premium', sku: 'MN-NB', description: 'Imported ultra-soft diaper', group_id: 'PG3', category_id: 'PC1', brand: 'Moony', variant: 'Newborn', product_line: 'Import', pack_type: 'Medium', size: 'Size 1', status: 'running', pcs_per_bag: 54, bags_per_carton: 4, selling_price: 25.0, standard_cost: 16.5 },
  { id: 'P5', name: 'Teemo Pant Premium', sku: 'TM-PP', description: 'Premium soft diaper pants', group_id: 'PG4', category_id: 'PC1', brand: 'Teemo', variant: 'Pant', product_line: 'Pants', pack_type: 'Carton', size: 'Size 5', status: 'running', pcs_per_bag: 40, bags_per_carton: 4, selling_price: 21.0, standard_cost: 12.4 },
  { id: 'P6', name: 'SOFY Panty Liners Dry', sku: 'SF-PLD', description: 'Daily wear breathable panty liners', group_id: 'PG2', category_id: 'PC2', brand: 'SOFY', variant: 'Panty Liner', product_line: 'VOXY', pack_type: 'Single Pack', size: 'Regular', status: 'running', pcs_per_bag: 40, bags_per_carton: 10, selling_price: 8.5, standard_cost: 4.1 }
];

const INITIAL_MATERIAL_CATEGORIES: MaterialCategory[] = [
  { id: 'MC1', name: '01- Fluff Pulp', material_group: 'RM' },
  { id: 'MC2', name: '18- Nonwoven Top Sheet', material_group: 'RM' },
  { id: 'MC3', name: '28- Polybag outer', material_group: 'PK' },
  { id: 'MC4', name: '29- Corrugated Carton', material_group: 'PK' },
  { id: 'MC5', name: '12- SAP Absorbent Polymer', material_group: 'RM' },
  { id: 'MC6', name: '30- Elastic Side Panel', material_group: 'RM' }
];

const INITIAL_MATERIALS: Material[] = [
  { id: 'MT1', name: 'GP Bleached Fluff Pulp', sku: 'RM-PLP-01', description: 'Southern Pine Fluff Pulp', category_id: 'MC1', supplier_id: 'S1', supplier_lead_time_days: 15, transit_days: 12, customs_clearance_days: 7, total_lead_time_days: 34, reorder_point_days: 45, safety_stock_months: 0, moq: 20000, max_usage: 1200, controller: 'Mohamed Amr', status: 'running', standard_cost: 1.5, cost_basis: 'standard' },
  { id: 'MT2', name: 'Spunbond Top Sheet 15gsm', sku: 'RM-NWT-18', description: 'Hydrophilic Top Sheet nonwoven', category_id: 'MC2', supplier_id: 'S2', supplier_lead_time_days: 20, transit_days: 18, customs_clearance_days: 10, total_lead_time_days: 48, reorder_point_days: 60, safety_stock_months: 0, moq: 15000, max_usage: 800, controller: 'Mohamed Amr', status: 'running', standard_cost: 0.8, cost_basis: 'standard' },
  { id: 'MT3', name: 'Teemo Printed Polybag Large', sku: 'PK-PLB-28', description: 'LDPE Printed Polybag Outer', category_id: 'MC3', supplier_id: 'S3', supplier_lead_time_days: 7, transit_days: 3, customs_clearance_days: 2, total_lead_time_days: 12, reorder_point_days: 20, safety_stock_months: 0, moq: 5000, max_usage: 500, controller: 'Amr Anwar', status: 'running', standard_cost: 0.3, cost_basis: 'standard' },
  { id: 'MT4', name: 'Corrugated Master Carton Big', sku: 'PK-CTN-29', description: 'Double Wall Corrugated Box', category_id: 'MC4', supplier_id: 'S3', supplier_lead_time_days: 5, transit_days: 3, customs_clearance_days: 2, total_lead_time_days: 10, reorder_point_days: 15, safety_stock_months: 0, moq: 2000, max_usage: 300, controller: 'Amr Anwar', status: 'running', standard_cost: 1.2, cost_basis: 'weighted_avg' },
  { id: 'MT5', name: 'Sumitomo SAP High-Speed', sku: 'RM-SAP-12', description: 'Super Absorbent Polymer particles', category_id: 'MC5', supplier_id: 'S5', supplier_lead_time_days: 25, transit_days: 14, customs_clearance_days: 8, total_lead_time_days: 47, reorder_point_days: 55, safety_stock_months: 2.5, moq: 10000, max_usage: 1000, controller: 'Mohamed Amr', status: 'running', standard_cost: 2.2, cost_basis: 'standard' },
  // Alternatives for Top Sheet
  { id: 'MT6', name: 'Local Spunbond Top Sheet', sku: 'RM-NWT-18-ALT', description: 'Local Hydrophilic Nonwoven alternative', category_id: 'MC2', supplier_id: 'S4', supplier_lead_time_days: 10, transit_days: 5, customs_clearance_days: 3, total_lead_time_days: 18, reorder_point_days: 25, safety_stock_months: 0, moq: 8000, max_usage: 700, controller: 'Mohamed Amr', status: 'running', standard_cost: 0.72, cost_basis: 'standard' }
];

const INITIAL_ALTERNATIVES: MaterialAlternative[] = [
  { id: 'A1', material_id: 'MT2', alternative_material_id: 'MT6' },
  { id: 'A2', material_id: 'MT6', alternative_material_id: 'MT2' }
];

const INITIAL_BOM_HEADERS: BOMHeader[] = [
  { id: 'BH1', product_id: 'P1', description: 'BOM for BabyJoy Maxi S4', is_active: true },
  { id: 'BH2', product_id: 'P2', description: 'BOM for SOFY Slim Wings', is_active: true },
  { id: 'BH3', product_id: 'P3', description: 'BOM for Atlas Night Comfort', is_active: true },
  { id: 'BH4', product_id: 'P5', description: 'BOM for Teemo Pant Premium', is_active: true }
];

const INITIAL_BOM_SLOTS: BOMSlot[] = [
  // For P1 (BabyJoy)
  { id: 'BS1', bom_id: 'BH1', slot_name: 'Core Fluff Pulp' },
  { id: 'BS2', bom_id: 'BH1', slot_name: 'Top Sheet Surface' },
  { id: 'BS3', bom_id: 'BH1', slot_name: 'Super Absorbent Polymer' },
  { id: 'BS4', bom_id: 'BH1', slot_name: 'Packaging Carton' },
  // For P2 (SOFY)
  { id: 'BS5', bom_id: 'BH2', slot_name: 'Top Sheet Surface' },
  { id: 'BS6', bom_id: 'BH2', slot_name: 'Core Cellulose' },
  { id: 'BS7', bom_id: 'BH2', slot_name: 'Packaging Outer Bag' }
];

const INITIAL_BOM_OPTIONS: BOMOption[] = [
  // For P1: Core Pulp
  { id: 'BO1', slot_id: 'BS1', material_id: 'MT1', qty_per_unit: 4.5, scrap_percent: 3, priority: 1 },
  // For P1: Top Sheet (Primary = MT2, Alt = MT6)
  { id: 'BO2', slot_id: 'BS2', material_id: 'MT2', qty_per_unit: 1.2, scrap_percent: 5, priority: 1 },
  { id: 'BO3', slot_id: 'BS2', material_id: 'MT6', qty_per_unit: 1.25, scrap_percent: 4, priority: 2 },
  // For P1: SAP
  { id: 'BO4', slot_id: 'BS3', material_id: 'MT5', qty_per_unit: 2.0, scrap_percent: 2, priority: 1 },
  // For P1: Carton
  { id: 'BO5', slot_id: 'BS4', material_id: 'MT4', qty_per_unit: 0.25, scrap_percent: 1, priority: 1 },

  // For P2: Top Sheet (Primary = MT2, Alt = MT6)
  { id: 'BO6', slot_id: 'BS5', material_id: 'MT2', qty_per_unit: 0.8, scrap_percent: 4, priority: 1 },
  { id: 'BO7', slot_id: 'BS5', material_id: 'MT6', qty_per_unit: 0.8, scrap_percent: 3, priority: 2 },
  // For P2: Core Cellulose (MT1)
  { id: 'BO8', slot_id: 'BS6', material_id: 'MT1', qty_per_unit: 2.1, scrap_percent: 2, priority: 1 },
  // For P2: Outer Bag (MT3)
  { id: 'BO9', slot_id: 'BS7', material_id: 'MT3', qty_per_unit: 0.125, scrap_percent: 0, priority: 1 }
];

// SALES PLAN (Monthly grain pre-seeded for Jul, Aug, Sep, Oct 2026)
const INITIAL_SALES_PLAN: SalesPlan[] = [
  { id: 'SP1', product_id: 'P1', channel_id: 'C1', period_type: 'month', period_start: '2026-07-01', quantity: 150000 },
  { id: 'SP2', product_id: 'P1', channel_id: 'C2', period_type: 'month', period_start: '2026-07-01', quantity: 50000 },
  { id: 'SP3', product_id: 'P1', channel_id: 'C3', period_type: 'month', period_start: '2026-07-01', quantity: 30000 },
  { id: 'SP4', product_id: 'P1', channel_id: 'C4', period_type: 'month', period_start: '2026-07-01', quantity: 45000 },

  { id: 'SP5', product_id: 'P2', channel_id: 'C1', period_type: 'month', period_start: '2026-07-01', quantity: 200000 },
  { id: 'SP6', product_id: 'P2', channel_id: 'C2', period_type: 'month', period_start: '2026-07-01', quantity: 80000 },

  { id: 'SP7', product_id: 'P1', channel_id: 'C1', period_type: 'month', period_start: '2026-08-01', quantity: 160000 },
  { id: 'SP8', product_id: 'P1', channel_id: 'C2', period_type: 'month', period_start: '2026-08-01', quantity: 55000 },
  { id: 'SP9', product_id: 'P2', channel_id: 'C1', period_type: 'month', period_start: '2026-08-01', quantity: 210000 },

  { id: 'SP10', product_id: 'P1', channel_id: 'C1', period_type: 'month', period_start: '2026-09-01', quantity: 170000 },
  { id: 'SP11', product_id: 'P2', channel_id: 'C1', period_type: 'month', period_start: '2026-09-01', quantity: 220000 }
];

// PRODUCTION PLAN (MPS) - Assigned to machines
const INITIAL_PRODUCTION_PLAN: ProductionPlan[] = [
  { id: 'PP1', product_id: 'P1', machine_id: 'M4', period_type: 'month', period_start: '2026-07-01', quantity: 260000 },
  { id: 'PP2', product_id: 'P2', machine_id: 'M1', period_type: 'month', period_start: '2026-07-01', quantity: 290000 },

  { id: 'PP3', product_id: 'P1', machine_id: 'M4', period_type: 'month', period_start: '2026-08-01', quantity: 280000 },
  { id: 'PP4', product_id: 'P2', machine_id: 'M1', period_type: 'month', period_start: '2026-08-01', quantity: 300000 },

  { id: 'PP5', product_id: 'P1', machine_id: 'M4', period_type: 'month', period_start: '2026-09-01', quantity: 250000 },
  { id: 'PP6', product_id: 'P2', machine_id: 'M1', period_type: 'month', period_start: '2026-09-01', quantity: 280000 }
];

// ACTUALS
const INITIAL_SALES_ACTUAL: SalesActual[] = [
  { id: 'SA1', product_id: 'P1', channel_id: 'C1', period_start: '2026-07-01', quantity: 142000 },
  { id: 'SA2', product_id: 'P1', channel_id: 'C2', period_start: '2026-07-01', quantity: 49000 },
  { id: 'SA3', product_id: 'P2', channel_id: 'C1', period_start: '2026-07-01', quantity: 215000 }
];

const INITIAL_PRODUCTION_ACTUAL: ProductionActual[] = [
  { id: 'PA1', product_id: 'P1', machine_id: 'M4', period_start: '2026-07-01', quantity: 255000 },
  { id: 'PA2', product_id: 'P2', machine_id: 'M1', period_start: '2026-07-01', quantity: 288000 }
];

// OPENING STOCK Snapshot as of 2026-07-01
const INITIAL_INVENTORY: InventorySnapshot[] = [
  // Products stock (pcs)
  { id: 'IV1', item_type: 'product', item_id: 'P1', snapshot_date: '2026-07-01', quantity: 65000 },
  { id: 'IV2', item_type: 'product', item_id: 'P2', snapshot_date: '2026-07-01', quantity: 110000 },
  { id: 'IV3', item_type: 'product', item_id: 'P3', snapshot_date: '2026-07-01', quantity: 15000 },
  { id: 'IV4', item_type: 'product', item_id: 'P4', snapshot_date: '2026-07-01', quantity: 8000 },
  { id: 'IV5', item_type: 'product', item_id: 'P5', snapshot_date: '2026-07-01', quantity: 22000 },
  { id: 'IV6', item_type: 'product', item_id: 'P6', snapshot_date: '2026-07-01', quantity: 45000 },

  // Materials stock (qty)
  { id: 'IV7', item_type: 'material', item_id: 'MT1', snapshot_date: '2026-07-01', quantity: 220000 }, // OOS Risk soon
  { id: 'IV8', item_type: 'material', item_id: 'MT2', snapshot_date: '2026-07-01', quantity: 180000 },
  { id: 'IV9', item_type: 'material', item_id: 'MT3', snapshot_date: '2026-07-01', quantity: 3000 },  // Under MOQ / OOS Risk
  { id: 'IV10', item_type: 'material', item_id: 'MT4', snapshot_date: '2026-07-01', quantity: 175000 }, // Healthy 2-3 months cover
  { id: 'IV11', item_type: 'material', item_id: 'MT5', snapshot_date: '2026-07-01', quantity: 1750000 }, // Overstock > 3 months cover
  { id: 'IV12', item_type: 'material', item_id: 'MT6', snapshot_date: '2026-07-01', quantity: 12000 }
];

// PURCHASE ORDERS
const INITIAL_POS: PurchaseOrder[] = [
  { id: 'PO1', material_id: 'MT1', supplier_id: 'S1', order_no: 'PO-2026-001', qty: 150000, remaining_qty: 150000, required_date: '2026-07-28', status: 'pending', timing: 'Normal', po_date: '2026-07-05' },
  { id: 'PO2', material_id: 'MT2', supplier_id: 'S2', order_no: 'PO-2026-002', qty: 100000, remaining_qty: 0, required_date: '2026-07-15', status: 'completed', timing: 'Normal', po_date: '2026-06-25' },
  { id: 'PO3', material_id: 'MT3', supplier_id: 'S3', order_no: 'PO-2026-003', qty: 25000, remaining_qty: 25000, required_date: '2026-07-10', status: 'in_transit', timing: 'Need to be Closed', po_date: '2026-07-01' },
  { id: 'PO4', material_id: 'MT5', supplier_id: 'S5', order_no: 'PO-2026-004', qty: 80000, remaining_qty: 80000, required_date: '2026-08-05', status: 'pending', timing: 'Check with Proc.', po_date: '2026-07-10' }
];

// SHIPMENTS
const INITIAL_SHIPMENTS: Shipment[] = [
  { 
    id: 'SH1', material_id: 'MT3', supplier_id: 'S3', qty: 25000, 
    invoice_no: 'INV-S3-9871', bl_no: 'BL-S3-00918', container_count: 2, 
    ship_method: 'sea', etd: '2026-07-02', port_eta: '2026-07-08', port_name: 'Alexandria', 
    customs_clearance_days: 2, factory_arrival_date: '2026-07-11', delay: 1 
  },
  { 
    id: 'SH2', material_id: 'MT1', supplier_id: 'S1', qty: 80000, 
    invoice_no: 'INV-S1-2290', bl_no: 'BL-S1-55410', container_count: 4, 
    ship_method: 'sea', etd: '2026-07-10', port_eta: '2026-07-22', port_name: 'Damietta', 
    customs_clearance_days: 7, factory_arrival_date: null, delay: 0 // Will trigger check flag
  },
  { 
    id: 'SH3', material_id: 'MT2', supplier_id: 'S2', qty: 60000, 
    invoice_no: 'INV-S2-4412', bl_no: 'BL-S2-33100', container_count: 3, 
    ship_method: 'sea', etd: '2026-06-18', port_eta: '2026-07-06', port_name: 'Alexandria', 
    customs_clearance_days: 10, factory_arrival_date: '2026-07-16', delay: -2 // Arrived early
  }
];

const INITIAL_MRP_RESULTS: MRPResult[] = [];

// Seeded demo accounts for the offline auth/roles system (see AuthContext.tsx).
// admin = full access incl. deletes & the Supabase connection dialog.
// planner = can create/edit plans, POs, master data (no deletes, no DB settings).
// viewer = read-only across every screen.
const INITIAL_USERS: AppUser[] = [
  { id: 'U1', name: 'Mohamed Amr', email: 'mohamed.amr@sanita.com', role: 'admin', status: 'active' },
  { id: 'U2', name: 'Amr Anwar', email: 'amr.anwar@sanita.com', role: 'planner', status: 'active' },
  { id: 'U3', name: 'Guest Viewer', email: 'guest@sanita.com', role: 'viewer', status: 'active' }
];

// Helper function to initialize database state in localStorage
function getLocalDB() {
  const db: {
    suppliers: Supplier[];
    channels: Channel[];
    machines: Machine[];
    product_categories: ProductCategory[];
    product_groups: ProductGroup[];
    products: Product[];
    material_categories: MaterialCategory[];
    materials: Material[];
    material_alternatives: MaterialAlternative[];
    bom_headers: BOMHeader[];
    bom_slots: BOMSlot[];
    bom_options: BOMOption[];
    sales_plan: SalesPlan[];
    production_plan: ProductionPlan[];
    sales_actual: SalesActual[];
    production_actual: ProductionActual[];
    inventory_snapshots: InventorySnapshot[];
    purchase_orders: PurchaseOrder[];
    shipments: Shipment[];
    mrp_results: MRPResult[];
    users: AppUser[];
  } = {
    suppliers: INITIAL_SUPPLIERS,
    channels: INITIAL_CHANNELS,
    machines: INITIAL_MACHINES,
    product_categories: INITIAL_PRODUCT_CATEGORIES,
    product_groups: INITIAL_PRODUCT_GROUPS,
    products: INITIAL_PRODUCTS,
    material_categories: INITIAL_MATERIAL_CATEGORIES,
    materials: INITIAL_MATERIALS,
    material_alternatives: INITIAL_ALTERNATIVES,
    bom_headers: INITIAL_BOM_HEADERS,
    bom_slots: INITIAL_BOM_SLOTS,
    bom_options: INITIAL_BOM_OPTIONS,
    sales_plan: INITIAL_SALES_PLAN,
    production_plan: INITIAL_PRODUCTION_PLAN,
    sales_actual: INITIAL_SALES_ACTUAL,
    production_actual: INITIAL_PRODUCTION_ACTUAL,
    inventory_snapshots: INITIAL_INVENTORY,
    purchase_orders: INITIAL_POS,
    shipments: INITIAL_SHIPMENTS,
    mrp_results: INITIAL_MRP_RESULTS,
    users: INITIAL_USERS,
  };

  // A browser that has never held this app needs seeding, not migrating - the
  // seed is already at the current schema.
  const isFreshInstall = !localStorage.getItem('sc_db_materials');

  const keys = Object.keys(db) as Array<keyof typeof db>;
  keys.forEach(k => {
    const key = `sc_db_${k}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(db[k]));
    }
  });

  if (isFreshInstall) {
    localStorage.setItem(STORAGE_SCHEMA_KEY, String(SCHEMA_VERSION));
  } else {
    runLocalMigrations();
  }
}

/** Bump when a released schema change needs existing local data adjusted. */
const SCHEMA_VERSION = 2;
const STORAGE_SCHEMA_KEY = 'sc_db_schema_version';

/**
 * Tables are seeded once and never overwritten, so a shipped semantic change
 * has to be applied to data already sitting in a planner's browser.
 */
export function runLocalMigrations() {
  const stored = Number(localStorage.getItem(STORAGE_SCHEMA_KEY) || '1');
  if (stored >= SCHEMA_VERSION) return;

  // v2: safety_stock_months stopped being the buffer formula and became an
  // opt-in override, with 0 meaning "size it from lead time". Values stored
  // before this release were formula inputs, not deliberate overrides - left
  // alone they would silently pin every material to the old oversized buffer.
  if (stored < 2) {
    const key = 'sc_db_materials';
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const materials = JSON.parse(raw) as Material[];
        materials.forEach(m => { m.safety_stock_months = 0; });
        localStorage.setItem(key, JSON.stringify(materials));
      } catch {
        // Corrupt table: leave it for the normal read path to surface.
      }
    }
  }

  localStorage.setItem(STORAGE_SCHEMA_KEY, String(SCHEMA_VERSION));
}

// Ensure the local storage is seeded on first load
getLocalDB();

export function readLocalTable<T>(table: string): T[] {
  const key = `sc_db_${table}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

export function writeLocalTable<T>(table: string, data: T[]) {
  const key = `sc_db_${table}`;
  localStorage.setItem(key, JSON.stringify(data));
}

// ==========================================
// UNIVERSAL API LAYER Wrapper
// ==========================================

export async function fetchTableData<T>(table: string): Promise<T[]> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      return data as T[];
    } catch (err: any) {
      console.warn(`Supabase fetch failed for ${table}, falling back to Local Storage:`, err.message || err);
      return readLocalTable<T>(table);
    }
  }
  return readLocalTable<T>(table);
}

export async function saveRecord<T extends { id: string }>(table: string, record: T): Promise<T> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from(table).upsert(record).select().single();
      if (error) throw error;
      return data as T;
    } catch (err: any) {
      console.warn(`Supabase save failed for ${table}, writing to Local Storage:`, err.message || err);
    }
  }
  
  const current = readLocalTable<T>(table);
  const existsIdx = current.findIndex(r => r.id === record.id);
  
  let updatedRecord = { ...record };
  if (existsIdx > -1) {
    current[existsIdx] = updatedRecord;
  } else {
    // If id is empty or temp, generate UUID-like id
    if (!record.id || record.id.startsWith('temp_')) {
      updatedRecord.id = 'ID_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
    current.push(updatedRecord);
  }
  writeLocalTable<T>(table, current);
  return updatedRecord;
}

export async function deleteRecord<T extends { id: string }>(table: string, id: string): Promise<boolean> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err: any) {
      console.warn(`Supabase delete failed for ${table}, removing from Local Storage:`, err.message || err);
    }
  }
  
  const current = readLocalTable<T>(table);
  const filtered = current.filter(r => r.id !== id);
  writeLocalTable<T>(table, filtered);
  return true;
}

// ==========================================
// CLIENT-SIDE VIEWS CALCULATORS (Offline Engine)
// ==========================================

export async function getVMaterialCoverage(
  demandBasis: 'forecast' | 'sales' = 'forecast',
  period: string = getPlanningPeriod()
): Promise<VMaterialCoverage[]> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from('v_material_coverage').select('*');
      if (!error && data) return data as VMaterialCoverage[];
    } catch (e) {
      console.warn("Fallback to local coverage calculations");
    }
  }

  // Local calculation:
  const materials = readLocalTable<Material>('materials');
  const matCats = readLocalTable<MaterialCategory>('material_categories');
  const inventory = readLocalTable<InventorySnapshot>('inventory_snapshots');
  const salesPlan = readLocalTable<SalesPlan>('sales_plan');
  const salesActual = readLocalTable<SalesActual>('sales_actual');
  const shipments = readLocalTable<Shipment>('shipments');
  const pos = readLocalTable<PurchaseOrder>('purchase_orders');

  // Let's calculate the monthly usage for each material
  const usageMap: Record<string, number> = {};
  materials.forEach(m => { usageMap[m.id] = 0; });

  // Determine demand per product based on toggle
  const productDemandMap: Record<string, number> = {};
  const products = readLocalTable<Product>('products');
  products.forEach(p => {
    let quantity = 0;
    if (demandBasis === 'sales') {
      const actuals = salesActual.filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
      const totalActual = actuals.reduce((sum, s) => sum + s.quantity, 0);
      if (totalActual > 0) {
        quantity = totalActual;
      } else {
        // Fallback to forecast
        const forecasts = salesPlan.filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
        quantity = forecasts.reduce((sum, s) => sum + s.quantity, 0);
      }
    } else {
      // Forecast-based
      const forecasts = salesPlan.filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
      quantity = forecasts.reduce((sum, s) => sum + s.quantity, 0);
    }
    productDemandMap[p.id] = quantity;
  });

  // Explode to material usage
  Object.entries(explodeBOM(productDemandMap)).forEach(([materialId, qty]) => {
    if (usageMap[materialId] !== undefined) usageMap[materialId] += qty;
  });

  return materials.map(m => {
    const cat = matCats.find(c => c.id === m.category_id);
    const mSnapshots = inventory.filter(i => i.item_type === 'material' && i.item_id === m.id);
    const stockSnapshot = mSnapshots.find(i => i.snapshot_date === period) || mSnapshots[0];
    const stock = stockSnapshot ? stockSnapshot.quantity : 0;
    
    // Monthly consumption. Materials the current plan never consumes still
    // need a basis, so master data's daily `max_usage` stands in - the same
    // fallback getSafetyStockQty uses, and now at the same scale. It was
    // previously multiplied by an unexplained 15, which put coverage on a
    // half-month footing while the safety buffer used a full one, so the two
    // screens disagreed about the same material.
    const monthlyDemand = usageMap[m.id] || m.max_usage * DAYS_PER_MONTH;
    
    // In-transit quantity
    const transitQty = shipments
      .filter(s => s.material_id === m.id && s.factory_arrival_date !== null)
      .reduce((sum, s) => sum + s.qty, 0);

    // Pending PO quantity (not completed and not in transit)
    const pendingPoQty = pos
      .filter(p => p.material_id === m.id && p.status === 'pending')
      .reduce((sum, p) => sum + p.remaining_qty, 0);

    const totalAvailable = stock + transitQty + pendingPoQty;

    const coverageMonths = monthsOfCover(totalAvailable, monthlyDemand);
    const coverageMonthsNoTransit = monthsOfCover(stock, monthlyDemand);

    return {
      material_id: m.id,
      material_name: m.name,
      sku: m.sku,
      category_id: m.category_id,
      category_name: cat ? cat.name : 'Unknown',
      material_group: cat ? cat.material_group : 'RM',
      opening_stock: stock,
      monthly_demand: Math.round(monthlyDemand),
      coverage_months: parseFloat(coverageMonths.toFixed(2)),
      coverage_months_no_transit: parseFloat(coverageMonthsNoTransit.toFixed(2)),
      oos_risk_flag: coverageMonths < 1.0,
      overstock_flag: coverageMonths > 3.0
    };
  });
}

export async function getVProductCoverage(
  demandBasis: 'forecast' | 'sales' = 'forecast',
  period: string = getPlanningPeriod()
): Promise<VProductCoverage[]> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from('v_product_coverage').select('*');
      if (!error && data) return data as VProductCoverage[];
    } catch (e) {
      console.warn("Fallback to local product coverage calculations");
    }
  }

  const products = readLocalTable<Product>('products');
  const inventory = readLocalTable<InventorySnapshot>('inventory_snapshots');
  const salesPlan = readLocalTable<SalesPlan>('sales_plan');
  const salesActual = readLocalTable<SalesActual>('sales_actual');

  // Compute monthly sales demand
  const demandMap: Record<string, number> = {};
  products.forEach(p => {
    let quantity = 0;
    if (demandBasis === 'sales') {
      const actuals = salesActual.filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
      const totalActual = actuals.reduce((sum, s) => sum + s.quantity, 0);
      if (totalActual > 0) {
        quantity = totalActual;
      } else {
        const forecasts = salesPlan.filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
        quantity = forecasts.reduce((sum, s) => sum + s.quantity, 0);
      }
    } else {
      const forecasts = salesPlan.filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
      quantity = forecasts.reduce((sum, s) => sum + s.quantity, 0);
    }
    demandMap[p.id] = quantity;
  });

  return products.map(p => {
    const pSnapshots = inventory.filter(i => i.item_type === 'product' && i.item_id === p.id);
    const stockSnapshot = pSnapshots.find(i => i.snapshot_date === period) || pSnapshots[0];
    const stock = stockSnapshot ? stockSnapshot.quantity : 0;
    const monthlyDemand = demandMap[p.id] || 45000; // fallback

    const coverageMonths = monthsOfCover(stock, monthlyDemand);

    return {
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      product_line: p.product_line,
      opening_stock: stock,
      monthly_demand: Math.round(monthlyDemand),
      coverage_months: parseFloat(coverageMonths.toFixed(2)),
      below_safety_flag: coverageMonths < 1.0
    };
  });
}

export async function getVFGPSIAnalysis(period: string = getPlanningPeriod()): Promise<VFGPSIAnalysis[]> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from('v_fg_psi_analysis').select('*');
      if (!error && data) return data as VFGPSIAnalysis[];
    } catch (e) {
      console.warn("Fallback to local PSI analysis calculations");
    }
  }

  const products = readLocalTable<Product>('products');
  const categories = readLocalTable<ProductCategory>('product_categories');
  const groups = readLocalTable<ProductGroup>('product_groups');
  const inventory = readLocalTable<InventorySnapshot>('inventory_snapshots');
  const salesPlan = readLocalTable<SalesPlan>('sales_plan');
  const productionPlan = readLocalTable<ProductionPlan>('production_plan');
  const salesActual = readLocalTable<SalesActual>('sales_actual');
  const productionActual = readLocalTable<ProductionActual>('production_actual');

  return products.map(p => {
    const cat = categories.find(c => c.id === p.category_id);
    const grp = groups.find(g => g.id === p.group_id);
    
    const startStockSnap = inventory.find(i => i.item_type === 'product' && i.item_id === p.id);
    const start_stock = startStockSnap ? startStockSnap.quantity : 0;

    const sales_forecast = salesPlan
      .filter(s => s.product_id === p.id && isInPeriod(s.period_start, period))
      .reduce((sum, s) => sum + s.quantity, 0);

    const salesActualRows = salesActual
      .filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
    const actual_sales = salesActualRows.reduce((sum, s) => sum + s.quantity, 0);

    // No plan means there is no target to have hit or missed. Reporting 0%
    // painted an un-planned SKU as a total failure - the same mistake
    // getVPlanVsActual used to make before it was changed to report null.
    const sales_achievement_percent = sales_forecast > 0 ? (actual_sales / sales_forecast) * 100 : null;

    const prod_plan = productionPlan
      .filter(s => s.product_id === p.id && isInPeriod(s.period_start, period))
      .reduce((sum, s) => sum + s.quantity, 0);

    const productionActualRows = productionActual
      .filter(s => s.product_id === p.id && isInPeriod(s.period_start, period));
    const actual_production = productionActualRows.reduce((sum, s) => sum + s.quantity, 0);

    const production_achievement_percent = prod_plan > 0 ? (actual_production / prod_plan) * 100 : null;

    const expected_stock = start_stock + prod_plan - sales_forecast;
    const coverage_months = monthsOfCover(expected_stock, sales_forecast);
    const sales_value = sales_forecast * p.selling_price;

    return {
      row_id: p.id,
      category_id: p.category_id,
      category_name: cat ? cat.name : 'Unknown',
      group_id: p.group_id,
      group_name: grp ? grp.name : 'Unknown',
      brand: p.brand,
      product_line: p.product_line,
      pack_type: p.pack_type,
      size: p.size,
      status: p.status,
      start_stock,
      sales_forecast,
      actual_sales,
      // Row counts, not just sums: a month nobody has reported on yet and a
      // month that genuinely sold nothing both total zero, and only the second
      // is a miss.
      sales_actual_records: salesActualRows.length,
      production_actual_records: productionActualRows.length,
      sales_achievement_percent: sales_achievement_percent === null
        ? null
        : parseFloat(sales_achievement_percent.toFixed(1)),
      production_plan: prod_plan,
      actual_production,
      production_achievement_percent: production_achievement_percent === null
        ? null
        : parseFloat(production_achievement_percent.toFixed(1)),
      expected_stock,
      coverage_months: parseFloat(coverage_months.toFixed(2)),
      sales_value
    };
  });
}

export async function getVBOMCostDetail(productId: string): Promise<VBOMCostDetail[]> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from('v_bom_cost_detail').select('*').eq('product_id', productId);
      if (!error && data) return data as VBOMCostDetail[];
    } catch (e) {
      console.warn("Fallback to local BOM cost calculations");
    }
  }

  const bomHeaders = readLocalTable<BOMHeader>('bom_headers');
  const bomSlots = readLocalTable<BOMSlot>('bom_slots');
  const bomOptions = readLocalTable<BOMOption>('bom_options');
  const materials = readLocalTable<Material>('materials');
  const matCats = readLocalTable<MaterialCategory>('material_categories');

  const bom = bomHeaders.find(b => b.product_id === productId && b.is_active);
  if (!bom) return [];

  const slots = bomSlots.filter(s => s.bom_id === bom.id);
  const details: VBOMCostDetail[] = [];

  slots.forEach(slot => {
    const options = bomOptions.filter(o => o.slot_id === slot.id);
    options.forEach(opt => {
      const mat = materials.find(m => m.id === opt.material_id);
      if (!mat) return;
      const cat = matCats.find(c => c.id === mat.category_id);
      
      // Determine effective cost based on cost_basis toggle
      const unit_cost = mat.cost_basis === 'weighted_avg' 
        ? getWeightedAvgCost(mat.id) 
        : mat.standard_cost;

      const line_cost = opt.qty_per_unit * (1 + opt.scrap_percent / 100) * unit_cost;

      details.push({
        product_id: productId,
        slot_id: slot.id,
        slot_name: slot.slot_name,
        material_id: mat.id,
        material_name: mat.name,
        material_group: cat ? cat.material_group : 'RM',
        qty_per_unit: opt.qty_per_unit,
        scrap_percent: opt.scrap_percent,
        unit_cost,
        line_cost: parseFloat(line_cost.toFixed(4)),
        priority: opt.priority
      });
    });
  });

  return details;
}

function getWeightedAvgCost(materialId: string): number {
  // Let's compute average price from completed or in_transit purchase orders
  const pos = readLocalTable<PurchaseOrder>('purchase_orders');
  const materials = readLocalTable<Material>('materials');
  const mat = materials.find(m => m.id === materialId);
  const defaultCost = mat ? mat.standard_cost : 1.0;

  const matPos = pos.filter(p => p.material_id === materialId && p.qty > 0);
  if (matPos.length === 0) return defaultCost;

  // Let's simulate that PO price is standard_cost with some minor variations
  const totalCost = matPos.reduce((sum, p) => sum + (p.qty * defaultCost * (p.id === 'PO1' ? 1.02 : 0.98)), 0);
  const totalQty = matPos.reduce((sum, p) => sum + p.qty, 0);

  return parseFloat((totalCost / totalQty).toFixed(4));
}

export async function getVFGCost(productId: string): Promise<VFGCost | null> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from('v_fg_cost').select('*').eq('product_id', productId).maybeSingle();
      if (!error && data) return data as VFGCost;
    } catch (e) {
      console.warn("Fallback to local FGCost calculation");
    }
  }

  const products = readLocalTable<Product>('products');
  const p = products.find(prod => prod.id === productId);
  if (!p) return null;

  const details = await getVBOMCostDetail(productId);
  // Sum cost of primary options only (priority = 1)
  let rm_cost = 0;
  let pk_cost = 0;
  let con_cost = 0;

  details.filter(d => d.priority === 1).forEach(d => {
    if (d.material_group === 'RM') rm_cost += d.line_cost;
    else if (d.material_group === 'PK') pk_cost += d.line_cost;
    else con_cost += d.line_cost;
  });

  const total_material_cost = rm_cost + pk_cost + con_cost;
  const margin_per_unit = p.selling_price - total_material_cost;
  const margin_percent = p.selling_price > 0 ? (margin_per_unit / p.selling_price) * 100 : 0;

  return {
    product_id: p.id,
    product_name: p.name,
    sku: p.sku,
    selling_price: p.selling_price,
    rm_cost: parseFloat(rm_cost.toFixed(4)),
    pk_cost: parseFloat(pk_cost.toFixed(4)),
    con_cost: parseFloat(con_cost.toFixed(4)),
    total_material_cost: parseFloat(total_material_cost.toFixed(4)),
    margin_per_unit: parseFloat(margin_per_unit.toFixed(4)),
    margin_percent: parseFloat(margin_percent.toFixed(2))
  };
}

// ==========================================
// THE ACTIVE PLANNING PERIOD
// ==========================================

/**
 * The month the seeded dataset is built around. Only a fallback now - the
 * active period is whatever the planner has selected.
 */
export const PLANNING_ANCHOR = '2026-07-01';

const STORAGE_PERIOD_KEY = 'sc_planner_planning_period';

/** First day of the month containing `date`, as YYYY-MM-01. */
function monthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Whether a plan or actual row belongs to a planning period.
 *
 * Planning is monthly, but `period_start` is a full date and nothing stops a
 * row landing mid-month - the CSV importer accepts whatever the file carries.
 * Matching on exact date equality silently dropped those rows, and because
 * only the MRP path matched on the month, a 2026-08-15 row would drive the
 * solver while Coverage, PSI and Plan vs Actuals all reported zero for it.
 * Every caller now asks the same question: is this row in this month?
 */
export function isInPeriod(rowPeriodStart: string, period: string): boolean {
  if (!rowPeriodStart || !period) return false;
  return rowPeriodStart.slice(0, 7) === period.slice(0, 7);
}

/**
 * Months of stock cover.
 *
 * With no demand there is no meaningful ratio, so the two cases are reported
 * apart: stock sitting against no demand is effectively unlimited cover, while
 * no stock and no demand is no cover at all. Returning a flat 99 for both made
 * an empty, unused item look like the healthiest line on the screen.
 */
export const UNLIMITED_COVER_MONTHS = 99;

export function monthsOfCover(available: number, monthlyDemand: number): number {
  if (monthlyDemand > 0) return available / monthlyDemand;
  return available > 0 ? UNLIMITED_COVER_MONTHS : 0;
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local-time YYYY-MM-DD, avoiding the UTC shift `toISOString()` introduces. */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar length of the month containing `dateStr`, in days. */
export function daysInMonthOf(dateStr: string): number {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Every month that has sales or production plan rows, oldest first. */
export function getPlannedPeriods(): string[] {
  const months = new Set<string>();
  readLocalTable<SalesPlan>('sales_plan').forEach(r => months.add(`${r.period_start.slice(0, 7)}-01`));
  readLocalTable<ProductionPlan>('production_plan').forEach(r => months.add(`${r.period_start.slice(0, 7)}-01`));
  return [...months].sort();
}

/**
 * Where to open the app when the planner has not chosen a period yet.
 *
 * The real current month is the right answer whenever the data supports it.
 * When it does not - a dataset that stops before today, or a demo dataset
 * seeded in the past - falling back to the newest month that does have a plan
 * beats showing a set of empty grids and letting the planner guess why.
 */
function resolveDefaultPlanningPeriod(): string {
  const currentMonth = monthStart(new Date());
  const planned = getPlannedPeriods();
  if (planned.length === 0 || planned.includes(currentMonth)) return currentMonth;

  const past = planned.filter(p => p <= currentMonth);
  return past.length > 0 ? past[past.length - 1] : planned[0];
}

/**
 * The month every analysis screen reports on: stock coverage, plan vs actual,
 * PSI, and the dashboard KPIs. Persisted so it survives a refresh, the same
 * way the Supabase credentials are.
 */
export function getPlanningPeriod(): string {
  return localStorage.getItem(STORAGE_PERIOD_KEY) || resolveDefaultPlanningPeriod();
}

export function setPlanningPeriod(period: string) {
  localStorage.setItem(STORAGE_PERIOD_KEY, period);
}

/** Renders a period as e.g. "August 2026". */
export function formatPlanningPeriod(period: string): string {
  const [y, m] = period.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Per-unit material consumption implied by the active BOMs, as
 * `{ [productId]: { [materialId]: qtyPerFinishedUnit } }`, scrap included.
 *
 * This is the single definition of "what does one unit of this product
 * consume" for the whole offline engine. Stock coverage, the MRP run and the
 * Material Check drill-down all build on it, so they cannot drift apart the
 * way they did when each maintained its own explosion loop.
 *
 * Rules: only priority-1 (primary) options consume - alternates exist as a
 * costing benchmark and are never planned against. A slot is expected to hold
 * exactly one primary; if a slot somehow holds several, the first one wins
 * rather than all of them summing, which would silently double-count.
 */
function getPrimaryBomConsumption(): Record<string, Record<string, number>> {
  const products = readLocalTable<Product>('products');
  const bomHeaders = readLocalTable<BOMHeader>('bom_headers');
  const bomSlots = readLocalTable<BOMSlot>('bom_slots');
  const bomOptions = readLocalTable<BOMOption>('bom_options');

  const activeBoms = bomHeaders.filter(b => b.is_active);
  const consumption: Record<string, Record<string, number>> = {};

  products.forEach(p => {
    const bom = activeBoms.find(b => b.product_id === p.id);
    if (!bom) return;
    const perUnit: Record<string, number> = {};
    bomSlots
      .filter(s => s.bom_id === bom.id)
      .forEach(slot => {
        const opt = bomOptions.find(o => o.slot_id === slot.id && o.priority === 1);
        if (!opt) return;
        perUnit[opt.material_id] =
          (perUnit[opt.material_id] || 0) + opt.qty_per_unit * (1 + opt.scrap_percent / 100);
      });
    consumption[p.id] = perUnit;
  });

  return consumption;
}

/**
 * Primary consumption split by the BOM slot that drives it.
 *
 * A material can sit in more than one slot - MT2 is the top sheet for both
 * product families - and each slot converts to its alternate at its own ratio.
 * Attributing the shortfall by slot keeps a substitution proposal honest:
 * without it, two slots each claim the whole gap and the numbers double.
 */
export function primaryConsumptionBySlot(
  demandByProduct: Record<string, number>
): Record<string, Record<string, number>> {
  const bomHeaders = readLocalTable<BOMHeader>('bom_headers').filter(b => b.is_active);
  const bomSlots = readLocalTable<BOMSlot>('bom_slots');
  const bomOptions = readLocalTable<BOMOption>('bom_options');

  const out: Record<string, Record<string, number>> = {};
  Object.entries(demandByProduct).forEach(([productId, qty]) => {
    if (!qty) return;
    const bom = bomHeaders.find(b => b.product_id === productId);
    if (!bom) return;
    bomSlots
      .filter(sl => sl.bom_id === bom.id)
      .forEach(slot => {
        const opt = bomOptions.find(o => o.slot_id === slot.id && o.priority === 1);
        if (!opt) return;
        const used = qty * opt.qty_per_unit * (1 + opt.scrap_percent / 100);
        out[opt.material_id] = out[opt.material_id] || {};
        out[opt.material_id][slot.id] = (out[opt.material_id][slot.id] || 0) + used;
      });
  });
  return out;
}

/**
 * Explodes a per-product demand map into gross material requirements.
 * Callers decide what the demand represents - a sales forecast, a month of
 * the MPS, a single week of it - and the explosion rules stay identical.
 */
export function explodeBOM(demandByProduct: Record<string, number>): Record<string, number> {
  const consumption = getPrimaryBomConsumption();
  const requirements: Record<string, number> = {};

  Object.entries(demandByProduct).forEach(([productId, demand]) => {
    if (!demand) return;
    const perUnit = consumption[productId];
    if (!perUnit) return;
    Object.entries(perUnit).forEach(([materialId, qty]) => {
      requirements[materialId] = (requirements[materialId] || 0) + demand * qty;
    });
  });

  return requirements;
}

/** Nominal days in a month, used to turn monthly plan volumes into daily rates. */
export const DAYS_PER_MONTH = 30;

/**
 * Extra cover held on top of pure lead-time demand, as a multiplier.
 *
 * 1.0 would buy exactly enough to survive one replenishment cycle with no
 * margin, which leaves nothing for demand variability or a late supplier.
 * 1.25 gives a quarter of a lead time in slack.
 */
export const SAFETY_SERVICE_FACTOR = 1.25;

/** Lead time assumed when a material has none recorded, in days. */
const FALLBACK_LEAD_TIME_DAYS = 30;

/**
 * Target buffer stock for a material, in units.
 *
 * Safety stock exists to cover demand during the replenishment lead time:
 * once stock is committed, the exposure lasts exactly as long as it takes to
 * get more, so lead time - not an arbitrary number of months - is what sets
 * the buffer. A 12-day polybag and a 48-day nonwoven carry very different
 * risk, and sizing both off `safety_stock_months` charged the same months of
 * cover to each.
 *
 * A buffer is a stock level, not a flow, so it does not change with the
 * bucket size of the run: the same quantity applies whether the MRP is
 * bucketed weekly or monthly.
 *
 * Materials the plan never consumes (obsolete items, or ones with no active
 * BOM) fall back to the master-data usage rate so they still get a sane
 * target instead of zero.
 */
export function getSafetyStockQty(material: Material, avgMonthlyRequirement: number): number {
  const dailyDemand = avgMonthlyRequirement > 0
    ? avgMonthlyRequirement / DAYS_PER_MONTH
    : (material.max_usage || 500);

  // A planner who types a figure into `safety_stock_months` has made a
  // deliberate call - a volatile item, a supplier on watch, a contractual
  // minimum - and that beats the computed default.
  if (hasSafetyStockOverride(material)) {
    return material.safety_stock_months * dailyDemand * DAYS_PER_MONTH;
  }

  const leadDays = material.total_lead_time_days > 0
    ? material.total_lead_time_days
    : FALLBACK_LEAD_TIME_DAYS;
  return dailyDemand * leadDays * SAFETY_SERVICE_FACTOR;
}

/**
 * Whether this material's buffer is pinned by hand. Zero (the default) means
 * "size it from lead time"; any positive value is an explicit months-of-cover
 * instruction from a planner.
 */
export function hasSafetyStockOverride(material: Material): boolean {
  return material.safety_stock_months > 0;
}

/**
 * Months of cover the buffer represents, for display. Reads back the
 * override when one is set, otherwise the lead-time-derived figure.
 */
export function getSafetyStockMonths(material: Material): number {
  if (hasSafetyStockOverride(material)) return material.safety_stock_months;
  const leadDays = material.total_lead_time_days > 0
    ? material.total_lead_time_days
    : FALLBACK_LEAD_TIME_DAYS;
  return (leadDays * SAFETY_SERVICE_FACTOR) / DAYS_PER_MONTH;
}

/** Sums a plan table into `{ [productId]: qty }` for one month (YYYY-MM). */
function plannedQtyByProductForMonth(
  plan: Array<{ product_id: string; period_start: string; quantity: number }>,
  month: string
): Record<string, number> {
  const byProduct: Record<string, number> = {};
  plan
    .filter(row => isInPeriod(row.period_start, month))
    .forEach(row => {
      byProduct[row.product_id] = (byProduct[row.product_id] || 0) + row.quantity;
    });
  return byProduct;
}

export async function getVMaterialMonthlyProjection(materialId: string): Promise<VMaterialMonthlyProjection[]> {
  if (isSupabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase.from('v_material_monthly_projection').select('*').eq('material_id', materialId);
      if (!error && data) return data as VMaterialMonthlyProjection[];
    } catch (e) {
      console.warn("Fallback to local monthly projection");
    }
  }

  const materials = readLocalTable<Material>('materials');
  const inventory = readLocalTable<InventorySnapshot>('inventory_snapshots');
  const pos = readLocalTable<PurchaseOrder>('purchase_orders');
  const shipments = readLocalTable<Shipment>('shipments');
  const mat = materials.find(m => m.id === materialId);
  if (!mat) return [];

  // Monthly buckets anchored on the active planning period.
  const periods = getCurrentPeriods(getPlanningPeriod(), 4, 'month');
  const results: VMaterialMonthlyProjection[] = [];

  // Get initial stock
  const snap = inventory.find(i => i.item_type === 'material' && i.item_id === materialId);
  let currentStock = snap ? snap.quantity : 0;

  // Consumption is exploded from the MPS through the active BOM, exactly like the
  // MRP engine does, so this screen and the MRP grid agree on the same numbers.
  const prodPlan = readLocalTable<ProductionPlan>('production_plan');
  const usageByPeriod = periods.map(period =>
    explodeBOM(plannedQtyByProductForMonth(prodPlan, period.slice(0, 7)))[materialId] || 0
  );

  periods.forEach((p, idx) => {
    // In-transit landing this month
    const mTransit = shipments
      .filter(s => s.material_id === materialId && s.factory_arrival_date && s.factory_arrival_date.startsWith(p.slice(0, 7)))
      .reduce((sum, s) => sum + s.qty, 0);

    // Pending POs due this month
    const mPOs = pos
      .filter(po => po.material_id === materialId && po.status === 'pending' && po.required_date.startsWith(p.slice(0, 7)))
      .reduce((sum, po) => sum + po.remaining_qty, 0);

    const usage = usageByPeriod[idx];
    const ending_stock = currentStock + mTransit + mPOs - usage;
    
    // Coverage days = (ending_stock / daily consumption). With no consumption
    // planned, stock lasts indefinitely - but only if there is stock to last:
    // an empty bin covers nothing, however quiet the month is.
    const dailyDemand = usage / 30;
    const ending_coverage_days = dailyDemand > 0
      ? Math.max(0, Math.round(ending_stock / dailyDemand))
      : (ending_stock > 0 ? 999 : 0);
    const reorder_flag = ending_coverage_days < mat.reorder_point_days;

    results.push({
      material_id: materialId,
      period_start: p,
      opening_stock: currentStock,
      plan_consumption: Math.round(usage),
      in_transit_qty: mTransit,
      pending_po_qty: mPOs,
      ending_stock: Math.round(ending_stock),
      ending_coverage_days,
      reorder_flag
    });

    currentStock = Math.max(0, ending_stock);
  });

  return results;
}

export async function getVPlanVsActual(
  type: 'sales' | 'production',
  period: string = getPlanningPeriod()
): Promise<VPlanVsActual[]> {
  if (isSupabaseConnected() && supabase) {
    try {
      const view = type === 'sales' ? 'v_sales_plan_vs_actual' : 'v_production_plan_vs_actual';
      const { data, error } = await supabase.from(view).select('*');
      if (!error && data) return data as VPlanVsActual[];
    } catch (e) {
      console.warn("Fallback to local plan vs actual calculation");
    }
  }

  const products = readLocalTable<Product>('products');
  const planTable = type === 'sales' ? 'sales_plan' : 'production_plan';
  const actualTable = type === 'sales' ? 'sales_actual' : 'production_actual';

  const plan = readLocalTable<any>(planTable);
  const actual = readLocalTable<any>(actualTable);

  const results: VPlanVsActual[] = [];

  products.forEach(p => {
    const pPlan = plan.filter(pl => pl.product_id === p.id && isInPeriod(pl.period_start, period));
    const pActual = actual.filter(ac => ac.product_id === p.id && isInPeriod(ac.period_start, period));

    const plan_qty = pPlan.reduce((sum, pl) => sum + pl.quantity, 0);
    const actual_qty = pActual.reduce((sum, ac) => sum + ac.quantity, 0);
    const variance_qty = actual_qty - plan_qty;
    // No plan means there is nothing to achieve against - reporting 100% here
    // would flag un-planned SKUs as perfectly on target.
    const achievement_percent = plan_qty > 0 ? (actual_qty / plan_qty) * 100 : null;

    results.push({
      item_id: p.id,
      item_name: p.name,
      sku: p.sku,
      period: period.slice(0, 7),
      plan_qty,
      actual_qty,
      variance_qty,
      achievement_percent: achievement_percent === null ? null : parseFloat(achievement_percent.toFixed(1))
    });
  });

  return results;
}

// ==========================================
// THE MRP CALCULATION ENGINE
// ==========================================

// ==========================================
// DATE PERIOD GENERATOR HELPER
// ==========================================

export function getCurrentPeriods(startDateStr: string, horizon: number, grain: 'week' | 'month' = 'month'): string[] {
  const result: string[] = [];
  const start = new Date(startDateStr);
  if (isNaN(start.getTime()) || horizon <= 0) return [];

  if (grain === 'month') {
    // Set to first day of month
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let i = 0; i < horizon; i++) {
      const current = new Date(d.getFullYear(), d.getMonth() + i, 1);
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      result.push(`${y}-${m}-01`);
    }
  } else {
    // Week grain: starts on startDateStr, increment by 7 days
    for (let i = 0; i < horizon; i++) {
      const current = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      result.push(`${y}-${m}-${day}`);
    }
  }
  return result;
}

// ==========================================
// THE MRP CALCULATION ENGINE
// ==========================================

/**
 * Index of the bucket containing `ms`, or -1 when it falls before the run
 * starts. Buckets are contiguous, so the last one that has already begun is
 * the one that contains the instant.
 */
function periodIndexForMs(
  periods: Array<{ startMs: number }>,
  ms: number
): number {
  if (periods.length === 0 || ms < periods[0].startMs) return -1;
  for (let i = periods.length - 1; i >= 0; i--) {
    if (ms >= periods[i].startMs) return i;
  }
  return -1;
}

/**
 * Approved substitutes for a material, taken from the BOM itself.
 *
 * A slot lists its options in priority order: priority 1 is what the plan
 * consumes, anything above it is a qualified alternative someone has already
 * approved for that position. Because each option carries its own
 * qty_per_unit and scrap, the exchange is rarely one-for-one - MT2 at 1.2 with
 * 5% scrap and MT6 at 1.25 with 4% are different quantities of a different
 * material doing the same job.
 */
export function getBomAlternates(materialId: string): Array<{
  slot_id: string;
  slot_name: string;
  product_id: string;
  alternate_material_id: string;
  /** Alternate units needed per one unit of the primary it replaces. */
  conversion: number;
  primary_per_unit: number;
  alternate_per_unit: number;
}> {
  const slots = readLocalTable<BOMSlot>('bom_slots');
  const options = readLocalTable<BOMOption>('bom_options');
  const headers = readLocalTable<BOMHeader>('bom_headers');
  const out: ReturnType<typeof getBomAlternates> = [];

  const perUnit = (o: BOMOption) => o.qty_per_unit * (1 + o.scrap_percent / 100);

  slots.forEach(slot => {
    const inSlot = options.filter(o => o.slot_id === slot.id);
    const primary = inSlot.find(o => o.priority === 1);
    if (!primary || primary.material_id !== materialId) return;

    inSlot
      .filter(o => o.priority > 1)
      .sort((a, b) => a.priority - b.priority)
      .forEach(alt => {
        const p = perUnit(primary);
        const a = perUnit(alt);
        if (p <= 0) return;
        out.push({
          slot_id: slot.id,
          slot_name: slot.slot_name,
          product_id: headers.find(h => h.id === slot.bom_id)?.product_id ?? '',
          alternate_material_id: alt.material_id,
          conversion: a / p,
          primary_per_unit: p,
          alternate_per_unit: a,
        });
      });
  });

  return out;
}

export async function runMRP(
  startDate: string,
  horizon: number,
  grain: 'week' | 'month' = 'week'
): Promise<{ run_id: string; results: MRPResult[]; substitutions: SubstitutionProposal[] }> {
  if (isSupabaseConnected() && supabase) {
    try {
      // In Supabase, the RPC name is 'run_mrp'
      const { data, error } = await supabase.rpc('run_mrp', {
        p_start_date: startDate,
        p_weeks: horizon,
        p_grain: grain, // passes optional grain
      });
      if (!error && data) {
        // Fetch MRP results from table
        const runId = typeof data === 'object' ? (data as any).run_id || data : String(data);
        const { data: resData, error: resError } = await supabase.from('mrp_results').select('*').eq('run_id', runId);
        if (!resError && resData) {
          // Substitution proposals are a local-planning aid; the SQL path has
          // no equivalent view, so it returns none rather than inventing them.
          return { run_id: runId, results: resData as MRPResult[], substitutions: [] };
        }
      }
    } catch (e) {
      console.warn("Supabase run_mrp failed, falling back to local simulation", e);
    }
  }

  // --- LOCAL MRP SIMULATION ---
  const runId = 'RUN_' + Date.now().toString(36).toUpperCase();
  const materials = readLocalTable<Material>('materials');
  const prodPlan = readLocalTable<ProductionPlan>('production_plan');
  const inventory = readLocalTable<InventorySnapshot>('inventory_snapshots');
  const shipments = readLocalTable<Shipment>('shipments');
  const pos = readLocalTable<PurchaseOrder>('purchase_orders');

  // Generate start dates depending on grain
  const periodStartDates = getCurrentPeriods(startDate, horizon, grain);

  // Safety stock is a level, so it is sized off the average monthly
  // requirement across the run rather than whatever lands in one bucket.
  const monthsInRun = [...new Set(periodStartDates.map(p => p.slice(0, 7)))];
  const avgMonthlyReq: Record<string, number> = {};
  materials.forEach(m => { avgMonthlyReq[m.id] = 0; });
  monthsInRun.forEach(month => {
    Object.entries(explodeBOM(plannedQtyByProductForMonth(prodPlan, month))).forEach(([id, qty]) => {
      if (avgMonthlyReq[id] !== undefined) avgMonthlyReq[id] += qty;
    });
  });
  if (monthsInRun.length > 0) {
    materials.forEach(m => { avgMonthlyReq[m.id] /= monthsInRun.length; });
  }

  const mrpResults: MRPResult[] = [];

  // Track stock for each material. matStock is mutated as the run walks
  // forward, so the opening position is kept separately - a substitution
  // proposal needs to know what the alternate actually has on hand today.
  const matStock: Record<string, number> = {};
  const matStockOpening: Record<string, number> = {};
  materials.forEach(m => {
    const snap = inventory.find(i => i.item_type === 'material' && i.item_id === m.id);
    matStock[m.id] = snap ? snap.quantity : 0;
    matStockOpening[m.id] = matStock[m.id];
  });

  // Period boundaries, precomputed so the netting pass and the lead-time
  // offset both work off the same calendar.
  const periods = periodStartDates.map(periodStart => {
    const current = new Date(periodStart);
    const end = grain === 'month'
      ? new Date(current.getFullYear(), current.getMonth() + 1, 1)
      : new Date(current.getTime() + 7 * MS_PER_DAY);
    return {
      start: periodStart,
      startMs: current.getTime(),
      end: toDateStr(end),
      days: Math.round((end.getTime() - current.getTime()) / MS_PER_DAY)
    };
  });

  // Planned order receipts and releases, indexed [materialId][periodIndex].
  // A receipt is when stock must land; a release is when the order has to be
  // placed to make that happen. They differ by the material's lead time.
  const plannedReceipts: Record<string, number[]> = {};
  const plannedReleases: Record<string, number[]> = {};
  const pastDueReleases: Record<string, number> = {};
  // Kept per bucket as well as in total: whether a substitute can rescue a
  // shortfall depends on *when* the stock was needed, not just how much.
  const pastDueByPeriod: Record<string, number[]> = {};
  materials.forEach(m => {
    plannedReceipts[m.id] = new Array(periods.length).fill(0);
    plannedReleases[m.id] = new Array(periods.length).fill(0);
    pastDueReleases[m.id] = 0;
    pastDueByPeriod[m.id] = new Array(periods.length).fill(0);
  });

  // Run MRP period-by-period
  periods.forEach((period, pIdx) => {
    const periodStart = period.start;
    const periodEndStr = period.end;

    // 1. Calculate Gross Requirements for this period. The MPS is held at
    // month grain, so a shorter bucket takes the share of the month its own
    // length represents rather than a flat quarter.
    const plannedThisPeriod = plannedQtyByProductForMonth(prodPlan, periodStart.slice(0, 7));
    if (grain === 'week') {
      const daysInMonth = daysInMonthOf(periodStart);
      const share = period.days / daysInMonth;
      Object.keys(plannedThisPeriod).forEach(id => { plannedThisPeriod[id] *= share; });
    }

    const grossReq: Record<string, number> = {};
    materials.forEach(m => { grossReq[m.id] = 0; });
    Object.entries(explodeBOM(plannedThisPeriod)).forEach(([materialId, qty]) => {
      if (grossReq[materialId] !== undefined) grossReq[materialId] += qty;
    });

    // 2. Process Receipts and Net requirements for each material
    materials.forEach(m => {
      const req = grossReq[m.id] || 0;
      
      // Shipments arriving this period
      const arrivingShipments = shipments.filter(s => {
        if (s.material_id !== m.id || !s.factory_arrival_date) return false;
        return s.factory_arrival_date >= periodStart && s.factory_arrival_date < periodEndStr;
      });
      const transitReceipts = arrivingShipments.reduce((sum, s) => sum + s.qty, 0);

      // Pending POs due this period
      const duePOs = pos.filter(po => {
        if (po.material_id !== m.id || po.status !== 'pending') return false;
        return po.required_date >= periodStart && po.required_date < periodEndStr;
      });
      const poReceipts = duePOs.reduce((sum, po) => sum + po.remaining_qty, 0);

      const totalReceipts = transitReceipts + poReceipts;

      const safetyStockQty = getSafetyStockQty(m, avgMonthlyReq[m.id]);

      const startingStock = matStock[m.id];
      const projectedAvailableBeforeSafety = startingStock + totalReceipts - req;

      let netRequirements = 0;
      let plannedOrders = 0;

      if (projectedAvailableBeforeSafety < safetyStockQty) {
        netRequirements = safetyStockQty - projectedAvailableBeforeSafety;
        // Planned orders must respect MOQ
        plannedOrders = Math.max(m.moq, Math.ceil(netRequirements));
      }

      const projectedEndingStock = projectedAvailableBeforeSafety + plannedOrders;
      matStock[m.id] = projectedEndingStock; // updates rolling inventory

      // The order has to land in this period, so it must be placed a lead
      // time earlier. Anything whose release date falls before the run starts
      // is already late - it is collected separately rather than silently
      // pulled forward into period 0's release line.
      if (plannedOrders > 0) {
        plannedReceipts[m.id][pIdx] += plannedOrders;
        const leadDays = m.total_lead_time_days > 0 ? m.total_lead_time_days : 30;
        const releaseMs = period.startMs - leadDays * MS_PER_DAY;
        const releaseIdx = periodIndexForMs(periods, releaseMs);
        if (releaseIdx === -1) {
          pastDueReleases[m.id] += plannedOrders;
          pastDueByPeriod[m.id][pIdx] += plannedOrders;
        } else {
          plannedReleases[m.id][releaseIdx] += plannedOrders;
        }
      }

      mrpResults.push({
        id: `M_RES_${runId}_${m.id}_P${pIdx}`,
        run_id: runId,
        run_date: new Date().toISOString(),
        material_id: m.id,
        week_start_date: periodStart, // store periodStart in week_start_date column to reuse existing structure
        projected_available: Math.round(projectedEndingStock),
        safety_stock: Math.round(safetyStockQty),
        net_requirements: Math.round(netRequirements),
        planned_order_releases: 0, // filled in by the lead-time offset pass below
        planned_order_receipts: Math.round(plannedOrders),
        gross_requirements: Math.round(req),
        scheduled_receipts: Math.round(totalReceipts)
      });
    });
  });

  // Lead-time offset pass: a receipt needed in period N is released in the
  // period containing (N's start - lead time). Only now can the release line
  // be filled, because it depends on requirements discovered later in the run.
  const resultIndex = new Map<string, MRPResult>();
  mrpResults.forEach(r => resultIndex.set(`${r.material_id}|${r.week_start_date}`, r));
  materials.forEach(m => {
    periods.forEach((period, pIdx) => {
      const row = resultIndex.get(`${m.id}|${period.start}`);
      if (!row) return;
      row.planned_order_releases = Math.round(plannedReleases[m.id][pIdx]);
      if (pIdx === 0 && pastDueReleases[m.id] > 0) {
        row.past_due_releases = Math.round(pastDueReleases[m.id]);
      }
    });
  });

  // Write results to database local storage
  const currentResults = readLocalTable<MRPResult>('mrp_results');
  const combined = [...mrpResults, ...currentResults];
  writeLocalTable<MRPResult>('mrp_results', combined);

  // Slot attribution is measured over the same months the run covers, so a
  // shortfall is divided the way the plan actually consumes the material.
  const slotConsumption: Record<string, Record<string, number>> = {};
  monthsInRun.forEach(month => {
    Object.entries(primaryConsumptionBySlot(plannedQtyByProductForMonth(prodPlan, month)))
      .forEach(([matId, bySlot]) => {
        slotConsumption[matId] = slotConsumption[matId] || {};
        Object.entries(bySlot).forEach(([slotId, qty]) => {
          slotConsumption[matId][slotId] = (slotConsumption[matId][slotId] || 0) + qty;
        });
      });
  });

  const substitutions = buildSubstitutionProposals(
    materials, periods, pastDueByPeriod, matStockOpening,
    new Date(periodStartDates[0]).getTime(), slotConsumption
  );

  return { run_id: runId, results: mrpResults, substitutions };
}

/**
 * Turns un-orderable shortfalls into substitution proposals.
 *
 * A primary is past due when its own lead time has already run out. The
 * question this answers is narrower and more useful: is there an approved
 * alternate whose lead time has *not* run out, and how much of the gap can it
 * actually close? An alternate that is also too slow is reported rather than
 * hidden, because "nothing can fix this" is itself the answer a planner needs.
 */
function buildSubstitutionProposals(
  materials: Material[],
  periods: Array<{ start: string; startMs: number }>,
  pastDueByPeriod: Record<string, number[]>,
  openingStock: Record<string, number>,
  runStartMs: number,
  slotConsumption: Record<string, Record<string, number>>
): SubstitutionProposal[] {
  const byId = new Map(materials.map(m => [m.id, m]));
  const products = readLocalTable<Product>('products');
  const proposals: SubstitutionProposal[] = [];

  materials.forEach(primary => {
    const buckets = pastDueByPeriod[primary.id] || [];
    const totalShortfall = buckets.reduce((sum, q) => sum + q, 0);
    if (totalShortfall <= 0) return;

    const bySlot = slotConsumption[primary.id] || {};
    const totalConsumed = Object.values(bySlot).reduce((sum, q) => sum + q, 0);

    getBomAlternates(primary.id).forEach(alt => {
      const altMat = byId.get(alt.alternate_material_id);
      if (!altMat || altMat.status === 'obsolete') return;

      // This slot's share of the material's consumption is the share of the
      // shortfall it is answerable for. With one slot the share is 1.
      const share = totalConsumed > 0
        ? (bySlot[alt.slot_id] || 0) / totalConsumed
        : 1 / Math.max(1, getBomAlternates(primary.id).length);
      const shortfall = totalShortfall * share;
      if (shortfall <= 0) return;

      const altLead = altMat.total_lead_time_days > 0 ? altMat.total_lead_time_days : 30;
      const arrivalMs = runStartMs + altLead * MS_PER_DAY;

      // Only the buckets that begin on or after the alternate could land are
      // rescuable; the rest are past saving by any route.
      let coverable = 0;
      let coversFrom: string | null = null;
      buckets.forEach((qty, i) => {
        if (qty <= 0) return;
        if (periods[i].startMs >= arrivalMs) {
          coverable += qty * share;
          if (coversFrom === null) coversFrom = periods[i].start;
        }
      });

      proposals.push({
        id: `SUB_${primary.id}_${alt.alternate_material_id}_${alt.slot_id}`,
        material_id: primary.id,
        material_name: primary.name,
        alternate_material_id: altMat.id,
        alternate_material_name: altMat.name,
        slot_id: alt.slot_id,
        slot_name: alt.slot_name,
        product_id: alt.product_id,
        product_name: products.find(pr => pr.id === alt.product_id)?.name ?? alt.product_id,
        shortfall_qty: Math.round(shortfall),
        coverable_qty: Math.round(coverable),
        alternate_qty: Math.round(coverable * alt.conversion),
        uncoverable_qty: Math.round(shortfall - coverable),
        primary_lead_time_days: primary.total_lead_time_days,
        alternate_lead_time_days: altLead,
        earliest_arrival: toDateStr(new Date(arrivalMs)),
        covers_from_period: coversFrom,
        alternate_on_hand: Math.round(openingStock[altMat.id] || 0),
        unit_cost_delta:
          alt.alternate_per_unit * altMat.standard_cost -
          alt.primary_per_unit * primary.standard_cost,
      });
    });
  });

  // Most useful first: the ones that rescue the most.
  return proposals.sort((a, b) => b.coverable_qty - a.coverable_qty);
}
