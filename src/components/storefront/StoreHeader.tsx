import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  Menu,
  Package,
  Palette,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
  X,
} from 'lucide-react';
import { NAV_CATEGORIES, type NavCategory } from '../../data/catalog';
import { BrandLogo } from '../ui/BrandLogo';
import { IconButton, SearchBar } from '../ui/Primitives';

export interface StoreHeaderProps {
  activeCategory: NavCategory;
  onSelectCategory: (cat: NavCategory) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchSuggestions: string[];
  wishlistCount: number;
  cartCount: number;
  onOpenWishlist: () => void;
  onOpenCart: () => void;
  onOpenTrackOrder: () => void;
  onSwitchWorkspace: (view: 'storefront' | 'showroom' | 'admin' | 'design-system') => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  searchSuggestions,
  wishlistCount,
  cartCount,
  onOpenWishlist,
  onOpenCart,
  onOpenTrackOrder,
  onSwitchWorkspace,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const handleCategoryClick = (cat: NavCategory) => {
    onSelectCategory(cat);
    setMobileMenuOpen(false);
    if (cat === '3D Showroom') {
      const el = document.getElementById('fw-showroom-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (cat !== 'Home' && cat !== 'Help') {
      const el = document.getElementById('fw-catalog-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (cat === 'Help') {
      const el = document.getElementById('fw-footer-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#1F1D2B] text-[#FFF8EF] border-b border-white/10">
        {/* Main Utility Row: Desktop / Tablet / Mobile Responsive */}
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 sm:h-[72px] items-center justify-between gap-3 sm:gap-6">
            {/* Left: Mobile Menu + Fashion World Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-[#FFF8EF] hover:border-[#FF7A00] cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <BrandLogo variant="dark" onClick={() => handleCategoryClick('Home')} />
            </div>

            {/* Center: Search Products (Desktop & Tablet) */}
            <div className="hidden md:block flex-1 max-w-xl">
              <SearchBar
                value={searchQuery}
                onChange={onSearchChange}
                variant="header-dark"
                suggestions={searchSuggestions}
                onSelectSuggestion={(term) => {
                  onSearchChange(term);
                  document.getElementById('fw-catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </div>

            {/* Right: Track Order, Wishlist, Shopping Cart, User Account */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Mobile search trigger */}
              <button
                type="button"
                onClick={() => setMobileSearchOpen((s) => !s)}
                aria-label="Toggle product search"
                className="flex md:hidden h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-[#FFF8EF] hover:border-[#FF7A00] cursor-pointer"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Track Order (Desktop) */}
              <button
                type="button"
                onClick={onOpenTrackOrder}
                className="hidden xl:inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#FFF8EF]/85 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <Truck className="h-4 w-4 text-[#FFA94D]" />
                <span>Track Order</span>
              </button>

              {/* Wishlist */}
              <IconButton
                label={`Wishlist (${wishlistCount})`}
                variant="dark"
                size="sm"
                badgeCount={wishlistCount}
                onClick={onOpenWishlist}
                className="hidden sm:inline-flex"
              >
                <Heart className="h-4 w-4" />
              </IconButton>

              {/* Shopping Cart */}
              <IconButton
                label={`Shopping Cart (${cartCount})`}
                variant="dark"
                size="sm"
                badgeCount={cartCount}
                onClick={onOpenCart}
              >
                <ShoppingBag className="h-4 w-4" />
              </IconButton>

              {/* User Account Dropdown */}
              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-2.5 sm:px-3 text-xs font-semibold text-[#FFF8EF] hover:border-[#FFA94D]/60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF7A00] text-[11px] font-bold text-white">
                    M
                  </span>
                  <span className="hidden sm:inline">Hi, Meraj</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#FFA94D]" />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 rounded-2xl border border-[#1F1D2B]/12 bg-white p-2 text-[#1F1D2B] shadow-2xl fw-animate-fade z-50"
                  >
                    <div className="px-3 py-2 border-b border-[#1F1D2B]/10">
                      <p className="text-sm font-semibold">Meraj Alam</p>
                      <p className="text-xs text-[#1F1D2B]/55">Privilege Member · Phase 1 UI</p>
                    </div>
                    <div className="py-1 space-y-0.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenTrackOrder();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-[#FFF8EF] cursor-pointer"
                      >
                        <Package className="h-4 w-4 text-[#FF7A00]" />
                        Track Orders
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          onOpenWishlist();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-[#FFF8EF] cursor-pointer"
                      >
                        <Heart className="h-4 w-4 text-[#FF7A00]" />
                        Saved Wishlist ({wishlistCount})
                      </button>
                    </div>
                    <div className="pt-1 mt-1 border-t border-[#1F1D2B]/10 space-y-0.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          onSwitchWorkspace('admin');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#1F1D2B] hover:bg-[#FFE4C7]/60 cursor-pointer"
                      >
                        <LayoutDashboard className="h-4 w-4 text-[#1F1D2B]" />
                        Open Admin Dashboard
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          onSwitchWorkspace('design-system');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#1F1D2B] hover:bg-[#FFE4C7]/60 cursor-pointer"
                      >
                        <Palette className="h-4 w-4 text-[#FF7A00]" />
                        Design System Kit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Expandable Search Bar */}
          {mobileSearchOpen && (
            <div className="md:hidden pb-3 fw-animate-fade">
              <SearchBar
                value={searchQuery}
                onChange={onSearchChange}
                variant="header-dark"
                suggestions={searchSuggestions}
              />
            </div>
          )}
        </div>

        {/* Navigation Category Row (Desktop & Tablet) */}
        <nav
          aria-label="Primary store categories"
          className="hidden md:block border-t border-white/10 bg-[#1F1D2B]"
        >
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 lg:gap-2 overflow-x-auto fw-no-scrollbar py-2.5">
              {NAV_CATEGORIES.map((category) => {
                const isActive = activeCategory === category;
                const isShowroom = category === '3D Showroom';
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryClick(category)}
                    className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#FF7A00] text-white font-semibold'
                        : 'text-[#FFF8EF]/80 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    {isShowroom && (
                      <Compass
                        className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-[#FFA94D]'}`}
                      />
                    )}
                    <span>{category}</span>
                    {isShowroom && !isActive && (
                      <span className="text-[10px] font-semibold text-[#FFA94D]">· 360°</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
          <div
            className="fixed inset-0 bg-[#1F1D2B]/65 backdrop-blur-xs fw-animate-fade"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[82vw] max-w-xs flex-col bg-[#1F1D2B] text-[#FFF8EF] shadow-2xl fw-animate-fade">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <BrandLogo variant="dark" compact onClick={() => handleCategoryClick('Home')} />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-[#FFF8EF] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              <p className="px-3 pb-2 text-xs font-medium text-[#FFA94D]">Collections</p>
              {NAV_CATEGORIES.map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryClick(category)}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#FF7A00] text-white font-semibold'
                        : 'text-[#FFF8EF]/85 hover:bg-white/8'
                    }`}
                  >
                    <span>{category}</span>
                    {category === '3D Showroom' && (
                      <Sparkles className="h-4 w-4 text-[#FFA94D]" />
                    )}
                  </button>
                );
              })}

              <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
                <p className="px-3 pb-1 text-xs font-medium text-[#FFA94D]">Quick Actions</p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenTrackOrder();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-[#FFF8EF]/85 hover:bg-white/8 cursor-pointer"
                >
                  <Truck className="h-4 w-4 text-[#FFA94D]" />
                  Track Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenWishlist();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-[#FFF8EF]/85 hover:bg-white/8 cursor-pointer"
                >
                  <Heart className="h-4 w-4 text-[#FFA94D]" />
                  Wishlist ({wishlistCount})
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Compact Bottom Tab Navigation (Strictly compact <= 60px) */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-[#1F1D2B]/12 bg-white/95 backdrop-blur-md px-2 h-14"
      >
        <button
          type="button"
          onClick={() => handleCategoryClick('Home')}
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium cursor-pointer ${
            activeCategory === 'Home' ? 'text-[#FF7A00] font-semibold' : 'text-[#1F1D2B]/70'
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </button>
        <button
          type="button"
          onClick={() => handleCategoryClick('3D Showroom')}
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium cursor-pointer ${
            activeCategory === '3D Showroom' ? 'text-[#FF7A00] font-semibold' : 'text-[#1F1D2B]/70'
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>3D Store</span>
        </button>
        <button
          type="button"
          onClick={onOpenWishlist}
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium text-[#1F1D2B]/70 cursor-pointer"
        >
          <Heart className="h-4 w-4" />
          <span>Wishlist</span>
        </button>
        <button
          type="button"
          onClick={onOpenTrackOrder}
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium text-[#1F1D2B]/70 cursor-pointer"
        >
          <Package className="h-4 w-4" />
          <span>Orders</span>
        </button>
        <button
          type="button"
          onClick={() => onSwitchWorkspace('admin')}
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium text-[#1F1D2B]/70 cursor-pointer"
        >
          <User className="h-4 w-4" />
          <span>Admin</span>
        </button>
      </nav>
    </>
  );
};
