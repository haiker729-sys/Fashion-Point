export interface ColorToken {
  name: string;
  token: string;
  hex: string;
  usage: string;
  textContrast: 'light' | 'dark';
}

export const BRAND_COLORS: ColorToken[] = [
  {
    name: 'Primary',
    token: '--fw-primary',
    hex: '#1F1D2B',
    usage: 'Header, admin sidebar, primary headings, high-contrast luxury anchors',
    textContrast: 'light',
  },
  {
    name: 'Accent',
    token: '--fw-accent',
    hex: '#FF7A00',
    usage: 'Primary CTAs, active navigation states, focus rings, key highlights',
    textContrast: 'light',
  },
  {
    name: 'Secondary',
    token: '--fw-secondary',
    hex: '#FFA94D',
    usage: 'Warm brass accents, star ratings, hover highlights, showroom lighting',
    textContrast: 'dark',
  },
  {
    name: 'Surface',
    token: '--fw-surface',
    hex: '#FFE4C7',
    usage: 'Warm structural panels, subtle tinted containers, secondary buttons, skeletons',
    textContrast: 'dark',
  },
  {
    name: 'Background',
    token: '--fw-background',
    hex: '#FFF8EF',
    usage: 'Dominant storefront and dashboard canvas (60% warm silk neutral)',
    textContrast: 'dark',
  },
];

export const STATUS_COLORS: ColorToken[] = [
  {
    name: 'Success',
    token: '--fw-success',
    hex: '#16A34A',
    usage: 'Confirmed orders, product added, successful payments, in-stock states',
    textContrast: 'light',
  },
  {
    name: 'Error',
    token: '--fw-error',
    hex: '#DC2626',
    usage: 'Validation errors, payment failed, invalid password, out of stock',
    textContrast: 'light',
  },
  {
    name: 'Warning',
    token: '--fw-warning',
    hex: '#F59E0B',
    usage: 'Low stock alerts, pending status notices, precautionary confirmations',
    textContrast: 'dark',
  },
  {
    name: 'Information',
    token: '--fw-info',
    hex: '#2563EB',
    usage: 'Shipping updates, showroom guidance, neutral system announcements',
    textContrast: 'light',
  },
];

export const TYPOGRAPHY_SCALE = [
  {
    role: 'Display Hero',
    family: 'Poppins',
    weight: '700 Bold',
    size: 'clamp(2rem, 3.6vw, 3.25rem)',
    lineHeight: '1.15',
    tracking: '-0.02em',
    sample: 'Step Into Luxury Fashion',
  },
  {
    role: 'Section Heading (H2)',
    family: 'Poppins',
    weight: '600 SemiBold',
    size: '1.75rem (28px)',
    lineHeight: '1.25',
    tracking: '-0.015em',
    sample: 'Curated Seasonal Editions',
  },
  {
    role: 'Card / Module Title (H3)',
    family: 'Poppins',
    weight: '600 SemiBold',
    size: '1.125rem (18px)',
    lineHeight: '1.35',
    tracking: '-0.01em',
    sample: 'Premium Tailored Casual Shirt',
  },
  {
    role: 'Body Copy',
    family: 'Inter',
    weight: '400 Regular',
    size: '0.9375rem (15px)',
    lineHeight: '1.6',
    tracking: '0em',
    sample: 'Crafted in small ateliers with breathable linen blends and brushed brass finishes.',
  },
  {
    role: 'Button Label',
    family: 'Inter',
    weight: '600 SemiBold',
    size: '0.875rem (14px)',
    lineHeight: '1.2',
    tracking: '0.01em',
    sample: 'Add to Shopping Bag',
  },
  {
    role: 'Metadata & Tabular Figures',
    family: 'Inter (Tabular)',
    weight: '500 Medium',
    size: '0.75rem (12px)',
    lineHeight: '1.4',
    tracking: '0.02em',
    sample: '₹1,24,560 · 4.8 (2,364 Reviews) · SKU-FW-409',
  },
] as const;

export const BREAKPOINT_SPECS = [
  {
    device: 'Mobile',
    range: '360px – 480px',
    columns: '1–2 product columns',
    headerLayout: 'Compact bar (Menu, Logo, Search trigger, Cart) + 5-item bottom bar (≤15% viewport)',
    touchTarget: 'Minimum 44×44px interactive controls',
  },
  {
    device: 'Tablet',
    range: '768px – 1024px',
    columns: '2–3 product columns',
    headerLayout: 'Logo + Inline Search + Utility Icons + Horizontally scrollable category bar',
    touchTarget: 'Minimum 42×42px interactive controls',
  },
  {
    device: 'Desktop',
    range: '1280px – 1920px',
    columns: '3–4 product columns / 260px Admin Sidebar',
    headerLayout: 'Full luxury dark header with search, Track Order, Wishlist, Cart, Account & 9 categories',
    touchTarget: '40px+ button heights with crisp focus rings',
  },
] as const;

export const ANIMATION_SPECS = [
  {
    name: 'Micro-Interactions & Buttons',
    duration: '150ms – 180ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    properties: 'transform, background-color, border-color, opacity',
    rule: 'Immediate tactile feedback with zero layout shift.',
  },
  {
    name: 'Product Card Hover Lift',
    duration: '180ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    properties: 'transform: translateY(-2px), box-shadow',
    rule: 'Single-level elevation expansion; image scale capped at 1.03.',
  },
  {
    name: 'Modal & Drawer Transitions',
    duration: '200ms – 220ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    properties: 'opacity, transform (scale 0.96→1 / translateX)',
    rule: 'Compositor-only properties with clean backdrop scrim.',
  },
  {
    name: 'Skeleton & Loading States',
    duration: '1500ms linear loop',
    easing: 'linear',
    properties: 'transform: translateX(-100% → 100%)',
    rule: 'Warm #FFE4C7 base shimmer that halts when prefers-reduced-motion is active.',
  },
] as const;
