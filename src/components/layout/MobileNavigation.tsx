import React, { useEffect } from 'react';
import {
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  Package,
  Palette,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
  X,
} from 'lucide-react';
import { NAV_ROUTES } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';
import { useStore } from '../../context/StoreContext';
import { BrandLogo } from '../ui/BrandLogo';

interface MobileNavigationProps {
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  drawerOpen,
  onCloseDrawer,
}) => {
  const { pathname, navigate } = useRouter();
  const { wishlistIds, totalCartItems } = useStore();

  useEffect(() => {
    if (!drawerOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseDrawer();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [drawerOpen, onCloseDrawer]);

  const go = (path: string) => {
    navigate(path);
    onCloseDrawer();
  };

  return (
    <>
      {/* Mobile Hamburger Slide-Out Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
        >
          <div
            className="fixed inset-0 bg-[#1F1D2B]/65 backdrop-blur-xs fw-animate-fade"
            onClick={onCloseDrawer}
          />
          <aside className="relative z-10 flex h-full w-[84vw] max-w-xs flex-col bg-[#1F1D2B] text-[#FFF8EF] shadow-2xl fw-animate-fade">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <BrandLogo variant="dark" compact onClick={() => go('/')} />
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Close mobile navigation menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-[#FFF8EF] hover:border-[#FF7A00] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              <p className="px-3 pb-1.5 text-xs font-semibold text-[#FFA94D]">
                3D Jummo Fashion World
              </p>
              {NAV_ROUTES.map((item) => {
                const isActive =
                  item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    className={`flex w-full min-h-[44px] items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#FF7A00] text-white font-semibold'
                        : 'text-[#FFF8EF]/88 hover:bg-white/8'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.path === '/showroom' && (
                      <Sparkles className="h-4 w-4 text-[#FFA94D]" />
                    )}
                  </button>
                );
              })}

              <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
                <p className="px-3 pb-1 text-xs font-semibold text-[#FFA94D]">Account & Tools</p>
                <button
                  type="button"
                  onClick={() => go('/track-order')}
                  className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[#FFF8EF]/85 hover:bg-white/8 cursor-pointer"
                >
                  <Truck className="h-4 w-4 text-[#FFA94D]" />
                  Track Order
                </button>
                <button
                  type="button"
                  onClick={() => go('/wishlist')}
                  className="flex w-full min-h-[44px] items-center justify-between rounded-xl px-3.5 py-2.5 text-sm text-[#FFF8EF]/85 hover:bg-white/8 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-3">
                    <Heart className="h-4 w-4 text-[#FFA94D]" />
                    Wishlist
                  </span>
                  <span className="text-xs font-semibold text-[#FFA94D] tabular-nums">
                    {wishlistIds.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => go('/cart')}
                  className="flex w-full min-h-[44px] items-center justify-between rounded-xl px-3.5 py-2.5 text-sm text-[#FFF8EF]/85 hover:bg-white/8 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-3">
                    <ShoppingBag className="h-4 w-4 text-[#FFA94D]" />
                    Shopping Cart
                  </span>
                  <span className="text-xs font-semibold text-[#FFA94D] tabular-nums">
                    {totalCartItems}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => go('/account')}
                  className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[#FFF8EF]/85 hover:bg-white/8 cursor-pointer"
                >
                  <User className="h-4 w-4 text-[#FFA94D]" />
                  My Account
                </button>
              </div>

              <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
                <p className="px-3 pb-1 text-xs font-semibold text-[#FFA94D]">Phase 1 Foundations</p>
                <button
                  type="button"
                  onClick={() => go('/admin')}
                  className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[#FFF8EF]/80 hover:bg-white/8 cursor-pointer"
                >
                  <LayoutDashboard className="h-4 w-4 text-[#FFA94D]" />
                  Admin Dashboard Theme
                </button>
                <button
                  type="button"
                  onClick={() => go('/design-system')}
                  className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[#FFF8EF]/80 hover:bg-white/8 cursor-pointer"
                >
                  <Palette className="h-4 w-4 text-[#FFA94D]" />
                  Design System Kit
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Compact Bottom Tab Bar (56px height — respects <= 15% mobile sticky cap) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-[#1F1D2B]/12 bg-white/95 backdrop-blur-md px-1 h-14"
      >
        {[
          { label: 'Home', path: '/', Icon: Home },
          { label: '3D Store', path: '/showroom', Icon: Compass },
          { label: 'Wishlist', path: '/wishlist', Icon: Heart },
          { label: 'Orders', path: '/track-order', Icon: Package },
          { label: 'Account', path: '/account', Icon: User },
        ].map(({ label, path, Icon }) => {
          const active = path === '/' ? pathname === '/' : pathname.startsWith(path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={`flex min-w-[56px] flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium cursor-pointer ${
                active ? 'text-[#FF7A00] font-semibold' : 'text-[#1F1D2B]/70'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
