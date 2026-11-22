import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import { ASSETS } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';
import { Button, ProductBadge, ResilientImage } from '../ui/Primitives';

export const HeroSection: React.FC = () => {
  const { navigate } = useRouter();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      aria-label="Featured fashion campaign"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#1F1D2B]/12 bg-[#1F1D2B] min-h-[440px] sm:min-h-[520px] lg:min-h-[580px] flex items-center">
        {/* Hero Fashion Campaign Photography with Subtle Reveal */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 1.04, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <ResilientImage
            src={ASSETS.heroCampaign}
            alt="3D Jummo Fashion World Autumn Winter Couture Campaign in architectural marble gallery"
            className="h-full w-full object-cover object-center sm:object-[70%_center]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#1F1D2B]/94 via-[#1F1D2B]/72 to-[#1F1D2B]/15"
          />
        </motion.div>

        {/* Left Editorial Focal Content */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-2xl p-6 sm:p-10 lg:p-14 space-y-5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <ProductBadge tone="accent" icon={<Sparkles className="h-3.5 w-3.5" />}>
              Up to 40% Off · Festival Couture
            </ProductBadge>
            <span className="text-xs font-medium text-[#FFA94D]">
              3D Jummo Fashion World · Autumn / Winter Edit
            </span>
          </div>

          <h1 className="font-heading text-3xl sm:text-5xl lg:text-[54px] font-bold text-[#FFF8EF] leading-[1.12] tracking-[-0.02em] text-balance">
            International Luxury Fashion, Tailored for Every Occasion
          </h1>

          <p className="text-sm sm:text-base text-[#FFF8EF]/82 leading-relaxed max-w-lg">
            Discover bespoke menswear, structured cashmere outerwear, artisanal handloom Banarasi
            silks, and curated kids ensembles — unified inside our upcoming 3D flagship mall.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() => navigate('/offers')}
            >
              Shop Now
            </Button>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById('fw-featured-categories')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-[#FFF8EF] backdrop-blur-xs hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              Explore Collection
            </button>
            <button
              type="button"
              onClick={() => navigate('/showroom')}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#FFA94D] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Compass className="h-4 w-4" />
              3D Showroom Preview
            </button>
          </div>

          {/* Grounded Editorial Metrics Strip */}
          <div className="pt-5 mt-3 border-t border-white/15 grid grid-cols-3 gap-4 max-w-md text-[#FFF8EF]">
            <div>
              <p className="font-heading text-lg sm:text-xl font-bold tabular-nums">1,450+</p>
              <p className="text-[11px] text-[#FFF8EF]/65">Curated Styles</p>
            </div>
            <div>
              <p className="font-heading text-lg sm:text-xl font-bold tabular-nums">4.9 / 5</p>
              <p className="text-[11px] text-[#FFF8EF]/65">Client Rating</p>
            </div>
            <div>
              <p className="font-heading text-lg sm:text-xl font-bold tabular-nums">360°</p>
              <p className="text-[11px] text-[#FFF8EF]/65">Showroom Vision</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
