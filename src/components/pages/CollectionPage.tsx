import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Filter, LayoutGrid, List, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { useRouter } from '../../router/RouterContext';
import { useStore } from '../../context/StoreContext';
import type { ResolvedCatalogProduct } from '../../types/catalog';
import { formatINR } from '../../utils/catalogHelpers';
import { ProductCard } from '../storefront/ProductCard';
import { Dropdown, EmptyState, SearchBar } from '../ui/Primitives';

export type CollectionKind =
  | 'men'
  | 'women'
  | 'kids'
  | 'traditional'
  | 'new-arrivals'
  | 'offers'
  | 'search';

interface CollectionPageProps {
  kind: CollectionKind;
}

const COLLECTION_META: Record<
  CollectionKind,
  { kicker: string; title: string; subtitle: string; filter: (p: ResolvedCatalogProduct) => boolean }
> = {
  men: {
    kicker: "Men's Department",
    title: "Men's Fashion",
    subtitle: 'Tailored casual shirts, Italian linen blazers, Japanese selvedge denim, and Supima basics.',
    filter: (p) => p.legacyProduct.category === 'Men' || p.categoryId === 'cat-mens',
  },
  women: {
    kicker: "Women's Atelier",
    title: "Women's Fashion",
    subtitle: 'Cashmere-wool trench coats, artisanal kurtis, sarees, and elevated luxury silhouettes.',
    filter: (p) =>
      p.legacyProduct.category === 'Women' ||
      p.categoryId === 'cat-womens' ||
      p.subcategoryName.toLowerCase().includes('kurti') ||
      p.subcategoryName.toLowerCase().includes('saree'),
  },
  kids: {
    kicker: 'Junior Boutique',
    title: 'Kids Fashion',
    subtitle: 'Quilted designer outerwear, soft-washed denim, and celebration-ready sets.',
    filter: (p) => p.legacyProduct.category === 'Kids' || p.categoryId === 'cat-kids',
  },
  traditional: {
    kicker: 'Heritage Couture',
    title: 'Traditional Wear',
    subtitle: 'Handwoven Banarasi zari silk sarees, embroidered kurtis, and ceremonial bandhgala sherwanis.',
    filter: (p) =>
      p.legacyProduct.category === 'Traditional Wear' || p.categoryId === 'cat-traditional',
  },
  'new-arrivals': {
    kicker: 'Latest Release',
    title: 'New Arrivals',
    subtitle: 'Fresh seasonal arrivals straight from the 3D Jummo Fashion World atelier.',
    filter: (p) => p.newArrival,
  },
  offers: {
    kicker: 'Festival & Seasonal Privileges',
    title: 'Special Offers & Best Deals',
    subtitle: 'Curated luxury styles with up to 40% seasonal savings.',
    filter: (p) => p.discountCollection || p.discountPercentage >= 25,
  },
  search: {
    kicker: 'Catalog Explorer',
    title: 'All Clothing Products',
    subtitle: 'Browse and filter across all departments, brands, sizes, colours, and discounts.',
    filter: () => true,
  },
};

export const CollectionPage: React.FC<CollectionPageProps> = ({ kind }) => {
  const { searchParams, navigate } = useRouter();
  const { publishedProducts, categories } = useCatalog();
  const { wishlistIds, toggleWishlist, addToCart, openQuickView } = useStore();

  const meta = COLLECTION_META[kind];
  const urlQuery = kind === 'search' ? searchParams.get('q') || '' : '';

  const [localQuery, setLocalQuery] = useState(urlQuery);
  const [sortBy, setSortBy] = useState('popularity');
  const [layout, setLayout] = useState<'desktop' | 'mobile'>('desktop');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Full Phase 4 Faceted Filters (Section 8)
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [subFilter, setSubFilter] = useState('All');
  const [maxPrice, setMaxPrice] = useState<number>(20000);
  const [sizeFilter, setSizeFilter] = useState('All');
  const [colourFilter, setColourFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in_stock' | 'low_stock'>(
    'all'
  );

  useEffect(() => {
    if (kind === 'search') {
      setLocalQuery(searchParams.get('q') || '');
    } else {
      setLocalQuery('');
    }
    setCategoryFilter('All');
    setSubFilter('All');
    setSizeFilter('All');
    setColourFilter('All');
    setBrandFilter('All');
    setMinDiscount(0);
    setAvailabilityFilter('all');
    setMaxPrice(20000);
  }, [kind, searchParams]);

  const baseProducts = useMemo(
    () => publishedProducts.filter(meta.filter),
    [publishedProducts, meta]
  );

  const facetOptions = useMemo(() => {
    const subcategories = Array.from(new Set(baseProducts.map((p) => p.subcategoryName)));
    const brands = Array.from(new Set(baseProducts.map((p) => p.brand)));
    const sizes = Array.from(new Set(baseProducts.flatMap((p) => p.availableSizes)));
    const colorMap = new Map<string, string>();
    baseProducts.forEach((p) => {
      p.availableColors.forEach((c) => {
        if (!colorMap.has(c.name)) colorMap.set(c.name, c.hex);
      });
    });
    const maxCatalogPrice = Math.max(
      2000,
      ...baseProducts.map((p) => p.legacyProduct.discountedPrice)
    );
    return {
      subcategories: ['All', ...subcategories],
      brands: ['All', ...brands],
      sizes: ['All', ...sizes],
      colors: Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex })),
      maxCatalogPrice: Math.ceil(maxCatalogPrice / 500) * 500,
    };
  }, [baseProducts]);

  const displayedProducts = useMemo(() => {
    let list = [...baseProducts];

    if (categoryFilter !== 'All') {
      list = list.filter((p) => p.categoryId === categoryFilter);
    }
    if (subFilter !== 'All') {
      list = list.filter((p) => p.subcategoryName === subFilter);
    }
    if (sizeFilter !== 'All') {
      list = list.filter((p) =>
        p.variants.some((v) => v.size === sizeFilter && v.stockQuantity > 0)
      );
    }
    if (colourFilter !== 'All') {
      list = list.filter((p) =>
        p.availableColors.some((c) => c.name === colourFilter)
      );
    }
    if (brandFilter !== 'All') {
      list = list.filter((p) => p.brand === brandFilter);
    }
    if (minDiscount > 0) {
      list = list.filter((p) => p.discountPercentage >= minDiscount);
    }
    if (availabilityFilter === 'in_stock') {
      list = list.filter((p) => p.totalStock > 0);
    } else if (availabilityFilter === 'low_stock') {
      list = list.filter((p) => p.stockStatus === 'low_stock');
    }
    list = list.filter((p) => p.legacyProduct.discountedPrice <= maxPrice);

    const q = localQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.subcategoryName.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.description.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.legacyProduct.discountedPrice - b.legacyProduct.discountedPrice);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.legacyProduct.discountedPrice - a.legacyProduct.discountedPrice);
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'popularity') {
      list.sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating);
    }

    return list;
  }, [
    baseProducts,
    categoryFilter,
    subFilter,
    sizeFilter,
    colourFilter,
    brandFilter,
    minDiscount,
    availabilityFilter,
    maxPrice,
    localQuery,
    sortBy,
  ]);

  const activeFilterCount = [
    categoryFilter !== 'All',
    subFilter !== 'All',
    sizeFilter !== 'All',
    colourFilter !== 'All',
    brandFilter !== 'All',
    minDiscount > 0,
    availabilityFilter !== 'all',
    maxPrice < facetOptions.maxCatalogPrice,
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setLocalQuery('');
    setCategoryFilter('All');
    setSubFilter('All');
    setSizeFilter('All');
    setColourFilter('All');
    setBrandFilter('All');
    setMinDiscount(0);
    setAvailabilityFilter('all');
    setMaxPrice(facetOptions.maxCatalogPrice);
  };

  const renderFilterControls = () => (
    <div className="space-y-5 text-xs">
      <div className="flex items-center justify-between border-b border-[#1F1D2B]/10 pb-3">
        <span className="font-heading text-sm font-bold text-[#1F1D2B] inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4 text-[#FF7A00]" />
          Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1 font-semibold text-[#FF7A00] hover:text-[#1F1D2B] cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="space-y-1.5">
        <label className="block font-semibold text-[#1F1D2B]">Category</label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-2.5 text-xs font-medium text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
        >
          <option value="All">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="price-range-slider" className="font-semibold text-[#1F1D2B]">
            Max Price (₹)
          </label>
          <span className="font-mono font-bold text-[#FF7A00] tabular-nums">
            Up to {formatINR(Math.min(maxPrice, facetOptions.maxCatalogPrice))}
          </span>
        </div>
        <input
          id="price-range-slider"
          type="range"
          min={500}
          max={Math.max(2000, facetOptions.maxCatalogPrice)}
          step={500}
          value={Math.min(maxPrice, Math.max(2000, facetOptions.maxCatalogPrice))}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-[#FF7A00] cursor-pointer"
        />
      </div>

      {/* Size Filter */}
      <div className="space-y-2">
        <p className="font-semibold text-[#1F1D2B]">Size</p>
        <div className="flex flex-wrap gap-1.5">
          {facetOptions.sizes.map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => setSizeFilter(sz)}
              className={`min-w-[38px] h-8 px-2.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                sizeFilter === sz
                  ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                  : 'bg-[#FFF8EF] border border-[#1F1D2B]/12 text-[#1F1D2B] hover:border-[#FF7A00]'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* Colour Filter */}
      {facetOptions.colors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#1F1D2B]">Colour</p>
            {colourFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setColourFilter('All')}
                className="text-[11px] text-[#FF7A00] font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {facetOptions.colors.map((c) => {
              const active = colourFilter === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColourFilter(active ? 'All' : c.name)}
                  title={c.name}
                  aria-label={`Filter by colour ${c.name}`}
                  className={`h-7 w-7 rounded-full border cursor-pointer transition-transform ${
                    active
                      ? 'ring-2 ring-[#FF7A00] ring-offset-2 border-white scale-110'
                      : 'border-[#1F1D2B]/25 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Brand Filter */}
      <div className="space-y-1.5">
        <label className="block font-semibold text-[#1F1D2B]">Brand</label>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="w-full h-10 rounded-xl border border-[#1F1D2B]/15 bg-[#FFF8EF]/50 px-2.5 text-xs font-medium text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
        >
          {facetOptions.brands.map((b) => (
            <option key={b} value={b}>
              {b === 'All' ? 'All Brands' : b}
            </option>
          ))}
        </select>
      </div>

      {/* Discount Filter */}
      <div className="space-y-2">
        <p className="font-semibold text-[#1F1D2B]">Minimum Discount</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 20, 30, 40].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setMinDiscount(pct)}
              className={`h-8 rounded-lg font-semibold transition-colors cursor-pointer ${
                minDiscount === pct
                  ? 'bg-[#FF7A00] text-white'
                  : 'bg-[#FFF8EF] border border-[#1F1D2B]/12 text-[#1F1D2B] hover:border-[#FF7A00]'
              }`}
            >
              {pct === 0 ? 'Any' : `${pct}%+ Off`}
            </button>
          ))}
        </div>
      </div>

      {/* Availability Filter */}
      <div className="space-y-2">
        <p className="font-semibold text-[#1F1D2B]">Availability</p>
        <div className="space-y-1.5">
          {[
            { id: 'all', label: 'All Products' },
            { id: 'in_stock', label: 'In Stock Only' },
            { id: 'low_stock', label: 'Limited / Low Stock' },
          ].map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="availability-filter"
                checked={availabilityFilter === opt.id}
                onChange={() => setAvailabilityFilter(opt.id as typeof availabilityFilter)}
                className="accent-[#FF7A00]"
              />
              <span className="text-[#1F1D2B]/85">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[70vh] fw-animate-fade">
      {/* Header Row */}
      <div className="space-y-4 pb-6 border-b border-[#1F1D2B]/10">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#FF7A00]">{meta.kicker}</p>
            <h1 className="mt-1 font-heading text-2xl sm:text-4xl font-bold text-[#1F1D2B] tracking-tight">
              {kind === 'search' && localQuery.trim()
                ? `Search Results for “${localQuery.trim()}”`
                : meta.title}
            </h1>
            <p className="mt-1.5 text-sm text-[#1F1D2B]/65 leading-relaxed">{meta.subtitle}</p>
          </div>

          <div className="w-full lg:w-80">
            <SearchBar
              value={localQuery}
              onChange={setLocalQuery}
              placeholder={`Search within ${meta.title.toLowerCase()}...`}
            />
          </div>
        </div>

        {/* Subcategory Quick Bar + Layout + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto fw-no-scrollbar">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-[#1F1D2B]/15 bg-white px-3 py-2 text-xs font-semibold text-[#1F1D2B] cursor-pointer shrink-0"
            >
              <Filter className="h-3.5 w-3.5 text-[#FF7A00]" />
              Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>

            {facetOptions.subcategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubFilter(sub)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  subFilter === sub
                    ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                    : 'bg-white border border-[#1F1D2B]/12 text-[#1F1D2B]/75 hover:border-[#FF7A00]'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-[#1F1D2B]/55 tabular-nums hidden sm:inline">
              {displayedProducts.length} item{displayedProducts.length === 1 ? '' : 's'}
            </span>

            <div className="inline-flex rounded-xl border border-[#1F1D2B]/12 bg-white p-1">
              <button
                type="button"
                onClick={() => setLayout('desktop')}
                aria-label="Grid layout"
                className={`flex h-8 w-8 items-center justify-center rounded-lg cursor-pointer ${
                  layout === 'desktop'
                    ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                    : 'text-[#1F1D2B]/65 hover:text-[#1F1D2B]'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setLayout('mobile')}
                aria-label="Compact horizontal layout"
                className={`flex h-8 w-8 items-center justify-center rounded-lg cursor-pointer ${
                  layout === 'mobile'
                    ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                    : 'text-[#1F1D2B]/65 hover:text-[#1F1D2B]'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Dropdown
              value={sortBy}
              onChange={setSortBy}
              align="right"
              options={[
                { value: 'popularity', label: 'Sort: Popularity' },
                { value: 'newest', label: 'Newest First' },
                { value: 'price-asc', label: 'Price: Low to High' },
                { value: 'price-desc', label: 'Price: High to Low' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Content: Filter Sidebar + Product Grid */}
      <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sticky top-24">
          {renderFilterControls()}
        </aside>

        {/* Product Results Column */}
        <div className="lg:col-span-9">
          {displayedProducts.length === 0 ? (
            <EmptyState
              title="No styles match these filters"
              description="Try clearing a few filters or browse our complete curated fashion catalog."
              actionLabel="Reset All Filters"
              onAction={resetAllFilters}
            />
          ) : (
            <div
              className={
                layout === 'mobile'
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                  : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6'
              }
            >
              {displayedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product.legacyProduct}
                  productSlug={product.slug}
                  layout={layout}
                  isWishlisted={wishlistIds.includes(product.id)}
                  onToggleWishlist={toggleWishlist}
                  onAddToCart={addToCart}
                  onQuickView={openQuickView}
                  onViewDetails={() => navigate(`/product/${product.slug}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Slide-Over Filter Drawer */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Product Filters"
        >
          <div
            className="fixed inset-0 bg-[#1F1D2B]/60"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <aside className="relative z-10 h-full w-full max-w-xs overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1F1D2B]/10">
              <span className="font-heading text-base font-bold text-[#1F1D2B]">
                Filter Products
              </span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1F1D2B]/12 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderFilterControls()}
          </aside>
        </div>
      )}
    </main>
  );
};
