import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  XCircle,
} from 'lucide-react';
import { useRouter } from '../../router/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { fetchOrderById } from '../../firebase/commerce';
import { ORDER_STATUS_STEPS, type OrderDoc, type OrderStatus, type PaymentStatus } from '../../types/commerce';
import {
  getPaymentStatusBadgeClasses,
  isPaymentSettledSuccess,
  type PaymentStatusResponse,
} from '../../types/payment';
import {
  createRazorpayPaymentOrder,
  fetchOrderPaymentStatus,
  verifyRazorpayPayment,
} from '../../services/paymentApi';
import { loadRazorpayCheckoutScript } from '../../utils/razorpayLoader';
import { formatINR } from '../../utils/commerceHelpers';
import { Button, EmptyState, ResilientImage } from '../ui/Primitives';

interface OrdersPageProps {
  orderId?: string;
}

export function getOrderStatusBadgeClasses(status: OrderStatus): string {
  switch (status) {
    case 'Delivered':
      return 'bg-[#16A34A]/15 text-[#16A34A]';
    case 'Cancelled':
      return 'bg-[#DC2626]/12 text-[#DC2626]';
    case 'Shipped':
    case 'Out for Delivery':
      return 'bg-[#2563EB]/12 text-[#2563EB]';
    case 'Confirmed':
    case 'Processing':
    case 'Packed':
      return 'bg-[#FF7A00]/15 text-[#FF7A00]';
    default:
      return 'bg-[#F59E0B]/15 text-[#F59E0B]';
  }
}

export const OrderStatusTimeline: React.FC<{ status: OrderStatus }> = ({ status }) => {
  if (status === 'Cancelled') {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#DC2626]/30 bg-[#DC2626]/8 p-4 text-xs text-[#DC2626] font-semibold">
        <XCircle className="h-5 w-5 shrink-0" />
        This order has been marked as Cancelled.
      </div>
    );
  }

  const activeIdx = Math.max(0, ORDER_STATUS_STEPS.indexOf(status));

  return (
    <div className="overflow-x-auto pb-2">
      <ol className="grid grid-cols-7 min-w-[640px] gap-2">
        {ORDER_STATUS_STEPS.map((stepLabel, idx) => {
          const completed = idx <= activeIdx;
          const current = idx === activeIdx;
          return (
            <li key={stepLabel} className="flex flex-col items-center text-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border transition-colors ${
                  current
                    ? 'bg-[#FF7A00] border-[#FF7A00] text-white ring-4 ring-[#FF7A00]/20'
                    : completed
                      ? 'bg-[#16A34A] border-[#16A34A] text-white'
                      : 'bg-[#FFF8EF] border-[#1F1D2B]/15 text-[#1F1D2B]/45'
                }`}
              >
                {completed && !current ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={`text-[11px] leading-tight ${
                  current
                    ? 'font-bold text-[#1F1D2B]'
                    : completed
                      ? 'font-semibold text-[#16A34A]'
                      : 'text-[#1F1D2B]/50'
                }`}
              >
                {stepLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export const OrdersPage: React.FC<OrdersPageProps> = ({ orderId }) => {
  const { navigate } = useRouter();
  const { user, authReady } = useAuth();
  const authLoading = !authReady;
  const { orders, ordersLoading, ordersError } = useStore();

  const [fetchedDetail, setFetchedDetail] = useState<OrderDoc | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Phase 7 server payment reconciliation & retry state
  const [serverPayment, setServerPayment] = useState<PaymentStatusResponse | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState<{
    tone: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const liveMatch = orderId ? orders.find((o) => o.orderId === orderId) || null : null;

  useEffect(() => {
    if (!orderId || !user) {
      setServerPayment(null);
      setPaymentBanner(null);
      return;
    }
    let cancelled = false;
    void fetchOrderPaymentStatus(orderId, user)
      .then((res) => {
        if (!cancelled) setServerPayment(res);
      })
      .catch(() => {
        // Fallback to Firestore order status
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, user]);

  useEffect(() => {
    if (!orderId || liveMatch || !user) {
      setFetchedDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void fetchOrderById(orderId)
      .then((doc) => {
        if (cancelled) return;
        if (!doc) {
          setDetailError(`Order "${orderId}" was not found.`);
        } else {
          setFetchedDetail(doc);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : 'Unable to load order.');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, liveMatch, user]);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-20 min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-14 min-h-[70vh]">
        <EmptyState
          title="Sign In to View Your Orders"
          description="Your order history and delivery status are private to your authenticated Fashion World account."
          actionLabel="Go to Account Sign In"
          onAction={() => navigate('/account')}
        />
      </main>
    );
  }

  // Single Order Detail Route: /orders/:orderId
  if (orderId) {
    const activeOrder = liveMatch || fetchedDetail;

    if (detailLoading || (ordersLoading && !activeOrder)) {
      return (
        <main className="mx-auto max-w-[1040px] px-4 sm:px-6 lg:px-8 py-20 min-h-[70vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
        </main>
      );
    }

    if (detailError || !activeOrder) {
      return (
        <main className="mx-auto max-w-[820px] px-4 sm:px-6 lg:px-8 py-14 min-h-[70vh]">
          <EmptyState
            title="Order Not Found"
            description={
              detailError || 'This order does not exist or belongs to another customer account.'
            }
            actionLabel="Back to My Orders"
            onAction={() => navigate('/orders')}
          />
        </main>
      );
    }

    const effectivePaymentStatus: PaymentStatus =
      serverPayment?.paymentStatus || activeOrder.paymentStatus;
    const effectiveOrderStatus: OrderStatus = serverPayment?.orderStatus || activeOrder.orderStatus;
    const canRetryOnline =
      activeOrder.paymentMethod === 'online' &&
      (serverPayment
        ? serverPayment.canRetry
        : !isPaymentSettledSuccess(effectivePaymentStatus));

    const handleRefreshOrderStatus = async () => {
      if (!user || reconciling) return;
      setReconciling(true);
      setPaymentBanner(null);
      try {
        const res = await fetchOrderPaymentStatus(activeOrder.orderId, user);
        setServerPayment(res);
        setPaymentBanner({
          tone: isPaymentSettledSuccess(res.paymentStatus) ? 'success' : 'warning',
          text: `Latest server payment status: ${res.paymentStatus}`,
        });
      } catch (err) {
        setPaymentBanner({
          tone: 'error',
          text: err instanceof Error ? err.message : 'Unable to refresh payment status.',
        });
      } finally {
        setReconciling(false);
      }
    };

    const handleRetryOrderPayment = async () => {
      if (!user || retrying) return;
      setRetrying(true);
      setPaymentBanner(null);
      try {
        const rzOrder = await createRazorpayPaymentOrder(activeOrder.orderId, user);
        await loadRazorpayCheckoutScript();
        if (typeof window.Razorpay !== 'function') {
          throw new Error('Razorpay Checkout SDK could not be loaded.');
        }

        const rzp = new window.Razorpay({
          key: rzOrder.keyId,
          amount: rzOrder.amountPaise,
          currency: 'INR',
          name: '3D Jummo Fashion World',
          description: `Order ${activeOrder.orderId}`,
          order_id: rzOrder.razorpayOrderId,
          prefill: {
            name: rzOrder.customer.name,
            email: rzOrder.customer.email,
            contact: rzOrder.customer.contact,
          },
          notes: { orderId: activeOrder.orderId },
          theme: { color: '#FF7A00' },
          modal: {
            confirm_close: true,
            ondismiss: () => {
              setRetrying(false);
              setPaymentBanner({
                tone: 'warning',
                text: 'Payment window closed. Click "Refresh Payment Status" if you approved the payment in your UPI app.',
              });
            },
          },
          handler: (response) => {
            void (async () => {
              try {
                const verified = await verifyRazorpayPayment(
                  {
                    orderId: activeOrder.orderId,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                  user
                );
                const latest = await fetchOrderPaymentStatus(activeOrder.orderId, user).catch(
                  () => null
                );
                if (latest) setServerPayment(latest);
                setPaymentBanner({
                  tone: verified.verified ? 'success' : 'warning',
                  text: verified.verified
                    ? 'Payment verified via Razorpay! Your order is Confirmed.'
                    : verified.message || 'Payment is awaiting bank capture confirmation.',
                });
              } catch (err) {
                setPaymentBanner({
                  tone: 'error',
                  text: err instanceof Error ? err.message : 'Payment verification failed.',
                });
              } finally {
                setRetrying(false);
              }
            })();
          },
        });

        rzp.on('payment.failed', (failure) => {
          setRetrying(false);
          setPaymentBanner({
            tone: 'error',
            text: failure.error?.description || 'Payment failed at Razorpay gateway.',
          });
        });

        rzp.open();
      } catch (err) {
        setRetrying(false);
        setPaymentBanner({
          tone: 'error',
          text: err instanceof Error ? err.message : 'Unable to launch Razorpay Checkout.',
        });
      }
    };

    return (
      <main className="mx-auto max-w-[1140px] px-4 sm:px-6 lg:px-8 py-10 min-h-[75vh] space-y-6 fw-animate-fade">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F1D2B]/10 pb-5">
          <div>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] mb-2 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to My Orders
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-[#1F1D2B] font-mono">
                {activeOrder.orderId}
              </h1>
              <span
                className={`rounded-lg px-3 py-1 text-xs font-bold ${getOrderStatusBadgeClasses(
                  effectiveOrderStatus
                )}`}
              >
                {effectiveOrderStatus}
              </span>
              <span
                className={`rounded-lg px-3 py-1 text-xs font-bold ${getPaymentStatusBadgeClasses(
                  effectivePaymentStatus
                )}`}
              >
                {effectivePaymentStatus}
              </span>
            </div>
            <p className="text-xs text-[#1F1D2B]/60 mt-1">
              Ordered on {new Date(activeOrder.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
            Shop More Styles
          </Button>
        </div>

        {/* Order Status Timeline */}
        <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
          <h2 className="font-heading text-sm font-bold text-[#1F1D2B]">Order Lifecycle Status</h2>
          <OrderStatusTimeline status={effectiveOrderStatus} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Items */}
          <section className="lg:col-span-7 rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
            <h2 className="font-heading text-base font-bold text-[#1F1D2B]">
              Purchased Garments ({activeOrder.items.reduce((s, i) => s + i.quantity, 0)})
            </h2>
            <div className="space-y-3">
              {activeOrder.items.map((item, idx) => (
                <div
                  key={`${item.productId}-${idx}`}
                  className="flex items-center gap-3.5 rounded-2xl border border-[#1F1D2B]/10 p-3.5"
                >
                  <ResilientImage
                    src={item.productImage}
                    alt={item.productName}
                    className="h-20 w-16 rounded-xl object-cover shrink-0 bg-[#FFF8EF]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-semibold text-[#1F1D2B] truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-[#1F1D2B]/60 mt-0.5">
                      Size {item.selectedSize} · {item.selectedColour} · SKU {item.sku}
                    </p>
                    <p className="text-xs text-[#1F1D2B]/65 mt-1 tabular-nums">
                      {formatINR(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-heading text-sm font-bold text-[#1F1D2B] tabular-nums shrink-0">
                    {formatINR(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Address & Payment */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-2.5 text-xs">
              <h2 className="font-heading text-base font-bold text-[#1F1D2B] flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#FF7A00]" />
                Delivery Address
              </h2>
              <p className="font-bold text-sm text-[#1F1D2B]">
                {activeOrder.deliveryAddress.fullName}
              </p>
              <p className="text-[#1F1D2B]/75">
                {activeOrder.deliveryAddress.houseFlat}, {activeOrder.deliveryAddress.streetArea}
                {activeOrder.deliveryAddress.landmark
                  ? `, ${activeOrder.deliveryAddress.landmark}`
                  : ''}
              </p>
              <p className="text-[#1F1D2B]/75">
                {activeOrder.deliveryAddress.city}, {activeOrder.deliveryAddress.state} —{' '}
                {activeOrder.deliveryAddress.pinCode}
              </p>
              <p className="font-mono text-[#1F1D2B]/65 pt-1">
                +91 {activeOrder.deliveryAddress.mobile} · {activeOrder.deliveryAddress.email}
              </p>
            </section>

            <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-3">
              <h2 className="font-heading text-base font-bold text-[#1F1D2B]">
                Payment &amp; Totals
              </h2>
              <div className="flex items-center justify-between gap-2 text-xs rounded-xl bg-[#FFF8EF] p-3">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#1F1D2B]">
                  <CreditCard className="h-4 w-4 text-[#2563EB]" />
                  {activeOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay Online'}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getPaymentStatusBadgeClasses(
                    effectivePaymentStatus
                  )}`}
                >
                  {effectivePaymentStatus}
                </span>
              </div>

              {(serverPayment?.payment?.razorpayPaymentId ||
                serverPayment?.payment?.razorpayOrderId ||
                activeOrder.razorpayOrderId) && (
                <div className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/60 p-3 text-[11px] font-mono text-[#1F1D2B]/75 space-y-1">
                  {(serverPayment?.payment?.razorpayOrderId || activeOrder.razorpayOrderId) && (
                    <p className="truncate">
                      Razorpay Order:{' '}
                      {serverPayment?.payment?.razorpayOrderId || activeOrder.razorpayOrderId}
                    </p>
                  )}
                  {serverPayment?.payment?.razorpayPaymentId && (
                    <p className="truncate">
                      Payment ID: {serverPayment.payment.razorpayPaymentId}
                    </p>
                  )}
                </div>
              )}

              {paymentBanner && (
                <div
                  role="alert"
                  className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
                    paymentBanner.tone === 'success'
                      ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]'
                      : paymentBanner.tone === 'error'
                        ? 'border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626]'
                        : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#1F1D2B]'
                  }`}
                >
                  {paymentBanner.tone === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{paymentBanner.text}</span>
                </div>
              )}

              {canRetryOnline && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={retrying}
                    leftIcon={
                      retrying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )
                    }
                    onClick={() => void handleRetryOrderPayment()}
                  >
                    {retrying ? 'Opening Razorpay…' : 'Retry Online Payment'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reconciling}
                    leftIcon={
                      reconciling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )
                    }
                    onClick={() => void handleRefreshOrderStatus()}
                  >
                    Refresh Status
                  </Button>
                </div>
              )}

              {serverPayment && serverPayment.refunds.length > 0 && (
                <div className="rounded-xl border border-[#2563EB]/25 bg-[#2563EB]/6 p-3 space-y-1.5 text-xs">
                  <p className="font-bold text-[#2563EB]">Refund Records</p>
                  {serverPayment.refunds.map((ref) => (
                    <div key={ref.refundId} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[#1F1D2B]/75">
                        {ref.razorpayRefundId} ({ref.type})
                      </span>
                      <span className="font-bold text-[#2563EB] tabular-nums">
                        {formatINR(ref.amount)} · {ref.refundStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <dl className="space-y-2 text-xs border-b border-[#1F1D2B]/10 pb-3">
                <div className="flex justify-between">
                  <dt className="text-[#1F1D2B]/70">Subtotal</dt>
                  <dd className="font-semibold tabular-nums">{formatINR(activeOrder.subtotal)}</dd>
                </div>
                {activeOrder.discount > 0 && (
                  <div className="flex justify-between text-[#16A34A]">
                    <dt>Coupon ({activeOrder.couponCode})</dt>
                    <dd className="font-semibold tabular-nums">
                      -{formatINR(activeOrder.discount)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-[#1F1D2B]/70">
                    Delivery ({activeOrder.deliveryMethod === 'express' ? 'Express' : 'Standard'})
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {activeOrder.deliveryCharge === 0
                      ? 'Free'
                      : formatINR(activeOrder.deliveryCharge)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#1F1D2B]/70">Tax (GST Inclusive)</dt>
                  <dd className="font-semibold tabular-nums">{formatINR(activeOrder.tax)}</dd>
                </div>
              </dl>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#1F1D2B]">Total Paid / Payable</span>
                <span className="font-heading text-xl font-bold text-[#1F1D2B] tabular-nums">
                  {formatINR(activeOrder.totalAmount)}
                </span>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  // Orders List Route: /orders
  return (
    <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-10 min-h-[75vh] space-y-6 fw-animate-fade">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1F1D2B]/10 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            Real-Time Cloud Firestore Order History
          </p>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F1D2B] mt-1">
            My Orders ({orders.length})
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => navigate('/account')}>
            My Account
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/search')}>
            Continue Shopping
          </Button>
        </div>
      </div>

      {ordersError && (
        <div
          role="alert"
          className="rounded-2xl border border-[#DC2626]/30 bg-[#DC2626]/8 p-4 text-xs text-[#DC2626] flex items-center gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{ordersError}</span>
        </div>
      )}

      {ordersLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 rounded-3xl border border-[#1F1D2B]/10 bg-white animate-pulse"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders placed yet"
          description="Once you place an order through Fashion World checkout, it will appear here in real time with full tracking status."
          actionLabel="Explore Catalog"
          onAction={() => navigate('/search')}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article
              key={order.orderId}
              className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4 hover:border-[#FF7A00]/50 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F1D2B]/8 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm font-bold text-[#1F1D2B]">
                    {order.orderId}
                  </span>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${getOrderStatusBadgeClasses(
                      order.orderStatus
                    )}`}
                  >
                    {order.orderStatus}
                  </span>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${getPaymentStatusBadgeClasses(
                      order.paymentStatus
                    )}`}
                  >
                    {order.paymentMethod === 'cod' ? 'COD' : 'Razorpay'} · {order.paymentStatus}
                  </span>
                </div>
                <span className="text-xs text-[#1F1D2B]/60">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 overflow-x-auto">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className="flex items-center gap-2.5 shrink-0">
                      <ResilientImage
                        src={item.productImage}
                        alt={item.productName}
                        className="h-14 w-12 rounded-xl object-cover bg-[#FFF8EF]"
                      />
                      <div className="max-w-[160px]">
                        <p className="text-xs font-semibold text-[#1F1D2B] truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-[#1F1D2B]/55">
                          {item.selectedSize} · Qty {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <span className="text-xs font-semibold text-[#1F1D2B]/60">
                      +{order.items.length - 3} more
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] text-[#1F1D2B]/55 flex items-center gap-1 sm:justify-end">
                      <Truck className="h-3 w-3 text-[#FF7A00]" />
                      {order.deliveryAddress.city}, {order.deliveryAddress.pinCode}
                    </p>
                    <p className="font-heading text-lg font-bold text-[#1F1D2B] tabular-nums">
                      {formatINR(order.totalAmount)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                    onClick={() => navigate(`/orders/${encodeURIComponent(order.orderId)}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};
