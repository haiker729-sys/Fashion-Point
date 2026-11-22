import type { ResolvedCatalogProduct, CatalogCategory } from '../types/catalog';
import type { OrderDoc, PaymentStatus } from '../types/commerce';
import type { PaymentRecordDoc, RefundRecordDoc } from '../types/payment';
import type {
  AdminNotificationDoc,
  AnalyticsDatePreset,
  AnalyticsGranularity,
  CustomerRecordDoc,
} from '../types/admin';

/**
 * Consistent store reporting timezone: India Standard Time (Asia/Kolkata, UTC+05:30).
 * Every date range filter, Today/Yesterday/Monthly boundary, and chart bucket uses IST.
 */
export const REPORTING_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const COLLECTED_ONLINE_PAYMENT_STATUSES: PaymentStatus[] = [
  'Paid',
  'Payment Captured',
  'Payment Verified',
  'Partially Refunded',
  'Refunded',
];

export const FAILED_PAYMENT_STATUSES: PaymentStatus[] = [
  'Failed',
  'Payment Failed',
  'Invalid Signature',
  'Payment Verification Failed',
];

export const PENDING_PAYMENT_STATUSES: PaymentStatus[] = [
  'Pending',
  'Payment Processing',
  'Payment Authorized',
  'Verification Pending',
];

export interface DateRangeWindow {
  startMs: number;
  endMs: number;
  label: string;
  startDateIso: string; // YYYY-MM-DD in IST
  endDateIso: string;   // YYYY-MM-DD in IST
}

/** Formats a UTC timestamp ms into YYYY-MM-DD in Asia/Kolkata (IST). */
export function toIstDateKey(ms: number): string {
  const ist = new Date(ms + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses YYYY-MM-DD in IST into exact UTC millisecond start (00:00:00.000 IST) and end (23:59:59.999 IST). */
export function parseIstDayBounds(dateKey: string): { startMs: number; endMs: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) {
    const fallback = toIstDateKey(Date.now());
    return parseIstDayBounds(fallback);
  }
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endUtcMs = Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS;
  return { startMs: startUtcMs, endMs: endUtcMs };
}

export function resolveDateRangeWindow(
  preset: AnalyticsDatePreset,
  customStart?: string,
  customEnd?: string,
  nowMs: number = Date.now()
): DateRangeWindow {
  const todayKey = toIstDateKey(nowMs);
  const istNow = new Date(nowMs + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth(); // 0..11

  if (preset === 'today') {
    const b = parseIstDayBounds(todayKey);
    return { ...b, label: 'Today (IST)', startDateIso: todayKey, endDateIso: todayKey };
  }

  if (preset === 'yesterday') {
    const yKey = toIstDateKey(nowMs - 24 * 60 * 60 * 1000);
    const b = parseIstDayBounds(yKey);
    return { ...b, label: 'Yesterday (IST)', startDateIso: yKey, endDateIso: yKey };
  }

  if (preset === 'last_7_days') {
    const startKey = toIstDateKey(nowMs - 6 * 24 * 60 * 60 * 1000);
    const startB = parseIstDayBounds(startKey);
    const endB = parseIstDayBounds(todayKey);
    return {
      startMs: startB.startMs,
      endMs: endB.endMs,
      label: 'Last 7 Days (IST)',
      startDateIso: startKey,
      endDateIso: todayKey,
    };
  }

  if (preset === 'last_30_days') {
    const startKey = toIstDateKey(nowMs - 29 * 24 * 60 * 60 * 1000);
    const startB = parseIstDayBounds(startKey);
    const endB = parseIstDayBounds(todayKey);
    return {
      startMs: startB.startMs,
      endMs: endB.endMs,
      label: 'Last 30 Days (IST)',
      startDateIso: startKey,
      endDateIso: todayKey,
    };
  }

  if (preset === 'this_month') {
    const startKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const startB = parseIstDayBounds(startKey);
    const endB = parseIstDayBounds(todayKey);
    return {
      startMs: startB.startMs,
      endMs: endB.endMs,
      label: 'This Month (IST)',
      startDateIso: startKey,
      endDateIso: todayKey,
    };
  }

  if (preset === 'last_month') {
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const lastDayPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonthIdx + 1, 0)).getUTCDate();
    const startKey = `${prevMonthYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-01`;
    const endKey = `${prevMonthYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(
      lastDayPrevMonth
    ).padStart(2, '0')}`;
    const startB = parseIstDayBounds(startKey);
    const endB = parseIstDayBounds(endKey);
    return {
      startMs: startB.startMs,
      endMs: endB.endMs,
      label: 'Last Month (IST)',
      startDateIso: startKey,
      endDateIso: endKey,
    };
  }

  // Custom date range
  const safeStart = customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : todayKey;
  const safeEnd = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : todayKey;
  const orderedStart = safeStart <= safeEnd ? safeStart : safeEnd;
  const orderedEnd = safeStart <= safeEnd ? safeEnd : safeStart;
  const startB = parseIstDayBounds(orderedStart);
  const endB = parseIstDayBounds(orderedEnd);
  return {
    startMs: startB.startMs,
    endMs: endB.endMs,
    label: `${orderedStart} to ${orderedEnd} (IST)`,
    startDateIso: orderedStart,
    endDateIso: orderedEnd,
  };
}

export function isCollectedOrderRevenue(order: OrderDoc): {
  isCollectedOnline: boolean;
  isCollectedCod: boolean;
  isPendingCod: boolean;
} {
  if (order.paymentMethod === 'online') {
    const isCollectedOnline = COLLECTED_ONLINE_PAYMENT_STATUSES.includes(order.paymentStatus);
    return { isCollectedOnline, isCollectedCod: false, isPendingCod: false };
  }
  // COD is only counted as collected revenue once Delivered (or explicitly marked Paid)
  const isCollectedCod =
    order.orderStatus === 'Delivered' || order.paymentStatus === 'Paid';
  const isPendingCod =
    !isCollectedCod && order.orderStatus !== 'Cancelled';
  return { isCollectedOnline: false, isCollectedCod, isPendingCod };
}

export interface AdminOverviewMetrics {
  // Financial breakdown (never counts pending/failed as collected revenue)
  grossSales: number;
  collectedOnlineSales: number;
  collectedCodSales: number;
  pendingCodCollections: number;
  totalRefundsAmount: number;
  netRevenue: number;
  todayNetRevenue: number;
  monthlyNetRevenue: number;

  // Orders
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;

  // Payments (deduplicated)
  successfulPaymentsCount: number;
  failedPaymentsCount: number;
  pendingPaymentsCount: number;
  codOrdersCount: number;
  refundsCount: number;

  // Customers & Catalog Inventory
  totalCustomers: number;
  totalProducts: number;
  availableStockUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

/**
 * Computes exact, non-duplicated Overview KPIs strictly from live Firestore records.
 * Clearly distinguishes Gross Sales, Collected Online, Collected COD, Pending COD, Refunds, and Net Revenue.
 */
export function computeAdminOverviewMetrics(input: {
  orders: OrderDoc[];
  payments: PaymentRecordDoc[];
  refunds: RefundRecordDoc[];
  customers: CustomerRecordDoc[];
  products: ResolvedCatalogProduct[];
  nowMs?: number;
}): AdminOverviewMetrics {
  const nowMs = input.nowMs ?? Date.now();
  const todayWindow = resolveDateRangeWindow('today', undefined, undefined, nowMs);
  const monthWindow = resolveDateRangeWindow('this_month', undefined, undefined, nowMs);

  // Deduplicate orders by orderId
  const orderMap = new Map<string, OrderDoc>();
  for (const o of input.orders) {
    if (o.orderId) orderMap.set(o.orderId, o);
  }
  const orders = Array.from(orderMap.values());

  // Deduplicate refunds by refundId
  const refundMap = new Map<string, RefundRecordDoc>();
  for (const r of input.refunds) {
    if (r.refundId) refundMap.set(r.refundId, r);
  }
  const refunds = Array.from(refundMap.values()).filter((r) => r.refundStatus !== 'Failed');

  let collectedOnlineSales = 0;
  let collectedCodSales = 0;
  let pendingCodCollections = 0;
  let todayGross = 0;
  let monthlyGross = 0;

  let pendingOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  let codOrdersCount = 0;

  for (const order of orders) {
    const createdMs = Date.parse(order.createdAt) || 0;
    const rev = isCollectedOrderRevenue(order);
    const collectedAmt = rev.isCollectedOnline || rev.isCollectedCod ? order.totalAmount : 0;

    if (rev.isCollectedOnline) collectedOnlineSales += order.totalAmount;
    if (rev.isCollectedCod) collectedCodSales += order.totalAmount;
    if (rev.isPendingCod) pendingCodCollections += order.totalAmount;

    if (collectedAmt > 0) {
      if (createdMs >= todayWindow.startMs && createdMs <= todayWindow.endMs) {
        todayGross += collectedAmt;
      }
      if (createdMs >= monthWindow.startMs && createdMs <= monthWindow.endMs) {
        monthlyGross += collectedAmt;
      }
    }

    if (order.orderStatus === 'Pending') pendingOrders += 1;
    if (order.orderStatus === 'Delivered') deliveredOrders += 1;
    if (order.orderStatus === 'Cancelled') cancelledOrders += 1;
    if (order.paymentMethod === 'cod') codOrdersCount += 1;
  }

  let totalRefundsAmount = 0;
  let todayRefunds = 0;
  let monthlyRefunds = 0;
  for (const r of refunds) {
    const rMs = Date.parse(r.createdAt) || 0;
    totalRefundsAmount += r.amount;
    if (rMs >= todayWindow.startMs && rMs <= todayWindow.endMs) todayRefunds += r.amount;
    if (rMs >= monthWindow.startMs && rMs <= monthWindow.endMs) monthlyRefunds += r.amount;
  }

  const grossSales = collectedOnlineSales + collectedCodSales;
  const netRevenue = Math.max(0, grossSales - totalRefundsAmount);
  const todayNetRevenue = Math.max(0, todayGross - todayRefunds);
  const monthlyNetRevenue = Math.max(0, monthlyGross - monthlyRefunds);

  // Payment counts: prefer verified `payments` records + reconcile online orders without payment docs yet
  const paymentByOrderId = new Map<string, PaymentRecordDoc>();
  for (const p of input.payments) {
    if (p.orderId) paymentByOrderId.set(p.orderId, p);
  }

  let successfulPaymentsCount = 0;
  let failedPaymentsCount = 0;
  let pendingPaymentsCount = 0;

  const countedOrderIds = new Set<string>();
  for (const p of input.payments) {
    countedOrderIds.add(p.orderId);
    if (COLLECTED_ONLINE_PAYMENT_STATUSES.includes(p.paymentStatus)) {
      successfulPaymentsCount += 1;
    } else if (FAILED_PAYMENT_STATUSES.includes(p.paymentStatus)) {
      failedPaymentsCount += 1;
    } else if (PENDING_PAYMENT_STATUSES.includes(p.paymentStatus)) {
      pendingPaymentsCount += 1;
    }
  }

  for (const o of orders) {
    if (o.paymentMethod !== 'online' || countedOrderIds.has(o.orderId)) continue;
    if (COLLECTED_ONLINE_PAYMENT_STATUSES.includes(o.paymentStatus)) {
      successfulPaymentsCount += 1;
    } else if (FAILED_PAYMENT_STATUSES.includes(o.paymentStatus)) {
      failedPaymentsCount += 1;
    } else if (PENDING_PAYMENT_STATUSES.includes(o.paymentStatus)) {
      pendingPaymentsCount += 1;
    }
  }

  // Unique customers: combine users collection + unique order customerUids
  const uniqueCustomerIds = new Set<string>();
  for (const c of input.customers) {
    if (c.uid && c.role === 'customer') uniqueCustomerIds.add(c.uid);
  }
  for (const o of orders) {
    if (o.customerUid) uniqueCustomerIds.add(o.customerUid);
  }

  let availableStockUnits = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;
  for (const p of input.products) {
    availableStockUnits += p.totalStock;
    if (p.stockStatus === 'low_stock') lowStockProducts += 1;
    if (p.stockStatus === 'out_of_stock') outOfStockProducts += 1;
  }

  return {
    grossSales,
    collectedOnlineSales,
    collectedCodSales,
    pendingCodCollections,
    totalRefundsAmount,
    netRevenue,
    todayNetRevenue,
    monthlyNetRevenue,
    totalOrders: orders.length,
    pendingOrders,
    deliveredOrders,
    cancelledOrders,
    successfulPaymentsCount,
    failedPaymentsCount,
    pendingPaymentsCount,
    codOrdersCount,
    refundsCount: refunds.length,
    totalCustomers: uniqueCustomerIds.size,
    totalProducts: input.products.length,
    availableStockUnits,
    lowStockProducts,
    outOfStockProducts,
  };
}

export interface AnalyticsChartPoint {
  bucketKey: string;
  label: string;
  revenue: number;
  orders: number;
  refunds: number;
}

export interface SalesAnalyticsResult {
  window: DateRangeWindow;
  series: AnalyticsChartPoint[];
  grossSales: number;
  refundsTotal: number;
  netRevenue: number;
  codCollected: number;
  onlineCollected: number;
  ordersInWindow: number;
  averageOrderValue: number;
  paymentSuccessRate: number; // 0..100
  orderCancellationRate: number; // 0..100
  bestSellingProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    unitsSold: number;
    revenue: number;
  }>;
  popularCategories: Array<{
    categoryId: string;
    categoryName: string;
    unitsSold: number;
    revenue: number;
  }>;
}

function getBucketForGranularity(ms: number, granularity: AnalyticsGranularity): { key: string; label: string } {
  const ist = new Date(ms + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (granularity === 'yearly') {
    return { key: String(y), label: String(y) };
  }
  if (granularity === 'monthly') {
    return {
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${monthNames[m]} ${String(y).slice(2)}`,
    };
  }
  if (granularity === 'weekly') {
    // ISO week start (Monday) in IST
    const dayOfWeek = (ist.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    const weekStartMs = Date.UTC(y, m, d - dayOfWeek);
    const ws = new Date(weekStartMs);
    const wKey = `${ws.getUTCFullYear()}-${String(ws.getUTCMonth() + 1).padStart(2, '0')}-${String(
      ws.getUTCDate()
    ).padStart(2, '0')}`;
    return {
      key: wKey,
      label: `Wk ${ws.getUTCDate()} ${monthNames[ws.getUTCMonth()]}`,
    };
  }
  // daily
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    label: `${d} ${monthNames[m]}`,
  };
}

export function computeSalesAnalytics(input: {
  orders: OrderDoc[];
  payments: PaymentRecordDoc[];
  refunds: RefundRecordDoc[];
  products: ResolvedCatalogProduct[];
  categories: CatalogCategory[];
  preset: AnalyticsDatePreset;
  granularity: AnalyticsGranularity;
  customStart?: string;
  customEnd?: string;
  nowMs?: number;
}): SalesAnalyticsResult {
  const window = resolveDateRangeWindow(
    input.preset,
    input.customStart,
    input.customEnd,
    input.nowMs
  );

  // Deduplicate orders and filter to date window
  const orderMap = new Map<string, OrderDoc>();
  for (const o of input.orders) {
    if (!o.orderId) continue;
    const ms = Date.parse(o.createdAt) || 0;
    if (ms >= window.startMs && ms <= window.endMs) {
      orderMap.set(o.orderId, o);
    }
  }
  const filteredOrders = Array.from(orderMap.values());

  // Deduplicate refunds in date window
  const refundMap = new Map<string, RefundRecordDoc>();
  for (const r of input.refunds) {
    if (!r.refundId || r.refundStatus === 'Failed') continue;
    const ms = Date.parse(r.createdAt) || 0;
    if (ms >= window.startMs && ms <= window.endMs) {
      refundMap.set(r.refundId, r);
    }
  }
  const filteredRefunds = Array.from(refundMap.values());

  // Pre-seed daily buckets for small ranges so charts always display continuous axes
  const bucketMap = new Map<string, AnalyticsChartPoint>();
  if (input.granularity === 'daily') {
    const daySpan = Math.min(
      62,
      Math.max(1, Math.round((window.endMs - window.startMs) / (24 * 60 * 60 * 1000)) + 1)
    );
    for (let i = 0; i < daySpan; i += 1) {
      const sampleMs = window.startMs + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000;
      const b = getBucketForGranularity(sampleMs, 'daily');
      bucketMap.set(b.key, { bucketKey: b.key, label: b.label, revenue: 0, orders: 0, refunds: 0 });
    }
  }

  let onlineCollected = 0;
  let codCollected = 0;
  let cancelledCount = 0;
  let onlineSuccess = 0;
  let onlineFailed = 0;

  const productById = new Map(input.products.map((p) => [p.id, p]));
  const categoryNameById = new Map(input.categories.map((c) => [c.id, c.name]));

  const bestProductAgg = new Map<
    string,
    { productId: string; name: string; sku: string; unitsSold: number; revenue: number }
  >();
  const categoryAgg = new Map<
    string,
    { categoryId: string; categoryName: string; unitsSold: number; revenue: number }
  >();

  for (const order of filteredOrders) {
    const ms = Date.parse(order.createdAt) || window.startMs;
    const b = getBucketForGranularity(ms, input.granularity);
    const point = bucketMap.get(b.key) || {
      bucketKey: b.key,
      label: b.label,
      revenue: 0,
      orders: 0,
      refunds: 0,
    };

    point.orders += 1;
    const rev = isCollectedOrderRevenue(order);
    if (rev.isCollectedOnline) {
      onlineCollected += order.totalAmount;
      point.revenue += order.totalAmount;
    } else if (rev.isCollectedCod) {
      codCollected += order.totalAmount;
      point.revenue += order.totalAmount;
    }
    bucketMap.set(b.key, point);

    if (order.orderStatus === 'Cancelled') {
      cancelledCount += 1;
    }

    if (order.paymentMethod === 'online') {
      if (COLLECTED_ONLINE_PAYMENT_STATUSES.includes(order.paymentStatus)) onlineSuccess += 1;
      else if (FAILED_PAYMENT_STATUSES.includes(order.paymentStatus)) onlineFailed += 1;
    }

    // Best-selling products & popular categories count only non-cancelled orders with valid sales
    const countsTowardSales =
      order.orderStatus !== 'Cancelled' &&
      (order.paymentMethod === 'cod' || COLLECTED_ONLINE_PAYMENT_STATUSES.includes(order.paymentStatus));

    if (countsTowardSales) {
      for (const item of order.items) {
        const existingProd = bestProductAgg.get(item.productId) || {
          productId: item.productId,
          name: item.productName,
          sku: item.sku,
          unitsSold: 0,
          revenue: 0,
        };
        existingProd.unitsSold += item.quantity;
        existingProd.revenue += item.lineTotal;
        bestProductAgg.set(item.productId, existingProd);

        const catalogProd = productById.get(item.productId);
        const catId = catalogProd?.categoryId || 'uncategorized';
        const catName =
          catalogProd?.categoryName || categoryNameById.get(catId) || 'Other Fashion';
        const existingCat = categoryAgg.get(catId) || {
          categoryId: catId,
          categoryName: catName,
          unitsSold: 0,
          revenue: 0,
        };
        existingCat.unitsSold += item.quantity;
        existingCat.revenue += item.lineTotal;
        categoryAgg.set(catId, existingCat);
      }
    }
  }

  let refundsTotal = 0;
  for (const r of filteredRefunds) {
    refundsTotal += r.amount;
    const ms = Date.parse(r.createdAt) || window.startMs;
    const b = getBucketForGranularity(ms, input.granularity);
    const point = bucketMap.get(b.key) || {
      bucketKey: b.key,
      label: b.label,
      revenue: 0,
      orders: 0,
      refunds: 0,
    };
    point.refunds += r.amount;
    bucketMap.set(b.key, point);
  }

  // Also include payment records in window if no matching online order counted above
  for (const p of input.payments) {
    const ms = Date.parse(p.createdAt) || 0;
    if (ms < window.startMs || ms > window.endMs) continue;
    if (orderMap.has(p.orderId)) continue;
    if (COLLECTED_ONLINE_PAYMENT_STATUSES.includes(p.paymentStatus)) onlineSuccess += 1;
    else if (FAILED_PAYMENT_STATUSES.includes(p.paymentStatus)) onlineFailed += 1;
  }

  const grossSales = onlineCollected + codCollected;
  const netRevenue = Math.max(0, grossSales - refundsTotal);
  const collectedCount = filteredOrders.filter((o) => {
    const rev = isCollectedOrderRevenue(o);
    return rev.isCollectedOnline || rev.isCollectedCod;
  }).length;
  const averageOrderValue = collectedCount > 0 ? Math.round(grossSales / collectedCount) : 0;

  const paymentAttemptTotal = onlineSuccess + onlineFailed;
  const paymentSuccessRate =
    paymentAttemptTotal > 0 ? Math.round((onlineSuccess / paymentAttemptTotal) * 1000) / 10 : 100;

  const orderCancellationRate =
    filteredOrders.length > 0
      ? Math.round((cancelledCount / filteredOrders.length) * 1000) / 10
      : 0;

  const series = Array.from(bucketMap.values()).sort((a, b) =>
    a.bucketKey.localeCompare(b.bucketKey)
  );

  const bestSellingProducts = Array.from(bestProductAgg.values())
    .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
    .slice(0, 8);

  const popularCategories = Array.from(categoryAgg.values())
    .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
    .slice(0, 8);

  return {
    window,
    series,
    grossSales,
    refundsTotal,
    netRevenue,
    codCollected,
    onlineCollected,
    ordersInWindow: filteredOrders.length,
    averageOrderValue,
    paymentSuccessRate,
    orderCancellationRate,
    bestSellingProducts,
    popularCategories,
  };
}

/**
 * Synthesizes real-time notifications from actual Firestore records merged with stored `adminNotifications`.
 * Never produces fake/hardcoded notifications.
 */
export function buildLiveAdminNotifications(input: {
  storedNotifications: AdminNotificationDoc[];
  orders: OrderDoc[];
  payments: PaymentRecordDoc[];
  refunds: RefundRecordDoc[];
  products: ResolvedCatalogProduct[];
}): AdminNotificationDoc[] {
  const list: AdminNotificationDoc[] = [...input.storedNotifications];
  const existingKeys = new Set(list.map((n) => `${n.type}:${n.entityId}`));

  // Real Out-of-Stock & Low-Stock product alerts
  for (const p of input.products) {
    if (p.stockStatus === 'out_of_stock' && !existingKeys.has(`out_of_stock:${p.id}`)) {
      list.push({
        notificationId: `derived_oos_${p.id}`,
        type: 'out_of_stock',
        severity: 'error',
        title: 'Out of Stock Alert',
        message: `${p.name} (${p.sku}) has 0 units remaining across all variants.`,
        entityId: p.id,
        readBy: [],
        createdAt: p.updatedAt,
        updatedAt: p.updatedAt,
        derived: true,
      });
    } else if (p.stockStatus === 'low_stock' && !existingKeys.has(`low_stock:${p.id}`)) {
      list.push({
        notificationId: `derived_low_${p.id}`,
        type: 'low_stock',
        severity: 'warning',
        title: 'Low Stock Warning',
        message: `${p.name} (${p.sku}) is down to ${p.totalStock} unit(s).`,
        entityId: p.id,
        readBy: [],
        createdAt: p.updatedAt,
        updatedAt: p.updatedAt,
        derived: true,
      });
    }
  }

  // Real Pending / Cancelled Orders
  for (const o of input.orders.slice(0, 25)) {
    if (o.orderStatus === 'Pending' && !existingKeys.has(`new_order:${o.orderId}`)) {
      list.push({
        notificationId: `derived_order_${o.orderId}`,
        type: 'new_order',
        severity: 'info',
        title: 'New Pending Order',
        message: `Order ${o.orderId} (₹${o.totalAmount.toLocaleString('en-IN')}, ${o.paymentMethod.toUpperCase()}) awaits review.`,
        entityId: o.orderId,
        readBy: [],
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        derived: true,
      });
    } else if (o.orderStatus === 'Cancelled' && !existingKeys.has(`order_cancelled:${o.orderId}`)) {
      list.push({
        notificationId: `derived_cancel_${o.orderId}`,
        type: 'order_cancelled',
        severity: 'warning',
        title: 'Order Cancelled',
        message: `Order ${o.orderId} for ₹${o.totalAmount.toLocaleString('en-IN')} is cancelled.`,
        entityId: o.orderId,
        readBy: [],
        createdAt: o.updatedAt,
        updatedAt: o.updatedAt,
        derived: true,
      });
    }
  }

  // Real Successful & Failed Payments
  for (const pay of input.payments.slice(0, 25)) {
    if (
      FAILED_PAYMENT_STATUSES.includes(pay.paymentStatus) &&
      !existingKeys.has(`payment_failed:${pay.paymentId}`)
    ) {
      list.push({
        notificationId: `derived_payfail_${pay.paymentId}`,
        type: 'payment_failed',
        severity: 'error',
        title: 'Payment Verification / Gateway Failed',
        message: `Order ${pay.orderId} payment (${pay.paymentStatus}): ${pay.failureReason || 'Gateway failure'}.`,
        entityId: pay.orderId,
        readBy: [],
        createdAt: pay.updatedAt,
        updatedAt: pay.updatedAt,
        derived: true,
      });
    } else if (
      COLLECTED_ONLINE_PAYMENT_STATUSES.includes(pay.paymentStatus) &&
      !existingKeys.has(`payment_success:${pay.paymentId}`)
    ) {
      list.push({
        notificationId: `derived_paysucc_${pay.paymentId}`,
        type: 'payment_success',
        severity: 'success',
        title: 'Verified Razorpay Payment',
        message: `Order ${pay.orderId} verified for ₹${pay.amount.toLocaleString('en-IN')}.`,
        entityId: pay.orderId,
        readBy: [],
        createdAt: pay.updatedAt,
        updatedAt: pay.updatedAt,
        derived: true,
      });
    }
  }

  // Real Refunds
  for (const ref of input.refunds.slice(0, 15)) {
    if (!existingKeys.has(`refund_request:${ref.refundId}`)) {
      list.push({
        notificationId: `derived_ref_${ref.refundId}`,
        type: 'refund_request',
        severity: ref.refundStatus === 'Failed' ? 'error' : 'info',
        title: `Refund ${ref.refundStatus}`,
        message: `Order ${ref.orderId} · ₹${ref.amount.toLocaleString('en-IN')} (${ref.type}).`,
        entityId: ref.orderId,
        readBy: [],
        createdAt: ref.updatedAt,
        updatedAt: ref.updatedAt,
        derived: true,
      });
    }
  }

  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
}

/**
 * Escapes CSV cell values safely and neutralizes spreadsheet formula injection (=, +, -, @, tab, CR).
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

export function buildCsvDocument(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return lines.join('\r\n');
}
