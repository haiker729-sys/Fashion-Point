import React, { useEffect, useState } from 'react';
import { Box, Heart, ShoppingBag, X } from 'lucide-react';
import type { ShowroomProduct } from '../../data/showroomProducts';
import { useStore } from '../../context/StoreContext';
import {
  Button,
  PriceDisplay,
  ProductBadge,
  RatingDisplay,
  ResilientImage,
  StockStatusLabel,
} from '../ui/Primitives';

interface ProductInfoPanelProps {
  product: ShowroomProduct | null;
  onClose: () => void;
  onOpen360Viewer: (product: ShowroomProduct) => void;
}

export const ProductInfoPanel: React.FC<ProductInfoPanelProps> = ({
  product,
  onClose,
  onOpen360Viewer,
}) => {
  const { wishlistIds, toggleWishlist, addToCart } = useStore();
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('M');

  useEffect(() => {
    if (!product) return;
    setSelectedColorIdx(0);
    setSelectedSize(product.sizes[Math.min(1, product.sizes.length - 1)] || 'M');
  }, [product]);

  if (!product) return null;

  const isWishlisted = wishlistIds.includes(product.id);
  const activeColor = product.colors[selectedColorIdx] || product.colors[0];

  return (
    <aside
      aria-label="Selected Showroom Product Details"
      className="pointer-events-auto w-full max-w-[360px] rounded-2xl border border-[#FFA94D]/35 bg-[#FFF8EF] text-[#1F1D2B] shadow-2xl overflow-hidden"
    >
      {/* Top Header Strip */}
      <div className="flex items-center justify-between bg-[#1F1D2B] px-4 py-3 text-[#FFF8EF]">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FFA94D]">
            {product.showroomZone} · Demo Item
          </p>
          <p className="truncate text-xs font-medium text-[#FFF8EF]/75">{product.sku}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#FFF8EF]/75 hover:bg-[#FFF8EF]/15 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Product Body */}
      <div className="max-h-[62vh] sm:max-h-[68vh] overflow-y-auto p-4 space-y-3.5">
        <div className="flex gap-3.5 items-start">
          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-[#1F1D2B]/10 bg-white">
            <ResilientImage
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <ProductBadge tone="surface">Demo Catalog</ProductBadge>
              {product.discountPercent > 0 && (
                <ProductBadge tone="accent">{product.discountPercent}% OFF</ProductBadge>
              )}
            </div>
            <h2 className="font-heading text-base font-bold leading-snug text-[#1F1D2B]">
              {product.name}
            </h2>
            <RatingDisplay rating={product.rating} reviewCount={product.reviewCount} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[#1F1D2B]/10 py-2.5">
          <PriceDisplay
            discountedPrice={product.discountedPrice}
            originalPrice={product.originalPrice}
            discountPercent={product.discountPercent}
            size="md"
          />
          <StockStatusLabel status={product.stockStatus} count={product.stockCount} />
        </div>

        {/* Colour Selector */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#1F1D2B]">
            Colour:{' '}
            <span className="font-normal text-[#1F1D2B]/70">{activeColor?.name}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {product.colors.map((c, idx) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedColorIdx(idx)}
                aria-label={`Select color ${c.name}`}
                className={`h-7 w-7 rounded-full border cursor-pointer transition-transform ${
                  selectedColorIdx === idx
                    ? 'ring-2 ring-[#FF7A00] ring-offset-2 border-white scale-105'
                    : 'border-[#1F1D2B]/25'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        {/* Size Selector */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#1F1D2B]">Available Sizes</p>
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`min-w-[38px] h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  selectedSize === size
                    ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                    : 'bg-white border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Primary CTA Buttons */}
        <div className="space-y-2 pt-1">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            leftIcon={<Box className="h-4 w-4" />}
            onClick={() => onOpen360Viewer(product)}
          >
            View 360° & Full Details
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="md"
              fullWidth
              disabled={product.stockStatus === 'out_of_stock'}
              leftIcon={<ShoppingBag className="h-4 w-4" />}
              onClick={() => addToCart(product, selectedSize, activeColor?.name || 'Default')}
            >
              Add to Cart
            </Button>
            <Button
              variant="outline"
              size="md"
              fullWidth
              leftIcon={
                <Heart
                  className={`h-4 w-4 ${isWishlisted ? 'fill-current text-[#FF7A00]' : ''}`}
                />
              }
              onClick={() => toggleWishlist(product)}
            >
              {isWishlisted ? 'Saved' : 'Wishlist'}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};
