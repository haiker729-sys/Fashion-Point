import React from 'react';
import { Compass } from 'lucide-react';
import { NAV_ROUTES } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';

export const DesktopNavigation: React.FC = () => {
  const { pathname, navigate } = useRouter();

  return (
    <nav
      aria-label="Primary store navigation"
      className="hidden md:block border-t border-white/10 bg-[#1F1D2B]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-1 lg:gap-1.5 overflow-x-auto fw-no-scrollbar">
            {NAV_ROUTES.map((item) => {
              const isActive =
                item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
              const isShowroom = item.path === '/showroom';
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#FF7A00] text-white font-semibold'
                      : 'text-[#FFF8EF]/82 hover:text-white hover:bg-white/8'
                  }`}
                >
                  {isShowroom && (
                    <Compass
                      className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-[#FFA94D]'}`}
                    />
                  )}
                  <span>{item.label}</span>
                  {isShowroom && !isActive && (
                    <span className="text-[10px] font-semibold text-[#FFA94D]">· 360°</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden xl:flex items-center gap-3 text-xs text-[#FFF8EF]/65 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="hover:text-[#FFA94D] transition-colors whitespace-nowrap cursor-pointer"
            >
              Admin Theme
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigate('/design-system')}
              className="hover:text-[#FFA94D] transition-colors whitespace-nowrap cursor-pointer"
            >
              Design System
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
