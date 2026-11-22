import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ASSETS } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';
import { Button, ProductBadge, ResilientImage } from '../ui/Primitives';

export const SeasonalBanner: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section
      aria-labelledby="seasonal-banner-heading"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20"
    >
      <div className="relative overflow-hidden rounded-3xl border border-[#1F1D2B]/12 bg-[#1F1D2B] min-h-[320px] sm:min-h-[380px] flex items-center">
        <ResilientImage
          src={ASSETS.winterBanner}
          alt="Seasonal Winter Collection editorial campaign featuring luxury shearling coat and tailored leather jacket"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#1F1D2B]/94 via-[#1F1D2B]/70 to-[#1F1D2B]/15"
        />

        <div className="relative z-10 max-w-xl p-6 sm:p-10 lg:p-14 space-y-4">
          <ProductBadge tone="accent" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Winter Atelier · Save Up to 50%
          </ProductBadge>

          <h2
            id="seasonal-banner-heading"
            className="font-heading text-2xl sm:text-4xl font-bold text-[#FFF8EF] leading-tight text-balance"
          >
            The Seasonal Outerwear &amp; Festive Silk Edit
          </h2>

          <p className="text-sm sm:text-base text-[#FFF8EF]/80 leading-relaxed">
            Double-breasted cashmere coats, supple structured jackets, and handwoven celebratory
            silks tailored for winter evenings and gala gatherings.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() => navigate('/offers')}
            >
              Shop Seasonal Collection
            </Button>
            <button
              type="button"
              onClick={() => navigate('/women')}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-[#FFF8EF] hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              Explore Outerwear
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
