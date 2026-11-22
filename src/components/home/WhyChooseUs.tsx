import React from 'react';
import { Headphones, RefreshCw, ShieldCheck, Truck } from 'lucide-react';

const PILLARS = [
  {
    title: 'Free Delivery',
    subtitle: 'Insured express shipping on all orders above ₹999 nationwide.',
    Icon: Truck,
  },
  {
    title: 'Secure Payment',
    subtitle: 'Encrypted UPI, card, and cash-on-delivery protection ready for checkout.',
    Icon: ShieldCheck,
  },
  {
    title: 'Easy Returns',
    subtitle: 'Hassle-free 7-day doorstep exchange and complimentary fit alterations.',
    Icon: RefreshCw,
  },
  {
    title: '24/7 Customer Support',
    subtitle: 'Dedicated fashion concierge available around the clock for sizing & orders.',
    Icon: Headphones,
  },
] as const;

export const WhyChooseUs: React.FC = () => (
  <section
    aria-labelledby="why-choose-us-heading"
    className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20"
  >
    <div className="rounded-3xl border border-[#1F1D2B]/10 bg-white p-6 sm:p-10">
      <div className="max-w-xl mb-8">
        <p className="text-xs font-semibold text-[#FF7A00]">The 3D Jummo Standard</p>
        <h2
          id="why-choose-us-heading"
          className="mt-1 font-heading text-2xl sm:text-3xl font-semibold text-[#1F1D2B] tracking-tight"
        >
          Why Choose Fashion World
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {PILLARS.map(({ title, subtitle, Icon }) => (
          <div
            key={title}
            className="rounded-2xl border border-[#1F1D2B]/8 bg-[#FFF8EF] p-5 space-y-3 fw-card-hover"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFE4C7] text-[#FF7A00]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-base font-semibold text-[#1F1D2B]">{title}</h3>
            <p className="text-xs sm:text-sm text-[#1F1D2B]/68 leading-relaxed">{subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
