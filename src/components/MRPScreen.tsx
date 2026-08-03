/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTableData, runMRP, saveRecord } from '../supabaseClient';
import { Material, Supplier, PurchaseOrder, MRPResult } from '../types';
import { 
  Play, Calendar, ClipboardCheck, LayoutGrid, ListTodo, ShoppingBag, 
  ShieldAlert, CheckCircle2, Truck, Plus, X, Info 
} from 'lucide-react';
import { useToast } from '../context/ToastConfirmContext';
import { useAuth } from '../context/AuthContext';
import { useTableFilters } from '../hooks/useTableFilters';
import { useFocusTrap } from '../hooks/useFocusTrap';
import SearchBar from './SearchBar';
import ScrollableTable from './ScrollableTable';
import ContentHeader from './ContentHeader';

interface MRPScreenProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  onNavigate?: (screen: any) => void;
  refreshKey?: number;
}

export default function MRPScreen({
  searchQuery = '',
  setSearchQuery = () => {},
  onNavigate,
  refreshKey = 0
}: MRPScreenProps) {
  const { showToast } = useToast();
  const { hasRole } = useAuth();
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [mrpResults, setMrpResults] = useState<MRPResult[]>([]);
  const [loading, setLoading] = useState(true);

  // MRP Run Input States
  const [startDate, setStartDate] = useState('2026-07-20');
  
  // Persist grain and horizon to localStorage
  const [grain, setGrain] = useState<'week' | 'month'>(() => {
    return (localStorage.getItem('mrp_grain') as 'week' | 'month') || 'month';
  });
  const [horizon, setHorizon] = useState<number>(() => {
    const saved = localStorage.getItem('mrp_horizon');
    if (saved) return Number(saved);
    return grain === 'month' ? 4 : 8;
  });

  const [mrpRunId, setMrpRunId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'grid' | 'orders' | 'po_board'>('grid');

  // Filters
  const [filterController, setFilterController] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  // PO Modal State
  const [poModalData, setPoModalData] = useState<{
    material: Material;
    supplier: Supplier;
    qty: number;
    requiredDate: string;
    suggestedReleaseDate: string;
  } | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('mrp_grain', grain);
  }, [grain]);

  useEffect(() => {
    localStorage.setItem('mrp_horizon', String(horizon));
  }, [horizon]);

  async function loadData(selectLatestRun = false) {
    setLoading(true);
    try {
      const [mats, sups, pos, results] = await Promise.all([
        fetchTableData<Material>('materials'),
        fetchTableData<Supplier>('suppliers'),
        fetchTableData<PurchaseOrder>('purchase_orders'),
        fetchTableData<MRPResult>('mrp_results')
      ]);
      setMaterials(mats);
      setSuppliers(sups);
      setPurchaseOrders(pos);
      setMrpResults(results);

      // Unique runs
      const uniqueRuns = Array.from(new Set(results.map(r => r.run_id)));
      if (uniqueRuns.length > 0) {
        if (selectLatestRun || !mrpRunId || !uniqueRuns.includes(mrpRunId)) {
          setMrpRunId(uniqueRuns[0]);
        }
      }
    } catch (e: any) {
      showToast('Failed to load MRP data: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const handleRunMRP = async () => {
    setLoading(true);
    try {
      const { run_id } = await runMRP(startDate, horizon, grain);
      setMrpRunId(run_id);
      await loadData(true);
      showToast(`MRP completed successfully! Run ID: ${run_id}`, 'success');
    } catch (err: any) {
      showToast("MRP execution failed: " + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Unique runs with date info
  const runOptions = useMemo(() => {
    return Array.from(new Set(mrpResults.map(r => r.run_id))).map(runId => {
      const firstMatch = mrpResults.find(r => r.run_id === runId);
      let runDateStr = '';
      if (firstMatch && firstMatch.run_date) {
        const d = new Date(firstMatch.run_date);
        runDateStr = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return {
        runId,
        label: `${runId} (${runDateStr || 'No Timestamp'})`
      };
    });
  }, [mrpResults]);

  // Extract unique periods for the active run
  const activeRunResults = useMemo(() => {
    return mrpResults.filter(r => r.run_id === mrpRunId);
  }, [mrpResults, mrpRunId]);

  const buckets = useMemo(() => {
    return (Array.from(new Set(activeRunResults.map(r => r.week_start_date))) as string[])
      .sort((a, b) => a.localeCompare(b));
  }, [activeRunResults]);

  const selectedRunTimestamp = () => {
    const firstMatch = activeRunResults[0];
    if (firstMatch && firstMatch.run_date) {
      return new Date(firstMatch.run_date).toLocaleString('en-US');
    }
    return null;
  };

  // Filter materials using the useTableFilters hook
  const { filtered: filteredMaterials, hasActiveSearch } = useTableFilters<Material>(
    materials.filter(m => m.status !== 'obsolete'),
    ['name', 'sku'],
    { controller: filterController, supplier_id: filterSupplier },
    searchQuery,
    setSearchQuery
  );

  // Calculate planned orders list for active run
  const allPlannedOrders = useMemo(() => {
    return activeRunResults
      .filter(r => r.planned_order_releases > 0)
      .map(r => {
        const mat = materials.find(m => m.id === r.material_id);
        const sup = suppliers.find(s => s.id === mat?.supplier_id);

        const weekStart = new Date(r.week_start_date);
        const offsetDays = mat ? mat.total_lead_time_days : 15;
        const releaseDate = new Date(weekStart);
        releaseDate.setDate(weekStart.getDate() - offsetDays);

        return {
          id: r.id,
          material_id: r.material_id,
          material_name: mat ? mat.name : 'Unknown',
          sku: mat ? mat.sku : '',
          quantity: r.planned_order_releases,
          supplier_id: mat ? mat.supplier_id : '',
          supplier_name: sup ? sup.name : 'Unknown',
          required_date: r.week_start_date,
          release_date: releaseDate.toISOString().slice(0, 10),
          controller: mat ? mat.controller : ''
        };
      })
      .sort((a, b) => a.release_date.localeCompare(b.release_date));
  }, [activeRunResults, materials, suppliers]);

  // Filter planned orders list using the hook
  const { filtered: plannedOrdersList } = useTableFilters<any>(
    allPlannedOrders,
    ['material_name', 'sku'],
    { controller: filterController, supplier_id: filterSupplier },
    searchQuery,
    setSearchQuery
  );

  // Timing style helpers
  const getTimingColor = (timing: string) => {
    if (timing === 'Check with Proc.') return 'bg-red-50 text-red-700 border-red-200';
    if (timing === 'Need to be Closed') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  // Open the purchase order pre-creation dialog
  const openCreatePoDialog = (materialId: string, qty: number, requiredDate: string) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to raise purchase orders.', 'error');
      return;
    }
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return;
    const sup = suppliers.find(s => s.id === mat.supplier_id);
    if (!sup) {
      showToast(`Cannot create PO. No supplier assigned to material: ${mat.name}`, 'error');
      return;
    }

    const weekStart = new Date(requiredDate);
    const offsetDays = mat.total_lead_time_days || 15;
    const releaseDate = new Date(weekStart);
    releaseDate.setDate(weekStart.getDate() - offsetDays);

    setPoModalData({
      material: mat,
      supplier: sup,
      qty,
      requiredDate,
      suggestedReleaseDate: releaseDate.toISOString().slice(0, 10)
    });
  };

  // Execute actual PO creation
  const handleConfirmCreatePO = async () => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to raise purchase orders.', 'error');
      return;
    }
    if (!poModalData) return;
    setLoading(true);

    try {
      const { material, supplier, qty, requiredDate } = poModalData;
      const orderNo = `PO-${Date.now().toString().slice(-6)}`;
      const newPO: PurchaseOrder = {
        id: `PO_REC_${Date.now()}`,
        material_id: material.id,
        supplier_id: supplier.id,
        order_no: orderNo,
        qty: qty,
        remaining_qty: qty,
        required_date: requiredDate,
        status: 'pending',
        timing: 'Normal',
        po_date: new Date().toISOString().slice(0, 10),
        unit_price: material.standard_cost || 0
      };

      await saveRecord('purchase_orders', newPO);
      
      // Auto re-run MRP solver so grid is instantly rebuilt with the new scheduled receipts
      await runMRP(startDate, horizon, grain);
      await loadData();

      setPoModalData(null);
      showToast(`Purchase Order ${orderNo} created successfully!`, 'success');
    } catch (e: any) {
      showToast('Failed to create Purchase Order: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Setup PO modal Focus Trap
  const poModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(poModalRef, poModalData !== null, () => setPoModalData(null));

  return (
    <div className="space-y-6" id="mrp_screen">
      <ContentHeader
        title="Material Requirements Planner (MRP)"
        subtitle="Trigger bill-of-materials explosion, inventory netting, lead-time offsets, and evaluate planned procurement orders."
        actions={
          <div className="bg-white border border-gray-200 p-2 rounded-xl flex items-center flex-wrap gap-2.5 shadow-xs text-xs font-sans">
            <div className="flex items-center gap-1 font-semibold text-gray-600">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Start Date:
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="p-1 border border-gray-300 rounded bg-white text-xs font-mono" 
              />
            </div>

            <div className="flex items-center gap-1.5 font-semibold text-gray-600">
              Grain:
              <div className="flex bg-slate-100 border border-slate-300 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setGrain('week');
                    setHorizon(8);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    grain === 'week' 
                      ? 'bg-white text-blue-600 shadow-2xs' 
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGrain('month');
                    setHorizon(4);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    grain === 'month' 
                      ? 'bg-white text-blue-600 shadow-2xs' 
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 font-semibold text-gray-600">
              Horizon:
              <select 
                value={horizon} 
                onChange={e => setHorizon(Number(e.target.value))} 
                className="p-1 border border-gray-300 rounded bg-white text-xs text-gray-700 cursor-pointer"
              >
                {grain === 'month' ? (
                  <>
                    <option value={2}>2 Months</option>
                    <option value={3}>3 Months</option>
                    <option value={4}>4 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months</option>
                  </>
                ) : (
                  <>
                    <option value={4}>4 Weeks</option>
                    <option value={6}>6 Weeks</option>
                    <option value={8}>8 Weeks</option>
                    <option value={12}>12 Weeks</option>
                    <option value={16}>16 Weeks</option>
                  </>
                )}
              </select>
            </div>

            <button
              id="btn_run_mrp_execution"
              onClick={handleRunMRP}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              Run Solver
            </button>
          </div>
        }
      />

      {/* Mode selectors and filters bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-gray-200 pb-2 font-sans">
        <div className="flex flex-wrap gap-2">
          <button
            id="mrp_tab_grid"
            onClick={() => setActiveTab('grid')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'grid' 
                ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-extrabold' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Time-Phased Grid
          </button>
          <button
            id="mrp_tab_orders"
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'orders' 
                ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-extrabold' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            Planned Releases ({plannedOrdersList.length})
          </button>
          <button
            id="mrp_tab_po_board"
            onClick={() => setActiveTab('po_board')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'po_board' 
                ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-extrabold' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            PO Board
          </button>
        </div>

        {/* Filters, Search and Run Picker */}
        <div className="flex flex-wrap items-center gap-2.5">
          {runOptions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 uppercase">Run:</span>
              <select
                value={mrpRunId || ''}
                onChange={(e) => setMrpRunId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold focus:outline-hidden cursor-pointer"
              >
                {runOptions.map(opt => (
                  <option key={opt.runId} value={opt.runId}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search components..."
            className="w-40"
            hasActiveSearch={hasActiveSearch}
          />

          {!hasActiveSearch && (
            <>
              <select
                value={filterController}
                onChange={(e) => setFilterController(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden text-gray-600 cursor-pointer"
              >
                <option value="">All Controllers</option>
                <option value="Mohamed Amr">Mohamed Amr</option>
                <option value="Amr Anwar">Amr Anwar</option>
              </select>

              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden text-gray-600 cursor-pointer"
              >
                <option value="">All Suppliers</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Show active run timestamp */}
      {selectedRunTimestamp() && (
        <div className="flex items-center justify-between text-xs text-gray-400 font-mono px-1">
          <span>Active Run ID: <strong className="text-blue-600">{mrpRunId}</strong></span>
          <span>Calculated on: {selectedRunTimestamp()}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white border border-gray-100 rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div id="mrp_tab_content_wrapper" className="font-sans">
          {/* 1. Time-Phased Grid Tab */}
          {activeTab === 'grid' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              {buckets.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <ClipboardCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs">No active MRP plans found. Click <b>"Run Solver"</b> above to trigger calculations.</p>
                </div>
              ) : (
                <ScrollableTable>
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs font-sans">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 sticky left-0 bg-gray-50 z-10 min-w-[200px] border-r border-gray-100">Material Component</th>
                        <th className="px-4 py-3 min-w-[130px] border-r border-gray-100">Time-Phased Metric</th>
                        {buckets.map(wk => {
                          const date = new Date(wk);
                          const headerStr = date.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: grain === 'month' ? undefined : '2-digit',
                            year: grain === 'month' ? 'numeric' : undefined
                          });
                          return (
                            <th key={wk} className="px-4 py-3 text-right font-mono min-w-[130px]">{headerStr}</th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-xs">
                      {filteredMaterials.map(m => {
                        return (
                          <React.Fragment key={m.id}>
                            {/* Material Header Line */}
                            <tr className="bg-slate-50/60 font-semibold border-t border-slate-200/80">
                              <td className="px-4 py-2 sticky left-0 bg-slate-50/95 z-10 font-bold text-slate-800 border-r border-gray-100" colSpan={2}>
                                {m.name} <span className="text-[10px] text-gray-400 font-mono font-medium font-normal ml-2">({m.sku} | MOQ: {m.moq})</span>
                              </td>
                              {buckets.map(wk => <td key={wk} className="px-4 py-2 text-right"></td>)}
                            </tr>

                            {/* 1. Gross Requirements */}
                            <tr className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-1.5 sticky left-0 bg-white z-10 text-slate-400 text-[11px] border-r border-gray-100"></td>
                              <td className="px-4 py-1.5 text-slate-500 font-medium border-r border-gray-100 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                Gross Requirements
                              </td>
                              {buckets.map(wk => {
                                const result = activeRunResults.find(r => r.material_id === m.id && r.week_start_date === wk);
                                const gross = result?.gross_requirements || 0;
                                return (
                                  <td key={wk} className="px-4 py-1.5 text-right font-mono text-slate-600">
                                    {gross > 0 ? gross.toLocaleString() : '-'}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* 2. Scheduled Receipts */}
                            <tr className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-1.5 sticky left-0 bg-white z-10 text-slate-400 text-[11px] border-r border-gray-100"></td>
                              <td className="px-4 py-1.5 text-emerald-800 font-medium border-r border-gray-100 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Scheduled Receipts
                              </td>
                              {buckets.map(wk => {
                                const result = activeRunResults.find(r => r.material_id === m.id && r.week_start_date === wk);
                                const receipts = result?.scheduled_receipts || 0;
                                return (
                                  <td key={wk} className="px-4 py-1.5 text-right font-mono text-emerald-700 font-semibold">
                                    {receipts > 0 ? `+${receipts.toLocaleString()}` : '-'}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* 3. Projected Available Stock */}
                            <tr className="hover:bg-slate-50/30 transition-colors bg-blue-50/5">
                              <td className="px-4 py-1.5 sticky left-0 bg-white z-10 text-slate-400 text-[11px] border-r border-gray-100"></td>
                              <td className="px-4 py-1.5 text-blue-800 font-semibold border-r border-gray-100 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Projected Stock
                              </td>
                              {buckets.map(wk => {
                                const result = activeRunResults.find(r => r.material_id === m.id && r.week_start_date === wk);
                                const projVal = result ? result.projected_available : 0;
                                const ssVal = result ? result.safety_stock : 5000;
                                const isBelowSS = projVal < ssVal;
                                return (
                                  <td key={wk} className={`px-4 py-1.5 text-right font-mono font-bold ${isBelowSS ? 'text-red-600 bg-red-50/60' : 'text-blue-700'}`}>
                                    {projVal.toLocaleString()}
                                    {isBelowSS && (
                                      <span className="block text-[8px] font-extrabold text-red-500 font-sans tracking-wide uppercase mt-0.5">Below SS ({ssVal.toLocaleString()})</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* 4. Planned Order Releases */}
                            <tr className="hover:bg-slate-50/30 transition-colors border-b border-gray-100 bg-amber-50/5">
                              <td className="px-4 py-2 sticky left-0 bg-white z-10 text-slate-400 text-[11px] border-r border-gray-100"></td>
                              <td className="px-4 py-2 text-amber-800 font-bold border-r border-gray-100 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Planned Releases
                              </td>
                              {buckets.map(wk => {
                                const result = activeRunResults.find(r => r.material_id === m.id && r.week_start_date === wk);
                                const release = result ? result.planned_order_releases : 0;
                                return (
                                  <td key={wk} className="px-4 py-2 text-right font-mono">
                                    {release > 0 ? (
                                      <div className="flex flex-col items-end gap-1">
                                        <span className="text-amber-700 font-bold">+{release.toLocaleString()}</span>
                                        <button
                                          onClick={() => openCreatePoDialog(m.id, release, wk)}
                                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold flex items-center gap-0.5 shadow-sm transition-all cursor-pointer"
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                          Create PO
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          )}

          {/* 2. Planned Orders Tab */}
          {activeTab === 'orders' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <ScrollableTable>
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Suggested Release Date</th>
                      <th className="px-4 py-3">Material Required</th>
                      <th className="px-4 py-3 text-right">Planned Qty</th>
                      <th className="px-4 py-3">Supplier Assigned</th>
                      <th className="px-4 py-3">Required Arrival Date</th>
                      <th className="px-4 py-3">Buyer / Controller</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-900">
                    {plannedOrdersList.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-600 font-mono">{order.release_date}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{order.material_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{order.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono">{order.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-600">{order.supplier_name}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{order.required_date}</td>
                        <td className="px-4 py-3 text-gray-500">{order.controller || 'Mohamed Amr'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openCreatePoDialog(order.material_id, order.quantity, order.required_date)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-xs transition-all cursor-pointer"
                          >
                            Create PO
                          </button>
                        </td>
                      </tr>
                    ))}
                    {plannedOrdersList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No planned orders generated for this period. Run MRP or adjust MPS production metrics.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          )}

          {/* 3. Purchase Orders Board Tab */}
          {activeTab === 'po_board' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="po_board_grids_container">
              {/* Column 1: Planned / NO PO */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> No PO (Planned)
                  </h4>
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-full">
                    {plannedOrdersList.length}
                  </span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {plannedOrdersList.map(order => (
                    <div key={order.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-2xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
                      <div>
                        <h5 className="font-semibold text-xs text-gray-900">{order.material_name}</h5>
                        <p className="text-[9px] text-gray-400 font-mono">{order.sku}</p>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase font-sans">Suggested Qty:</span>
                        <span className="font-bold font-mono text-xs">{order.quantity.toLocaleString()}</span>
                      </div>
                      <div className="text-[9px] text-gray-500 flex justify-between border-t border-gray-100 pt-1.5">
                        <span>Release: {order.release_date}</span>
                        <span>Assign: {order.supplier_name.split(' ')[0]}</span>
                      </div>
                      <button
                        onClick={() => openCreatePoDialog(order.material_id, order.quantity, order.required_date)}
                        className="w-full mt-1.5 py-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded border border-blue-200 transition-all cursor-pointer"
                      >
                        Create Purchase Order
                      </button>
                    </div>
                  ))}
                  {plannedOrdersList.length === 0 && (
                    <div className="p-6 text-center text-[11px] text-gray-400">All planned stock arrivals are covered by open supplier POs. No shortage gaps found.</div>
                  )}
                </div>
              </div>

              {/* Column 2: Pending (ordered, not shipped) */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Pending POs
                  </h4>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                    {purchaseOrders.filter(p => p.status === 'pending').length}
                  </span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {purchaseOrders.filter(p => p.status === 'pending').map(po => {
                    const mat = materials.find(m => m.id === po.material_id);
                    const sup = suppliers.find(s => s.id === po.supplier_id);
                    return (
                      <div key={po.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-start">
                          <h5 className="font-semibold text-xs text-gray-900">{mat ? mat.name : 'Unknown'}</h5>
                          <span className={`px-1.5 py-0.5 rounded-sm border text-[9px] font-bold ${getTimingColor(po.timing)}`}>
                            {po.timing}
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-mono">{po.order_no}</p>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-[10px] text-gray-400">Order Qty:</span>
                          <span className="font-bold font-mono">{po.remaining_qty.toLocaleString()}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 flex justify-between border-t border-gray-100 pt-1.5">
                          <span>Required: {po.required_date}</span>
                          <span>Supplier: {sup ? sup.name.split(' ')[0] : 'Unknown'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: In Transit */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> In Transit
                  </h4>
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">
                    {purchaseOrders.filter(p => p.status === 'in_transit').length}
                  </span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {purchaseOrders.filter(p => p.status === 'in_transit').map(po => {
                    const mat = materials.find(m => m.id === po.material_id);
                    const sup = suppliers.find(s => s.id === po.supplier_id);
                    return (
                      <div key={po.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
                        <h5 className="font-semibold text-xs text-gray-900">{mat ? mat.name : 'Unknown'}</h5>
                        <p className="text-[9px] text-gray-400 font-mono">{po.order_no}</p>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-[10px] text-gray-400 font-sans">Ship Qty:</span>
                          <span className="font-bold font-mono text-indigo-600">{po.qty.toLocaleString()}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 flex justify-between border-t border-gray-100 pt-1.5">
                          <span>Required: {po.required_date}</span>
                          <span>Supplier: {sup ? sup.name.split(' ')[0] : 'Unknown'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {purchaseOrders.filter(p => p.status === 'in_transit').length === 0 && (
                    <div className="p-6 text-center text-[11px] text-gray-400">No active orders currently tracked in transit. Convert open POs in the Logistics tab.</div>
                  )}
                </div>
              </div>

              {/* Column 4: Completed */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </h4>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    {purchaseOrders.filter(p => p.status === 'completed').length}
                  </span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {purchaseOrders.filter(p => p.status === 'completed').map(po => {
                    const mat = materials.find(m => m.id === po.material_id);
                    const sup = suppliers.find(s => s.id === po.supplier_id);
                    return (
                      <div key={po.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs space-y-2 opacity-80 animate-in fade-in zoom-in-95 duration-150">
                        <h5 className="font-semibold text-xs text-gray-900">{mat ? mat.name : 'Unknown'}</h5>
                        <p className="text-[9px] text-gray-400 font-mono">{po.order_no}</p>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-[10px] text-gray-400 font-sans">Received Qty:</span>
                          <span className="font-bold font-mono text-emerald-600">{po.qty.toLocaleString()}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 flex justify-between border-t border-gray-100 pt-1.5">
                          <span>Received: {po.required_date}</span>
                          <span>Supplier: {sup ? sup.name.split(' ')[0] : 'Unknown'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE PURCHASE ORDER CONFIRMATION MODAL */}
      {poModalData && (
        <div className="fixed inset-0 z-[4600] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" ref={poModalRef}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-gray-100 font-sans">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-600" /> Confirm Purchase Order
              </h3>
              <button 
                onClick={() => setPoModalData(null)} 
                className="text-gray-400 hover:text-gray-600 font-bold p-1 bg-white border border-gray-200 rounded-md shadow-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs leading-relaxed">
              <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 rounded-lg">
                Confirming this action will generate a pending Purchase Order and register a corresponding Scheduled Receipt in future MRP runs.
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Material Name</span>
                  <span className="font-semibold text-gray-800 text-right max-w-[200px] truncate">{poModalData.material.name}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Material SKU</span>
                  <span className="font-semibold font-mono text-gray-800">{poModalData.material.sku}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Supplier Assigned</span>
                  <span className="font-semibold text-gray-800">{poModalData.supplier.name}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Suggested Qty</span>
                  <span className="font-bold text-slate-800 font-mono">{poModalData.qty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Lead-Time (Supplier + Transit)</span>
                  <span className="font-semibold text-gray-800 font-mono">{poModalData.material.total_lead_time_days} days</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Required Date</span>
                  <span className="font-semibold text-blue-600 font-mono">{poModalData.requiredDate}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Suggested Release Date</span>
                  <span className="font-semibold text-amber-600 font-mono">{poModalData.suggestedReleaseDate}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Unit Price</span>
                  <span className="font-semibold text-emerald-600 font-mono">${(poModalData.material.standard_cost || 0).toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated Total Value</span>
                  <span className="font-extrabold text-emerald-600 font-mono text-sm">${((poModalData.material.standard_cost || 0) * poModalData.qty).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 bg-slate-50">
              <button 
                onClick={() => setPoModalData(null)}
                className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmCreatePO}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs cursor-pointer"
              >
                Confirm & Create PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
