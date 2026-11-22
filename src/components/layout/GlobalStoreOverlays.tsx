import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Minus,
  Plus,
  RotateCw,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useRouter } from '../../router/RouterContext';
import {
  Button,
  EmptyState,
  PriceDisplay,
  RatingDisplay,
  ResilientImage,
  StockStatusLabel,
} from '../ui/Primitives';
import { ConfirmationDialog, Modal, useToast } from '../ui/Overlays';

export const GlobalStoreOverlays: React.FC = () => {
  const { navigate } = useRouter();
  const { addToast } = useToast();
  const {
    cart,
    totalCartItems,
    cartSubtotal,
    cartSummary,
    isCloudCart,
    quickViewProduct,
    closeQuickView,
    cartDrawerOpen,
    setCartDrawerOpen,
    addToCart,
    updateCartQuantity,
    clearCart,
  } = useStore();

  const [pdpSize, setPdpSize] = useState('M');
  const [pdpColor, setPdpColor] = useState('');
  const [pdpAngle, setPdpAngle] = useState(0);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (quickViewProduct) {
      setPdpSize(quickViewProduct.sizes[Math.min(1, quickViewProduct.sizes.length - 1)]);
      setPdpColor(quickViewProduct.colors[0]?.name || '');
      setPdpAngle(0);
    }
  }, [quickViewProduct]);

  return (
    <>
      {/* Global Quick-View Product Detail Modal */}
      <Modal
        open={Boolean(quickViewProduct)}
        onClose={closeQuickView}
        title={quickViewProduct?.name || 'Product Quick View'}
        subtitle={
          quickViewProduct
            ? `${quickViewProduct.sku} · ${quickViewProduct.showroomZone}`
            : undefined
        }
        maxWidth="lg"
      >
        {quickViewProduct && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[#1F1D2B]/10 bg-white">
                <div
                  className="h-full w-full transition-transform duration-200"
                  style={{
                    transform: `perspective(900px) rotateY(${pdpAngle * 0.12}deg) scale(${
                      1 + Math.abs(pdpAngle) * 0.0006
                    })`,
                  }}
                >
                  <ResilientImage
                    src={quickViewProduct.image}
                    alt={quickViewProduct.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-[#1F1D2B]/85 px-3 py-2 text-xs text-[#FFF8EF] backdrop-blur-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <RotateCw className="h-3.5 w-3.5 text-[#FFA94D]" />
                    360° Visual Preview
                  </span>
                  <span className="tabular-nums text-[#FFA94D]">{pdpAngle}°</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#1F1D2B]/10 bg-white px-4 py-3">
                <label
                  htmlFor="global-pdp-angle"
                  className="flex items-center justify-between text-xs font-medium text-[#1F1D2B]/70 mb-1.5"
                >
                  <span>Rotate preview angle</span>
                  <span className="tabular-nums">{pdpAngle}°</span>
                </label>
                <input
                  id="global-pdp-angle"
                  type="range"
                  min={-180}
                  max={180}
                  value={pdpAngle}
                  onChange={(e) => setPdpAngle(Number(e.target.value))}
                  className="w-full accent-[#FF7A00] cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#FF7A00]">
                  {quickViewProduct.category} · {quickViewProduct.subcategory}
                </span>
                <StockStatusLabel
                  status={quickViewProduct.stockStatus}
                  count={quickViewProduct.stockCount}
                />
              </div>

              <RatingDisplay
                rating={quickViewProduct.rating}
                reviewCount={quickViewProduct.reviewCount}
              />

              <PriceDisplay
                discountedPrice={quickViewProduct.discountedPrice}
                originalPrice={quickViewProduct.originalPrice}
                discountPercent={quickViewProduct.discountPercent}
                size="lg"
              />

              <p className="text-sm text-[#1F1D2B]/75 leading-relaxed">
                {quickViewProduct.description}
              </p>

              <div className="space-y-2 pt-2 border-t border-[#1F1D2B]/10">
                <p className="text-xs font-semibold text-[#1F1D2B]">
                  Color: <span className="font-normal text-[#1F1D2B]/70">{pdpColor}</span>
                </p>
                <div className="flex items-center gap-2.5">
                  {quickViewProduct.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setPdpColor(c.name)}
                      aria-label={`Color ${c.name}`}
                      className={`h-8 w-8 rounded-full border cursor-pointer transition-transform ${
                        pdpColor === c.name
                          ? 'ring-2 ring-[#FF7A00] ring-offset-2 scale-105 border-white'
                          : 'border-[#1F1D2B]/25'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1F1D2B]">Select Size</p>
                <div className="flex flex-wrap gap-2">
                  {quickViewProduct.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPdpSize(size)}
                      className={`min-w-[44px] h-10 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        pdpSize === size
                          ? 'bg-[#FF7A00] text-white'
                          : 'bg-white border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={quickViewProduct.stockStatus === 'out_of_stock'}
                  leftIcon={<ShoppingBag className="h-4 w-4" />}
                  onClick={() => {
                    addToCart(quickViewProduct, pdpSize, pdpColor);
                    closeQuickView();
                  }}
                >
                  {quickViewProduct.stockStatus === 'out_of_stock'
                    ? 'Product Unavailable'
                    : 'Add to Cart'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    const id = quickViewProduct.id;
                    closeQuickView();
                    navigate(`/product/${id}`);
                  }}
                >
                  Full Product Details
                </Button>
              </div>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  closeQuickView();
                  navigate('/showroom');
                }}
              >
                View in 3D Showroom
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Global Slide-Over Shopping Cart Drawer */}
      {cartDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping Cart Drawer"
        >
          <div
            className="fixed inset-0 bg-[#1F1D2B]/60 backdrop-blur-xs fw-animate-fade"
            onClick={() => setCartDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-[#FFF8EF] shadow-2xl fw-animate-slide-right">
            <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 bg-white px-5 py-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-[#1F1D2B]">
                  Shopping Bag ({totalCartItems})
                </h2>
                <p className="text-xs text-[#1F1D2B]/60">
                  {isCloudCart
                    ? 'Synced with Cloud Firestore · Free standard delivery ≥ ₹999'
                    : 'Guest bag · Sign in at checkout to sync & place order'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                aria-label="Close shopping bag"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1F1D2B]/12 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {cart.length === 0 ? (
                <EmptyState
                  title="Your shopping bag is empty"
                  description="Explore tailored menswear, silk couture, and seasonal outerwear to begin curating your wardrobe."
                  actionLabel="Explore New Arrivals"
                  onAction={() => {
                    setCartDrawerOpen(false);
                    navigate('/new-arrivals');
                  }}
                />
              ) : (
                cart.map((item) => (
                  <div
                    key={item.key}
                    className="flex gap-3.5 rounded-2xl border border-[#1F1D2B]/10 bg-white p-3.5"
                  >
                    <ResilientImage
                      src={item.product.image}
                      alt={item.product.name}
                      className="h-24 w-20 shrink-0 rounded-xl object-cover bg-[#FFF8EF]"
                    />
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <p className="font-heading text-sm font-semibold text-[#1F1D2B] truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-[#1F1D2B]/55 mt-0.5">
                          Size {item.size} · {item.color}
                        </p>
                        <p className="text-[11px] text-[#1F1D2B]/50 tabular-nums mt-0.5">
                          SKU {item.sku} ·{' '}
                          {item.availableStock > 0
                            ? `${item.availableStock} in stock`
                            : 'Out of stock'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2">
                        <span className="font-heading text-sm font-bold text-[#1F1D2B] tabular-nums">
                          ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                        </span>
                        <div className="inline-flex items-center gap-1 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] p-0.5">
                          <button
                            type="button"
                            onClick={() => void updateCartQuantity(item.key, -1)}
                            aria-label="Decrease quantity"
                            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white cursor-pointer"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.availableStock}
                            onClick={() => void updateCartQuantity(item.key, 1)}
                            aria-label="Increase quantity"
                            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-[#1F1D2B]/10 bg-white p-5 space-y-3.5">
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between text-[#1F1D2B]/70">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#1F1D2B] tabular-nums">
                      ₹{cartSubtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#1F1D2B]/70">
                    <span>Standard Delivery</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        cartSummary.deliveryCharge === 0 ? 'text-[#16A34A]' : 'text-[#1F1D2B]'
                      }`}
                    >
                      {cartSummary.deliveryCharge === 0
                        ? 'Free'
                        : `₹${cartSummary.deliveryCharge.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => {
                    setCartDrawerOpen(false);
                    navigate('/checkout');
                  }}
                >
                  Proceed to Checkout
                </Button>
                <div className="flex gap-2.5">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setClearConfirmOpen(true)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate('/cart');
                    }}
                  >
                    View Full Cart
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      <ConfirmationDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          clearCart();
          addToast({
            type: 'info',
            title: 'Cart Emptied',
            description: 'Add new pieces anytime from the catalog.',
          });
        }}
        title="Clear Shopping Bag?"
        message="This will remove all curated items currently in your 3D Jummo Fashion World bag."
        confirmLabel="Clear Bag"
        destructive
      />
    </>
  );
};
