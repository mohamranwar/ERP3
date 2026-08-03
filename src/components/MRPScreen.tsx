/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  fetchTableData,
  runMRP,
  saveRecord,
  getPlanningPeriod,
  getSafetyStockMonths,
  SAFETY_SERVICE_FACTOR,
  MS_PER_DAY,
  toDateStr
} from '../supabaseClient';
import { Material, Supplier, PurchaseOrder, MRPResult } from '../types';
import {
  Play, Calendar, ClipboardCheck, LayoutGrid, ListTodo, ShoppingBag,
  ShieldAlert, CheckCircle2, Truck, Plus, X, Info, ChevronDown, ChevronRight
} from 'lucide-react';

/**
 * Cell styling for a projected stock figure against its safety level.
 * Red once the buffer is breached, amber while it is within 15% of it -
 * that band is the window where a planner can still act before it bites.
 */
function stockCellClass(projected: number, safetyStock: number): string {
  if (safetyStock <= 0) return 'text-blue-700';
  if (projected < safetyStock) return 'text-red-600 bg-red-50/60';
  if (projected < safetyStock * 1.15) return 'text-amber-700 bg-amber-50/50';
  return 'text-blue-700';
}
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

  // MRP Run Input States. The run starts from the period selected in the app
  // header, so the MRP and every other screen describe the same window.
  const [startDate, setStartDate] = useState(() => getPlanningPeriod());
  
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
    // A period change in the header bumps refreshKey; follow it so the next
    // solver run covers the window the rest of the app is showing.
    setStartDate(getPlanningPeriod());
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

  /**
   * Inclusive start/end labels per bucket. A bucket runs until the next one
   * begins, so the last one is closed off using the run's own grain.
   */
  const bucketRanges = useMemo(() => {
    return buckets.map((start, i) => {
      const startDateObj = new Date(start);
      const nextStart = i + 1 < buckets.length
        ? new Date(buckets[i + 1])
        : grain === 'month'
          ? new Date(startDateObj.getFullYear(), startDateObj.getMonth() + 1, 1)
          : new Date(startDateObj.getTime() + 7 * MS_PER_DAY);
      const endDateObj = new Date(nextStart.getTime() - MS_PER_DAY);
      const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      return {
        start,
        end: toDateStr(endDateObj),
        label: `${fmt(startDateObj)} - ${fmt(endDateObj)}`,
        year: startDateObj.getFullYear()
      };
    });
  }, [buckets, grain]);

  /** Rows keyed by material and bucket, so cells are a lookup instead of a scan. */
  const resultLookup = useMemo(() => {
    const map = new Map<string, MRPResult>();
    activeRunResults.forEach(r => map.set(`${r.material_id}|${r.week_start_date}`, r));
    return map;
  }, [activeRunResults]);

  /** Materials the planner has opened to see the full metric breakdown. */
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());

  const toggleMaterial = (id: string) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

        // The engine already placed this release in the bucket it must be
        // ordered in, so the bucket date *is* the release date. The arrival
        // it covers is a lead time later.
        const offsetDays = mat ? mat.total_lead_time_days : 15;
        const arrival = new Date(new Date(r.week_start_date).getTime() + offsetDays * MS_PER_DAY);

        return {
          id: r.id,
          material_id: r.material_id,
          material_name: mat ? mat.name : 'Unknown',
          sku: mat ? mat.sku : '',
          quantity: r.planned_order_releases,
          supplier_id: mat ? mat.supplier_id : '',
          supplier_name: sup ? sup.name : 'Unknown',
          required_date: toDateStr(arrival),
          release_date: r.week_start_date,
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
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // Open the purchase order pre-creation dialog
  const openCreatePoDialog = (materialId: string, qty: number, releaseDate: string) => {
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

    // The grid cell is the release bucket; the goods are needed a lead time
    // after it, which is the date the PO must be satisfied by.
    const offsetDays = mat.total_lead_time_days || 15;
    const arrival = new Date(new Date(releaseDate).getTime() + offsetDays * MS_PER_DAY);

    setPoModalData({
      material: mat,
      supplier: sup,
      qty,
      requiredDate: toDateStr(arrival),
      suggestedReleaseDate: releaseDate
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
          <div className="bg-white border border-slate-200 p-2 rounded-xl flex items-center flex-wrap gap-2.5 shadow-xs text-xs font-sans">
            <div className="flex items-center gap-1 font-semibold text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Start Date:
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="p-1 border border-slate-300 rounded bg-white text-xs font-mono" 
              />
            </div>

            <div className="flex items-center gap-1.5 font-semibold text-slate-600">
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
                      : 'text-slate-500 hover:text-slate-800'
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
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 font-semibold text-slate-600">
              Horizon:
              <select 
                value={horizon} 
                onChange={e => setHorizon(Number(e.target.value))} 
                className="p-1 border border-slate-300 rounded bg-white text-xs text-slate-700 cursor-pointer"
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-2 font-sans">
        <div className="flex flex-wrap gap-2">
          <button
            id="mrp_tab_grid"
            onClick={() => setActiveTab('grid')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'grid' 
                ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-extrabold' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
              <span className="text-xs font-semibold text-slate-500 uppercase">Run:</span>
              <select
                value={mrpRunId || ''}
                onChange={(e) => setMrpRunId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
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
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden text-slate-600 cursor-pointer"
              >
                <option value="">All Controllers</option>
                <option value="Mohamed Amr">Mohamed Amr</option>
                <option value="Amr Anwar">Amr Anwar</option>
              </select>

              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden text-slate-600 cursor-pointer"
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
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
          <span>Active Run ID: <strong className="text-blue-600">{mrpRunId}</strong></span>
          <span>Calculated on: {selectedRunTimestamp()}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white border border-slate-100 rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div id="mrp_tab_content_wrapper" className="font-sans">
          {/* 1. Time-Phased Grid Tab */}
          {activeTab === 'grid' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              {buckets.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs">No active MRP plans found. Click <b>"Run Solver"</b> above to trigger calculations.</p>
                </div>
              ) : (
                <ScrollableTable>
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs font-sans">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 min-w-[260px] border-r border-slate-100">Material Component</th>
                        <th className="px-4 py-3 min-w-[150px] border-r border-slate-100">Time-Phased Metric</th>
                        {bucketRanges.map(b => (
                          <th key={b.start} className="px-4 py-3 text-right min-w-[150px]">
                            <span className="block font-mono text-[11px] text-slate-600 normal-case">{b.label}</span>
                            <span className="block font-mono text-[9px] text-slate-400 font-normal normal-case">{b.year}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredMaterials.map(m => {
                        const isExpanded = expandedMaterials.has(m.id);
                        const rowFor = (wk: string) => resultLookup.get(`${m.id}|${wk}`);
                        const shortfallBuckets = buckets.filter(wk => {
                          const r = rowFor(wk);
                          return r ? r.projected_available < r.safety_stock : false;
                        }).length;
                        const pastDue = buckets.reduce(
                          (sum, wk) => sum + (rowFor(wk)?.past_due_releases || 0), 0
                        );

                        return (
                          <React.Fragment key={m.id}>
                            {/* Material summary line - always visible, click to expand */}
                            <tr
                              className="bg-slate-50/60 font-semibold border-t border-slate-200/80 hover:bg-slate-100/70 cursor-pointer transition-colors"
                              onClick={() => toggleMaterial(m.id)}
                            >
                              <td className="px-4 py-2 sticky left-0 bg-slate-50/95 z-10 font-bold text-slate-800 border-r border-slate-100">
                                <div className="flex items-center gap-1.5">
                                  {isExpanded
                                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                                  <span>{m.name}</span>
                                </div>
                                <span className="block text-[10px] text-slate-400 font-mono font-normal mt-0.5 pl-5">
                                  {m.sku} | MOQ {m.moq.toLocaleString()} | Lead {m.total_lead_time_days}d
                                </span>
                              </td>
                              <td className="px-4 py-2 border-r border-slate-100 align-middle">
                                {/* Netting tops stock up to the safety level, so a bucket rarely
                                    reads short. The real exposure is an order that had to be
                                    placed before this run began - it cannot arrive on time. */}
                                {pastDue > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                                    <ShieldAlert className="w-3 h-3" />
                                    Order late
                                  </span>
                                ) : shortfallBuckets > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                                    <ShieldAlert className="w-3 h-3" />
                                    {shortfallBuckets} short
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    On plan
                                  </span>
                                )}
                                {pastDue > 0 && (
                                  <span className="block mt-1 text-[9px] font-bold text-red-600 font-mono">
                                    {pastDue.toLocaleString()} to expedite
                                  </span>
                                )}
                              </td>
                              {buckets.map(wk => {
                                const r = rowFor(wk);
                                const proj = r ? r.projected_available : 0;
                                const ss = r ? r.safety_stock : 0;
                                return (
                                  <td key={wk} className={`px-4 py-2 text-right font-mono font-bold ${stockCellClass(proj, ss)}`}>
                                    {proj.toLocaleString()}
                                  </td>
                                );
                              })}
                            </tr>

                            {isExpanded && (
                              <>
                                {/* 1. Gross Requirements */}
                                <tr className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-1.5 sticky left-0 bg-white z-10 border-r border-slate-100"></td>
                                  <td className="px-4 py-1.5 text-slate-500 font-medium border-r border-slate-100">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                      Gross Requirements
                                    </span>
                                  </td>
                                  {buckets.map(wk => {
                                    const gross = rowFor(wk)?.gross_requirements || 0;
                                    return (
                                      <td key={wk} className="px-4 py-1.5 text-right font-mono text-slate-600">
                                        {gross > 0 ? gross.toLocaleString() : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* 2. Scheduled Receipts */}
                                <tr className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-1.5 sticky left-0 bg-white z-10 border-r border-slate-100"></td>
                                  <td className="px-4 py-1.5 text-emerald-800 font-medium border-r border-slate-100">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      Scheduled Receipts
                                    </span>
                                  </td>
                                  {buckets.map(wk => {
                                    const receipts = rowFor(wk)?.scheduled_receipts || 0;
                                    return (
                                      <td key={wk} className="px-4 py-1.5 text-right font-mono text-emerald-700 font-semibold">
                                        {receipts > 0 ? `+${receipts.toLocaleString()}` : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* 3. Safety Stock - the level the plan is netted against */}
                                <tr className="hover:bg-slate-50/30 transition-colors bg-amber-50/20">
                                  <td className="px-4 py-1.5 sticky left-0 bg-white z-10 border-r border-slate-100"></td>
                                  <td className="px-4 py-1.5 text-amber-900 font-medium border-r border-slate-100">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                      Safety Stock
                                      <span
                                        className="text-[9px] text-amber-600 font-mono font-normal"
                                        title={`${m.total_lead_time_days} days lead time x ${SAFETY_SERVICE_FACTOR} service factor`}
                                      >
                                        ({getSafetyStockMonths(m).toFixed(1)}mo)
                                      </span>
                                    </span>
                                  </td>
                                  {buckets.map(wk => {
                                    const ss = rowFor(wk)?.safety_stock || 0;
                                    return (
                                      <td key={wk} className="px-4 py-1.5 text-right font-mono text-amber-800 border-b border-dashed border-amber-200">
                                        {ss > 0 ? ss.toLocaleString() : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* 4. Projected Available Stock */}
                                <tr className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-1.5 sticky left-0 bg-white z-10 border-r border-slate-100"></td>
                                  <td className="px-4 py-1.5 text-blue-800 font-semibold border-r border-slate-100">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                      Projected Stock
                                    </span>
                                  </td>
                                  {buckets.map(wk => {
                                    const r = rowFor(wk);
                                    const proj = r ? r.projected_available : 0;
                                    const ss = r ? r.safety_stock : 0;
                                    const below = proj < ss;
                                    return (
                                      <td key={wk} className={`px-4 py-1.5 text-right font-mono font-bold ${stockCellClass(proj, ss)}`}>
                                        {proj.toLocaleString()}
                                        {below && (
                                          <span className="block text-[8px] font-extrabold text-red-500 font-sans tracking-wide uppercase mt-0.5">
                                            {(ss - proj).toLocaleString()} below SS
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* 5. Net Requirements - the shortfall before MOQ rounding */}
                                <tr className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-1.5 sticky left-0 bg-white z-10 border-r border-slate-100"></td>
                                  <td className="px-4 py-1.5 text-red-800 font-medium border-r border-slate-100">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                      Net Requirements
                                    </span>
                                  </td>
                                  {buckets.map(wk => {
                                    const net = rowFor(wk)?.net_requirements || 0;
                                    return (
                                      <td key={wk} className="px-4 py-1.5 text-right font-mono text-red-700">
                                        {net > 0 ? net.toLocaleString() : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* 6. Planned Receipts - when stock has to land */}
                                <tr className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-1.5 sticky left-0 bg-white z-10 border-r border-slate-100"></td>
                                  <td className="px-4 py-1.5 text-indigo-800 font-medium border-r border-slate-100">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                      Planned Receipts
                                    </span>
                                  </td>
                                  {buckets.map(wk => {
                                    const rec = rowFor(wk)?.planned_order_receipts || 0;
                                    return (
                                      <td key={wk} className="px-4 py-1.5 text-right font-mono text-indigo-700">
                                        {rec > 0 ? rec.toLocaleString() : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* 7. Planned Order Releases - when to place the order */}
                                <tr className="hover:bg-slate-50/30 transition-colors border-b border-slate-100 bg-amber-50/5">
                                  <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r border-slate-100"></td>
                                  <td className="px-4 py-2 text-amber-800 font-bold border-r border-slate-100">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                      Planned Releases
                                    </span>
                                  </td>
                                  {buckets.map((wk, bIdx) => {
                                    const release = rowFor(wk)?.planned_order_releases || 0;
                                    // Releases whose date has already passed still have to be
                                    // raised - later than ideal, but they are the most urgent
                                    // thing on the screen. Surface them in the first bucket so
                                    // the planner can act instead of only being told they exist.
                                    const late = bIdx === 0 ? pastDue : 0;
                                    if (release === 0 && late === 0) {
                                      return <td key={wk} className="px-4 py-2 text-right font-mono text-slate-400">-</td>;
                                    }
                                    return (
                                      <td key={wk} className={`px-4 py-2 text-right font-mono ${late > 0 ? 'bg-red-50/60' : ''}`}>
                                        <div className="flex flex-col items-end gap-1">
                                          {late > 0 && (
                                            <>
                                              <span className="text-[8px] font-extrabold text-red-600 font-sans tracking-wide uppercase">
                                                Past due - expedite
                                              </span>
                                              <span className="text-red-700 font-bold">{late.toLocaleString()}</span>
                                              <button
                                                onClick={() => openCreatePoDialog(m.id, late, wk)}
                                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[9px] font-bold flex items-center gap-0.5 shadow-sm transition-all cursor-pointer"
                                              >
                                                <Plus className="w-2.5 h-2.5" />
                                                Expedite PO
                                              </button>
                                            </>
                                          )}
                                          {release > 0 && (
                                            <>
                                              <span className="text-amber-700 font-bold">+{release.toLocaleString()}</span>
                                              <button
                                                onClick={() => openCreatePoDialog(m.id, release, wk)}
                                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold flex items-center gap-0.5 shadow-sm transition-all cursor-pointer"
                                              >
                                                <Plus className="w-2.5 h-2.5" />
                                                Create PO
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              </>
                            )}
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
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <ScrollableTable>
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                  <tbody className="divide-y divide-slate-200 text-slate-900">
                    {plannedOrdersList.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-blue-600 font-mono">{order.release_date}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{order.material_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{order.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono">{order.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600">{order.supplier_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{order.required_date}</td>
                        <td className="px-4 py-3 text-slate-500">{order.controller || 'Mohamed Amr'}</td>
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
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No planned orders generated for this period. Run MRP or adjust MPS production metrics.</td>
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
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
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
                        <h5 className="font-semibold text-xs text-slate-900">{order.material_name}</h5>
                        <p className="text-[9px] text-slate-400 font-mono">{order.sku}</p>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase font-sans">Suggested Qty:</span>
                        <span className="font-bold font-mono text-xs">{order.quantity.toLocaleString()}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
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
                    <div className="p-6 text-center text-[11px] text-slate-400">All planned stock arrivals are covered by open supplier POs. No shortage gaps found.</div>
                  )}
                </div>
              </div>

              {/* Column 2: Pending (ordered, not shipped) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
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
                      <div key={po.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-start">
                          <h5 className="font-semibold text-xs text-slate-900">{mat ? mat.name : 'Unknown'}</h5>
                          <span className={`px-1.5 py-0.5 rounded-sm border text-[9px] font-bold ${getTimingColor(po.timing)}`}>
                            {po.timing}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono">{po.order_no}</p>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-[10px] text-slate-400">Order Qty:</span>
                          <span className="font-bold font-mono">{po.remaining_qty.toLocaleString()}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                          <span>Required: {po.required_date}</span>
                          <span>Supplier: {sup ? sup.name.split(' ')[0] : 'Unknown'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: In Transit */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
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
                      <div key={po.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
                        <h5 className="font-semibold text-xs text-slate-900">{mat ? mat.name : 'Unknown'}</h5>
                        <p className="text-[9px] text-slate-400 font-mono">{po.order_no}</p>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-[10px] text-slate-400 font-sans">Ship Qty:</span>
                          <span className="font-bold font-mono text-indigo-600">{po.qty.toLocaleString()}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                          <span>Required: {po.required_date}</span>
                          <span>Supplier: {sup ? sup.name.split(' ')[0] : 'Unknown'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {purchaseOrders.filter(p => p.status === 'in_transit').length === 0 && (
                    <div className="p-6 text-center text-[11px] text-slate-400">No active orders currently tracked in transit. Convert open POs in the Logistics tab.</div>
                  )}
                </div>
              </div>

              {/* Column 4: Completed */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col h-[65vh]">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
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
                      <div key={po.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 opacity-80 animate-in fade-in zoom-in-95 duration-150">
                        <h5 className="font-semibold text-xs text-slate-900">{mat ? mat.name : 'Unknown'}</h5>
                        <p className="text-[9px] text-slate-400 font-mono">{po.order_no}</p>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-[10px] text-slate-400 font-sans">Received Qty:</span>
                          <span className="font-bold font-mono text-emerald-600">{po.qty.toLocaleString()}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 font-sans">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-600" /> Confirm Purchase Order
              </h3>
              <button 
                onClick={() => setPoModalData(null)} 
                className="text-slate-400 hover:text-slate-600 font-bold p-1 bg-white border border-slate-200 rounded-md shadow-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs leading-relaxed">
              <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 rounded-lg">
                Confirming this action will generate a pending Purchase Order and register a corresponding Scheduled Receipt in future MRP runs.
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Material Name</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[200px] truncate">{poModalData.material.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Material SKU</span>
                  <span className="font-semibold font-mono text-slate-800">{poModalData.material.sku}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Supplier Assigned</span>
                  <span className="font-semibold text-slate-800">{poModalData.supplier.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Suggested Qty</span>
                  <span className="font-bold text-slate-800 font-mono">{poModalData.qty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Lead-Time (Supplier + Transit)</span>
                  <span className="font-semibold text-slate-800 font-mono">{poModalData.material.total_lead_time_days} days</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Required Date</span>
                  <span className="font-semibold text-blue-600 font-mono">{poModalData.requiredDate}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Suggested Release Date</span>
                  <span className="font-semibold text-amber-600 font-mono">{poModalData.suggestedReleaseDate}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Unit Price</span>
                  <span className="font-semibold text-emerald-600 font-mono">${(poModalData.material.standard_cost || 0).toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated Total Value</span>
                  <span className="font-extrabold text-emerald-600 font-mono text-sm">${((poModalData.material.standard_cost || 0) * poModalData.qty).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button 
                onClick={() => setPoModalData(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
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
