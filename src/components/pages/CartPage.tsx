import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Cloud,
  Info,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useRouter } from '../../router/RouterContext';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { SHIPPING_RULES } from '../../types/commerce';
import { formatINR } from '../../utils/commerceHelpers';
import { Button, EmptyState, ResilientImage } from '../ui/Primitives';
import { ConfirmationDialog } from '../ui/Overlays';

export const CartPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const {
    cart,
    savedForLater,
    cartSummary,
    cartLoading,
    cartError,
    isCloudCart,
    updateCartQuantity,
    setCartQuantity,
    removeFromCart,
    clearCart,
    saveForLater,
    moveToCart,
    removeSavedItem,
    appliedCoupon,
    couponError,
    couponLoading,
    applyCouponCode,
    removeCoupon,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const hasStockIssues = cart.some(
    (item) => !item.isPublished || item.availableStock <= 0 || item.quantity > item.availableStock
  );

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const ok = await applyCouponCode(couponInput);
    if (ok) {
      setCouponInput('');
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-10 min-h-[70vh] space-y-8 fw-animate-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1F1D2B]/10 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">
            3D Jummo Fashion World · Shopping Bag
          </p>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F1D2B] mt-1">
            Your Shopping Cart ({cartSummary.totalItems})
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {isCloudCart ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A]/12 px-2.5 py-1 font-semibold text-[#16A34A]">
                <Cloud className="h-3.5 w-3.5" />
                Cloud Synced to {user?.email || 'Your Account'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB]/10 px-2.5 py-1 font-semibold text-[#2563EB]">
                <Info className="h-3.5 w-3.5" />
                Guest Bag · Sign in at checkout to sync &amp; place orders
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
            Continue Shopping
          </Button>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4 text-[#DC2626]" />}
              onClick={() => setClearConfirmOpen(true)}
            >
              <span className="text-[#DC2626]">Clear Cart</span>
            </Button>
          )}
        </div>
      </div>

      {/* Cart Error Banner */}
      {cartError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[#DC2626]/30 bg-[#DC2626]/8 p-4 text-sm text-[#DC2626]"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to sync shopping cart</p>
            <p className="text-xs mt-0.5 text-[#DC2626]/90">{cartError}</p>
          </div>
        </div>
      )}

      {/* Stock Warning Banner */}
      {hasStockIssues && cart.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 text-sm text-[#1F1D2B]"
        >
          <AlertTriangle className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Action required before checkout</p>
            <p className="text-xs text-[#1F1D2B]/75 mt-0.5">
              One or more items in your bag are out of stock or exceed live variant inventory.
              Please adjust quantities or move unavailable items to Saved for Later.
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {cartLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex gap-4 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 animate-pulse"
              >
                <div className="h-28 w-24 rounded-xl bg-[#FFE4C7]/60 shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-[#FFE4C7]/70" />
                  <div className="h-3 w-1/3 rounded bg-[#FFE4C7]/50" />
                  <div className="h-8 w-36 rounded-lg bg-[#FFE4C7]/50" />
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-4 rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 h-72 animate-pulse" />
        </div>
      ) : cart.length === 0 ? (
        <EmptyState
          title="Your shopping bag is currently empty"
          description="Explore luxury menswear, festive silk couture, and curated apparel from our live catalog or 3D Virtual Showroom."
          actionLabel="Explore Catalog"
          onAction={() => navigate('/search')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Cart Items List */}
          <div className="lg:col-span-8 space-y-4">
            {/* Free Standard Shipping Progress Bar */}
            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 flex items-center gap-3 text-xs">
              <Truck
                className={`h-5 w-5 shrink-0 ${
                  cartSummary.freeDeliveryRemaining === 0 ? 'text-[#16A34A]' : 'text-[#FF7A00]'
                }`}
              />
              {cartSummary.freeDeliveryRemaining === 0 ? (
                <p className="font-semibold text-[#16A34A]">
                  You unlocked FREE Standard Delivery (orders ≥{' '}
                  {formatINR(SHIPPING_RULES.FREE_STANDARD_THRESHOLD_INR)})!
                </p>
              ) : (
                <p className="text-[#1F1D2B]/80">
                  Add{' '}
                  <strong className="text-[#FF7A00]">
                    {formatINR(cartSummary.freeDeliveryRemaining)}
                  </strong>{' '}
                  more to qualify for <strong>FREE Standard Delivery</strong> (otherwise ₹
                  {SHIPPING_RULES.STANDARD_CHARGE_INR}).
                </p>
              )}
            </div>

            {cart.map((item) => {
              const outOfStock = !item.isPublished || item.availableStock <= 0;
              const exceedsStock = item.quantity > item.availableStock && item.availableStock > 0;
              const lowStock = item.availableStock > 0 && item.availableStock <= 5;

              return (
                <article
                  key={item.key}
                  className={`flex flex-col sm:flex-row gap-4 rounded-2xl border bg-white p-4 sm:p-5 transition-colors ${
                    outOfStock || exceedsStock
                      ? 'border-[#DC2626]/40 bg-[#DC2626]/[0.02]'
                      : 'border-[#1F1D2B]/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/product/${item.productId}`)}
                    className="h-32 w-24 sm:h-36 sm:w-28 shrink-0 overflow-hidden rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF] cursor-pointer"
                  >
                    <ResilientImage
                      src={item.product.image}
                      alt={item.product.name}
                      className="h-full w-full object-cover"
                    />
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/product/${item.productId}`)}
                          className="font-heading text-base font-semibold text-[#1F1D2B] hover:text-[#FF7A00] text-left truncate block max-w-full cursor-pointer"
                        >
                          {item.product.name}
                        </button>
                        <p className="text-xs font-mono text-[#1F1D2B]/55 mt-0.5">
                          SKU: {item.sku}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-lg bg-[#FFF8EF] border border-[#1F1D2B]/12 px-2.5 py-1 font-medium text-[#1F1D2B]">
                            Size: <strong>{item.size}</strong>
                          </span>
                          <span className="rounded-lg bg-[#FFF8EF] border border-[#1F1D2B]/12 px-2.5 py-1 font-medium text-[#1F1D2B]">
                            Colour: <strong>{item.color}</strong>
                          </span>
                          <span
                            className={`rounded-lg px-2.5 py-1 font-semibold tabular-nums ${
                              outOfStock || exceedsStock
                                ? 'bg-[#DC2626]/10 text-[#DC2626]'
                                : lowStock
                                  ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                  : 'bg-[#16A34A]/12 text-[#16A34A]'
                            }`}
                          >
                            {outOfStock
                              ? 'Out of Stock'
                              : exceedsStock
                                ? `Only ${item.availableStock} left`
                                : `${item.availableStock} in stock`}
                          </span>
                        </div>

                        {item.priceChangedFromSnapshot && (
                          <p className="mt-1.5 text-[11px] font-medium text-[#2563EB]">
                            Price updated to live catalog price ({formatINR(item.unitPrice)}).
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right shrink-0">
                        <p className="text-xs text-[#1F1D2B]/55 tabular-nums">
                          Unit: {formatINR(item.unitPrice)}
                          {item.originalPrice > item.unitPrice && (
                            <span className="ml-1.5 line-through text-[#1F1D2B]/40">
                              {formatINR(item.originalPrice)}
                            </span>
                          )}
                        </p>
                        <p className="font-heading text-lg font-bold text-[#1F1D2B] tabular-nums mt-0.5">
                          {formatINR(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>

                    {/* Quantity Stepper & Row Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1F1D2B]/8">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#1F1D2B]/65">Qty</span>
                        <div className="inline-flex items-center rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] p-0.5">
                          <button
                            type="button"
                            onClick={() => void updateCartQuantity(item.key, -1)}
                            aria-label={`Decrease quantity for ${item.product.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white cursor-pointer"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, Math.min(50, item.availableStock))}
                            value={item.quantity}
                            disabled={outOfStock}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              if (!Number.isNaN(parsed) && parsed >= 1) {
                                void setCartQuantity(item.key, parsed);
                              }
                            }}
                            aria-label={`Quantity for ${item.product.name}`}
                            className="w-11 bg-transparent text-center text-xs font-bold text-[#1F1D2B] tabular-nums focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={outOfStock || item.quantity >= item.availableStock}
                            onClick={() => void updateCartQuantity(item.key, 1)}
                            aria-label={`Increase quantity for ${item.product.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void saveForLater(item.key)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F1D2B]/70 hover:text-[#FF7A00] transition-colors cursor-pointer"
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          Save for Later
                        </button>
                        <span className="text-[#1F1D2B]/20" aria-hidden="true">
                          |
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeFromCart(item.key)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Right: Coupon & INR Order Summary */}
          <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
            {/* Coupon Card */}
            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#FF7A00]" />
                  Apply Discount Coupon
                </h2>
                <span className="text-[11px] text-[#1F1D2B]/55">Firestore Verified</span>
              </div>

              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-[#16A34A] font-mono">{appliedCoupon.code}</p>
                      <p className="text-[#1F1D2B]/75 truncate">
                        Saving {formatINR(cartSummary.couponDiscount)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    aria-label="Remove coupon"
                    className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white text-[#1F1D2B]/70 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. JUMMO10)"
                    aria-label="Coupon code"
                    className="h-11 flex-1 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF] px-3.5 text-xs font-mono uppercase text-[#1F1D2B] placeholder:normal-case placeholder:font-sans placeholder:text-[#1F1D2B]/45 focus:border-[#FF7A00] focus:outline-none"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={couponLoading || !couponInput.trim()}
                    className="h-11 px-4 shrink-0"
                  >
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </form>
              )}

              {couponError && (
                <p role="alert" className="text-xs font-medium text-[#DC2626] flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{couponError}</span>
                </p>
              )}
            </div>

            {/* Price Breakdown Card */}
            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
              <h2 className="font-heading text-lg font-bold text-[#1F1D2B]">Cart Summary</h2>

              <dl className="space-y-2.5 text-sm border-b border-[#1F1D2B]/10 pb-4">
                <div className="flex justify-between">
                  <dt className="text-[#1F1D2B]/70">Total Items</dt>
                  <dd className="font-semibold text-[#1F1D2B] tabular-nums">
                    {cartSummary.totalItems}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#1F1D2B]/70">Subtotal (Live Price)</dt>
                  <dd className="font-semibold text-[#1F1D2B] tabular-nums">
                    {formatINR(cartSummary.subtotal)}
                  </dd>
                </div>
                {cartSummary.catalogSavings > 0 && (
                  <div className="flex justify-between text-[#16A34A]">
                    <dt>Catalog Savings</dt>
                    <dd className="font-semibold tabular-nums">
                      -{formatINR(cartSummary.catalogSavings)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-[#1F1D2B]/70">
                    Coupon Discount{cartSummary.couponCode ? ` (${cartSummary.couponCode})` : ''}
                  </dt>
                  <dd
                    className={`font-semibold tabular-nums ${
                      cartSummary.couponDiscount > 0 ? 'text-[#16A34A]' : 'text-[#1F1D2B]/60'
                    }`}
                  >
                    {cartSummary.couponDiscount > 0
                      ? `-${formatINR(cartSummary.couponDiscount)}`
                      : '₹0'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#1F1D2B]/70">Delivery Charge (Standard)</dt>
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
                  <dt className="text-[#1F1D2B]/70">Estimated Tax (GST)</dt>
                  <dd className="font-semibold text-[#1F1D2B] tabular-nums">Included (₹0)</dd>
                </div>
              </dl>

              <div className="flex items-center justify-between text-base font-bold text-[#1F1D2B]">
                <span>Final Total</span>
                <span className="font-heading text-xl tabular-nums">
                  {formatINR(cartSummary.totalAmount)}
                </span>
              </div>

              <p className="text-[11px] text-[#1F1D2B]/55 leading-relaxed">
                {SHIPPING_RULES.TAX_NOTE} Final stock and prices are securely re-verified inside
                Cloud Firestore at checkout.
              </p>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={hasStockIssues}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate('/checkout')}
              >
                {hasStockIssues ? 'Fix Stock Issues to Continue' : 'Proceed to Checkout'}
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Saved For Later Section */}
      {savedForLater.length > 0 && (
        <section className="pt-6 border-t border-[#1F1D2B]/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-[#1F1D2B] flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-[#FF7A00]" />
              Saved for Later ({savedForLater.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedForLater.map((item) => (
              <div
                key={item.key}
                className="flex gap-3.5 rounded-2xl border border-[#1F1D2B]/10 bg-white p-4"
              >
                <ResilientImage
                  src={item.product.image}
                  alt={item.product.name}
                  className="h-24 w-20 rounded-xl object-cover shrink-0 bg-[#FFF8EF]"
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <p className="font-heading text-sm font-semibold text-[#1F1D2B] truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-[#1F1D2B]/60 mt-0.5">
                      Size {item.size} · {item.color}
                    </p>
                    <p className="font-heading text-sm font-bold text-[#1F1D2B] tabular-nums mt-1">
                      {formatINR(item.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={item.availableStock <= 0}
                      leftIcon={<ShoppingBag className="h-3.5 w-3.5" />}
                      onClick={() => void moveToCart(item.key)}
                    >
                      {item.availableStock > 0 ? 'Move to Cart' : 'Out of Stock'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => void removeSavedItem(item.key)}
                      className="text-xs font-semibold text-[#DC2626] px-2 py-1 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmationDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          void clearCart();
          setClearConfirmOpen(false);
        }}
        title="Clear Shopping Bag?"
        message="This will remove every item currently stored in your shopping cart."
        confirmLabel="Clear Bag"
        destructive
      />
    </main>
  );
};
