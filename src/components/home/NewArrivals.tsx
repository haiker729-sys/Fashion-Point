import React, { useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { useRouter } from '../../router/RouterContext';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../storefront/ProductCard';
import { SkeletonProductCard } from '../ui/Primitives';

export const NewArrivals: React.FC = () => {
  const { navigate } = useRouter();
  const { publishedProducts } = useCatalog();
  const { wishlistIds, toggleWishlist, addToCart, openQuickView } = useStore();
  const [previewLoading, setPreviewLoading] = useState(false);

  const newArrivalProducts = publishedProducts.filter((p) => p.newArrival).slice(0, 4);

  const triggerSkeletonDemo = () => {
    setPreviewLoading(true);
    window.setTimeout(() => setPreviewLoading(false), 900);
  };

  return (
    <section
      aria-labelledby="new-arrivals-heading"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">Fresh From the Atelier</p>
          <h2
            id="new-arrivals-heading"
            className="mt-1 font-heading text-2xl sm:text-3xl font-semibold text-[#1F1D2B] tracking-tight"
          >
            New Arrivals
          </h2>
          <p className="mt-1 text-sm text-[#1F1D2B]/65">
            Newly tailored releases with verified sizing, 360° previews, and seasonal privilege pricing.
          </p>
        </div>

        <div className="flex items-center gap-4 self-start sm:self-auto">
          <button
            type="button"
            onClick={triggerSkeletonDemo}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F1D2B]/65 hover:text-[#FF7A00] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${previewLoading ? 'animate-spin text-[#FF7A00]' : ''}`} />
            Refresh Feed
          </button>
          <button
            type="button"
            onClick={() => navigate('/new-arrivals')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF7A00] hover:text-[#1F1D2B] transition-colors cursor-pointer whitespace-nowrap"
          >
            View All New Arrivals
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {previewLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonProductCard key={i} />)
          : newArrivalProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product.legacyProduct}
                productSlug={product.slug}
                layout="desktop"
                isWishlisted={wishlistIds.includes(product.id)}
                onToggleWishlist={toggleWishlist}
                onAddToCart={addToCart}
                onQuickView={openQuickView}
                onViewDetails={() => navigate(`/product/${product.slug}`)}
              />
            ))}
      </div>
    </section>
  );
};
