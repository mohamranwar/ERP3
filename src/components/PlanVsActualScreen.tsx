/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { getVPlanVsActual, fetchTableData, getPlanningPeriod, formatPlanningPeriod } from '../supabaseClient';
import { VPlanVsActual, Product, Machine, Channel } from '../types';
import { RefreshCw, AlertCircle, Cpu } from 'lucide-react';
import { useTableFilters } from '../hooks/useTableFilters';
import SearchBar from './SearchBar';
import ScrollableTable from './ScrollableTable';
import ContentHeader from './ContentHeader';

interface PlanVsActualScreenProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  refreshKey?: number;
}

export default function PlanVsActualScreen({
  searchQuery = '',
  setSearchQuery = () => {},
  refreshKey = 0,
}: PlanVsActualScreenProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'production' | 'export'>('sales');
  const period = getPlanningPeriod();
  const [salesCompare, setSalesCompare] = useState<VPlanVsActual[]>([]);
  const [productionCompare, setProductionCompare] = useState<VPlanVsActual[]>([]);
  const [exportCompare, setExportCompare] = useState<VPlanVsActual[]>([]);
  const [loading, setLoading] = useState(true);

  // Machine metrics
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productionPlans, setProductionPlans] = useState<any[]>([]);
  const [productionActuals, setProductionActuals] = useState<any[]>([]);
  const [machineCompare, setMachineCompare] = useState<any[]>([]);

  const getProductionRate = (lineName: string): number => {
    switch (lineName) {
      case 'SOFY': return 900;
      case 'VOXY': return 600;
      case 'Atlas': return 500;
      case 'Pants': return 600;
      default: return 500;
    }
  };

  async function loadData() {
    setLoading(true);
    try {
      const [salesData, prodData, allSalesPlans, allSalesActuals, productsData, machinesData, prodPlans, prodActuals, channelsData] = await Promise.all([
        getVPlanVsActual('sales'),
        getVPlanVsActual('production'),
        fetchTableData<any>('sales_plan'),
        fetchTableData<any>('sales_actual'),
        fetchTableData<Product>('products'),
        fetchTableData<Machine>('machines'),
        fetchTableData<any>('production_plan'),
        fetchTableData<any>('production_actual'),
        fetchTableData<Channel>('channels')
      ]);

      // Resolve the Export channel by name rather than a hardcoded id - the
      // literal 'C4' would silently start returning all-zero rows if that
      // channel's id ever changed in master data.
      const exportChannelId = channelsData.find(c => c.name === 'Export Global')?.id;

      setSalesCompare(salesData);
      setProductionCompare(prodData);
      setProducts(productsData);
      setMachines(machinesData);
      setProductionPlans(prodPlans);
      setProductionActuals(prodActuals);

      // Compute Machine Compare stats
      const computedMachineCompare = machinesData.map(mac => {
        const mProducts = productsData.filter(p => p.product_line === mac.name);
        const speed = getProductionRate(mac.name);
        const availableHours = mac.monthly_capacity ? (mac.monthly_capacity / speed) : 600;

        let plannedHours = 0;
        let actualHours = 0;

        mProducts.forEach(p => {
          const planQty = prodPlans
            .filter(pl => pl.product_id === p.id && pl.period_start === period)
            .reduce((sum, pl) => sum + pl.quantity, 0);
          plannedHours += planQty / speed;

          const actualQty = prodActuals
            .filter(ac => ac.product_id === p.id && ac.period_start === period)
            .reduce((sum, ac) => sum + ac.quantity, 0);
          actualHours += actualQty / speed;
        });

        const plannedUtil = availableHours > 0 ? (plannedHours / availableHours) * 100 : 0;
        const actualUtil = availableHours > 0 ? (actualHours / availableHours) * 100 : 0;

        return {
          id: mac.id,
          name: mac.name,
          description: mac.description,
          available_hours: parseFloat(availableHours.toFixed(1)),
          planned_hours: parseFloat(plannedHours.toFixed(1)),
          actual_hours: parseFloat(actualHours.toFixed(1)),
          planned_util: parseFloat(plannedUtil.toFixed(1)),
          actual_util: parseFloat(actualUtil.toFixed(1)),
          variance_hours: parseFloat((actualHours - plannedHours).toFixed(1))
        };
      });

      setMachineCompare(computedMachineCompare);

      // Compute export comparisons (channel resolved by name above, not hardcoded)
      const exportRows: VPlanVsActual[] = productsData.map(p => {
        const pPlans = allSalesPlans.filter(s => s.product_id === p.id && s.channel_id === exportChannelId && s.period_start === period);
        const pActuals = allSalesActuals.filter(s => s.product_id === p.id && s.channel_id === exportChannelId && s.period_start === period);

        const plan_qty = pPlans.reduce((sum, s) => sum + s.quantity, 0);
        const actual_qty = pActuals.reduce((sum, s) => sum + s.quantity, 0);
        const variance_qty = actual_qty - plan_qty;
        // No plan means there is nothing to achieve against - see getVPlanVsActual.
        const achievement_percent = plan_qty > 0 ? (actual_qty / plan_qty) * 100 : null;

        return {
          item_id: p.id,
          item_name: p.name,
          sku: p.sku,
          period: period.slice(0, 7),
          plan_qty,
          actual_qty,
          variance_qty,
          achievement_percent: achievement_percent === null ? null : parseFloat(achievement_percent.toFixed(1))
        };
      });

      setExportCompare(exportRows);
    } catch (e) {
      console.error("Failed to load plan vs actual comparison datasets", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const activeDataset = useMemo((): VPlanVsActual[] => {
    if (activeTab === 'sales') return salesCompare;
    if (activeTab === 'production') return productionCompare;
    return exportCompare;
  }, [activeTab, salesCompare, productionCompare, exportCompare]);

  const getAchievementColor = (pct: number | null) => {
    if (pct === null) return 'text-slate-500 bg-slate-100 border-slate-200';
    if (pct >= 100) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    if (pct >= 85) return 'text-amber-700 bg-amber-100 border-amber-200';
    return 'text-red-700 bg-red-100 border-red-200';
  };

  // Filtration using useTableFilters hook
  const { filtered: filteredData, hasActiveSearch } = useTableFilters<VPlanVsActual>(
    activeDataset,
    ['item_name', 'sku'],
    {},
    searchQuery,
    setSearchQuery
  );

  return (
    <div className="space-y-6" id="plan_vs_actual_screen">
      <ContentHeader
        title="Plan vs Actual Analytics"
        subtitle="Evaluate forecast accuracy, production achievements, and export shipment variance ratios."
        actions={
          <div className="flex items-center gap-1.5 bg-gray-100 p-0.5 rounded-lg" id="pva_tab_selector">
            {(['sales', 'production', 'export'] as const).map(tab => (
              <button
                key={tab}
                id={`pva_tab_btn_${tab}`}
                onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === tab ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'export' ? 'Export Shipments' : `${tab} Plan`}
              </button>
            ))}
          </div>
        }
      />

      {/* Stats Summary Cards for the active planning period */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-xs space-y-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Overall Plan Target</span>
          <h4 className="text-xl font-bold text-gray-900 font-mono">
            {activeDataset.reduce((sum, d) => sum + d.plan_qty, 0).toLocaleString()} <span className="text-xs text-gray-400 font-sans">units</span>
          </h4>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-xs space-y-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Overall Actual Achieved</span>
          <h4 className="text-xl font-bold text-gray-900 font-mono">
            {activeDataset.reduce((sum, d) => sum + d.actual_qty, 0).toLocaleString()} <span className="text-xs text-gray-400 font-sans">units</span>
          </h4>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-xs space-y-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Variance & Achievement Rate</span>
          {(() => {
            const plan = activeDataset.reduce((sum, d) => sum + d.plan_qty, 0);
            const act = activeDataset.reduce((sum, d) => sum + d.actual_qty, 0);
            const varQty = act - plan;
            const ach = plan > 0 ? (act / plan) * 100 : 100;
            return (
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-bold text-gray-900 font-mono">
                  {ach.toFixed(1)}%
                </h4>
                <span className={`text-xs px-2 py-0.5 rounded-sm font-semibold ${varQty >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {varQty >= 0 ? '+' : ''}{varQty.toLocaleString()}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 font-sans">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search items by name or SKU..."
          className="flex-1 max-w-sm"
          hasActiveSearch={hasActiveSearch}
        />

        <div className="flex items-center gap-1.5 text-xs text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 ml-auto">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span><b>Target Period:</b> {formatPlanningPeriod(period)}</span>
        </div>

        <button onClick={loadData} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors cursor-pointer" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'production' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 font-sans">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Machine Capacity & Hours Utilization Control Tower</h3>
                  <p className="text-[10px] text-gray-500">Maps production volumes to actual machine hours based on standard line speeds compared to available capacity limits.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {machineCompare.map(mac => {
                  const isOverloaded = mac.actual_util > 95;
                  return (
                    <div key={mac.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{mac.name} Line</span>
                          <span className={`text-[10px] font-mono font-bold px-1 rounded ${isOverloaded ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {mac.actual_util}%
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-sans line-clamp-1">{mac.description}</p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>Avail:</span>
                          <span className="font-bold">{mac.available_hours} hrs</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>Planned:</span>
                          <span className="font-bold text-blue-600">{mac.planned_hours} hrs ({mac.planned_util}%)</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>Actual:</span>
                          <span className={`font-bold ${isOverloaded ? 'text-red-600' : 'text-slate-800'}`}>{mac.actual_hours} hrs</span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isOverloaded ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, mac.actual_util)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs font-sans">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                {activeTab === 'sales' ? 'SKU Sales Demand Achievement' : activeTab === 'export' ? 'SKU Export Orders Variance' : 'SKU Production Volume Achievement'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <ScrollableTable>
                <table className="min-w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 border-r border-slate-200">SKU</th>
                      <th className="px-3 py-2 border-r border-slate-200">Item Description</th>
                      <th className="px-3 py-2 border-r border-slate-200 text-right">Plan Quantity</th>
                      <th className="px-3 py-2 border-r border-slate-200 text-right">Actual Volume</th>
                      <th className="px-3 py-2 border-r border-slate-200 text-right">Variance Balance</th>
                      <th className="px-3 py-2 border-r border-slate-200 text-right">Achievement %</th>
                      <th className="px-3 py-2 min-w-[120px]">Gauge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-900">
                    {filteredData.map(d => {
                      const isPositive = d.variance_qty >= 0;

                      return (
                        <tr key={d.item_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-mono text-slate-500 font-semibold border-r border-slate-200">{d.sku}</td>
                          <td className="px-3 py-2 font-bold text-slate-800 border-r border-slate-200">{d.item_name}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-600 border-r border-slate-200">
                            {d.plan_qty.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-900 border-r border-slate-200">
                            {d.actual_qty.toLocaleString()}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-bold border-r border-slate-200 ${
                            isPositive ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {isPositive ? '+' : ''}{d.variance_qty.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-slate-200">
                            <span className={`px-1.5 py-0.5 rounded-[3px] border text-[10px] font-mono font-bold ${getAchievementColor(d.achievement_percent)}`}>
                              {d.achievement_percent === null ? 'No plan' : `${d.achievement_percent}%`}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              {d.achievement_percent !== null && (
                                <div
                                  className={`h-full rounded-full ${
                                    d.achievement_percent >= 100 ? 'bg-emerald-500' :
                                    d.achievement_percent >= 85 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(100, d.achievement_percent)}%` }}
                                ></div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                          No items match the search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
