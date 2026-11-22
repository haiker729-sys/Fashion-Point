import type { OrderStatus, PaymentMethod, PaymentStatus } from './commerce';

export type GatewayMode = 'unconfigured' | 'test' | 'live' | 'live_blocked';

export interface RazorpayConfigResponse {
  configured: boolean;
  webhookConfigured: boolean;
  mode: GatewayMode;
  keyId: string | null;
  liveModeEnabled: boolean;
  currency: 'INR';
  supportedMethods: string[];
  message: string;
}

export interface PaymentRecordDoc {
  paymentId: string;
  orderId: string;
  customerUid: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: 'INR';
  paymentMethod: 'razorpay' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'online' | 'cod';
  paymentStatus: PaymentStatus;
  orderStatus?: OrderStatus;
  signatureVerified: boolean;
  gatewayMode: 'test' | 'live';
  failureReason: string;
  firestoreSynced?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRecordDoc {
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
  firestoreSynced?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentOrderResponse {
  orderId: string;
  paymentId: string;
  razorpayOrderId: string;
  amount: number;
  amountPaise: number;
  currency: 'INR';
  keyId: string;
  mode: GatewayMode;
  customer: {
    name: string;
    email: string;
    contact: string;
  };
}

export interface VerifyPaymentResponse {
  verified: boolean;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  firestoreSynced?: boolean;
  payment?: PaymentRecordDoc;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaymentStatusResponse {
  orderId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  amount: number;
  currency: 'INR';
  payment: PaymentRecordDoc | null;
  refunds: RefundRecordDoc[];
  canRetry: boolean;
}

export interface AdminPaymentSummaryResponse {
  gateway: {
    configured: boolean;
    webhookConfigured: boolean;
    mode: GatewayMode;
    liveModeEnabled: boolean;
    message: string;
  };
  ledger: {
    totalOnlinePayments: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
    totalRefunds: number;
    totalRefundedAmount: number;
    recentPayments: PaymentRecordDoc[];
    recentRefunds: RefundRecordDoc[];
    recentAudit: Array<{
      timestamp: string;
      event: string;
      orderId: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      status: string;
      note?: string;
    }>;
  };
}

export function isPaymentSettledSuccess(status: PaymentStatus): boolean {
  return status === 'Payment Verified' || status === 'Payment Captured' || status === 'Paid';
}

export function isPaymentFailureStatus(status: PaymentStatus): boolean {
  return (
    status === 'Payment Failed' ||
    status === 'Failed' ||
    status === 'Invalid Signature' ||
    status === 'Payment Verification Failed'
  );
}

export function isPaymentRefundStatus(status: PaymentStatus): boolean {
  return (
    status === 'Refund Initiated' || status === 'Refunded' || status === 'Partially Refunded'
  );
}

/**
 * Maps Phase 7 payment statuses strictly to Fashion World's official status color tokens:
 * - Success (#16A34A): Payment Captured, Payment Verified, Paid
 * - Error (#DC2626): Payment Failed, Invalid Signature, Payment Verification Failed, Failed
 * - Warning (#F59E0B): Pending, Payment Processing, Payment Authorized, Verification Pending, COD Pending
 * - Information (#2563EB): Refund Initiated, Refunded, Partially Refunded
 */
export function getPaymentStatusBadgeClasses(status: PaymentStatus): string {
  if (isPaymentSettledSuccess(status)) {
    return 'bg-[#16A34A]/15 text-[#16A34A] border border-[#16A34A]/30';
  }
  if (isPaymentFailureStatus(status)) {
    return 'bg-[#DC2626]/12 text-[#DC2626] border border-[#DC2626]/30';
  }
  if (isPaymentRefundStatus(status)) {
    return 'bg-[#2563EB]/12 text-[#2563EB] border border-[#2563EB]/30';
  }
  return 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30';
}

export function getPaymentStatusTextColor(status: PaymentStatus): string {
  if (isPaymentSettledSuccess(status)) return 'text-[#16A34A]';
  if (isPaymentFailureStatus(status)) return 'text-[#DC2626]';
  if (isPaymentRefundStatus(status)) return 'text-[#2563EB]';
  return 'text-[#F59E0B]';
}
