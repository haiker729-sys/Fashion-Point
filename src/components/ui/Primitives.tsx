import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Info,
  Loader2,
  PackageOpen,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import type { StockStatus } from '../../data/catalog';

/* -------------------------------------------------------------------------- */
/* 1. BUTTONS (Primary, Secondary, Outline, Ghost, Danger)                    */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[#FF7A00] text-[#FFFFFF] hover:bg-[#e56d00] active:scale-[0.99] border border-transparent shadow-sm',
  secondary:
    'bg-[#1F1D2B] text-[#FFF8EF] hover:bg-[#2d2a3d] active:scale-[0.99] border border-transparent',
  outline:
    'bg-transparent text-[#1F1D2B] border border-[#1F1D2B]/25 hover:border-[#FF7A00] hover:text-[#FF7A00] hover:bg-[#FFE4C7]/35',
  ghost:
    'bg-transparent text-[#1F1D2B] hover:bg-[#FFE4C7]/55 border border-transparent',
  danger:
    'bg-[#DC2626] text-[#FFFFFF] hover:bg-[#b91c1c] active:scale-[0.99] border border-transparent',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[38px] px-3.5 py-2 text-xs gap-1.5 rounded-lg',
  md: 'min-h-[44px] px-5 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'min-h-[48px] px-6 py-3 text-sm gap-2.5 rounded-xl',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold tracking-[0.01em] whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" /> : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. ICON BUTTON                                                             */
/* -------------------------------------------------------------------------- */

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'surface' | 'dark' | 'outline' | 'accent';
  size?: 'sm' | 'md';
  active?: boolean;
  badgeCount?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = 'surface',
  size = 'md',
  active = false,
  badgeCount,
  className = '',
  children,
  ...rest
}) => {
  const variantClasses = {
    surface: active
      ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
      : 'bg-[#FFF8EF] text-[#1F1D2B] border-[#1F1D2B]/12 hover:border-[#FF7A00] hover:text-[#FF7A00]',
    dark: active
      ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
      : 'bg-white/8 text-[#FFF8EF] border-white/15 hover:bg-white/16 hover:border-[#FFA94D]/60',
    outline: active
      ? 'bg-[#FFE4C7] text-[#FF7A00] border-[#FF7A00]'
      : 'bg-transparent text-[#1F1D2B] border-[#1F1D2B]/20 hover:border-[#FF7A00] hover:text-[#FF7A00]',
    accent: 'bg-[#FF7A00] text-white border-[#FF7A00] hover:bg-[#e56d00]',
  }[variant];

  const sizeClasses = size === 'sm' ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`relative inline-flex items-center justify-center border transition-all duration-150 cursor-pointer shrink-0 ${variantClasses} ${sizeClasses} ${className}`}
      {...rest}
    >
      {children}
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#FF7A00] text-white text-[11px] font-semibold tabular-nums flex items-center justify-center ring-2 ring-[#1F1D2B]">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. PRODUCT BADGE & STATUS TEXT LABELS                                      */
/* -------------------------------------------------------------------------- */

export interface ProductBadgeProps {
  tone: 'accent' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'surface';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const BADGE_TONES: Record<ProductBadgeProps['tone'], string> = {
  accent: 'bg-[#FF7A00] text-white',
  primary: 'bg-[#1F1D2B] text-[#FFF8EF]',
  success: 'bg-[#16A34A]/12 text-[#16A34A] border border-[#16A34A]/25',
  warning: 'bg-[#F59E0B]/15 text-[#B45309] border border-[#F59E0B]/35',
  error: 'bg-[#DC2626]/12 text-[#DC2626] border border-[#DC2626]/25',
  info: 'bg-[#2563EB]/12 text-[#2563EB] border border-[#2563EB]/25',
  surface: 'bg-[#FFE4C7] text-[#1F1D2B] border border-[#FFA94D]/40',
};

export const ProductBadge: React.FC<ProductBadgeProps> = ({ tone, icon, children }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold tracking-[0.01em] whitespace-nowrap shrink-0 ${BADGE_TONES[tone]}`}
  >
    {icon}
    {children}
  </span>
);

export const StockStatusLabel: React.FC<{ status: StockStatus; count?: number }> = ({
  status,
  count,
}) => {
  if (status === 'out_of_stock') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Out of Stock
      </span>
    );
  }
  if (status === 'low_stock') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
        <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" aria-hidden="true" />
        {count ? `Only ${count} left` : 'Low Stock'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      In Stock
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. PRICE COMPONENT                                                         */
/* -------------------------------------------------------------------------- */

export interface PriceDisplayProps {
  discountedPrice: number;
  originalPrice?: number;
  discountPercent?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  discountedPrice,
  originalPrice,
  discountPercent,
  size = 'md',
}) => {
  const formatINR = (val: number) => `₹${val.toLocaleString('en-IN')}`;
  const mainSize =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  const origSize = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
      <span className={`font-heading font-bold text-[#1F1D2B] ${mainSize}`}>
        {formatINR(discountedPrice)}
      </span>
      {originalPrice && originalPrice > discountedPrice && (
        <span className={`text-[#1F1D2B]/45 line-through font-medium ${origSize}`}>
          {formatINR(originalPrice)}
        </span>
      )}
      {discountPercent && discountPercent > 0 && (
        <span className="text-xs font-semibold text-[#FF7A00]">
          {discountPercent}% OFF
        </span>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. RATING COMPONENT                                                        */
/* -------------------------------------------------------------------------- */

export interface RatingDisplayProps {
  rating: number;
  reviewCount?: number;
  compact?: boolean;
}

export const RatingDisplay: React.FC<RatingDisplayProps> = ({
  rating,
  reviewCount,
  compact = false,
}) => {
  const fullStars = Math.round(rating);
  return (
    <div
      className="inline-flex items-center gap-1.5 text-xs tabular-nums"
      aria-label={`Rated ${rating} out of 5${reviewCount ? ` from ${reviewCount} reviews` : ''}`}
    >
      <div className="inline-flex items-center gap-0.5" aria-hidden="true">
        {compact ? (
          <Star className="h-3.5 w-3.5 fill-[#FF7A00] text-[#FF7A00]" />
        ) : (
          Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < fullStars
                  ? 'fill-[#FF7A00] text-[#FF7A00]'
                  : 'fill-[#FFE4C7] text-[#FFA94D]/60'
              }`}
            />
          ))
        )}
      </div>
      <span className="font-semibold text-[#1F1D2B]">{rating.toFixed(1)}</span>
      {typeof reviewCount === 'number' && (
        <span className="text-[#1F1D2B]/55">
          ({reviewCount.toLocaleString('en-IN')})
        </span>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. STATUS ALERTS (Success, Error, Warning, Info, Pending)                  */
/* -------------------------------------------------------------------------- */

export type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'pending';

export interface StatusAlertProps {
  variant: StatusVariant;
  title: string;
  description?: string;
  onDismiss?: () => void;
}

const STATUS_STYLES: Record<
  StatusVariant,
  { wrap: string; iconColor: string; Icon: React.FC<{ className?: string }> }
> = {
  success: {
    wrap: 'bg-[#16A34A]/8 border-[#16A34A]/30 text-[#14532D]',
    iconColor: 'text-[#16A34A]',
    Icon: CheckCircle2,
  },
  error: {
    wrap: 'bg-[#DC2626]/8 border-[#DC2626]/30 text-[#7F1D1D]',
    iconColor: 'text-[#DC2626]',
    Icon: AlertCircle,
  },
  warning: {
    wrap: 'bg-[#F59E0B]/10 border-[#F59E0B]/35 text-[#78350F]',
    iconColor: 'text-[#F59E0B]',
    Icon: AlertTriangle,
  },
  info: {
    wrap: 'bg-[#2563EB]/8 border-[#2563EB]/30 text-[#1E3A8A]',
    iconColor: 'text-[#2563EB]',
    Icon: Info,
  },
  pending: {
    wrap: 'bg-[#FFE4C7]/65 border-[#FFA94D]/50 text-[#1F1D2B]',
    iconColor: 'text-[#FF7A00]',
    Icon: Clock,
  },
};

export const StatusAlert: React.FC<StatusAlertProps> = ({
  variant,
  title,
  description,
  onDismiss,
}) => {
  const { wrap, iconColor, Icon } = STATUS_STYLES[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${wrap}`}
    >
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{title}</p>
        {description && <p className="mt-0.5 text-xs opacity-85 leading-relaxed">{description}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="p-1 rounded-md opacity-70 hover:opacity-100 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. INPUT FIELD WITH FORM VALIDATION                                        */
/* -------------------------------------------------------------------------- */

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  successMessage?: string;
  leftIcon?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  helperText,
  error,
  successMessage,
  leftIcon,
  id,
  className = '',
  ...rest
}) => {
  const inputId = id || `fw-input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const stateBorder = error
    ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
    : successMessage
      ? 'border-[#16A34A] focus:border-[#16A34A] focus:ring-[#16A34A]/20'
      : 'border-[#1F1D2B]/18 focus:border-[#FF7A00] focus:ring-[#FF7A00]/20';

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-[#1F1D2B]">
        {label}
      </label>
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F1D2B]/50">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          className={`w-full min-h-[44px] rounded-xl border bg-white px-4 py-2.5 text-sm text-[#1F1D2B] placeholder:text-[#1F1D2B]/40 transition-colors focus:outline-none focus:ring-4 ${leftIcon ? 'pl-10' : ''} ${stateBorder} ${className}`}
          {...rest}
        />
      </div>
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : successMessage ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-[#16A34A]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {successMessage}
        </p>
      ) : helperText ? (
        <p className="text-xs text-[#1F1D2B]/55">{helperText}</p>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 8. SEARCH BAR                                                              */
/* -------------------------------------------------------------------------- */

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'header-dark' | 'light';
  suggestions?: string[];
  onSelectSuggestion?: (item: string) => void;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search for shirts, jeans, saree, blazers...',
  variant = 'light',
  suggestions = [],
  onSelectSuggestion,
  className = '',
}) => {
  const [focused, setFocused] = useState(false);
  const filteredSuggestions = suggestions
    .filter((s) => value.trim().length > 0 && s.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 5);

  const isDark = variant === 'header-dark';

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`flex items-center rounded-xl border transition-all duration-150 ${
          isDark
            ? 'bg-[#FFF8EF] border-transparent focus-within:ring-2 focus-within:ring-[#FF7A00]'
            : 'bg-white border-[#1F1D2B]/15 focus-within:border-[#FF7A00] focus-within:ring-4 focus-within:ring-[#FF7A00]/15'
        }`}
      >
        <Search className="ml-3.5 h-4 w-4 text-[#1F1D2B]/55 shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          aria-label="Search products"
          className="w-full min-h-[42px] bg-transparent px-3 py-2 text-sm text-[#1F1D2B] placeholder:text-[#1F1D2B]/45 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="mr-2 p-1.5 rounded-lg text-[#1F1D2B]/55 hover:text-[#1F1D2B] hover:bg-[#FFE4C7]/60 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {focused && filteredSuggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-xl border border-[#1F1D2B]/12 bg-white p-1.5 shadow-lg fw-animate-fade"
        >
          {filteredSuggestions.map((item) => (
            <li key={item}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(item);
                  onSelectSuggestion?.(item);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#1F1D2B] hover:bg-[#FFE4C7]/60 cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-[#FF7A00] shrink-0" />
                <span className="truncate">{item}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 9. DROPDOWN                                                                */
/* -------------------------------------------------------------------------- */

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
}

export interface DropdownProps {
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options,
  onChange,
  align = 'left',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left">
      {label && <span className="block text-xs font-medium text-[#1F1D2B]/65 mb-1.5">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex min-h-[42px] items-center justify-between gap-2.5 rounded-xl border border-[#1F1D2B]/15 bg-white px-4 py-2 text-sm font-medium text-[#1F1D2B] hover:border-[#FF7A00] transition-colors cursor-pointer whitespace-nowrap"
      >
        <span>{selected?.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-[#1F1D2B]/60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-40 mt-2 min-w-[210px] rounded-xl border border-[#1F1D2B]/12 bg-white p-1.5 shadow-xl fw-animate-fade ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFE4C7] font-semibold text-[#1F1D2B]'
                    : 'text-[#1F1D2B]/85 hover:bg-[#FFF8EF]'
                }`}
              >
                <span>{opt.label}</span>
                {opt.description && (
                  <span className="text-xs font-normal text-[#1F1D2B]/55">{opt.description}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 10. LOADING SPINNER & SKELETON LOADERS                                     */
/* -------------------------------------------------------------------------- */

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; label?: string }> = ({
  size = 'md',
  label,
}) => {
  const dims = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-9 w-9' : 'h-6 w-6';
  return (
    <div className="inline-flex items-center gap-2.5" role="status" aria-live="polite">
      <Loader2 className={`${dims} animate-spin text-[#FF7A00]`} aria-hidden="true" />
      {label && <span className="text-sm font-medium text-[#1F1D2B]/75">{label}</span>}
    </div>
  );
};

export const SkeletonProductCard: React.FC = () => (
  <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-4 space-y-3.5">
    <div className="aspect-[3/4] w-full rounded-xl fw-skeleton" />
    <div className="h-3 w-20 rounded fw-skeleton" />
    <div className="h-5 w-4/5 rounded fw-skeleton" />
    <div className="flex items-center gap-2">
      <div className="h-5 w-20 rounded fw-skeleton" />
      <div className="h-4 w-14 rounded fw-skeleton" />
    </div>
    <div className="h-11 w-full rounded-xl fw-skeleton" />
  </div>
);

export const SkeletonTableRow: React.FC = () => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1F1D2B]/8">
    <div className="h-4 w-24 rounded fw-skeleton" />
    <div className="h-4 w-36 rounded fw-skeleton" />
    <div className="h-4 w-20 rounded fw-skeleton" />
    <div className="h-6 w-20 rounded-md fw-skeleton" />
  </div>
);

/* -------------------------------------------------------------------------- */
/* 11. EMPTY, ERROR & SUCCESS STATES                                          */
/* -------------------------------------------------------------------------- */

export interface FeedbackStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<FeedbackStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#FFA94D]/70 bg-white/80 px-6 py-12 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFE4C7] text-[#FF7A00]">
      <PackageOpen className="h-7 w-7" />
    </div>
    <h3 className="font-heading text-lg font-semibold text-[#1F1D2B]">{title}</h3>
    <p className="mt-1.5 max-w-md text-sm text-[#1F1D2B]/65 leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <div className="mt-5">
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    )}
  </div>
);

export const ErrorState: React.FC<FeedbackStateProps> = ({
  title,
  description,
  actionLabel = 'Try Again',
  onAction,
}) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center rounded-2xl border border-[#DC2626]/25 bg-[#DC2626]/[0.04] px-6 py-10 text-center"
  >
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC2626]/12 text-[#DC2626]">
      <AlertCircle className="h-7 w-7" />
    </div>
    <h3 className="font-heading text-lg font-semibold text-[#1F1D2B]">{title}</h3>
    <p className="mt-1.5 max-w-md text-sm text-[#1F1D2B]/70 leading-relaxed">{description}</p>
    {onAction && (
      <div className="mt-5">
        <Button
          variant="danger"
          size="md"
          onClick={onAction}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          {actionLabel}
        </Button>
      </div>
    )}
  </div>
);

export const SuccessState: React.FC<FeedbackStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div
    role="status"
    className="flex flex-col items-center justify-center rounded-2xl border border-[#16A34A]/25 bg-[#16A34A]/[0.05] px-6 py-10 text-center"
  >
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16A34A]/15 text-[#16A34A]">
      <CheckCircle2 className="h-7 w-7" />
    </div>
    <h3 className="font-heading text-lg font-semibold text-[#1F1D2B]">{title}</h3>
    <p className="mt-1.5 max-w-md text-sm text-[#1F1D2B]/70 leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <div className="mt-5">
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/* 12. RESILIENT IMAGE (Zero-Broken-Image Policy)                             */
/* -------------------------------------------------------------------------- */

export interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#FFE4C7] via-[#FFF8EF] to-[#FFA94D]/35 text-[#1F1D2B]/70 p-4 text-center ${className}`}
      >
        <Sparkles className="h-6 w-6 text-[#FF7A00] mb-2" />
        <span className="text-xs font-medium">{fallbackTitle || alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className}
      loading="lazy"
    />
  );
};
