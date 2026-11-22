import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  ChevronRight,
  CreditCard,
  Database,
  FileText,
  FolderTree,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Sliders,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import {
  ADMIN_NOTIFICATIONS,
  ADMIN_ORDERS,
  ADMIN_SIDEBAR_ITEMS,
  ASSETS,
  ORDER_STATUS_BREAKDOWN,
  RECENT_ACTIVITY,
  SALES_SERIES,
  type AdminSectionId,
} from '../../data/catalog';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { subscribeAdminOrdersSummary } from '../../firebase/commerce';
import { useRouter } from '../../router/RouterContext';
import { BrandLogo } from '../ui/BrandLogo';
import {
  Button,
  ProductBadge,
  ResilientImage,
  SearchBar,
  StatusAlert,
} from '../ui/Primitives';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminDatabaseMonitor } from './AdminDatabaseMonitor';
import { AdminProductsView } from './AdminProductsView';
import { AdminProductForm } from './AdminProductForm';
import { AdminCategoriesView } from './AdminCategoriesView';
import { AdminInventoryView } from './AdminInventoryView';
import { AdminPaymentsPrepCard } from './AdminPaymentsPrepCard';

interface AdminDashboardViewProps {
  onSwitchToStorefront: () => void;
}

const NAV_ICONS: Record<AdminSectionId, React.FC<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  products: Package,
  categories: FolderTree,
  orders: ShoppingCart,
  customers: Users,
  inventory: Warehouse,
  payments: CreditCard,
  analytics: BarChart3,
  offers: Tag,
  showroom: Box,
  reports: FileText,
  settings: Settings,
};

const AdminDashboardContent: React.FC<AdminDashboardViewProps> = ({
  onSwitchToStorefront,
}) => {
  const { navigate } = useRouter();
  const { user, role, isAdmin, logout } = useAuth();
  const { products, categories, monitor, getProductByIdOrSlug } = useCatalog();
  const [activeSection, setActiveSection] = useState<AdminSectionId>('dashboard');
  const [productSubView, setProductSubView] = useState<'all' | 'add' | 'edit'>('all');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [inventoryInitialTab, setInventoryInitialTab] = useState<'stock' | 'variants'>('stock');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | 'Quarter'>('30D');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<string>('All');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [liveOrdersKpi, setLiveOrdersKpi] = useState<{
    totalOrders: number;
    totalRevenue: number;
    pendingCount: number;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeAdminOrdersSummary(isAdmin, setLiveOrdersKpi);
  }, [isAdmin]);

  const liveLowStockAlerts = useMemo(
    () =>
      products
        .filter((p) => p.stockStatus === 'low_stock' || p.stockStatus === 'out_of_stock')
        .slice(0, 5),
    [products]
  );

  const openAddProduct = () => {
    setEditingProductId(null);
    setProductSubView('add');
    setActiveSection('products');
  };

  const openEditProduct = (productId: string) => {
    setEditingProductId(productId);
    setProductSubView('edit');
    setActiveSection('products');
  };

  const activeNavMeta =
    ADMIN_SIDEBAR_ITEMS.find((i) => i.id === activeSection) || ADMIN_SIDEBAR_ITEMS[0];

  const filteredOrders = useMemo(() => {
    return ADMIN_ORDERS.filter((o) => {
      const matchesStatus = orderFilter === 'All' || o.status === orderFilter;
      const matchesSearch =
        !orderSearch.trim() ||
        o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.customer.toLowerCase().includes(orderSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [orderFilter, orderSearch]);

  const chartData = SALES_SERIES[timeframe];
  const maxVal = Math.max(...chartData.map((d) => d.value));

  // Build crisp SVG area/line coordinates
  const svgWidth = 520;
  const svgHeight = 180;
  const padX = 24;
  const padY = 20;
  const points = chartData.map((d, idx) => {
    const x =
      padX + (idx / Math.max(1, chartData.length - 1)) * (svgWidth - padX * 2);
    const y = svgHeight - padY - (d.value / maxVal) * (svgHeight - padY * 2);
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
    svgHeight - padY
  ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(svgHeight - padY).toFixed(1)} Z`;

  // Donut chart stroke segments
  const totalOrdersCount = ORDER_STATUS_BREAKDOWN.reduce((sum, s) => sum + s.count, 0);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;

  const statusTone = (status: string) => {
    switch (status) {
      case 'Delivered':
        return 'success' as const;
      case 'Shipped':
        return 'info' as const;
      case 'Processing':
        return 'accent' as const;
      case 'Pending':
        return 'warning' as const;
      default:
        return 'error' as const;
    }
  };

  const renderSidebarNav = () => (
    <div className="flex h-full flex-col bg-[#1F1D2B] text-[#FFF8EF]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <BrandLogo variant="dark" compact onClick={onSwitchToStorefront} />
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close admin navigation"
          className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-white/15 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className="text-[11px] font-semibold text-[#FFA94D]">Admin Console</p>
      </div>

      <nav aria-label="Admin dashboard navigation" className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {ADMIN_SIDEBAR_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.id];
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                if (item.id === 'products') setProductSubView('all');
                if (item.id === 'inventory') setInventoryInitialTab('stock');
                setMobileSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#FF7A00] text-white font-semibold'
                  : 'text-[#FFF8EF]/78 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={onSwitchToStorefront}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/6 px-3.5 py-2.5 text-xs font-semibold text-[#FFF8EF] hover:border-[#FFA94D] hover:text-[#FFA94D] transition-colors cursor-pointer"
        >
          View Customer Storefront
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B] flex">
      {/* Desktop Fixed Sidebar (260px) */}
      <aside className="hidden lg:block w-[260px] shrink-0 border-r border-[#1F1D2B]/12">
        <div className="sticky top-0 h-screen">{renderSidebarNav()}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin Sidebar">
          <div
            className="fixed inset-0 bg-[#1F1D2B]/65 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 h-full w-[260px] shadow-2xl">{renderSidebarNav()}</aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Admin Header Bar */}
        <header className="sticky top-0 z-20 border-b border-[#1F1D2B]/10 bg-white/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open admin sidebar"
                className="flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-[#1F1D2B]/12 text-[#1F1D2B] cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs text-[#1F1D2B]/55 truncate">
                  Admin Dashboard / <span className="font-semibold text-[#1F1D2B]">{activeNavMeta.label}</span>
                </p>
                <h1 className="font-heading text-base sm:text-lg font-semibold text-[#1F1D2B] truncate">
                  Fashion World Operations
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {/* Real Firebase / Cloud Firestore Connection Telemetry Badge (Never Faked) */}
              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                title="Open Firebase Database, Storage & Migration Monitor"
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer ${
                  monitor.firestoreStatus === 'live'
                    ? 'bg-[#16A34A]'
                    : monitor.firestoreStatus === 'empty_cloud'
                      ? 'bg-[#2563EB]'
                      : monitor.firestoreStatus === 'connecting'
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#DC2626]'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
                <span>
                  {monitor.firestoreStatus === 'live'
                    ? 'FIRESTORE LIVE'
                    : monitor.firestoreStatus === 'empty_cloud'
                      ? 'CLOUD READY'
                      : monitor.firestoreStatus === 'connecting'
                        ? 'SYNCING...'
                        : 'OFFLINE / ERROR'}
                </span>
              </button>

              {/* Notifications Popover Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((o) => !o)}
                  aria-label="View admin notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF] text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-bold text-white tabular-nums">
                    {ADMIN_NOTIFICATIONS.length}
                  </span>
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#1F1D2B]/12 bg-white p-3 shadow-2xl z-40 fw-animate-fade">
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-[#1F1D2B]/10">
                      <span className="font-heading text-sm font-semibold">Notifications</span>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-xs font-semibold text-[#FF7A00] cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {ADMIN_NOTIFICATIONS.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-[#FFF8EF] p-2.5 text-xs border border-[#1F1D2B]/8"
                        >
                          <p className="font-medium text-[#1F1D2B]">{n.message}</p>
                          <p className="mt-1 text-[11px] text-[#1F1D2B]/55 tabular-nums">{n.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Authenticated Admin Profile & Sign Out */}
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF] px-3 py-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1F1D2B] text-xs font-bold text-[#FFA94D]">
                  {(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
                </span>
                <div className="max-w-[140px]">
                  <p className="text-[11px] font-bold text-[#1F1D2B] truncate leading-tight">
                    {user?.displayName || user?.email?.split('@')[0] || 'Admin'}
                  </p>
                  <p className="text-[10px] font-semibold uppercase text-[#FF7A00] leading-tight">
                    {role.replace('_', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  title="Sign out of Admin Console"
                  aria-label="Sign out"
                  className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-[#1F1D2B]/65 hover:bg-[#DC2626]/10 hover:text-[#DC2626] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Dashboard Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1440px] w-full mx-auto">
          {/* Phase 4 Dedicated Admin Pages: Products, Add/Edit Product, Categories, Variants & Stock Overview */}
          {activeSection === 'products' ? (
            productSubView === 'all' ? (
              <AdminProductsView
                onAddProduct={openAddProduct}
                onEditProduct={openEditProduct}
              />
            ) : (
              <AdminProductForm
                existingProduct={
                  productSubView === 'edit' && editingProductId
                    ? getProductByIdOrSlug(editingProductId) || null
                    : null
                }
                onCancel={() => setProductSubView('all')}
                onSaved={() => setProductSubView('all')}
              />
            )
          ) : activeSection === 'categories' ? (
            <AdminCategoriesView />
          ) : activeSection === 'inventory' ? (
            <AdminInventoryView
              key={inventoryInitialTab}
              initialTab={inventoryInitialTab}
              onEditProduct={openEditProduct}
            />
          ) : activeSection === 'payments' ? (
            <AdminPaymentsPrepCard />
          ) : activeSection === 'settings' ? (
            <AdminDatabaseMonitor />
          ) : (
            <>
              {activeSection !== 'dashboard' && (
                <StatusAlert
                  variant="info"
                  title={`${activeNavMeta.label} Module — Scheduled for Later Phase`}
                  description="Phase 5 activates Firebase Cloud Firestore, Authentication, Cloud Storage, Real-Time Catalog & Categories, Inventory, and Database Monitoring (under Settings). Orders, Payments, and Sales Analytics arrive in Phases 6–9."
                />
              )}

              {/* 4 KPI Stat Cards: Revenue, Orders, Customers, Products */}
              <section aria-label="Key business metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Live Firestore Revenue',
                    value: liveOrdersKpi
                      ? `₹${Math.round(liveOrdersKpi.totalRevenue).toLocaleString('en-IN')}`
                      : '₹0',
                    delta: liveOrdersKpi
                      ? `From ${liveOrdersKpi.totalOrders} Firestore order(s)`
                      : 'Awaiting first live order',
                    icon: IndianRupee,
                    iconBg: 'bg-[#FF7A00]/12 text-[#FF7A00]',
                  },
                  {
                    label: 'Live Firestore Orders',
                    value: liveOrdersKpi ? String(liveOrdersKpi.totalOrders) : '0',
                    delta: liveOrdersKpi
                      ? `${liveOrdersKpi.pendingCount} pending fulfillment (Phase 8)`
                      : 'Connected to orders collection',
                    icon: ShoppingCart,
                    iconBg: 'bg-[#2563EB]/12 text-[#2563EB]',
                  },
                  {
                    label: 'Catalog Categories',
                    value: String(categories.length),
                    delta: `${categories.reduce((a, c) => a + c.subcategories.length, 0)} subcategories`,
                    icon: FolderTree,
                    iconBg: 'bg-[#16A34A]/12 text-[#16A34A]',
                  },
                  {
                    label: 'Active Catalog Products',
                    value: String(products.length),
                    delta: `${products.reduce((a, p) => a + p.variants.length, 0)} variant SKUs`,
                    icon: Package,
                    iconBg: 'bg-[#1F1D2B]/10 text-[#1F1D2B]',
                  },
                ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-medium text-[#1F1D2B]/60">{kpi.label}</p>
                    <p className="mt-2 font-heading text-2xl font-bold text-[#1F1D2B] tabular-nums">
                      {kpi.value}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] tabular-nums">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {kpi.delta}
                    </p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              );
            })}
          </section>

          {/* Sales Analytics Chart Placeholder + Orders Status Donut Chart Placeholder */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Sales Chart */}
            <div className="xl:col-span-7 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-heading text-base font-semibold text-[#1F1D2B]">
                    Sales Analytics
                  </h2>
                  <p className="text-xs text-[#1F1D2B]/55">
                    Revenue trajectory placeholder (INR · Phase 1 visual chart)
                  </p>
                </div>
                <div className="inline-flex rounded-xl bg-[#FFF8EF] p-1 border border-[#1F1D2B]/10">
                  {(['7D', '30D', 'Quarter'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        timeframe === tf
                          ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                          : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight + 24}`}
                  className="w-full h-56"
                  role="img"
                  aria-label="Sales analytics trend chart"
                >
                  <defs>
                    <linearGradient id="fwSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF7A00" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = svgHeight - padY - ratio * (svgHeight - padY * 2);
                    return (
                      <line
                        key={ratio}
                        x1={padX}
                        x2={svgWidth - padX}
                        y1={y}
                        y2={y}
                        stroke="#1F1D2B"
                        strokeOpacity="0.08"
                        strokeDasharray="4 4"
                      />
                    );
                  })}
                  <path d={areaPath} fill="url(#fwSalesGrad)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#FF7A00"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((pt) => (
                    <g key={pt.label}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="4.5"
                        fill="#FFFFFF"
                        stroke="#FF7A00"
                        strokeWidth="2.5"
                      />
                      <text
                        x={pt.x}
                        y={svgHeight + 10}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#1F1D2B"
                        fillOpacity="0.6"
                      >
                        {pt.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Orders Status Donut Chart */}
            <div className="xl:col-span-5 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 flex flex-col justify-between">
              <div className="mb-4">
                <h2 className="font-heading text-base font-semibold text-[#1F1D2B]">
                  Orders Distribution
                </h2>
                <p className="text-xs text-[#1F1D2B]/55">Fulfillment lifecycle breakdown</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative h-40 w-40 shrink-0">
                  <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label="Orders status donut chart">
                    {ORDER_STATUS_BREAKDOWN.map((seg) => {
                      const dash = (seg.count / totalOrdersCount) * circumference;
                      const el = (
                        <circle
                          key={seg.label}
                          cx="70"
                          cy="70"
                          r={radius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="16"
                          strokeDasharray={`${dash} ${circumference - dash}`}
                          strokeDashoffset={-runningOffset}
                        />
                      );
                      runningOffset += dash;
                      return el;
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-heading text-2xl font-bold text-[#1F1D2B] tabular-nums">
                      {totalOrdersCount}
                    </span>
                    <span className="text-[11px] font-medium text-[#1F1D2B]/55">Orders</span>
                  </div>
                </div>

                <ul className="flex-1 w-full space-y-2.5 text-xs">
                  {ORDER_STATUS_BREAKDOWN.map((seg) => (
                    <li key={seg.label} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-medium text-[#1F1D2B]">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        {seg.label}
                      </span>
                      <span className="font-semibold text-[#1F1D2B] tabular-nums">{seg.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Recent Orders Table + Low Stock Alerts & 3D Showroom Control */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Recent Orders Table */}
            <div className="xl:col-span-8 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-base font-semibold text-[#1F1D2B]">
                    Recent Orders
                  </h2>
                  <p className="text-xs text-[#1F1D2B]/55">
                    Filterable Phase 1 table layout with tabular currency alignment
                  </p>
                </div>
                <div className="w-full sm:w-56">
                  <SearchBar
                    value={orderSearch}
                    onChange={setOrderSearch}
                    placeholder="Search order or customer..."
                  />
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto fw-no-scrollbar">
                {['All', 'Delivered', 'Shipped', 'Processing', 'Pending', 'Cancelled'].map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setOrderFilter(status)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        orderFilter === status
                          ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                          : 'bg-[#FFF8EF] text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                      }`}
                    >
                      {status}
                    </button>
                  )
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#1F1D2B]/10 text-xs text-[#1F1D2B]/55">
                      <th className="py-3 pr-4 font-semibold">Order ID</th>
                      <th className="py-3 pr-4 font-semibold">Customer</th>
                      <th className="py-3 pr-4 font-semibold">Date</th>
                      <th className="py-3 pr-4 font-semibold text-right">Amount</th>
                      <th className="py-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1D2B]/8">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-[#FFF8EF]/70 transition-colors">
                        <td className="py-3.5 pr-4 font-semibold text-[#1F1D2B] tabular-nums whitespace-nowrap">
                          {order.id}
                        </td>
                        <td className="py-3.5 pr-4 text-[#1F1D2B]/85 whitespace-nowrap">
                          {order.customer}
                          <span className="ml-2 text-xs text-[#1F1D2B]/45">
                            · {order.items} item{order.items > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 text-xs text-[#1F1D2B]/60 tabular-nums whitespace-nowrap">
                          {order.date}
                        </td>
                        <td className="py-3.5 pr-4 text-right font-semibold text-[#1F1D2B] tabular-nums whitespace-nowrap">
                          ₹{order.total.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <ProductBadge tone={statusTone(order.status)}>{order.status}</ProductBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Low Stock Alerts + Recent Activity */}
            <div className="xl:col-span-4 space-y-6">
              {/* Low Stock Alerts */}
              <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-base font-semibold text-[#1F1D2B]">
                    Low Stock Alerts
                  </h2>
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                </div>
                <div className="space-y-2.5">
                  {liveLowStockAlerts.length === 0 ? (
                    <p className="text-xs text-[#16A34A] font-medium">
                      All catalog products are currently above low-stock thresholds.
                    </p>
                  ) : (
                    liveLowStockAlerts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openEditProduct(item.id)}
                        className="w-full text-left flex items-center justify-between gap-3 rounded-xl bg-[#FFF8EF] p-3 border border-[#1F1D2B]/8 hover:border-[#FF7A00] cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1F1D2B] truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-[#1F1D2B]/55 tabular-nums">{item.sku}</p>
                        </div>
                        <ProductBadge
                          tone={item.stockStatus === 'out_of_stock' ? 'error' : 'warning'}
                        >
                          {item.totalStock === 0 ? 'Out of Stock' : `${item.totalStock} left`}
                        </ProductBadge>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3.5">
                <h2 className="font-heading text-base font-semibold text-[#1F1D2B]">
                  Recent Activity
                </h2>
                <ul className="space-y-3">
                  {RECENT_ACTIVITY.map((act) => (
                    <li
                      key={act.id}
                      className="flex items-start justify-between gap-3 text-xs pb-2.5 border-b border-[#1F1D2B]/8 last:border-0 last:pb-0"
                    >
                      <span className="font-medium text-[#1F1D2B]/85 leading-snug">
                        {act.title}
                      </span>
                      <span className="text-[#1F1D2B]/50 whitespace-nowrap tabular-nums">
                        {act.time}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 3D Showroom Control Card + Quick Catalog Overview */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl bg-[#1F1D2B] text-[#FFF8EF] p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-stretch">
              <div className="sm:w-1/2 overflow-hidden rounded-xl border border-white/10">
                <ResilientImage
                  src={ASSETS.showroomInterior}
                  alt="3D Showroom Admin Control Preview"
                  className="h-full min-h-[180px] w-full object-cover"
                />
              </div>
              <div className="sm:w-1/2 flex flex-col justify-between space-y-4">
                <div>
                  <p className="text-xs font-semibold text-[#FFA94D]">3D Showroom Control</p>
                  <h2 className="mt-1 font-heading text-lg font-semibold">
                    Virtual Mall Merchandising
                  </h2>
                  <p className="mt-1 text-xs text-[#FFF8EF]/70 leading-relaxed">
                    Configure display racks, mannequin outfits, and warm ring lighting presets for
                    Phase 3 spatial deployment.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  leftIcon={<Sparkles className="h-4 w-4" />}
                  onClick={() => navigate('/showroom')}
                >
                  Open Live 3D Showroom
                </Button>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2">
              <h2 className="font-heading text-base font-semibold text-[#1F1D2B] mb-3">
                Quick Catalog &amp; Showroom Actions
              </h2>
              {[
                { label: 'Add New Product', icon: Plus, action: openAddProduct },
                {
                  label: `Manage All Products (${products.length})`,
                  icon: Package,
                  action: () => {
                    setProductSubView('all');
                    setActiveSection('products');
                  },
                },
                {
                  label: `Manage Categories (${categories.length})`,
                  icon: FolderTree,
                  action: () => setActiveSection('categories'),
                },
                {
                  label: 'Product Variants & Stock Matrix',
                  icon: Sliders,
                  action: () => {
                    setInventoryInitialTab('variants');
                    setActiveSection('inventory');
                  },
                },
                {
                  label: 'Firebase Database, Storage & Migration',
                  icon: Database,
                  action: () => setActiveSection('settings'),
                },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.action}
                    className="flex w-full items-center justify-between rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/70 px-4 py-3 text-sm font-medium text-[#1F1D2B] hover:border-[#FF7A00] hover:bg-[#FFE4C7]/40 transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[#FF7A00]" />
                      {action.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#1F1D2B]/45" />
                  </button>
                );
              })}
            </div>
          </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onSwitchToStorefront,
}) => (
  <AdminAuthGate onSwitchToStorefront={onSwitchToStorefront}>
    <AdminDashboardContent onSwitchToStorefront={onSwitchToStorefront} />
  </AdminAuthGate>
);
