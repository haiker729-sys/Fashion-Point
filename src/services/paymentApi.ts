import type { User } from 'firebase/auth';
import type {
  AdminPaymentSummaryResponse,
  CreatePaymentOrderResponse,
  PaymentStatusResponse,
  RazorpayConfigResponse,
  RefundRecordDoc,
  VerifyPaymentResponse,
} from '../types/payment';

async function getAuthHeaders(user: User): Promise<Record<string, string>> {
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Payment server returned unexpected response (${res.status}).`);
  }
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Payment API request failed (${res.status}).`);
  }
  return body;
}

export async function fetchRazorpayConfig(): Promise<RazorpayConfigResponse> {
  const res = await fetch('/api/payments/config');
  return parseJsonResponse<RazorpayConfigResponse>(res);
}

export async function createRazorpayPaymentOrder(
  orderId: string,
  user: User
): Promise<CreatePaymentOrderResponse> {
  const headers = await getAuthHeaders(user);
  const res = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderId }),
  });
  return parseJsonResponse<CreatePaymentOrderResponse>(res);
}

export async function verifyRazorpayPayment(
  payload: {
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
  user: User
): Promise<VerifyPaymentResponse> {
  const headers = await getAuthHeaders(user);
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as VerifyPaymentResponse;
  if (!res.ok && res.status !== 202) {
    throw new Error(body.error || 'Payment verification failed on the server.');
  }
  return body;
}

export async function fetchOrderPaymentStatus(
  orderId: string,
  user: User
): Promise<PaymentStatusResponse> {
  const headers = await getAuthHeaders(user);
  const res = await fetch(`/api/payments/status/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers,
  });
  return parseJsonResponse<PaymentStatusResponse>(res);
}

export async function initiateAdminRefund(
  payload: {
    orderId: string;
    razorpayPaymentId?: string;
    amount?: number;
    reason: string;
  },
  user: User
): Promise<{ refund: RefundRecordDoc; firestoreSynced: boolean }> {
  const headers = await getAuthHeaders(user);
  const res = await fetch('/api/payments/refund', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ refund: RefundRecordDoc; firestoreSynced: boolean }>(res);
}

export async function fetchAdminPaymentSummary(user: User): Promise<AdminPaymentSummaryResponse> {
  const headers = await getAuthHeaders(user);
  const res = await fetch('/api/payments/admin-summary', {
    method: 'GET',
    headers,
  });
  return parseJsonResponse<AdminPaymentSummaryResponse>(res);
}
