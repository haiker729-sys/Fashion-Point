import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeAdminPaymentPreparation,
  type AdminFirestorePaymentMetrics,
} from '../../firebase/payments';
import { fetchAdminPaymentSummary, initiateAdminRefund } from '../../services/paymentApi';
import {
  getPaymentStatusBadgeClasses,
  type AdminPaymentSummaryResponse,
} from '../../types/payment';
import { formatINR } from '../../utils/commerceHelpers';
import { Button, ProductBadge, StatusAlert } from '../ui/Primitives';

export const AdminPaymentsPrepCard: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [serverSummary, setServerSummary] = useState<AdminPaymentSummaryResponse | null>(null);
  const [firestoreMetrics, setFirestoreMetrics] = useState<AdminFirestorePaymentMetrics | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Admin Refund Foundation state
  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundMessage, setRefundMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadServerSummary = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    setApiError(null);
    try {
      const data = await fetchAdminPaymentSummary(user);
      setServerSummary(data);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Unable to reach Razorpay payment backend.'
      );
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    void loadServerSummary();
  }, [loadServerSummary]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeAdminPaymentPreparation(isAdmin, setFirestoreMetrics);
  }, [isAdmin]);

  const handleInitiateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || refundSubmitting) return;
    setRefundMessage(null);
    setRefundSubmitting(true);
    try {
      const parsedAmount = refundAmount.trim() ? Number(refundAmount.trim()) : undefined;
      const result = await initiateAdminRefund(
        {
          orderId: refundOrderId.trim(),
          razorpayPaymentId: refundPaymentId.trim() || undefined,
          amount: parsedAmount,
          reason: refundReason.trim(),
        },
        user
      );
      setRefundMessage({
        type: 'success',
        text: `${result.refund.type === 'full' ? 'Full' : 'Partial'} refund of ${formatINR(
          result.refund.amount
        )} initiated (Refund ID: ${result.refund.razorpayRefundId}).`,
      });
      setRefundOrderId('');
      setRefundPaymentId('');
      setRefundAmount('');
      setRefundReason('');
      void loadServerSummary();
    } catch (err) {
      setRefundMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Refund request failed.',
      });
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Merge Firestore and Server Ledger metrics without double-counting
  const totalOnline = Math.max(
    firestoreMetrics?.totalOnlineOrders ?? 0,
    serverSummary?.ledger.totalOnlinePayments ?? 0
  );
  const successfulOnline = Math.max(
    firestoreMetrics?.successfulOnlinePayments ?? 0,
    serverSummary?.ledger.successfulPayments ?? 0
  );
  const failedOnline = Math.max(
    firestoreMetrics?.failedOnlinePayments ?? 0,
    serverSummary?.ledger.failedPayments ?? 0
  );
  const pendingOnline = Math.max(
    firestoreMetrics?.pendingOnlinePayments ?? 0,
    serverSummary?.ledger.pendingPayments ?? 0
  );
  const codOrders = firestoreMetrics?.codOrders ?? 0;
  const totalRefunds = Math.max(
    firestoreMetrics?.refundCount ?? 0,
    serverSummary?.ledger.totalRefunds ?? 0
  );

  // Deduplicated recent payment records (Firestore + server ledger)
  const mergedPayments = (() => {
    const map = new Map<string, AdminPaymentSummaryResponse['ledger']['recentPayments'][number]>();
    for (const p of firestoreMetrics?.payments || []) {
      map.set(p.orderId, p);
    }
    for (const p of serverSummary?.ledger.recentPayments || []) {
      map.set(p.orderId, p);
    }
    return Array.from(map.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 12);
  })();

  const gateway = serverSummary?.gateway;

  return (
    <section className="rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1F1D2B]/10 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00]">
            <CreditCard className="h-4 w-4" />
            Phase 7 · Razorpay Gateway Status &amp; Phase 8 Payment Data Preparation
          </div>
          <h3 className="font-heading text-lg sm:text-xl font-bold text-[#1F1D2B]">
            Online Payments, Webhooks &amp; Refund Foundation
          </h3>
          <p className="text-xs text-[#1F1D2B]/65 max-w-2xl leading-relaxed">
            Real-time gateway readiness from <code className="font-mono">/api/payments</code> and
            Cloud Firestore (<code className="font-mono">payments</code>,{' '}
            <code className="font-mono">refunds</code>, <code className="font-mono">orders</code>).
            Configure Razorpay credentials strictly through backend environment variables / Secrets
            panel (see <code className="font-mono">RAZORPAY_SETUP.md</code>).
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          leftIcon={
            loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )
          }
          onClick={() => void loadServerSummary()}
        >
          Refresh Gateway Status
        </Button>
      </div>

      {apiError && (
        <StatusAlert variant="error" title="Payment Backend Unreachable" description={apiError} />
      )}

      {/* Gateway Mode & Webhook Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-[#FFF8EF] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F1D2B]/70">Razorpay API Mode</span>
            <ProductBadge
              tone={
                gateway?.mode === 'test'
                  ? 'info'
                  : gateway?.mode === 'live'
                    ? 'success'
                    : 'warning'
              }
            >
              {gateway?.mode === 'test'
                ? 'TEST MODE READY'
                : gateway?.mode === 'live'
                  ? 'LIVE MODE ACTIVE'
                  : gateway?.mode === 'live_blocked'
                    ? 'LIVE MODE LOCKED'
                    : 'CREDENTIALS NOT SET'}
            </ProductBadge>
          </div>
          <p className="text-xs text-[#1F1D2B]/75 leading-relaxed">
            {gateway?.message ||
              'Checking backend Razorpay configuration via /api/payments/admin-summary…'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-[#FFF8EF] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1F1D2B]/70">
              Webhook Signature Verification
            </span>
            <ProductBadge tone={gateway?.webhookConfigured ? 'success' : 'warning'}>
              {gateway?.webhookConfigured ? 'WEBHOOK SECRET SET' : 'WEBHOOK SECRET PENDING'}
            </ProductBadge>
          </div>
          <p className="text-xs text-[#1F1D2B]/75 leading-relaxed">
            Endpoint: <code className="font-mono">POST /api/payments/webhook</code> (raw-body
            HMAC-SHA256 verification, duplicate idempotency, out-of-order protection).
          </p>
        </div>
      </div>

      {/* Phase 8 Data Preparation Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs tabular-nums">
        <div className="rounded-xl border border-[#1F1D2B]/10 bg-white p-3.5">
          <p className="text-[#1F1D2B]/60">Total Online</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#1F1D2B]">{totalOnline}</p>
        </div>
        <div className="rounded-xl border border-[#16A34A]/25 bg-[#16A34A]/6 p-3.5">
          <p className="text-[#16A34A] font-semibold">Successful</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#16A34A]">{successfulOnline}</p>
        </div>
        <div className="rounded-xl border border-[#DC2626]/25 bg-[#DC2626]/6 p-3.5">
          <p className="text-[#DC2626] font-semibold">Failed</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#DC2626]">{failedOnline}</p>
        </div>
        <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/8 p-3.5">
          <p className="text-[#F59E0B] font-semibold">Pending</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#F59E0B]">{pendingOnline}</p>
        </div>
        <div className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF] p-3.5">
          <p className="text-[#1F1D2B]/70 font-semibold">COD Orders</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#1F1D2B]">{codOrders}</p>
        </div>
        <div className="rounded-xl border border-[#2563EB]/25 bg-[#2563EB]/6 p-3.5">
          <p className="text-[#2563EB] font-semibold">Refunds</p>
          <p className="mt-1 font-heading text-xl font-bold text-[#2563EB]">{totalRefunds}</p>
        </div>
      </div>

      {/* Transaction History Table (Metadata Only — Zero Card/UPI Secrets) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#FF7A00]" />
            Recent Online Payment Transactions ({mergedPayments.length})
          </h4>
          <span className="text-[11px] text-[#1F1D2B]/55">
            PCI-safe metadata only (zero card/CVV/UPI PIN stored)
          </span>
        </div>

        {mergedPayments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#1F1D2B]/15 bg-[#FFF8EF]/50 p-5 text-center text-xs text-[#1F1D2B]/65">
            No Razorpay online transactions recorded yet. Once Test Mode credentials are configured,
            verified transactions will populate here in real time.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#1F1D2B]/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFF8EF] border-b border-[#1F1D2B]/10 text-[#1F1D2B]/65">
                  <th className="py-2.5 px-3 font-semibold">Order ID</th>
                  <th className="py-2.5 px-3 font-semibold">Razorpay Payment ID</th>
                  <th className="py-2.5 px-3 font-semibold">Method</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1D2B]/8">
                {mergedPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-[#FFF8EF]/50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#1F1D2B]">
                      {p.orderId}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#1F1D2B]/75">
                      {p.razorpayPaymentId || '—'}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[#1F1D2B]/75">{p.paymentMethod}</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                      {formatINR(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold ${getPaymentStatusBadgeClasses(
                          p.paymentStatus
                        )}`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {p.razorpayPaymentId &&
                      ['Payment Verified', 'Payment Captured', 'Paid'].includes(p.paymentStatus) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundOrderId(p.orderId);
                            setRefundPaymentId(p.razorpayPaymentId);
                            setRefundAmount(String(p.amount));
                          }}
                          className="text-[#2563EB] font-semibold hover:underline cursor-pointer"
                        >
                          Prefill Refund
                        </button>
                      ) : (
                        <span className="text-[#1F1D2B]/35">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin-Only Refund Foundation Form */}
      <form
        onSubmit={handleInitiateRefund}
        className="rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/4 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-[#2563EB] flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Admin-Only Refund Foundation (Full &amp; Partial)
            </p>
            <p className="text-[11px] text-[#1F1D2B]/65 mt-0.5">
              Executes official Razorpay Refunds API via <code className="font-mono">POST /api/payments/refund</code>.
              Requires verified Admin role and never auto-refunds without manual submission.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin Auth Enforced
          </span>
        </div>

        {refundMessage && (
          <div
            role="alert"
            className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
              refundMessage.type === 'success'
                ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]'
                : 'border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626]'
            }`}
          >
            {refundMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{refundMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={refundOrderId}
            onChange={(e) => setRefundOrderId(e.target.value)}
            placeholder="Order ID (e.g. FW-...)"
            className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-mono focus:border-[#FF7A00] focus:outline-none"
          />
          <input
            type="text"
            value={refundPaymentId}
            onChange={(e) => setRefundPaymentId(e.target.value)}
            placeholder="Razorpay Payment ID (pay_...)"
            className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-mono focus:border-[#FF7A00] focus:outline-none"
          />
          <input
            type="number"
            min={1}
            step={1}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder="Amount INR (blank = full)"
            className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs tabular-nums focus:border-[#FF7A00] focus:outline-none"
          />
          <input
            type="text"
            required
            minLength={3}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Refund reason (required)"
            className="h-10 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs focus:border-[#FF7A00] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {!gateway?.configured ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#F59E0B]">
              <ShieldAlert className="h-3.5 w-3.5" />
              Configure Razorpay Test credentials in backend Secrets to execute live refund calls.
            </span>
          ) : (
            <span className="text-[11px] text-[#1F1D2B]/60">
              Leave Amount blank for a full refund, or specify a lower INR amount for a partial refund.
            </span>
          )}
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={refundSubmitting || !gateway?.configured}
            leftIcon={
              refundSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )
            }
          >
            {refundSubmitting ? 'Processing Refund…' : 'Initiate Razorpay Refund'}
          </Button>
        </div>
      </form>
    </section>
  );
};
