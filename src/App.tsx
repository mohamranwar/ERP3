/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, lazy, Suspense, useRef, useMemo } from 'react';
import { 
  isSupabaseConnected, getStoredCredentials, 
  saveStoredCredentials, clearStoredCredentials,
  getPlanningPeriod, setPlanningPeriod, getPlannedPeriods, formatPlanningPeriod
} from './supabaseClient';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastConfirmContext';
import LoginScreen from './components/LoginScreen';

// Core Screens split lazily
const DashboardScreen = lazy(() => import('./components/DashboardScreen'));
const BOMEditorScreen = lazy(() => import('./components/BOMEditorScreen'));
const SalesPlanScreen = lazy(() => import('./components/SalesPlanScreen'));
const ProductionPlanScreen = lazy(() => import('./components/ProductionPlanScreen'));
const MRPScreen = lazy(() => import('./components/MRPScreen'));
const MaterialDrillDown = lazy(() => import('./components/MaterialDrillDown'));
const CoverageScreen = lazy(() => import('./components/CoverageScreen'));
const FinishedGoodsAnalysis = lazy(() => import('./components/FinishedGoodsAnalysis'));
const LogisticsScreen = lazy(() => import('./components/LogisticsScreen'));
const PlanVsActualScreen = lazy(() => import('./components/PlanVsActualScreen'));
const MasterDataScreen = lazy(() => import('./components/MasterDataScreen'));
const GlobalCsvImporter = lazy(() => import('./components/GlobalCsvImporter'));

// Icons
import {
  LayoutDashboard, Layers, Calendar, Cpu, Play,
  Info, ShieldCheck, Database, Settings, LogOut,
  LineChart, FolderGit2, Truck, BarChart4, ClipboardList, Upload,
  ChevronLeft, ChevronRight, UserCircle2, CalendarRange, Menu, X
} from 'lucide-react';

type ScreenID = 
  | 'dashboard' 
  | 'bom' 
  | 'sales_plan' 
  | 'production_plan' 
  | 'mrp' 
  | 'drill_down' 
  | 'coverage' 
  | 'psi' 
  | 'logistics' 
  | 'plan_vs_actual' 
  | 'master_data'
  | 'csv_importer';


export default function App() {
  const { currentUser, loading: authLoading, logout, hasRole } = useAuth();
  const { showToast } = useToast();

  const [activeScreen, setActiveScreen] = useState<ScreenID>('dashboard');
  const [showConfig, setShowConfig] = useState(false);
  const [lang, setLang] = useState<'EN' | 'AR'>('EN');
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Below lg the sidebar is an overlay rather than a column: at 390px a 240px
  // rail left 150px for the actual workspace. It stays closed until asked for
  // and closes again on navigation, so a phone shows one thing at a time.
  const [navOpen, setNavOpen] = useState(false);

  // The month every analysis screen reports on. Screens re-read it from the
  // client on each load, so changing it re-runs them through refreshKey.
  const [planningPeriod, setPeriod] = useState(getPlanningPeriod());
  const periodOptions = useMemo(
    () => [...new Set([...getPlannedPeriods(), planningPeriod])].sort(),
    [planningPeriod, refreshKey]
  );

  const handlePeriodChange = (period: string) => {
    setPlanningPeriod(period);
    setPeriod(period);
    setRefreshKey(prev => prev + 1);
  };

  // Persistence of search state keyed by ScreenID
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  const activeSearchQuery = searchQueries[activeScreen] || '';
  const setActiveSearchQuery = (val: string) => {
    setSearchQueries(prev => ({ ...prev, [activeScreen]: val }));
  };

  // Supabase states
  const [dbConnected, setDbConnected] = useState(isSupabaseConnected());
  const [supUrl, setSupUrl] = useState(getStoredCredentials().url);
  const [supKey, setSupKey] = useState(getStoredCredentials().key);

  const t = (key: string): string => {
    const dict: Record<string, Record<'EN' | 'AR', string>> = {
      'Sanita Supply Planner': { EN: 'Sanita Supply Planner', AR: 'مخطط سلسلة الإمداد سانيتا' },
      'Planning Desk': { EN: 'Planning Desk', AR: 'مكتب التخطيط' },
      'SC KPIs Dashboard': { EN: 'SC KPIs Dashboard', AR: 'لوحة مؤشرات الأداء' },
      'Interactive BOM': { EN: 'Interactive BOM', AR: 'هيكل المواد التفاعلي' },
      'Sales Demand Plan': { EN: 'Sales Demand Plan', AR: 'خطة الطلب والمبيعات' },
      'MPS Production': { EN: 'MPS Production', AR: 'جدول الإنتاج الرئيسي' },
      'MRP': { EN: 'MRP', AR: 'تخطيط الاحتياجات (MRP)' },
      'Supply & Logistics': { EN: 'Supply & Logistics', AR: 'الإمداد والخدمات اللوجستية' },
      'Material Check': { EN: 'Material Check', AR: 'تدقيق ومتابعة المواد' },
      'Stock Coverage': { EN: 'Stock Coverage', AR: 'تغطية المخزون' },
      'PSI Analysis': { EN: 'PSI Analysis', AR: 'تحليل الـ PSI المشترك' },
      'Logistics & Customs': { EN: 'Logistics & Customs', AR: 'الخدمات اللوجستية والجمارك' },
      'Controls': { EN: 'Controls', AR: 'الرقابة والتحكم' },
      'Plan vs Actuals': { EN: 'Plan vs Actuals', AR: 'الخطة مقابل الفعلي' },
      'Master Data': { EN: 'Master Data', AR: 'البيانات الأساسية' },
      'Import Hub': { EN: 'Import Hub', AR: 'مركز استيراد البيانات' },
      'Database Engine': { EN: 'Database Engine', AR: 'محرك قاعدة البيانات' },
      'Enterprise Supply Chain Platform': { EN: 'Enterprise Supply Chain Platform', AR: 'منصة إدارة سلسلة التوريد للمؤسسات' },
      'Active Production Db': { EN: 'Active Production Db', AR: 'قاعدة بيانات الإنتاج النشطة' },
      'Sandboxed Local Mode': { EN: 'Sandboxed Local Mode', AR: 'وضع العمل المحلي الآمن' }
    };
    return dict[key]?.[lang] || key;
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasRole('admin')) {
      showToast('Only Admin accounts can change the database connection.', 'error');
      return;
    }
    if (supUrl.trim() && supKey.trim()) {
      saveStoredCredentials(supUrl.trim(), supKey.trim());
      setDbConnected(true);
      setShowConfig(false);
      setRefreshKey(prev => prev + 1); // Cascaded re-initialization
    }
  };

  const handleDisconnect = () => {
    if (!hasRole('admin')) {
      showToast('Only Admin accounts can disconnect the database.', 'error');
      return;
    }
    clearStoredCredentials();
    setDbConnected(false);
    setSupUrl('');
    setSupKey('');
    setRefreshKey(prev => prev + 1); // Cascaded re-initialization
  };

  // Keyboard Shortcuts Setup
  useKeyboardShortcuts({
    onNavigate: (screen) => setActiveScreen(screen),
    onCloseModals: () => {
      setShowConfig(false);
    }
  });

  // Focus trap for config modal
  const configModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(configModalRef, showConfig, () => setShowConfig(false));

  // Auth gate - placed after every hook above so hook call order stays
  // identical across renders (rules-of-hooks), but before any of the main
  // app shell (sidebar/screens) renders for an unauthenticated user.
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!currentUser) {
    return <LoginScreen />;
  }

  const ScreenSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-slate-200 rounded-md w-1/4"></div>
      <div className="h-4 bg-slate-200 rounded-md w-1/2"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-32 bg-slate-200 rounded-xl"></div>
        <div className="h-32 bg-slate-200 rounded-xl"></div>
        <div className="h-32 bg-slate-200 rounded-xl"></div>
      </div>
      <div className="h-64 bg-slate-200 rounded-xl"></div>
    </div>
  );

  const renderActiveScreen = () => {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        {(() => {
          switch (activeScreen) {
            case 'dashboard':
              return <DashboardScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'bom':
              return <BOMEditorScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'sales_plan':
              return <SalesPlanScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'production_plan':
              return <ProductionPlanScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'mrp':
              return <MRPScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'drill_down':
              return <MaterialDrillDown searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'coverage':
              return <CoverageScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'psi':
              return <FinishedGoodsAnalysis searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'logistics':
              return <LogisticsScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'plan_vs_actual':
              return <PlanVsActualScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'master_data':
              return <MasterDataScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
            case 'csv_importer':
              return <GlobalCsvImporter onClose={() => setActiveScreen('dashboard')} refreshKey={refreshKey} />;
            default:
              return <DashboardScreen searchQuery={activeSearchQuery} setSearchQuery={setActiveSearchQuery} onNavigate={setActiveScreen} refreshKey={refreshKey} />;
          }
        })()}
      </Suspense>
    );
  };

  // Nav Item helper
  const NavItem = ({ id, label, icon: Icon }: { id: ScreenID; label: string; icon: any }) => {
    const isActive = activeScreen === id;
    return (
      <button
        id={`nav_btn_${id}`}
        onClick={() => { setActiveScreen(id); setNavOpen(false); }}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 lg:py-1.5 text-[13px] lg:text-[11px] font-semibold rounded-lg lg:rounded transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-xs font-bold'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
        }`}
      >
        <Icon className={`w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
        {/* The rail only collapses labels on desktop; in the drawer they always show. */}
        <span className={`truncate ${sidebarPinned ? 'inline' : 'hidden lg:hidden max-lg:inline'}`}>{t(label)}</span>
      </button>
    );
  };

  return (
    <div className={`flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden ${lang === 'AR' ? 'text-end' : 'text-start'}`} id="main_app_workspace" dir={lang === 'AR' ? 'rtl' : 'ltr'}>
      {/* Scrim behind the mobile drawer. Tapping it dismisses the nav. */}
      {navOpen && (
        <div
          id="nav_backdrop"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px] lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* 1. Sidebar Nav - a fixed overlay below lg, an in-flow column above it */}
      <aside
        id="app_sidebar"
        className={`bg-slate-900 flex flex-col justify-between transition-transform duration-300 ease-out
          max-lg:fixed max-lg:inset-y-0 max-lg:z-50 max-lg:w-[17rem] max-lg:shadow-2xl
          ${navOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full rtl:max-lg:translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex-shrink-0 lg:transition-all
          ${sidebarPinned ? 'lg:w-60' : 'lg:w-14'}`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          
          {/* Sidebar Brand header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-1.5">
            <div className={`${sidebarPinned ? 'block' : 'hidden max-lg:block'}`}>
              <h2 className="text-[13px] lg:text-[11px] font-extrabold text-white tracking-wider uppercase">{t('Sanita Supply Planner')}</h2>
            </div>

            <div className="flex items-center gap-1">
              {/* Live Connection Badge */}
              <button 
                onClick={() => setShowConfig(true)}
                className={`tap-compact p-1 rounded border transition-all shrink-0 ${
                  dbConnected 
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400 hover:bg-emerald-900/50' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={dbConnected ? "Connected to Supabase" : "Using offline local mock data"}
              >
                {dbConnected ? <Database className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
              </button>

              {/* Pin/Unpin Toggle Chevron Button */}
              <button
                onClick={() => setSidebarPinned(!sidebarPinned)}
                className="tap-compact p-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all shrink-0 cursor-pointer max-lg:hidden"
                title={sidebarPinned ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {sidebarPinned ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              <button
                id="btn_close_nav"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Items (Scrollable) */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            
            {/* Category: Planning Desk */}
            <div className="space-y-0.5">
              <span className={`px-3 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1 ${sidebarPinned ? 'block' : 'hidden max-lg:block'}`}>{t('Planning Desk')}</span>
              <NavItem id="dashboard" label="SC KPIs Dashboard" icon={LayoutDashboard} />
              <NavItem id="bom" label="Interactive BOM" icon={Layers} />
              <NavItem id="sales_plan" label="Sales Demand Plan" icon={Calendar} />
              <NavItem id="production_plan" label="MPS Production" icon={Cpu} />
              <NavItem id="mrp" label="MRP" icon={Play} />
            </div>

            {/* Category: Supply & Logistics */}
            <div className="space-y-0.5">
              <span className={`px-3 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1 ${sidebarPinned ? 'block' : 'hidden max-lg:block'}`}>{t('Supply & Logistics')}</span>
              <NavItem id="drill_down" label="Material Check" icon={Info} />
              <NavItem id="coverage" label="Stock Coverage" icon={ClipboardList} />
              <NavItem id="psi" label="PSI Analysis" icon={BarChart4} />
              <NavItem id="logistics" label="Logistics & Customs" icon={Truck} />
            </div>

            {/* Category: Controls */}
            <div className="space-y-0.5">
              <span className={`px-3 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1 ${sidebarPinned ? 'block' : 'hidden max-lg:block'}`}>{t('Controls')}</span>
              <NavItem id="plan_vs_actual" label="Plan vs Actuals" icon={LineChart} />
              <NavItem id="master_data" label="Master Data" icon={FolderGit2} />
              <NavItem id="csv_importer" label="Import Hub" icon={Upload} />
            </div>

          </nav>
        </div>

        {/* Signed-in user + logout */}
        <div className="px-3 py-2.5 bg-slate-900 border-t border-slate-700 flex items-center justify-between gap-1.5" id="sidebar_user_badge">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
            <div className={`min-w-0 ${sidebarPinned ? 'block' : 'hidden max-lg:block'}`}>
              <p className="text-[12px] lg:text-[10px] font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] lg:text-[9px] font-mono uppercase text-slate-400">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sidebar Footer Settings Trigger */}
        <div className="p-3 bg-slate-800 text-[10px] text-slate-400 border-t border-slate-700">
          <button
            onClick={() => setShowConfig(true)}
            className="w-full flex items-center justify-between text-[10px] text-slate-400 hover:text-white font-semibold p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className={`${sidebarPinned ? 'inline' : 'hidden max-lg:inline'}`}>{t('Database Engine')}</span>
            </span>
            <span className={`text-[9px] font-mono px-1 py-0.5 bg-slate-900 text-slate-300 rounded-sm shrink-0 ${sidebarPinned ? 'inline' : 'hidden max-lg:inline'}`}>
              {dbConnected ? 'SUPABASE' : 'DEMO_MODE'}
            </span>
          </button>
        </div>
      </aside>

      {/* 2. Main Workbench Content Window */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        
        {/* Universal Top Header */}
        <header className="min-h-14 lg:h-12 bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              id="btn_mobile_nav"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              className="lg:hidden -ms-1 p-2 rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="px-2 py-1 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold uppercase rounded border border-slate-200 truncate max-w-[45vw] sm:max-w-none">
              {/* .replaceAll (not .replace) is required here: activeScreen slugs like
                  'plan_vs_actual' have more than one underscore, and a non-global
                  replace only strips the first one, leaving "plan vs_actual" - which
                  then fails to match any of the exact-string replacements below and
                  renders as a mangled, untranslated label. */}
              {t(activeScreen.replaceAll('_', ' ').replace('bom', 'Interactive BOM').replace('sales plan', 'Sales Demand Plan').replace('production plan', 'MPS Production').replace('drill down', 'Material Check').replace('coverage', 'Stock Coverage').replace('psi', 'PSI Analysis').replace('logistics', 'Logistics & Customs').replace('plan vs actual', 'Plan vs Actuals').replace('master data', 'Master Data').replace('csv importer', 'Import Hub'))}
            </span>
            <div className="h-3 w-[1px] bg-slate-200 hidden xl:block"></div>
            <p className="text-xs text-slate-500 font-sans font-medium hidden xl:block truncate">{t('Enterprise Supply Chain Platform')}</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Language Switcher */}
            <div className="flex bg-slate-100 border border-slate-300 p-0.5 rounded-lg max-sm:hidden">
              <button 
                onClick={() => setLang('EN')} 
                className={`tap-compact px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${lang === 'EN' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setLang('AR')} 
                className={`tap-compact px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${lang === 'AR' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                عربي
              </button>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 max-sm:hidden"></div>

            {/* Active planning period - drives every analysis screen */}
            <div className="flex items-center gap-1.5 min-w-0" id="planning_period_picker">
              <CalendarRange className="w-4 h-4 text-slate-400 shrink-0 max-sm:hidden" />
              <select
                value={planningPeriod}
                onChange={e => handlePeriodChange(e.target.value)}
                title="Planning period reported on by Coverage, PSI, Plan vs Actuals and the dashboard"
                className="tap-compact px-2 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-blue-500 cursor-pointer max-w-[38vw] sm:max-w-none"
              >
                {periodOptions.map(p => (
                  <option key={p} value={p}>{formatPlanningPeriod(p)}</option>
                ))}
              </select>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 hidden lg:block"></div>

            {/* Status indicator */}
            <div
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 shrink-0"
              title={dbConnected ? t('Active Production Db') : t('Sandboxed Local Mode')}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${dbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></span>
              <span className="text-[11px] font-bold text-slate-600 hidden lg:inline">{dbConnected ? t('Active Production Db') : t('Sandboxed Local Mode')}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Screen Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {renderActiveScreen()}
        </div>
      </main>

      {/* 3. Supabase Credentials Dialog/Modal */}
      {/* 
        * CHOICE: To ensure that global toast notifications always render on top of all active modals (including the Supabase Config modal),
        * we keep the Supabase config modal's backdrop z-index at z-[4500]. Since the Toast container is statically defined at z-[9999]
        * in ToastConfirmContext.tsx, this ensures toast notifications are always layered on top without needing to modify the context file.
        */}
      {showConfig && (
        <div className="fixed inset-0 z-[4500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" ref={configModalRef}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" /> Database Integration Hub
              </h3>
              <button 
                onClick={() => setShowConfig(false)} 
                className="text-slate-400 hover:text-slate-600 text-xl font-semibold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs text-blue-800 space-y-1.5 leading-relaxed">
                <h4 className="font-bold flex items-center gap-1">Connect Your Supabase Instance</h4>
                <p>Run <code>schema.sql</code> in your Supabase project's SQL editor to setup all planning schemas, coverage views, and MRP explosion RPC functions first.</p>
              </div>

              {!hasRole('admin') && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-800 font-semibold">
                  Only Admin accounts can change or disconnect the database connection. You can view this dialog, but saving/disconnecting is disabled for your role.
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Supabase Project URL</label>
                <input
                  type="url"
                  value={supUrl}
                  onChange={e => setSupUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Supabase Anon Key</label>
                <input
                  type="password"
                  value={supKey}
                  onChange={e => setSupKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50/50"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                {dbConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect (Reset Demo)
                  </button>
                ) : (
                  <div className="text-[10px] text-slate-400 font-sans">Ready to bridge local planner to live DB.</div>
                )}

                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowConfig(false)} 
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer"
                  >
                    Connect Database
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
