import React from 'react';

interface BrandLogoProps {
  variant?: 'dark' | 'light';
  compact?: boolean;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'dark',
  compact = false,
  onClick,
}) => {
  const textPrimary = variant === 'dark' ? 'text-[#FFF8EF]' : 'text-[#1F1D2B]';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-[#FF7A00] rounded-lg shrink-0 whitespace-nowrap"
      aria-label="Fashion World Home"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF7A00]/15 border border-[#FFA94D]/35 transition-transform duration-200 group-hover:scale-105 shrink-0">
        <svg
          width="22"
          height="22"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M14 5.5C12.34 5.5 11 6.72 11 8.2C11 9.25 11.72 10.12 12.74 10.55L14 11.1L14 12.6"
            stroke="#FFA94D"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 12.6L4.5 18.8C3.58 19.4 4.01 20.8 5.11 20.8H22.89C23.99 20.8 24.42 19.4 23.5 18.8L14 12.6Z"
            stroke="#FF7A00"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span className="flex items-baseline gap-1 font-heading font-bold tracking-tight whitespace-nowrap">
        <span className={`${textPrimary} ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
          Fashion
        </span>
        <span className={`text-[#FF7A00] ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
          World
        </span>
      </span>
    </button>
  );
};
