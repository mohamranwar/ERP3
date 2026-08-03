/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  explodeBOM,
  getPlannedPeriods,
  getSafetyStockQty,
  getPlanningPeriod,
  setPlanningPeriod,
  formatPlanningPeriod,
  getVBOMCostDetail,
  getVFGCost,
  getVMaterialCoverage,
  getVMaterialMonthlyProjection,
  getVProductCoverage,
  getVPlanVsActual,
  runMRP,
} from '../src/supabaseClient';

// All figures below are hand-derived from the seed data in src/supabaseClient.ts
// (INITIAL_PRODUCTS, INITIAL_MATERIALS, INITIAL_BOM_*, INITIAL_SALES_PLAN,
// INITIAL_SALES_ACTUAL, INITIAL_INVENTORY, INITIAL_POS, INITIAL_SHIPMENTS),
// which is unchanged from the earlier review of this codebase. These are
// regression tests: if the seed data or the calculation engine changes,
// these numbers should be re-derived by hand rather than copied from the
// new code, or the test loses its value as an independent check.

// The engine now reports on whichever planning period is selected, defaulting
// to the real current month. Every expectation below is derived from July 2026,
// so pin the period rather than letting the wall clock decide what these tests
// are measuring.
beforeEach(() => {
  setPlanningPeriod('2026-07-01');
});

describe('getVBOMCostDetail / getVFGCost - BOM cost rollup for P1 (BabyJoy Maxi S4)', () => {
  // BS1 Core Fluff Pulp   -> MT1 qty 4.5  scrap 3%  std_cost 1.50 (RM)
  // BS2 Top Sheet Surface -> MT2 qty 1.2  scrap 5%  std_cost 0.80 (RM, primary)
  //                          MT6 qty 1.25 scrap 4%  std_cost 0.72 (RM, alternate)
  // BS3 Super Absorbent   -> MT5 qty 2.0  scrap 2%  std_cost 2.20 (RM)
  // BS4 Packaging Carton  -> MT4 qty 0.25 scrap 1%  std_cost 1.20 (PK, weighted_avg
  //                          basis, but no MT4 purchase orders exist so it falls
  //                          back to standard_cost)
  // line_cost = qty_per_unit * (1 + scrap%/100) * unit_cost
  //   MT1: 4.5  * 1.03 * 1.50 = 6.9525
  //   MT2: 1.2  * 1.05 * 0.80 = 1.008
  //   MT5: 2.0  * 1.02 * 2.20 = 4.488
  //   MT4: 0.25 * 1.01 * 1.20 = 0.303
  // selling_price(P1) = 18.5

  it('returns all 5 BOM option rows (primary + alternate)', async () => {
    const details = await getVBOMCostDetail('P1');
    expect(details).toHaveLength(5);
  });

  it('computes the primary Core Pulp line cost correctly', async () => {
    const details = await getVBOMCostDetail('P1');
    const corePulp = details.find(d => d.material_id === 'MT1');
    expect(corePulp!.line_cost).toBeCloseTo(6.9525, 4);
  });

  it('falls back to standard_cost for a weighted_avg material with no PO history (MT4)', async () => {
    const details = await getVBOMCostDetail('P1');
    const carton = details.find(d => d.material_id === 'MT4');
    expect(carton!.unit_cost).toBeCloseTo(1.2, 4);
    expect(carton!.line_cost).toBeCloseTo(0.303, 4);
  });

  it('rolls up only priority-1 lines into RM/PK/CON costs and computes margin%', async () => {
    const cost = await getVFGCost('P1');
    expect(cost!.rm_cost).toBeCloseTo(12.4485, 4); // MT1 + MT2 + MT5
    expect(cost!.pk_cost).toBeCloseTo(0.303, 4); // MT4
    expect(cost!.con_cost).toBe(0);
    expect(cost!.total_material_cost).toBeCloseTo(12.7515, 4);
    expect(cost!.margin_percent).toBeCloseTo(31.07, 1);
  });

  it('returns null/empty for unknown products', async () => {
    expect(await getVFGCost('NOPE')).toBeNull();
    expect(await getVBOMCostDetail('NOPE')).toEqual([]);
  });
});

describe('getVMaterialCoverage / getVProductCoverage - stock coverage flags', () => {
  // MT3 (used only in P2's BOM, qty/unit 0.125, scrap 0%):
  //   P2 forecast demand 2026-07-01 = SP5(200000) + SP6(80000) = 280000
  //   monthly_demand = 280000 * 0.125 = 35000
  //   opening_stock = 3000, in-transit (SH1) = 25000
  //   PO3 status is 'in_transit' (not 'pending'), so it must NOT double-count
  //   total_available = 3000 + 25000 + 0 = 28000 -> coverage = 0.8mo -> OOS risk

  it('flags MT3 as an out-of-stock risk and excludes its in_transit-status PO from pendingPoQty', async () => {
    const rows = await getVMaterialCoverage('forecast');
    const mt3 = rows.find(r => r.material_id === 'MT3');
    expect(mt3!.monthly_demand).toBe(35000);
    expect(mt3!.coverage_months).toBeCloseTo(0.8, 2);
    expect(mt3!.oos_risk_flag).toBe(true);
  });

  // MT5 (SAP, used only in P1's BOM slot BS3, qty/unit 2.0, scrap 2%):
  //   P1 forecast demand 2026-07-01 = SP1..SP4 = 275000
  //   monthly_demand = 275000 * 2.0 * 1.02 = 561000
  //   opening_stock = 1750000, no in-transit, PO4 pending = 80000
  //   total_available = 1830000 -> coverage 3.26mo -> overstock (> 3.0)
  it('flags MT5 as overstock once incoming POs are counted', async () => {
    const rows = await getVMaterialCoverage('forecast');
    const mt5 = rows.find(r => r.material_id === 'MT5');
    expect(mt5!.monthly_demand).toBe(561000);
    expect(mt5!.coverage_months).toBeCloseTo(3.26, 2);
    expect(mt5!.overstock_flag).toBe(true);
    expect(mt5!.oos_risk_flag).toBe(false);
  });

  // MT4 (carton, P1 only, qty/unit 0.25, scrap 1%):
  //   monthly_demand = 275000 * 0.25 * 1.01 = 69437.5
  //   opening_stock = 175000, no receipts -> 2.52mo: neither at risk nor overstocked.
  // This is the seed dataset's "healthy" example - without it every band in the
  // coverage UI except the red one would be unreachable in demo mode.
  it('leaves MT4 in the healthy band - neither OOS risk nor overstock', async () => {
    const rows = await getVMaterialCoverage('forecast');
    const mt4 = rows.find(r => r.material_id === 'MT4');
    expect(mt4!.coverage_months).toBeCloseTo(2.52, 2);
    expect(mt4!.oos_risk_flag).toBe(false);
    expect(mt4!.overstock_flag).toBe(false);
  });

  it('computes P1 product coverage from opening stock over July forecast demand', async () => {
    const rows = await getVProductCoverage('forecast');
    const p1 = rows.find(r => r.product_id === 'P1');
    expect(p1!.monthly_demand).toBe(275000); // SP1+SP2+SP3+SP4
    expect(p1!.coverage_months).toBeCloseTo(0.24, 2);
    expect(p1!.below_safety_flag).toBe(true);
  });

  it('uses sales actuals instead of forecast when demandBasis is "sales"', async () => {
    const rows = await getVProductCoverage('sales');
    const p1 = rows.find(r => r.product_id === 'P1');
    expect(p1!.monthly_demand).toBe(191000); // SA1(142000) + SA2(49000)
  });
});

describe('getVPlanVsActual - sales plan vs actual for 2026-07-01', () => {
  it('computes variance and achievement% for P1 and P2', async () => {
    const rows = await getVPlanVsActual('sales');

    const p1 = rows.find(r => r.item_id === 'P1');
    expect(p1!.plan_qty).toBe(275000);
    expect(p1!.actual_qty).toBe(191000);
    expect(p1!.variance_qty).toBe(-84000);
    expect(p1!.achievement_percent).toBeCloseTo(69.5, 1);

    const p2 = rows.find(r => r.item_id === 'P2');
    expect(p2!.plan_qty).toBe(280000);
    expect(p2!.actual_qty).toBe(215000);
    expect(p2!.variance_qty).toBe(-65000);
    expect(p2!.achievement_percent).toBeCloseTo(76.8, 1);
  });

  it('reports no achievement figure for a product with zero plan', async () => {
    // P6 has no July sales_plan rows at all. Dividing by a zero plan has no
    // meaningful answer, so the engine returns null and the UI renders "No
    // plan" - it used to return 100, which painted un-planned SKUs green as
    // if they were perfectly on target.
    const rows = await getVPlanVsActual('sales');
    const p6 = rows.find(r => r.item_id === 'P6');
    expect(p6!.plan_qty).toBe(0);
    expect(p6!.actual_qty).toBe(0);
    expect(p6!.achievement_percent).toBeNull();
  });
});

describe('explodeBOM - the shared BOM explosion', () => {
  // Stock coverage, the MRP engine and the Material Check drill-down all route
  // through this one function. They used to each carry their own copy of the
  // explosion loop, which is how they drifted apart.
  it('explodes a per-product demand map into material requirements', () => {
    // P1 only: 100000 units
    //   MT1 100000 * 4.5  * 1.03 = 463500
    //   MT2 100000 * 1.2  * 1.05 = 126000
    //   MT5 100000 * 2.0  * 1.02 = 204000
    //   MT4 100000 * 0.25 * 1.01 =  25250
    const req = explodeBOM({ P1: 100000 });
    expect(req.MT1).toBeCloseTo(463500, 4);
    expect(req.MT2).toBeCloseTo(126000, 4);
    expect(req.MT5).toBeCloseTo(204000, 4);
    expect(req.MT4).toBeCloseTo(25250, 4);
  });

  it('sums across products that share a material', () => {
    // MT1 is consumed by both P1 (4.5, 3%) and P2 (2.1, 2%).
    const req = explodeBOM({ P1: 100000, P2: 100000 });
    expect(req.MT1).toBeCloseTo(463500 + 214200, 4);
  });

  it('never consumes priority-2 alternates', () => {
    // MT6 is the alternate top sheet on both P1 and P2.
    const req = explodeBOM({ P1: 100000, P2: 100000 });
    expect(req.MT6).toBeUndefined();
  });

  it('ignores products with no active BOM and zero demand', () => {
    expect(explodeBOM({ P3: 100000 })).toEqual({});
    expect(explodeBOM({ P1: 0 })).toEqual({});
    expect(explodeBOM({})).toEqual({});
  });
});

describe('getVMaterialMonthlyProjection - Material Check drill-down', () => {
  // Consumption is exploded from the MPS through the active BOM, so it must
  // agree with what runMRP() reports for the same material and month.
  //   MT1 is consumed by P1 (4.5/unit, 3% scrap) and P2 (2.1/unit, 2% scrap).
  //   Jul MPS: PP1 P1=260000, PP2 P2=290000
  //     260000 * 4.5 * 1.03 = 1205100
  //     290000 * 2.1 * 1.02 =  621180
  //     total               = 1826280
  it('explodes MT1 consumption from the production plan, not a hardcoded constant', async () => {
    const rows = await getVMaterialMonthlyProjection('MT1');
    const jul = rows.find(r => r.period_start === '2026-07-01');
    expect(jul!.plan_consumption).toBe(1826280);
    expect(jul!.opening_stock).toBe(220000);
  });

  it('agrees with the MRP engine on gross requirements for the same month', async () => {
    const projection = await getVMaterialMonthlyProjection('MT1');
    const { results } = await runMRP('2026-07-01', 3, 'month');

    for (const row of projection.slice(0, 3)) {
      const mrpRow = results.find(
        r => r.material_id === 'MT1' && r.week_start_date === row.period_start
      );
      expect(mrpRow!.gross_requirements).toBe(row.plan_consumption);
    }
  });

  it('reports zero consumption for months with no production plan', async () => {
    // October 2026 has no MPS rows in the seed data.
    const rows = await getVMaterialMonthlyProjection('MT1');
    const oct = rows.find(r => r.period_start === '2026-10-01');
    expect(oct!.plan_consumption).toBe(0);
    // MT1 is exhausted by then, so a quiet month still covers nothing - the
    // zero-demand branch used to report a flat 999 days regardless of stock.
    expect(oct!.ending_stock).toBe(0);
    expect(oct!.ending_coverage_days).toBe(0);
  });

  it('returns zero consumption for a material no active BOM consumes', async () => {
    // MT6 is only ever a priority-2 alternate, so the MPS never consumes it.
    const rows = await getVMaterialMonthlyProjection('MT6');
    expect(rows.every(r => r.plan_consumption === 0)).toBe(true);
  });
});

describe('runMRP - offline MRP simulation', () => {
  it('produces one result row per material per period', async () => {
    const { results } = await runMRP('2026-07-01', 4, 'week');
    // 6 seeded materials x 4 weeks = 24 rows.
    expect(results).toHaveLength(24);
  });

  it('never proposes a planned order release below net requirements (MOQ floor)', async () => {
    const { results } = await runMRP('2026-07-01', 4, 'week');
    for (const row of results) {
      if (row.planned_order_releases > 0) {
        expect(row.planned_order_releases).toBeGreaterThanOrEqual(row.net_requirements);
      }
    }
  });

  it('supports a month-grain horizon via getCurrentPeriods without throwing', async () => {
    const { results } = await runMRP('2026-07-01', 3, 'month');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].week_start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a distinct run_id on each invocation', async () => {
    const first = await runMRP('2026-07-01', 2, 'week');
    await new Promise(resolve => setTimeout(resolve, 5));
    const second = await runMRP('2026-07-01', 2, 'week');
    expect(first.run_id).not.toBe(second.run_id);
  });
});


describe('the active planning period', () => {
  it('lists every month the dataset plans for, oldest first', () => {
    // Seed sales plans cover Jul/Aug/Sep 2026; production plans the same.
    expect(getPlannedPeriods()).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });

  it('round-trips a selected period and persists it', () => {
    setPlanningPeriod('2026-09-01');
    expect(getPlanningPeriod()).toBe('2026-09-01');
    setPlanningPeriod('2026-07-01');
    expect(getPlanningPeriod()).toBe('2026-07-01');
  });

  it('reports plan vs actual against the selected period, not a fixed month', async () => {
    setPlanningPeriod('2026-08-01');
    const aug = await getVPlanVsActual('sales');
    const p1Aug = aug.find(r => r.item_id === 'P1');
    // SP7(160000) + SP8(55000), and no August actuals exist.
    expect(p1Aug!.plan_qty).toBe(215000);
    expect(p1Aug!.actual_qty).toBe(0);
    expect(p1Aug!.period).toBe('2026-08');

    setPlanningPeriod('2026-07-01');
    const jul = await getVPlanVsActual('sales');
    expect(jul.find(r => r.item_id === 'P1')!.plan_qty).toBe(275000);
  });

  it('explodes coverage demand from the selected period', async () => {
    setPlanningPeriod('2026-08-01');
    const rows = await getVMaterialCoverage('forecast');
    // MT5 is P1-only: Aug forecast 215000 * 2.0 * 1.02 = 438600
    expect(rows.find(r => r.material_id === 'MT5')!.monthly_demand).toBe(438600);
  });

  it('accepts an explicit period argument that overrides the selection', async () => {
    setPlanningPeriod('2026-07-01');
    const rows = await getVPlanVsActual('sales', '2026-08-01');
    expect(rows.find(r => r.item_id === 'P1')!.plan_qty).toBe(215000);
  });

  it('formats a period for display', () => {
    expect(formatPlanningPeriod('2026-08-01')).toBe('August 2026');
  });
});


describe('getSafetyStockQty - demand-based buffers', () => {
  const mt1 = { safety_stock_months: 1.5, max_usage: 1200 } as any;

  it('sizes the buffer off monthly consumption, not a daily rate', () => {
    // MT1 July requirement is 1,826,280/month at 1.5 months of cover.
    expect(getSafetyStockQty(mt1, 1826280)).toBeCloseTo(2739420, 4);
  });

  it('falls back to the master-data usage rate when the plan consumes nothing', () => {
    // Obsolete or un-BOMed materials still need a target, not zero.
    expect(getSafetyStockQty(mt1, 0)).toBeCloseTo(1.5 * 1200 * 30, 4);
  });

  it('is a stock level, so it does not scale with the MRP bucket size', async () => {
    // Both runs cover exactly July: one month-bucket, or four week-buckets.
    const monthly = await runMRP('2026-07-01', 1, 'month');
    const weekly = await runMRP('2026-07-01', 4, 'week');

    const mFirst = monthly.results.find(r => r.material_id === 'MT1')!;
    const wFirst = weekly.results.find(r => r.material_id === 'MT1')!;
    // Previously the monthly run's buffer was 4x the weekly run's for the
    // same material and the same span, purely because of the bucket size.
    expect(mFirst.safety_stock).toBe(wFirst.safety_stock);
    expect(mFirst.safety_stock).toBe(Math.round(1826280 * 1.5));
  });

  it('sizes the buffer over the months the run spans', async () => {
    // A longer horizon averages more months, so the buffer reflects the whole
    // window being planned rather than just its first bucket.
    const oneMonth = await runMRP('2026-07-01', 1, 'month');
    const threeMonths = await runMRP('2026-07-01', 3, 'month');
    const jul = oneMonth.results.find(r => r.material_id === 'MT1')!;
    const q3 = threeMonths.results.find(r => r.material_id === 'MT1')!;
    expect(jul.safety_stock).toBe(Math.round(1826280 * 1.5));
    expect(q3.safety_stock).toBe(Math.round(((1826280 + 1940400 + 1758510) / 3) * 1.5));
  });

  it('drives MRP planned releases off a buffer proportional to demand', async () => {
    const { results } = await runMRP('2026-07-01', 3, 'month');
    const jul = results.find(r => r.material_id === 'MT1' && r.week_start_date === '2026-07-01')!;
    // Avg monthly requirement over Jul/Aug/Sep, x 1.5 months.
    const avg = (1826280 + 1940400 + 1758510) / 3;
    expect(jul.safety_stock).toBe(Math.round(avg * 1.5));
    expect(jul.safety_stock).toBeGreaterThan(1000000);
  });
});
