import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { PaymentStatus } from '../types/commerce';
import type { PaymentRecordDoc, RefundRecordDoc } from '../types/payment';
import { db } from './firebaseConfig';
import { COMMERCE_COLLECTIONS } from './commerce';

export const PAYMENT_COLLECTIONS = {
  PAYMENTS: 'payments',
  REFUNDS: 'refunds',
} as const;

function timestampToIso(value: unknown): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date().toISOString();
}

function deserializePayment(docId: string, data: Record<string, unknown>): PaymentRecordDoc {
  return {
    paymentId: String(data.paymentId || docId),
    orderId: String(data.orderId || ''),
    customerUid: String(data.customerUid || ''),
    razorpayOrderId: String(data.razorpayOrderId || ''),
    razorpayPaymentId: String(data.razorpayPaymentId || ''),
    amount: Number(data.amount || 0),
    currency: 'INR',
    paymentMethod: (data.paymentMethod || 'razorpay') as PaymentRecordDoc['paymentMethod'],
    paymentStatus: (data.paymentStatus || 'Pending') as PaymentStatus,
    signatureVerified: Boolean(data.signatureVerified),
    gatewayMode: data.gatewayMode === 'live' ? 'live' : 'test',
    failureReason: String(data.failureReason || ''),
    firestoreSynced: true,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function deserializeRefund(docId: string, data: Record<string, unknown>): RefundRecordDoc {
  return {
    refundId: String(data.refundId || docId),
    paymentId: String(data.paymentId || ''),
    orderId: String(data.orderId || ''),
    customerUid: String(data.customerUid || ''),
    razorpayPaymentId: String(data.razorpayPaymentId || ''),
    razorpayRefundId: String(data.razorpayRefundId || ''),
    amount: Number(data.amount || 0),
    currency: 'INR',
    type: data.type === 'partial' ? 'partial' : 'full',
    reason: String(data.reason || ''),
    refundStatus: (data.refundStatus || 'Refund Initiated') as RefundRecordDoc['refundStatus'],
    initiatedByUid: String(data.initiatedByUid || ''),
    firestoreSynced: true,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export interface AdminFirestorePaymentMetrics {
  totalOnlineOrders: number;
  successfulOnlinePayments: number;
  failedOnlinePayments: number;
  pendingOnlinePayments: number;
  codOrders: number;
  refundCount: number;
  refundedAmountInr: number;
  payments: PaymentRecordDoc[];
  refunds: RefundRecordDoc[];
}

export function subscribeCustomerPayments(
  uid: string,
  onData: (payments: PaymentRecordDoc[]) => void
): Unsubscribe {
  if (!db || !uid) return () => {};
  const q = query(
    collection(db, PAYMENT_COLLECTIONS.PAYMENTS),
    where('customerUid', '==', uid),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => deserializePayment(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(list);
    },
    () => {
      // Non-fatal fallback
    }
  );
}

/**
 * Phase 8 Data Preparation Listener (Admin-Only):
 * Combines live Firestore `orders`, `payments`, and `refunds` collections to surface
 * Total Online Payments, Successful, Failed, Pending, COD Orders, Refunds, and Transaction History.
 */
export function subscribeAdminPaymentPreparation(
  isAdmin: boolean,
  onData: (metrics: AdminFirestorePaymentMetrics) => void
): Unsubscribe {
  if (!db || !isAdmin) return () => {};

  let codOrders = 0;
  let onlineOrdersCount = 0;
  let firestorePayments: PaymentRecordDoc[] = [];
  let firestoreRefunds: RefundRecordDoc[] = [];

  const emit = () => {
    const successfulOnlinePayments = firestorePayments.filter((p) =>
      ['Payment Verified', 'Payment Captured', 'Paid'].includes(p.paymentStatus)
    ).length;
    const failedOnlinePayments = firestorePayments.filter((p) =>
      ['Payment Failed', 'Invalid Signature', 'Payment Verification Failed', 'Failed'].includes(
        p.paymentStatus
      )
    ).length;
    const pendingOnlinePayments = Math.max(
      0,
      firestorePayments.filter((p) =>
        ['Pending', 'Payment Processing', 'Payment Authorized', 'Verification Pending'].includes(
          p.paymentStatus
        )
      ).length
    );
    const refundedAmountInr = firestoreRefunds
      .filter((r) => r.refundStatus !== 'Failed')
      .reduce((s, r) => s + r.amount, 0);

    onData({
      totalOnlineOrders: Math.max(onlineOrdersCount, firestorePayments.length),
      successfulOnlinePayments,
      failedOnlinePayments,
      pendingOnlinePayments,
      codOrders,
      refundCount: firestoreRefunds.length,
      refundedAmountInr,
      payments: firestorePayments,
      refunds: firestoreRefunds,
    });
  };

  const unsubOrders = onSnapshot(
    query(collection(db, COMMERCE_COLLECTIONS.ORDERS), limit(250)),
    (snap) => {
      let cod = 0;
      let online = 0;
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        if (data.paymentMethod === 'cod') cod += 1;
        else if (data.paymentMethod === 'online') online += 1;
      }
      codOrders = cod;
      onlineOrdersCount = online;
      emit();
    },
    () => {}
  );

  const unsubPayments = onSnapshot(
    query(collection(db, PAYMENT_COLLECTIONS.PAYMENTS), limit(250)),
    (snap) => {
      firestorePayments = snap.docs
        .map((d) => deserializePayment(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      emit();
    },
    () => {}
  );

  const unsubRefunds = onSnapshot(
    query(collection(db, PAYMENT_COLLECTIONS.REFUNDS), limit(250)),
    (snap) => {
      firestoreRefunds = snap.docs
        .map((d) => deserializeRefund(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      emit();
    },
    () => {}
  );

  return () => {
    unsubOrders();
    unsubPayments();
    unsubRefunds();
  };
}
