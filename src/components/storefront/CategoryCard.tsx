import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { CategoryItem } from '../../data/catalog';
import { ResilientImage } from '../ui/Primitives';

export interface CategoryCardProps {
  category: CategoryItem;
  active?: boolean;
  variant?: 'compact' | 'editorial';
  onSelect: (category: CategoryItem) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  active = false,
  variant = 'compact',
  onSelect,
}) => {
  if (variant === 'editorial') {
    return (
      <button
        type="button"
        onClick={() => onSelect(category)}
        className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 cursor-pointer fw-card-hover ${
          active
            ? 'border-[#FF7A00] bg-[#FFE4C7]/45'
            : 'border-[#1F1D2B]/10 bg-white hover:border-[#FFA94D]'
        }`}
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-[#FFF8EF]">
          <ResilientImage
            src={category.image}
            alt={category.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </div>
        <div className="flex items-start justify-between gap-2 p-4">
          <div className="min-w-0">
            <h3 className="font-heading text-sm font-semibold text-[#1F1D2B] group-hover:text-[#FF7A00] transition-colors truncate">
              {category.name}
            </h3>
            <p className="mt-0.5 text-xs text-[#1F1D2B]/60 truncate">{category.tagline}</p>
            <p className="mt-1.5 text-xs font-medium text-[#1F1D2B]/50 tabular-nums">
              {category.itemCount} Curated Styles
            </p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF8EF] text-[#1F1D2B] group-hover:bg-[#FF7A00] group-hover:text-white transition-colors">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className={`group flex w-32 sm:w-36 shrink-0 flex-col items-center rounded-2xl border p-2.5 text-center transition-all duration-150 cursor-pointer ${
        active
          ? 'border-[#FF7A00] bg-[#FFE4C7]/55 shadow-sm'
          : 'border-[#1F1D2B]/10 bg-white hover:border-[#FFA94D] hover:bg-[#FFF8EF]'
      }`}
    >
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-[#FFF8EF]">
        <ResilientImage
          src={category.image}
          alt={category.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <span className="mt-2 font-heading text-xs font-semibold text-[#1F1D2B] group-hover:text-[#FF7A00] truncate w-full">
        {category.name}
      </span>
      <span className="text-[11px] text-[#1F1D2B]/50 tabular-nums">{category.itemCount} styles</span>
    </button>
  );
};
