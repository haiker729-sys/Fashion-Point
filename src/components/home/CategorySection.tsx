import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CATEGORIES } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';
import { ResilientImage } from '../ui/Primitives';

export const CategorySection: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section
      id="fw-featured-categories"
      aria-labelledby="featured-categories-heading"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold text-[#FF7A00]">Curated Departments</p>
          <h2
            id="featured-categories-heading"
            className="mt-1 font-heading text-2xl sm:text-3xl font-semibold text-[#1F1D2B] tracking-tight"
          >
            Featured Categories
          </h2>
          <p className="mt-1 text-sm text-[#1F1D2B]/65">
            Nine dedicated fashion galleries spanning tailoring, denim, essentials, and heritage couture.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/new-arrivals')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF7A00] hover:text-[#1F1D2B] transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          View All Collections
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Responsive 9-Category Grid: 2 cols mobile, 3 cols tablet & desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5 lg:gap-6">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => navigate(category.route)}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#1F1D2B]/10 bg-white text-left fw-card-hover cursor-pointer"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FFF8EF]">
              <ResilientImage
                src={category.image}
                alt={`${category.name} — ${category.tagline}`}
                className="h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.05]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1F1D2B]/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />
            </div>

            <div className="flex items-center justify-between gap-2 p-3.5 sm:p-4">
              <div className="min-w-0">
                <h3 className="font-heading text-sm sm:text-base font-semibold text-[#1F1D2B] group-hover:text-[#FF7A00] transition-colors truncate">
                  {category.name}
                </h3>
                <p className="mt-0.5 text-xs text-[#1F1D2B]/60 truncate hidden sm:block">
                  {category.tagline}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#1F1D2B]/50 tabular-nums">
                  {category.itemCount} Styles
                </p>
              </div>
              <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF8EF] text-[#1F1D2B] border border-[#1F1D2B]/10 group-hover:bg-[#FF7A00] group-hover:border-[#FF7A00] group-hover:text-white transition-colors">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
