import React, { useState } from 'react';
import {
  Check,
  Copy,
  Heart,
  Layers,
  Mail,
  Monitor,
  Palette,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
} from 'lucide-react';
import {
  ANIMATION_SPECS,
  BRAND_COLORS,
  BREAKPOINT_SPECS,
  STATUS_COLORS,
  TYPOGRAPHY_SCALE,
  type ColorToken,
} from '../../design-system/tokens';
import { CATEGORIES, PRODUCTS } from '../../data/catalog';
import { BrandLogo } from '../ui/BrandLogo';
import {
  Button,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  InputField,
  LoadingSpinner,
  PriceDisplay,
  ProductBadge,
  RatingDisplay,
  SearchBar,
  SkeletonProductCard,
  SkeletonTableRow,
  StatusAlert,
  SuccessState,
} from '../ui/Primitives';
import { ConfirmationDialog, Modal, useToast } from '../ui/Overlays';
import { CategoryCard } from '../storefront/CategoryCard';
import { ProductCard } from '../storefront/ProductCard';

export const DesignSystemView: React.FC = () => {
  const { addToast } = useToast();
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [sampleSearch, setSampleSearch] = useState('');
  const [sampleSort, setSampleSort] = useState('luxury');
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoConfirmOpen, setDemoConfirmOpen] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(true);
  const [wishlistedDemo, setWishlistedDemo] = useState(true);

  // Interactive Form Validation Demo state
  const [formEmail, setFormEmail] = useState('meraj@fashionworld.luxury');
  const [formPassword, setFormPassword] = useState('1234');
  const [formSubmitted, setFormSubmitted] = useState(false);

  const emailError =
    formSubmitted && (!formEmail.includes('@') || !formEmail.includes('.'))
      ? 'Please enter a valid email address.'
      : undefined;
  const passwordError =
    formPassword.length < 8 ? '✕ Invalid Password — minimum 8 characters required.' : undefined;

  const copyColor = (hex: string) => {
    navigator.clipboard?.writeText(hex).catch(() => {});
    setCopiedHex(hex);
    addToast({
      type: 'info',
      title: `Copied ${hex}`,
      description: 'Official Fashion World HEX token copied to clipboard.',
    });
    window.setTimeout(() => setCopiedHex(null), 1800);
  };

  const renderColorCard = (color: ColorToken) => (
    <button
      key={color.hex}
      type="button"
      onClick={() => copyColor(color.hex)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#1F1D2B]/12 bg-white text-left fw-card-hover cursor-pointer"
    >
      <div
        className="flex h-24 w-full items-end justify-between p-3.5"
        style={{ backgroundColor: color.hex }}
      >
        <span
          className={`font-mono text-xs font-semibold tabular-nums ${
            color.textContrast === 'light' ? 'text-white' : 'text-[#1F1D2B]'
          }`}
        >
          {color.hex}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            color.textContrast === 'light'
              ? 'bg-white/15 text-white'
              : 'bg-[#1F1D2B]/10 text-[#1F1D2B]'
          }`}
        >
          {copiedHex === color.hex ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </span>
      </div>
      <div className="p-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-sm font-semibold text-[#1F1D2B]">{color.name}</p>
          <span className="font-mono text-[11px] text-[#1F1D2B]/50">{color.token}</span>
        </div>
        <p className="text-xs text-[#1F1D2B]/65 leading-relaxed">{color.usage}</p>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B] pb-20">
      {/* Header Hero */}
      <div className="bg-[#1F1D2B] text-[#FFF8EF] border-b border-white/10">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-9">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#FFA94D]">
                <Palette className="h-4 w-4" />
                <span>Phase 1 · Official Design System & Component Library</span>
              </div>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                Fashion World Design System
              </h1>
              <p className="text-sm text-[#FFF8EF]/75 leading-relaxed">
                Exact brand palette, Poppins & Inter typographic hierarchy, responsive breakpoint
                foundation, animation specs, and all 24 interactive reusable UI components.
              </p>
            </div>
            <BrandLogo variant="dark" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-10 space-y-14">
        {/* 1. OFFICIAL COLOR PALETTE */}
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">01. Color System</p>
            <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
              Official Brand & Semantic Palette
            </h2>
            <p className="mt-1 text-sm text-[#1F1D2B]/65">
              Click any swatch to copy its exact HEX token. Status colors are always paired with
              icons and explicit labels for color-blind accessibility.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {BRAND_COLORS.map(renderColorCard)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATUS_COLORS.map(renderColorCard)}
          </div>
        </section>

        {/* 2. TYPOGRAPHY SYSTEM */}
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">02. Typography</p>
            <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
              Poppins Headings · Inter Body · Inter SemiBold Buttons
            </h2>
          </div>

          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white divide-y divide-[#1F1D2B]/10 overflow-hidden">
            {TYPOGRAPHY_SCALE.map((row) => (
              <div
                key={row.role}
                className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-5"
              >
                <div className="lg:col-span-4 space-y-0.5">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#1F1D2B]">
                    <Type className="h-4 w-4 text-[#FF7A00]" />
                    {row.role}
                  </p>
                  <p className="text-xs text-[#1F1D2B]/55 tabular-nums">
                    {row.family} · {row.weight} · {row.size} · LH {row.lineHeight}
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <p
                    className={
                      row.family === 'Poppins'
                        ? 'font-heading text-[#1F1D2B]'
                        : 'text-[#1F1D2B] tabular-nums'
                    }
                    style={{
                      fontSize: row.role === 'Display Hero' ? '1.875rem' : row.size.split(' ')[0],
                      fontWeight: row.weight.includes('700')
                        ? 700
                        : row.weight.includes('600')
                          ? 600
                          : row.weight.includes('500')
                            ? 500
                            : 400,
                    }}
                  >
                    {row.sample}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. BUTTONS, ICON BUTTONS, BADGES, PRICE & RATING */}
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">03. Interactive Primitives</p>
            <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
              Buttons, Icon Controls, Badges, Price & Rating Components
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-5">
              <h3 className="font-heading text-base font-semibold">Buttons & Icon Buttons</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  leftIcon={<ShoppingBag className="h-4 w-4" />}
                  onClick={() =>
                    addToast({ type: 'success', title: '✓ Product Added Successfully' })
                  }
                >
                  Primary Button
                </Button>
                <Button variant="secondary" onClick={() => setDemoModalOpen(true)}>
                  Secondary Button
                </Button>
                <Button variant="outline" onClick={() => setDemoConfirmOpen(true)}>
                  Outline Button
                </Button>
                <Button variant="primary" loading>
                  Loading
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#1F1D2B]/10">
                <IconButton label="Wishlist Icon" variant="surface" active>
                  <Heart className="h-4 w-4 fill-current" />
                </IconButton>
                <IconButton label="Cart Icon" variant="outline" badgeCount={2}>
                  <ShoppingBag className="h-4 w-4" />
                </IconButton>
                <IconButton label="Accent Icon" variant="accent">
                  <Sparkles className="h-4 w-4" />
                </IconButton>
                <div className="rounded-xl bg-[#1F1D2B] p-1.5 inline-flex gap-2">
                  <IconButton label="Dark Bar Icon" variant="dark" badgeCount={3}>
                    <Heart className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-5">
              <h3 className="font-heading text-base font-semibold">
                Product Badges, Price & Rating
              </h3>
              <div className="flex flex-wrap gap-2">
                <ProductBadge tone="accent">30% OFF</ProductBadge>
                <ProductBadge tone="primary">New Arrival</ProductBadge>
                <ProductBadge tone="success">In Stock</ProductBadge>
                <ProductBadge tone="warning">Only 6 Left</ProductBadge>
                <ProductBadge tone="error">Out of Stock</ProductBadge>
                <ProductBadge tone="info">360° Preview</ProductBadge>
                <ProductBadge tone="surface">Atelier Edition</ProductBadge>
              </div>

              <div className="pt-3 border-t border-[#1F1D2B]/10 flex flex-wrap items-center justify-between gap-4">
                <PriceDisplay discountedPrice={1399} originalPrice={1999} discountPercent={30} size="lg" />
                <RatingDisplay rating={4.8} reviewCount={2364} />
              </div>
            </div>
          </div>
        </section>

        {/* 4. STATUS SYSTEM & TOAST TRIGGERS */}
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">04. Status & Toast System</p>
            <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
              Success, Error, Warning, Information & Pending States
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatusAlert
              variant="success"
              title="✓ Product Added Successfully"
              description="Item added to your Fashion World shopping bag with selected size and color."
            />
            <StatusAlert
              variant="error"
              title="✕ Payment Failed"
              description="Card verification did not complete. Please review billing details or select another option."
            />
            <StatusAlert
              variant="warning"
              title="Low Inventory Threshold Warning"
              description="Only 6 pieces remain for Ivory Silk Embroidered Artisan Kurti."
            />
            <StatusAlert
              variant="info"
              title="3D Showroom Preview Information"
              description="Interactive lighting & spatial hotspots are Phase 1 UI foundations for Phase 3."
            />
            <StatusAlert
              variant="pending"
              title="Order #FW-9479 Pending Verification"
              description="Cash on Delivery confirmation is awaiting dispatch clearance."
            />
          </div>

          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3">
            <p className="text-sm font-semibold text-[#1F1D2B]">
              Trigger Official Phase 1 Toast Notifications
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addToast({ type: 'success', title: '✓ Product Added Successfully' })}
              >
                ✓ Product Added Successfully
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addToast({ type: 'success', title: '✓ Order Placed Successfully' })}
              >
                ✓ Order Placed Successfully
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addToast({ type: 'success', title: '✓ Payment Successful' })}
              >
                ✓ Payment Successful
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addToast({ type: 'error', title: '✕ Invalid Password' })}
              >
                ✕ Invalid Password
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addToast({ type: 'error', title: '✕ Payment Failed' })}
              >
                ✕ Payment Failed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addToast({ type: 'error', title: '✕ Product Unavailable' })}
              >
                ✕ Product Unavailable
              </Button>
            </div>
          </div>
        </section>

        {/* 5. SEARCH, DROPDOWN, INPUTS, FORM VALIDATION, MODAL & CONFIRM DIALOG */}
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">05. Forms, Navigation & Overlays</p>
            <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
              Search Bar, Dropdown, Form Validation, Modal & Confirmation Dialog
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-5">
              <h3 className="font-heading text-base font-semibold">Search Bar & Dropdown</h3>
              <SearchBar
                value={sampleSearch}
                onChange={setSampleSearch}
                suggestions={['Premium Tailored Casual Shirt', 'Royal Banarasi Zari Silk Saree', 'Camel Trench Coat']}
              />
              <div className="flex flex-wrap items-end gap-4">
                <Dropdown
                  label="Collection Sort Dropdown"
                  value={sampleSort}
                  onChange={setSampleSort}
                  options={[
                    { value: 'luxury', label: 'Featured Editions', description: 'Curated by stylists' },
                    { value: 'new', label: 'New Arrivals', description: 'Latest runway pieces' },
                    { value: 'discount', label: 'Highest Savings', description: 'Up to 50% off' },
                  ]}
                />
                <Button variant="secondary" size="md" onClick={() => setDemoModalOpen(true)}>
                  Open Sample Modal
                </Button>
                <Button variant="outline" size="md" onClick={() => setDemoConfirmOpen(true)}>
                  Confirmation Dialog
                </Button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormSubmitted(true);
                if (!passwordError && formEmail.includes('@')) {
                  addToast({
                    type: 'success',
                    title: 'Form Validation Passed',
                    description: 'Phase 1 client-side input validation states verified.',
                  });
                } else {
                  addToast({
                    type: 'error',
                    title: '✕ Invalid Password',
                    description: 'Use at least 8 characters to clear the error state.',
                  });
                }
              }}
              className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4"
            >
              <h3 className="font-heading text-base font-semibold">Live Form Validation</h3>
              <InputField
                label="Email Address"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                error={emailError}
                successMessage={
                  !emailError && formEmail.includes('@') ? 'Valid email format' : undefined
                }
              />
              <InputField
                label="Account Password (Try 8+ characters)"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                error={passwordError}
                successMessage={!passwordError ? 'Strong password length' : undefined}
              />
              <Button type="submit" variant="primary" size="md">
                Validate Form State
              </Button>
            </form>
          </div>
        </section>

        {/* 6. PRODUCT CARDS (DESKTOP & MOBILE) & CATEGORY CARDS */}
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">06. Commerce Cards</p>
            <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
              Desktop Product Card, Mobile Product Card & Editorial Category Card
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4">
              <p className="text-xs font-semibold text-[#1F1D2B]/60 mb-2">Desktop Card Layout</p>
              <ProductCard
                product={PRODUCTS[0]}
                layout="desktop"
                isWishlisted={wishlistedDemo}
                onToggleWishlist={() => setWishlistedDemo((w) => !w)}
                onAddToCart={(p) =>
                  addToast({ type: 'success', title: '✓ Product Added Successfully', description: p.name })
                }
                onQuickView={(p) =>
                  addToast({ type: 'info', title: `Quick View: ${p.name}` })
                }
              />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-semibold text-[#1F1D2B]/60">Mobile Card Layout (360–480px)</p>
              <ProductCard
                product={PRODUCTS[1]}
                layout="mobile"
                isWishlisted={false}
                onToggleWishlist={() => addToast({ type: 'success', title: 'Saved to Wishlist' })}
                onAddToCart={(p) =>
                  addToast({ type: 'success', title: '✓ Product Added Successfully', description: p.name })
                }
                onQuickView={(p) => addToast({ type: 'info', title: `Quick View: ${p.name}` })}
              />
              <ProductCard
                product={PRODUCTS[5]}
                layout="mobile"
                isWishlisted={false}
                onToggleWishlist={() => addToast({ type: 'info', title: 'Wishlist toggled' })}
                onAddToCart={() => addToast({ type: 'error', title: '✕ Product Unavailable' })}
                onQuickView={(p) => addToast({ type: 'info', title: `Quick View: ${p.name}` })}
              />
            </div>

            <div className="lg:col-span-3 space-y-2">
              <p className="text-xs font-semibold text-[#1F1D2B]/60">Editorial Category Card</p>
              <CategoryCard
                category={CATEGORIES[2]}
                variant="editorial"
                onSelect={(c) => addToast({ type: 'info', title: `Selected Category: ${c.name}` })}
              />
            </div>
          </div>
        </section>

        {/* 7. LOADING, SKELETON, EMPTY, ERROR & SUCCESS STATES */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#FF7A00]">07. System Feedback States</p>
              <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
                Spinners, Skeleton Loaders, Empty, Error & Success States
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSkeletons((s) => !s)}
            >
              {showSkeletons ? 'Hide Skeleton Preview' : 'Show Skeleton Preview'}
            </Button>
          </div>

          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 flex flex-wrap items-center gap-8">
            <LoadingSpinner size="sm" label="Checking stock..." />
            <LoadingSpinner size="md" label="Loading 3D showroom preview..." />
            <LoadingSpinner size="lg" label="Preparing collection..." />
          </div>

          {showSkeletons && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4">
                <SkeletonProductCard />
              </div>
              <div className="lg:col-span-8 rounded-2xl border border-[#1F1D2B]/10 bg-white p-5">
                <p className="text-xs font-semibold text-[#1F1D2B]/55 mb-3">
                  Table Row Skeleton Loader
                </p>
                <SkeletonTableRow />
                <SkeletonTableRow />
                <SkeletonTableRow />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <EmptyState
              title="Empty State Pattern"
              description="Displayed when a search filter, cart, or wishlist contains zero records."
              actionLabel="Explore Catalog"
              onAction={() => addToast({ type: 'info', title: 'Empty state CTA clicked' })}
            />
            <ErrorState
              title="Error State Pattern"
              description="Used when network sync or payment authorization fails, paired with recovery."
              actionLabel="Retry Request"
              onAction={() => addToast({ type: 'error', title: '✕ Payment Failed (Sample)' })}
            />
            <SuccessState
              title="✓ Order Placed Successfully"
              description="Confirms completed purchases, saved settings, or verified submissions."
              actionLabel="View Receipt"
              onAction={() => addToast({ type: 'success', title: '✓ Payment Successful' })}
            />
          </div>
        </section>

        {/* 8. RESPONSIVE BREAKPOINTS & ANIMATION GUIDELINES */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#FF7A00]">
              <Layers className="h-4 w-4" />
              <span className="text-xs font-semibold">08. Responsive Layout Foundation</span>
            </div>
            <h2 className="font-heading text-xl font-semibold text-[#1F1D2B]">
              Mobile-First Breakpoint Matrix
            </h2>
            <div className="space-y-3">
              {BREAKPOINT_SPECS.map((bp, idx) => {
                const Icon = idx === 0 ? Smartphone : idx === 1 ? Tablet : Monitor;
                return (
                  <div
                    key={bp.device}
                    className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF] p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 font-heading text-sm font-semibold">
                        <Icon className="h-4 w-4 text-[#FF7A00]" />
                        {bp.device}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#FF7A00] tabular-nums">
                        {bp.range}
                      </span>
                    </div>
                    <p className="text-xs text-[#1F1D2B]/75">{bp.headerLayout}</p>
                    <p className="text-[11px] text-[#1F1D2B]/55">
                      {bp.columns} · {bp.touchTarget}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#FF7A00]">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold">09. Animation Guidelines</span>
            </div>
            <h2 className="font-heading text-xl font-semibold text-[#1F1D2B]">
              Motion Tokens & Reduced-Motion Compliance
            </h2>
            <div className="space-y-3">
              {ANIMATION_SPECS.map((anim) => (
                <div
                  key={anim.name}
                  className="rounded-xl border border-[#1F1D2B]/10 bg-[#FFF8EF] p-4 space-y-1 fw-card-hover"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-sm font-semibold text-[#1F1D2B]">{anim.name}</p>
                    <span className="font-mono text-[11px] font-semibold text-[#FF7A00] tabular-nums">
                      {anim.duration}
                    </span>
                  </div>
                  <p className="text-xs text-[#1F1D2B]/70">{anim.rule}</p>
                  <p className="font-mono text-[11px] text-[#1F1D2B]/50">{anim.properties}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#16A34A] font-medium">
              ✓ Respects OS prefers-reduced-motion accessibility preference globally in CSS.
            </p>
          </div>
        </section>
      </div>

      {/* Interactive Modal & Confirmation Dialog Demos */}
      <Modal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title="Fashion World Modal Component"
        subtitle="Smooth compositor-only scale transition with Escape key & backdrop dismiss"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#1F1D2B]/75 leading-relaxed">
            This reusable modal adheres strictly to the official Fashion World surface tokens
            (<code className="font-mono text-xs">#FFF8EF</code> canvas,{' '}
            <code className="font-mono text-xs">#1F1D2B</code> typography,{' '}
            <code className="font-mono text-xs">#FF7A00</code> focus rings).
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setDemoModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDemoModalOpen(false);
                addToast({ type: 'success', title: 'Modal Action Confirmed' });
              }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={demoConfirmOpen}
        onClose={() => setDemoConfirmOpen(false)}
        onConfirm={() => addToast({ type: 'warning', title: 'Confirmation Accepted' })}
        title="Confirm Design Action"
        message="Use ConfirmationDialog before destructive deletions, order cancellations, or showroom resets."
        confirmLabel="Confirm Action"
      />
    </div>
  );
};
