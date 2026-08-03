/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  fetchTableData, saveRecord, deleteRecord 
} from '../supabaseClient';
import { Product, Material, Supplier, Machine, Channel, MaterialCategory, ProductCategory, ProductGroup } from '../types';
import { Plus, Edit2, Trash2, RefreshCw, Layers } from 'lucide-react';
import CsvImportHelper from './CsvImportHelper';
import { useToast } from '../context/ToastConfirmContext';
import { useAuth } from '../context/AuthContext';
import { useTableFilters } from '../hooks/useTableFilters';
import SearchBar from './SearchBar';
import ScrollableTable from './ScrollableTable';
import ContentHeader from './ContentHeader';

type TabType = 'products' | 'materials' | 'suppliers' | 'machines' | 'channels';

interface MasterDataScreenProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  refreshKey?: number;
}

export default function MasterDataScreen({
  searchQuery = '',
  setSearchQuery = () => {},
  refreshKey = 0,
}: MasterDataScreenProps) {
  const { showToast, confirm: askConfirm } = useToast();
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [loading, setLoading] = useState(true);

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [matCats, setMatCats] = useState<MaterialCategory[]>([]);
  const [prodCats, setProdCats] = useState<ProductCategory[]>([]);
  const [prodGroups, setProdGroups] = useState<ProductGroup[]>([]);

  // Categorical Filters (these are bypassed if active search is present)
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Editing forms state
  const [editItem, setEditItem] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [prods, mats, sups, macs, chans, mcats, pcats, pgrps] = await Promise.all([
        fetchTableData<Product>('products'),
        fetchTableData<Material>('materials'),
        fetchTableData<Supplier>('suppliers'),
        fetchTableData<Machine>('machines'),
        fetchTableData<Channel>('channels'),
        fetchTableData<MaterialCategory>('material_categories'),
        fetchTableData<ProductCategory>('product_categories'),
        fetchTableData<ProductGroup>('product_groups')
      ]);
      setProducts(prods);
      setMaterials(mats);
      setSuppliers(sups);
      setMachines(macs);
      setChannels(chans);
      setMatCats(mcats);
      setProdCats(pcats);
      setProdGroups(pgrps);
    } catch (e) {
      console.error("Failed to load master data tables", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  // Reset category filters when switching tab, but preserve search state behavior
  useEffect(() => {
    setFilterCategory('');
    setFilterGroup('');
    setFilterStatus('');
  }, [activeTab]);

  const handleEdit = (item: any) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to edit records.', 'error');
      return;
    }
    setEditItem({ ...item });
    setShowForm(true);
  };

  const handleCreateNew = () => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to add records.', 'error');
      return;
    }
    if (activeTab === 'products') {
      setEditItem({
        id: '', name: '', sku: '', description: '', group_id: prodGroups[0]?.id || '',
        category_id: prodCats[0]?.id || '', brand: '', variant: '', product_line: machines[0]?.name || 'Pants',
        pack_type: '', size: '', status: 'running', pcs_per_bag: 40, bags_per_carton: 4,
        selling_price: 15.0, standard_cost: 10.0
      });
    } else if (activeTab === 'materials') {
      const defaultSup = suppliers[0];
      setEditItem({
        id: '', name: '', sku: '', description: '', category_id: matCats[0]?.id || '',
        supplier_id: defaultSup?.id || '',
        supplier_lead_time_days: defaultSup?.default_lead_time_days || 15,
        transit_days: defaultSup?.default_transit_days || 10,
        customs_clearance_days: defaultSup?.default_customs_clearance_days || 5,
        safety_stock_months: 1.0, moq: 10000, max_usage: 1000, controller: 'Mohamed Amr',
        status: 'running', standard_cost: 1.0, cost_basis: 'standard'
      });
    } else if (activeTab === 'suppliers') {
      setEditItem({ id: '', name: '', default_lead_time_days: 15, default_transit_days: 10, default_customs_clearance_days: 5, status: 'active' });
    } else if (activeTab === 'machines') {
      setEditItem({ id: '', name: '', description: '' });
    } else if (activeTab === 'channels') {
      setEditItem({ id: '', name: '', status: 'active' });
    }
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    if (activeTab === 'materials') {
      const tot = Number(editItem.supplier_lead_time_days || 0) + 
                  Number(editItem.transit_days || 0) + 
                  Number(editItem.customs_clearance_days || 0);
      editItem.total_lead_time_days = tot;
      editItem.reorder_point_days = Math.round(tot * 1.25);
    }

    try {
      const saved = await saveRecord<any>(activeTab, editItem);
      if (activeTab === 'products') {
        setProducts(prev => editItem.id ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved]);
      } else if (activeTab === 'materials') {
        setMaterials(prev => editItem.id ? prev.map(m => m.id === saved.id ? saved : m) : [...prev, saved]);
      } else if (activeTab === 'suppliers') {
        setSuppliers(prev => editItem.id ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]);
      } else if (activeTab === 'machines') {
        setMachines(prev => editItem.id ? prev.map(m => m.id === saved.id ? saved : m) : [...prev, saved]);
      } else if (activeTab === 'channels') {
        setChannels(prev => editItem.id ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved]);
      }
      setShowForm(false);
      setEditItem(null);
      showToast("Record saved successfully!", "success");
    } catch (err) {
      showToast("Error saving record. Check database setup.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!hasRole('admin')) {
      showToast('Only Admin accounts can delete master data records.', 'error');
      return;
    }
    const isConfirmed = await askConfirm("Are you sure you want to delete this master data item? This can affect related configurations.", "Delete Item");
    if (!isConfirmed) return;
    try {
      await deleteRecord(activeTab, id);
      if (activeTab === 'products') setProducts(prev => prev.filter(p => p.id !== id));
      else if (activeTab === 'materials') setMaterials(prev => prev.filter(m => m.id !== id));
      else if (activeTab === 'suppliers') setSuppliers(prev => prev.filter(s => s.id !== id));
      else if (activeTab === 'machines') setMachines(prev => prev.filter(m => m.id !== id));
      else if (activeTab === 'channels') setChannels(prev => prev.filter(c => c.id !== id));
      showToast("Record deleted.", "success");
    } catch (err) {
      showToast("Delete failed.", "error");
    }
  };

  const handleSupplierChangeInMaterialForm = (supId: string) => {
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      setEditItem((prev: any) => ({
        ...prev,
        supplier_id: supId,
        supplier_lead_time_days: sup.default_lead_time_days,
        transit_days: sup.default_transit_days,
        customs_clearance_days: sup.default_customs_clearance_days
      }));
    }
  };

  const handleCsvImport = async (data: any[]) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to import records.', 'error');
      return;
    }
    try {
      setLoading(true);
      for (const row of data) {
        if (activeTab === 'materials') {
          const lead = Number(row.supplier_lead_time_days || 15);
          const transit = Number(row.transit_days || 10);
          const customs = Number(row.customs_clearance_days || 5);
          row.total_lead_time_days = lead + transit + customs;
          // Must match the manual "Save Material" path's multiplier (1.25) below -
          // these previously drifted (1.3 here vs 1.25 there), giving the same
          // material a different reorder point depending on how it was created.
          row.reorder_point_days = Math.round(row.total_lead_time_days * 1.25);
        }
        await saveRecord(activeTab, row);
      }
      await loadData();
      showToast(`Imported ${data.length} records successfully!`, "success");
    } catch (err: any) {
      showToast("Import error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Filtration logic utilizing useTableFilters hook
  const { filtered: filteredMaterials, hasActiveSearch: matActiveSearch } = useTableFilters<Material>(
    materials,
    ['name', 'sku', 'controller'],
    {},
    searchQuery,
    setSearchQuery,
    (m) => {
      // By-passed if search active
      if (searchQuery.trim() !== '') return true;
      const cMatch = filterCategory ? m.category_id === filterCategory : true;
      const stMatch = filterStatus ? m.status === filterStatus : true;
      return cMatch && stMatch;
    }
  );

  const { filtered: filteredProducts, hasActiveSearch: prodActiveSearch } = useTableFilters<Product>(
    products,
    ['name', 'sku'],
    {},
    searchQuery,
    setSearchQuery,
    (p) => {
      // By-passed if search active
      if (searchQuery.trim() !== '') return true;
      const cMatch = filterCategory ? p.category_id === filterCategory : true;
      const gMatch = filterGroup ? p.group_id === filterGroup : true;
      const stMatch = filterStatus ? p.status === filterStatus : true;
      return cMatch && gMatch && stMatch;
    }
  );

  const { filtered: filteredSuppliers } = useTableFilters<Supplier>(
    suppliers,
    ['name'],
    {},
    searchQuery,
    setSearchQuery
  );

  const { filtered: filteredMachines } = useTableFilters<Machine>(
    machines,
    ['name'],
    {},
    searchQuery,
    setSearchQuery
  );

  const { filtered: filteredChannels } = useTableFilters<Channel>(
    channels,
    ['name'],
    {},
    searchQuery,
    setSearchQuery
  );

  const hasAnyActiveSearch = matActiveSearch || prodActiveSearch;

  // Define CSV Import fields based on tab
  const getCsvImportFields = () => {
    if (activeTab === 'products') {
      return [
        { key: 'sku', label: 'SKU *', required: true },
        { key: 'name', label: 'Description/Name *', required: true },
        { key: 'brand', label: 'Brand/Group (e.g. BabyJoy)' },
        { key: 'variant', label: 'Variant' },
        { key: 'product_line', label: 'Machine/Line (e.g. Pants)', defaultValue: 'Pants' },
        { key: 'pack_type', label: 'Pack Type (e.g. Jumbo)' },
        { key: 'size', label: 'Size (e.g. Size 4)' },
        { key: 'pcs_per_bag', label: 'PCs per Bag', defaultValue: 40 },
        { key: 'bags_per_carton', label: 'Bags per Carton', defaultValue: 4 },
        { key: 'selling_price', label: 'Selling Price', defaultValue: 15.0 },
        { key: 'standard_cost', label: 'Standard Cost', defaultValue: 10.0 }
      ];
    } else if (activeTab === 'materials') {
      return [
        { key: 'sku', label: 'SKU *', required: true },
        { key: 'name', label: 'Material Name *', required: true },
        { key: 'supplier_lead_time_days', label: 'Supplier Lead Time Days', defaultValue: 15 },
        { key: 'transit_days', label: 'Transit Days', defaultValue: 10 },
        { key: 'customs_clearance_days', label: 'Customs Clearance Days', defaultValue: 5 },
        { key: 'safety_stock_months', label: 'Safety Stock Months', defaultValue: 1.0 },
        { key: 'moq', label: 'MOQ Qty', defaultValue: 5000 },
        { key: 'max_usage', label: 'Max Daily Usage', defaultValue: 500 },
        { key: 'controller', label: 'Controller', defaultValue: 'Mohamed Amr' },
        { key: 'standard_cost', label: 'Standard Unit Cost', defaultValue: 1.0 }
      ];
    }
    return [];
  };

  return (
    <div className="space-y-6" id="master_data_screen">
      <ContentHeader
        title="Master Data Management"
        subtitle="Manage your manufacturing registry, suppliers, logistics timelines, and finished goods."
        actions={
          <div className="flex items-center gap-2">
            {!hasRole('planner') && (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 rounded-full">
                Read-only
              </span>
            )}
            {hasRole('planner') && ['products', 'materials', 'suppliers', 'machines', 'channels'].includes(activeTab) && getCsvImportFields().length > 0 && (
              <CsvImportHelper
                fields={getCsvImportFields()}
                onImport={handleCsvImport}
                title={`Import ${activeTab.toUpperCase()} from CSV`}
              />
            )}
            {hasRole('planner') && (
              <button
                id="btn_create_master_item"
                onClick={handleCreateNew}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all focus:outline-hidden cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add New Record
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-2 scrollbar-none font-sans" id="master_data_tabs_container">
        {(['materials', 'products', 'suppliers', 'machines', 'channels'] as TabType[]).map(tab => (
          <button
            key={tab}
            id={`tab_${tab}`}
            onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all focus:outline-hidden cursor-pointer ${
              activeTab === tab 
                ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/20' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 font-sans">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={`Search ${activeTab} by name or SKU...`}
          className="flex-1 min-w-[240px]"
          hasActiveSearch={hasAnyActiveSearch}
        />

        {activeTab === 'products' && (
          <>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden font-semibold text-gray-600 cursor-pointer"
            >
              <option value="">All Categories</option>
              {prodCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden font-semibold text-gray-600 cursor-pointer"
            >
              <option value="">All Brands/Groups</option>
              {prodGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </>
        )}

        {activeTab === 'materials' && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden font-semibold text-gray-600 cursor-pointer"
          >
            <option value="">All Material Categories</option>
            {matCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {['products', 'materials'].includes(activeTab) && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden font-semibold text-gray-600 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="obsolete">Obsolete</option>
          </select>
        )}

        <button 
          onClick={loadData}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors cursor-pointer"
          title="Reload Master Tables"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs font-sans">
          {/* Dense, Professional Tables */}
          {activeTab === 'materials' && (
            <div className="overflow-x-auto">
              <ScrollableTable>
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Material Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Lead Time (Legs)</th>
                      <th className="px-4 py-3 text-right">Total LT</th>
                      <th className="px-4 py-3 text-right">SS (mo)</th>
                      <th className="px-4 py-3 text-right">MOQ</th>
                      <th className="px-4 py-3 text-right">Std Cost</th>
                      <th className="px-4 py-3">Basis</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs text-gray-900">
                    {filteredMaterials.map(m => {
                      const catName = matCats.find(c => c.id === m.category_id)?.name || 'Unknown';
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-gray-600 font-medium">{m.sku}</td>
                          <td className="px-4 py-2.5 font-medium">{m.name}</td>
                          <td className="px-4 py-2.5 text-gray-500 truncate max-w-[120px]">{catName}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-400">
                            {m.supplier_lead_time_days}d + {m.transit_days}d + {m.customs_clearance_days}d
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold font-mono">{m.total_lead_time_days}d</td>
                          <td className="px-4 py-2.5 text-right font-mono">{m.safety_stock_months}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{m.moq.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold">${m.standard_cost.toFixed(3)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold ${m.cost_basis === 'weighted_avg' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-600'}`}>
                              {m.cost_basis}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.status === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right flex justify-end gap-1.5">
                            <button onClick={() => handleEdit(m)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(m.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMaterials.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-gray-400">No materials match criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="overflow-x-auto">
              <ScrollableTable>
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Brand/Group</th>
                      <th className="px-4 py-3">Machine/Line</th>
                      <th className="px-4 py-3">Pack/Size</th>
                      <th className="px-4 py-3 text-right">Selling Price</th>
                      <th className="px-4 py-3 text-right">Standard Cost</th>
                      <th className="px-4 py-3 text-right">Pcs/Bag</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs text-gray-900">
                    {filteredProducts.map(p => {
                      const grpName = prodGroups.find(g => g.id === p.group_id)?.name || 'Unknown';
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-gray-600 font-medium">{p.sku}</td>
                          <td className="px-4 py-2.5 font-medium">{p.name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{grpName}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 bg-gray-100 rounded-sm text-[10px] font-mono font-medium text-gray-700">
                              {p.product_line}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{p.pack_type} / {p.size}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">${p.selling_price.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono">${p.standard_cost.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{p.pcs_per_bag} pcs ({p.bags_per_carton} bags)</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.status === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right flex justify-end gap-1.5">
                            <button onClick={() => handleEdit(p)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-400">No products match criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          )}

          {/* Fallback Tables for Suppliers, Machines, Channels */}
          {['suppliers', 'machines', 'channels'].includes(activeTab) && (
            <div className="overflow-x-auto">
              <ScrollableTable>
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Name / Description</th>
                      {activeTab === 'suppliers' && (
                        <>
                          <th className="px-4 py-3 text-right">Def. LT</th>
                          <th className="px-4 py-3 text-right">Def. Transit</th>
                          <th className="px-4 py-3 text-right">Def. Customs</th>
                        </>
                      )}
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs text-gray-900">
                    {(activeTab === 'suppliers' ? filteredSuppliers : activeTab === 'machines' ? filteredMachines : filteredChannels).map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-500">{item.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{item.name}</p>
                          {item.description && <p className="text-[11px] text-gray-400 font-sans">{item.description}</p>}
                        </td>
                        {activeTab === 'suppliers' && (
                          <>
                            <td className="px-4 py-3 text-right font-mono">{item.default_lead_time_days} days</td>
                            <td className="px-4 py-3 text-right font-mono">{item.default_transit_days} days</td>
                            <td className="px-4 py-3 text-right font-mono">{item.default_customs_clearance_days} days</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-right flex justify-end gap-1.5">
                          <button onClick={() => handleEdit(item)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm cursor-pointer">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(activeTab === 'suppliers' ? filteredSuppliers : activeTab === 'machines' ? filteredMachines : filteredChannels).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          )}
        </div>
      )}

      {/* Slide-over or modal editor for fields */}
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-semibold text-gray-900">{editItem.id ? 'Edit' : 'Create New'} {activeTab.slice(0, -1).toUpperCase()}</h3>
              <button onClick={() => { setShowForm(false); setEditItem(null); }} className="text-gray-400 hover:text-gray-600 text-lg font-medium cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 max-h-[75vh] text-xs">
              {activeTab === 'materials' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">SKU Code</label>
                    <input type="text" value={editItem.sku} onChange={e => setEditItem({ ...editItem, sku: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Material Name</label>
                    <input type="text" value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Category</label>
                    <select value={editItem.category_id} onChange={e => setEditItem({ ...editItem, category_id: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                      {matCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Primary Supplier</label>
                    <select value={editItem.supplier_id} onChange={e => handleSupplierChangeInMaterialForm(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {/* Three lead time legs */}
                  <div className="md:col-span-2 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Replenishment Horizon (Lead-Time Legs)</h4>
                    <p className="text-[11px] text-gray-500">Expose distinct components of supplier-to-factory transport. Overrides defaults from supplier profile.</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">Supplier Production (Days)</label>
                        <input type="number" value={editItem.supplier_lead_time_days} onChange={e => setEditItem({ ...editItem, supplier_lead_time_days: Number(e.target.value) })} className="w-full p-1.5 text-xs border border-gray-300 rounded-md font-mono" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">Freight Transit (Days)</label>
                        <input type="number" value={editItem.transit_days} onChange={e => setEditItem({ ...editItem, transit_days: Number(e.target.value) })} className="w-full p-1.5 text-xs border border-gray-300 rounded-md font-mono" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">Customs Clearance (Days)</label>
                        <input type="number" value={editItem.customs_clearance_days} onChange={e => setEditItem({ ...editItem, customs_clearance_days: Number(e.target.value) })} className="w-full p-1.5 text-xs border border-gray-300 rounded-md font-mono" />
                      </div>
                    </div>
                    {/* Readonly summaries */}
                    <div className="pt-2 flex items-center gap-6 border-t border-gray-200 text-xs font-semibold">
                      <div>
                        <span className="text-gray-500">Total Horizon Days: </span>
                        <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
                          {Number(editItem.supplier_lead_time_days || 0) + Number(editItem.transit_days || 0) + Number(editItem.customs_clearance_days || 0)} days
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Est. Reorder Point: </span>
                        <span className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                          {Math.round((Number(editItem.supplier_lead_time_days || 0) + Number(editItem.transit_days || 0) + Number(editItem.customs_clearance_days || 0)) * 1.25)} days
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Safety Stock Level (Months)</label>
                    <input type="number" step="0.1" value={editItem.safety_stock_months} onChange={e => setEditItem({ ...editItem, safety_stock_months: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Minimum Order Qty (MOQ)</label>
                    <input type="number" value={editItem.moq} onChange={e => setEditItem({ ...editItem, moq: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Max Daily Usage</label>
                    <input type="number" value={editItem.max_usage} onChange={e => setEditItem({ ...editItem, max_usage: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Material Controller</label>
                    <input type="text" value={editItem.controller} onChange={e => setEditItem({ ...editItem, controller: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>

                  {/* Cost configs */}
                  <div className="md:col-span-2 p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Manual Standard Cost</label>
                      <input type="number" step="0.001" value={editItem.standard_cost} onChange={e => setEditItem({ ...editItem, standard_cost: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg font-mono" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Costing Basis Toggle</label>
                      <div className="flex gap-2 pt-1">
                        {['standard', 'weighted_avg'].map(basis => (
                          <button
                            key={basis}
                            type="button"
                            onClick={() => setEditItem({ ...editItem, cost_basis: basis })}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border uppercase tracking-wider cursor-pointer ${
                              editItem.cost_basis === basis 
                                ? 'bg-blue-600 border-blue-600 text-white font-bold' 
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold'
                            }`}
                          >
                            {basis === 'standard' ? 'Standard Cost' : 'Weighted Avg'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 text-xs text-gray-500 font-sans">
                      * Choose standard to use manual pricing, or weighted_avg to utilize the average from live PO invoices.
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Status</label>
                    <select value={editItem.status} onChange={e => setEditItem({ ...editItem, status: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                      <option value="running">Running</option>
                      <option value="obsolete">Obsolete</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'products' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">SKU Code</label>
                    <input type="text" value={editItem.sku} onChange={e => setEditItem({ ...editItem, sku: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Description</label>
                    <input type="text" value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Category</label>
                    <select value={editItem.category_id} onChange={e => setEditItem({ ...editItem, category_id: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                      {prodCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Brand Group</label>
                    <select value={editItem.group_id} onChange={e => setEditItem({ ...editItem, group_id: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                      {prodGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Machine Line (PPS)</label>
                    <select value={editItem.product_line} onChange={e => setEditItem({ ...editItem, product_line: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                      {machines.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Pack Type</label>
                    <input type="text" value={editItem.pack_type} onChange={e => setEditItem({ ...editItem, pack_type: e.target.value })} placeholder="Jumbo / Medium" className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Size</label>
                    <input type="text" value={editItem.size} onChange={e => setEditItem({ ...editItem, size: e.target.value })} placeholder="Size 4 / Normal" className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Selling Price ($)</label>
                    <input type="number" step="0.01" value={editItem.selling_price} onChange={e => setEditItem({ ...editItem, selling_price: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Standard Cost ($)</label>
                    <input type="number" step="0.01" value={editItem.standard_cost} onChange={e => setEditItem({ ...editItem, standard_cost: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Pcs Per Bag</label>
                    <input type="number" value={editItem.pcs_per_bag} onChange={e => setEditItem({ ...editItem, pcs_per_bag: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Bags Per Carton</label>
                    <input type="number" value={editItem.bags_per_carton} onChange={e => setEditItem({ ...editItem, bags_per_carton: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Status</label>
                    <select value={editItem.status} onChange={e => setEditItem({ ...editItem, status: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                      <option value="running">Running</option>
                      <option value="obsolete">Obsolete</option>
                    </select>
                  </div>
                </div>
              )}

              {['suppliers', 'machines', 'channels'].includes(activeTab) && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Name</label>
                    <input type="text" value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                  {activeTab === 'machines' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">Description</label>
                      <input type="text" value={editItem.description} onChange={e => setEditItem({ ...editItem, description: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                  )}
                  {activeTab === 'suppliers' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-600 font-medium">Default Lead Time</label>
                        <input type="number" value={editItem.default_lead_time_days} onChange={e => setEditItem({ ...editItem, default_lead_time_days: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 font-medium">Default Transit</label>
                        <input type="number" value={editItem.default_transit_days} onChange={e => setEditItem({ ...editItem, default_transit_days: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 font-medium">Default Customs</label>
                        <input type="number" value={editItem.default_customs_clearance_days} onChange={e => setEditItem({ ...editItem, default_customs_clearance_days: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 bg-gray-50 px-6 py-4 -mx-6 -mb-6 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditItem(null); }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn_submit_master_form"
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
