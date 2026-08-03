/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { fetchTableData, getVMaterialMonthlyProjection, getSafetyStockQty } from '../supabaseClient';
import { Material, VMaterialMonthlyProjection, Supplier, MaterialCategory, MaterialAlternative } from '../types';
import { Layers, ShieldAlert, Sparkles, TrendingUp, Info, RefreshCw, Calendar } from 'lucide-react';
import DataStateWrapper from './DataStateWrapper';
import { useTableFilters } from '../hooks/useTableFilters';
import SearchBar from './SearchBar';
import ScrollableTable from './ScrollableTable';
import ContentHeader from './ContentHeader';

interface MaterialDrillDownProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  refreshKey?: number;
}

export default function MaterialDrillDown({
  searchQuery = '',
  setSearchQuery = () => {},
  refreshKey = 0,
}: MaterialDrillDownProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [alternatives, setAlternatives] = useState<MaterialAlternative[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');

  // Projections
  const [projections, setProjections] = useState<VMaterialMonthlyProjection[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadInitial() {
    setLoading(true);
    setError(null);
    try {
      const [mats, sups, cats, alts, shps, pos] = await Promise.all([
        fetchTableData<Material>('materials'),
        fetchTableData<Supplier>('suppliers'),
        fetchTableData<MaterialCategory>('material_categories'),
        fetchTableData<MaterialAlternative>('material_alternatives'),
        fetchTableData<any>('shipments'),
        fetchTableData<any>('purchase_orders')
      ]);
      setMaterials(mats);
      setSuppliers(sups);
      setCategories(cats);
      setAlternatives(alts);
      setShipments(shps);
      setPurchaseOrders(pos);

      if (mats.length > 0) {
        setSelectedMaterialId(mats[0].id);
      } else {
        setLoading(false);
      }
    } catch (e: any) {
      console.error("Failed to load Drill Down initial data", e);
      setError(e.message || "Failed to load master data.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedMaterialId) {
      setProjections([]);
      return;
    }
    async function fetchProjections() {
      setLoading(true);
      setError(null);
      try {
        const data = await getVMaterialMonthlyProjection(selectedMaterialId);
        setProjections(data);
      } catch (err: any) {
        console.error("Projection fetch failed", err);
        setError(err.message || "Failed to fetch monthly projections.");
      } finally {
        setLoading(false);
      }
    }
    fetchProjections();
  }, [selectedMaterialId]);

  // Use the standard hook for materials search
  const { filtered: filteredMaterials, hasActiveSearch } = useTableFilters<Material>(
    materials,
    ['name', 'sku'],
    {},
    searchQuery,
    setSearchQuery
  );

  useEffect(() => {
    if (searchQuery && filteredMaterials.length > 0) {
      const alreadyIncluded = filteredMaterials.some(m => m.id === selectedMaterialId);
      if (!alreadyIncluded) {
        setSelectedMaterialId(filteredMaterials[0].id);
      }
    }
  }, [searchQuery, filteredMaterials, selectedMaterialId]);

  const activeMaterial = useMemo(() => materials.find(m => m.id === selectedMaterialId), [materials, selectedMaterialId]);

  // Same buffer the MRP engine plans against, rather than a third formula.
  // Averaged over the months that actually carry a plan so an empty tail month
  // does not drag the basis down.
  const safetyStockUnits = useMemo(() => {
    if (!activeMaterial) return 0;
    const planned = projections.map(p => p.plan_consumption ?? 0).filter(q => q > 0);
    const avgMonthly = planned.length > 0
      ? planned.reduce((sum, q) => sum + q, 0) / planned.length
      : 0;
    return getSafetyStockQty(activeMaterial, avgMonthly);
  }, [activeMaterial, projections]);
  const activeSupplier = useMemo(() => suppliers.find(s => s.id === activeMaterial?.supplier_id), [suppliers, activeMaterial]);
  const activeCat = useMemo(() => categories.find(c => c.id === activeMaterial?.category_id), [categories, activeMaterial]);

  // Find alternative materials for this material
  const activeAlts = useMemo(() => {
    return alternatives
      .filter(a => a.material_id === selectedMaterialId)
      .map(a => materials.find(m => m.id === a.alternative_material_id))
      .filter((m): m is Material => !!m);
  }, [alternatives, selectedMaterialId, materials]);

  // Identify the first month ending stock goes negative
  const firstNegativeMonth = useMemo(() => projections.find(p => p.ending_stock < 0), [projections]);

  const formatMonth = (periodStart: string) => {
    const parts = periodStart.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  };

  const formatDateFriendly = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };

  // Build the chronological incoming receipts timeline events for selectedMaterialId
  const timelineEvents = useMemo(() => {
    const materialShipments = shipments.filter(s => s.material_id === selectedMaterialId);
    const materialPOs = purchaseOrders.filter(po => po.material_id === selectedMaterialId && po.status === 'pending');

    const events = [
      ...materialShipments.map(s => ({
        type: 'shipment',
        id: s.id,
        date: s.factory_arrival_date || s.port_eta,
        qty: s.qty,
        reference: s.invoice_no,
        details: `BL: ${s.bl_no} | Carrier: ${s.ship_method.toUpperCase()}`,
        status: 'In-Transit'
      })),
      ...materialPOs.map(po => ({
        type: 'purchase_order',
        id: po.id,
        date: po.required_date,
        qty: po.remaining_qty,
        reference: po.order_no,
        details: `Status: Pending Procurement Approval`,
        status: 'Planned PO'
      }))
    ];

    events.sort((a, b) => {
      const dA = a.date ? new Date(a.date).getTime() : 0;
      const dB = b.date ? new Date(b.date).getTime() : 0;
      return dA - dB;
    });

    return events;
  }, [shipments, purchaseOrders, selectedMaterialId]);

  return (
    <div className="space-y-6" id="material_drilldown_screen">
      <ContentHeader
        title="Material Quick Analysis (Drill Down)"
        subtitle="Deep dive into a specific component's supply pipeline, safety thresholds, and monthly projections."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search components..."
              className="w-40"
              hasActiveSearch={hasActiveSearch}
            />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider ms-2">Select Material:</span>
            <select
              id="drill_material_picker"
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="px-3.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg font-semibold text-gray-700 shadow-xs focus:outline-hidden max-w-[240px] cursor-pointer"
            >
              {filteredMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.sku} - {m.name}</option>
              ))}
              {filteredMaterials.length === 0 && (
                <option value="">No matching materials</option>
              )}
            </select>
          </div>
        }
      />

      <DataStateWrapper
        loading={loading && materials.length === 0}
        error={error}
        isEmpty={materials.length === 0}
        onRetry={loadInitial}
        emptyMessage="No material records configured in the system database."
      >
        {activeMaterial ? (
          <div className="space-y-6">
            {/* Top Specifications Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-xs space-y-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Lead-Time Days</span>
                <h3 className="text-xl font-extrabold text-blue-600 font-mono">{activeMaterial.total_lead_time_days} days</h3>
                <p className="text-[10px] text-gray-400 font-mono">({activeMaterial.supplier_lead_time_days}d production + {activeMaterial.transit_days}d transit + {activeMaterial.customs_clearance_days}d customs)</p>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-xs space-y-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Safety Stock Buffer</span>
                <h3 className="text-xl font-extrabold text-amber-700 font-mono">{activeMaterial.safety_stock_months} Months</h3>
                <p className="text-[10px] text-gray-400">Equivalent to approx {Math.round(safetyStockUnits).toLocaleString()} units</p>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-xs space-y-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Reorder Point Trigger</span>
                <h3 className="text-xl font-extrabold text-indigo-600 font-mono">{activeMaterial.reorder_point_days} Days</h3>
                <p className="text-[10px] text-gray-400">Reorder when coverage drops below {activeMaterial.reorder_point_days} days</p>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-xs space-y-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Primary Supplier</span>
                <h3 className="text-sm font-bold text-gray-800 truncate">{activeSupplier?.name || 'Unknown'}</h3>
                <p className="text-[10px] text-gray-400 font-sans">MOQ requirement: {activeMaterial.moq.toLocaleString()} units</p>
              </div>
            </div>

            {/* First Stock negative warning */}
            {firstNegativeMonth && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs">
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-bold">Stock Shortage Risk Detected!</h4>
                  <p className="leading-relaxed">Projected stock falls negative in <b>{formatMonth(firstNegativeMonth.period_start)}</b>. Purchase orders must be released to cover the lead-time horizon immediately.</p>
                </div>
              </div>
            )}

            {/* Projection Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Month-by-Month Stock & Coverage Projections</h3>
                <button onClick={loadInitial} className="p-1 text-gray-500 hover:text-gray-800 rounded transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <ScrollableTable>
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs font-sans">
                  <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Planning Period</th>
                      <th className="px-5 py-3 text-right">Opening Inventory</th>
                      <th className="px-5 py-3 text-right">Gross Requirements</th>
                      {/* These two columns show firm inbound supply, not MRP-suggested
                          orders - naming them "Scheduled Receipts"/"Planned Releases"
                          clashed with what those terms mean on the MRP screen. */}
                      <th className="px-5 py-3 text-right">In Transit</th>
                      <th className="px-5 py-3 text-right">Open POs</th>
                      <th className="px-5 py-3 text-right">Projected Ending Stock</th>
                      <th className="px-5 py-3 text-right">Months of Coverage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs text-gray-700">
                    {projections.map((p, idx) => {
                      const isNegative = (p.ending_stock ?? 0) < 0;
                      const consumption = p.plan_consumption ?? 0;
                      const inTransit = p.in_transit_qty ?? 0;
                      const pendingPO = p.pending_po_qty ?? 0;
                      const coverageMonths = (p.ending_coverage_days ?? 0) / 30;

                      return (
                        <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-gray-800">{formatMonth(p.period_start)}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-gray-500">{(p.opening_stock ?? 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-gray-600">{consumption.toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-emerald-600 font-semibold">
                            {inTransit > 0 ? `+${inTransit.toLocaleString()}` : '0'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-indigo-600 font-semibold">
                            {pendingPO > 0 ? `+${pendingPO.toLocaleString()}` : '0'}
                          </td>
                          <td className={`px-5 py-3.5 text-right font-mono font-bold ${isNegative ? 'text-rose-600 bg-rose-50/20' : 'text-gray-900'}`}>
                            {(p.ending_stock ?? 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                              coverageMonths < 1.0 
                                ? 'bg-red-100 text-red-700' 
                                : coverageMonths < 2.0 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {coverageMonths.toFixed(1)} mos
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>

            {/* Split Details Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Receipts Timeline */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" /> Procurement & Shipment Inbound Timeline
                </h3>

                {timelineEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">No pending shipments or purchase approval requests recorded for this component.</p>
                ) : (
                  <div className="relative border-l border-gray-200 ml-2.5 pl-4 space-y-5">
                    {timelineEvents.map((evt) => {
                      const isPO = evt.type === 'purchase_order';
                      return (
                        <div key={evt.id} className="relative">
                          <div className={`absolute -left-[22.5px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                            isPO ? 'bg-indigo-600 shadow-xs' : 'bg-emerald-500 shadow-xs'
                          }`} />
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                                {isPO ? 'Planned Procurement Release' : 'In-Transit Freight Shipment'}
                                <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                                  isPO ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}>
                                  Ref: {evt.reference}
                                </span>
                              </h4>
                              <p className="text-[10px] text-gray-400 font-medium">{evt.details}</p>
                            </div>
                            <div className="text-right space-y-0.5 shrink-0">
                              <span className="block text-xs font-bold font-mono text-gray-900">+{evt.qty.toLocaleString()} units</span>
                              <span className="block text-[9px] font-mono text-gray-400 font-bold">ETA: {formatDateFriendly(evt.date)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Alternatives & Categories info */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-5">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-3 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" /> Category & Material Family
                  </h3>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Classification</span>
                    <p className="text-xs font-bold text-gray-800">{activeCat?.name || 'Unclassified'}</p>
                    <p className="text-[10px] text-gray-400">{activeCat?.description || 'No family description available.'}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> Approved Alternative Materials
                  </h3>

                  {activeAlts.length === 0 ? (
                    <p className="text-[10px] text-gray-400">No alternate components assigned. Supply chains must rely solely on primary supplier releases.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeAlts.map(alt => (
                        <div key={alt.id} className="flex justify-between items-center bg-gray-50/50 border border-gray-200 p-2 rounded-lg text-xs">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-gray-400">{alt.sku}</span>
                            <h4 className="font-semibold text-gray-700">{alt.name}</h4>
                          </div>
                          <span className="font-mono font-bold text-gray-500">${alt.standard_cost}/unit</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-xs text-blue-800 space-y-1">
                  <h4 className="font-semibold flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Lead time simulation</h4>
                  <p className="leading-relaxed text-[10px]">Transit lead days accounts for deep-sea carriers, local customs port clearance times, and warehouse offloading schedules mapped dynamically.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 p-6 text-center">Please select a valid material to analyze.</p>
        )}
      </DataStateWrapper>
    </div>
  );
}
