import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Heart,
  Info,
  Minus,
  Plus,
  RotateCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { useRouter } from '../../router/RouterContext';
import { useStore } from '../../context/StoreContext';
import { detectWebGLCapabilities } from '../../utils/webglDetect';
import { formatINR, toShowroomProduct } from '../../utils/catalogHelpers';
import { ProductCard } from '../storefront/ProductCard';
import { ProductViewer } from '../showroom/ProductViewer';
import {
  Button,
  EmptyState,
  PriceDisplay,
  ProductBadge,
  RatingDisplay,
  ResilientImage,
  StockStatusLabel,
} from '../ui/Primitives';

interface ProductDetailsPageProps {
  idOrSlug: string;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({ idOrSlug }) => {
  const { navigate } = useRouter();
  const { getProductByIdOrSlug, publishedProducts } = useCatalog();
  const { wishlistIds, toggleWishlist, addToCart, openQuickView } = useStore();

  const product = getProductByIdOrSlug(idOrSlug);
  const webglCaps = useMemo(() => detectWebGLCapabilities(), []);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);

  const sortedImages = useMemo(() => {
    if (!product) return [];
    return [...product.images].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return a.order - b.order;
    });
  }, [product]);

  useEffect(() => {
    if (!product) return;
    setActiveImageIdx(0);
    const firstInStock = product.variants.find((v) => v.stockQuantity > 0) || product.variants[0];
    setSelectedColor(firstInStock?.colour || product.availableColors[0]?.name || '');
    setSelectedSize(firstInStock?.size || product.availableSizes[0] || '');
    setSelectedQuantity(1);
    setViewerOpen(false);
  }, [product]);

  const sizesForSelectedColor = useMemo(() => {
    if (!product) return [];
    const matching = product.variants.filter((v) => v.colour === selectedColor);
    return matching.length > 0 ? matching : product.variants;
  }, [product, selectedColor]);

  const activeVariant = useMemo(() => {
    if (!product) return null;
    return (
      product.variants.find(
        (v) => v.colour === selectedColor && v.size === selectedSize
      ) || null
    );
  }, [product, selectedColor, selectedSize]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return publishedProducts
      .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
      .slice(0, 4);
  }, [product, publishedProducts]);

  if (!product) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-14 min-h-[65vh]">
        <EmptyState
          title="Product Not Found"
          description="This style may have been removed or moved to draft in the catalog."
          actionLabel="Browse Full Collection"
          onAction={() => navigate('/search')}
        />
      </main>
    );
  }

  const isWishlisted = wishlistIds.includes(product.id);
  const currentImage = sortedImages[activeImageIdx] || sortedImages[0];
  const variantStock = activeVariant ? activeVariant.stockQuantity : product.totalStock;
  const maxOrderQty = Math.max(1, Math.min(50, variantStock));
  const safeQuantity = Math.min(selectedQuantity, maxOrderQty);
  const canAddToCart = product.totalStock > 0 && variantStock > 0;
  const hasReal3DModel = Boolean(product.showroomMapping.has3DModel && webglCaps.supported);

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12 fw-animate-fade">
      {/* Breadcrumb Bar */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-2 text-xs text-[#1F1D2B]/60"
      >
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="inline-flex items-center gap-1.5 font-semibold text-[#FF7A00] hover:text-[#1F1D2B] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Catalog
        </button>
        <span aria-hidden="true">/</span>
        <span>{product.categoryName}</span>
        <span aria-hidden="true">/</span>
        <span>{product.subcategoryName}</span>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-[#1F1D2B] truncate">{product.name}</span>
      </nav>

      {/* Main 2-Column Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left: Multi-Image Gallery & 360° Entry Point */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-[#1F1D2B]/12 bg-white">
            <ResilientImage
              src={currentImage?.url || product.mainImage}
              alt={currentImage?.alt || product.name}
              className="h-full w-full object-cover"
            />

            {currentImage && (
              <span className="absolute top-4 left-4 rounded-lg bg-[#1F1D2B]/88 px-3 py-1 text-xs font-semibold text-[#FFF8EF]">
                {currentImage.viewType}
              </span>
            )}

            {/* 360° Interactive Viewer Trigger */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1F1D2B]/92 border border-[#FFA94D]/40 px-4 text-xs font-semibold text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer"
              >
                <RotateCw className="h-4 w-4 text-[#FFA94D]" />
                {hasReal3DModel ? 'Open 360° 3D Viewer' : 'Open Studio Gallery Viewer'}
              </button>

              {product.showroomMapping.enabled && (
                <button
                  type="button"
                  onClick={() => navigate('/showroom')}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/95 border border-[#1F1D2B]/15 px-4 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00] transition-colors cursor-pointer"
                >
                  <Box className="h-4 w-4 text-[#FF7A00]" />
                  See in 3D Showroom
                </button>
              )}
            </div>
          </div>

          {/* Thumbnail Strip */}
          {sortedImages.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
              {sortedImages.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`group overflow-hidden rounded-xl border bg-white p-1 text-left transition-all cursor-pointer ${
                    activeImageIdx === idx
                      ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25'
                      : 'border-[#1F1D2B]/12 hover:border-[#FF7A00]/60'
                  }`}
                >
                  <ResilientImage
                    src={img.url}
                    alt={img.alt}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  <span className="mt-1 block truncate px-0.5 text-[10px] font-medium text-[#1F1D2B]/70">
                    {img.viewType}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Honest 3D Model Fallback Notice when 3D Model is Unavailable */}
          {!hasReal3DModel && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#F59E0B]/40 bg-[#FFE4C7]/55 p-3.5 text-xs text-[#1F1D2B]">
              <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">3D Model Fallback Active</p>
                <p className="text-[#1F1D2B]/75 mt-0.5">
                  {!product.showroomMapping.has3DModel
                    ? 'A real 3D garment model has not been uploaded for this product yet. High-resolution studio photography views are shown instead.'
                    : 'WebGL 3D rendering is unavailable on this browser. Multi-angle studio photography fallback is enabled.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Product Info, Variant Selectors, Stock & Specifications */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3 border-b border-[#1F1D2B]/10 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#1F1D2B]/65">
              <span className="font-semibold text-[#FF7A00]">{product.brand}</span>
              <span className="font-mono">
                SKU: {activeVariant?.sku || product.sku}
                {product.isDemoData ? ' · Demo Catalog' : ''}
              </span>
            </div>

            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F1D2B] tracking-tight text-balance">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3">
              <RatingDisplay rating={product.rating} reviewCount={product.reviewCount} />
              <span className="text-[#1F1D2B]/25" aria-hidden="true">
                ·
              </span>
              <StockStatusLabel status={product.stockStatus} count={product.totalStock} />
            </div>

            <div className="pt-1 space-y-1">
              <PriceDisplay
                discountedPrice={product.legacyProduct.discountedPrice}
                originalPrice={product.originalPrice}
                discountPercent={product.discountPercentage}
                size="lg"
              />
              <p className="text-xs text-[#1F1D2B]/60">{product.taxInfoPlaceholder}</p>
            </div>

            <p className="text-sm text-[#1F1D2B]/80 leading-relaxed pt-1">
              {product.description}
            </p>
          </div>

          {/* Colour Selector */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[#1F1D2B]">
              Select Colour:{' '}
              <span className="font-normal text-[#1F1D2B]/70">{selectedColor}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {product.availableColors.map((c) => {
                const active = selectedColor === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.name);
                      const firstSizeForColor = product.variants.find(
                        (v) => v.colour === c.name && v.stockQuantity > 0
                      ) || product.variants.find((v) => v.colour === c.name);
                      if (firstSizeForColor) setSelectedSize(firstSizeForColor.size);
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'border-[#FF7A00] bg-[#FFE4C7]/50 text-[#1F1D2B]'
                        : 'border-[#1F1D2B]/15 bg-white text-[#1F1D2B]/80 hover:border-[#FF7A00]'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-[#1F1D2B]/25 shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Selector with Exact Per-Variant Stock */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#1F1D2B]">
                Select Size:{' '}
                <span className="font-normal text-[#1F1D2B]/70">{selectedSize}</span>
              </p>
              {activeVariant && (
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    activeVariant.stockQuantity === 0
                      ? 'text-[#DC2626]'
                      : activeVariant.stockQuantity <= product.lowStockThreshold
                        ? 'text-[#F59E0B]'
                        : 'text-[#16A34A]'
                  }`}
                >
                  {activeVariant.stockQuantity === 0
                    ? 'Variant Out of Stock'
                    : `${activeVariant.stockQuantity} in stock for ${selectedColor} / ${selectedSize}`}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {sizesForSelectedColor.map((variant) => {
                const isSelected = selectedSize === variant.size;
                const soldOut = variant.stockQuantity <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedSize(variant.size)}
                    className={`min-w-[56px] h-11 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                        : soldOut
                          ? 'bg-[#FFF8EF] border border-[#1F1D2B]/10 text-[#1F1D2B]/40 line-through'
                          : 'bg-white border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00]'
                    }`}
                  >
                    <span>{variant.size}</span>
                    <span
                      className={`text-[9px] tabular-nums ${
                        isSelected ? 'text-[#FFA94D]' : 'text-[#1F1D2B]/50'
                      }`}
                    >
                      {soldOut ? '0 left' : `${variant.stockQuantity} qty`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#1F1D2B]">Choose Quantity</p>
              <span className="text-xs text-[#1F1D2B]/60 tabular-nums">
                {canAddToCart ? `Max ${maxOrderQty} available` : 'Unavailable'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-xl border border-[#1F1D2B]/15 bg-white p-1">
                <button
                  type="button"
                  disabled={!canAddToCart || safeQuantity <= 1}
                  onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#FFF8EF] disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-11 text-center text-sm font-bold text-[#1F1D2B] tabular-nums">
                  {canAddToCart ? safeQuantity : 0}
                </span>
                <button
                  type="button"
                  disabled={!canAddToCart || safeQuantity >= maxOrderQty}
                  onClick={() => setSelectedQuantity((q) => Math.min(maxOrderQty, q + 1))}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#FFF8EF] disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {canAddToCart && (
                <span className="text-xs text-[#1F1D2B]/65 tabular-nums">
                  Line Total:{' '}
                  <strong className="text-[#1F1D2B]">
                    {formatINR(product.legacyProduct.discountedPrice * safeQuantity)}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {/* Primary Actions */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!canAddToCart}
                leftIcon={<ShoppingBag className="h-4 w-4" />}
                onClick={() => {
                  void addToCart(
                    product.legacyProduct,
                    selectedSize,
                    selectedColor,
                    safeQuantity
                  );
                }}
              >
                {canAddToCart
                  ? `Add to Cart — ${formatINR(product.legacyProduct.discountedPrice * safeQuantity)}`
                  : 'Selected Variant Out of Stock'}
              </Button>

              <Button
                variant={isWishlisted ? 'secondary' : 'outline'}
                size="lg"
                leftIcon={
                  <Heart
                    className={`h-4 w-4 ${isWishlisted ? 'fill-current text-[#FF7A00]' : ''}`}
                  />
                }
                onClick={() => toggleWishlist(product.legacyProduct)}
                className="sm:w-40 shrink-0"
              >
                {isWishlisted ? 'Saved' : 'Wishlist'}
              </Button>
            </div>

            {canAddToCart && (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                leftIcon={<Zap className="h-4 w-4 text-[#FFA94D]" />}
                onClick={async () => {
                  const ok = await addToCart(
                    product.legacyProduct,
                    selectedSize,
                    selectedColor,
                    safeQuantity
                  );
                  if (ok) navigate('/checkout');
                }}
              >
                Buy Now — Proceed to Checkout
              </Button>
            )}
          </div>

          {/* Trust & Showroom Mapping Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-[#1F1D2B]/10 bg-white p-3 flex items-center gap-2.5">
              <Truck className="h-4 w-4 text-[#FF7A00] shrink-0" />
              <span>Free insured shipping above ₹999</span>
            </div>
            <div className="rounded-xl border border-[#1F1D2B]/10 bg-white p-3 flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-[#16A34A] shrink-0" />
              <span>Authentic textile verification</span>
            </div>
            <div className="rounded-xl border border-[#1F1D2B]/10 bg-white p-3 flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-[#2563EB] shrink-0" />
              <span>
                {product.showroomMapping.enabled
                  ? `3D Rack: ${product.showroomMapping.rackId}`
                  : 'Online Boutique Exclusive'}
              </span>
            </div>
          </div>

          {/* Fabric & Product Specifications */}
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3">
            <h2 className="font-heading text-sm font-bold text-[#1F1D2B] flex items-center gap-2">
              <Info className="h-4 w-4 text-[#FF7A00]" />
              Fabric &amp; Product Specifications
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
              <div className="flex justify-between gap-2 border-b border-[#1F1D2B]/8 pb-2">
                <dt className="text-[#1F1D2B]/60">Fabric Composition</dt>
                <dd className="font-semibold text-[#1F1D2B] text-right">{product.fabric}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[#1F1D2B]/8 pb-2">
                <dt className="text-[#1F1D2B]/60">Garment Weight</dt>
                <dd className="font-semibold text-[#1F1D2B] text-right">{product.weight}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[#1F1D2B]/8 pb-2">
                <dt className="text-[#1F1D2B]/60">Department</dt>
                <dd className="font-semibold text-[#1F1D2B] text-right">
                  {product.categoryName} · {product.subcategoryName}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-[#1F1D2B]/8 pb-2">
                <dt className="text-[#1F1D2B]/60">Total Catalog Stock</dt>
                <dd className="font-semibold text-[#1F1D2B] text-right tabular-nums">
                  {product.totalStock} units ({product.variants.length} variants)
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:col-span-2">
                <dt className="text-[#1F1D2B]/60">Style Tags</dt>
                <dd className="font-medium text-[#1F1D2B] text-right">
                  {product.tags.join(' · ') || 'Curated Fashion World Piece'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16 pt-10 border-t border-[#1F1D2B]/10 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#FF7A00]">Curated Recommendations</p>
              <h2 className="font-heading text-2xl font-bold text-[#1F1D2B]">
                Related {product.categoryName}
              </h2>
            </div>
            <ProductBadge tone="surface">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
              Live Catalog
            </ProductBadge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {relatedProducts.map((rel) => (
              <ProductCard
                key={rel.id}
                product={rel.legacyProduct}
                productSlug={rel.slug}
                layout="desktop"
                isWishlisted={wishlistIds.includes(rel.id)}
                onToggleWishlist={toggleWishlist}
                onAddToCart={addToCart}
                onQuickView={openQuickView}
                onViewDetails={() => navigate(`/product/${rel.slug}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 360° Interactive Viewer Modal (with automatic fallback if no 3D model / WebGL) */}
      <ProductViewer
        product={viewerOpen ? toShowroomProduct(product) : null}
        webglSupported={webglCaps.supported}
        onClose={() => setViewerOpen(false)}
      />
    </main>
  );
};
