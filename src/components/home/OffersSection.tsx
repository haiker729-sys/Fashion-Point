import React from 'react';
import { ArrowRight, Clock, Flame, Percent, Sparkles } from 'lucide-react';
import { SPECIAL_OFFERS } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';
import { ResilientImage } from '../ui/Primitives';

const OFFER_ICONS = [Sparkles, Clock, Flame, Percent];

export const OffersSection: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section
      aria-labelledby="special-offers-heading"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">Curated Privileges</p>
          <h2
            id="special-offers-heading"
            className="mt-1 font-heading text-2xl sm:text-3xl font-semibold text-[#1F1D2B] tracking-tight"
          >
            Special Offers
          </h2>
          <p className="mt-1 text-sm text-[#1F1D2B]/65">
            Festival sales, limited-time wardrobe privileges, best deals, and seasonal discount edits.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/offers')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF7A00] hover:text-[#1F1D2B] transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          View All Offers
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
        {SPECIAL_OFFERS.map((offer, idx) => {
          const Icon = OFFER_ICONS[idx % OFFER_ICONS.length];
          const isDark = offer.accent === 'primary';
          const isWarm = offer.accent === 'accent';

          return (
            <div
              key={offer.id}
              className={`group overflow-hidden rounded-2xl border transition-all fw-card-hover flex flex-col sm:flex-row items-stretch ${
                isDark
                  ? 'bg-[#1F1D2B] text-[#FFF8EF] border-[#1F1D2B]'
                  : isWarm
                    ? 'bg-[#FFE4C7]/65 text-[#1F1D2B] border-[#FFA94D]/55'
                    : 'bg-white text-[#1F1D2B] border-[#1F1D2B]/10'
              }`}
            >
              <div className="sm:w-44 lg:w-52 shrink-0 overflow-hidden bg-[#FFF8EF]">
                <ResilientImage
                  src={offer.image}
                  alt={offer.title}
                  className="h-52 sm:h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.05]"
                />
              </div>

              <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        isDark ? 'text-[#FFA94D]' : 'text-[#FF7A00]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {offer.tag}
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        isDark ? 'text-[#FFF8EF]' : 'text-[#1F1D2B]'
                      }`}
                    >
                      {offer.discountText}
                    </span>
                  </div>

                  <h3 className="font-heading text-lg sm:text-xl font-semibold leading-snug">
                    {offer.title}
                  </h3>

                  <p
                    className={`text-xs sm:text-sm leading-relaxed ${
                      isDark ? 'text-[#FFF8EF]/75' : 'text-[#1F1D2B]/68'
                    }`}
                  >
                    {offer.description}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => navigate(offer.route)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#FF7A00] text-white hover:bg-[#e56d00]'
                        : 'bg-[#1F1D2B] text-[#FFF8EF] hover:bg-[#FF7A00]'
                    }`}
                  >
                    {offer.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
