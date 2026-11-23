import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  Package,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Warehouse,
  XCircle,
} from 'lucide-react';
import { ASSETS } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';
import type { ActivityLogDoc, AdminDashboardSection, CustomerRecordDoc } from '../../types/admin';
import type { ResolvedCatalogProduct } from '../../types/catalog';
import type { OrderDoc } from '../../types/commerce';
import type { PaymentRecordDoc, RefundRecordDoc } from '../../types/payment';
import {
  computeAdminOverviewMetrics,
  computeSalesAnalytics,
  REPORTING_TIMEZONE,
} from '../../utils/adminAnalytics';
import { formatINR } from '../../utils/catalogHelpers';
import { Button, ProductBadge, ResilientImage } from '../ui/Primitives';

interface AdminOverviewSectionProps {
  orders: OrderDoc[];
  payments: PaymentRecordDoc[];
  refunds: RefundRecordDoc[];
  customers: CustomerRecordDoc[];
  products: ResolvedCatalogProduct[];
  activityLogs: ActivityLogDoc[];
  onNavigateSection: (section: AdminDashboardSection) => void;
  onEditProduct: (productId: string) => void;
}

export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({
  orders,
  payments,
  refunds,
  customers,
  products,
  activityLogs,
  onNavigateSection,
  onEditProduct,
}) => {
  const { navigate } = useRouter();
  const [trendRange, setTrendRange] = useState<'last_7_days' | 'last_30_days' | 'this_month'>(
    'last_30_days'
  );
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const metrics = useMemo(
    () =>
      computeAdminOverviewMetrics({
        orders,
        payments,
        refunds,
        customers,
        products,
      }),
    [customers, orders, payments, products, refunds]
  );

  const trend = useMemo(
    () =>
      computeSalesAnalytics({
        orders,
        payments,
        refunds,
        products,
        categories: [],
        preset: trendRange,
        granularity: 'daily',
      }),
    [orders, payments, products, refunds, trendRange]
  );

  const liveLowStockProducts = useMemo(
    () =>
      products
        .filter((p) => p.stockStatus === 'low_stock' || p.stockStatus === 'out_of_stock')
        .sort((a, b) => a.totalStock - b.totalStock)
        .slice(0, 6),
    [products]
  );

  const recentOrders = useMemo(() => orders.slice(0, 7), [orders]);
  const recentLogs = useMemo(() => activityLogs.slice(0, 6), [activityLogs]);

  // 15 Live Dashboard KPI Cards (Section 2 of Phase 8 specification)
  const kpiCards = [
    {
      label: 'Total Net Revenue',
      value: formatINR(metrics.netRevenue),
      sub: `Gross ${formatINR(metrics.grossSales)} − Refunds ${formatINR(metrics.totalRefundsAmount)}`,
      icon: IndianRupee,
      toneClass: 'bg-[#FF7A00]/12 text-[#FF7A00]',
      section: 'analytics' as AdminDashboardSection,
    },
    {
      label: "Today's Net Revenue (IST)",
      value: formatINR(metrics.todayNetRevenue),
      sub: 'Verified online + delivered COD today',
      icon: TrendingUp,
      toneClass: 'bg-[#16A34A]/12 text-[#16A34A]',
      section: 'analytics' as AdminDashboardSection,
    },
    {
      label: 'Monthly Net Revenue (IST)',
      value: formatINR(metrics.monthlyNetRevenue),
      sub: 'Current calendar month in Asia/Kolkata',
      icon: IndianRupee,
      toneClass: 'bg-[#2563EB]/12 text-[#2563EB]',
      section: 'analytics' as AdminDashboardSection,
    },
    {
      label: 'Total Orders',
      value: metrics.totalOrders.toLocaleString('en-IN'),
      sub: `${metrics.codOrdersCount} COD · ${Math.max(0, metrics.totalOrders - metrics.codOrdersCount)} Online`,
      icon: ShoppingCart,
      toneClass: 'bg-[#1F1D2B]/10 text-[#1F1D2B]',
      section: 'orders' as AdminDashboardSection,
    },
    {
      label: 'Pending Orders',
      value: metrics.pendingOrders.toLocaleString('en-IN'),
      sub: 'Awaiting fulfillment review',
      icon: Clock,
      toneClass: 'bg-[#F59E0B]/15 text-[#F59E0B]',
      section: 'orders' as AdminDashboardSection,
    },
    {
      label: 'Delivered Orders',
      value: metrics.deliveredOrders.toLocaleString('en-IN'),
      sub: `COD Collected: ${formatINR(metrics.collectedCodSales)}`,
      icon: PackageCheck,
      toneClass: 'bg-[#16A34A]/12 text-[#16A34A]',
      section: 'orders' as AdminDashboardSection,
    },
    {
      label: 'Cancelled Orders',
      value: metrics.cancelledOrders.toLocaleString('en-IN'),
      sub:
        metrics.totalOrders > 0
          ? `${Math.round((metrics.cancelledOrders / metrics.totalOrders) * 1000) / 10}% cancellation rate`
          : '0% cancellation rate',
      icon: Ban,
      toneClass: 'bg-[#DC2626]/12 text-[#DC2626]',
      section: 'orders' as AdminDashboardSection,
    },
    {
      label: 'Successful Payments',
      value: metrics.successfulPaymentsCount.toLocaleString('en-IN'),
      sub: `Verified Online: ${formatINR(metrics.collectedOnlineSales)}`,
      icon: CheckCircle2,
      toneClass: 'bg-[#16A34A]/12 text-[#16A34A]',
      section: 'payments' as AdminDashboardSection,
    },
    {
      label: 'Failed Payments',
      value: metrics.failedPaymentsCount.toLocaleString('en-IN'),
      sub: 'Excluded from collected revenue',
      icon: XCircle,
      toneClass: 'bg-[#DC2626]/12 text-[#DC2626]',
      section: 'payments' as AdminDashboardSection,
    },
    {
      label: 'Pending Payments',
      value: metrics.pendingPaymentsCount.toLocaleString('en-IN'),
      sub: `Pending COD: ${formatINR(metrics.pendingCodCollections)}`,
      icon: CreditCard,
      toneClass: 'bg-[#F59E0B]/15 text-[#F59E0B]',
      section: 'payments' as AdminDashboardSection,
    },
    {
      label: 'Total Customers',
      value: metrics.totalCustomers.toLocaleString('en-IN'),
      sub: 'Registered & ordering accounts',
      icon: Users,
      toneClass: 'bg-[#2563EB]/12 text-[#2563EB]',
      section: 'customers' as AdminDashboardSection,
    },
    {
      label: 'Total Products',
      value: metrics.totalProducts.toLocaleString('en-IN'),
      sub: `${products.reduce((s, p) => s + p.variants.length, 0)} active variant SKUs`,
      icon: Package,
      toneClass: 'bg-[#1F1D2B]/10 text-[#1F1D2B]',
      section: 'products' as AdminDashboardSection,
    },
    {
      label: 'Available Stock Units',
      value: metrics.availableStockUnits.toLocaleString('en-IN'),
      sub: 'Across all sizes & colours',
      icon: Warehouse,
      toneClass: 'bg-[#16A34A]/12 text-[#16A34A]',
      section: 'inventory' as AdminDashboardSection,
    },
    {
      label: 'Low Stock Products',
      value: metrics.lowStockProducts.toLocaleString('en-IN'),
      sub: 'At or below product threshold',
      icon: AlertTriangle,
      toneClass: 'bg-[#F59E0B]/15 text-[#F59E0B]',
      section: 'inventory' as AdminDashboardSection,
    },
    {
      label: 'Out of Stock Products',
      value: metrics.outOfStockProducts.toLocaleString('en-IN'),
      sub: 'Needs immediate replenishment',
      icon: RotateCcw,
      toneClass: 'bg-[#DC2626]/12 text-[#DC2626]',
      section: 'inventory' as AdminDashboardSection,
    },
  ];

  // SVG Chart Geometry from live series
  const series = trend.series;
  const svgWidth = 560;
  const svgHeight = 190;
  const padX = 28;
  const padY = 22;
  const maxRevenue = Math.max(1, ...series.map((p) => p.revenue));
  const points = series.map((pt, idx) => {
    const x =
      series.length <= 1
        ? svgWidth / 2
        : padX + (idx / (series.length - 1)) * (svgWidth - padX * 2);
    const y = svgHeight - padY - (pt.revenue / maxRevenue) * (svgHeight - padY * 2);
    return { x, y, ...pt };
  });
  const linePath =
    points.length > 0
      ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(svgHeight - padY).toFixed(1)} L ${points[0].x.toFixed(1)} ${(svgHeight - padY).toFixed(1)} Z`
      : '';

  const orderStatusTone = (status: OrderDoc['orderStatus']) => {
    if (status === 'Delivered') return 'success' as const;
    if (status === 'Shipped' || status === 'Out for Delivery') return 'info' as const;
    if (status === 'Confirmed' || status === 'Processing' || status === 'Packed') return 'accent' as const;
    if (status === 'Pending') return 'warning' as const;
    return 'error' as const;
  };

  return (
    <div className="space-y-6">
      {/* Financial Revenue Integrity Banner */}
      <section className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F1D2B]/10 pb-4">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">
              Financial Accounting Ledger · Reporting Timezone: {REPORTING_TIMEZONE} (IST)
            </p>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-[#1F1D2B]">
              Revenue Reconciliation &amp; Store Health Overview
            </h2>
          </div>
          <span className="text-xs text-[#1F1D2B]/60">
            Pending &amp; failed payments are strictly excluded from collected revenue
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs tabular-nums">
          <div>
            <p className="text-[#1F1D2B]/60">Gross Collected Sales</p>
            <p className="mt-1 font-heading text-lg font-bold text-[#1F1D2B]">
              {formatINR(metrics.grossSales)}
            </p>
          </div>
          <div>
            <p className="text-[#1F1D2B]/60">Online Captured</p>
            <p className="mt-1 font-heading text-lg font-bold text-[#16A34A]">
              {formatINR(metrics.collectedOnlineSales)}
            </p>
          </div>
          <div>
            <p className="text-[#1F1D2B]/60">COD Collected (Delivered)</p>
            <p className="mt-1 font-heading text-lg font-bold text-[#16A34A]">
              {formatINR(metrics.collectedCodSales)}
            </p>
          </div>
          <div>
            <p className="text-[#1F1D2B]/60">COD Pending Collection</p>
            <p className="mt-1 font-heading text-lg font-bold text-[#F59E0B]">
              {formatINR(metrics.pendingCodCollections)}
            </p>
          </div>
          <div>
            <p className="text-[#1F1D2B]/60">Total Refunds ({metrics.refundsCount})</p>
            <p className="mt-1 font-heading text-lg font-bold text-[#DC2626]">
              −{formatINR(metrics.totalRefundsAmount)}
            </p>
          </div>
          <div>
            <p className="text-[#1F1D2B]/60 font-semibold">Net Realized Revenue</p>
            <p className="mt-1 font-heading text-lg font-bold text-[#FF7A00]">
              {formatINR(metrics.netRevenue)}
            </p>
          </div>
        </div>
      </section>

      {/* All 15 Live Storefront KPI Cards */}
      <section aria-label="15 Super Admin Store KPIs" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigateSection(kpi.section)}
              className="text-left rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 hover:border-[#FF7A00]/60 transition-colors flex flex-col justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-[#1F1D2B]/65">{kpi.label}</span>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kpi.toneClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B] tabular-nums">
                  {kpi.value}
                </p>
                <p className="mt-1 text-[11px] text-[#1F1D2B]/60 tabular-nums truncate">
                  {kpi.sub}
                </p>
              </div>
            </button>
          );
        })}
      </section>

      {/* Live Revenue Trajectory Chart + Low Stock & Activity */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                Live Daily Sales Revenue Trend
              </h3>
              <p className="text-xs text-[#1F1D2B]/55 tabular-nums">
                {trend.window.label} · {trend.ordersInWindow} order(s) · Net Revenue{' '}
                {formatINR(trend.netRevenue)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl bg-[#FFF8EF] p-1 border border-[#1F1D2B]/10">
                {[
                  { id: 'last_7_days', label: '7D' },
                  { id: 'last_30_days', label: '30D' },
                  { id: 'this_month', label: 'Month' },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setTrendRange(tf.id as typeof trendRange)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      trendRange === tf.id
                        ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                        : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection('analytics')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
              >
                Full Analytics
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {series.length === 0 ? (
            <div className="h-52 flex items-center justify-center rounded-xl border border-dashed border-[#1F1D2B]/15 bg-[#FFF8EF]/50 text-xs text-[#1F1D2B]/60">
              No revenue data recorded in this date window yet.
            </div>
          ) : (
            <div className="relative">
              {hoveredIdx !== null && points[hoveredIdx] && (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-[#FFF8EF] px-3 py-2 text-xs border border-[#1F1D2B]/10 tabular-nums">
                  <span className="font-semibold text-[#1F1D2B]">{points[hoveredIdx].label}</span>
                  <span>
                    Collected: <strong className="text-[#FF7A00]">{formatINR(points[hoveredIdx].revenue)}</strong> ·{' '}
                    {points[hoveredIdx].orders} order(s)
                  </span>
                </div>
              )}
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight + 24}`}
                className="w-full h-56"
                role="img"
                aria-label="Live daily collected revenue trend"
              >
                <defs>
                  <linearGradient id="fwOverviewRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF7A00" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75, 1].map((r) => {
                  const y = svgHeight - padY - r * (svgHeight - padY * 2);
                  return (
                    <line
                      key={r}
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
                <path d={areaPath} fill="url(#fwOverviewRevGrad)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#FF7A00"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map((pt, idx) => {
                  const showLabel =
                    points.length <= 10 ||
                    idx === 0 ||
                    idx === points.length - 1 ||
                    idx % Math.ceil(points.length / 7) === 0;
                  return (
                    <g
                      key={pt.bucketKey}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredIdx === idx ? 5.5 : 3.5}
                        fill="#FFFFFF"
                        stroke="#FF7A00"
                        strokeWidth="2.2"
                      />
                      {showLabel && (
                        <text
                          x={pt.x}
                          y={svgHeight + 12}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#1F1D2B"
                          fillOpacity="0.6"
                        >
                          {pt.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Low Stock Alerts & Real Activity Log Feed */}
        <div className="xl:col-span-4 space-y-6">
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold text-[#1F1D2B]">
                Live Low-Stock Alerts
              </h3>
              <button
                type="button"
                onClick={() => onNavigateSection('inventory')}
                className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
              >
                Inventory
              </button>
            </div>
            {liveLowStockProducts.length === 0 ? (
              <p className="text-xs text-[#16A34A] font-medium">
                All catalog products are currently healthy above threshold.
              </p>
            ) : (
              <div className="divide-y divide-[#1F1D2B]/8">
                {liveLowStockProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onEditProduct(p.id)}
                    className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#FFF8EF]/60 px-1 rounded-lg cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1F1D2B] truncate">{p.name}</p>
                      <p className="text-[11px] font-mono text-[#1F1D2B]/55">{p.sku}</p>
                    </div>
                    <ProductBadge tone={p.stockStatus === 'out_of_stock' ? 'error' : 'warning'}>
                      {p.totalStock === 0 ? 'Out of Stock' : `${p.totalStock} left`}
                    </ProductBadge>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold text-[#1F1D2B]">
                Recent Admin Activity
              </h3>
              <button
                type="button"
                onClick={() => onNavigateSection('activity')}
                className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
              >
                All Logs
              </button>
            </div>
            {recentLogs.length === 0 ? (
              <p className="text-xs text-[#1F1D2B]/55">
                No audit log events recorded yet. Actions taken in this console append here
                automatically.
              </p>
            ) : (
              <ul className="divide-y divide-[#1F1D2B]/8 text-xs">
                {recentLogs.map((log) => (
                  <li key={log.logId} className="py-2.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1F1D2B]">{log.action}</span>
                      <span className="text-[10px] text-[#1F1D2B]/50 tabular-nums">
                        {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#1F1D2B]/70 line-clamp-2">{log.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Recent Live Firestore Orders + 3D Showroom Preview Link */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                Recent Firestore Orders
              </h3>
              <p className="text-xs text-[#1F1D2B]/55">
                Real-time orders synchronized from Cloud Firestore
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigateSection('orders')}>
              Manage All Orders
            </Button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1F1D2B]/15 bg-[#FFF8EF]/50 p-6 text-center text-xs text-[#1F1D2B]/60">
              No customer orders have been placed yet. Completed checkouts will appear here live.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 text-[#1F1D2B]/60">
                    <th className="py-2.5 pr-3 font-semibold">Order ID</th>
                    <th className="py-2.5 pr-3 font-semibold">Customer</th>
                    <th className="py-2.5 pr-3 font-semibold">Payment</th>
                    <th className="py-2.5 pr-3 font-semibold text-right">Amount</th>
                    <th className="py-2.5 font-semibold text-right">Order Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {recentOrders.map((o) => (
                    <tr key={o.orderId} className="hover:bg-[#FFF8EF]/55">
                      <td className="py-3 pr-3 font-mono font-semibold text-[#1F1D2B] whitespace-nowrap">
                        {o.orderId}
                      </td>
                      <td className="py-3 pr-3 text-[#1F1D2B] whitespace-nowrap">
                        {o.customerName}
                      </td>
                      <td className="py-3 pr-3 text-[#1F1D2B]/70 whitespace-nowrap">
                        {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatINR(o.totalAmount)}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <ProductBadge tone={orderStatusTone(o.orderStatus)}>
                          {o.orderStatus}
                        </ProductBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="xl:col-span-4 rounded-2xl bg-[#1F1D2B] text-[#FFF8EF] p-5 flex flex-col justify-between gap-4">
          <div className="overflow-hidden rounded-xl border border-white/10 h-40">
            <ResilientImage
              src={ASSETS.showroomInterior}
              alt="3D Jummo Fashion World Showroom Preview"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#FFA94D]">3D Virtual Showroom</p>
            <h3 className="font-heading text-base font-bold">Merchandising &amp; Rack Preview</h3>
            <p className="text-xs text-[#FFF8EF]/70 leading-relaxed">
              Manage showroom sections, lighting presets, and product rack slots directly without
              leaving the admin workspace.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="primary" size="sm" onClick={() => onNavigateSection('showroom')}>
              Configure Racks
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-[#FFF8EF] hover:border-[#FFA94D]"
              leftIcon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={() => navigate('/showroom')}
            >
              Open 3D View
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
