import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminPaymentSummary, initiateAdminRefund } from '../../services/paymentApi';
import type { OrderDoc } from '../../types/commerce';
import {
  getPaymentStatusBadgeClasses,
  isPaymentFailureStatus,
  isPaymentSettledSuccess,
  type AdminPaymentSummaryResponse,
  type PaymentRecordDoc,
  type RefundRecordDoc,
} from '../../types/payment';
import { REPORTING_TIMEZONE } from '../../utils/adminAnalytics';
import { formatINR } from '../../utils/catalogHelpers';
import { ConfirmationDialog, useToast } from '../ui/Overlays';
import { Button, ProductBadge, SearchBar, StatusAlert } from '../ui/Primitives';

interface AdminPaymentsRefundsViewProps {
  mode: 'payments' | 'refunds';
  orders: OrderDoc[];
  payments: PaymentRecordDoc[];
  refunds: RefundRecordDoc[];
}

export const AdminPaymentsRefundsView: React.FC<AdminPaymentsRefundsViewProps> = ({
  mode,
  orders,
  payments,
  refunds,
}) => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  const [serverSummary, setServerSummary] = useState<AdminPaymentSummaryResponse | null>(null);
  const [loadingGateway, setLoadingGateway] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [txTab, setTxTab] = useState<'all' | 'successful' | 'failed' | 'pending' | 'cod' | 'refunds'>(
    mode === 'refunds' ? 'refunds' : 'all'
  );

  // Refund Initiation State (Strictly Admin / Super Admin)
  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [confirmRefundModal, setConfirmRefundModal] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);

  const canInitiateRefund = hasPermission('refunds:initiate');

  const loadGatewayStatus = useCallback(async () => {
    if (!user) return;
    setLoadingGateway(true);
    setGatewayError(null);
    try {
      const res = await fetchAdminPaymentSummary(user);
      setServerSummary(res);
    } catch (err) {
      setGatewayError(err instanceof Error ? err.message : 'Unable to reach Razorpay backend.');
    } finally {
      setLoadingGateway(false);
    }
  }, [user]);

  useEffect(() => {
    void loadGatewayStatus();
  }, [loadGatewayStatus]);

  // Deduplicate Firestore + Server Ledger payments & correlate customer names from orders
  const orderById = useMemo(
    () => new Map(orders.map((o) => [o.orderId, o])),
    [orders]
  );

  const mergedPayments = useMemo(() => {
    const map = new Map<string, PaymentRecordDoc>();
    for (const p of payments) map.set(p.orderId, p);
    for (const p of serverSummary?.ledger.recentPayments || []) {
      if (!map.has(p.orderId)) map.set(p.orderId, p);
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [payments, serverSummary]);

  const codOrdersList = useMemo(
    () => orders.filter((o) => o.paymentMethod === 'cod'),
    [orders]
  );

  const mergedRefunds = useMemo(() => {
    const map = new Map<string, RefundRecordDoc>();
    for (const r of refunds) map.set(r.refundId, r);
    for (const r of serverSummary?.ledger.recentRefunds || []) {
      if (!map.has(r.refundId)) map.set(r.refundId, r);
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [refunds, serverSummary]);

  // Eligible verified online payments that still have refundable balance
  const refundablePayments = useMemo(() => {
    const refundedByOrder = new Map<string, number>();
    for (const r of mergedRefunds) {
      if (r.refundStatus !== 'Failed') {
        refundedByOrder.set(r.orderId, (refundedByOrder.get(r.orderId) || 0) + r.amount);
      }
    }
    return mergedPayments
      .filter((p) => p.razorpayPaymentId && isPaymentSettledSuccess(p.paymentStatus))
      .map((p) => {
        const alreadyRefunded = refundedByOrder.get(p.orderId) || 0;
        const remaining = Math.max(0, p.amount - alreadyRefunded);
        return { payment: p, alreadyRefunded, remaining };
      })
      .filter((x) => x.remaining > 0);
  }, [mergedPayments, mergedRefunds]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedPayments.filter((p) => {
      if (txTab === 'successful' && !isPaymentSettledSuccess(p.paymentStatus)) return false;
      if (txTab === 'failed' && !isPaymentFailureStatus(p.paymentStatus)) return false;
      if (
        txTab === 'pending' &&
        (isPaymentSettledSuccess(p.paymentStatus) ||
          isPaymentFailureStatus(p.paymentStatus) ||
          ['Refund Initiated', 'Refunded', 'Partially Refunded'].includes(p.paymentStatus))
      ) {
        return false;
      }
      if (!q) return true;
      const customerName = (orderById.get(p.orderId)?.customerName || '').toLowerCase();
      return (
        p.paymentId.toLowerCase().includes(q) ||
        p.orderId.toLowerCase().includes(q) ||
        p.razorpayPaymentId.toLowerCase().includes(q) ||
        customerName.includes(q)
      );
    });
  }, [mergedPayments, orderById, search, txTab]);

  const handleRequestRefundConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInitiateRefund) return;
    if (!refundOrderId.trim() || refundReason.trim().length < 3) {
      addToast({
        type: 'error',
        title: 'Incomplete Refund Details',
        description: 'Enter Order ID and a clear refund reason (minimum 3 characters).',
      });
      return;
    }
    setConfirmRefundModal(true);
  };

  const executeTrustedRefund = async () => {
    if (!user || refundBusy) return;
    setRefundBusy(true);
    try {
      const parsedAmount = refundAmount.trim() ? Number(refundAmount.trim()) : undefined;
      const res = await initiateAdminRefund(
        {
          orderId: refundOrderId.trim(),
          razorpayPaymentId: refundPaymentId.trim() || undefined,
          amount: parsedAmount,
          reason: refundReason.trim(),
        },
        user
      );
      addToast({
        type: 'success',
        title: `${res.refund.type === 'full' ? 'Full' : 'Partial'} Refund Initiated`,
        description: `Refunded ${formatINR(res.refund.amount)} (${res.refund.razorpayRefundId}).`,
      });
      setRefundOrderId('');
      setRefundPaymentId('');
      setRefundAmount('');
      setRefundReason('');
      void loadGatewayStatus();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Refund Rejected',
        description: err instanceof Error ? err.message : 'Unable to process refund.',
      });
    } finally {
      setRefundBusy(false);
    }
  };

  const gateway = serverSummary?.gateway;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Razorpay Server-Verified Ledger · PCI-Safe Metadata Only
          </p>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            {mode === 'refunds'
              ? 'Refund Management & Razorpay Reversals'
              : 'Payment Management & Gateway Transactions'}
          </h2>
          <p className="text-xs text-[#1F1D2B]/65 mt-0.5">
            {mode === 'refunds'
              ? 'Inspect verified captured payments, execute full or partial Razorpay refunds with confirmation, and prevent duplicate reversals.'
              : 'Track All, Successful, Failed, Pending, and COD transactions. Online statuses can never be overridden manually.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={loadingGateway}
          leftIcon={
            loadingGateway ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )
          }
          onClick={() => void loadGatewayStatus()}
        >
          Refresh Gateway Status
        </Button>
      </div>

      {gatewayError && (
        <StatusAlert variant="error" title="Gateway Telemetry Notice" description={gatewayError} />
      )}

      {/* Gateway Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#1F1D2B]/60">Razorpay Gateway Status</p>
            <p className="mt-1 text-xs text-[#1F1D2B]/80">
              {gateway?.message || 'Inspecting server gateway configuration...'}
            </p>
          </div>
          <ProductBadge
            tone={
              gateway?.mode === 'live'
                ? 'success'
                : gateway?.mode === 'test'
                  ? 'info'
                  : 'warning'
            }
          >
            {(gateway?.mode || 'checking').toUpperCase()}
          </ProductBadge>
        </div>

        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#1F1D2B]/60">Webhook Security Lock</p>
            <p className="mt-1 text-xs text-[#1F1D2B]/80">
              Raw-body HMAC-SHA256 verification active · Secret keys stay strictly on server
            </p>
          </div>
          <ProductBadge tone={gateway?.webhookConfigured ? 'success' : 'warning'}>
            {gateway?.webhookConfigured ? 'WEBHOOK SET' : 'WEBHOOK PENDING'}
          </ProductBadge>
        </div>
      </div>

      {/* Refund Initiation Panel (visible in Refunds mode, or Admin/Super Admin only) */}
      {mode === 'refunds' && (
        <div className="space-y-4">
          {!canInitiateRefund ? (
            <StatusAlert
              variant="info"
              title="Read-Only Financial Refund Access"
              description="Only Super Admin or Admin roles can initiate live Razorpay refunds. Your role can inspect eligible orders and full refund history below."
            />
          ) : (
            <form
              onSubmit={handleRequestRefundConfirmation}
              className="rounded-2xl border border-[#2563EB]/25 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1D2B]/10 pb-3">
                <div>
                  <h3 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4 text-[#2563EB]" />
                    Initiate Full or Partial Refund via Razorpay
                  </h3>
                  <p className="text-xs text-[#1F1D2B]/60 mt-0.5">
                    Calls <code className="font-mono">POST /api/payments/refund</code> with duplicate
                    concurrency protection and immutable audit logging.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Trusted Backend Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={refundOrderId}
                  onChange={(e) => setRefundOrderId(e.target.value)}
                  placeholder="Order ID (FW-...)"
                  className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-mono"
                />
                <input
                  type="text"
                  value={refundPaymentId}
                  onChange={(e) => setRefundPaymentId(e.target.value)}
                  placeholder="Razorpay Payment ID (pay_...)"
                  className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs font-mono"
                />
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="INR amount (blank = full)"
                  className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs tabular-nums"
                />
                <input
                  type="text"
                  required
                  minLength={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Refund reason (required)"
                  className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-3 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {!gateway?.configured ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F59E0B]">
                    <ShieldAlert className="h-4 w-4" />
                    Configure Razorpay backend keys in Secrets to execute live refunds.
                  </span>
                ) : (
                  <span className="text-xs text-[#1F1D2B]/60">
                    Leave Amount blank for a full refund, or specify an amount for a partial refund.
                  </span>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={refundBusy || !gateway?.configured}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Review &amp; Initiate Refund
                </Button>
              </div>
            </form>
          )}

          {/* Eligible Verified Online Payments Ready for Refund */}
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#1F1D2B]/10 flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold text-[#1F1D2B]">
                Verified Payments Eligible for Refund ({refundablePayments.length})
              </h3>
              <span className="text-xs text-[#1F1D2B]/55">Excludes fully refunded orders</span>
            </div>
            {refundablePayments.length === 0 ? (
              <p className="p-6 text-center text-xs text-[#1F1D2B]/60">
                No captured Razorpay payments with remaining refundable balance.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                      <th className="py-2.5 px-4 font-semibold">Order ID</th>
                      <th className="py-2.5 px-4 font-semibold">Razorpay Payment ID</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Captured</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Already Refunded</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Remaining</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1D2B]/8">
                    {refundablePayments.map(({ payment, alreadyRefunded, remaining }) => (
                      <tr key={payment.paymentId}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#1F1D2B]">
                          {payment.orderId}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[#1F1D2B]/75">
                          {payment.razorpayPaymentId}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatINR(payment.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#DC2626]">
                          {formatINR(alreadyRefunded)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums text-[#16A34A]">
                          {formatINR(remaining)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {canInitiateRefund && (
                            <button
                              type="button"
                              onClick={() => {
                                setRefundOrderId(payment.orderId);
                                setRefundPaymentId(payment.razorpayPaymentId);
                                setRefundAmount(String(remaining));
                              }}
                              className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                            >
                              Prefill Form
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto fw-no-scrollbar">
          {[
            { id: 'all', label: `All Transactions (${mergedPayments.length})` },
            {
              id: 'successful',
              label: `Successful (${mergedPayments.filter((p) => isPaymentSettledSuccess(p.paymentStatus)).length})`,
            },
            {
              id: 'failed',
              label: `Failed (${mergedPayments.filter((p) => isPaymentFailureStatus(p.paymentStatus)).length})`,
            },
            {
              id: 'pending',
              label: `Pending (${
                mergedPayments.filter(
                  (p) =>
                    !isPaymentSettledSuccess(p.paymentStatus) &&
                    !isPaymentFailureStatus(p.paymentStatus) &&
                    !['Refund Initiated', 'Refunded', 'Partially Refunded'].includes(p.paymentStatus)
                ).length
              })`,
            },
            { id: 'cod', label: `COD Payments (${codOrdersList.length})` },
            { id: 'refunds', label: `Refund History (${mergedRefunds.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTxTab(tab.id as typeof txTab)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                txTab === tab.id
                  ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                  : 'bg-white border border-[#1F1D2B]/12 text-[#1F1D2B]/75 hover:border-[#FF7A00]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search Payment ID, Order ID, Customer..."
          />
        </div>
      </div>

      {/* Transaction / COD / Refund Tables */}
      {txTab === 'refunds' ? (
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
          {mergedRefunds.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#1F1D2B]/60">
              No Razorpay refunds initiated yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                    <th className="py-3 px-4 font-semibold">Refund ID</th>
                    <th className="py-3 px-4 font-semibold">Order ID</th>
                    <th className="py-3 px-4 font-semibold">Razorpay Refund Ref</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3 px-4 font-semibold">Reason</th>
                    <th className="py-3 px-4 font-semibold">Date (IST)</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {mergedRefunds.map((r) => (
                    <tr key={r.refundId}>
                      <td className="py-3 px-4 font-mono font-semibold text-[#1F1D2B]">{r.refundId}</td>
                      <td className="py-3 px-4 font-mono text-[#1F1D2B]/80">{r.orderId}</td>
                      <td className="py-3 px-4 font-mono text-[#1F1D2B]/70">{r.razorpayRefundId}</td>
                      <td className="py-3 px-4 uppercase font-semibold">{r.type}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        {formatINR(r.amount)}
                      </td>
                      <td className="py-3 px-4 max-w-xs text-[#1F1D2B]/75">{r.reason}</td>
                      <td className="py-3 px-4 tabular-nums text-[#1F1D2B]/65 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ProductBadge
                          tone={
                            r.refundStatus === 'Failed'
                              ? 'error'
                              : r.refundStatus === 'Refund Initiated'
                                ? 'warning'
                                : 'info'
                          }
                        >
                          {r.refundStatus}
                        </ProductBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : txTab === 'cod' ? (
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
          {codOrdersList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#1F1D2B]/60">
              No Cash on Delivery orders recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                    <th className="py-3 px-4 font-semibold">Order ID</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Date (IST)</th>
                    <th className="py-3 px-4 font-semibold text-right">COD Amount</th>
                    <th className="py-3 px-4 font-semibold">Order Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Collection State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {codOrdersList.map((o) => {
                    const collected = o.orderStatus === 'Delivered' || o.paymentStatus === 'Paid';
                    return (
                      <tr key={o.orderId}>
                        <td className="py-3 px-4 font-mono font-semibold text-[#1F1D2B]">
                          {o.orderId}
                        </td>
                        <td className="py-3 px-4 text-[#1F1D2B]">{o.customerName}</td>
                        <td className="py-3 px-4 tabular-nums text-[#1F1D2B]/65">
                          {new Date(o.createdAt).toLocaleString('en-IN', {
                            timeZone: REPORTING_TIMEZONE,
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums">
                          {formatINR(o.totalAmount)}
                        </td>
                        <td className="py-3 px-4">{o.orderStatus}</td>
                        <td className="py-3 px-4 text-right">
                          <ProductBadge
                            tone={
                              collected
                                ? 'success'
                                : o.orderStatus === 'Cancelled'
                                  ? 'error'
                                  : 'warning'
                            }
                          >
                            {collected
                              ? 'COD Collected'
                              : o.orderStatus === 'Cancelled'
                                ? 'Cancelled'
                                : 'COD Pending'}
                          </ProductBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#1F1D2B]/60 space-y-1">
              <CreditCard className="h-7 w-7 mx-auto text-[#1F1D2B]/30" />
              <p className="font-semibold text-[#1F1D2B]">No transactions match this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/60">
                    <th className="py-3 px-4 font-semibold">Payment ID</th>
                    <th className="py-3 px-4 font-semibold">Order ID</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Method</th>
                    <th className="py-3 px-4 font-semibold">Razorpay Ref</th>
                    <th className="py-3 px-4 font-semibold">Date (IST)</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3 px-4 font-semibold text-right">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1D2B]/8">
                  {filteredPayments.map((p) => (
                    <tr key={p.paymentId} className="hover:bg-[#FFF8EF]/45">
                      <td className="py-3 px-4 font-mono font-semibold text-[#1F1D2B]">
                        {p.paymentId}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#1F1D2B]/85">{p.orderId}</td>
                      <td className="py-3 px-4 text-[#1F1D2B]">
                        {orderById.get(p.orderId)?.customerName || p.customerUid.slice(0, 12)}
                      </td>
                      <td className="py-3 px-4 uppercase font-semibold text-[#1F1D2B]/75">
                        {p.paymentMethod}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#1F1D2B]/70">
                        {p.razorpayPaymentId || p.razorpayOrderId || '—'}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-[#1F1D2B]/65 whitespace-nowrap">
                        {new Date(p.updatedAt).toLocaleString('en-IN', {
                          timeZone: REPORTING_TIMEZONE,
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${getPaymentStatusBadgeClasses(
                            p.paymentStatus
                          )}`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmationDialog
        open={confirmRefundModal}
        onClose={() => setConfirmRefundModal(false)}
        onConfirm={() => void executeTrustedRefund()}
        title={`Confirm Razorpay Refund on ${refundOrderId}?`}
        message={`This will submit a real ${
          refundAmount.trim() ? `partial refund of ${formatINR(Number(refundAmount))}` : 'full refund'
        } via Razorpay API for Order ${refundOrderId}. Reason: "${refundReason}".`}
        confirmLabel="Execute Razorpay Refund"
        destructive
      />
    </div>
  );
};
