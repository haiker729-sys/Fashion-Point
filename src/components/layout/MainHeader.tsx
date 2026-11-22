import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  Search,
  ShoppingBag,
  Truck,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { useRouter } from '../../router/RouterContext';
import { useStore } from '../../context/StoreContext';
import { BrandLogo } from '../ui/BrandLogo';
import { IconButton, SearchBar } from '../ui/Primitives';
import { AnnouncementBar } from './AnnouncementBar';
import { DesktopNavigation } from './DesktopNavigation';
import { MobileNavigation } from './MobileNavigation';

export const MainHeader: React.FC = () => {
  const { pathname, searchParams, navigate } = useRouter();
  const { user, profile, role, isAdmin, logout } = useAuth();
  const { publishedProducts } = useCatalog();
  const { wishlistIds, totalCartItems, setCartDrawerOpen } = useStore();

  const initialQuery = pathname === '/search' ? searchParams.get('q') || '' : '';
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname === '/search') {
      setSearchInput(searchParams.get('q') || '');
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const searchSuggestions = useMemo(
    () => [
      ...publishedProducts.map((p) => p.name),
      'Shirts',
      'Jeans',
      'T-Shirts',
      'Sarees',
      'Kurtis',
      'Sherwani',
      'Kids Fashion',
    ],
    [publishedProducts]
  );

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Sign In';
  const avatarInitial = user
    ? (profile?.displayName || user.displayName || user.email || 'U').charAt(0).toUpperCase()
    : '?';

  const submitSearch = (term?: string) => {
    const query = (term ?? searchInput).trim();
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/search');
    }
    setMobileSearchOpen(false);
  };

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-30 bg-[#1F1D2B] text-[#FFF8EF] border-b border-white/10">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 sm:h-[72px] items-center justify-between gap-3 sm:gap-6">
            {/* Left: Mobile Hamburger + Fashion World Brand Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-[#FFF8EF] hover:border-[#FF7A00] cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <BrandLogo variant="dark" onClick={() => navigate('/')} />
            </div>

            {/* Center: Interactive Search Form (Desktop & Tablet) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
              className="hidden md:block flex-1 max-w-xl"
            >
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
                variant="header-dark"
                placeholder="Search shirts, jeans, sarees, kurtis, blazers..."
                suggestions={searchSuggestions}
                onSelectSuggestion={(item) => {
                  setSearchInput(item);
                  submitSearch(item);
                }}
              />
            </form>

            {/* Right Utility Controls: Track Order, Wishlist, Cart, User Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Mobile Search Trigger */}
              <button
                type="button"
                onClick={() => setMobileSearchOpen((s) => !s)}
                aria-label="Toggle product search"
                className="flex md:hidden h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-[#FFF8EF] hover:border-[#FF7A00] cursor-pointer"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Track Order */}
              <button
                type="button"
                onClick={() => navigate('/track-order')}
                className="hidden xl:inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#FFF8EF]/88 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <Truck className="h-4 w-4 text-[#FFA94D]" />
                <span>Track Order</span>
              </button>

              {/* Wishlist */}
              <IconButton
                label={`Wishlist (${wishlistIds.length})`}
                variant="dark"
                size="sm"
                badgeCount={wishlistIds.length}
                onClick={() => navigate('/wishlist')}
                className="hidden sm:inline-flex"
              >
                <Heart className="h-4 w-4" />
              </IconButton>

              {/* Shopping Cart */}
              <IconButton
                label={`Shopping Cart (${totalCartItems})`}
                variant="dark"
                size="sm"
                badgeCount={totalCartItems}
                onClick={() => setCartDrawerOpen(true)}
              >
                <ShoppingBag className="h-4 w-4" />
              </IconButton>

              {/* User Profile Dropdown */}
              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-2.5 sm:px-3 text-xs font-semibold text-[#FFF8EF] hover:border-[#FFA94D]/60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF7A00] text-[11px] font-bold text-white">
                    {user ? avatarInitial : <User className="h-3.5 w-3.5" />}
                  </span>
                  <span className="hidden sm:inline max-w-[96px] truncate">
                    {user ? displayName : 'Sign In'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#FFA94D]" />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#1F1D2B]/12 bg-white p-2 text-[#1F1D2B] shadow-2xl fw-animate-fade z-50"
                  >
                    <div className="px-3 py-2 border-b border-[#1F1D2B]/10">
                      <p className="text-sm font-semibold truncate">
                        {user ? displayName : 'Guest Visitor'}
                      </p>
                      <p className="text-xs text-[#1F1D2B]/55 truncate">
                        {user
                          ? `${user.email || ''} · ${role.replace('_', ' ')}`
                          : 'Sign in for cloud profile & admin access'}
                      </p>
                    </div>
                    <div className="py-1 space-y-0.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/account');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-[#FFF8EF] cursor-pointer"
                      >
                        <User className="h-4 w-4 text-[#FF7A00]" />
                        {user ? 'My Profile & Settings' : 'Sign In / Register'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/track-order');
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
                          navigate('/wishlist');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-[#FFF8EF] cursor-pointer"
                      >
                        <Heart className="h-4 w-4 text-[#FF7A00]" />
                        Wishlist ({wishlistIds.length})
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/cart');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-[#FFF8EF] cursor-pointer"
                      >
                        <ShoppingBag className="h-4 w-4 text-[#FF7A00]" />
                        Shopping Cart ({totalCartItems})
                      </button>
                    </div>
                    <div className="pt-1 mt-1 border-t border-[#1F1D2B]/10 space-y-0.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/admin');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#FFE4C7]/60 cursor-pointer"
                      >
                        <LayoutDashboard className="h-4 w-4 text-[#1F1D2B]" />
                        {isAdmin ? 'Admin Console (Authorized)' : 'Admin Console Sign In'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/design-system');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#FFE4C7]/60 cursor-pointer"
                      >
                        <Palette className="h-4 w-4 text-[#FF7A00]" />
                        Design System Kit
                      </button>
                      {user && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAccountOpen(false);
                            void logout();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Expandable Search Form */}
          {mobileSearchOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
              className="md:hidden pb-3 fw-animate-fade"
            >
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
                variant="header-dark"
                placeholder="Search shirts, jeans, sarees..."
                suggestions={searchSuggestions}
                onSelectSuggestion={(item) => {
                  setSearchInput(item);
                  submitSearch(item);
                }}
              />
            </form>
          )}
        </div>

        <DesktopNavigation />
      </header>

      <MobileNavigation
        drawerOpen={mobileMenuOpen}
        onCloseDrawer={() => setMobileMenuOpen(false)}
      />
    </>
  );
};
