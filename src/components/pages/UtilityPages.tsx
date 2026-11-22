import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Headphones,
  Heart,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Star,
  Trash2,
  Truck,
  User,
  UserPlus,
} from 'lucide-react';
import { useRouter } from '../../router/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { useStore } from '../../context/StoreContext';
import { fetchOrderById } from '../../firebase/commerce';
import {
  INDIAN_STATES,
  type AddressValidationErrors,
  type DeliveryAddressInput,
  type OrderDoc,
} from '../../types/commerce';
import { formatINR, validateDeliveryAddress } from '../../utils/commerceHelpers';
import { ProductCard } from '../storefront/ProductCard';
import { OrderStatusTimeline, getOrderStatusBadgeClasses } from './OrdersPage';
import {
  Button,
  EmptyState,
  InputField,
  StatusAlert,
} from '../ui/Primitives';
import { useToast } from '../ui/Overlays';
export { CartPage } from './CartPage';

/* -------------------------------------------------------------------------- */
/* 1. WISHLIST PAGE (/wishlist)                                               */
/* -------------------------------------------------------------------------- */

export const WishlistPage: React.FC = () => {
  const { navigate } = useRouter();
  const { products } = useCatalog();
  const { wishlistIds, toggleWishlist, addToCart, openQuickView } = useStore();
  const savedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[70vh] fw-animate-fade space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] mb-3 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">Curated Favorites</p>
            <h1 className="mt-1 font-heading text-2xl sm:text-4xl font-bold text-[#1F1D2B]">
              Saved Wishlist ({savedProducts.length})
            </h1>
          </div>
          <Button variant="outline" size="md" onClick={() => navigate('/new-arrivals')}>
            Discover More Styles
          </Button>
        </div>
      </div>

      {savedProducts.length === 0 ? (
        <EmptyState
          title="Your wishlist is currently empty"
          description="Save tailored shirts, Banarasi silk sarees, and outerwear as you explore 3D Jummo Fashion World."
          actionLabel="Explore New Arrivals"
          onAction={() => navigate('/new-arrivals')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {savedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product.legacyProduct}
              productSlug={product.slug}
              layout="desktop"
              isWishlisted
              onToggleWishlist={toggleWishlist}
              onAddToCart={addToCart}
              onQuickView={openQuickView}
              onViewDetails={() => navigate(`/product/${product.slug}`)}
            />
          ))}
        </div>
      )}
    </main>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. ACCOUNT PAGE (/account — Real Firebase Auth, Orders & Saved Addresses)  */
/* -------------------------------------------------------------------------- */

const EMPTY_SAVED_ADDRESS: DeliveryAddressInput = {
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

export const AccountPage: React.FC = () => {
  const { navigate } = useRouter();
  const {
    wishlistIds,
    totalCartItems,
    orders,
    ordersLoading,
    addresses,
    addressesLoading,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
  } = useStore();
  const {
    user,
    profile,
    role,
    isAdmin,
    authReady,
    authBusy,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    registerCustomer,
    sendPasswordReset,
    logout,
    updateProfileDetails,
  } = useAuth();

  const [authTab, setAuthTab] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [editName, setEditName] = useState(profile?.displayName || user?.displayName || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<DeliveryAddressInput>(EMPTY_SAVED_ADDRESS);
  const [addrErrors, setAddrErrors] = useState<AddressValidationErrors>({});
  const [savingAddr, setSavingAddr] = useState(false);

  React.useEffect(() => {
    setEditName(profile?.displayName || user?.displayName || '');
    setEditPhone(profile?.phone || '');
    if (user) {
      setNewAddress((prev) => ({
        ...prev,
        fullName: prev.fullName || profile?.displayName || user.displayName || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [profile?.displayName, profile?.phone, user]);

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateDeliveryAddress(newAddress);
    if (!check.isValid) {
      setAddrErrors(check.errors);
      return;
    }
    setAddrErrors({});
    setSavingAddr(true);
    try {
      await saveAddress(check.sanitized, { isDefault: addresses.length === 0 });
      setNewAddress({
        ...EMPTY_SAVED_ADDRESS,
        fullName: profile?.displayName || user?.displayName || '',
        email: user?.email || '',
      });
      setShowAddressForm(false);
    } finally {
      setSavingAddr(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearAuthError();

    if (authTab === 'login') {
      if (!email.trim() || !password) {
        setLocalError('Please enter both email and password.');
        return;
      }
      await signInWithEmail(email, password);
    } else if (authTab === 'register') {
      if (!displayName.trim() || !email.trim() || password.length < 6) {
        setLocalError('Enter your name, a valid email, and a password of at least 6 characters.');
        return;
      }
      await registerCustomer({ displayName, email, password, phone });
    } else {
      if (!email.trim()) {
        setLocalError('Enter your registered email to receive a password reset link.');
        return;
      }
      const ok = await sendPasswordReset(email);
      if (ok) setResetSent(true);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileDetails({ displayName: editName, phone: editPhone });
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[70vh] fw-animate-fade space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] mb-3 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>
        <h1 className="font-heading text-2xl sm:text-4xl font-bold text-[#1F1D2B]">
          User Account &amp; Firebase Profile
        </h1>
      </div>

      {!authReady ? (
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-10 flex items-center justify-center gap-3 text-sm font-medium text-[#1F1D2B]/70">
          <Loader2 className="h-5 w-5 animate-spin text-[#FF7A00]" />
          Checking Firebase Authentication session...
        </div>
      ) : !user ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sign In / Registration / Password Reset Card */}
          <div className="lg:col-span-6 rounded-2xl border border-[#1F1D2B]/12 bg-white p-6 sm:p-8 space-y-5">
            <div className="flex rounded-xl bg-[#FFF8EF] p-1 border border-[#1F1D2B]/10">
              {[
                { id: 'login', label: 'Sign In' },
                { id: 'register', label: 'Create Account' },
                { id: 'reset', label: 'Forgot Password' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setAuthTab(t.id as typeof authTab);
                    setLocalError('');
                    setResetSent(false);
                    clearAuthError();
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    authTab === t.id
                      ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                      : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {(localError || authError) && (
              <StatusAlert
                variant={localError ? 'error' : authError?.tone || 'error'}
                title={localError ? 'Check Details' : authError?.title || 'Authentication Error'}
                description={localError || authError?.message || ''}
              />
            )}

            {resetSent && authTab === 'reset' && (
              <StatusAlert
                variant="success"
                title="Password Reset Email Sent"
                description="Follow the secure link sent to your inbox to set a new password."
              />
            )}

            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={authBusy}
              onClick={() => void signInWithGoogle()}
              leftIcon={
                authBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )
              }
            >
              Continue with Google
            </Button>

            <div className="relative flex items-center">
              <div className="flex-1 border-t border-[#1F1D2B]/12" />
              <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#1F1D2B]/45">
                Or Email &amp; Password
              </span>
              <div className="flex-1 border-t border-[#1F1D2B]/12" />
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authTab === 'register' && (
                <>
                  <InputField
                    id="cust-reg-name"
                    label="Full Name"
                    placeholder="e.g. Aarav Sharma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    leftIcon={<User className="h-4 w-4" />}
                    required
                  />
                  <InputField
                    id="cust-reg-phone"
                    label="Phone Number (Optional)"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    leftIcon={<Phone className="h-4 w-4" />}
                  />
                </>
              )}

              <InputField
                id="cust-auth-email"
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
              />

              {authTab !== 'reset' && (
                <InputField
                  id="cust-auth-password"
                  label="Password"
                  type="password"
                  placeholder={authTab === 'register' ? 'Minimum 6 characters' : 'Enter password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="h-4 w-4" />}
                  required
                />
              )}

              <Button
                type="submit"
                variant="secondary"
                size="md"
                fullWidth
                disabled={authBusy}
                leftIcon={
                  authTab === 'register' ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )
                }
              >
                {authBusy
                  ? 'Please wait...'
                  : authTab === 'login'
                    ? 'Sign In with Email'
                    : authTab === 'register'
                      ? 'Create Customer Account'
                      : 'Send Password Reset Link'}
              </Button>
            </form>
          </div>

          {/* Info Card */}
          <div className="lg:col-span-6 rounded-2xl bg-[#1F1D2B] text-[#FFF8EF] p-6 sm:p-8 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#FFA94D]">
              Firebase Authentication &amp; Cloud Security
            </p>
            <h2 className="font-heading text-2xl font-bold">
              Secure Member &amp; Admin Access
            </h2>
            <p className="text-sm text-[#FFF8EF]/75 leading-relaxed">
              Sign in with Google or Email/Password to store your customer profile securely in
              Cloud Firestore under strict owner-only privacy rules. Authorized store
              administrators automatically unlock the protected Admin Dashboard.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div className="rounded-xl bg-white/8 p-4">
                <p className="font-heading text-xl font-bold tabular-nums">{wishlistIds.length}</p>
                <p className="text-xs text-[#FFF8EF]/65 mt-0.5">Saved Wishlist Items</p>
              </div>
              <div className="rounded-xl bg-white/8 p-4">
                <p className="font-heading text-xl font-bold tabular-nums">{totalCartItems}</p>
                <p className="text-xs text-[#FFF8EF]/65 mt-0.5">Items in Bag</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Authenticated Profile Summary */}
          <div className="lg:col-span-4 rounded-2xl border border-[#1F1D2B]/10 bg-[#1F1D2B] text-[#FFF8EF] p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF7A00] font-heading text-xl font-bold text-white">
                {(profile?.displayName || user.displayName || user.email || 'M')
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-semibold truncate">
                  {profile?.displayName || user.displayName || 'Fashion World Member'}
                </h2>
                <p className="text-xs text-[#FFF8EF]/70 truncate">{user.email}</p>
                <span className="mt-1 inline-block rounded-md bg-[#FFA94D]/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[#FFA94D]">
                  {role.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="rounded-xl bg-white/8 p-3 text-left hover:bg-white/14 transition-colors cursor-pointer"
              >
                <Package className="h-4 w-4 text-[#FFA94D]" />
                <p className="mt-2 font-heading text-lg font-bold tabular-nums">{orders.length}</p>
                <p className="text-[11px] text-[#FFF8EF]/65">Orders</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/wishlist')}
                className="rounded-xl bg-white/8 p-3 text-left hover:bg-white/14 transition-colors cursor-pointer"
              >
                <Heart className="h-4 w-4 text-[#FFA94D]" />
                <p className="mt-2 font-heading text-lg font-bold tabular-nums">
                  {wishlistIds.length}
                </p>
                <p className="text-[11px] text-[#FFF8EF]/65">Wishlist</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="rounded-xl bg-white/8 p-3 text-left hover:bg-white/14 transition-colors cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4 text-[#FFA94D]" />
                <p className="mt-2 font-heading text-lg font-bold tabular-nums">
                  {totalCartItems}
                </p>
                <p className="text-[11px] text-[#FFF8EF]/65">In Bag</p>
              </button>
            </div>

            {isAdmin && (
              <Button
                variant="primary"
                size="md"
                fullWidth
                leftIcon={<LayoutDashboard className="h-4 w-4" />}
                onClick={() => navigate('/admin')}
              >
                Open Admin Console
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              fullWidth
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={() => void logout()}
              className="border-white/20 text-[#FFF8EF] hover:border-[#DC2626] hover:text-[#DC2626]"
            >
              Sign Out
            </Button>
          </div>

          {/* Firestore Profile Form + Orders Preview */}
          <div className="lg:col-span-8 space-y-6">
            <form
              onSubmit={handleProfileSave}
              className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-[#1F1D2B]">
                    Cloud Profile Details
                  </h2>
                  <p className="text-xs text-[#1F1D2B]/55">
                    Stored privately in Cloud Firestore (<code className="font-mono">users/{user.uid.slice(0, 8)}…</code>)
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={authBusy}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Save Profile
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  id="profile-name"
                  label="Full Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
                <InputField
                  id="profile-phone"
                  label="Phone Number"
                  placeholder="+91 98765 43210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </form>

            {/* Real-Time Cloud Firestore Customer Orders */}
            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-[#1F1D2B]">
                    My Orders ({orders.length})
                  </h2>
                  <p className="text-xs text-[#1F1D2B]/55">
                    Real-time order history stored securely in Cloud Firestore
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/track-order')}>
                    Track Order
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/orders')}>
                    View All Orders
                  </Button>
                </div>
              </div>

              {ordersLoading ? (
                <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#1F1D2B]/60">
                  <Loader2 className="h-4 w-4 animate-spin text-[#FF7A00]" />
                  Loading your orders…
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#1F1D2B]/15 bg-[#FFF8EF]/60 p-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#1F1D2B]">No orders placed yet</p>
                  <p className="text-xs text-[#1F1D2B]/60">
                    Your confirmed orders will appear here immediately after checkout.
                  </p>
                  <Button variant="primary" size="sm" onClick={() => navigate('/search')}>
                    Start Shopping
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 4).map((order) => (
                    <button
                      key={order.orderId}
                      type="button"
                      onClick={() => navigate(`/orders/${encodeURIComponent(order.orderId)}`)}
                      className="w-full text-left flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF] p-4 hover:border-[#FF7A00] transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-[#1F1D2B]">
                          {order.orderId}
                        </p>
                        <p className="text-xs text-[#1F1D2B]/60 tabular-nums mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString('en-IN')} ·{' '}
                          {order.items.reduce((s, i) => s + i.quantity, 0)} item(s) ·{' '}
                          <strong className="text-[#1F1D2B]">
                            {formatINR(order.totalAmount)}
                          </strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${getOrderStatusBadgeClasses(
                            order.orderStatus
                          )}`}
                        >
                          {order.orderStatus}
                        </span>
                        <ArrowRight className="h-4 w-4 text-[#1F1D2B]/40" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Delivery Addresses CRUD */}
            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-[#1F1D2B]">
                    Saved Delivery Addresses ({addresses.length})
                  </h2>
                  <p className="text-xs text-[#1F1D2B]/55">
                    Used to pre-fill Step 1 of checkout (<code className="font-mono">users/{user.uid.slice(0, 8)}…/addresses</code>)
                  </p>
                </div>
                <Button
                  variant={showAddressForm ? 'outline' : 'primary'}
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setShowAddressForm((v) => !v)}
                >
                  {showAddressForm ? 'Cancel' : 'Add Address'}
                </Button>
              </div>

              {showAddressForm && (
                <form
                  onSubmit={handleSaveNewAddress}
                  className="rounded-2xl border border-[#FF7A00]/30 bg-[#FFF8EF]/70 p-4 sm:p-5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={newAddress.fullName}
                        onChange={(e) =>
                          setNewAddress((p) => ({ ...p, fullName: e.target.value }))
                        }
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm"
                      />
                      {addrErrors.fullName && (
                        <p className="text-[#DC2626] mt-0.5">{addrErrors.fullName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">
                        Mobile (10-digit India) *
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={newAddress.mobile}
                        onChange={(e) =>
                          setNewAddress((p) => ({
                            ...p,
                            mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                          }))
                        }
                        placeholder="9876543210"
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm font-mono"
                      />
                      {addrErrors.mobile && (
                        <p className="text-[#DC2626] mt-0.5">{addrErrors.mobile}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[#1F1D2B] mb-1">Email *</label>
                      <input
                        type="email"
                        value={newAddress.email}
                        onChange={(e) => setNewAddress((p) => ({ ...p, email: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm"
                      />
                      {addrErrors.email && (
                        <p className="text-[#DC2626] mt-0.5">{addrErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">
                        House / Flat No. *
                      </label>
                      <input
                        type="text"
                        value={newAddress.houseFlat}
                        onChange={(e) =>
                          setNewAddress((p) => ({ ...p, houseFlat: e.target.value }))
                        }
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm"
                      />
                      {addrErrors.houseFlat && (
                        <p className="text-[#DC2626] mt-0.5">{addrErrors.houseFlat}</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">
                        Street / Area *
                      </label>
                      <input
                        type="text"
                        value={newAddress.streetArea}
                        onChange={(e) =>
                          setNewAddress((p) => ({ ...p, streetArea: e.target.value }))
                        }
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm"
                      />
                      {addrErrors.streetArea && (
                        <p className="text-[#DC2626] mt-0.5">{addrErrors.streetArea}</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">City *</label>
                      <input
                        type="text"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm"
                      />
                      {addrErrors.city && (
                        <p className="text-[#DC2626] mt-0.5">{addrErrors.city}</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">State *</label>
                      <select
                        value={newAddress.state}
                        onChange={(e) => setNewAddress((p) => ({ ...p, state: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm"
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">
                        PIN Code (6 digits) *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={newAddress.pinCode}
                        onChange={(e) =>
                          setNewAddress((p) => ({
                            ...p,
                            pinCode: e.target.value.replace(/\D/g, '').slice(0, 6),
                          }))
                        }
                        placeholder="400050"
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm font-mono"
                      />
                      {addrErrors.pinCode && (
                        <p className="text-[#DC2626] mt-0.5">{addrErrors.pinCode}</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1F1D2B] mb-1">
                        Landmark (Optional)
                      </label>
                      <input
                        type="text"
                        value={newAddress.landmark}
                        onChange={(e) =>
                          setNewAddress((p) => ({ ...p, landmark: e.target.value }))
                        }
                        className="h-10 w-full rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm" disabled={savingAddr}>
                      {savingAddr ? 'Saving Address…' : 'Save Delivery Address'}
                    </Button>
                  </div>
                </form>
              )}

              {addressesLoading ? (
                <div className="py-4 text-xs text-[#1F1D2B]/60">Loading saved addresses…</div>
              ) : addresses.length === 0 ? (
                <p className="text-xs text-[#1F1D2B]/60">
                  No saved addresses yet. Add one here or save automatically during checkout.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF]/70 p-4 flex flex-col justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#1F1D2B]">{addr.fullName}</span>
                          {addr.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#1F1D2B] px-2 py-0.5 text-[10px] font-bold text-[#FFA94D]">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[#1F1D2B]/75">
                          {addr.houseFlat}, {addr.streetArea}
                          {addr.landmark ? `, ${addr.landmark}` : ''}
                        </p>
                        <p className="text-[#1F1D2B]/75">
                          {addr.city}, {addr.state} — {addr.pinCode}
                        </p>
                        <p className="font-mono text-[#1F1D2B]/60">+91 {addr.mobile}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#1F1D2B]/10">
                        {!addr.isDefault ? (
                          <button
                            type="button"
                            onClick={() => void setDefaultAddress(addr.id)}
                            className="font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                          >
                            Set as Default
                          </button>
                        ) : (
                          <span className="text-[#16A34A] font-semibold">Checkout Default</span>
                        )}
                        <button
                          type="button"
                          onClick={() => void deleteAddress(addr.id)}
                          className="inline-flex items-center gap-1 font-semibold text-[#DC2626] hover:underline cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. TRACK ORDER PAGE (/track-order — Live Firestore Customer Order Lookup)  */
/* -------------------------------------------------------------------------- */

export const TrackOrderPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user, authReady } = useAuth();
  const { orders } = useStore();

  const [orderInput, setOrderInput] = useState('');
  const [matchedOrder, setMatchedOrder] = useState<OrderDoc | null>(null);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const runLookup = async (rawId: string) => {
    const clean = rawId.trim();
    if (!clean) return;
    setSearching(true);
    setLookupError(null);
    setMatchedOrder(null);
    try {
      const found = await fetchOrderById(clean);
      if (!found) {
        setLookupError(`No order found with ID "${clean}" on your account.`);
      } else {
        setMatchedOrder(found);
      }
    } catch (err) {
      setLookupError(
        err instanceof Error
          ? err.message
          : 'Unable to look up this order. Verify the Order ID belongs to your account.'
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[70vh] fw-animate-fade space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] mb-3 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>
        <h1 className="font-heading text-2xl sm:text-4xl font-bold text-[#1F1D2B]">
          Track Your Order
        </h1>
        <p className="mt-1 text-sm text-[#1F1D2B]/65">
          Enter your Fashion World Order ID (e.g. <span className="font-mono font-semibold">FW-…</span>)
          to inspect live order status from Cloud Firestore.
        </p>
      </div>

      {!authReady ? (
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-8 flex items-center gap-3 text-sm text-[#1F1D2B]/70">
          <Loader2 className="h-5 w-5 animate-spin text-[#FF7A00]" />
          Checking authentication…
        </div>
      ) : !user ? (
        <EmptyState
          title="Sign In to Track Your Orders"
          description="For customer privacy, order details are protected by Firestore security rules and only visible to the account that placed the order."
          actionLabel="Sign In to Account"
          onAction={() => navigate('/account')}
        />
      ) : (
        <div className="max-w-3xl space-y-6">
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runLookup(orderInput);
              }}
              className="flex flex-col sm:flex-row gap-3 items-end"
            >
              <div className="flex-1 w-full">
                <InputField
                  label="Order Reference ID"
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  placeholder="FW-..."
                  leftIcon={<Package className="h-4 w-4" />}
                />
              </div>
              <Button type="submit" variant="primary" size="md" disabled={searching || !orderInput.trim()}>
                {searching ? 'Checking…' : 'Track Order'}
              </Button>
            </form>

            {orders.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#1F1D2B]/10">
                <p className="text-xs font-semibold text-[#1F1D2B]/65">
                  Your Recent Orders (Click to inspect):
                </p>
                <div className="flex flex-wrap gap-2">
                  {orders.slice(0, 5).map((o) => (
                    <button
                      key={o.orderId}
                      type="button"
                      onClick={() => {
                        setOrderInput(o.orderId);
                        setMatchedOrder(o);
                        setLookupError(null);
                      }}
                      className="rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-3 py-1.5 font-mono text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer"
                    >
                      {o.orderId}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {lookupError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/8 p-3.5 text-xs text-[#DC2626]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{lookupError}</span>
              </div>
            )}

            {matchedOrder && (
              <div className="space-y-4 pt-3 border-t border-[#1F1D2B]/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-base font-bold text-[#1F1D2B]">
                      {matchedOrder.orderId}
                    </p>
                    <p className="text-xs text-[#1F1D2B]/65">
                      {matchedOrder.deliveryAddress.fullName} · {matchedOrder.deliveryAddress.city}{' '}
                      ({matchedOrder.deliveryAddress.pinCode}) · Total{' '}
                      <strong>{formatINR(matchedOrder.totalAmount)}</strong>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/orders/${encodeURIComponent(matchedOrder.orderId)}`)}
                  >
                    Full Order Details
                  </Button>
                </div>
                <OrderStatusTimeline status={matchedOrder.orderStatus} />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. HELP & POLICIES PAGE (/help)                                            */
/* -------------------------------------------------------------------------- */

const FAQS = [
  {
    q: 'When will the interactive Three.js 3D Showroom launch?',
    a: 'Phase 1 and Phase 2 establish the visual direction and navigation entry points. Full interactive 3D walkthrough navigation will be implemented in Phase 3.',
  },
  {
    q: 'How does complimentary express delivery work?',
    a: 'All orders above ₹999 qualify for insured doorstep delivery across India with real-time tracking updates once fulfillment backend connects.',
  },
  {
    q: 'What is your 7-day easy return & exchange policy?',
    a: 'Unworn garments with original atelier tags can be exchanged for size or refunded within 7 days of delivery at zero pickup cost.',
  },
];

export const HelpPage: React.FC = () => {
  const { navigate } = useRouter();
  const { addToast } = useToast();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [supportMessage, setSupportMessage] = useState('');

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[70vh] fw-animate-fade space-y-10">
      <div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] mb-3 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>
        <p className="text-xs font-semibold text-[#FF7A00]">24×7 Atelier Concierge</p>
        <h1 className="mt-1 font-heading text-2xl sm:text-4xl font-bold text-[#1F1D2B]">
          Help Center &amp; Store Policies
        </h1>
      </div>

      {/* Contact Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2">
          <Phone className="h-5 w-5 text-[#FF7A00]" />
          <h2 className="font-heading text-base font-semibold">Concierge Hotline</h2>
          <p className="text-sm text-[#1F1D2B]/70 tabular-nums">+91 1800-309-8840</p>
        </div>
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2">
          <Mail className="h-5 w-5 text-[#FF7A00]" />
          <h2 className="font-heading text-base font-semibold">Email Support</h2>
          <p className="text-sm text-[#1F1D2B]/70">concierge@jummofashionworld.com</p>
        </div>
        <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-2">
          <MapPin className="h-5 w-5 text-[#FF7A00]" />
          <h2 className="font-heading text-base font-semibold">Flagship Atelier</h2>
          <p className="text-sm text-[#1F1D2B]/70">Galleria Boulevard, Bandra West, Mumbai</p>
        </div>
      </div>

      {/* FAQ + Concierge Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-3">
          <h2 className="font-heading text-xl font-semibold text-[#1F1D2B]">
            Frequently Asked Questions
          </h2>
          {FAQS.map((item, idx) => {
            const expanded = openFaq === idx;
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(expanded ? null : idx)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-heading text-sm font-semibold text-[#1F1D2B] hover:text-[#FF7A00] cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {expanded && (
                  <div className="px-5 pb-4 text-sm text-[#1F1D2B]/70 leading-relaxed border-t border-[#1F1D2B]/8 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!supportMessage.trim()) {
              addToast({
                type: 'error',
                title: 'Message Required',
                description: 'Please enter how our styling concierge can help.',
              });
              return;
            }
            addToast({
              type: 'success',
              title: '✓ Concierge Inquiry Received',
              description: 'Frontend placeholder confirmation (ticket backend arrives later).',
            });
            setSupportMessage('');
          }}
          className="lg:col-span-5 rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-[#FF7A00]">
            <Headphones className="h-4 w-4" />
            <span className="text-xs font-semibold">Direct Concierge</span>
          </div>
          <h2 className="font-heading text-lg font-semibold text-[#1F1D2B]">Send a Message</h2>
          <textarea
            rows={4}
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            placeholder="Ask about garment sizing, bridal couture appointments, or order tracking..."
            className="w-full rounded-xl border border-[#1F1D2B]/18 bg-[#FFF8EF]/60 p-3.5 text-sm text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
          />
          <Button type="submit" variant="primary" size="md" fullWidth>
            Submit Inquiry
          </Button>
        </form>
      </div>

      {/* Policy Sections Anchored From Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <section id="returns" className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-2">
          <RefreshCw className="h-5 w-5 text-[#FF7A00]" />
          <h3 className="font-heading text-base font-semibold">Return Policy</h3>
          <p className="text-xs sm:text-sm text-[#1F1D2B]/70 leading-relaxed">
            Enjoy 7-day complimentary returns and size exchanges on all unworn garments with
            original tags and luxury packaging intact.
          </p>
        </section>

        <section id="privacy" className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-2">
          <ShieldCheck className="h-5 w-5 text-[#FF7A00]" />
          <h3 className="font-heading text-base font-semibold">Privacy Policy</h3>
          <p className="text-xs sm:text-sm text-[#1F1D2B]/70 leading-relaxed">
            Client preferences, saved sizes, and contact details are safeguarded under strict data
            protection standards and never sold to third parties.
          </p>
        </section>

        <section id="terms" className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-2">
          <Truck className="h-5 w-5 text-[#FF7A00]" />
          <h3 className="font-heading text-base font-semibold">Terms &amp; Conditions</h3>
          <p className="text-xs sm:text-sm text-[#1F1D2B]/70 leading-relaxed">
            All prices include GST. Seasonal discounts and promo privileges apply to eligible styles
            during active campaign periods.
          </p>
        </section>
      </div>
    </main>
  );
};
