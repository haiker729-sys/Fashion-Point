import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  LayoutGrid,
  List,
  Minus,
  Plus,
  RotateCw,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  ASSETS,
  CATEGORIES,
  PRODUCTS,
  type NavCategory,
  type Product,
} from '../../data/catalog';
import {
  Button,
  Dropdown,
  EmptyState,
  InputField,
  PriceDisplay,
  ProductBadge,
  RatingDisplay,
  ResilientImage,
  StatusAlert,
  StockStatusLabel,
} from '../ui/Primitives';
import { ConfirmationDialog, Modal, useToast } from '../ui/Overlays';
import { CategoryCard } from './CategoryCard';
import { ProductCard } from './ProductCard';
import { ShowroomHero } from './ShowroomHero';
import { StoreFooter } from './StoreFooter';
import { StoreHeader } from './StoreHeader';

interface CartEntry {
  key: string;
  product: Product;
  size: string;
  color: string;
  quantity: number;
}

interface StorefrontViewProps {
  onSwitchWorkspace: (view: 'storefront' | 'showroom' | 'admin' | 'design-system') => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({ onSwitchWorkspace }) => {
  const { addToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<NavCategory>('Home');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [cardLayout, setCardLayout] = useState<'desktop' | 'mobile'>('desktop');

  const [wishlistIds, setWishlistIds] = useState<string[]>(['prod-1', 'prod-2', 'prod-3']);
  const [cart, setCart] = useState<CartEntry[]>([
    {
      key: 'prod-1-L-Midnight Navy',
      product: PRODUCTS[0],
      size: 'L',
      color: 'Midnight Navy',
      quantity: 1,
    },
    {
      key: 'prod-3-M-Warm Camel',
      product: PRODUCTS[2],
      size: 'M',
      color: 'Warm Camel',
      quantity: 1,
    },
  ]);

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [pdpSize, setPdpSize] = useState<string>('M');
  const [pdpColor, setPdpColor] = useState<string>('');
  const [pdpAngle, setPdpAngle] = useState<number>(0);

  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [trackOrderOpen, setTrackOrderOpen] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState('#FW-9482');
  const [clearCartConfirm, setClearCartConfirm] = useState(false);

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce(
    (acc, item) => acc + item.product.discountedPrice * item.quantity,
    0
  );

  const searchSuggestions = useMemo(
    () => [
      ...PRODUCTS.map((p) => p.name),
      'Men',
      'Women',
      'Traditional Wear',
      'Kids',
      'Banarasi Saree',
      'Tailored Shirt',
    ],
    []
  );

  const filteredProducts = useMemo(() => {
    let list = [...PRODUCTS];

    if (
      activeCategory === 'Men' ||
      activeCategory === 'Women' ||
      activeCategory === 'Kids' ||
      activeCategory === 'Traditional Wear'
    ) {
      list = list.filter((p) => p.category === activeCategory);
    } else if (activeCategory === 'New Arrivals') {
      list = list.filter((p) => p.isNewArrival);
    } else if (activeCategory === 'Offers') {
      list = list.filter((p) => p.isOffer);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.discountedPrice - b.discountedPrice);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.discountedPrice - a.discountedPrice);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [activeCategory, searchQuery, sortBy]);

  const handleToggleWishlist = (product: Product) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(product.id);
      if (exists) {
        addToast({
          type: 'info',
          title: 'Removed from Wishlist',
          description: product.name,
        });
        return prev.filter((id) => id !== product.id);
      }
      addToast({
        type: 'success',
        title: 'Saved to Wishlist',
        description: product.name,
      });
      return [...prev, product.id];
    });
  };

  const handleAddToCart = (product: Product, size: string, color: string) => {
    if (product.stockStatus === 'out_of_stock') {
      addToast({
        type: 'error',
        title: '✕ Product Unavailable',
        description: `${product.name} is currently out of stock.`,
      });
      return;
    }

    const key = `${product.id}-${size}-${color}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => (c.key === key ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { key, product, size, color, quantity: 1 }];
    });

    addToast({
      type: 'success',
      title: '✓ Product Added Successfully',
      description: `${product.name} (${size} · ${color}) added to your bag.`,
    });
  };

  const openQuickView = (product: Product) => {
    setQuickViewProduct(product);
    setPdpSize(product.sizes[Math.min(1, product.sizes.length - 1)]);
    setPdpColor(product.colors[0]?.name || '');
    setPdpAngle(0);
  };

  const updateCartQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const wishlistedProducts = PRODUCTS.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B]">
      <StoreHeader
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchSuggestions={searchSuggestions}
        wishlistCount={wishlistIds.length}
        cartCount={totalCartItems}
        onOpenWishlist={() => setWishlistOpen(true)}
        onOpenCart={() => setCartOpen(true)}
        onOpenTrackOrder={() => setTrackOrderOpen(true)}
        onSwitchWorkspace={onSwitchWorkspace}
      />

      <main>
        {/* 1. 3D Showroom Visual Hero */}
        <ShowroomHero
          onSelectCategoryFilter={(cat) => setActiveCategory(cat as NavCategory)}
          onOpenFullBlueprint={() => onSwitchWorkspace('showroom')}
          onOpenWishlist={() => setWishlistOpen(true)}
        />

        {/* 2. Curated Categories Strip */}
        <section
          id="fw-categories-section"
          aria-labelledby="categories-heading"
          className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-10"
        >
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-medium text-[#FF7A00]">Curated Departments</p>
              <h2
                id="categories-heading"
                className="font-heading text-xl sm:text-2xl font-semibold text-[#1F1D2B] tracking-tight"
              >
                Explore by Category
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('Home');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#FF7A00] hover:text-[#1F1D2B] transition-colors cursor-pointer whitespace-nowrap"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-3 sm:gap-4 overflow-x-auto fw-no-scrollbar pb-2">
            {CATEGORIES.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                active={activeCategory === category.filterKey}
                onSelect={(cat) => {
                  setActiveCategory(cat.filterKey as NavCategory);
                  document
                    .getElementById('fw-catalog-section')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            ))}
          </div>
        </section>

        {/* 3. Featured Collection Product Grid */}
        <section
          id="fw-catalog-section"
          aria-labelledby="catalog-heading"
          className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-12"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#1F1D2B]/10">
            <div>
              <p className="text-xs font-medium text-[#FF7A00]">
                {activeCategory === 'Home' ? 'Signature Collection' : `${activeCategory} Selection`}
              </p>
              <h2
                id="catalog-heading"
                className="font-heading text-2xl sm:text-3xl font-semibold text-[#1F1D2B] tracking-tight"
              >
                {activeCategory === 'Home' ? 'Curated Atelier Editions' : activeCategory}
              </h2>
              <p className="mt-1 text-sm text-[#1F1D2B]/60 tabular-nums">
                Showing {filteredProducts.length} of {PRODUCTS.length} luxury styles
                {searchQuery ? ` matching “${searchQuery}”` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Desktop vs Mobile Card Layout Preview Toggle */}
              <div
                role="group"
                aria-label="Product card layout"
                className="inline-flex items-center rounded-xl border border-[#1F1D2B]/12 bg-white p-1"
              >
                <button
                  type="button"
                  onClick={() => setCardLayout('desktop')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    cardLayout === 'desktop'
                      ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                      : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Editorial Grid
                </button>
                <button
                  type="button"
                  onClick={() => setCardLayout('mobile')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    cardLayout === 'mobile'
                      ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                      : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Compact Mobile
                </button>
              </div>

              <Dropdown
                value={sortBy}
                onChange={setSortBy}
                align="right"
                options={[
                  { value: 'featured', label: 'Sort: Featured' },
                  { value: 'rating', label: 'Highest Rated' },
                  { value: 'price-asc', label: 'Price: Low to High' },
                  { value: 'price-desc', label: 'Price: High to Low' },
                ]}
              />
            </div>
          </div>

          <div className="pt-7">
            {filteredProducts.length === 0 ? (
              <EmptyState
                title="No matching styles found"
                description="Try clearing your search filter or exploring all collections across Men, Women, Kids, and Traditional Wear."
                actionLabel="Reset Filters"
                onAction={() => {
                  setActiveCategory('Home');
                  setSearchQuery('');
                }}
              />
            ) : (
              <div
                className={
                  cardLayout === 'mobile'
                    ? 'grid grid-cols-1 lg:grid-cols-2 gap-4'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7'
                }
              >
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    layout={cardLayout}
                    isWishlisted={wishlistIds.includes(product.id)}
                    onToggleWishlist={handleToggleWishlist}
                    onAddToCart={handleAddToCart}
                    onQuickView={openQuickView}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 4. Editorial Winter Collection Campaign Banner */}
        <section
          aria-label="Seasonal Campaign"
          className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-14"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[#1F1D2B]/12 bg-[#1F1D2B] min-h-[280px] sm:min-h-[340px] flex items-center">
            <ResilientImage
              src={ASSETS.winterBanner}
              alt="Fashion World Winter Collection editorial campaign featuring luxury shearling coat and tailored leather jacket"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#1F1D2B]/92 via-[#1F1D2B]/65 to-transparent"
            />
            <div className="relative z-10 max-w-xl p-6 sm:p-10 lg:p-12 space-y-4">
              <p className="text-xs font-semibold text-[#FFA94D]">
                Seasonal Editorial · Limited Atelier Release
              </p>
              <h2 className="font-heading text-2xl sm:text-4xl font-bold text-[#FFF8EF] leading-tight text-balance">
                New Winter Collection — Up to 50% Off
              </h2>
              <p className="text-sm sm:text-base text-[#FFF8EF]/80 leading-relaxed max-w-md">
                Structured Italian outerwear, handwoven silk couture, and tailored winter staples
                designed for our upcoming interactive 3D fashion mall.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => {
                    setActiveCategory('Offers');
                    document
                      .getElementById('fw-catalog-section')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Shop Winter Offers
                </Button>
                <button
                  type="button"
                  onClick={() => onSwitchWorkspace('showroom')}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-[#FFF8EF] hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <Compass className="h-4 w-4 text-[#FFA94D]" />
                  Explore 3D Showroom Vision
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <StoreFooter
        onSelectCategory={(cat) => {
          setActiveCategory(cat as NavCategory);
          document.getElementById('fw-catalog-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onSwitchWorkspace={onSwitchWorkspace}
      />

      {/* CONTIGUOUS PRODUCT QUICK-VIEW MODAL (PDP) */}
      <Modal
        open={Boolean(quickViewProduct)}
        onClose={() => setQuickViewProduct(null)}
        title={quickViewProduct?.name || 'Product Preview'}
        subtitle={
          quickViewProduct
            ? `${quickViewProduct.sku} · ${quickViewProduct.showroomZone}`
            : undefined
        }
        maxWidth="lg"
      >
        {quickViewProduct && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Gallery + 360° Turntable Scrubber */}
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
                    360° Preview Placeholder
                  </span>
                  <span className="tabular-nums text-[#FFA94D]">{pdpAngle}°</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#1F1D2B]/10 bg-white px-4 py-3">
                <label
                  htmlFor="pdp-360-range"
                  className="flex items-center justify-between text-xs font-medium text-[#1F1D2B]/70 mb-1.5"
                >
                  <span>Rotate garment angle</span>
                  <span className="tabular-nums">{pdpAngle}°</span>
                </label>
                <input
                  id="pdp-360-range"
                  type="range"
                  min={-180}
                  max={180}
                  value={pdpAngle}
                  onChange={(e) => setPdpAngle(Number(e.target.value))}
                  className="w-full accent-[#FF7A00] cursor-pointer"
                />
              </div>
            </div>

            {/* Right Contiguous Purchase Module */}
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

              {/* Color Swatches */}
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

              {/* Size Selector */}
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

              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={quickViewProduct.stockStatus === 'out_of_stock'}
                  leftIcon={<ShoppingBag className="h-4 w-4" />}
                  onClick={() => {
                    handleAddToCart(quickViewProduct, pdpSize, pdpColor);
                    setQuickViewProduct(null);
                  }}
                >
                  {quickViewProduct.stockStatus === 'out_of_stock'
                    ? 'Product Unavailable'
                    : 'Add to Cart'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  disabled={quickViewProduct.stockStatus === 'out_of_stock'}
                  onClick={() => {
                    addToast({
                      type: 'info',
                      title: 'Checkout Flow Scheduled for Phase 5',
                      description: 'Phase 1 validates UI/UX layouts without payment backend.',
                    });
                  }}
                >
                  Buy Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* SHOPPING CART SLIDE-OVER DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping Bag">
          <div
            className="fixed inset-0 bg-[#1F1D2B]/60 backdrop-blur-xs fw-animate-fade"
            onClick={() => setCartOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-[#FFF8EF] shadow-2xl fw-animate-slide-right">
            <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 bg-white px-5 py-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-[#1F1D2B]">
                  Shopping Bag ({totalCartItems})
                </h2>
                <p className="text-xs text-[#1F1D2B]/55">Complimentary insured shipping over ₹999</p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
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
                  actionLabel="Continue Shopping"
                  onAction={() => setCartOpen(false)}
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
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2">
                        <span className="font-heading text-sm font-bold text-[#1F1D2B] tabular-nums">
                          ₹{(item.product.discountedPrice * item.quantity).toLocaleString('en-IN')}
                        </span>
                        <div className="inline-flex items-center gap-1 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.key, -1)}
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
                            onClick={() => updateCartQuantity(item.key, 1)}
                            aria-label="Increase quantity"
                            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white cursor-pointer"
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
              <div className="border-t border-[#1F1D2B]/10 bg-white p-5 space-y-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between text-[#1F1D2B]/70">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#1F1D2B] tabular-nums">
                      ₹{cartSubtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#1F1D2B]/70">
                    <span>Delivery</span>
                    <span className="font-semibold text-[#16A34A]">Free</span>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setClearCartConfirm(true)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={() => {
                      addToast({
                        type: 'success',
                        title: '✓ Order Preview Validated',
                        description: 'Real checkout & payment gateway arrive in later phases.',
                      });
                      setCartOpen(false);
                    }}
                  >
                    Proceed to Checkout
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* WISHLIST MODAL */}
      <Modal
        open={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        title={`Saved Wishlist (${wishlistedProducts.length})`}
        subtitle="Your curated styles ready to move to bag"
        maxWidth="md"
      >
        {wishlistedProducts.length === 0 ? (
          <EmptyState
            title="No saved styles yet"
            description="Tap the heart icon on any product to keep track of pieces you love."
            actionLabel="Browse Collection"
            onAction={() => setWishlistOpen(false)}
          />
        ) : (
          <div className="space-y-3">
            {wishlistedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-4 rounded-xl border border-[#1F1D2B]/10 bg-white p-3"
              >
                <ResilientImage
                  src={product.image}
                  alt={product.name}
                  className="h-20 w-16 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-semibold text-[#1F1D2B] truncate">
                    {product.name}
                  </p>
                  <div className="mt-1">
                    <PriceDisplay
                      discountedPrice={product.discountedPrice}
                      originalPrice={product.originalPrice}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={product.stockStatus === 'out_of_stock'}
                    onClick={() =>
                      handleAddToCart(
                        product,
                        product.sizes[0],
                        product.colors[0]?.name || 'Default'
                      )
                    }
                  >
                    Add
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleToggleWishlist(product)}
                    aria-label="Remove from wishlist"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1F1D2B]/12 text-[#1F1D2B]/65 hover:text-[#DC2626] hover:border-[#DC2626] cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* TRACK ORDER MODAL (Phase 1 Visual Preview) */}
      <Modal
        open={trackOrderOpen}
        onClose={() => setTrackOrderOpen(false)}
        title="Track Your Order"
        subtitle="Phase 1 UI preview · Live shipment telemetry connects in backend phases"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <InputField
            label="Order Reference Number"
            value={trackOrderId}
            onChange={(e) => setTrackOrderId(e.target.value)}
            placeholder="e.g. #FW-9482"
            leftIcon={<Truck className="h-4 w-4" />}
          />

          <StatusAlert
            variant="success"
            title="Order #FW-9482 — Out for Delivery"
            description="Sample Phase 1 status state: Dispatched from Fashion World Flagship Atelier."
          />

          <div className="rounded-xl border border-[#1F1D2B]/10 bg-white p-4 space-y-3 text-xs">
            {[
              { step: 'Order Confirmed', time: '19 Nov · 10:15 AM', done: true },
              { step: 'Quality Inspection & Gift Wrap', time: '20 Nov · 02:40 PM', done: true },
              { step: 'Dispatched via Express Courier', time: '21 Nov · 08:30 AM', done: true },
            ].map((item) => (
              <div key={item.step} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium text-[#1F1D2B]">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  {item.step}
                </span>
                <span className="text-[#1F1D2B]/55 tabular-nums">{item.time}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={() => setTrackOrderOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={clearCartConfirm}
        onClose={() => setClearCartConfirm(false)}
        onConfirm={() => {
          setCart([]);
          addToast({
            type: 'warning',
            title: 'Shopping Bag Cleared',
            description: 'All items were removed from your bag.',
          });
        }}
        title="Clear Shopping Bag?"
        message="This will remove all curated items currently in your Fashion World bag."
        confirmLabel="Clear Bag"
        destructive
      />
    </div>
  );
};
