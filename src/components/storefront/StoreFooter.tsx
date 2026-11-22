import React, { useState } from 'react';
import { Headphones, Mail, RefreshCw, ShieldCheck, Truck } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Primitives';
import { useToast } from '../ui/Overlays';

interface StoreFooterProps {
  onSelectCategory?: (cat: string) => void;
  onSwitchWorkspace?: (view: 'storefront' | 'showroom' | 'admin' | 'design-system') => void;
}

export const StoreFooter: React.FC<StoreFooterProps> = ({
  onSelectCategory,
  onSwitchWorkspace,
}) => {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      addToast({
        type: 'error',
        title: 'Invalid Email Address',
        description: 'Please enter a valid email address to receive lookbooks.',
      });
      return;
    }
    addToast({
      type: 'success',
      title: 'Welcome to Fashion World Atelier',
      description: 'Phase 1 UI confirmation — newsletter backend connects in a later phase.',
    });
    setEmail('');
  };

  return (
    <footer id="fw-footer-section" className="mt-16 bg-[#1F1D2B] text-[#FFF8EF] pb-20 md:pb-0">
      {/* Service Trust Strip */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-7">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF7A00]/15 text-[#FFA94D]">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-sm font-semibold">Complimentary Delivery</p>
                <p className="text-xs text-[#FFF8EF]/65">Insured shipping on orders above ₹999</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF7A00]/15 text-[#FFA94D]">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-sm font-semibold">7-Day Effortless Returns</p>
                <p className="text-xs text-[#FFF8EF]/65">Doorstep exchange and size alterations</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF7A00]/15 text-[#FFA94D]">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-sm font-semibold">24×7 Atelier Concierge</p>
                <p className="text-xs text-[#FFF8EF]/65">Personal styling & sizing assistance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <BrandLogo variant="dark" onClick={() => onSelectCategory?.('Home')} />
            <p className="text-sm text-[#FFF8EF]/70 leading-relaxed max-w-xs">
              An international luxury fashion destination uniting bespoke menswear, women’s couture,
              kids ensembles, and traditional heritage inside an architectural 3D showroom.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-[#FFA94D]">
              <ShieldCheck className="h-4 w-4" />
              <span>Official Phase 1 Design System Foundation</span>
            </div>
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold text-[#FFF8EF] mb-4">Collections</h3>
            <ul className="space-y-2.5 text-sm text-[#FFF8EF]/70">
              {['Men', 'Women', 'Kids', 'Traditional Wear', 'New Arrivals', 'Offers'].map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory?.(item)}
                    className="hover:text-[#FFA94D] transition-colors cursor-pointer"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold text-[#FFF8EF] mb-4">
              Phase 1 Architecture
            </h3>
            <ul className="space-y-2.5 text-sm text-[#FFF8EF]/70">
              <li>
                <button
                  type="button"
                  onClick={() => onSwitchWorkspace?.('storefront')}
                  className="hover:text-[#FFA94D] transition-colors cursor-pointer"
                >
                  Customer Storefront
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSwitchWorkspace?.('showroom')}
                  className="hover:text-[#FFA94D] transition-colors cursor-pointer"
                >
                  3D Showroom Visual Blueprint
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSwitchWorkspace?.('admin')}
                  className="hover:text-[#FFA94D] transition-colors cursor-pointer"
                >
                  Admin Dashboard Theme
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSwitchWorkspace?.('design-system')}
                  className="hover:text-[#FFA94D] transition-colors cursor-pointer"
                >
                  Design System & Component Kit
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold text-[#FFF8EF] mb-3">
              Private Lookbook Invitations
            </h3>
            <p className="text-xs text-[#FFF8EF]/65 leading-relaxed mb-4">
              Receive early seasonal previews and 3D showroom unveiling dates.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2.5">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FFF8EF]/45" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  aria-label="Email address for lookbook"
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-white/8 pl-10 pr-4 text-sm text-[#FFF8EF] placeholder:text-[#FFF8EF]/45 focus:border-[#FF7A00] focus:outline-none"
                />
              </div>
              <Button type="submit" variant="primary" size="md" fullWidth>
                Subscribe
              </Button>
            </form>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#FFF8EF]/55">
          <p>© {new Date().getFullYear()} Fashion World · 3D Jummo Fashion World. All rights reserved.</p>
          <p>Phase 1 UI/UX Foundation · Responsive Mobile, Tablet & Desktop</p>
        </div>
      </div>
    </footer>
  );
};
