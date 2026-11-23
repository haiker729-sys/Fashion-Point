import React, { useMemo, useState } from 'react';
import { BarChart3, Calendar, CheckCircle2, FolderTree, Package, TrendingUp, XCircle } from 'lucide-react';
import type {
  AnalyticsDatePreset,
  AnalyticsGranularity,
} from '../../types/admin';
import type { CatalogCategory, ResolvedCatalogProduct } from '../../types/catalog';
import type { OrderDoc } from '../../types/commerce';
import type { PaymentRecordDoc, RefundRecordDoc } from '../../types/payment';
import {
  computeSalesAnalytics,
  REPORTING_TIMEZONE,
} from '../../utils/adminAnalytics';
import { formatINR } from '../../utils/catalogHelpers';
import { ProductBadge } from '../ui/Primitives';

interface AdminAnalyticsViewProps {
  orders: OrderDoc[];
  payments: PaymentRecordDoc[];
  refunds: RefundRecordDoc[];
  products: ResolvedCatalogProduct[];
  categories: CatalogCategory[];
}

const DATE_PRESETS: Array<{ id: AnalyticsDatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
];

const GRANULARITIES: Array<{ id: AnalyticsGranularity; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({
  orders,
  payments,
  refunds,
  products,
  categories,
}) => {
  const [preset, setPreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('daily');
  const [customStart, setCustomStart] = useState(
    new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)
  );
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const analytics = useMemo(
    () =>
      computeSalesAnalytics({
        orders,
        payments,
        refunds,
        products,
        categories,
        preset,
        granularity,
        customStart,
        customEnd,
      }),
    [categories, customEnd, customStart, granularity, orders, payments, preset, products, refunds]
  );

  // Revenue Trend SVG Geometry
  const svgWidth = 640;
  const svgHeight = 220;
  const padX = 32;
  const padY = 24;
  const series = analytics.series;
  const maxRev = Math.max(1, ...series.map((s) => s.revenue));
  const maxOrders = Math.max(1, ...series.map((s) => s.orders));

  const revPoints = series.map((pt, idx) => {
    const x =
      series.length <= 1
        ? svgWidth / 2
        : padX + (idx / (series.length - 1)) * (svgWidth - padX * 2);
    const y = svgHeight - padY - (pt.revenue / maxRev) * (svgHeight - padY * 2);
    return { x, y, ...pt };
  });

  const revLine =
    revPoints.length > 0
      ? revPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : '';
  const revArea =
    revPoints.length > 0
      ? `${revLine} L ${revPoints[revPoints.length - 1].x.toFixed(1)} ${(svgHeight - padY).toFixed(1)} L ${revPoints[0].x.toFixed(1)} ${(svgHeight - padY).toFixed(1)} Z`
      : '';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Real-Time Sales Intelligence · {REPORTING_TIMEZONE}
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Sales Analytics &amp; Revenue Performance
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5 tabular-nums">
            Active Window: <strong>{analytics.window.label}</strong> ({analytics.window.startDateIso}{' '}
            → {analytics.window.endDateIso})
          </p>
        </div>

        {/* Granularity Switcher */}
        <div className="inline-flex rounded-xl border border-[#1F1D2B]/12 bg-white p-1 self-start xl:self-auto">
          {GRANULARITIES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGranularity(g.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                granularity === g.id
                  ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                  : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* IST Date Preset Bar + Custom Date Inputs */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar className="h-4 w-4 text-[#FF7A00] mr-1 shrink-0" />
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                preset === p.id
                  ? 'bg-[#FF7A00] text-white'
                  : 'bg-[#FFF8EF] text-[#1F1D2B]/75 hover:text-[#1F1D2B]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold text-[#1F1D2B]">From (IST):</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-2.5 text-xs font-mono"
            />
            <label className="font-semibold text-[#1F1D2B]">To:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-2.5 text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* Window KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 text-xs tabular-nums">
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4">
          <p className="text-[#1F1D2B]/60">Gross Collected</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#1F1D2B]">
            {formatINR(analytics.grossSales)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1F1D2B]/55">
            Online {formatINR(analytics.onlineCollected)} · COD {formatINR(analytics.codCollected)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4">
          <p className="text-[#1F1D2B]/60">Refunds Issued</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#DC2626]">
            −{formatINR(analytics.refundsTotal)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1F1D2B]/55">Deducted from gross</p>
        </div>
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4">
          <p className="text-[#1F1D2B]/60">Net Window Revenue</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#FF7A00]">
            {formatINR(analytics.netRevenue)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1F1D2B]/55">
            AOV: {formatINR(analytics.averageOrderValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4">
          <p className="text-[#1F1D2B]/60">Orders in Window</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#1F1D2B]">
            {analytics.ordersInWindow}
          </p>
          <p className="mt-0.5 text-[11px] text-[#1F1D2B]/55">{granularity} buckets</p>
        </div>
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4">
          <p className="text-[#1F1D2B]/60 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
            Payment Success Rate
          </p>
          <p className="mt-1 font-heading text-xl font-bold text-[#16A34A]">
            {analytics.paymentSuccessRate.toFixed(1)}%
          </p>
          <p className="mt-0.5 text-[11px] text-[#1F1D2B]/55">Online gateway capture ratio</p>
        </div>
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4">
          <p className="text-[#1F1D2B]/60 flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5 text-[#DC2626]" />
            Order Cancellation Rate
          </p>
          <p className="mt-1 font-heading text-xl font-bold text-[#1F1D2B]">
            {analytics.orderCancellationRate.toFixed(1)}%
          </p>
          <p className="mt-0.5 text-[11px] text-[#1F1D2B]/55">Cancelled / total window orders</p>
        </div>
      </div>

      {/* Interactive Revenue Trend + Order Volume Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-[#1F1D2B] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#FF7A00]" />
                Revenue Trend ({granularity})
              </h3>
              <p className="text-xs text-[#1F1D2B]/55">
                Hover points to inspect collected sales &amp; refunds
              </p>
            </div>
            {hoverIdx !== null && revPoints[hoverIdx] && (
              <div className="text-xs text-right tabular-nums">
                <p className="font-semibold text-[#1F1D2B]">{revPoints[hoverIdx].label}</p>
                <p className="text-[#FF7A00] font-bold">{formatINR(revPoints[hoverIdx].revenue)}</p>
              </div>
            )}
          </div>

          {series.length === 0 ? (
            <div className="h-56 flex items-center justify-center rounded-xl border border-dashed border-[#1F1D2B]/15 text-xs text-[#1F1D2B]/55">
              No sales events recorded for the selected date range.
            </div>
          ) : (
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight + 24}`} className="w-full h-60">
              <defs>
                <linearGradient id="fwAnalyticsArea" x1="0" y1="0" x2="0" y2="1">
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
              <path d={revArea} fill="url(#fwAnalyticsArea)" />
              <path
                d={revLine}
                fill="none"
                stroke="#FF7A00"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {revPoints.map((pt, idx) => {
                const showTick =
                  revPoints.length <= 10 ||
                  idx === 0 ||
                  idx === revPoints.length - 1 ||
                  idx % Math.ceil(revPoints.length / 8) === 0;
                return (
                  <g
                    key={pt.bucketKey}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoverIdx === idx ? 5.5 : 3.5}
                      fill="#FFFFFF"
                      stroke="#FF7A00"
                      strokeWidth="2.2"
                    />
                    {showTick && (
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
          )}
        </div>

        {/* Order Volume Bar Chart */}
        <div className="xl:col-span-5 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-bold text-[#1F1D2B] flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#2563EB]" />
                Order Volume Trend
              </h3>
              <p className="text-xs text-[#1F1D2B]/55">Total orders placed per {granularity} period</p>
            </div>
            <ProductBadge tone="info">{analytics.ordersInWindow} Orders</ProductBadge>
          </div>

          {series.length === 0 ? (
            <div className="h-56 flex items-center justify-center rounded-xl border border-dashed border-[#1F1D2B]/15 text-xs text-[#1F1D2B]/55">
              No orders in selected date window.
            </div>
          ) : (
            <div className="h-56 flex items-end gap-1.5 pt-6 border-b border-[#1F1D2B]/10 pb-2 overflow-x-auto">
              {series.slice(-24).map((pt) => {
                const heightPct = Math.max(6, Math.round((pt.orders / maxOrders) * 100));
                return (
                  <div
                    key={pt.bucketKey}
                    className="flex-1 min-w-[16px] flex flex-col items-center justify-end gap-1 h-full group"
                    title={`${pt.label}: ${pt.orders} order(s) · ${formatINR(pt.revenue)}`}
                  >
                    <span className="text-[10px] font-mono text-[#1F1D2B]/65 opacity-0 group-hover:opacity-100 tabular-nums">
                      {pt.orders}
                    </span>
                    <div
                      className="w-full max-w-[26px] rounded-t-md bg-[#2563EB] group-hover:bg-[#FF7A00] transition-colors"
                      style={{ height: `${pt.orders === 0 ? 4 : heightPct}%`, opacity: pt.orders === 0 ? 0.15 : 1 }}
                    />
                    <span className="text-[9px] text-[#1F1D2B]/55 truncate max-w-[36px]">
                      {pt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Best Selling Products & Popular Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
            <h3 className="font-heading text-base font-bold text-[#1F1D2B] flex items-center gap-2">
              <Package className="h-4 w-4 text-[#FF7A00]" />
              Best Selling Products
            </h3>
            <span className="text-xs text-[#1F1D2B]/55">By non-cancelled order revenue</span>
          </div>
          {analytics.bestSellingProducts.length === 0 ? (
            <p className="text-xs text-[#1F1D2B]/55 py-6 text-center">
              No completed product sales in this window yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 text-[#1F1D2B]/60">
                    <th className="py-2 pr-3 font-semibold">Product</th>
                    <th className="py-2 pr-3 font-semibold text-right">Units Sold</th>
                    <th className="py-2 font-semibold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {analytics.bestSellingProducts.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-[#1F1D2B]">{item.name}</p>
                        <p className="font-mono text-[10px] text-[#1F1D2B]/55">{item.sku}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                        {item.unitsSold}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[#1F1D2B] tabular-nums">
                        {formatINR(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
            <h3 className="font-heading text-base font-bold text-[#1F1D2B] flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-[#16A34A]" />
              Popular Categories
            </h3>
            <span className="text-xs text-[#1F1D2B]/55">Demand share in window</span>
          </div>
          {analytics.popularCategories.length === 0 ? (
            <p className="text-xs text-[#1F1D2B]/55 py-6 text-center">
              No category sales data in this window yet.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.popularCategories.map((cat) => {
                const maxCatRev = Math.max(1, analytics.popularCategories[0]?.revenue || 1);
                const pct = Math.max(4, Math.round((cat.revenue / maxCatRev) * 100));
                return (
                  <div key={cat.categoryId} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1F1D2B]">{cat.categoryName}</span>
                      <span className="tabular-nums font-semibold text-[#1F1D2B]">
                        {cat.unitsSold} pcs · {formatINR(cat.revenue)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#FFF8EF] overflow-hidden">
                      <div className="h-full rounded-full bg-[#16A34A]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
