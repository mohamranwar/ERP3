/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { fetchTableData, saveRecord, deleteRecord } from '../supabaseClient';
import { Shipment, PurchaseOrder, Material, Supplier } from '../types';
import { Calendar, CheckSquare, AlertTriangle, Ship, Truck, Plane, Plus, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastConfirmContext';
import { useAuth } from '../context/AuthContext';
import { useTableFilters } from '../hooks/useTableFilters';
import SearchBar from './SearchBar';
import ScrollableTable from './ScrollableTable';
import ContentHeader from './ContentHeader';

interface LogisticsScreenProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  refreshKey?: number;
}

export default function LogisticsScreen({
  searchQuery = '',
  setSearchQuery = () => {},
  refreshKey = 0,
}: LogisticsScreenProps) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/Search states
  const [filterDelay, setFilterDelay] = useState<string>('all'); // all, late, pending_arrival

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editShipment, setEditShipment] = useState<Shipment | null>(null);

  // Quick Action PO-Convert State
  const [showPoModal, setShowPoModal] = useState(false);
  const [poSearchQuery, setPoSearchQuery] = useState('');

  const { showToast, confirm: askConfirm } = useToast();

  const { hasRole } = useAuth();

  async function loadData() {
    setLoading(true);
    try {
      const [shps, pos, mats, sups] = await Promise.all([
        fetchTableData<Shipment>('shipments'),
        fetchTableData<PurchaseOrder>('purchase_orders'),
        fetchTableData<Material>('materials'),
        fetchTableData<Supplier>('suppliers')
      ]);
      setShipments(shps);
      setPurchaseOrders(pos);
      setMaterials(mats);
      setSuppliers(sups);
    } catch (e) {
      console.error("Logistics database fetch failed", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const handleEdit = (shp: Shipment) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to edit shipments.', 'error');
      return;
    }
    setEditShipment({ ...shp });
    setShowForm(true);
  };

  const handleCreateNew = () => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to add shipments.', 'error');
      return;
    }
    setEditShipment({
      id: '',
      material_id: materials[0]?.id || '',
      supplier_id: suppliers[0]?.id || '',
      qty: 10000,
      invoice_no: '',
      bl_no: '',
      container_count: 1,
      ship_method: 'sea',
      etd: new Date().toISOString().slice(0, 10),
      port_eta: new Date().toISOString().slice(0, 10),
      port_name: 'Alexandria',
      customs_clearance_days: 5,
      factory_arrival_date: null,
      delay: 0
    });
    setShowForm(true);
  };

  const handleSupplierChange = (supId: string) => {
    const sup = suppliers.find(s => s.id === supId);
    if (sup && editShipment) {
      const customsDays = sup.default_customs_clearance_days || 5;
      const transitDays = sup.default_transit_days || 10;
      
      let updatedPortEta = editShipment.port_eta;
      if (editShipment.etd) {
        const etdDate = new Date(editShipment.etd);
        etdDate.setDate(etdDate.getDate() + transitDays);
        updatedPortEta = etdDate.toISOString().slice(0, 10);
      }

      let updatedFactoryArrival = editShipment.factory_arrival_date;
      if (updatedPortEta) {
        const portEtaDate = new Date(updatedPortEta);
        portEtaDate.setDate(portEtaDate.getDate() + customsDays);
        updatedFactoryArrival = portEtaDate.toISOString().slice(0, 10);
      }

      setEditShipment(prev => ({
        ...prev!,
        supplier_id: supId,
        customs_clearance_days: customsDays,
        port_eta: updatedPortEta,
        factory_arrival_date: updatedFactoryArrival
      }));
    } else {
      setEditShipment(prev => ({ ...prev!, supplier_id: supId }));
    }
  };

  const handleEtdChange = (etdValue: string) => {
    if (!editShipment) return;
    const sup = suppliers.find(s => s.id === editShipment.supplier_id);
    const transitDays = sup ? (sup.default_transit_days || 10) : 10;
    const customsDays = editShipment.customs_clearance_days || (sup ? (sup.default_customs_clearance_days || 5) : 5);

    const etdDate = new Date(etdValue);
    etdDate.setDate(etdDate.getDate() + transitDays);
    const updatedPortEta = etdDate.toISOString().slice(0, 10);

    const portEtaDate = new Date(updatedPortEta);
    portEtaDate.setDate(portEtaDate.getDate() + customsDays);
    const updatedFactoryArrival = portEtaDate.toISOString().slice(0, 10);

    setEditShipment(prev => ({
      ...prev!,
      etd: etdValue,
      port_eta: updatedPortEta,
      factory_arrival_date: updatedFactoryArrival
    }));
  };

  const handlePortEtaChange = (portEtaValue: string) => {
    if (!editShipment) return;
    const sup = suppliers.find(s => s.id === editShipment.supplier_id);
    const customsDays = editShipment.customs_clearance_days || (sup ? (sup.default_customs_clearance_days || 5) : 5);

    const portEtaDate = new Date(portEtaValue);
    portEtaDate.setDate(portEtaDate.getDate() + customsDays);
    const updatedFactoryArrival = portEtaDate.toISOString().slice(0, 10);

    setEditShipment(prev => ({
      ...prev!,
      port_eta: portEtaValue,
      factory_arrival_date: updatedFactoryArrival
    }));
  };

  const handleCustomsDaysChange = (customsDaysValue: number) => {
    if (!editShipment) return;
    let updatedFactoryArrival = editShipment.factory_arrival_date;
    if (editShipment.port_eta) {
      const portEtaDate = new Date(editShipment.port_eta);
      portEtaDate.setDate(portEtaDate.getDate() + customsDaysValue);
      updatedFactoryArrival = portEtaDate.toISOString().slice(0, 10);
    }

    setEditShipment(prev => ({
      ...prev!,
      customs_clearance_days: customsDaysValue,
      factory_arrival_date: updatedFactoryArrival
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShipment) return;

    if (editShipment.factory_arrival_date && editShipment.port_eta) {
      const eta = new Date(editShipment.port_eta);
      const arr = new Date(editShipment.factory_arrival_date);
      const diffTime = arr.getTime() - eta.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      editShipment.delay = Math.max(0, diffDays - editShipment.customs_clearance_days);
    }

    try {
      const saved = await saveRecord<Shipment>('shipments', editShipment);
      setShipments(prev => editShipment.id ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]);
      setShowForm(false);
      setEditShipment(null);
      showToast("Shipment logged successfully!", "success");
    } catch (err) {
      showToast("Error saving shipment.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!hasRole('admin')) {
      showToast('Deleting records requires an Admin account.', 'error');
      return;
    }
    const isConfirmed = await askConfirm(
      "Are you sure you want to delete this shipment? This will permanently remove its scheduled receipts in MRP solver timeline.",
      "Delete Shipment"
    );
    if (isConfirmed) {
      try {
        await deleteRecord('shipments', id);
        setShipments(prev => prev.filter(s => s.id !== id));
        showToast("Shipment deleted.", "success");
      } catch (err) {
        showToast("Delete failed.", "error");
      }
    }
  };

  const openPoModal = () => {

    if (!hasRole('planner')) {

      showToast('Your account is read-only - Planner or Admin access is required to convert POs to shipments.', 'error');

      return;

    }

    setShowPoModal(true);

  };


  // Convert PO to Shipment quick action
  const handleConvertPo = async (po: PurchaseOrder) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to convert POs to shipments.', 'error');
      return;
    }
    const mat = materials.find(m => m.id === po.material_id);
    const sup = suppliers.find(s => s.id === po.supplier_id);
    
    const transitDays = mat?.transit_days || sup?.default_transit_days || 10;
    const customsDays = mat?.customs_clearance_days || sup?.default_customs_clearance_days || 5;

    const etdDate = new Date();
    const etaDate = new Date();
    etaDate.setDate(etdDate.getDate() + transitDays);
    const arrDate = new Date(etaDate);
    arrDate.setDate(etaDate.getDate() + customsDays);

    const newShipment: Shipment = {
      id: '',
      material_id: po.material_id,
      supplier_id: po.supplier_id,
      qty: po.remaining_qty,
      invoice_no: `INV-${po.order_no.split('-')[2] || 'TEMP'}`,
      bl_no: `BL-NEW-${Math.floor(Math.random() * 90000 + 10000)}`,
      container_count: Math.ceil(po.remaining_qty / 15000),
      ship_method: 'sea',
      etd: etdDate.toISOString().slice(0, 10),
      port_eta: etaDate.toISOString().slice(0, 10),
      port_name: 'Alexandria',
      customs_clearance_days: customsDays,
      factory_arrival_date: arrDate.toISOString().slice(0, 10),
      delay: 0
    };

    try {
      const savedShp = await saveRecord<Shipment>('shipments', newShipment);
      
      const updatedPo: PurchaseOrder = {
        ...po,
        status: 'in_transit',
        remaining_qty: 0 
      };
      await saveRecord<PurchaseOrder>('purchase_orders', updatedPo);

      setShipments(prev => [...prev, savedShp]);
      setPurchaseOrders(prev => prev.map(p => p.id === po.id ? updatedPo : p));
      
      setShowPoModal(false);
      showToast(`PO ${po.order_no} successfully converted to Shipment ${savedShp.invoice_no}!`, "success");
    } catch (err: any) {
      showToast("Failed to convert PO: " + err.message, "error");
    }
  };

  // Quick inline arrival date saver
  const handleUpdateArrivalDate = async (shp: Shipment, date: string) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to update arrival dates.', 'error');
      return;
    }
    const updated = { ...shp, factory_arrival_date: date || null };
    try {
      const saved = await saveRecord<Shipment>('shipments', updated);
      setShipments(prev => prev.map(s => s.id === shp.id ? saved : s));

      if (date) {
        const matchingPo = purchaseOrders.find(po => 
          po.material_id === shp.material_id && 
          po.supplier_id === shp.supplier_id && 
          po.status !== 'completed' &&
          po.qty === shp.qty
        ) || purchaseOrders.find(po => 
          po.material_id === shp.material_id && 
          po.supplier_id === shp.supplier_id && 
          po.status !== 'completed'
        );

        if (matchingPo) {
          const completedPo: PurchaseOrder = {
            ...matchingPo,
            status: 'completed',
            remaining_qty: 0
          };
          await saveRecord<PurchaseOrder>('purchase_orders', completedPo);
          setPurchaseOrders(prev => prev.map(p => p.id === matchingPo.id ? completedPo : p));
          showToast(`Arrival date updated. Related PO ${matchingPo.order_no} has been closed as completed!`, "success");
          return;
        }
      }

      showToast("Arrival status updated.", "success");
    } catch (err) {
      showToast("Failed to update arrival date.", "error");
    }
  };

  // Standard filter using useTableFilters hook
  const { filtered: filteredShipments, hasActiveSearch } = useTableFilters<Shipment>(
    shipments,
    ['invoice_no', 'bl_no'],
    {},
    searchQuery,
    setSearchQuery,
    (s) => {
      // Custom material name & supplier name checks which useTableFilters doesn't natively do
      const mat = materials.find(m => m.id === s.material_id);
      const sup = suppliers.find(su => su.id === s.supplier_id);
      
      const sQuery = searchQuery.toLowerCase();
      const matchesMatOrSup = 
        (mat && mat.name.toLowerCase().includes(sQuery)) ||
        (sup && sup.name.toLowerCase().includes(sQuery));

      if (searchQuery.trim() !== '') {
        return matchesMatOrSup; // bypass other filters if there is match
      }

      // Dropdown filters applied normally if query is empty
      if (filterDelay === 'late') return s.delay > 0;
      if (filterDelay === 'pending_arrival') return s.factory_arrival_date === null;

      return true;
    }
  );

  const getMethodIcon = (method: 'sea' | 'air' | 'land') => {
    if (method === 'air') return <Plane className="w-3.5 h-3.5 text-blue-500" />;
    if (method === 'land') return <Truck className="w-3.5 h-3.5 text-amber-600" />;
    return <Ship className="w-3.5 h-3.5 text-indigo-500" />;
  };

  return (
    <div className="space-y-6" id="logistics_screen">
      <ContentHeader
        title="In-Transit Shipments & Logistics"
        subtitle="Track shipments at sea, manage port customs clearance, and edit arrival calendars."
        actions={
          <div className="flex items-center gap-2">
            <button
              id="btn_convert_po"
              onClick={openPoModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Convert PO to Shipment
            </button>
            <button
              id="btn_create_shipment"
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Shipment
            </button>
          </div>
        }
      />

      {/* Filter and Search rail */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 font-sans">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search shipments..."
          className="flex-1 min-w-[240px]"
          hasActiveSearch={hasActiveSearch}
        />

        <select
          value={filterDelay}
          onChange={(e) => setFilterDelay(e.target.value)}
          className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden cursor-pointer font-semibold text-gray-600"
        >
          <option value="all">All Shipments</option>
          <option value="late">Late Shipments (Delay &gt; 0)</option>
          <option value="pending_arrival">Factory Arrival Needed</option>
        </select>

        <button onClick={loadData} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors cursor-pointer" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs font-sans">
          <div className="overflow-x-auto">
            <ScrollableTable>
              <table className="min-w-full divide-y divide-gray-200 text-left">
                <thead className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Invoice / BL</th>
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-right">Inbound Qty</th>
                    <th className="px-4 py-3 text-center">Mode</th>
                    <th className="px-4 py-3">ETD</th>
                    <th className="px-4 py-3">Port ETA</th>
                    <th className="px-4 py-3">Factory Arrival Date</th>
                    <th className="px-4 py-3 text-center">Delay</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs text-gray-900">
                  {filteredShipments.map(s => {
                    const mat = materials.find(m => m.id === s.material_id);
                    const sup = suppliers.find(su => su.id === s.supplier_id);
                    
                    const isLate = s.delay > 0;
                    const isArrivalNull = !s.factory_arrival_date;

                    return (
                      <tr 
                        key={s.id} 
                        className={`transition-colors ${
                          isLate ? 'bg-red-50/40 hover:bg-red-50/70' : 
                          isArrivalNull ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold">{s.invoice_no || 'No Invoice'}</p>
                          <p className="text-[10px] text-gray-400 font-mono font-medium">BL: {s.bl_no}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{mat ? mat.name : 'Unknown'}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{mat ? mat.sku : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{sup ? sup.name : 'Unknown'}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold font-mono">{s.qty.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{s.container_count} Containers</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center justify-center p-1 bg-gray-100 rounded-sm">
                            {getMethodIcon(s.ship_method)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{s.etd}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">{s.port_eta} ({s.port_name})</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              value={s.factory_arrival_date || ''}
                              onChange={(e) => handleUpdateArrivalDate(s, e.target.value)}
                              className={`px-1.5 py-0.5 border text-xs rounded-sm focus:outline-hidden font-mono cursor-pointer ${
                                isArrivalNull ? 'border-amber-300 bg-amber-50 text-amber-900 font-semibold' : 'border-gray-200'
                              }`}
                            />
                            {isArrivalNull && (
                              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-0.5 shrink-0 animate-pulse" title="Check with logistics">
                                <AlertTriangle className="w-3 h-3" /> Check Log.
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isLate ? (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-sm">
                              +{s.delay} Days
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px] font-mono">0d</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right flex justify-end gap-1">
                          <button onClick={() => handleEdit(s)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm cursor-pointer">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredShipments.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                        No shipments matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      )}

      {/* Shipment Editor Modal */}
      {showForm && editShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-semibold text-gray-900">{editShipment.id ? 'Edit' : 'Create'} Shipment</h3>
              <button onClick={() => { setShowForm(false); setEditShipment(null); }} className="text-gray-400 hover:text-gray-600 text-lg font-medium cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 col-span-2">
                  <label className="font-semibold text-gray-500 uppercase">Material ID</label>
                  <select
                    value={editShipment.material_id}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, material_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.sku} - {m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="font-semibold text-gray-500 uppercase">Supplier</label>
                  <select
                    value={editShipment.supplier_id}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.origin_country})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Quantity (Units)</label>
                  <input
                    type="number"
                    value={editShipment.qty}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, qty: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Container Count</label>
                  <input
                    type="number"
                    value={editShipment.container_count}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, container_count: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Invoice Number</label>
                  <input
                    type="text"
                    value={editShipment.invoice_no}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, invoice_no: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Bill of Lading (BL)</label>
                  <input
                    type="text"
                    value={editShipment.bl_no}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, bl_no: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Ship Method</label>
                  <select
                    value={editShipment.ship_method}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, ship_method: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="sea">Sea Freight</option>
                    <option value="air">Air Cargo</option>
                    <option value="land">Land Transport</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">ETD Date</label>
                  <input
                    type="date"
                    value={editShipment.etd}
                    onChange={(e) => handleEtdChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Port ETA Date</label>
                  <input
                    type="date"
                    value={editShipment.port_eta}
                    onChange={(e) => handlePortEtaChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Destination Port Name</label>
                  <input
                    type="text"
                    value={editShipment.port_name}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, port_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Customs Clearance Days</label>
                  <input
                    type="number"
                    value={editShipment.customs_clearance_days}
                    onChange={(e) => handleCustomsDaysChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-500 uppercase">Estimated Factory Arrival</label>
                  <input
                    type="date"
                    value={editShipment.factory_arrival_date || ''}
                    onChange={(e) => setEditShipment(prev => ({ ...prev!, factory_arrival_date: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditShipment(null); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Save Shipment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Conversion modal popup */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50 text-xs">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Purchase Orders (Pending Shipments)</h3>
                <p className="text-gray-400">Select a validated purchase order to dispatch as sea/air transit cargo.</p>
              </div>
              <button onClick={() => setShowPoModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-medium cursor-pointer">&times;</button>
            </div>

            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <input
                type="text"
                placeholder="Filter POs by Order No, SKU..."
                value={poSearchQuery}
                onChange={(e) => setPoSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
              />
            </div>

            <div className="p-4 max-h-96 overflow-y-auto text-xs space-y-2">
              {purchaseOrders
                .filter(po => po.status === 'pending')
                .filter(po => {
                  const q = poSearchQuery.toLowerCase();
                  return po.order_no.toLowerCase().includes(q) || po.id.toLowerCase().includes(q);
                })
                .map(po => {
                  const mat = materials.find(m => m.id === po.material_id);
                  const sup = suppliers.find(s => s.id === po.supplier_id);
                  return (
                    <div key={po.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-2xs hover:border-blue-300 transition-colors">
                      <div>
                        <h4 className="font-bold text-gray-800">{po.order_no}</h4>
                        <p className="text-gray-500">{mat ? mat.name : 'Unknown SKU'}</p>
                        <p className="text-[10px] text-gray-400">Supplier: {sup ? sup.name : 'Unknown'}</p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <span className="block font-semibold text-gray-900">{po.remaining_qty.toLocaleString()} units</span>
                          <span className="block text-[10px] text-gray-400">Req Date: {po.required_date}</span>
                        </div>
                        <button
                          onClick={() => handleConvertPo(po)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors cursor-pointer"
                        >
                          Ship Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              {purchaseOrders.filter(po => po.status === 'pending').length === 0 && (
                <p className="text-center text-gray-400 py-6">No validated pending purchase orders currently open in the procurement pipeline.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
