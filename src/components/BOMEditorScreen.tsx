/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  fetchTableData, saveRecord, deleteRecord, 
  getVBOMCostDetail, getVFGCost 
} from '../supabaseClient';
import { Product, Material, BOMHeader, BOMSlot, BOMOption, VBOMCostDetail, VFGCost } from '../types';
import { Layers, Plus, Trash2, Edit2, CheckCircle, ArrowUp, ArrowDown, TrendingUp, Info, DollarSign } from 'lucide-react';
import { useToast } from '../context/ToastConfirmContext';
import { useAuth } from '../context/AuthContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import SearchBar from './SearchBar';
import ContentHeader from './ContentHeader';

interface BOMEditorScreenProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  refreshKey?: number;
}

export default function BOMEditorScreen({
  searchQuery = '',
  setSearchQuery = () => {},
  refreshKey = 0,
}: BOMEditorScreenProps) {
  const { showToast, confirm: askConfirm } = useToast();
  const { hasRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // BOM relational items
  const [activeBomHeader, setActiveBomHeader] = useState<BOMHeader | null>(null);
  const [slots, setSlots] = useState<BOMSlot[]>([]);
  const [options, setOptions] = useState<BOMOption[]>([]);

  // Derived View States
  const [costDetails, setCostDetails] = useState<VBOMCostDetail[]>([]);
  const [fgCost, setFgCost] = useState<VFGCost | null>(null);

  const [loading, setLoading] = useState(true);

  // Form states
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [newSlotName, setNewSlotName] = useState('');

  const [showOptionModal, setShowOptionModal] = useState(false);
  const [selectedSlotForOption, setSelectedSlotForOption] = useState<string>('');
  const [newOptionMaterialId, setNewOptionMaterialId] = useState('');
  const [newOptionQty, setNewOptionQty] = useState(1.0);
  const [newOptionScrap, setNewOptionScrap] = useState(3.0);

  // Edit Qty/Scrap Inline State
  const [editingOptionId, setEditingOptionId] = useState<string>('');
  const [editingQty, setEditingQty] = useState(0);
  const [editingScrap, setEditingScrap] = useState(0);

  const slotModalRef = useRef<HTMLDivElement>(null);
  const optionModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(slotModalRef, showSlotModal, () => setShowSlotModal(false));
  useFocusTrap(optionModalRef, showOptionModal, () => setShowOptionModal(false));

  async function loadInitialData() {
    try {
      const [prods, mats] = await Promise.all([
        fetchTableData<Product>('products'),
        fetchTableData<Material>('materials')
      ]);
      setProducts(prods);
      setMaterials(mats);
      if (prods.length > 0) {
        setSelectedProductId(prods[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch initial products/materials for BOM", e);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [refreshKey]);

  // Reload BOM relational records whenever selectedProductId changes
  useEffect(() => {
    if (!selectedProductId) return;
    loadActiveBOM();
  }, [selectedProductId]);

  async function loadActiveBOM() {
    setLoading(true);
    try {
      // Find headers
      const headers = await fetchTableData<BOMHeader>('bom_headers');
      let activeH = headers.find(h => h.product_id === selectedProductId && h.is_active);
      
      // If none active, let's create a virtual active BOM header so the user doesn't see empty screens
      if (!activeH) {
        const fallbackHeader: BOMHeader = {
          id: `BH_AUTO_${selectedProductId}`,
          product_id: selectedProductId,
          description: `Auto-generated BOM for SKU`,
          is_active: true
        };
        activeH = await saveRecord<BOMHeader>('bom_headers', fallbackHeader);
      }
      setActiveBomHeader(activeH);

      // Load slots and options
      const allSlots = await fetchTableData<BOMSlot>('bom_slots');
      const allOptions = await fetchTableData<BOMOption>('bom_options');

      const activeSlots = allSlots.filter(s => s.bom_id === activeH!.id);
      const activeSlotIds = activeSlots.map(s => s.id);
      const activeOptions = allOptions.filter(o => activeSlotIds.includes(o.slot_id));

      setSlots(activeSlots);
      setOptions(activeOptions);

      // Re-trigger view summaries
      await refreshSummaries();
    } catch (e) {
      console.error("Failed to load active BOM", e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSummaries() {
    if (!selectedProductId) return;
    const [cDetails, fCost] = await Promise.all([
      getVBOMCostDetail(selectedProductId),
      getVFGCost(selectedProductId)
    ]);
    setCostDetails(cDetails);
    setFgCost(fCost);
  }

  const openSlotModal = () => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to add BOM slots.', 'error');
      return;
    }
    setShowSlotModal(true);
  };

  const openOptionModal = (slotId: string) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to add BOM materials.', 'error');
      return;
    }
    setSelectedSlotForOption(slotId);
    setShowOptionModal(true);
  };

  // Action: Add Slot
  const handleAddSlot = async (e: React.FormEvent) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to add BOM slots.', 'error');
      return;
    }
    e.preventDefault();
    if (!activeBomHeader || !newSlotName.trim()) return;

    const newSlot: BOMSlot = {
      id: '',
      bom_id: activeBomHeader.id,
      slot_name: newSlotName.trim()
    };

    try {
      const saved = await saveRecord<BOMSlot>('bom_slots', newSlot);
      setSlots(prev => [...prev, saved]);
      setNewSlotName('');
      setShowSlotModal(false);
      showToast("Slot added successfully!", "success");
    } catch (err) {
      showToast("Failed to add slot.", "error");
    }
  };


  // Action: Add Option
  const handleAddOption = async (e: React.FormEvent) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to add BOM materials.', 'error');
      return;
    }
    e.preventDefault();
    if (!selectedSlotForOption || !newOptionMaterialId) return;

    // Get current options for this slot to find priority
    const slotOpts = options.filter(o => o.slot_id === selectedSlotForOption);
    const maxPriority = slotOpts.reduce((max, o) => Math.max(max, o.priority), 0);

    const newOpt: BOMOption = {
      id: '',
      slot_id: selectedSlotForOption,
      material_id: newOptionMaterialId,
      qty_per_unit: newOptionQty,
      scrap_percent: newOptionScrap,
      priority: maxPriority + 1
    };

    try {
      const saved = await saveRecord<BOMOption>('bom_options', newOpt);
      setOptions(prev => [...prev, saved]);
      setShowOptionModal(false);
      setNewOptionMaterialId('');
      setNewOptionQty(1.0);
      setNewOptionScrap(3.0);
      showToast("BOM Option saved!", "success");
      await refreshSummaries();
    } catch (err) {
      showToast("Failed to save BOM Option.", "error");
    }
  };


  // Action: Swap/Make Primary
  const handleMakePrimary = async (optionId: string, slotId: string) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to change the primary material.', 'error');
      return;
    }
    // Locate all options for this slot
    const slotOpts = options.filter(o => o.slot_id === slotId);
    const targetOpt = slotOpts.find(o => o.id === optionId);
    if (!targetOpt || targetOpt.priority === 1) return; // already primary

    // Increase priority of current primary to let this one take priority 1
    const currentPrimary = slotOpts.find(o => o.priority === 1);

    const updatedOptions = [...options];

    try {
      if (currentPrimary) {
        const uPrimary = { ...currentPrimary, priority: targetOpt.priority };
        const savedPrimary = await saveRecord<BOMOption>('bom_options', uPrimary);
        updatedOptions.map(o => o.id === savedPrimary.id ? savedPrimary : o);
      }

      const uTarget = { ...targetOpt, priority: 1 };
      const savedTarget = await saveRecord<BOMOption>('bom_options', uTarget);
      
      const finalOptions = updatedOptions.map(o => {
        if (o.id === savedTarget.id) return savedTarget;
        if (currentPrimary && o.id === currentPrimary.id) return { ...o, priority: targetOpt.priority };
        return o;
      });

      setOptions(finalOptions);
      showToast("Priority updated successfully!", "success");
      await refreshSummaries();
    } catch (err) {
      showToast("Failed to swap BOM priority.", "error");
    }
  };


  // Action: Save Inline Qty / Scrap edit
  const handleSaveInlineEdit = async (opt: BOMOption) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to edit BOM lines.', 'error');
      return;
    }
    const updated = { 
      ...opt, 
      qty_per_unit: Number(editingQty), 
      scrap_percent: Number(editingScrap) 
    };

    try {
      const saved = await saveRecord<BOMOption>('bom_options', updated);
      setOptions(prev => prev.map(o => o.id === opt.id ? saved : o));
      setEditingOptionId('');
      showToast("Option values updated!", "success");
      await refreshSummaries();
    } catch (err) {
      showToast("Failed to edit option values.", "error");
    }
  };


  // Action: Delete Option
  const handleDeleteOption = async (optionId: string) => {
    if (!hasRole('admin')) {
      showToast('Deleting records requires an Admin account.', 'error');
      return;
    }
    const isConfirmed = await askConfirm("Are you sure you want to remove this material option from the BOM?", "Delete Option");
    if (!isConfirmed) return;
    try {
      await deleteRecord('bom_options', optionId);
      setOptions(prev => prev.filter(o => o.id !== optionId));
      showToast("Option removed from BOM.", "success");
      await refreshSummaries();
    } catch (err) {
      showToast("Delete failed.", "error");
    }
  };

  // Action: Delete Slot
  const handleDeleteSlot = async (slotId: string) => {
    if (!hasRole('admin')) {
      showToast('Deleting records requires an Admin account.', 'error');
      return;
    }
    const isConfirmed = await askConfirm("Delete this slot and all of its associated material options?", "Delete Slot");
    if (!isConfirmed) return;
    try {
      // First delete associated options
      const assocOptions = options.filter(o => o.slot_id === slotId);
      for (const opt of assocOptions) {
        await deleteRecord('bom_options', opt.id);
      }
      await deleteRecord('bom_slots', slotId);

      setSlots(prev => prev.filter(s => s.id !== slotId));
      setOptions(prev => prev.filter(o => o.slot_id !== slotId));
      showToast("Slot and all associated options deleted.", "success");
      await refreshSummaries();
    } catch (err) {
      showToast("Delete slot failed.", "error");
    }
  };


  const selectedProduct = products.find(p => p.id === selectedProductId);

  const filteredSlots = useMemo(() => {
    return slots.filter(slot => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      if (slot.slot_name.toLowerCase().includes(q)) return true;
      const slotOpts = options.filter(o => o.slot_id === slot.id);
      return slotOpts.some(opt => {
        const mat = materials.find(m => m.id === opt.material_id);
        return mat && (mat.name.toLowerCase().includes(q) || mat.sku.toLowerCase().includes(q));
      });
    });
  }, [slots, searchQuery, options, materials]);

  return (
    <div className="space-y-6" id="bom_editor_screen">
      <ContentHeader
        title="Interactive BOM Architect"
        subtitle="Formulate and rank component slots. Adjust yields, alternates, and evaluate real-time unit costing."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search BOM components..."
              className="w-48"
            />
            <select
              id="bom_product_picker"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="px-3.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 shadow-xs focus:outline-hidden cursor-pointer"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
              ))}
            </select>
            <button
              id="btn_add_slot"
              onClick={openSlotModal}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Slot
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main BOM List */}
          <div className="lg:col-span-2 space-y-4">
            {filteredSlots.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                <Layers className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-600">
                  {searchQuery ? 'No matching slots found' : 'No components slots created yet'}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery 
                    ? 'Try refining your search query or clear it to view all.' 
                    : 'Click "Add Slot" above to define structural positions like Top Sheet Surface, Core Absorbent, or Polybag.'}
                </p>
              </div>
            ) : (
              filteredSlots.map(slot => {
                const slotOpts = options.filter(o => o.slot_id === slot.id)
                  .sort((a, b) => a.priority - b.priority);

                return (
                  <div key={slot.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition-colors">
                    {/* Slot Header */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{slot.slot_name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openOptionModal(slot.id)}
                          className="flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-sm"
                        >
                          <Plus className="w-3 h-3" /> Add Material
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-sm hover:bg-red-50"
                          title="Delete entire slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Slot Material Options */}
                    <div className="divide-y divide-slate-100">
                      {slotOpts.map(opt => {
                        const mat = materials.find(m => m.id === opt.material_id);
                        const isPrimary = opt.priority === 1;
                        const isEditing = editingOptionId === opt.id;

                        // Lookup live cost calculation
                        const liveCost = costDetails.find(d => d.material_id === opt.material_id && d.slot_id === slot.id);

                        return (
                          <div key={opt.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isPrimary ? 'bg-emerald-50/10' : ''}`}>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                  isPrimary ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isPrimary ? 'Primary (MRP Active)' : 'Alternate'}
                                </span>
                                <span className="text-xs font-semibold text-slate-900">{mat ? mat.name : 'Unknown Material'}</span>
                                <span className="text-[10px] text-slate-400 font-mono font-medium">({mat ? mat.sku : ''})</span>
                              </div>
                              <div className="text-xs text-slate-500 font-sans">
                                Unit Standard Cost: <span className="font-semibold text-slate-700 font-mono">${mat?.standard_cost.toFixed(3)}</span> 
                                {mat?.cost_basis === 'weighted_avg' && <span className="text-[10px] text-indigo-500 font-medium"> (using Weighted-Avg PO)</span>}
                              </div>
                            </div>

                            {/* Qty & Scrap Inputs / Labels */}
                            <div className="flex items-center gap-4">
                              {isEditing ? (
                                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <div className="w-20">
                                    <span className="block text-[9px] font-semibold uppercase text-slate-400 mb-0.5">Qty / Unit</span>
                                    <input 
                                      type="number" 
                                      step="0.001" 
                                      value={editingQty} 
                                      onChange={e => setEditingQty(Number(e.target.value))} 
                                      className="w-full p-1 text-xs font-mono border border-slate-300 rounded-md" 
                                    />
                                  </div>
                                  <div className="w-20">
                                    <span className="block text-[9px] font-semibold uppercase text-slate-400 mb-0.5">Scrap %</span>
                                    <input 
                                      type="number" 
                                      step="0.1" 
                                      value={editingScrap} 
                                      onChange={e => setEditingScrap(Number(e.target.value))} 
                                      className="w-full p-1 text-xs font-mono border border-slate-300 rounded-md" 
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleSaveInlineEdit(opt)}
                                    className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 self-end h-7"
                                  >
                                    Apply
                                  </button>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <p className="text-xs text-slate-700">
                                    Qty: <span className="font-semibold font-mono">{opt.qty_per_unit}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    Scrap: <span className="font-semibold font-mono">{opt.scrap_percent}%</span>
                                  </p>
                                </div>
                              )}

                              <div className="text-right w-24">
                                <p className="text-xs font-semibold text-slate-900 font-mono">
                                  ${liveCost ? liveCost.line_cost.toFixed(4) : '0.0000'}
                                </p>
                                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Line cost</p>
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-1.5 border-l border-slate-100 pl-4">
                                {!isPrimary && (
                                  <button
                                    onClick={() => handleMakePrimary(opt.id, slot.id)}
                                    className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 whitespace-nowrap"
                                  >
                                    Set Primary
                                  </button>
                                )}
                                {!isEditing && (
                                  <button
                                    onClick={() => {
                                      setEditingOptionId(opt.id);
                                      setEditingQty(opt.qty_per_unit);
                                      setEditingScrap(opt.scrap_percent);
                                    }}
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded-sm hover:bg-slate-100"
                                    title="Edit qty/scrap"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteOption(opt.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded-sm hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {slotOpts.length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-xs">No material options assigned to this slot. Click "Add Material" above.</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* BOM Financial Analyzer Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Live BOM Financials
              </h3>

              {fgCost ? (
                <div className="space-y-6">
                  {/* KPI cards inside sidebar */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Unit Selling Price</span>
                    <h4 className="text-xl font-bold text-slate-900 font-mono">${fgCost.selling_price.toFixed(2)}</h4>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Material Cost Breakdown (Primary)</h4>
                    
                    <div className="space-y-1.5 text-xs text-slate-600 font-sans">
                      <div className="flex justify-between">
                        <span>Raw Materials (RM)</span>
                        <span className="font-mono font-medium">${fgCost.rm_cost.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Packaging (PK)</span>
                        <span className="font-mono font-medium">${fgCost.pk_cost.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Consumables (CON)</span>
                        <span className="font-mono font-medium">${fgCost.con_cost.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-dashed border-slate-200 font-bold text-slate-900">
                        <span>Total COGS (Material)</span>
                        <span className="font-mono">${fgCost.total_material_cost.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 space-y-2">
                    <h5 className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Margin Analysis
                    </h5>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-emerald-900">Contribution Margin:</span>
                      <span className="text-sm font-extrabold text-emerald-700 font-mono">${fgCost.margin_per_unit.toFixed(2)}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-emerald-900">Gross Margin %:</span>
                      <span className="text-sm font-extrabold text-emerald-700 font-mono">{fgCost.margin_percent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Add primary material slots to evaluate contribution margin metrics.</p>
              )}
            </div>

            {/* Quick Tips Box */}
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-xs text-blue-800 space-y-1.5">
              <h4 className="font-semibold flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Plan alignment tip</h4>
              <p className="leading-relaxed">The MRP engine explodes weekly production quantities only using materials set to <b>"Primary"</b>. Alternate materials serve as a structural cost benchmark here.</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" ref={slotModalRef}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add New Component Slot</h3>
              <button onClick={() => setShowSlotModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">&times;</button>
            </div>
            <form onSubmit={handleAddSlot} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Slot Name</label>
                <input
                  type="text"
                  value={newSlotName}
                  onChange={e => setNewSlotName(e.target.value)}
                  placeholder="e.g. Back Sheet Surface, Elastic Leg Cuff"
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowSlotModal(false)} className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add Slot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Option Modal */}
      {showOptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" ref={optionModalRef}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add Material Option to Slot</h3>
              <button onClick={() => setShowOptionModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">&times;</button>
            </div>
            <form onSubmit={handleAddOption} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Select Material</label>
                <select
                  value={newOptionMaterialId}
                  onChange={e => setNewOptionMaterialId(e.target.value)}
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">-- Choose Material --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.sku} - {m.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Qty Per Unit</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newOptionQty}
                    onChange={e => setNewOptionQty(Number(e.target.value))}
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Scrap %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newOptionScrap}
                    onChange={e => setNewOptionScrap(Number(e.target.value))}
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowOptionModal(false)} className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add Material</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
