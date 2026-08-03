/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { fetchTableData, saveRecord, getVProductCoverage, getPlanningPeriod } from '../supabaseClient';
import { Product, Machine, ProductionPlan, SalesPlan, InventorySnapshot } from '../types';
import { Cpu, RefreshCw, Sparkles, Save, Download, Table, BarChart3 } from 'lucide-react';
import CsvImportHelper from './CsvImportHelper';
import { useToast } from '../context/ToastConfirmContext';
import { useAuth } from '../context/AuthContext';
import { useTableFilters } from '../hooks/useTableFilters';
import SearchBar from './SearchBar';
import ScrollableTable from './ScrollableTable';
import ContentHeader from './ContentHeader';

type GrainType = 'day' | 'week' | 'month';

interface ProductionPlanScreenProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  refreshKey?: number;
}

export default function ProductionPlanScreen({
  searchQuery = '',
  setSearchQuery = () => {},
  refreshKey = 0,
}: ProductionPlanScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [productionPlans, setProductionPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Screen Tabs
  const [activeTab, setActiveTab] = useState<'schedule' | 'reports'>('schedule');
  const [reportView, setReportView] = useState<'machine' | 'sku'>('machine');

  const [selectedGrain, setSelectedGrain] = useState<GrainType>('month');
  const [columns, setColumns] = useState<string[]>([]);
  const [gridEdits, setGridEdits] = useState<Record<string, number>>({}); // "product_id:period_start" -> quantity

  const { showToast, confirm: askConfirm } = useToast();

  const { hasRole } = useAuth();

  async function loadData() {
    setLoading(true);
    try {
      const [prods, macs, plans] = await Promise.all([
        fetchTableData<Product>('products'),
        fetchTableData<Machine>('machines'),
        fetchTableData<ProductionPlan>('production_plan')
      ]);
      setProducts(prods);
      setMachines(macs);
      setProductionPlans(plans);
    } catch (e: any) {
      showToast("Failed to load production plan dependencies: " + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  // Sync columns based on grain
  useEffect(() => {
    const today = new Date(getPlanningPeriod()); // grid window starts at the active period
    const cols: string[] = [];

    if (selectedGrain === 'month') {
      for (let i = 0; i < 4; i++) {
        const d = new Date(today);
        d.setMonth(today.getMonth() + i);
        cols.push(d.toISOString().slice(0, 7) + '-01');
      }
    } else if (selectedGrain === 'week') {
      for (let i = 0; i < 6; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + (i * 7));
        cols.push(d.toISOString().slice(0, 10));
      }
    } else { // day
      for (let i = 0; i < 10; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        cols.push(d.toISOString().slice(0, 10));
      }
    }
    setColumns(cols);
    setGridEdits({});
  }, [selectedGrain]);

  const handleCellChange = (productId: string, colDate: string, value: string) => {
    const key = `${productId}:${colDate}`;
    setGridEdits(prev => ({
      ...prev,
      [key]: Number(value) || 0
    }));
  };

  const handleSaveGrid = async () => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to save the production plan.', 'error');
      return;
    }
    const keys = Object.keys(gridEdits);
    if (keys.length === 0) return;

    setLoading(true);
    try {
      for (const key of keys) {
        const [productId, periodStart] = key.split(':');
        const quantity = gridEdits[key];

        const product = products.find(p => p.id === productId);
        if (!product) {
          throw new Error(`Product with ID ${productId} not found.`);
        }
        const machineName = product.product_line;
        const matchingMachine = machines.find(m => m.name === machineName);
        if (!matchingMachine) {
          showToast(`Save blocked: Product ${product.sku} has an invalid or unconfigured machine line: "${machineName || 'None'}". Please correct in Master Data.`, "error");
          setLoading(false);
          return;
        }
        const machineId = matchingMachine.id;

        const existing = productionPlans.find(p => 
          p.product_id === productId && 
          p.period_type === selectedGrain && 
          p.period_start === periodStart
        );

        const recordToSave: ProductionPlan = {
          id: existing ? existing.id : `PP_REC_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          product_id: productId,
          machine_id: machineId,
          period_type: selectedGrain,
          period_start: periodStart,
          quantity: quantity
        };

        await saveRecord<ProductionPlan>('production_plan', recordToSave);
      }

      const updatedPlans = await fetchTableData<ProductionPlan>('production_plan');
      setProductionPlans(updatedPlans);
      setGridEdits({});
      showToast("MPS Production Plan saved successfully!", "success");
    } catch (err: any) {
      showToast("Save failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestPlans = async () => {
    setLoading(true);
    try {
      const [sales, pCov, inv] = await Promise.all([
        fetchTableData<SalesPlan>('sales_plan'),
        getVProductCoverage(),
        fetchTableData<InventorySnapshot>('inventory_snapshots')
      ]);

      const suggestions: Record<string, number> = {};
      const runningStocks: Record<string, number> = {};
      products.forEach(p => {
        const stockSnap = inv.find(i => i.item_type === 'product' && i.item_id === p.id);
        runningStocks[p.id] = stockSnap ? stockSnap.quantity : 0;
      });

      columns.forEach(col => {
        products.forEach(p => {
          const periodSales = sales
            .filter(s => s.product_id === p.id && s.period_type === selectedGrain && s.period_start === col)
            .reduce((sum, s) => sum + s.quantity, 0);

          const demand = periodSales;
          let safetyStockTarget = 0;
          if (selectedGrain === 'month') {
            safetyStockTarget = Math.round(demand * 1.5);
          } else if (selectedGrain === 'week') {
            safetyStockTarget = Math.round(demand * 1.5 * 4);
          } else {
            safetyStockTarget = Math.round(demand * 1.5 * 30);
          }

          const currentProjStock = runningStocks[p.id];
          const val = Math.max(0, Math.round(safetyStockTarget + demand - currentProjStock));

          if (val > 0) {
            suggestions[`${p.id}:${col}`] = val;
          }

          runningStocks[p.id] = currentProjStock - demand + val;
        });
      });

      setGridEdits(suggestions);
      showToast("Algorithmic suggestions prefilled! Review and click Save Changes.", "success");
    } catch (err: any) {
      showToast("Prefill algorithm failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestPlansClick = async () => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to generate a suggested plan.', 'error');
      return;
    }
    const isConfirmed = await askConfirm(
      "This will overwrite unsaved grid entries with algorithmic suggestions prefilled according to the demand, stock, and safety margins. Would you like to calculate and apply now?",
      "Confirm Suggestion"
    );
    if (isConfirmed) {
      await handleSuggestPlans();
    }
  };

  const handleCsvImport = async (data: any[]) => {
    if (!hasRole('planner')) {
      showToast('Your account is read-only - Planner or Admin access is required to import production plans.', 'error');
      return;
    }
    setLoading(true);
    try {
      for (const row of data) {
        const prod = products.find(p => p.id === row.product_id);
        const machineName = prod ? prod.product_line : 'Pants';
        const machineId = machines.find(m => m.name === machineName)?.id || 'M4';

        const existing = productionPlans.find(p => 
          p.product_id === row.product_id && 
          p.period_type === (row.period_type || selectedGrain) && 
          p.period_start === row.period_start
        );

        const finalRow: ProductionPlan = {
          id: existing ? existing.id : `PP_REC_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          product_id: row.product_id,
          machine_id: row.machine_id || machineId,
          period_type: row.period_type || selectedGrain,
          period_start: row.period_start,
          quantity: Number(row.quantity || 0)
        };
        await saveRecord<ProductionPlan>('production_plan', finalRow);
      }
      await loadData();
      showToast(`Imported ${data.length} production slots successfully!`, "success");
    } catch (err: any) {
      showToast("Import failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const getCellValue = (productId: string, colDate: string): string => {
    const editKey = `${productId}:${colDate}`;
    if (gridEdits[editKey] !== undefined) {
      return String(gridEdits[editKey]);
    }

    const rec = productionPlans.find(p => 
      p.product_id === productId && 
      p.period_type === selectedGrain && 
      p.period_start === colDate
    );

    return rec ? String(rec.quantity) : '';
  };

  const calculateMachineColumnSum = (mName: string, colDate: string): number => {
    const mProducts = products.filter(p => p.product_line === mName);
    let total = 0;
    mProducts.forEach(p => {
      total += Number(getCellValue(p.id, colDate)) || 0;
    });
    return total;
  };

  const getAdjustedCapacity = (machineCapacity: number | undefined) => {
    const cap = machineCapacity || 300000;
    if (selectedGrain === 'week') return Math.round(cap / 4);
    if (selectedGrain === 'day') return Math.round(cap / 30);
    return cap;
  };

  const formatHeader = (colDate: string) => {
    if (selectedGrain === 'month') {
      const parts = colDate.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
    const date = new Date(colDate);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  };

  // Filter products matching Search Query using useTableFilters hook
  const { filtered: filteredProducts, hasActiveSearch } = useTableFilters<Product>(
    products,
    ['name', 'sku', 'product_line', 'brand'],
    {},
    searchQuery,
    setSearchQuery
  );

  // Pivot Logic & Capacity Color-Coding for Reports
  const machineReportRows = useMemo(() => {
    return machines.map(mac => {
      const capacity = getAdjustedCapacity(mac.monthly_capacity);
      const colsData = columns.map(col => {
        const sum = calculateMachineColumnSum(mac.name, col);
        const utilization = capacity > 0 ? (sum / capacity) * 100 : 0;
        return { sum, utilization };
      });
      return { machine: mac, capacity, colsData };
    });
  }, [machines, products, columns, productionPlans, gridEdits, selectedGrain]);

  const skuReportRows = useMemo(() => {
    return filteredProducts.map(p => {
      const colsData = columns.map(col => {
        const val = Number(getCellValue(p.id, col)) || 0;
        return val;
      });
      return { product: p, colsData };
    });
  }, [filteredProducts, columns, productionPlans, gridEdits]);

  // Export CSV function for pivot reports
  const exportReportToCsv = () => {
    let csvContent = "";
    if (reportView === 'machine') {
      const headers = ["Machine", "Base Capacity", ...columns.map(col => formatHeader(col))];
      csvContent += headers.join(",") + "\n";
      machineReportRows.forEach(row => {
        const dataCells = row.colsData.map(c => `${c.sum} (${c.utilization.toFixed(1)}%)`);
        const csvLine = [row.machine.name, row.capacity, ...dataCells];
        csvContent += csvLine.join(",") + "\n";
      });
    } else {
      const headers = ["SKU", "Name", "Machine", ...columns.map(col => formatHeader(col))];
      csvContent += headers.join(",") + "\n";
      skuReportRows.forEach(row => {
        const csvLine = [
          row.product.sku,
          `"${row.product.name.replace(/"/g, '""')}"`,
          row.product.product_line,
          ...row.colsData
        ];
        csvContent += csvLine.join(",") + "\n";
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `production_report_${reportView}_${selectedGrain}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${reportView === 'machine' ? 'By Machine' : 'By SKU'} report exported successfully!`, "success");
  };

  return (
    <div className="space-y-6" id="production_plan_screen">
      <ContentHeader
        title="Master Production Schedule (MPS)"
        subtitle="Build finite production plans grouped by machinery lines and generate capacity utilization audits."
        actions={
          <div className="flex items-center gap-2.5">
            {activeTab === 'schedule' ? (
              <>
                <button
                  id="btn_suggest_mps"
                  onClick={handleSuggestPlansClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all shadow-2xs cursor-pointer"
                  title="Pre-fill based on sales demand − stock + SS level"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                  Suggest From Sales
                </button>
                <CsvImportHelper 
                  fields={[
                    { key: 'product_id', label: 'Product ID *', required: true },
                    { key: 'period_start', label: 'Period Start (YYYY-MM-DD) *', required: true },
                    { key: 'quantity', label: 'Quantity *', required: true, defaultValue: 0 },
                    { key: 'machine_id', label: 'Machine ID (Optional)' },
                    { key: 'period_type', label: 'Grain (Optional: day/week/month)' }
                  ]}
                  onImport={handleCsvImport}
                  title="Import MPS Plan"
                />
                <button
                  id="btn_save_prod_grid"
                  onClick={handleSaveGrid}
                  disabled={Object.keys(gridEdits).length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Changes ({Object.keys(gridEdits).length})
                </button>
              </>
            ) : (
              <button
                id="btn_export_prod_report"
                onClick={exportReportToCsv}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export CSV Report
              </button>
            )}
          </div>
        }
      />

      {/* Primary Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Table className="w-4 h-4" />
          Interactive Schedule
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Production Reports & Pivots
        </button>
      </div>

      {/* Control row */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 font-sans">
        {/* Grain Switcher */}
        <div className="flex bg-white rounded-lg border border-gray-300 p-0.5" id="mps_grain_switcher">
          {(['day', 'week', 'month'] as GrainType[]).map(grain => (
            <button
              key={grain}
              id={`mps_grain_${grain}`}
              onClick={() => setSelectedGrain(grain)}
              className={`px-3 py-1 text-xs font-bold capitalize rounded-md transition-colors cursor-pointer ${
                selectedGrain === grain 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {grain}
            </button>
          ))}
        </div>

        {/* View mode switcher for report tab */}
        {activeTab === 'reports' && (
          <div className="flex bg-white rounded-lg border border-gray-300 p-0.5" id="report_view_switcher">
            <button
              onClick={() => setReportView('machine')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                reportView === 'machine'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              By Machine
            </button>
            <button
              onClick={() => setReportView('sku')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                reportView === 'sku'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              By SKU
            </button>
          </div>
        )}

        {/* Search input */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search SKUs/products..."
          className="w-48"
          hasActiveSearch={hasActiveSearch}
        />

        <button onClick={loadData} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors cursor-pointer ms-auto" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : activeTab === 'schedule' ? (
        /* MAIN INTERACTIVE MPS GRID TAB */
        <div className="space-y-6 font-sans" id="mps_machines_blocks_container">
          {machines.map(mac => {
            const mProducts = products.filter(p => 
              p.product_line === mac.name &&
              (searchQuery === '' || 
               p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
               p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
            );

            const dynamicCapacity = getAdjustedCapacity(mac.monthly_capacity);

            return (
              <div key={mac.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs hover:border-gray-300 transition-colors">
                {/* Machine Header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    <div>
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">{mac.name} Line</h3>
                      <p className="text-[10px] text-gray-400 font-sans">{mac.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold">
                      Capacity: {dynamicCapacity.toLocaleString()} / period
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold">
                      {mProducts.length} SKUs Assigned
                    </span>
                  </div>
                </div>

                {/* SKU Grid */}
                <div className="overflow-x-auto">
                  <ScrollableTable>
                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                      <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2">SKU</th>
                          <th className="px-4 py-2">Finished Product Name</th>
                          <th className="px-4 py-2">Pack / Size</th>
                          {columns.map(col => (
                            <th key={col} className="px-4 py-2 text-right font-mono min-w-[150px]">
                              {formatHeader(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-xs text-gray-900">
                        {mProducts.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50/30 transition-colors">
                            <td className="px-4 py-2 font-mono text-gray-500 font-semibold">{p.sku}</td>
                            <td className="px-4 py-2 font-semibold text-slate-800">{p.name}</td>
                            <td className="px-4 py-2 text-gray-400">{p.pack_type} / {p.size}</td>
                            {columns.map(col => (
                              <td key={col} className="px-4 py-1.5 text-right">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={getCellValue(p.id, col)}
                                  onChange={(e) => handleCellChange(p.id, col, e.target.value)}
                                  className="w-full text-right p-1.5 border border-transparent rounded-lg hover:border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-hidden font-bold font-mono text-xs text-gray-800"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}

                        {mProducts.length === 0 && (
                          <tr>
                            <td colSpan={3 + columns.length} className="px-4 py-6 text-center text-gray-400">No products assigned to this machine. Update product master lines.</td>
                          </tr>
                        )}

                        {mProducts.length > 0 && (
                          <tr className="bg-gray-50/70 border-t-2 border-gray-200 font-bold text-gray-900">
                            <td colSpan={3} className="px-4 py-3 uppercase text-[10px] tracking-wider text-gray-500 font-bold">
                              Total {mac.name} Production Volume
                            </td>
                            {columns.map(col => (
                              <td key={col} className="px-4 py-3 text-right font-mono font-extrabold text-blue-600 bg-blue-50/20">
                                {calculateMachineColumnSum(mac.name, col).toLocaleString()}
                              </td>
                            ))}
                          </tr>
                        )}

                        {mProducts.length > 0 && (
                          <tr className="bg-slate-100/50 font-semibold border-b border-gray-200 text-gray-700">
                            <td colSpan={3} className="px-4 py-2.5 uppercase text-[9px] tracking-wider text-gray-500 font-bold">
                              Machine Capacity Utilization
                            </td>
                            {columns.map(col => {
                              const sum = calculateMachineColumnSum(mac.name, col);
                              const utilization = dynamicCapacity > 0 ? (sum / dynamicCapacity) * 100 : 0;
                              const isOverloaded = utilization > 95;

                              return (
                                <td key={col} className="px-4 py-2.5 text-right font-mono text-xs">
                                  <div className="space-y-1 bg-white p-1.5 rounded border border-gray-100 shadow-3xs flex flex-col items-end">
                                    <div className="flex items-center justify-between w-full gap-1.5 text-[10px]">
                                      <span className="font-sans font-bold text-gray-400 uppercase">util:</span>
                                      <span className={`font-bold font-mono ${isOverloaded ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {utilization.toFixed(1)}%
                                      </span>
                                    </div>
                                    
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${
                                          isOverloaded ? 'bg-red-500 animate-pulse' : 'bg-emerald-50'
                                        }`} 
                                        style={{ width: `${Math.min(100, utilization)}%` }}
                                      ></div>
                                    </div>

                                    {isOverloaded && (
                                      <span className="inline-block px-1 py-0.5 bg-red-100 border border-red-200 text-red-700 text-[8px] font-extrabold rounded-sm font-sans tracking-wide uppercase mt-0.5">
                                        ⚠️ Overloaded
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </ScrollableTable>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* REPORTS AND PIVOTS TAB */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs font-sans p-4 space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              {reportView === 'machine' ? 'Production Capacity Audit Pivot (By Machine)' : 'Finished Goods Production Plan Pivot (By SKU)'}
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">Grain: {selectedGrain}</span>
          </div>

          <div className="overflow-x-auto">
            <ScrollableTable>
              {reportView === 'machine' ? (
                /* BY MACHINE REPORT TABLE */
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Machine</th>
                      <th className="px-4 py-3 text-right">Base Capacity</th>
                      {columns.map(col => (
                        <th key={col} className="px-4 py-3 text-right font-mono min-w-[140px]">
                          {formatHeader(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {machineReportRows.map(row => (
                      <tr key={row.machine.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <span className="font-bold text-gray-800">{row.machine.name}</span>
                          <span className="block text-[10px] text-gray-400 mt-0.5">{row.machine.description}</span>
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-bold text-gray-500">
                          {row.capacity.toLocaleString()}
                        </td>
                        {row.colsData.map((col, idx) => {
                          let colorClass = "text-emerald-700 bg-emerald-50/40 border border-emerald-100";
                          if (col.utilization > 100) {
                            colorClass = "text-red-700 bg-red-50/50 border border-red-200 font-bold";
                          } else if (col.utilization > 80) {
                            colorClass = "text-amber-700 bg-amber-50/40 border border-amber-100";
                          }

                          return (
                            <td key={idx} className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-mono font-extrabold text-gray-800">
                                  {col.sum.toLocaleString()}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${colorClass}`}>
                                  {col.utilization.toFixed(1)}% util
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* BY SKU REPORT TABLE */
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">Machine</th>
                      {columns.map(col => (
                        <th key={col} className="px-4 py-3 text-right font-mono min-w-[130px]">
                          {formatHeader(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {skuReportRows.map(row => (
                      <tr key={row.product.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-500 font-semibold">{row.product.sku}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{row.product.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">
                            {row.product.product_line}
                          </span>
                        </td>
                        {row.colsData.map((val, idx) => (
                          <td key={idx} className="px-4 py-3 text-right font-mono font-bold text-gray-700">
                            {val > 0 ? val.toLocaleString() : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {skuReportRows.length === 0 && (
                      <tr>
                        <td colSpan={3 + columns.length} className="px-4 py-8 text-center text-gray-400">
                          No matching SKUs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </ScrollableTable>
          </div>
        </div>
      )}
    </div>
  );
}
