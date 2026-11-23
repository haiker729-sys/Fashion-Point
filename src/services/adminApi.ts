import type { User } from 'firebase/auth';
import type {
  ActivityActionType,
  AdminReportType,
  AnalyticsDatePreset,
  CustomerAccountStatus,
  InventoryMovementDoc,
} from '../types/admin';
import type { OrderStatus } from '../types/commerce';
import type { AdminPermission, StaffRole } from '../utils/adminPermissions';

async function getBearerHeaders(user: User | null): Promise<Record<string, string>> {
  if (!user) {
    throw new Error('Authentication required. Please sign in with a verified staff account.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonResponse<T>(resp: Response): Promise<T> {
  const payload = (await resp.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (!resp.ok) {
    throw new Error(payload.error || `Request failed (${resp.status}).`);
  }
  return payload;
}

export interface ServerStaffIdentityResponse {
  uid: string;
  email: string;
  role: StaffRole;
  isStaff: boolean;
  isBootstrapSuperAdmin: boolean;
  permissions: AdminPermission[];
}

export async function fetchServerStaffIdentity(
  user: User | null
): Promise<ServerStaffIdentityResponse> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch('/api/admin/me', { method: 'GET', headers });
  return parseJsonResponse<ServerStaffIdentityResponse>(resp);
}

export async function updateOrderStatusApi(
  user: User | null,
  orderId: string,
  payload: { orderStatus: OrderStatus; reason: string }
): Promise<{ ok: boolean; orderId: string; orderStatus: OrderStatus; paymentStatus: string }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(resp);
}

export async function addOrderNoteApi(
  user: User | null,
  orderId: string,
  text: string
): Promise<{ ok: boolean; orderId: string }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
  return parseJsonResponse(resp);
}

export async function adjustInventoryStockApi(
  user: User | null,
  payload: {
    productId: string;
    variantId: string;
    mode: 'delta' | 'set';
    value: number;
    movementType: InventoryMovementDoc['movementType'];
    reason: string;
  }
): Promise<{
  movementId: string;
  productId: string;
  variantId: string;
  previousStock: number;
  delta: number;
  newStock: number;
  totalProductStock: number;
}> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch('/api/admin/inventory/adjust', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(resp);
}

export async function validateCouponServerApi(
  user: User | null,
  code: string,
  subtotal: number
): Promise<{ valid: boolean; discount: number; message: string }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch('/api/admin/coupons/validate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ code, subtotal }),
  });
  return parseJsonResponse(resp);
}

export async function saveCouponApi(
  user: User | null,
  payload: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    minOrderValue: number;
    maxDiscount: number;
    startDate: string;
    expiryDate: string;
    usageLimit: number;
    active: boolean;
    description: string;
  }
): Promise<{ ok: boolean; code: string; created: boolean }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch('/api/admin/coupons', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(resp);
}

export async function deleteCouponApi(
  user: User | null,
  code: string
): Promise<{ ok: boolean; code: string }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers,
  });
  return parseJsonResponse(resp);
}

export async function saveStaffMemberApi(
  user: User | null,
  payload: {
    uid: string;
    email: string;
    displayName: string;
    role: StaffRole;
    active: boolean;
    permissions?: AdminPermission[];
  }
): Promise<{ ok: boolean; uid: string; role: StaffRole; active: boolean }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch('/api/admin/staff', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(resp);
}

export async function deleteStaffMemberApi(
  user: User | null,
  uid: string
): Promise<{ ok: boolean; uid: string }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch(`/api/admin/staff/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
    headers,
  });
  return parseJsonResponse(resp);
}

export async function updateCustomerStatusApi(
  user: User | null,
  uid: string,
  accountStatus: CustomerAccountStatus,
  reason: string
): Promise<{ ok: boolean; uid: string; accountStatus: CustomerAccountStatus }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch(`/api/admin/customers/${encodeURIComponent(uid)}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ accountStatus, reason }),
  });
  return parseJsonResponse(resp);
}

export async function addCustomerSupportNoteApi(
  user: User | null,
  uid: string,
  payload: { subject: string; summary: string; status: 'open' | 'resolved' }
): Promise<{ ok: boolean; uid: string }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch(`/api/admin/customers/${encodeURIComponent(uid)}/support`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(resp);
}

export async function appendActivityLogApi(
  user: User | null,
  payload: {
    action: ActivityActionType;
    entityType: string;
    entityId: string;
    summary: string;
  }
): Promise<void> {
  if (!user) return;
  try {
    const headers = await getBearerHeaders(user);
    await fetch('/api/admin/activity-logs', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking audit log attempt
  }
}

export async function downloadAdminReportCsvApi(
  user: User | null,
  payload: {
    reportType: AdminReportType;
    preset: AnalyticsDatePreset;
    customStart?: string;
    customEnd?: string;
  }
): Promise<{ filename: string; rowCount: number }> {
  const headers = await getBearerHeaders(user);
  const resp = await fetch('/api/admin/reports/export', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Export failed (${resp.status}).`);
  }

  const csvText = await resp.text();
  const disposition = resp.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename =
    match?.[1] ||
    `fashion-world-${payload.reportType}-${new Date().toISOString().slice(0, 10)}.csv`;

  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  const lines = csvText.trim().split('\n');
  return { filename, rowCount: Math.max(0, lines.length - 1) };
}
