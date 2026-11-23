import {
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { OperationType, handleFirestoreError } from './firebaseErrors';
import type {
  ActivityLogDoc,
  AdminNotificationDoc,
  CustomerAccountStatus,
  CustomerRecordDoc,
  CustomerSupportNote,
  InventoryMovementDoc,
  OrderInternalNote,
  OrderStatusTimelineEvent,
  StaffMemberDoc,
} from '../types/admin';
import type { CouponDoc, DeliveryAddressInput, OrderDoc, OrderItemSnapshot, OrderStatus, PaymentStatus } from '../types/commerce';
import type { ShowroomSectionConfigDoc } from './firestore';
import { isStaffRole, type AdminPermission } from '../utils/adminPermissions';

export const ADMIN_COLLECTIONS = {
  ORDERS: 'orders',
  USERS: 'users',
  COUPONS: 'coupons',
  ADMINS: 'admins',
  INVENTORY_HISTORY: 'inventoryHistory',
  ACTIVITY_LOGS: 'activityLogs',
  ADMIN_NOTIFICATIONS: 'adminNotifications',
  SHOWROOM: 'showroom',
} as const;

function timestampToIso(value: unknown): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date().toISOString();
}

function deserializeAdminOrder(docId: string, data: Record<string, unknown>): OrderDoc {
  const addr = (data.deliveryAddress || {}) as Partial<DeliveryAddressInput>;
  return {
    orderId: String(data.orderId || docId),
    customerUid: String(data.customerUid || ''),
    customerName: String(data.customerName || ''),
    customerEmail: String(data.customerEmail || ''),
    customerPhone: String(data.customerPhone || ''),
    items: Array.isArray(data.items) ? (data.items as OrderItemSnapshot[]) : [],
    deliveryAddress: {
      fullName: String(addr.fullName || ''),
      mobile: String(addr.mobile || ''),
      email: String(addr.email || ''),
      houseFlat: String(addr.houseFlat || ''),
      streetArea: String(addr.streetArea || ''),
      landmark: String(addr.landmark || ''),
      city: String(addr.city || ''),
      state: String(addr.state || ''),
      pinCode: String(addr.pinCode || ''),
      deliveryInstructions: String(addr.deliveryInstructions || ''),
    },
    deliveryMethod: data.deliveryMethod === 'express' ? 'express' : 'standard',
    subtotal: Number(data.subtotal || 0),
    catalogSavings: Number(data.catalogSavings || 0),
    discount: Number(data.discount || 0),
    couponCode: String(data.couponCode || ''),
    deliveryCharge: Number(data.deliveryCharge || 0),
    tax: Number(data.tax || 0),
    totalAmount: Number(data.totalAmount || 0),
    currency: 'INR',
    paymentMethod: data.paymentMethod === 'online' ? 'online' : 'cod',
    paymentStatus: (data.paymentStatus || 'Pending') as PaymentStatus,
    orderStatus: (data.orderStatus || 'Pending') as OrderStatus,
    idempotencyKey: String(data.idempotencyKey || ''),
    razorpayOrderId: typeof data.razorpayOrderId === 'string' ? data.razorpayOrderId : undefined,
    latestPaymentId: typeof data.latestPaymentId === 'string' ? data.latestPaymentId : undefined,
    statusHistory: Array.isArray(data.statusHistory)
      ? (data.statusHistory as OrderStatusTimelineEvent[])
      : [],
    internalNotes: Array.isArray(data.internalNotes)
      ? (data.internalNotes as OrderInternalNote[])
      : [],
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function subscribeAllAdminOrders(
  onData: (orders: OrderDoc[]) => void,
  onError: (err: unknown) => void,
  maxDocs = 250
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.ORDERS), limit(maxDocs));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => deserializeAdminOrder(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.ORDERS);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeAllCustomers(
  onData: (customers: CustomerRecordDoc[]) => void,
  onError: (err: unknown) => void,
  maxDocs = 250
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.USERS), limit(maxDocs));
  return onSnapshot(
    q,
    (snap) => {
      const items: CustomerRecordDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawStatus = String(data.accountStatus || 'active');
          const accountStatus: CustomerAccountStatus =
            rawStatus === 'suspended' || rawStatus === 'flagged' ? rawStatus : 'active';
          return {
            uid: String(data.uid || d.id),
            displayName: String(data.displayName || 'Fashion World Customer'),
            email: String(data.email || ''),
            phone: String(data.phone || ''),
            photoURL: String(data.photoURL || ''),
            role: String(data.role || 'customer'),
            accountStatus,
            supportNotes: Array.isArray(data.supportNotes)
              ? (data.supportNotes as CustomerSupportNote[])
              : [],
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.USERS);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeAllCoupons(
  onData: (coupons: CouponDoc[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.COUPONS), limit(150));
  return onSnapshot(
    q,
    (snap) => {
      const items: CouponDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            code: String(data.code || d.id).toUpperCase(),
            type: data.type === 'fixed' ? 'fixed' : 'percentage',
            value: Number(data.value || 0),
            minOrderValue: Number(data.minOrderValue || 0),
            maxDiscount: Number(data.maxDiscount || 0),
            startDate: timestampToIso(data.startDate),
            expiryDate: timestampToIso(data.expiryDate),
            usageLimit: Math.floor(Number(data.usageLimit || 0)),
            usedCount: Math.floor(Number(data.usedCount || 0)),
            active: Boolean(data.active),
            description: String(data.description || ''),
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt),
          };
        })
        .sort((a, b) => a.code.localeCompare(b.code));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.COUPONS);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeStaffMembers(
  onData: (staff: StaffMemberDoc[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.ADMINS), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const items: StaffMemberDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawRole = String(data.role || 'staff');
          return {
            uid: String(data.uid || d.id),
            email: String(data.email || ''),
            displayName: String(data.displayName || data.email || d.id),
            role: isStaffRole(rawRole) ? rawRole : 'staff',
            active: Boolean(data.active),
            permissions: Array.isArray(data.permissions)
              ? (data.permissions as AdminPermission[])
              : undefined,
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt),
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.ADMINS);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeInventoryHistory(
  onData: (movements: InventoryMovementDoc[]) => void,
  onError: (err: unknown) => void,
  maxDocs = 200
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.INVENTORY_HISTORY), limit(maxDocs));
  return onSnapshot(
    q,
    (snap) => {
      const items: InventoryMovementDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawRole = String(data.actorRole || 'staff');
          return {
            movementId: String(data.movementId || d.id),
            productId: String(data.productId || ''),
            productName: String(data.productName || ''),
            variantId: String(data.variantId || ''),
            variantSku: String(data.variantSku || data.sku || ''),
            colour: String(data.colour || ''),
            size: String(data.size || ''),
            previousStock: Number(data.previousStock || 0),
            delta: Number(data.delta || 0),
            newStock: Number(data.newStock || 0),
            movementType: (data.movementType || 'manual_adjustment') as InventoryMovementDoc['movementType'],
            reason: String(data.reason || ''),
            actorUid: String(data.actorUid || ''),
            actorName: String(data.actorName || data.actorEmail || 'Staff'),
            actorRole: isStaffRole(rawRole) ? rawRole : 'staff',
            createdAt: timestampToIso(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.INVENTORY_HISTORY);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeActivityLogs(
  onData: (logs: ActivityLogDoc[]) => void,
  onError: (err: unknown) => void,
  maxDocs = 200
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.ACTIVITY_LOGS), limit(maxDocs));
  return onSnapshot(
    q,
    (snap) => {
      const items: ActivityLogDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawRole = String(data.actorRole || 'staff');
          return {
            logId: String(data.logId || d.id),
            actorUid: String(data.actorUid || ''),
            actorEmail: String(data.actorEmail || ''),
            actorName: String(data.actorName || data.actorEmail || 'Staff'),
            actorRole: isStaffRole(rawRole) ? rawRole : 'staff',
            action: String(data.action || 'Product Updated') as ActivityLogDoc['action'],
            entityType: String(data.entityType || 'system'),
            entityId: String(data.entityId || ''),
            summary: String(data.summary || ''),
            createdAt: timestampToIso(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.ACTIVITY_LOGS);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeAdminNotifications(
  onData: (notifications: AdminNotificationDoc[]) => void,
  onError: (err: unknown) => void,
  maxDocs = 100
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.ADMIN_NOTIFICATIONS), limit(maxDocs));
  return onSnapshot(
    q,
    (snap) => {
      const items: AdminNotificationDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            notificationId: String(data.notificationId || d.id),
            type: (data.type || 'new_order') as AdminNotificationDoc['type'],
            severity: (data.severity || 'info') as AdminNotificationDoc['severity'],
            title: String(data.title || 'Store Alert'),
            message: String(data.message || ''),
            entityId: String(data.entityId || ''),
            readBy: Array.isArray(data.readBy)
              ? (data.readBy.filter((x): x is string => typeof x === 'string'))
              : [],
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt || data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.ADMIN_NOTIFICATIONS);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function markAdminNotificationRead(
  notificationId: string,
  uid: string
): Promise<void> {
  if (!db || !uid) return;
  const path = `${ADMIN_COLLECTIONS.ADMIN_NOTIFICATIONS}/${notificationId}`;
  try {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.ADMIN_NOTIFICATIONS, notificationId), {
      readBy: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeShowroomSections(
  onData: (sections: ShowroomSectionConfigDoc[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, ADMIN_COLLECTIONS.SHOWROOM), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const items: ShowroomSectionConfigDoc[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          sectionId: String(data.sectionId || d.id),
          title: String(data.title || d.id),
          lightingPreset: (data.lightingPreset || 'warm_luxury') as ShowroomSectionConfigDoc['lightingPreset'],
          featuredProductIds: Array.isArray(data.featuredProductIds)
            ? (data.featuredProductIds as string[])
            : [],
          active: data.active !== false,
          updatedAt: timestampToIso(data.updatedAt),
        };
      });
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, ADMIN_COLLECTIONS.SHOWROOM);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function saveShowroomSectionConfig(
  section: Omit<ShowroomSectionConfigDoc, 'updatedAt'>,
  isExisting: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${ADMIN_COLLECTIONS.SHOWROOM}/${section.id}`;
  try {
    const ref = doc(db, ADMIN_COLLECTIONS.SHOWROOM, section.id);
    const payload = {
      id: section.id,
      sectionId: section.sectionId,
      title: section.title.slice(0, 120),
      lightingPreset: section.lightingPreset,
      featuredProductIds: section.featuredProductIds.slice(0, 40),
      active: Boolean(section.active),
    };
    if (isExisting) {
      const { id: _ignore, ...mutable } = payload;
      void _ignore;
      await updateDoc(ref, {
        ...mutable,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
