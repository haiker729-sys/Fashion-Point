import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { useRouter } from '../../router/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { fetchOrderById } from '../../firebase/commerce';
import type { OrderDoc, OrderStatus, PaymentStatus } from '../../types/commerce';
import {
  getPaymentStatusBadgeClasses,
  getPaymentStatusTextColor,
  isPaymentFailureStatus,
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
import { Button, ResilientImage } from '../ui/Primitives';

interface OrderConfirmationPageProps {
  orderId: string;
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({ orderId }) => {
  const { navigate } = useRouter();
  const { user, authReady } = useAuth();
  const authLoading = !authReady;

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [serverStatus, setServerStatus] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [retryNotice, setRetryNotice] = useState<{
    tone: 'error' | 'warning' | 'success';
    text: string;
  } | null>(null);

  const loadOrderAndStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const doc = await fetchOrderById(orderId);
      if (!doc) {
        setError(`Order "${orderId}" was not found in Cloud Firestore.`);
        setOrder(null);
        return;
      }
      setOrder(doc);
      try {
        const st = await fetchOrderPaymentStatus(orderId, user);
        setServerStatus(st);
      } catch {
        // Fallback to Firestore order status if payment API is momentarily unavailable
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load order confirmation from Cloud Firestore.'
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError('Please sign in to view your confirmed order details.');
      return;
    }
    void loadOrderAndStatus();
  }, [authLoading, user, loadOrderAndStatus]);

  const handleRefreshPaymentStatus = async () => {
    if (!user || !order) return;
    setRefreshingStatus(true);
    setRetryNotice(null);
    try {
      const st = await fetchOrderPaymentStatus(order.orderId, user);
      setServerStatus(st);
      const updatedDoc = await fetchOrderById(order.orderId).catch(() => null);
      if (updatedDoc) setOrder(updatedDoc);
      if (isPaymentSettledSuccess(st.paymentStatus)) {
        setRetryNotice({
          tone: 'success',
          text: `Payment confirmed (${st.paymentStatus}). Your order is Confirmed!`,
        });
      }
    } catch (err) {
      setRetryNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to refresh payment status.',
      });
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleRetryOnlinePayment = async () => {
    if (!user || !order || retryingPayment) return;
    setRetryingPayment(true);
    setRetryNotice(null);
    try {
      const rzOrder = await createRazorpayPaymentOrder(order.orderId, user);
      await loadRazorpayCheckoutScript();
      if (typeof window.Razorpay !== 'function') {
        throw new Error('Razorpay Checkout SDK could not be initialized.');
      }

      const rzp = new window.Razorpay({
        key: rzOrder.keyId,
        amount: rzOrder.amountPaise,
        currency: 'INR',
        name: '3D Jummo Fashion World',
        description: `Order ${order.orderId}`,
        order_id: rzOrder.razorpayOrderId,
        prefill: {
          name: rzOrder.customer.name,
          email: rzOrder.customer.email,
          contact: rzOrder.customer.contact,
        },
        notes: { orderId: order.orderId },
        theme: { color: '#FF7A00' },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setRetryingPayment(false);
            setRetryNotice({
              tone: 'warning',
              text: 'Payment popup closed before completion. Use "Check Latest Status" if money was debited, or retry safely without creating a duplicate order.',
            });
          },
        },
        handler: (response) => {
          void (async () => {
            try {
              const verified = await verifyRazorpayPayment(
                {
                  orderId: order.orderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
                user
              );
              const latest = await fetchOrderPaymentStatus(order.orderId, user).catch(() => null);
              if (latest) setServerStatus(latest);
              if (verified.verified) {
                setRetryNotice({
                  tone: 'success',
                  text: 'Payment verified via Razorpay HMAC-SHA256! Your order is now Confirmed.',
                });
              } else {
                setRetryNotice({
                  tone: 'warning',
                  text:
                    verified.message ||
                    'Payment is awaiting final capture confirmation. Click Check Latest Status shortly.',
                });
              }
            } catch (verifyErr) {
              setRetryNotice({
                tone: 'error',
                text:
                  verifyErr instanceof Error
                    ? verifyErr.message
                    : 'Payment verification failed on server.',
              });
            } finally {
              setRetryingPayment(false);
            }
          })();
        },
      });

      rzp.on('payment.failed', (failure) => {
        setRetryingPayment(false);
        setRetryNotice({
          tone: 'error',
          text:
            failure.error?.description ||
            'Payment failed at Razorpay gateway. You can safely retry payment for this same order.',
        });
      });

      rzp.open();
    } catch (err) {
      setRetryingPayment(false);
      setRetryNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to launch Razorpay Checkout.',
      });
    }
  };

  const handleCopyOrderId = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  if (authLoading || loading) {
    return (
      <main className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 py-20 min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00] mx-auto" />
          <p className="text-sm font-semibold text-[#1F1D2B]">
            Verifying your order &amp; payment status…
          </p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto max-w-[780px] px-4 sm:px-6 lg:px-8 py-14 min-h-[70vh] fw-animate-fade">
        <div className="rounded-3xl border border-[#DC2626]/30 bg-white p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC2626]/12 text-[#DC2626]">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold text-[#1F1D2B]">
              Order Confirmation Unavailable
            </h1>
            <p className="text-sm text-[#DC2626] max-w-md mx-auto">
              {error || 'We could not locate this order record.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button variant="primary" size="md" onClick={() => navigate('/orders')}>
              View My Orders
            </Button>
            <Button variant="outline" size="md" onClick={() => navigate('/search')}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const effectivePaymentStatus: PaymentStatus = serverStatus?.paymentStatus || order.paymentStatus;
  const effectiveOrderStatus: OrderStatus = serverStatus?.orderStatus || order.orderStatus;
  const isOnlineOrder = order.paymentMethod === 'online';
  const isPaidOnline = isOnlineOrder && isPaymentSettledSuccess(effectivePaymentStatus);
  const isFailedOnline = isOnlineOrder && isPaymentFailureStatus(effectivePaymentStatus);
  const isConfirmedHero = !isOnlineOrder || isPaidOnline;
  const canRetryOnline =
    isOnlineOrder && (serverStatus ? serverStatus.canRetry : !isPaymentSettledSuccess(effectivePaymentStatus));

  const razorpayPaymentId = serverStatus?.payment?.razorpayPaymentId || '';
  const razorpayOrderId = serverStatus?.payment?.razorpayOrderId || order.razorpayOrderId || '';

  return (
    <main className="mx-auto max-w-[1040px] px-4 sm:px-6 lg:px-8 py-10 sm:py-12 min-h-[75vh] space-y-8 fw-animate-fade">
      {/* Honest Status Hero Banner (Green ONLY when COD Placed or Online Payment Cryptographically Verified!) */}
      <section
        className={`rounded-3xl border bg-white p-6 sm:p-8 shadow-sm ${
          isConfirmedHero
            ? 'border-[#16A34A]/30'
            : isFailedOnline
              ? 'border-[#DC2626]/35'
              : 'border-[#F59E0B]/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shrink-0 ${
                isConfirmedHero
                  ? 'bg-[#16A34A]'
                  : isFailedOnline
                    ? 'bg-[#DC2626]'
                    : 'bg-[#F59E0B]'
              }`}
            >
              {isConfirmedHero ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : isFailedOnline ? (
                <AlertCircle className="h-8 w-8" />
              ) : (
                <AlertTriangle className="h-8 w-8" />
              )}
            </div>
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${getPaymentStatusBadgeClasses(
                  effectivePaymentStatus
                )}`}
              >
                {isPaidOnline
                  ? 'Razorpay Payment Cryptographically Verified'
                  : !isOnlineOrder
                    ? 'Verified in Cloud Firestore · Cash on Delivery'
                    : effectivePaymentStatus}
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F1D2B] mt-2">
                {isPaidOnline
                  ? 'Payment Verified & Order Confirmed'
                  : !isOnlineOrder
                    ? 'Order Placed Successfully'
                    : isFailedOnline
                      ? 'Order Saved — Payment Action Required'
                      : 'Order Saved — Awaiting Online Payment'}
              </h1>
              <p className="text-sm text-[#1F1D2B]/70 mt-1">
                {isPaidOnline ? (
                  <>
                    Thank you, <strong>{order.customerName}</strong>. Your Razorpay payment of{' '}
                    <strong>{formatINR(order.totalAmount)}</strong> has been verified on the server.
                  </>
                ) : !isOnlineOrder ? (
                  <>
                    Thank you, <strong>{order.customerName}</strong>. Your Cash on Delivery order is
                    securely saved in Cloud Firestore.
                  </>
                ) : (
                  <>
                    Your order <strong>{order.orderId}</strong> is safely reserved without
                    duplication. Complete or verify your Razorpay payment below to confirm dispatch.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-[#FFF8EF] p-4 shrink-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F1D2B]/55">
              Unique Order ID
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-[#1F1D2B]">{order.orderId}</span>
              <button
                type="button"
                onClick={() => void handleCopyOrderId()}
                aria-label="Copy Order ID"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1F1D2B]/15 bg-white hover:border-[#FF7A00] cursor-pointer"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#1F1D2B]/70" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-[#1F1D2B]/55">
              Placed on {new Date(order.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {retryNotice && (
          <div
            role="alert"
            className={`mt-5 rounded-xl border p-3.5 text-xs flex items-start gap-2.5 ${
              retryNotice.tone === 'success'
                ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]'
                : retryNotice.tone === 'error'
                  ? 'border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626]'
                  : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#1F1D2B]'
            }`}
          >
            {retryNotice.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{retryNotice.text}</span>
          </div>
        )}

        {/* Retry & Reconcile Actions for Pending/Failed Online Orders */}
        {canRetryOnline && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#FF7A00]/25 bg-[#FFF8EF] p-4">
            <Button
              variant="primary"
              size="md"
              disabled={retryingPayment}
              leftIcon={
                retryingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )
              }
              onClick={() => void handleRetryOnlinePayment()}
            >
              {retryingPayment
                ? 'Opening Razorpay…'
                : `Pay / Retry Online — ${formatINR(order.totalAmount)}`}
            </Button>
            <Button
              variant="outline"
              size="md"
              disabled={refreshingStatus}
              leftIcon={
                refreshingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )
              }
              onClick={() => void handleRefreshPaymentStatus()}
            >
              Check Latest Payment Status
            </Button>
          </div>
        )}

        {/* Status Summary Row */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-[#1F1D2B]/10 text-xs">
          <div className="rounded-xl bg-[#FFF8EF] p-3.5 flex items-center gap-3">
            <Package className="h-5 w-5 text-[#FF7A00] shrink-0" />
            <div>
              <p className="text-[#1F1D2B]/60">Current Order Status</p>
              <p className="font-bold text-[#1F1D2B] mt-0.5">{effectiveOrderStatus}</p>
            </div>
          </div>
          <div className="rounded-xl bg-[#FFF8EF] p-3.5 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-[#2563EB] shrink-0" />
            <div className="min-w-0">
              <p className="text-[#1F1D2B]/60">Payment Method &amp; Status</p>
              <p className="font-bold text-[#1F1D2B] mt-0.5 truncate">
                {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay Online'} ·{' '}
                <span className={getPaymentStatusTextColor(effectivePaymentStatus)}>
                  {effectivePaymentStatus}
                </span>
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-[#FFF8EF] p-3.5 flex items-center gap-3">
            <Truck className="h-5 w-5 text-[#16A34A] shrink-0" />
            <div>
              <p className="text-[#1F1D2B]/60">Delivery Option</p>
              <p className="font-bold text-[#1F1D2B] mt-0.5">
                {order.deliveryMethod === 'express'
                  ? 'Express Delivery (1–2 Days)'
                  : 'Standard Delivery (4–6 Days)'}
              </p>
            </div>
          </div>
        </div>

        {(razorpayPaymentId || razorpayOrderId) && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#1F1D2B]/65 border-t border-[#1F1D2B]/8 pt-3">
            {razorpayOrderId && <span>Razorpay Order ID: {razorpayOrderId}</span>}
            {razorpayPaymentId && <span>Razorpay Payment ID: {razorpayPaymentId}</span>}
          </div>
        )}
      </section>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ordered Products Snapshot */}
        <section className="lg:col-span-7 rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#1F1D2B]">
            Ordered Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
          </h2>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div
                key={`${item.productId}-${item.selectedSize}-${item.selectedColour}-${idx}`}
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

        {/* Delivery Address & Amount Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-3">
            <h2 className="font-heading text-base font-bold text-[#1F1D2B] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#FF7A00]" />
              Delivery Address
            </h2>
            <div className="text-xs text-[#1F1D2B]/80 space-y-1 leading-relaxed">
              <p className="font-bold text-[#1F1D2B] text-sm">{order.deliveryAddress.fullName}</p>
              <p>
                {order.deliveryAddress.houseFlat}, {order.deliveryAddress.streetArea}
              </p>
              {order.deliveryAddress.landmark && <p>Landmark: {order.deliveryAddress.landmark}</p>}
              <p>
                {order.deliveryAddress.city}, {order.deliveryAddress.state} —{' '}
                {order.deliveryAddress.pinCode}
              </p>
              <p className="font-mono pt-1">
                +91 {order.deliveryAddress.mobile} · {order.deliveryAddress.email}
              </p>
              {order.deliveryAddress.deliveryInstructions && (
                <p className="pt-1 italic text-[#1F1D2B]/60">
                  Note: {order.deliveryAddress.deliveryInstructions}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-3">
            <h2 className="font-heading text-base font-bold text-[#1F1D2B]">Payment Summary</h2>
            <dl className="space-y-2 text-xs border-b border-[#1F1D2B]/10 pb-3">
              <div className="flex justify-between">
                <dt className="text-[#1F1D2B]/70">Subtotal</dt>
                <dd className="font-semibold tabular-nums">{formatINR(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-[#16A34A]">
                  <dt>Coupon Discount ({order.couponCode})</dt>
                  <dd className="font-semibold tabular-nums">-{formatINR(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-[#1F1D2B]/70">Delivery Charge</dt>
                <dd className="font-semibold tabular-nums">
                  {order.deliveryCharge === 0 ? 'Free' : formatINR(order.deliveryCharge)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#1F1D2B]/70">Tax (GST Inclusive)</dt>
                <dd className="font-semibold tabular-nums">{formatINR(order.tax)}</dd>
              </div>
            </dl>
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-sm text-[#1F1D2B]">Total Amount</span>
              <span className="font-heading text-xl font-bold text-[#1F1D2B] tabular-nums">
                {formatINR(order.totalAmount)}
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button
          variant="primary"
          size="lg"
          leftIcon={<ShoppingBag className="h-4 w-4" />}
          onClick={() => navigate('/search')}
        >
          Continue Shopping
        </Button>
        <Button
          variant="secondary"
          size="lg"
          rightIcon={<ArrowRight className="h-4 w-4" />}
          onClick={() => navigate('/orders')}
        >
          View My Orders
        </Button>
      </div>
    </main>
  );
};
