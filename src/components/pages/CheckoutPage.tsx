import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import { useRouter } from '../../router/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import {
  INDIAN_STATES,
  SHIPPING_RULES,
  type AddressValidationErrors,
  type DeliveryAddressInput,
  type DeliveryMethod,
  type OrderDoc,
  type PaymentMethod,
  type PaymentStatus,
} from '../../types/commerce';
import {
  getPaymentStatusBadgeClasses,
  isPaymentSettledSuccess,
  type RazorpayConfigResponse,
} from '../../types/payment';
import {
  createRazorpayPaymentOrder,
  fetchOrderPaymentStatus,
  fetchRazorpayConfig,
  verifyRazorpayPayment,
} from '../../services/paymentApi';
import { loadRazorpayCheckoutScript } from '../../utils/razorpayLoader';
import {
  createCheckoutIdempotencyKey,
  formatINR,
  validateDeliveryAddress,
} from '../../utils/commerceHelpers';
import { Button, EmptyState, ResilientImage } from '../ui/Primitives';

const STEPS = [
  { id: 1, label: 'Delivery Address', short: 'Address' },
  { id: 2, label: 'Delivery Method', short: 'Delivery' },
  { id: 3, label: 'Order Review', short: 'Review' },
  { id: 4, label: 'Payment Method', short: 'Payment' },
] as const;

const EMPTY_ADDRESS: DeliveryAddressInput = {
  fullName: '',
  mobile: '',
  email: '',
  houseFlat: '',
  streetArea: '',
  landmark: '',
  city: '',
  state: 'Maharashtra',
  pinCode: '',
  deliveryInstructions: '',
};

export const CheckoutPage: React.FC = () => {
  const { navigate } = useRouter();
  const {
    user,
    authReady,
    authError: ctxAuthError,
    signInWithGoogle,
    signInWithEmail,
    registerCustomer,
  } = useAuth();
  const authLoading = !authReady;
  const {
    cart,
    cartLoading,
    cartSummary,
    deliveryMethod,
    setDeliveryMethod,
    appliedCoupon,
    couponError,
    couponLoading,
    applyCouponCode,
    removeCoupon,
    addresses,
    saveAddress,
    placeOrder,
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [address, setAddress] = useState<DeliveryAddressInput>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<AddressValidationErrors>({});
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [couponInput, setCouponInput] = useState('');

  // Order submission & idempotency state
  const [idempotencyKey, setIdempotencyKey] = useState(() => createCheckoutIdempotencyKey());
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Phase 7 Razorpay Gateway & Retry state (prevents duplicate order creation on retry!)
  const [razorpayConfig, setRazorpayConfig] = useState<RazorpayConfigResponse | null>(null);
  const [pendingOnlineOrder, setPendingOnlineOrder] = useState<OrderDoc | null>(null);
  const [paymentUiStatus, setPaymentUiStatus] = useState<PaymentStatus>('Pending');
  const [paymentNotice, setPaymentNotice] = useState<{
    tone: 'warning' | 'error' | 'info' | 'success';
    title: string;
    message: string;
  } | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Inline Customer Sign-In state for guests
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Regenerate idempotency key if cart items signature changes before submission
  const cartSignature = useMemo(
    () => cart.map((c) => `${c.key}:${c.quantity}`).sort().join('|'),
    [cart]
  );
  useEffect(() => {
    setIdempotencyKey(createCheckoutIdempotencyKey());
  }, [cartSignature]);

  // Pre-fill user details or default saved address once signed in
  useEffect(() => {
    if (!user) return;
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (defaultAddr && !selectedSavedAddressId && !address.houseFlat) {
      setSelectedSavedAddressId(defaultAddr.id);
      setAddress({
        fullName: defaultAddr.fullName,
        mobile: defaultAddr.mobile,
        email: defaultAddr.email,
        houseFlat: defaultAddr.houseFlat,
        streetArea: defaultAddr.streetArea,
        landmark: defaultAddr.landmark,
        city: defaultAddr.city,
        state: defaultAddr.state,
        pinCode: defaultAddr.pinCode,
        deliveryInstructions: defaultAddr.deliveryInstructions,
      });
      setSaveNewAddress(false);
    } else if (!address.email) {
      setAddress((prev) => ({
        ...prev,
        fullName: prev.fullName || user.displayName || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user, addresses, selectedSavedAddressId, address.houseFlat, address.email]);

  const hasStockIssues = cart.some(
    (item) => !item.isPublished || item.availableStock <= 0 || item.quantity > item.availableStock
  );

  const handleFieldChange = (field: keyof DeliveryAddressInput, value: string) => {
    setSelectedSavedAddressId(null);
    setAddress((prev) => ({ ...prev, [field]: value }));
    if (addressErrors[field]) {
      setAddressErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleContinueFromAddress = async () => {
    const result = validateDeliveryAddress(address);
    if (!result.isValid) {
      setAddressErrors(result.errors);
      return;
    }
    setAddress(result.sanitized);
    setAddressErrors({});

    if (saveNewAddress && user && !selectedSavedAddressId) {
      try {
        const saved = await saveAddress(result.sanitized, {
          isDefault: addresses.length === 0,
        });
        setSelectedSavedAddressId(saved.id);
        setSaveNewAddress(false);
      } catch {
        // Non-blocking: proceed to Step 2 even if saving address fails
      }
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const ok = await applyCouponCode(couponInput);
    if (ok) setCouponInput('');
  };

  // Load public non-secret Razorpay gateway readiness from Express backend
  useEffect(() => {
    let cancelled = false;
    void fetchRazorpayConfig()
      .then((cfg) => {
        if (!cancelled) setRazorpayConfig(cfg);
      })
      .catch(() => {
        // Non-fatal: Step 4 will show gateway status unavailable
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const launchRazorpayForOrder = async (order: OrderDoc) => {
    if (!user) return;
    setOrderError(null);
    setPaymentNotice(null);
    setPaymentUiStatus('Payment Processing');
    setPlacingOrder(true);

    try {
      const rzOrder = await createRazorpayPaymentOrder(order.orderId, user);
      await loadRazorpayCheckoutScript();
      if (typeof window.Razorpay !== 'function') {
        throw new Error('Official Razorpay Checkout script could not be initialized.');
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
        notes: {
          orderId: order.orderId,
        },
        theme: {
          color: '#FF7A00',
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setPlacingOrder(false);
            setPaymentUiStatus('Verification Pending');
            setPaymentNotice({
              tone: 'warning',
              title: 'Payment Window Closed — Order Preserved',
              message: `Order ${order.orderId} is safely saved without duplication. If you completed UPI/bank authorization in another app, click "Check Latest Payment Status" — otherwise click "Retry Payment" below.`,
            });
          },
        },
        handler: (response) => {
          setVerifyingPayment(true);
          setPaymentNotice({
            tone: 'info',
            title: 'Verifying Payment Signature…',
            message:
              'Validating Razorpay HMAC-SHA256 signature and bank capture status on the server…',
          });
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
              setPaymentUiStatus(verified.paymentStatus);
              if (verified.verified) {
                navigate(`/order-confirmation/${encodeURIComponent(order.orderId)}`);
                return;
              }
              setPaymentNotice({
                tone: 'warning',
                title: verified.paymentStatus,
                message:
                  verified.message ||
                  'Payment is authorized and awaiting final capture confirmation. Click "Check Latest Payment Status" shortly.',
              });
            } catch (verifyErr) {
              setPaymentUiStatus('Payment Verification Failed');
              setPaymentNotice({
                tone: 'error',
                title: 'Payment Verification Failed',
                message:
                  verifyErr instanceof Error
                    ? verifyErr.message
                    : 'Server could not verify payment signature. Order is NOT marked paid.',
              });
            } finally {
              setVerifyingPayment(false);
              setPlacingOrder(false);
            }
          })();
        },
      });

      rzp.on('payment.failed', (failure) => {
        setPlacingOrder(false);
        setPaymentUiStatus('Payment Failed');
        setPaymentNotice({
          tone: 'error',
          title: 'Payment Failed',
          message:
            failure.error?.description ||
            'Payment was declined or interrupted. Your order is preserved — click "Retry Payment" to try again with UPI, Card, or Net Banking.',
        });
      });

      rzp.open();
    } catch (err) {
      setPlacingOrder(false);
      setPaymentUiStatus('Pending');
      setPaymentNotice({
        tone: 'error',
        title: 'Unable to Launch Razorpay Checkout',
        message:
          err instanceof Error
            ? err.message
            : 'Unable to initialize Razorpay payment. Please try again or view your order.',
      });
    }
  };

  const handleCheckPendingStatus = async () => {
    if (!user || !pendingOnlineOrder || checkingStatus) return;
    setCheckingStatus(true);
    try {
      const latest = await fetchOrderPaymentStatus(pendingOnlineOrder.orderId, user);
      setPaymentUiStatus(latest.paymentStatus);
      if (isPaymentSettledSuccess(latest.paymentStatus)) {
        navigate(`/order-confirmation/${encodeURIComponent(pendingOnlineOrder.orderId)}`);
        return;
      }
      setPaymentNotice({
        tone: latest.paymentStatus === 'Payment Failed' ? 'error' : 'warning',
        title: `Latest Status: ${latest.paymentStatus}`,
        message:
          latest.payment?.failureReason ||
          'Payment has not been captured yet. You can safely retry payment without creating a duplicate order.',
      });
    } catch (err) {
      setPaymentNotice({
        tone: 'error',
        title: 'Status Check Failed',
        message: err instanceof Error ? err.message : 'Unable to check payment status right now.',
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (placingOrder || verifyingPayment) return;
    setOrderError(null);
    setPaymentNotice(null);

    // If an online order was already created in this session, reuse it (NEVER create duplicate orders!)
    if (paymentMethod === 'online' && pendingOnlineOrder) {
      await launchRazorpayForOrder(pendingOnlineOrder);
      return;
    }

    const addrCheck = validateDeliveryAddress(address);
    if (!addrCheck.isValid) {
      setAddressErrors(addrCheck.errors);
      setStep(1);
      setOrderError('Please complete all required delivery address fields.');
      return;
    }

    if (hasStockIssues) {
      setOrderError('One or more items exceed live available stock. Please review your bag.');
      return;
    }

    setPlacingOrder(true);
    try {
      const createdOrder = await placeOrder({
        deliveryAddress: addrCheck.sanitized,
        deliveryMethod,
        paymentMethod,
        idempotencyKey,
      });

      if (paymentMethod === 'cod') {
        navigate(`/order-confirmation/${encodeURIComponent(createdOrder.orderId)}`);
        return;
      }

      // Online Razorpay payment: store created pending order so retries reuse this exact orderId
      setPendingOnlineOrder(createdOrder);
      setPaymentUiStatus(createdOrder.paymentStatus);
      setPlacingOrder(false);
      await launchRazorpayForOrder(createdOrder);
    } catch (err) {
      setPlacingOrder(false);
      setOrderError(
        err instanceof Error
          ? err.message
          : 'Order placement failed. Please verify your items and try again.'
      );
    }
  };

  const handleGuestAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const ok =
        authMode === 'login'
          ? await signInWithEmail(authEmail, authPassword)
          : await registerCustomer({
              displayName: authName,
              email: authEmail,
              password: authPassword,
            });
      if (!ok && ctxAuthError) {
        setAuthError(ctxAuthError.message);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Loading state while auth or cloud cart initializes
  if (authLoading || cartLoading) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00] mx-auto" />
          <p className="text-sm font-semibold text-[#1F1D2B]">Preparing Secure Checkout…</p>
        </div>
      </main>
    );
  }

  // Pending Online Payment Recovery View (kept active after cart clears so retries NEVER duplicate orders)
  if (pendingOnlineOrder && user) {
    return (
      <main className="mx-auto max-w-[820px] px-4 sm:px-6 lg:px-8 py-12 min-h-[75vh] fw-animate-fade">
        <section className="rounded-3xl border border-[#1F1D2B]/12 bg-white p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1F1D2B]/10 pb-5">
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ${getPaymentStatusBadgeClasses(
                  paymentUiStatus
                )}`}
              >
                {verifyingPayment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {paymentUiStatus}
              </span>
              <h1 className="font-heading text-2xl font-bold text-[#1F1D2B] mt-3">
                Complete Your Razorpay Payment
              </h1>
              <p className="text-xs text-[#1F1D2B]/70 mt-1">
                Order <strong className="font-mono">{pendingOnlineOrder.orderId}</strong> is safely
                created in Cloud Firestore. Retrying payment reuses this exact order (zero duplicate
                orders).
              </p>
            </div>
            <div className="rounded-2xl bg-[#FFF8EF] border border-[#1F1D2B]/10 px-4 py-3 text-right">
              <p className="text-[11px] text-[#1F1D2B]/60">Payable Amount</p>
              <p className="font-heading text-xl font-bold text-[#1F1D2B] tabular-nums">
                {formatINR(pendingOnlineOrder.totalAmount)}
              </p>
            </div>
          </div>

          {paymentNotice && (
            <div
              role="alert"
              className={`rounded-2xl border p-4 text-xs flex items-start gap-3 ${
                paymentNotice.tone === 'error'
                  ? 'border-[#DC2626]/35 bg-[#DC2626]/10 text-[#DC2626]'
                  : paymentNotice.tone === 'warning'
                    ? 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#1F1D2B]'
                    : paymentNotice.tone === 'success'
                      ? 'border-[#16A34A]/35 bg-[#16A34A]/10 text-[#16A34A]'
                      : 'border-[#2563EB]/30 bg-[#2563EB]/8 text-[#1F1D2B]'
              }`}
            >
              {paymentNotice.tone === 'error' ? (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              ) : paymentNotice.tone === 'warning' ? (
                <AlertTriangle className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
              ) : (
                <Info className="h-5 w-5 text-[#2563EB] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold text-sm">{paymentNotice.title}</p>
                <p className="mt-1 leading-relaxed">{paymentNotice.message}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              disabled={placingOrder || verifyingPayment}
              leftIcon={
                placingOrder || verifyingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )
              }
              onClick={() => void launchRazorpayForOrder(pendingOnlineOrder)}
            >
              {verifyingPayment
                ? 'Verifying Signature…'
                : placingOrder
                  ? 'Opening Razorpay…'
                  : `Retry Payment — ${formatINR(pendingOnlineOrder.totalAmount)}`}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              disabled={checkingStatus || verifyingPayment}
              leftIcon={
                checkingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )
              }
              onClick={() => void handleCheckPendingStatus()}
            >
              Check Latest Payment Status
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() =>
                navigate(`/order-confirmation/${encodeURIComponent(pendingOnlineOrder.orderId)}`)
              }
            >
              View Order Details
            </Button>
          </div>
        </section>
      </main>
    );
  }

  // Empty cart state
  if (cart.length === 0) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-14 min-h-[70vh]">
        <EmptyState
          title="Your shopping bag is empty"
          description="Add garments to your shopping bag before proceeding to checkout."
          actionLabel="Browse Collection"
          onAction={() => navigate('/search')}
        />
      </main>
    );
  }

  // Inline Authentication Gate for Guests (preserving guest cart for automatic cloud merge)
  if (!user) {
    return (
      <main className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-12 min-h-[75vh] fw-animate-fade">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Shopping Bag
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 rounded-3xl border border-[#1F1D2B]/12 bg-white p-6 sm:p-8 space-y-5">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFE4C7] px-3 py-1 text-xs font-semibold text-[#1F1D2B]">
                <Lock className="h-3.5 w-3.5 text-[#FF7A00]" />
                Authenticated Checkout
              </span>
              <h1 className="font-heading text-2xl font-bold text-[#1F1D2B] mt-3">
                Sign In to Complete Your Order
              </h1>
              <p className="text-xs text-[#1F1D2B]/70 mt-1 leading-relaxed">
                Sign in with your Fashion World account so we can securely sync your{' '}
                <strong>{cartSummary.totalItems} item(s)</strong> to Cloud Firestore, validate
                coupons, and save your order history.
              </p>
            </div>

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              disabled={authSubmitting}
              onClick={async () => {
                setAuthError(null);
                setAuthSubmitting(true);
                try {
                  await signInWithGoogle();
                } catch (err) {
                  setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
                } finally {
                  setAuthSubmitting(false);
                }
              }}
            >
              Continue with Google Account
            </Button>

            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-[#1F1D2B]/10" />
              <span className="px-3 text-[11px] font-medium text-[#1F1D2B]/50">
                or use Email &amp; Password
              </span>
              <div className="flex-1 border-t border-[#1F1D2B]/10" />
            </div>

            <div className="grid grid-cols-2 rounded-xl bg-[#FFF8EF] p-1 border border-[#1F1D2B]/10">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`h-9 rounded-lg text-xs font-semibold cursor-pointer ${
                  authMode === 'login' ? 'bg-white text-[#1F1D2B] shadow-xs' : 'text-[#1F1D2B]/65'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`h-9 rounded-lg text-xs font-semibold cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white text-[#1F1D2B] shadow-xs'
                    : 'text-[#1F1D2B]/65'
                }`}
              >
                Create Account
              </button>
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/8 p-3 text-xs text-[#DC2626] flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleGuestAuthSubmit} className="space-y-3">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Aarav Sharma"
                    className="h-11 w-full rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] px-3.5 text-sm focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] px-3.5 text-sm focus:border-[#FF7A00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="h-11 w-full rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] px-3.5 text-sm focus:border-[#FF7A00] focus:outline-none"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={authSubmitting}
              >
                {authSubmitting
                  ? 'Authenticating…'
                  : authMode === 'login'
                    ? 'Sign In & Continue to Checkout'
                    : 'Create Account & Continue'}
              </Button>
            </form>
          </div>

          <div className="md:col-span-5 rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
            <h2 className="font-heading text-base font-bold text-[#1F1D2B]">
              Bag Waiting for Checkout ({cartSummary.totalItems})
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.key} className="flex items-center gap-3 text-xs">
                  <ResilientImage
                    src={item.product.image}
                    alt={item.product.name}
                    className="h-14 w-12 rounded-lg object-cover shrink-0 bg-[#FFF8EF]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1F1D2B] truncate">{item.product.name}</p>
                    <p className="text-[#1F1D2B]/60">
                      {item.size} · {item.color} · Qty {item.quantity}
                    </p>
                  </div>
                  <span className="font-bold text-[#1F1D2B] tabular-nums">
                    {formatINR(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#1F1D2B]/10 pt-3 flex items-center justify-between text-sm font-bold">
              <span>Estimated Total</span>
              <span className="font-heading text-lg tabular-nums">
                {formatINR(cartSummary.totalAmount)}
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-10 min-h-[75vh] space-y-8 fw-animate-fade">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1D2B]/10 pb-5">
        <div>
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] mb-2 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Shopping Cart
          </button>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F1D2B]">
            Secure Multi-Step Checkout
          </h1>
        </div>

        {/* Step Indicator */}
        <ol className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto pb-1">
          {STEPS.map((s) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <li key={s.id} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  disabled={s.id > step}
                  onClick={() => {
                    if (s.id < step) setStep(s.id as 1 | 2 | 3 | 4);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                      : done
                        ? 'bg-[#16A34A]/15 text-[#16A34A] cursor-pointer hover:bg-[#16A34A]/20'
                        : 'bg-white border border-[#1F1D2B]/12 text-[#1F1D2B]/50'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      active
                        ? 'bg-[#FF7A00] text-white'
                        : done
                          ? 'bg-[#16A34A] text-white'
                          : 'bg-[#FFF8EF] text-[#1F1D2B]/60'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : s.id}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Order Error Banner */}
      {orderError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[#DC2626]/35 bg-[#DC2626]/10 p-4 text-sm text-[#DC2626]"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to Place Order</p>
            <p className="text-xs mt-0.5 leading-relaxed">{orderError}</p>
          </div>
          <button
            type="button"
            onClick={() => setOrderError(null)}
            aria-label="Dismiss error"
            className="p-1 rounded-lg hover:bg-white/60 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Active Step Panel */}
        <div className="lg:col-span-8 space-y-6">
          {/* STEP 1: DELIVERY ADDRESS */}
          {step === 1 && (
            <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-2 border-b border-[#1F1D2B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#FF7A00]">Step 1 of 4</p>
                  <h2 className="font-heading text-xl font-bold text-[#1F1D2B]">
                    Delivery Address
                  </h2>
                </div>
                <MapPin className="h-5 w-5 text-[#FF7A00]" />
              </div>

              {/* Saved Addresses Quick Picker */}
              {addresses.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-[#1F1D2B]">
                    Select a Saved Address ({addresses.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {addresses.map((saved) => {
                      const active = selectedSavedAddressId === saved.id;
                      return (
                        <button
                          key={saved.id}
                          type="button"
                          onClick={() => {
                            setSelectedSavedAddressId(saved.id);
                            setAddress({
                              fullName: saved.fullName,
                              mobile: saved.mobile,
                              email: saved.email,
                              houseFlat: saved.houseFlat,
                              streetArea: saved.streetArea,
                              landmark: saved.landmark,
                              city: saved.city,
                              state: saved.state,
                              pinCode: saved.pinCode,
                              deliveryInstructions: saved.deliveryInstructions,
                            });
                            setAddressErrors({});
                            setSaveNewAddress(false);
                          }}
                          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#FF7A00] bg-[#FFE4C7]/40 ring-2 ring-[#FF7A00]/20'
                              : 'border-[#1F1D2B]/12 bg-[#FFF8EF]/50 hover:border-[#FF7A00]/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-[#1F1D2B]">
                              {saved.fullName}
                            </span>
                            {saved.isDefault && (
                              <span className="rounded-md bg-[#1F1D2B] px-2 py-0.5 text-[10px] font-semibold text-[#FFA94D]">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#1F1D2B]/70 mt-1 line-clamp-2">
                            {saved.houseFlat}, {saved.streetArea}, {saved.city}, {saved.state} —{' '}
                            {saved.pinCode}
                          </p>
                          <p className="text-[11px] font-mono text-[#1F1D2B]/60 mt-1">
                            +91 {saved.mobile}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Address Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={address.fullName}
                    onChange={(e) => handleFieldChange('fullName', e.target.value)}
                    placeholder="Recipient full name"
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm focus:outline-none ${
                      addressErrors.fullName
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  />
                  {addressErrors.fullName && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    Mobile Number (India, 10 digits) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={address.mobile}
                    onChange={(e) =>
                      handleFieldChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    placeholder="9876543210"
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm font-mono focus:outline-none ${
                      addressErrors.mobile
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  />
                  {addressErrors.mobile && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.mobile}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={address.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="customer@example.com"
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm focus:outline-none ${
                      addressErrors.email
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  />
                  {addressErrors.email && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    House / Flat / Building No. *
                  </label>
                  <input
                    type="text"
                    value={address.houseFlat}
                    onChange={(e) => handleFieldChange('houseFlat', e.target.value)}
                    placeholder="Flat 402, Skyview Residency"
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm focus:outline-none ${
                      addressErrors.houseFlat
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  />
                  {addressErrors.houseFlat && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.houseFlat}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    Street / Area / Locality *
                  </label>
                  <input
                    type="text"
                    value={address.streetArea}
                    onChange={(e) => handleFieldChange('streetArea', e.target.value)}
                    placeholder="Bandra West, Linking Road"
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm focus:outline-none ${
                      addressErrors.streetArea
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  />
                  {addressErrors.streetArea && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.streetArea}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={address.landmark}
                    onChange={(e) => handleFieldChange('landmark', e.target.value)}
                    placeholder="Near City Mall"
                    className="h-11 w-full rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] px-3.5 text-sm focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">City *</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    placeholder="Mumbai"
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm focus:outline-none ${
                      addressErrors.city
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  />
                  {addressErrors.city && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">State *</label>
                  <select
                    value={address.state}
                    onChange={(e) => handleFieldChange('state', e.target.value)}
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm focus:outline-none ${
                      addressErrors.state
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {addressErrors.state && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.state}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    PIN Code (6 digits) *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={address.pinCode}
                    onChange={(e) =>
                      handleFieldChange('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="400050"
                    className={`h-11 w-full rounded-xl border bg-[#FFF8EF] px-3.5 text-sm font-mono focus:outline-none ${
                      addressErrors.pinCode
                        ? 'border-[#DC2626]'
                        : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                    }`}
                  />
                  {addressErrors.pinCode && (
                    <p className="mt-1 text-xs text-[#DC2626]">{addressErrors.pinCode}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#1F1D2B] mb-1">
                    Delivery Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={240}
                    value={address.deliveryInstructions}
                    onChange={(e) => handleFieldChange('deliveryInstructions', e.target.value)}
                    placeholder="Call on arrival, leave at reception, etc."
                    className="w-full rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] p-3 text-sm focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>
              </div>

              {!selectedSavedAddressId && (
                <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#1F1D2B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveNewAddress}
                    onChange={(e) => setSaveNewAddress(e.target.checked)}
                    className="h-4 w-4 accent-[#FF7A00] rounded"
                  />
                  Save this delivery address to my account for faster future checkouts
                </label>
              )}

              <div className="flex justify-end pt-2 border-t border-[#1F1D2B]/10">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => void handleContinueFromAddress()}
                >
                  Continue to Delivery Method
                </Button>
              </div>
            </section>
          )}

          {/* STEP 2: DELIVERY METHOD */}
          {step === 2 && (
            <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-2 border-b border-[#1F1D2B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#FF7A00]">Step 2 of 4</p>
                  <h2 className="font-heading text-xl font-bold text-[#1F1D2B]">
                    Choose Delivery Method
                  </h2>
                </div>
                <Truck className="h-5 w-5 text-[#FF7A00]" />
              </div>

              <div className="space-y-3">
                {(
                  [
                    {
                      id: 'standard' as DeliveryMethod,
                      title: 'Standard Insured Delivery',
                      eta: SHIPPING_RULES.STANDARD_ETA,
                      priceLabel:
                        cartSummary.subtotal - cartSummary.couponDiscount >=
                        SHIPPING_RULES.FREE_STANDARD_THRESHOLD_INR
                          ? 'FREE'
                          : formatINR(SHIPPING_RULES.STANDARD_CHARGE_INR),
                      detail: `Free on net orders ₹${SHIPPING_RULES.FREE_STANDARD_THRESHOLD_INR.toLocaleString('en-IN')}+, otherwise ₹${SHIPPING_RULES.STANDARD_CHARGE_INR}.`,
                    },
                    {
                      id: 'express' as DeliveryMethod,
                      title: 'Express Priority Delivery',
                      eta: SHIPPING_RULES.EXPRESS_ETA,
                      priceLabel: formatINR(SHIPPING_RULES.EXPRESS_CHARGE_INR),
                      detail: 'Priority dispatch with tamper-evident garment packaging.',
                    },
                  ] as const
                ).map((option) => {
                  const selected = deliveryMethod === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDeliveryMethod(option.id)}
                      className={`w-full rounded-2xl border p-5 text-left transition-all flex items-start justify-between gap-4 cursor-pointer ${
                        selected
                          ? 'border-[#FF7A00] bg-[#FFE4C7]/35 ring-2 ring-[#FF7A00]/20'
                          : 'border-[#1F1D2B]/12 bg-[#FFF8EF]/50 hover:border-[#FF7A00]/60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              selected ? 'border-[#FF7A00] bg-[#FF7A00]' : 'border-[#1F1D2B]/30'
                            }`}
                          >
                            {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="font-heading text-sm font-bold text-[#1F1D2B]">
                            {option.title}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#1F1D2B]/75 pl-6">
                          Estimated Window: {option.eta}
                        </p>
                        <p className="text-xs text-[#1F1D2B]/60 pl-6">{option.detail}</p>
                      </div>
                      <span
                        className={`font-heading text-base font-bold shrink-0 tabular-nums ${
                          option.priceLabel === 'FREE' ? 'text-[#16A34A]' : 'text-[#1F1D2B]'
                        }`}
                      >
                        {option.priceLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#2563EB]/25 bg-[#2563EB]/8 p-3.5 text-xs text-[#1F1D2B]/80">
                <Info className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                <p>
                  Delivery estimates and rates reflect configured Fashion World store shipping
                  rules. Live third-party courier API rate lookups are not active in Phase 6.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1F1D2B]/10">
                <Button variant="outline" size="md" onClick={() => setStep(1)}>
                  Back to Address
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => {
                    setStep(3);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Continue to Order Review
                </Button>
              </div>
            </section>
          )}

          {/* STEP 3: ORDER REVIEW */}
          {step === 3 && (
            <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-2 border-b border-[#1F1D2B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#FF7A00]">Step 3 of 4</p>
                  <h2 className="font-heading text-xl font-bold text-[#1F1D2B]">
                    Review Your Order
                  </h2>
                </div>
                <Package className="h-5 w-5 text-[#FF7A00]" />
              </div>

              {/* Address & Delivery Recap */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/70 p-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1F1D2B]">Delivering To</span>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="font-semibold text-[#1F1D2B]">{address.fullName}</p>
                  <p className="text-[#1F1D2B]/75">
                    {address.houseFlat}, {address.streetArea}
                    {address.landmark ? `, ${address.landmark}` : ''}
                  </p>
                  <p className="text-[#1F1D2B]/75">
                    {address.city}, {address.state} — {address.pinCode}
                  </p>
                  <p className="font-mono text-[#1F1D2B]/65">
                    +91 {address.mobile} · {address.email}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/70 p-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1F1D2B]">Delivery Option</span>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                  <p className="font-semibold text-[#1F1D2B]">
                    {deliveryMethod === 'express'
                      ? 'Express Priority Delivery'
                      : 'Standard Insured Delivery'}
                  </p>
                  <p className="text-[#1F1D2B]/75">
                    Estimated Window:{' '}
                    {deliveryMethod === 'express'
                      ? SHIPPING_RULES.EXPRESS_ETA
                      : SHIPPING_RULES.STANDARD_ETA}
                  </p>
                  <p className="font-semibold text-[#16A34A] tabular-nums">
                    Charge:{' '}
                    {cartSummary.deliveryCharge === 0
                      ? 'FREE'
                      : formatINR(cartSummary.deliveryCharge)}
                  </p>
                </div>
              </div>

              {/* Items Review List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F1D2B]/60">
                  Items in Order ({cartSummary.totalItems})
                </h3>
                {cart.map((item) => {
                  const stockOk =
                    item.isPublished &&
                    item.availableStock > 0 &&
                    item.quantity <= item.availableStock;
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-3.5 rounded-2xl border border-[#1F1D2B]/10 p-3.5"
                    >
                      <ResilientImage
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-18 w-14 rounded-xl object-cover shrink-0 bg-[#FFF8EF]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-sm font-semibold text-[#1F1D2B] truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-[#1F1D2B]/60">
                          Size {item.size} · {item.color} · SKU {item.sku}
                        </p>
                        <p
                          className={`text-[11px] font-semibold mt-0.5 ${
                            stockOk ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}
                        >
                          {stockOk
                            ? `In Stock (${item.availableStock} available) · Qty ${item.quantity}`
                            : 'Insufficient stock — please update cart'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-[#1F1D2B]/55 tabular-nums">
                          {formatINR(item.unitPrice)} × {item.quantity}
                        </p>
                        <p className="font-heading text-sm font-bold text-[#1F1D2B] tabular-nums">
                          {formatINR(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupon Quick Check */}
              <div className="rounded-2xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/70 p-4 space-y-2.5">
                <p className="text-xs font-bold text-[#1F1D2B] flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[#FF7A00]" />
                  Discount Coupon
                </p>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#16A34A]">
                      ✓ {appliedCoupon.code} applied (-{formatINR(cartSummary.couponDiscount)})
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-[#DC2626] font-semibold hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className="h-10 flex-1 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-xs font-mono uppercase focus:border-[#FF7A00] focus:outline-none"
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? 'Checking…' : 'Apply'}
                    </Button>
                  </form>
                )}
                {couponError && <p className="text-xs text-[#DC2626]">{couponError}</p>}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1F1D2B]/10">
                <Button variant="outline" size="md" onClick={() => setStep(2)}>
                  Back to Delivery
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={hasStockIssues}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => {
                    setStep(4);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Continue to Payment
                </Button>
              </div>
            </section>
          )}

          {/* STEP 4: PAYMENT METHOD SELECTION */}
          {step === 4 && (
            <section className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-2 border-b border-[#1F1D2B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#FF7A00]">Step 4 of 4</p>
                  <h2 className="font-heading text-xl font-bold text-[#1F1D2B]">
                    Select Payment Method
                  </h2>
                </div>
                <ShieldCheck className="h-5 w-5 text-[#16A34A]" />
              </div>

              <div className="space-y-3.5">
                {/* Online Payment (Phase 7 Official Razorpay Gateway) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`w-full rounded-2xl border p-5 text-left transition-all cursor-pointer ${
                    paymentMethod === 'online'
                      ? 'border-[#FF7A00] bg-[#FFE4C7]/35 ring-2 ring-[#FF7A00]/20'
                      : 'border-[#1F1D2B]/12 bg-[#FFF8EF]/50 hover:border-[#FF7A00]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/12 text-[#2563EB] shrink-0">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-heading text-sm font-bold text-[#1F1D2B]">
                          Online Payment via Razorpay
                        </p>
                        <p className="text-xs text-[#1F1D2B]/70 mt-0.5 leading-relaxed">
                          Pay securely using{' '}
                          <strong>
                            UPI, Google Pay, PhonePe, Paytm, Debit Cards, Credit Cards, or Net
                            Banking
                          </strong>
                          . Verified cryptographically on the server via HMAC-SHA256.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {['UPI', 'Google Pay', 'PhonePe', 'Paytm', 'Cards', 'Net Banking'].map(
                            (m) => (
                              <span
                                key={m}
                                className="rounded-md border border-[#1F1D2B]/10 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1F1D2B]/75"
                              >
                                {m}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold shrink-0 ${
                        razorpayConfig?.mode === 'test'
                          ? 'bg-[#2563EB]/12 text-[#2563EB]'
                          : razorpayConfig?.mode === 'live'
                            ? 'bg-[#16A34A]/15 text-[#16A34A]'
                            : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                      }`}
                    >
                      {razorpayConfig?.mode === 'test'
                        ? 'Test Mode Ready'
                        : razorpayConfig?.mode === 'live'
                          ? 'Razorpay Live'
                          : 'Credentials Pending'}
                    </span>
                  </div>
                </button>

                {/* Cash on Delivery (Preserved from Phase 6) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`w-full rounded-2xl border p-5 text-left transition-all cursor-pointer ${
                    paymentMethod === 'cod'
                      ? 'border-[#FF7A00] bg-[#FFE4C7]/35 ring-2 ring-[#FF7A00]/20'
                      : 'border-[#1F1D2B]/12 bg-[#FFF8EF]/50 hover:border-[#FF7A00]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16A34A]/15 text-[#16A34A] shrink-0">
                        <Banknote className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-heading text-sm font-bold text-[#1F1D2B]">
                          Cash on Delivery (COD)
                        </p>
                        <p className="text-xs text-[#1F1D2B]/70 mt-0.5">
                          Pay securely in cash or UPI upon delivery. Order is recorded with payment
                          status <strong>COD Pending</strong>.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-[#16A34A]/15 px-2.5 py-1 text-[11px] font-bold text-[#16A34A] shrink-0">
                      Available Now
                    </span>
                  </div>
                </button>
              </div>

              {paymentMethod === 'online' && razorpayConfig && !razorpayConfig.configured && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3.5 text-xs text-[#1F1D2B]">
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Razorpay Test Credentials Not Configured Yet</p>
                    <p className="mt-0.5 leading-relaxed">
                      {razorpayConfig.message} Fashion World will never simulate a paid order. You
                      can configure <code className="font-mono">RAZORPAY_KEY_ID</code> &amp;{' '}
                      <code className="font-mono">RAZORPAY_KEY_SECRET</code> in backend Secrets (see{' '}
                      <code className="font-mono">RAZORPAY_SETUP.md</code>), or use Cash on Delivery
                      right now.
                    </p>
                  </div>
                </div>
              )}

              {paymentMethod === 'online' && razorpayConfig?.configured && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/8 p-3.5 text-xs text-[#1F1D2B]">
                  <ShieldCheck className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
                  <p>
                    <strong>PCI-DSS Hosted Checkout:</strong> Your card number, CVV, and UPI PIN are
                    handled exclusively inside Razorpay&apos;s encrypted checkout window and are
                    never stored on Fashion World servers.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1F1D2B]/10">
                <Button
                  variant="outline"
                  size="md"
                  disabled={placingOrder || verifyingPayment}
                  onClick={() => setStep(3)}
                >
                  Back to Review
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={placingOrder || verifyingPayment || hasStockIssues}
                  leftIcon={
                    placingOrder || verifyingPayment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )
                  }
                  onClick={() => void handlePlaceOrder()}
                >
                  {verifyingPayment
                    ? 'Verifying Payment…'
                    : placingOrder
                      ? paymentMethod === 'online'
                        ? 'Creating Order & Opening Razorpay…'
                        : 'Verifying Stock & Placing Order…'
                      : paymentMethod === 'online'
                        ? `Pay Now with Razorpay — ${formatINR(cartSummary.totalAmount)}`
                        : `Place COD Order — ${formatINR(cartSummary.totalAmount)}`}
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Right: Persistent Live Order Summary Sidebar */}
        <aside className="lg:col-span-4 rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4 lg:sticky lg:top-24">
          <h2 className="font-heading text-lg font-bold text-[#1F1D2B]">Order Summary</h2>

          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 border-b border-[#1F1D2B]/10 pb-4">
            {cart.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1F1D2B] truncate">{item.product.name}</p>
                  <p className="text-[#1F1D2B]/55">
                    {item.size} · {item.color} × {item.quantity}
                  </p>
                </div>
                <span className="font-semibold text-[#1F1D2B] tabular-nums shrink-0">
                  {formatINR(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <dl className="space-y-2 text-sm border-b border-[#1F1D2B]/10 pb-4">
            <div className="flex justify-between">
              <dt className="text-[#1F1D2B]/70">Items ({cartSummary.totalItems})</dt>
              <dd className="font-semibold tabular-nums">{formatINR(cartSummary.subtotal)}</dd>
            </div>
            {cartSummary.couponDiscount > 0 && (
              <div className="flex justify-between text-[#16A34A]">
                <dt>Coupon ({cartSummary.couponCode})</dt>
                <dd className="font-semibold tabular-nums">
                  -{formatINR(cartSummary.couponDiscount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[#1F1D2B]/70">
                Delivery ({deliveryMethod === 'express' ? 'Express' : 'Standard'})
              </dt>
              <dd
                className={`font-semibold tabular-nums ${
                  cartSummary.deliveryCharge === 0 ? 'text-[#16A34A]' : 'text-[#1F1D2B]'
                }`}
              >
                {cartSummary.deliveryCharge === 0
                  ? 'Free'
                  : formatINR(cartSummary.deliveryCharge)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#1F1D2B]/70">Tax (GST Inclusive)</dt>
              <dd className="font-semibold tabular-nums">₹0</dd>
            </div>
          </dl>

          <div className="flex items-center justify-between">
            <span className="font-bold text-[#1F1D2B]">Payable Total</span>
            <span className="font-heading text-xl font-bold text-[#1F1D2B] tabular-nums">
              {formatINR(cartSummary.totalAmount)}
            </span>
          </div>

          <div className="rounded-xl bg-[#FFF8EF] border border-[#1F1D2B]/8 p-3 text-[11px] text-[#1F1D2B]/70 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
            <span>
              Protected by atomic Cloud Firestore transactions &amp; server-side price, coupon, and
              status security rules.
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
};
