import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { useRouter } from '../../router/RouterContext';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../storefront/ProductCard';

const FILTER_TABS = ['All', 'Men', 'Women', 'Traditional Wear', 'Kids'] as const;

export const BestSellers: React.FC = () => {
  const { navigate } = useRouter();
  const { publishedProducts } = useCatalog();
  const { wishlistIds, toggleWishlist, addToCart, openQuickView } = useStore();
  const [selectedTab, setSelectedTab] = useState<(typeof FILTER_TABS)[number]>('All');

  const bestSellers = useMemo(() => {
    const base = publishedProducts.filter((p) => p.bestSeller || p.rating >= 4.8);
    if (selectedTab === 'All') return base.slice(0, 4);
    return publishedProducts
      .filter((p) => p.legacyProduct.category === selectedTab)
      .slice(0, 4);
  }, [publishedProducts, selectedTab]);

  return (
    <section
      aria-labelledby="best-sellers-heading"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">Most Coveted Pieces</p>
          <h2
            id="best-sellers-heading"
            className="mt-1 font-heading text-2xl sm:text-3xl font-semibold text-[#1F1D2B] tracking-tight"
          >
            Best Sellers
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
          <div
            role="tablist"
            aria-label="Filter best sellers by department"
            className="inline-flex items-center gap-1 rounded-xl bg-white p-1 border border-[#1F1D2B]/10 overflow-x-auto fw-no-scrollbar max-w-full"
          >
            {FILTER_TABS.map((tab) => {
              const active = selectedTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedTab(tab)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                      : 'text-[#1F1D2B]/70 hover:text-[#1F1D2B]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => navigate('/offers')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF7A00] hover:text-[#1F1D2B] transition-colors cursor-pointer whitespace-nowrap"
          >
            Shop All Popular
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {bestSellers.map((product) => (
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
