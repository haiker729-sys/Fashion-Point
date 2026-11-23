import React, { useState } from 'react';
import {
  Calendar,
  CreditCard,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  Printer,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { downloadAdminReportCsvApi } from '../../services/adminApi';
import type { AdminReportType, AnalyticsDatePreset } from '../../types/admin';
import { REPORTING_TIMEZONE } from '../../utils/adminAnalytics';
import { useToast } from '../ui/Overlays';
import { Button, ProductBadge, StatusAlert } from '../ui/Primitives';

const REPORT_CATALOG: Array<{
  id: AdminReportType;
  title: string;
  category: 'financial' | 'operational';
  description: string;
  columns: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'sales',
    title: 'Daily Sales & Net Revenue Report',
    category: 'financial',
    description: 'IST-aligned daily collected sales (verified online + delivered COD), refunds, and net revenue.',
    columns: 'Date (IST), Orders Count, Collected Sales, Refunds, Net Revenue',
    icon: TrendingUp,
  },
  {
    id: 'orders',
    title: 'Orders Fulfillment Ledger',
    category: 'operational',
    description: 'Order IDs, role-scoped customer contact, city/state, payment status, fulfillment status, and INR totals.',
    columns: 'Order ID, Date, Customer, City/State, Payment, Status, Totals',
    icon: ShoppingCart,
  },
  {
    id: 'payments',
    title: 'Razorpay & Gateway Payments Report',
    category: 'financial',
    description: 'Server-verified payment records, Razorpay order/payment IDs, HMAC verification flags, and modes.',
    columns: 'Payment ID, Order ID, Razorpay Refs, Method, Amount, HMAC Verified',
    icon: CreditCard,
  },
  {
    id: 'refunds',
    title: 'Refunds & Reversals Audit Report',
    category: 'financial',
    description: 'Full and partial Razorpay refunds with reasons, refund IDs, status, and initiating admin UID.',
    columns: 'Refund ID, Order ID, Razorpay Refund ID, Type, Amount, Reason, Actor',
    icon: RotateCcw,
  },
  {
    id: 'inventory',
    title: 'Variant Inventory Valuation Sheet',
    category: 'operational',
    description: 'Every product and size/colour variant SKU with real-time stock quantities, low-stock thresholds, and pricing.',
    columns: 'Product ID, SKU, Variant SKU, Colour, Size, Stock Qty, Threshold, Price',
    icon: Package,
  },
  {
    id: 'customers',
    title: 'Customer Directory & Spend Summary',
    category: 'operational',
    description: 'PII-minimized customer accounts, order counts, lifetime spend, and account status.',
    columns: 'Customer UID, Name, Role-Scoped Contact, Status, Orders, Spend',
    icon: Users,
  },
];

const PRESETS: Array<{ id: AnalyticsDatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
];

export const AdminReportsView: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  const [preset, setPreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [customStart, setCustomStart] = useState(
    new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  );
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [busyReport, setBusyReport] = useState<AdminReportType | null>(null);

  const canFinancial = hasPermission('reports:financial');
  const canOperational = hasPermission('reports:operational');

  const handleDownloadCsv = async (reportType: AdminReportType) => {
    if (busyReport) return;
    setBusyReport(reportType);
    try {
      const res = await downloadAdminReportCsvApi(user, {
        reportType,
        preset,
        customStart: preset === 'custom' ? customStart : undefined,
        customEnd: preset === 'custom' ? customEnd : undefined,
      });
      addToast({
        type: 'success',
        title: 'CSV Report Downloaded',
        description: `Generated ${res.filename} (${res.rowCount} rows) via verified server export.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Export Blocked',
        description: err instanceof Error ? err.message : 'Unable to export report.',
      });
    } finally {
      setBusyReport(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Server-Authorized Exports · Formula-Injection Safe CSV · {REPORTING_TIMEZONE}
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            Reports &amp; Business Exports
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            Generate audited CSV exports directly from Cloud Firestore. Every download is rate-limited
            and logged in Activity Logs.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<Printer className="h-3.5 w-3.5" />}
          onClick={() => window.print()}
        >
          Print Current Summary
        </Button>
      </div>

      {/* Date Range Selector */}
      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Calendar className="h-4 w-4 text-[#FF7A00] mr-1" />
          {PRESETS.map((p) => (
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
          <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
            <label className="font-semibold text-[#1F1D2B]">Start Date (IST):</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-2.5 font-mono"
            />
            <label className="font-semibold text-[#1F1D2B]">End Date (IST):</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-2.5 font-mono"
            />
          </div>
        )}
      </div>

      {!canFinancial && !canOperational && (
        <StatusAlert
          variant="warning"
          title="Report Export Permission Required"
          description="Your current staff role does not include report export permissions."
        />
      )}

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORT_CATALOG.map((rep) => {
          const Icon = rep.icon;
          const allowed = rep.category === 'financial' ? canFinancial : canOperational;
          const isBusy = busyReport === rep.id;

          return (
            <div
              key={rep.id}
              className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF8EF] text-[#FF7A00] border border-[#1F1D2B]/8">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ProductBadge tone={rep.category === 'financial' ? 'info' : 'accent'}>
                    {rep.category.toUpperCase()}
                  </ProductBadge>
                </div>
                <h3 className="font-heading text-base font-bold text-[#1F1D2B]">{rep.title}</h3>
                <p className="text-xs text-[#1F1D2B]/70 leading-relaxed">{rep.description}</p>
                <p className="text-[11px] font-mono text-[#1F1D2B]/50 border-t border-[#1F1D2B]/8 pt-2">
                  Columns: {rep.columns}
                </p>
              </div>

              <Button
                type="button"
                variant={allowed ? 'secondary' : 'outline'}
                size="sm"
                fullWidth
                disabled={!allowed || Boolean(busyReport)}
                leftIcon={
                  isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => void handleDownloadCsv(rep.id)}
              >
                {!allowed
                  ? 'Role Restricted'
                  : isBusy
                    ? 'Exporting CSV...'
                    : 'Download CSV Report'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/70 p-4 flex items-center gap-3 text-xs text-[#1F1D2B]/75">
        <ShieldCheck className="h-5 w-5 text-[#16A34A] shrink-0" />
        <span>
          <strong className="text-[#1F1D2B]">Export Security:</strong> All CSV cells are sanitized
          against spreadsheet formula injection (<code className="font-mono">=, +, -, @</code>),
          never include payment card numbers or auth secrets, and mask customer PII automatically
          for non-Admin roles.
        </span>
        <FileSpreadsheet className="h-4 w-4 text-[#FF7A00] shrink-0 hidden sm:block" />
      </div>
    </div>
  );
};
