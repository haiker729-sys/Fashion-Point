import type { OrderStatus } from './commerce';
import type { AdminPermission, StaffRole } from '../utils/adminPermissions';

export type AdminDashboardSection =
  | 'dashboard'
  | 'analytics'
  | 'orders'
  | 'payments'
  | 'refunds'
  | 'customers'
  | 'inventory'
  | 'products'
  | 'categories'
  | 'offers'
  | 'staff'
  | 'showroom'
  | 'reports'
  | 'activity'
  | 'settings';

export interface StaffMemberDoc {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  permissions?: AdminPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusTimelineEvent {
  status: OrderStatus;
  previousStatus: OrderStatus;
  actorUid: string;
  actorName: string;
  actorRole: StaffRole;
  reason: string;
  timestamp: string;
}

export interface OrderInternalNote {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  authorRole: StaffRole;
  createdAt: string;
}

export type CustomerAccountStatus = 'active' | 'suspended' | 'flagged';

export interface CustomerSupportNote {
  id: string;
  subject: string;
  summary: string;
  status: 'open' | 'resolved';
  actorUid: string;
  actorName: string;
  createdAt: string;
}

export interface CustomerRecordDoc {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  phone: string;
  role: string;
  accountStatus: CustomerAccountStatus;
  supportNotes: CustomerSupportNote[];
  createdAt: string;
  updatedAt: string;
}

export type InventoryMovementType =
  | 'manual_adjustment'
  | 'restock'
  | 'damage'
  | 'order_deduction'
  | 'return_restock';

export interface InventoryMovementDoc {
  movementId: string;
  productId: string;
  productName: string;
  variantId: string;
  variantSku: string;
  colour: string;
  size: string;
  previousStock: number;
  delta: number;
  newStock: number;
  movementType: InventoryMovementType;
  reason: string;
  actorUid: string;
  actorName: string;
  actorRole: StaffRole;
  createdAt: string;
}

export type ActivityActionType =
  | 'Product Created'
  | 'Product Updated'
  | 'Product Deleted'
  | 'Stock Changed'
  | 'Order Status Updated'
  | 'Order Note Added'
  | 'Refund Initiated'
  | 'Coupon Created'
  | 'Coupon Updated'
  | 'Coupon Deleted'
  | 'Category Updated'
  | 'Showroom Updated'
  | 'Staff Permissions Changed'
  | 'Customer Status Updated'
  | 'Store Settings Updated'
  | 'Report Exported'
  | 'Security Event';

export interface ActivityLogDoc {
  logId: string;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  actorRole: StaffRole;
  action: ActivityActionType;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export type AdminNotificationType =
  | 'new_order'
  | 'payment_success'
  | 'payment_failed'
  | 'low_stock'
  | 'out_of_stock'
  | 'refund_request'
  | 'order_cancelled'
  | 'security_event';

export interface AdminNotificationDoc {
  notificationId: string;
  type: AdminNotificationType;
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  entityId: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  derived?: boolean;
}

export type AnalyticsDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export type AnalyticsGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type AdminReportType =
  | 'sales'
  | 'orders'
  | 'payments'
  | 'refunds'
  | 'inventory'
  | 'customers';
