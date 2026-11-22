import React from 'react';
import {
  Instagram,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Youtube,
  Facebook,
  Twitter,
} from 'lucide-react';
import { useRouter } from '../../router/RouterContext';
import { BrandLogo } from '../ui/BrandLogo';
import { useToast } from '../ui/Overlays';

export const Footer: React.FC = () => {
  const { navigate } = useRouter();
  const { addToast } = useToast();

  const handleSocialClick = (network: string) => {
    addToast({
      type: 'info',
      title: `3D Jummo Fashion World on ${network}`,
      description: 'Official social handle placeholder configured for Phase 2.',
    });
  };

  return (
    <footer className="bg-[#1F1D2B] text-[#FFF8EF] pb-20 md:pb-0 border-t border-white/10">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Brand Information */}
          <div className="lg:col-span-4 space-y-4">
            <BrandLogo variant="dark" onClick={() => navigate('/')} />
            <p className="text-sm text-[#FFF8EF]/72 leading-relaxed max-w-sm">
              3D Jummo Fashion World is a contemporary international fashion mall uniting tailored
              menswear, women’s luxury outerwear, kids ensembles, and traditional Indian couture.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-[#FFA94D]">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>100% Authentic Craftsmanship · Insured Delivery</span>
            </div>

            {/* Social Media Links */}
            <div className="flex items-center gap-2 pt-2">
              {[
                { name: 'Instagram', Icon: Instagram },
                { name: 'Facebook', Icon: Facebook },
                { name: 'X / Twitter', Icon: Twitter },
                { name: 'YouTube', Icon: Youtube },
              ].map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSocialClick(name)}
                  aria-label={`Follow Fashion World on ${name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/6 text-[#FFF8EF]/80 hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-white transition-colors cursor-pointer"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-heading text-sm font-semibold text-[#FFF8EF]">Quick Links</h3>
            <ul className="space-y-2.5 text-sm text-[#FFF8EF]/70">
              {[
                { label: 'Home', path: '/' },
                { label: '3D Showroom', path: '/showroom' },
                { label: "Men's Fashion", path: '/men' },
                { label: "Women's Fashion", path: '/women' },
                { label: 'Kids Fashion', path: '/kids' },
                { label: 'Traditional Wear', path: '/traditional' },
                { label: 'New Arrivals', path: '/new-arrivals' },
                { label: 'Special Offers', path: '/offers' },
              ].map((link) => (
                <li key={link.path}>
                  <button
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="hover:text-[#FFA94D] transition-colors cursor-pointer"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Services & Policies */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="font-heading text-sm font-semibold text-[#FFF8EF]">
              Customer Services
            </h3>
            <ul className="space-y-2.5 text-sm text-[#FFF8EF]/70">
              {[
                { label: 'Track Your Order', path: '/track-order' },
                { label: 'My Account', path: '/account' },
                { label: 'Saved Wishlist', path: '/wishlist' },
                { label: 'Shopping Cart', path: '/cart' },
                { label: 'Help & Concierge FAQ', path: '/help' },
                { label: 'Return Policy', path: '/help#returns' },
                { label: 'Privacy Policy', path: '/help#privacy' },
                { label: 'Terms & Conditions', path: '/help#terms' },
              ].map((link) => (
                <li key={link.label}>
                  <button
                    type="button"
                    onClick={() => navigate(link.path)}
                    className="hover:text-[#FFA94D] transition-colors cursor-pointer"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Information */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="font-heading text-sm font-semibold text-[#FFF8EF]">
              Contact Information
            </h3>
            <ul className="space-y-3.5 text-sm text-[#FFF8EF]/72">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[#FFA94D] mt-1 shrink-0" />
                <span>
                  Flagship Atelier, Galleria Boulevard, Bandra West, Mumbai 400050, India
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[#FFA94D] shrink-0" />
                <span className="tabular-nums">+91 1800-309-8840 (24×7 Support)</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[#FFA94D] shrink-0" />
                <span>concierge@jummofashionworld.com</span>
              </li>
            </ul>

            <div className="pt-3 border-t border-white/10 flex flex-wrap gap-3 text-xs text-[#FFF8EF]/65">
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="hover:text-[#FFA94D] transition-colors cursor-pointer"
              >
                Admin Dashboard
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => navigate('/design-system')}
                className="hover:text-[#FFA94D] transition-colors cursor-pointer"
              >
                Design System
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Legal Row */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FFF8EF]/55">
          <p>© {new Date().getFullYear()} 3D Jummo Fashion World. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/help#privacy')}
              className="hover:text-[#FFA94D] cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => navigate('/help#terms')}
              className="hover:text-[#FFA94D] cursor-pointer"
            >
              Terms & Conditions
            </button>
            <button
              type="button"
              onClick={() => navigate('/help#returns')}
              className="hover:text-[#FFA94D] cursor-pointer"
            >
              Return Policy
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
