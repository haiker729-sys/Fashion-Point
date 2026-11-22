import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { ASSETS } from '../data/catalog';
import {
  type CartItemDoc,
  type CouponDoc,
  type DeliveryAddressInput,
  type DeliveryMethod,
  type OrderDoc,
  type OrderItemSnapshot,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type SavedAddressDoc,
} from '../types/commerce';
import type { ProductVariant } from '../types/catalog';
import { sanitizeText } from '../utils/catalogHelpers';
import {
  buildCartItemId,
  buildOrderIdFromIdempotencyKey,
  calculateCheckoutTotals,
  findMatchingVariant,
  normalizeCouponCode,
  validateCouponRecord,
  validateDeliveryAddress,
} from '../utils/commerceHelpers';
import { db } from './firebaseConfig';
import { OperationType, handleFirestoreError } from './firebaseErrors';
import { COLLECTIONS } from './firestore';

export const COMMERCE_COLLECTIONS = {
  CART: 'cart',
  SAVED_FOR_LATER: 'savedForLater',
  ADDRESSES: 'addresses',
  COUPONS: 'coupons',
  ORDERS: 'orders',
} as const;

function timestampToIso(value: unknown): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date().toISOString();
}

function safeImageUrl(url?: string): string {
  if (!url || url.startsWith('data:')) return ASSETS.navyShirt;
  return url.slice(0, 1024);
}

function deserializeCartItem(docId: string, data: Record<string, unknown>): CartItemDoc {
  return {
    id: String(data.id || docId),
    productId: String(data.productId || ''),
    productName: String(data.productName || 'Fashion World Garment'),
    productImage: safeImageUrl(String(data.productImage || '')),
    sku: String(data.sku || docId.toUpperCase()),
    selectedSize: String(data.selectedSize || 'M'),
    selectedColour: String(data.selectedColour || 'Classic'),
    quantity: Math.max(1, Math.min(50, Math.floor(Number(data.quantity) || 1))),
    priceSnapshot: Math.max(1, Math.round(Number(data.priceSnapshot) || 1)),
    addedAt: timestampToIso(data.addedAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function deserializeAddress(docId: string, data: Record<string, unknown>): SavedAddressDoc {
  return {
    id: String(data.id || docId),
    fullName: String(data.fullName || ''),
    mobile: String(data.mobile || ''),
    email: String(data.email || ''),
    houseFlat: String(data.houseFlat || ''),
    streetArea: String(data.streetArea || ''),
    landmark: String(data.landmark || ''),
    city: String(data.city || ''),
    state: String(data.state || ''),
    pinCode: String(data.pinCode || ''),
    deliveryInstructions: String(data.deliveryInstructions || ''),
    isDefault: Boolean(data.isDefault),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function deserializeCoupon(docId: string, data: Record<string, unknown>): CouponDoc {
  return {
    code: String(data.code || docId).toUpperCase(),
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
}

function deserializeOrder(docId: string, data: Record<string, unknown>): OrderDoc {
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
      ? (data.statusHistory as OrderDoc['statusHistory'])
      : undefined,
    internalNotes: Array.isArray(data.internalNotes)
      ? (data.internalNotes as OrderDoc['internalNotes'])
      : undefined,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

/* -------------------------------------------------------------------------- */
/* REAL-TIME ONSNAPSHOT SUBSCRIPTIONS                                         */
/* -------------------------------------------------------------------------- */

export function subscribeUserCart(
  uid: string,
  onData: (items: CartItemDoc[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db || !uid) return () => {};
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.CART}`;
  const q = query(collection(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.CART), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => deserializeCartItem(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeSavedForLater(
  uid: string,
  onData: (items: CartItemDoc[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db || !uid) return () => {};
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.SAVED_FOR_LATER}`;
  const q = query(
    collection(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.SAVED_FOR_LATER),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => deserializeCartItem(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeUserAddresses(
  uid: string,
  onData: (addresses: SavedAddressDoc[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db || !uid) return () => {};
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.ADDRESSES}`;
  const q = query(collection(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.ADDRESSES), limit(25));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => deserializeAddress(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeCustomerOrders(
  uid: string,
  onData: (orders: OrderDoc[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db || !uid) return () => {};
  const path = COMMERCE_COLLECTIONS.ORDERS;
  const q = query(
    collection(db, COMMERCE_COLLECTIONS.ORDERS),
    where('customerUid', '==', uid),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => deserializeOrder(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeAdminOrdersSummary(
  isAdmin: boolean,
  onData: (summary: { totalOrders: number; totalRevenue: number; pendingCount: number }) => void
): Unsubscribe {
  if (!db || !isAdmin) return () => {};
  const q = query(collection(db, COMMERCE_COLLECTIONS.ORDERS), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      let totalRevenue = 0;
      let pendingCount = 0;
      for (const d of snapshot.docs) {
        const data = d.data() as Record<string, unknown>;
        totalRevenue += Number(data.totalAmount || 0);
        if (data.orderStatus === 'Pending') pendingCount += 1;
      }
      onData({
        totalOrders: snapshot.size,
        totalRevenue,
        pendingCount,
      });
    },
    () => {
      // Non-fatal for dashboard preview if admin is switching roles
    }
  );
}

/* -------------------------------------------------------------------------- */
/* CART & SAVED-FOR-LATER MUTATIONS                                           */
/* -------------------------------------------------------------------------- */

export interface CartUpsertInput {
  productId: string;
  productName: string;
  productImage: string;
  sku: string;
  selectedSize: string;
  selectedColour: string;
  quantityToAdd: number;
  priceSnapshot: number;
  maxStock: number;
}

export async function upsertCartItemInFirestore(
  uid: string,
  input: CartUpsertInput
): Promise<{ finalQuantity: number; capped: boolean; itemId: string }> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const itemId = buildCartItemId(input.productId, input.selectedSize, input.selectedColour);
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.CART}/${itemId}`;
  const ref = doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.CART, itemId);
  const hardMax = Math.max(1, Math.min(50, Math.floor(input.maxStock || 1)));

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const currentQty = Math.floor(Number((snap.data() as { quantity?: number }).quantity) || 1);
      const desired = currentQty + Math.max(1, Math.floor(input.quantityToAdd));
      const finalQuantity = Math.max(1, Math.min(hardMax, desired));
      await updateDoc(ref, {
        quantity: finalQuantity,
        priceSnapshot: Math.max(1, Math.round(input.priceSnapshot)),
        productName: sanitizeText(input.productName).slice(0, 140),
        productImage: safeImageUrl(input.productImage),
        sku: sanitizeText(input.sku).toUpperCase().slice(0, 64),
        updatedAt: serverTimestamp(),
      });
      return { finalQuantity, capped: desired > hardMax, itemId };
    }

    const desired = Math.max(1, Math.floor(input.quantityToAdd));
    const finalQuantity = Math.max(1, Math.min(hardMax, desired));
    await setDoc(ref, {
      id: itemId,
      productId: input.productId.slice(0, 128),
      productName: sanitizeText(input.productName).slice(0, 140),
      productImage: safeImageUrl(input.productImage),
      sku: sanitizeText(input.sku).toUpperCase().slice(0, 64),
      selectedSize: sanitizeText(input.selectedSize).slice(0, 32),
      selectedColour: sanitizeText(input.selectedColour).slice(0, 60),
      quantity: finalQuantity,
      priceSnapshot: Math.max(1, Math.round(input.priceSnapshot)),
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { finalQuantity, capped: desired > hardMax, itemId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCartItemQtyInFirestore(
  uid: string,
  itemId: string,
  nextQuantity: number,
  priceSnapshot: number
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.CART}/${itemId}`;
  const ref = doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.CART, itemId);
  try {
    if (nextQuantity <= 0) {
      await deleteDoc(ref);
      return;
    }
    await updateDoc(ref, {
      quantity: Math.max(1, Math.min(50, Math.floor(nextQuantity))),
      priceSnapshot: Math.max(1, Math.round(priceSnapshot)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCartItemFromFirestore(uid: string, itemId: string): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.CART}/${itemId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.CART, itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearUserCartInFirestore(uid: string, itemIds: string[]): Promise<void> {
  if (!db || itemIds.length === 0) return;
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.CART}`;
  try {
    const batch = writeBatch(db);
    for (const id of itemIds) {
      batch.delete(doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.CART, id));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function moveCartItemToSavedForLater(uid: string, item: CartItemDoc): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const savedRef = doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.SAVED_FOR_LATER, item.id);
  const cartRef = doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.CART, item.id);
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.SAVED_FOR_LATER}/${item.id}`;
  try {
    const existingSaved = await getDoc(savedRef);
    const batch = writeBatch(db);
    if (existingSaved.exists()) {
      batch.update(savedRef, {
        quantity: Math.max(1, Math.min(50, item.quantity)),
        priceSnapshot: Math.max(1, Math.round(item.priceSnapshot)),
        productName: sanitizeText(item.productName).slice(0, 140),
        productImage: safeImageUrl(item.productImage),
        sku: sanitizeText(item.sku).toUpperCase().slice(0, 64),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(savedRef, {
        id: item.id,
        productId: item.productId.slice(0, 128),
        productName: sanitizeText(item.productName).slice(0, 140),
        productImage: safeImageUrl(item.productImage),
        sku: sanitizeText(item.sku).toUpperCase().slice(0, 64),
        selectedSize: sanitizeText(item.selectedSize).slice(0, 32),
        selectedColour: sanitizeText(item.selectedColour).slice(0, 60),
        quantity: Math.max(1, Math.min(50, item.quantity)),
        priceSnapshot: Math.max(1, Math.round(item.priceSnapshot)),
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    batch.delete(cartRef);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function moveSavedItemToCart(
  uid: string,
  item: CartItemDoc,
  maxStock: number
): Promise<{ finalQuantity: number; capped: boolean }> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const result = await upsertCartItemInFirestore(uid, {
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage,
    sku: item.sku,
    selectedSize: item.selectedSize,
    selectedColour: item.selectedColour,
    quantityToAdd: item.quantity,
    priceSnapshot: item.priceSnapshot,
    maxStock,
  });
  await deleteSavedForLaterItem(uid, item.id);
  return { finalQuantity: result.finalQuantity, capped: result.capped };
}

export async function deleteSavedForLaterItem(uid: string, itemId: string): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.SAVED_FOR_LATER}/${itemId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.SAVED_FOR_LATER, itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function mergeGuestCartIntoFirestore(
  uid: string,
  guestItems: CartUpsertInput[]
): Promise<void> {
  if (!db || guestItems.length === 0) return;
  for (const item of guestItems) {
    try {
      await upsertCartItemInFirestore(uid, item);
    } catch {
      // Continue merging remaining items
    }
  }
}

/* -------------------------------------------------------------------------- */
/* SAVED ADDRESSES CRUD                                                       */
/* -------------------------------------------------------------------------- */

export async function saveUserAddressInFirestore(
  uid: string,
  input: DeliveryAddressInput,
  options?: { addressId?: string; isDefault?: boolean; existingAddressIds?: string[] }
): Promise<SavedAddressDoc> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const { isValid, errors, sanitized } = validateDeliveryAddress(input);
  if (!isValid) {
    const firstError = Object.values(errors)[0] || 'Please check the delivery address details.';
    throw new Error(firstError);
  }

  const isUpdate = Boolean(options?.addressId);
  const addressId =
    options?.addressId ||
    `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const isDefault = Boolean(options?.isDefault);
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.ADDRESSES}/${addressId}`;
  const ref = doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.ADDRESSES, addressId);

  try {
    if (isDefault && options?.existingAddressIds && options.existingAddressIds.length > 0) {
      const batch = writeBatch(db);
      for (const existingId of options.existingAddressIds) {
        if (existingId !== addressId) {
          batch.update(
            doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.ADDRESSES, existingId),
            { isDefault: false, updatedAt: serverTimestamp() }
          );
        }
      }
      if (isUpdate) {
        batch.update(ref, {
          ...sanitized,
          isDefault,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          id: addressId,
          ...sanitized,
          isDefault,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } else if (isUpdate) {
      await updateDoc(ref, {
        ...sanitized,
        isDefault,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: addressId,
        ...sanitized,
        isDefault,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const nowIso = new Date().toISOString();
    return {
      id: addressId,
      ...sanitized,
      isDefault,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserAddressInFirestore(uid: string, addressId: string): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.ADDRESSES}/${addressId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.ADDRESSES, addressId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function setDefaultAddressInFirestore(
  uid: string,
  targetId: string,
  allIds: string[]
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const path = `${COLLECTIONS.USERS}/${uid}/${COMMERCE_COLLECTIONS.ADDRESSES}/${targetId}`;
  try {
    const batch = writeBatch(db);
    for (const id of allIds) {
      batch.update(doc(db, COLLECTIONS.USERS, uid, COMMERCE_COLLECTIONS.ADDRESSES, id), {
        isDefault: id === targetId,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/* -------------------------------------------------------------------------- */
/* COUPONS LOOKUP & ADMIN SAMPLE SEED                                         */
/* -------------------------------------------------------------------------- */

export async function fetchCouponByCode(rawCode: string): Promise<CouponDoc | null> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const code = normalizeCouponCode(rawCode);
  if (code.length < 3) return null;
  const path = `${COMMERCE_COLLECTIONS.COUPONS}/${code}`;
  try {
    const snap = await getDoc(doc(db, COMMERCE_COLLECTIONS.COUPONS, code));
    if (!snap.exists()) return null;
    return deserializeCoupon(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Admin-only helper to seed verified sample coupons in Firestore (`JUMMO10`, `FESTIVE500`)
 * so real Firestore coupon validation & checkout calculations can be tested immediately.
 */
export async function seedSampleCouponsInFirestore(): Promise<{ created: string[]; skipped: string[] }> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const now = new Date();
  const start = Timestamp.fromDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const expiry = Timestamp.fromDate(new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000));

  const samples = [
    {
      code: 'JUMMO10',
      type: 'percentage' as const,
      value: 10,
      minOrderValue: 999,
      maxDiscount: 500,
      startDate: start,
      expiryDate: expiry,
      usageLimit: 500,
      usedCount: 0,
      active: true,
      description: '10% off on orders ₹999+ (max ₹500 savings)',
    },
    {
      code: 'FESTIVE500',
      type: 'fixed' as const,
      value: 500,
      minOrderValue: 2999,
      maxDiscount: 500,
      startDate: start,
      expiryDate: expiry,
      usageLimit: 250,
      usedCount: 0,
      active: true,
      description: 'Flat ₹500 off on festive orders ₹2,999+',
    },
  ];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const c of samples) {
    const ref = doc(db, COMMERCE_COLLECTIONS.COUPONS, c.code);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      skipped.push(c.code);
      continue;
    }
    try {
      await setDoc(ref, {
        ...c,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created.push(c.code);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${COMMERCE_COLLECTIONS.COUPONS}/${c.code}`);
    }
  }

  return { created, skipped };
}

/* -------------------------------------------------------------------------- */
/* ATOMIC SECURE ORDER CREATION (FIRESTORE TRANSACTION)                       */
/* -------------------------------------------------------------------------- */

export interface PlaceOrderParams {
  uid: string;
  cartItems: CartItemDoc[];
  deliveryAddress: DeliveryAddressInput;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  idempotencyKey: string;
}

/**
 * Executes an atomic Firestore `runTransaction()` that:
 * 1. Verifies idempotency (returns existing order if already committed for this attempt).
 * 2. Reads EVERY live `products/{productId}` document from Firestore before writing.
 * 3. Verifies product status === 'published', variant exists, and live stock >= quantity.
 * 4. Recalculates all unit prices & subtotals directly from Firestore (ignoring browser prices).
 * 5. Reads & validates `coupons/{couponCode}` inside the transaction if applied.
 * 6. Writes immutable `orders/{orderId}` with server timestamps & locked initial statuses.
 * 7. Clears purchased `users/{uid}/cart/{cartItemId}` documents atomically in the same transaction.
 */
export async function placeOrderWithTransaction(params: PlaceOrderParams): Promise<OrderDoc> {
  if (!db) {
    throw new Error('Cloud Firestore is not configured. Orders require a live database connection.');
  }
  if (!params.uid) {
    throw new Error('You must sign in to place an order.');
  }
  if (!params.cartItems || params.cartItems.length === 0) {
    throw new Error('Your shopping cart is empty.');
  }

  const { isValid, errors, sanitized: cleanAddress } = validateDeliveryAddress(params.deliveryAddress);
  if (!isValid) {
    const firstMsg = Object.values(errors)[0] || 'Please fix the highlighted delivery address fields.';
    throw new Error(firstMsg);
  }

  const firestore = db;
  const orderId = buildOrderIdFromIdempotencyKey(params.idempotencyKey);
  const orderRef = doc(firestore, COMMERCE_COLLECTIONS.ORDERS, orderId);
  const normalizedCoupon = params.couponCode ? normalizeCouponCode(params.couponCode) : '';

  try {
    const committedOrder = await runTransaction(firestore, async (tx) => {
      // 1. Idempotency guard: if this exact checkout attempt already succeeded, return it
      const existingOrderSnap = await tx.get(orderRef);
      if (existingOrderSnap.exists()) {
        return deserializeOrder(
          existingOrderSnap.id,
          existingOrderSnap.data() as Record<string, unknown>
        );
      }

      // 2. Read ALL unique Firestore product documents BEFORE any writes
      const uniqueProductIds = Array.from(new Set(params.cartItems.map((i) => i.productId)));
      const productDocs = new Map<string, Record<string, unknown>>();

      for (const productId of uniqueProductIds) {
        const prodRef = doc(firestore, COLLECTIONS.PRODUCTS, productId);
        const prodSnap = await tx.get(prodRef);
        if (!prodSnap.exists()) {
          throw new Error(
            `Product "${productId}" is not synced to Cloud Firestore yet. Please run "Migrate Local Catalog to Firestore" in the Admin Dashboard before placing orders.`
          );
        }
        productDocs.set(productId, prodSnap.data() as Record<string, unknown>);
      }

      // 3. Read coupon document if requested (still before any writes)
      let verifiedCoupon: CouponDoc | null = null;
      if (normalizedCoupon.length >= 3) {
        const couponRef = doc(firestore, COMMERCE_COLLECTIONS.COUPONS, normalizedCoupon);
        const couponSnap = await tx.get(couponRef);
        if (!couponSnap.exists()) {
          throw new Error(`Coupon "${normalizedCoupon}" is no longer available.`);
        }
        verifiedCoupon = deserializeCoupon(
          couponSnap.id,
          couponSnap.data() as Record<string, unknown>
        );
      }

      // 4. Validate every cart item against live Firestore product & variant stock,
      //    and recalculate authoritative INR unit prices directly from Firestore.
      const orderItems: OrderItemSnapshot[] = [];
      const pricingInputs: Array<{ unitPrice: number; originalPrice: number; quantity: number }> = [];

      for (const cartItem of params.cartItems) {
        const prodData = productDocs.get(cartItem.productId);
        if (!prodData) {
          throw new Error(`Unable to verify "${cartItem.productName}" in Firestore.`);
        }

        if (prodData.status !== 'published') {
          throw new Error(`"${cartItem.productName}" is no longer available for purchase.`);
        }

        const variants = Array.isArray(prodData.variants)
          ? (prodData.variants as ProductVariant[])
          : [];
        const matchedVariant = findMatchingVariant(
          variants,
          cartItem.selectedSize,
          cartItem.selectedColour
        );

        if (!matchedVariant) {
          throw new Error(
            `Selected variant (${cartItem.selectedSize} / ${cartItem.selectedColour}) for "${cartItem.productName}" is no longer available.`
          );
        }

        const requestedQty = Math.max(1, Math.min(50, Math.floor(cartItem.quantity)));
        if (matchedVariant.stockQuantity < requestedQty) {
          throw new Error(
            matchedVariant.stockQuantity === 0
              ? `"${cartItem.productName}" (${cartItem.selectedSize} / ${cartItem.selectedColour}) is out of stock.`
              : `Only ${matchedVariant.stockQuantity} unit(s) left for "${cartItem.productName}" (${cartItem.selectedSize} / ${cartItem.selectedColour}). Please adjust quantity.`
          );
        }

        const salePrice = Number(prodData.salePrice || 0);
        const sellingPrice = Number(prodData.sellingPrice || 0);
        const originalPrice = Number(prodData.originalPrice || sellingPrice);
        const unitPrice = Math.max(
          1,
          Math.round(salePrice > 0 && salePrice < sellingPrice ? salePrice : sellingPrice)
        );
        const lineTotal = unitPrice * requestedQty;

        const images = Array.isArray(prodData.images)
          ? (prodData.images as Array<{ url?: string; isMain?: boolean }>)
          : [];
        const mainImg = images.find((im) => im.isMain)?.url || images[0]?.url || cartItem.productImage;

        orderItems.push({
          productId: cartItem.productId.slice(0, 128),
          productName: sanitizeText(String(prodData.name || cartItem.productName)).slice(0, 140),
          productImage: safeImageUrl(mainImg),
          sku: sanitizeText(matchedVariant.sku || String(prodData.sku || cartItem.sku))
            .toUpperCase()
            .slice(0, 64),
          selectedSize: sanitizeText(matchedVariant.size).slice(0, 32),
          selectedColour: sanitizeText(matchedVariant.colour).slice(0, 60),
          quantity: requestedQty,
          unitPrice,
          lineTotal,
        });

        pricingInputs.push({
          unitPrice,
          originalPrice: Math.max(unitPrice, Math.round(originalPrice)),
          quantity: requestedQty,
        });
      }

      // 5. Re-validate coupon against recalculated subtotal
      const subtotalOnly = pricingInputs.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      if (verifiedCoupon) {
        const couponCheck = validateCouponRecord(verifiedCoupon, subtotalOnly);
        if (!couponCheck.valid) {
          throw new Error(couponCheck.message);
        }
      }

      // 6. Calculate final trusted INR breakdown (exact match to firestore.rules)
      const breakdown = calculateCheckoutTotals({
        items: pricingInputs,
        deliveryMethod: params.deliveryMethod,
        coupon: verifiedCoupon,
      });

      const paymentStatus: PaymentStatus =
        params.paymentMethod === 'cod' ? 'COD Pending' : 'Pending';
      const orderStatus: OrderStatus = 'Pending';

      // 7. Write immutable order document
      const orderPayload = {
        orderId,
        customerUid: params.uid,
        customerName: cleanAddress.fullName,
        customerEmail: cleanAddress.email,
        customerPhone: cleanAddress.mobile,
        items: orderItems,
        deliveryAddress: cleanAddress,
        deliveryMethod: params.deliveryMethod,
        subtotal: breakdown.subtotal,
        catalogSavings: breakdown.catalogSavings,
        discount: breakdown.couponDiscount,
        couponCode: breakdown.couponCode,
        deliveryCharge: breakdown.deliveryCharge,
        tax: breakdown.tax,
        totalAmount: breakdown.totalAmount,
        currency: 'INR' as const,
        paymentMethod: params.paymentMethod,
        paymentStatus,
        orderStatus,
        idempotencyKey: params.idempotencyKey.slice(0, 128),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      tx.set(orderRef, orderPayload);

      // 8. Clear purchased cart documents atomically inside the SAME transaction
      for (const cartItem of params.cartItems) {
        const cartRef = doc(db!, COLLECTIONS.USERS, params.uid, COMMERCE_COLLECTIONS.CART, cartItem.id);
        tx.delete(cartRef);
      }

      const nowIso = new Date().toISOString();
      return {
        ...orderPayload,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    return committedOrder;
  } catch (error) {
    // Re-throw business/validation errors cleanly while wrapping Firestore permission/system errors
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `${COMMERCE_COLLECTIONS.ORDERS}/${orderId}`);
  }
}

export async function fetchOrderById(orderId: string): Promise<OrderDoc | null> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const cleanId = orderId.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cleanId)) return null;
  const path = `${COMMERCE_COLLECTIONS.ORDERS}/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, COMMERCE_COLLECTIONS.ORDERS, cleanId));
    if (!snap.exists()) return null;
    return deserializeOrder(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
