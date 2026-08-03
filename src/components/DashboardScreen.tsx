/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { getVMaterialCoverage, getVProductCoverage, getVFGPSIAnalysis } from '../supabaseClient';
import { VMaterialCoverage, VProductCoverage, VFGPSIAnalysis } from '../types';
import { BarChart2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTableFilters } from '../hooks/useTableFilters';
import SearchBar from './SearchBar';
import ContentHeader from './ContentHeader';

interface DashboardScreenProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  refreshKey?: number;
}

export default function DashboardScreen({
  searchQuery = '',
  setSearchQuery = () => {},
  refreshKey = 0,
}: DashboardScreenProps) {
  const [materialCoverages, setMaterialCoverages] = useState<VMaterialCoverage[]>([]);
  const [productCoverages, setProductCoverages] = useState<VProductCoverage[]>([]);
  const [fgPsi, setFgPsi] = useState<VFGPSIAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [mCov, pCov, psi] = await Promise.all([
          getVMaterialCoverage(),
          getVProductCoverage(),
          getVFGPSIAnalysis()
        ]);
        setMaterialCoverages(mCov);
        setProductCoverages(pCov);
        setFgPsi(psi);
      } catch (e) {
        console.error("Dashboard failed to load database view representations", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [refreshKey]);

  // Filter material coverages with custom hook
  const { filtered: filteredMaterialCoverages, hasActiveSearch } = useTableFilters<VMaterialCoverage>(
    materialCoverages,
    ['material_name', 'sku'],
    {},
    searchQuery,
    setSearchQuery
  );

  const oosRiskCount = useMemo(() => materialCoverages.filter(m => m.coverage_months < 1.0).length, [materialCoverages]);
  const overstockCount = useMemo(() => materialCoverages.filter(m => m.coverage_months > 3.0).length, [materialCoverages]);
  const fgBelowSafetyCount = useMemo(() => productCoverages.filter(p => p.coverage_months < 1.0).length, [productCoverages]);

  const totalSalesForecast = useMemo(() => fgPsi.reduce((sum, item) => sum + item.sales_forecast, 0), [fgPsi]);
  const totalSalesActual = useMemo(() => fgPsi.reduce((sum, item) => sum + item.actual_sales, 0), [fgPsi]);
  // null when nothing is planned for the period. Reporting 0% next to an "On
  // Target" badge told the opposite of the truth: it read as a total miss that
  // was somehow fine, when in fact there was simply nothing to measure.
  const salesAchievement = useMemo(
    () => (totalSalesForecast > 0 ? (totalSalesActual / totalSalesForecast) * 100 : null),
    [totalSalesForecast, totalSalesActual]
  );

  // Sorting for lowest 20 materials matching search
  const lowestMaterials = useMemo(() => {
    return [...filteredMaterialCoverages]
      .sort((a, b) => a.coverage_months - b.coverage_months)
      .slice(0, 20);
  }, [filteredMaterialCoverages]);

  // Maximum coverage for chart scaling
  const maxCoverageVal = useMemo(() => {
    return Math.max(...lowestMaterials.map(m => m.coverage_months), 3.5);
  }, [lowestMaterials]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" id="dashboard_screen_loading">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 rounded"></div>
            <div className="h-3 w-80 bg-slate-200 rounded"></div>
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded p-3 h-24 flex flex-col justify-between">
              <div className="h-3 w-20 bg-slate-200 rounded"></div>
              <div className="h-6 w-12 bg-slate-200 rounded"></div>
              <div className="h-1 w-full bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 h-[400px] flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div className="space-y-2">
              <div className="h-4 w-60 bg-slate-200 rounded"></div>
              <div className="h-3 w-96 bg-slate-200 rounded"></div>
            </div>
            <div className="h-7 w-48 bg-slate-200 rounded"></div>
          </div>
          <div className="flex-1 bg-slate-50/50 rounded-lg mt-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="dashboard_screen">
      <ContentHeader
        title="Supply Chain Dashboard"
        subtitle="Live inventory health, OOS exposure, and sales achievement indicators."
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* OOS Risk Card */}
        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between h-24 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">OOS Risk (RM/PK)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-red-600">{oosRiskCount}</span>
            <span className={`text-[10px] px-1 font-bold rounded border ${
              oosRiskCount > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              {oosRiskCount > 0 ? 'Critical' : 'Healthy'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full">
            <div 
              className="bg-red-500 h-full rounded-full" 
              style={{ width: `${Math.min(100, materialCoverages.length > 0 ? (oosRiskCount / materialCoverages.length) * 100 : 0)}%` }}
            ></div>
          </div>
        </div>

        {/* Overstock Card */}
        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between h-24 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Overstock Items</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600">{overstockCount}</span>
            <span className="text-[10px] px-1 bg-blue-50 text-blue-600 font-bold rounded border border-blue-100">
              &gt;3 Mo.
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full">
            <div 
              className="bg-blue-500 h-full rounded-full" 
              style={{ width: `${Math.min(100, materialCoverages.length > 0 ? (overstockCount / materialCoverages.length) * 100 : 0)}%` }}
            ></div>
          </div>
        </div>

        {/* Finished Goods Card */}
        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between h-24 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter font-sans">FG Under 1 Mo. Cover</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">{fgBelowSafetyCount.toString().padStart(2, '0')}</span>
            <span className="text-[10px] px-1 bg-amber-50 text-amber-600 font-bold rounded border border-amber-100">
              Watchlist
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full">
            <div 
              className="bg-amber-500 h-full rounded-full" 
              style={{ width: `${Math.min(100, productCoverages.length > 0 ? (fgBelowSafetyCount / productCoverages.length) * 100 : 0)}%` }}
            ></div>
          </div>
        </div>

        {/* Sales Achievement Card */}
        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between h-24 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Sales Achievement</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${salesAchievement === null ? 'text-slate-400' : 'text-emerald-600'}`}>
              {salesAchievement === null ? 'No plan' : `${salesAchievement.toFixed(1)}%`}
            </span>
            <span className={`text-[10px] px-1 font-bold rounded border ${
              salesAchievement === null
                ? 'bg-slate-50 text-slate-500 border-slate-200'
                : salesAchievement >= 85
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
            }`}>
              {salesAchievement === null ? 'Nothing planned' : salesAchievement >= 85 ? 'On Target' : 'Behind'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full">
            <div 
              className="bg-emerald-500 h-full rounded-full" 
              style={{ width: `${Math.min(100, salesAchievement ?? 0)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Bar Chart section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-slate-500" />
            <div>
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Top 20 Materials with Lowest Coverage</h3>
              <p className="text-[11px] text-slate-500">Months of inventory coverage including scheduled receipts. Threshold: &lt; 1.0 (Red) is OOS Risk, &gt; 3.0 (Blue) is overstock.</p>
            </div>
          </div>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search materials..."
            className="w-48"
            hasActiveSearch={hasActiveSearch}
          />
        </div>

        {/* Polished SVG Bar Chart with updated height */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px] flex flex-col">
            <div className="flex items-stretch h-80 justify-around border-b border-slate-200 pb-2 pt-4 px-4 bg-slate-50/50 rounded-lg">
              {lowestMaterials.map((mat, i) => {
                // Cap at 90% so the numeric value label above the bar always has room.
                const pct = Math.min((mat.coverage_months / maxCoverageVal) * 90, 90);
                let barColor = 'bg-emerald-500';
                if (mat.coverage_months < 1.0) {
                  barColor = 'bg-red-500';
                } else if (mat.coverage_months <= 2.0) {
                  barColor = 'bg-amber-500';
                } else if (mat.coverage_months > 3.0) {
                  barColor = 'bg-blue-500';
                }

                return (
                  <div key={mat.material_id} className="group relative flex h-full w-full flex-col items-center justify-end mx-1">
                    {/* Hover tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-slate-900 text-white text-[10px] rounded-sm py-1 px-2 pointer-events-none whitespace-nowrap shadow-md">
                      <p className="font-semibold">{mat.material_name}</p>
                      <p>Coverage: {mat.coverage_months} months</p>
                      <p>Stock: {mat.opening_stock.toLocaleString()}</p>
                    </div>

                    {/* Numeric Value above bar */}
                    <span className="text-[10px] font-semibold text-slate-600 mb-1 font-mono">
                      {mat.coverage_months}m
                    </span>

                    {/* Actual Bar */}
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${pct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.02 }}
                      className={`w-5 rounded-t-xs hover:opacity-85 cursor-pointer transition-opacity ${barColor}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Labels below chart - rotated so full SKUs stay readable at 20 bars */}
            <div className="flex justify-around items-start px-4 h-20 mt-1">
              {lowestMaterials.map(mat => (
                <div key={mat.material_id} className="w-5 mx-1 flex justify-center">
                  <span
                    className="text-[9px] font-mono text-slate-500 font-medium whitespace-nowrap rotate-45 origin-top-left"
                    title={mat.material_name}
                  >
                    {mat.sku}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
