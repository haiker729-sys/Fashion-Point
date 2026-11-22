import React, { useState } from 'react';
import { Eye, Heart, RotateCw, ShoppingBag } from 'lucide-react';
import type { Product } from '../../data/catalog';
import {
  Button,
  PriceDisplay,
  ProductBadge,
  RatingDisplay,
  ResilientImage,
  StockStatusLabel,
} from '../ui/Primitives';

export interface ProductCardProps {
  product: Product;
  productSlug?: string;
  layout?: 'desktop' | 'mobile';
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onAddToCart: (product: Product, size: string, colorName: string) => void;
  onQuickView: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  layout = 'desktop',
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onQuickView,
  onViewDetails,
}) => {
  const handleInspect = () => {
    if (onViewDetails) {
      onViewDetails(product);
    } else {
      onQuickView(product);
    }
  };
  const [selectedSize, setSelectedSize] = useState(
    product.sizes[Math.min(1, product.sizes.length - 1)]
  );
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.name || '');
  const isOutOfStock = product.stockStatus === 'out_of_stock';

  if (layout === 'mobile') {
    return (
      <article className="flex gap-3.5 rounded-2xl border border-[#1F1D2B]/10 bg-white p-3 fw-card-hover">
        <div className="relative w-28 sm:w-32 shrink-0 overflow-hidden rounded-xl bg-[#FFF8EF]">
          <button
            type="button"
            onClick={handleInspect}
            className="block h-full w-full cursor-pointer text-left"
            aria-label={`Inspect ${product.name}`}
          >
            <ResilientImage
              src={product.image}
              alt={product.name}
              className="h-full w-full aspect-[3/4] object-cover transition-transform duration-300 hover:scale-[1.03]"
            />
          </button>
          <button
            type="button"
            onClick={() => onToggleWishlist(product)}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-xs transition-colors cursor-pointer ${
              isWishlisted
                ? 'bg-[#FF7A00] border-[#FF7A00] text-white'
                : 'bg-white/90 border-[#1F1D2B]/12 text-[#1F1D2B]'
            }`}
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#1F1D2B]/55 truncate">
                {product.category} · {product.subcategory}
              </span>
              <RatingDisplay rating={product.rating} compact />
            </div>

            <button
              type="button"
              onClick={handleInspect}
              className="block text-left font-heading text-sm font-semibold text-[#1F1D2B] hover:text-[#FF7A00] transition-colors line-clamp-2 cursor-pointer"
            >
              {product.name}
            </button>

            <PriceDisplay
              discountedPrice={product.discountedPrice}
              originalPrice={product.originalPrice}
              discountPercent={product.discountPercent}
              size="sm"
            />

            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex items-center gap-1">
                {product.colors.slice(0, 4).map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(color.name)}
                    aria-label={`Color ${color.name}`}
                    className={`h-4 w-4 rounded-full border cursor-pointer transition-transform ${
                      selectedColor === color.name
                        ? 'ring-2 ring-[#FF7A00] ring-offset-1 scale-105 border-white'
                        : 'border-[#1F1D2B]/25'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
              <span className="text-[#1F1D2B]/25" aria-hidden="true">
                |
              </span>
              <StockStatusLabel status={product.stockStatus} count={product.stockCount} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant={isOutOfStock ? 'outline' : 'primary'}
              size="sm"
              fullWidth
              disabled={isOutOfStock}
              onClick={() => onAddToCart(product, selectedSize, selectedColor)}
              leftIcon={<ShoppingBag className="h-3.5 w-3.5" />}
            >
              {isOutOfStock ? 'Unavailable' : 'Add to Cart'}
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden fw-card-hover">
      {/* Product Imagery (65%+ of card visual presence) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#FFF8EF]">
        <button
          type="button"
          onClick={handleInspect}
          className="block h-full w-full cursor-pointer text-left"
          aria-label={`View details for ${product.name}`}
        >
          <ResilientImage
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        {/* Top-left subtle discount or new tag (max 1 badge) */}
        <div className="absolute top-3 left-3">
          {isOutOfStock ? (
            <ProductBadge tone="error">Sold Out</ProductBadge>
          ) : product.discountPercent > 0 ? (
            <ProductBadge tone="accent">{product.discountPercent}% OFF</ProductBadge>
          ) : product.isNewArrival ? (
            <ProductBadge tone="primary">New</ProductBadge>
          ) : null}
        </div>

        {/* Top-right Wishlist Action */}
        <button
          type="button"
          onClick={() => onToggleWishlist(product)}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-all duration-150 cursor-pointer ${
            isWishlisted
              ? 'bg-[#FF7A00] border-[#FF7A00] text-white'
              : 'bg-white/95 border-[#1F1D2B]/12 text-[#1F1D2B] hover:border-[#FF7A00] hover:text-[#FF7A00]'
          }`}
        >
          <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Bottom image overlay controls: 360° indicator & quick view */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          {product.has360Preview ? (
            <button
              type="button"
              onClick={() => onQuickView(product)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F1D2B]/85 px-2.5 py-1.5 text-[11px] font-semibold text-[#FFF8EF] backdrop-blur-xs hover:bg-[#1F1D2B] transition-colors cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#FFA94D]" />
              360° Preview
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => onQuickView(product)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-[#1F1D2B] border border-[#1F1D2B]/12 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-[#FF7A00]" />
            Quick View
          </button>
        </div>
      </div>

      {/* Product Metadata & Interactive Variant Selectors */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-[#1F1D2B]/55">
            <span className="truncate">
              {product.category} · {product.subcategory}
            </span>
            <StockStatusLabel status={product.stockStatus} count={product.stockCount} />
          </div>

          <button
            type="button"
            onClick={handleInspect}
            className="block text-left font-heading text-base font-semibold text-[#1F1D2B] hover:text-[#FF7A00] transition-colors leading-snug line-clamp-2 cursor-pointer"
          >
            {product.name}
          </button>

          <RatingDisplay rating={product.rating} reviewCount={product.reviewCount} />

          <PriceDisplay
            discountedPrice={product.discountedPrice}
            originalPrice={product.originalPrice}
            discountPercent={product.discountPercent}
            size="md"
          />
        </div>

        {/* Swatches & Sizes */}
        <div className="space-y-3 pt-2 border-t border-[#1F1D2B]/8">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#1F1D2B]/60 truncate">
              Color: <strong className="font-medium text-[#1F1D2B]">{selectedColor}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              {product.colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setSelectedColor(color.name)}
                  aria-label={`Select color ${color.name}`}
                  title={color.name}
                  className={`h-5 w-5 rounded-full border transition-transform cursor-pointer ${
                    selectedColor === color.name
                      ? 'ring-2 ring-[#FF7A00] ring-offset-1 scale-105 border-white'
                      : 'border-[#1F1D2B]/25 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select size">
            {product.sizes.map((size) => {
              const active = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`min-w-[34px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                      : 'bg-[#FFF8EF] text-[#1F1D2B]/80 border border-[#1F1D2B]/12 hover:border-[#FF7A00]'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isOutOfStock ? 'outline' : 'primary'}
              size="md"
              fullWidth
              disabled={isOutOfStock}
              onClick={() => onAddToCart(product, selectedSize, selectedColor)}
              leftIcon={<ShoppingBag className="h-4 w-4" />}
            >
              {isOutOfStock ? 'Unavailable' : 'Add to Cart'}
            </Button>
            {onViewDetails && (
              <Button
                variant="outline"
                size="md"
                onClick={() => onViewDetails(product)}
                className="shrink-0"
              >
                Details
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
