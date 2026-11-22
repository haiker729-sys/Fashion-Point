export type Phase7PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'COD Pending'
  | 'Payment Processing'
  | 'Payment Authorized'
  | 'Payment Captured'
  | 'Payment Verified'
  | 'Payment Failed'
  | 'Invalid Signature'
  | 'Payment Verification Failed'
  | 'Verification Pending'
  | 'Refund Initiated'
  | 'Refunded'
  | 'Partially Refunded';

export type OrderStatusValue =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface ServerPaymentRecord {
  paymentId: string;
  orderId: string;
  customerUid: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: 'INR';
  paymentMethod: 'razorpay' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'online' | 'cod';
  paymentStatus: Phase7PaymentStatus;
  orderStatus: OrderStatusValue;
  signatureVerified: boolean;
  gatewayMode: 'test' | 'live';
  failureReason: string;
  firestoreSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerRefundRecord {
  refundId: string;
  paymentId: string;
  orderId: string;
  customerUid: string;
  razorpayPaymentId: string;
  razorpayRefundId: string;
  amount: number;
  currency: 'INR';
  type: 'full' | 'partial';
  reason: string;
  refundStatus: 'Refund Initiated' | 'Refunded' | 'Partially Refunded' | 'Failed';
  initiatedByUid: string;
  firestoreSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAuditEntry {
  timestamp: string;
  event: string;
  orderId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: string;
  note?: string;
}

const STATUS_PRECEDENCE: Record<Phase7PaymentStatus, number> = {
  Pending: 0,
  'COD Pending': 0,
  'Payment Processing': 1,
  'Verification Pending': 2,
  'Payment Authorized': 3,
  'Payment Failed': 2,
  Failed: 2,
  'Invalid Signature': 2,
  'Payment Verification Failed': 2,
  'Payment Captured': 5,
  'Payment Verified': 6,
  Paid: 6,
  'Refund Initiated': 7,
  'Partially Refunded': 8,
  Refunded: 9,
};

const SETTLED_PAID_STATUSES = new Set<Phase7PaymentStatus>([
  'Payment Captured',
  'Payment Verified',
  'Paid',
  'Refund Initiated',
  'Partially Refunded',
  'Refunded',
]);

export function canTransitionPaymentStatus(
  current: Phase7PaymentStatus | undefined,
  next: Phase7PaymentStatus
): boolean {
  if (!current) return true;
  if (current === next) return true;

  // Never downgrade a captured/verified/refunded payment back to failed, pending, or authorized
  if (SETTLED_PAID_STATUSES.has(current)) {
    return STATUS_PRECEDENCE[next] >= STATUS_PRECEDENCE[current];
  }

  // Allow retries from failed/verification-failed back to Payment Processing
  if (
    (current === 'Payment Failed' ||
      current === 'Invalid Signature' ||
      current === 'Payment Verification Failed' ||
      current === 'Verification Pending') &&
    next === 'Payment Processing'
  ) {
    return true;
  }

  return STATUS_PRECEDENCE[next] >= STATUS_PRECEDENCE[current];
}

export function isCapturedOrVerifiedStatus(status: Phase7PaymentStatus): boolean {
  return SETTLED_PAID_STATUSES.has(status);
}

/**
 * Server-authoritative Payment, Refund & Webhook Idempotency Ledger.
 * Guarantees idempotent webhook handling, out-of-order event protection, and safe non-PII logging.
 */
export class PaymentLedger {
  private paymentsByOrderId = new Map<string, ServerPaymentRecord>();
  private orderIdByRazorpayOrderId = new Map<string, string>();
  private orderIdByRazorpayPaymentId = new Map<string, string>();
  private processedWebhookEventIds = new Set<string>();
  private refundsByOrderId = new Map<string, ServerRefundRecord[]>();
  private auditLog: PaymentAuditEntry[] = [];

  recordAudit(entry: Omit<PaymentAuditEntry, 'timestamp'>): void {
    const safeEntry: PaymentAuditEntry = {
      timestamp: new Date().toISOString(),
      event: entry.event,
      orderId: entry.orderId,
      razorpayOrderId: entry.razorpayOrderId,
      razorpayPaymentId: entry.razorpayPaymentId,
      status: entry.status,
      note: entry.note,
    };
    this.auditLog.unshift(safeEntry);
    if (this.auditLog.length > 250) {
      this.auditLog.length = 250;
    }
  }

  getByOrderId(orderId: string): ServerPaymentRecord | null {
    return this.paymentsByOrderId.get(orderId) || null;
  }

  getByRazorpayOrderId(razorpayOrderId: string): ServerPaymentRecord | null {
    const orderId = this.orderIdByRazorpayOrderId.get(razorpayOrderId);
    return orderId ? this.paymentsByOrderId.get(orderId) || null : null;
  }

  getByRazorpayPaymentId(razorpayPaymentId: string): ServerPaymentRecord | null {
    const orderId = this.orderIdByRazorpayPaymentId.get(razorpayPaymentId);
    return orderId ? this.paymentsByOrderId.get(orderId) || null : null;
  }

  upsertPayment(record: ServerPaymentRecord): { updated: boolean; record: ServerPaymentRecord } {
    const existing = this.paymentsByOrderId.get(record.orderId);
    if (existing && !canTransitionPaymentStatus(existing.paymentStatus, record.paymentStatus)) {
      this.recordAudit({
        event: 'out_of_order_transition_ignored',
        orderId: record.orderId,
        razorpayOrderId: record.razorpayOrderId,
        razorpayPaymentId: record.razorpayPaymentId,
        status: existing.paymentStatus,
        note: `Ignored transition ${existing.paymentStatus} -> ${record.paymentStatus}`,
      });
      return { updated: false, record: existing };
    }

    const merged: ServerPaymentRecord = {
      ...existing,
      ...record,
      createdAt: existing?.createdAt || record.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.paymentsByOrderId.set(merged.orderId, merged);
    if (merged.razorpayOrderId) {
      this.orderIdByRazorpayOrderId.set(merged.razorpayOrderId, merged.orderId);
    }
    if (merged.razorpayPaymentId) {
      this.orderIdByRazorpayPaymentId.set(merged.razorpayPaymentId, merged.orderId);
    }
    return { updated: true, record: merged };
  }

  hasProcessedWebhookEvent(eventId: string): boolean {
    return this.processedWebhookEventIds.has(eventId);
  }

  markWebhookEventProcessed(eventId: string): void {
    this.processedWebhookEventIds.add(eventId);
  }

  addRefund(refund: ServerRefundRecord): void {
    const list = this.refundsByOrderId.get(refund.orderId) || [];
    const idx = list.findIndex((r) => r.refundId === refund.refundId);
    if (idx >= 0) {
      list[idx] = refund;
    } else {
      list.unshift(refund);
    }
    this.refundsByOrderId.set(refund.orderId, list);
  }

  getRefundsForOrder(orderId: string): ServerRefundRecord[] {
    return this.refundsByOrderId.get(orderId) || [];
  }

  getTotalRefundedForOrder(orderId: string): number {
    const list = this.refundsByOrderId.get(orderId) || [];
    return list
      .filter((r) => r.refundStatus !== 'Failed')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  getSummary() {
    const allPayments = Array.from(this.paymentsByOrderId.values());
    const allRefunds = Array.from(this.refundsByOrderId.values()).flat();
    return {
      totalOnlinePayments: allPayments.length,
      successfulPayments: allPayments.filter((p) =>
        ['Payment Verified', 'Payment Captured', 'Paid'].includes(p.paymentStatus)
      ).length,
      failedPayments: allPayments.filter((p) =>
        ['Payment Failed', 'Invalid Signature', 'Payment Verification Failed', 'Failed'].includes(
          p.paymentStatus
        )
      ).length,
      pendingPayments: allPayments.filter((p) =>
        ['Pending', 'Payment Processing', 'Payment Authorized', 'Verification Pending'].includes(
          p.paymentStatus
        )
      ).length,
      totalRefunds: allRefunds.length,
      totalRefundedAmount: allRefunds
        .filter((r) => r.refundStatus !== 'Failed')
        .reduce((s, r) => s + r.amount, 0),
      recentPayments: allPayments
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 25),
      recentRefunds: allRefunds
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 25),
      recentAudit: this.auditLog.slice(0, 25),
    };
  }
}

export const globalPaymentLedger = new PaymentLedger();
