export interface ProductColorOption {
  name: string;
  hex: string;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: 'Men' | 'Women' | 'Kids' | 'Traditional Wear';
  subcategory: string;
  image: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  sizes: string[];
  colors: ProductColorOption[];
  stockStatus: StockStatus;
  stockCount: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isOffer?: boolean;
  has360Preview?: boolean;
  showroomZone: string;
  description: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  filterKey: string;
  route: string;
  itemCount: number;
  image: string;
  tagline: string;
}

export interface ShowroomZone {
  id: string;
  name: string;
  category: string;
  rackCount: number;
  mannequinCount: number;
  lightingPreset: string;
  floorFinish: string;
  cameraAngle: number;
  hotspotX: number;
  hotspotY: number;
  description: string;
  featuredSkus: string[];
}

export interface OfferCardItem {
  id: string;
  tag: string;
  title: string;
  discountText: string;
  description: string;
  ctaLabel: string;
  route: string;
  image: string;
  accent: 'primary' | 'accent' | 'surface';
}

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  city: string;
  rating: number;
  productPurchased: string;
  quote: string;
  date: string;
}

export const ASSETS = {
  heroCampaign: '/src/assets/images/hero_luxury_fashion_campaign_1795315289595.jpg',
  showroomInterior: '/src/assets/images/showroom_luxury_interior_1795313154875.jpg',
  winterBanner: '/src/assets/images/banner_winter_collection_1795313155599.jpg',
  navyShirt: '/src/assets/images/product_navy_casual_shirt_1795313158351.jpg',
  crimsonSaree: '/src/assets/images/product_crimson_silk_saree_1795313161069.jpg',
  camelCoat: '/src/assets/images/product_camel_wool_coat_1795313155559.jpg',
  kidsJacket: '/src/assets/images/product_kids_festive_jacket_1795313159256.jpg',
  oliveBlazer: '/src/assets/images/product_olive_tailored_blazer_1795313153908.jpg',
  ivoryKurti: '/src/assets/images/product_ivory_embroidered_kurti_1795313159370.jpg',
  selvedgeJeans: '/src/assets/images/product_selvedge_denim_jeans_1795315290775.jpg',
  supimaTshirt: '/src/assets/images/product_supima_knit_tshirt_1795315290823.jpg',
  royalSherwani: '/src/assets/images/product_royal_sherwani_traditional_1795315291730.jpg',
  referenceMockup: '/assets/aistudio/file_00000000ebc88211b63ce7d9ab938610_fc77732c.png',
} as const;

export const ANNOUNCEMENT_MESSAGES = [
  'Grand Festival Couture Sale — Flat 30% to 50% Off on Seasonal Arrivals',
  'Complimentary Insured Express Delivery on all orders above ₹999',
  '3D Jummo Fashion World — Preview our architectural 360° Luxury Showroom',
  'Extra 10% Privilege Savings on Handwoven Banarasi Sarees & Sherwanis · Code: JUMMO10',
] as const;

export const NAV_CATEGORIES = [
  'Home',
  '3D Showroom',
  'Men',
  'Women',
  'Kids',
  'Traditional Wear',
  'New Arrivals',
  'Offers',
  'Help',
] as const;

export type NavCategory = (typeof NAV_CATEGORIES)[number];

export interface NavRouteItem {
  label: NavCategory;
  path: string;
}

export const NAV_ROUTES: NavRouteItem[] = [
  { label: 'Home', path: '/' },
  { label: '3D Showroom', path: '/showroom' },
  { label: 'Men', path: '/men' },
  { label: 'Women', path: '/women' },
  { label: 'Kids', path: '/kids' },
  { label: 'Traditional Wear', path: '/traditional' },
  { label: 'New Arrivals', path: '/new-arrivals' },
  { label: 'Offers', path: '/offers' },
  { label: 'Help', path: '/help' },
];

export const CATEGORIES: CategoryItem[] = [
  {
    id: 'cat-mens-fashion',
    name: "Men's Fashion",
    filterKey: 'Men',
    route: '/men',
    itemCount: 240,
    image: ASSETS.oliveBlazer,
    tagline: 'Tailored suiting & smart luxury',
  },
  {
    id: 'cat-womens-fashion',
    name: "Women's Fashion",
    filterKey: 'Women',
    route: '/women',
    itemCount: 295,
    image: ASSETS.camelCoat,
    tagline: 'Cashmere coats & runway edits',
  },
  {
    id: 'cat-kids-fashion',
    name: 'Kids Fashion',
    filterKey: 'Kids',
    route: '/kids',
    itemCount: 118,
    image: ASSETS.kidsJacket,
    tagline: 'Festive & everyday couture',
  },
  {
    id: 'cat-shirts',
    name: 'Shirts',
    filterKey: 'Shirts',
    route: '/search?q=Shirt',
    itemCount: 148,
    image: ASSETS.navyShirt,
    tagline: 'Breathable linen & Giza cotton',
  },
  {
    id: 'cat-jeans',
    name: 'Jeans',
    filterKey: 'Jeans',
    route: '/search?q=Jeans',
    itemCount: 92,
    image: ASSETS.selvedgeJeans,
    tagline: 'Japanese selvedge & tailored fits',
  },
  {
    id: 'cat-tshirts',
    name: 'T-Shirts',
    filterKey: 'T-Shirts',
    route: '/search?q=T-Shirt',
    itemCount: 164,
    image: ASSETS.supimaTshirt,
    tagline: 'Heavyweight Supima essentials',
  },
  {
    id: 'cat-sarees',
    name: 'Sarees',
    filterKey: 'Sarees',
    route: '/search?q=Saree',
    itemCount: 96,
    image: ASSETS.crimsonSaree,
    tagline: 'Handwoven zari silk heirlooms',
  },
  {
    id: 'cat-kurtis',
    name: 'Kurtis',
    filterKey: 'Kurtis',
    route: '/search?q=Kurti',
    itemCount: 134,
    image: ASSETS.ivoryKurti,
    tagline: 'Artisan threadwork & chanderi silk',
  },
  {
    id: 'cat-traditional',
    name: 'Traditional Wear',
    filterKey: 'Traditional Wear',
    route: '/traditional',
    itemCount: 186,
    image: ASSETS.royalSherwani,
    tagline: 'Ceremonial sherwanis & heritage',
  },
];

export const PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    sku: 'FW-MN-101',
    name: 'Premium Tailored Casual Shirt',
    category: 'Men',
    subcategory: 'Shirts',
    image: ASSETS.navyShirt,
    originalPrice: 1999,
    discountedPrice: 1399,
    discountPercent: 30,
    rating: 4.8,
    reviewCount: 2364,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Midnight Navy', hex: '#1B2845' },
      { name: 'Ivory White', hex: '#F5F1EB' },
      { name: 'Bordeaux', hex: '#5D1E2E' },
      { name: 'Forest Olive', hex: '#3D4838' },
    ],
    stockStatus: 'low_stock',
    stockCount: 12,
    isNewArrival: true,
    isBestSeller: true,
    isOffer: true,
    has360Preview: true,
    showroomZone: "Men's Wing · Rack A2",
    description:
      'Cut from long-staple cotton-linen blend with mother-of-pearl buttons and soft architectural collar roll.',
  },
  {
    id: 'prod-2',
    sku: 'FW-TR-204',
    name: 'Royal Banarasi Zari Silk Saree',
    category: 'Traditional Wear',
    subcategory: 'Sarees',
    image: ASSETS.crimsonSaree,
    originalPrice: 12999,
    discountedPrice: 8999,
    discountPercent: 31,
    rating: 4.9,
    reviewCount: 842,
    sizes: ['Free Size'],
    colors: [
      { name: 'Royal Crimson', hex: '#8E1B28' },
      { name: 'Antique Gold', hex: '#C69645' },
      { name: 'Deep Emerald', hex: '#1B4D3E' },
    ],
    stockStatus: 'in_stock',
    stockCount: 28,
    isNewArrival: true,
    isBestSeller: true,
    isOffer: true,
    has360Preview: true,
    showroomZone: 'Central Atrium · Podium 01',
    description:
      'Handloom Katan silk saree woven with intricate antique gold zari floral motifs and a regal ceremonial pallu.',
  },
  {
    id: 'prod-3',
    sku: 'FW-WM-312',
    name: 'Belted Cashmere-Wool Trench Coat',
    category: 'Women',
    subcategory: 'Outerwear',
    image: ASSETS.camelCoat,
    originalPrice: 9499,
    discountedPrice: 6499,
    discountPercent: 32,
    rating: 4.9,
    reviewCount: 618,
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Warm Camel', hex: '#B98A5C' },
      { name: 'Obsidian', hex: '#1F1D2B' },
      { name: 'Sandstone', hex: '#D8C3AA' },
    ],
    stockStatus: 'in_stock',
    stockCount: 19,
    isNewArrival: true,
    isBestSeller: true,
    isOffer: true,
    has360Preview: true,
    showroomZone: "Women's Atelier · Rack B1",
    description:
      'Double-breasted silhouette in brushed cashmere-wool with horn buttons and storm-flap tailoring.',
  },
  {
    id: 'prod-4',
    sku: 'FW-MN-118',
    name: 'Structured Italian Linen Blazer',
    category: 'Men',
    subcategory: 'Blazers',
    image: ASSETS.oliveBlazer,
    originalPrice: 7999,
    discountedPrice: 5599,
    discountPercent: 30,
    rating: 4.7,
    reviewCount: 412,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Deep Olive', hex: '#434936' },
      { name: 'Charcoal', hex: '#2B2B33' },
      { name: 'Espresso', hex: '#4A362B' },
    ],
    stockStatus: 'in_stock',
    stockCount: 24,
    isNewArrival: false,
    isBestSeller: true,
    isOffer: true,
    has360Preview: true,
    showroomZone: "Men's Wing · Rack A4",
    description:
      'Half-canvassed breathable linen jacket featuring notched lapels, flap pockets, and soft shoulder construction.',
  },
  {
    id: 'prod-5',
    sku: 'FW-TR-219',
    name: 'Ivory Silk Embroidered Artisan Kurti',
    category: 'Traditional Wear',
    subcategory: 'Kurtis',
    image: ASSETS.ivoryKurti,
    originalPrice: 3899,
    discountedPrice: 2799,
    discountPercent: 28,
    rating: 4.8,
    reviewCount: 1120,
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Ivory Silk', hex: '#EFE6D5' },
      { name: 'Champagne', hex: '#E3C7A3' },
      { name: 'Terracotta', hex: '#B75D38' },
    ],
    stockStatus: 'low_stock',
    stockCount: 6,
    isNewArrival: true,
    isBestSeller: true,
    isOffer: false,
    has360Preview: true,
    showroomZone: 'Traditional Pavilion · Rack D2',
    description:
      'Mandarin-collar chanderi silk tunic adorned with fine paisley resham and zari embroidery along the placket.',
  },
  {
    id: 'prod-6',
    sku: 'FW-KD-405',
    name: 'Amber Quilted Bomber & Selvedge Set',
    category: 'Kids',
    subcategory: 'Sets',
    image: ASSETS.kidsJacket,
    originalPrice: 3499,
    discountedPrice: 2449,
    discountPercent: 30,
    rating: 4.9,
    reviewCount: 389,
    sizes: ['4-5Y', '6-7Y', '8-9Y', '10-11Y'],
    colors: [
      { name: 'Amber Gold', hex: '#C2741F' },
      { name: 'Indigo Navy', hex: '#22314A' },
    ],
    stockStatus: 'in_stock',
    stockCount: 15,
    isNewArrival: true,
    isBestSeller: false,
    isOffer: true,
    has360Preview: true,
    showroomZone: 'Kids Gallery · Rack C1',
    description:
      'Satin-finish quilted bomber paired with soft-washed stretch denim crafted for all-day movement.',
  },
  {
    id: 'prod-7',
    sku: 'FW-MN-132',
    name: 'Raw Indigo Japanese Selvedge Jeans',
    category: 'Men',
    subcategory: 'Jeans',
    image: ASSETS.selvedgeJeans,
    originalPrice: 4999,
    discountedPrice: 3499,
    discountPercent: 30,
    rating: 4.8,
    reviewCount: 924,
    sizes: ['30', '32', '34', '36'],
    colors: [
      { name: 'Raw Indigo', hex: '#1B2741' },
      { name: 'Washed Slate', hex: '#4B5563' },
    ],
    stockStatus: 'in_stock',
    stockCount: 34,
    isNewArrival: true,
    isBestSeller: true,
    isOffer: true,
    has360Preview: true,
    showroomZone: "Men's Wing · Rack A6",
    description:
      '13.5oz shuttle-loom selvedge denim tailored in a modern straight taper with brushed brass hardware.',
  },
  {
    id: 'prod-8',
    sku: 'FW-MN-145',
    name: 'Heavyweight Supima Knit Crew T-Shirt',
    category: 'Men',
    subcategory: 'T-Shirts',
    image: ASSETS.supimaTshirt,
    originalPrice: 1599,
    discountedPrice: 1099,
    discountPercent: 31,
    rating: 4.7,
    reviewCount: 1540,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Obsidian Charcoal', hex: '#242429' },
      { name: 'Warm Ivory', hex: '#F3ECE2' },
      { name: 'Burnt Amber', hex: '#B45309' },
    ],
    stockStatus: 'in_stock',
    stockCount: 48,
    isNewArrival: false,
    isBestSeller: true,
    isOffer: true,
    has360Preview: true,
    showroomZone: "Men's Wing · Rack A1",
    description:
      '260 GSM combed Supima jersey with ribbed collar retention and clean rolled-cuff structure.',
  },
  {
    id: 'prod-9',
    sku: 'FW-TR-231',
    name: 'Champagne Zari Bandhgala Sherwani',
    category: 'Traditional Wear',
    subcategory: 'Sherwanis',
    image: ASSETS.royalSherwani,
    originalPrice: 18999,
    discountedPrice: 13299,
    discountPercent: 30,
    rating: 5.0,
    reviewCount: 276,
    sizes: ['38', '40', '42', '44'],
    colors: [
      { name: 'Champagne Ivory', hex: '#E4D3B6' },
      { name: 'Midnight Velvet', hex: '#1F1D2B' },
    ],
    stockStatus: 'low_stock',
    stockCount: 4,
    isNewArrival: true,
    isBestSeller: true,
    isOffer: true,
    has360Preview: true,
    showroomZone: 'Traditional Pavilion · Podium 02',
    description:
      'Hand-embroidered silk raw bandhgala featuring heirloom antique-gold threadwork and brass buttons.',
  },
];

export const SPECIAL_OFFERS: OfferCardItem[] = [
  {
    id: 'offer-festival',
    tag: 'Festival Sale',
    title: 'Royal Heritage Couture Edit',
    discountText: 'Flat 35% Off',
    description: 'Handloom Banarasi sarees, embroidered kurtis, and ceremonial bandhgala sherwanis.',
    ctaLabel: 'Shop Festival Sale',
    route: '/traditional',
    image: ASSETS.crimsonSaree,
    accent: 'primary',
  },
  {
    id: 'offer-limited',
    tag: 'Limited Time Offer',
    title: 'Weekend Tailoring Privilege',
    discountText: 'Up to 40% Off',
    description: 'Italian linen blazers, tailored casual shirts, and Japanese selvedge denim.',
    ctaLabel: 'Claim Limited Deals',
    route: '/men',
    image: ASSETS.oliveBlazer,
    accent: 'accent',
  },
  {
    id: 'offer-best-deals',
    tag: 'Best Deals',
    title: 'Winter Cashmere & Wool Icons',
    discountText: 'Save ₹3,000+',
    description: 'Belted cashmere-wool coats and layered luxury ensembles ready for cool evenings.',
    ctaLabel: 'Explore Best Deals',
    route: '/women',
    image: ASSETS.camelCoat,
    accent: 'surface',
  },
  {
    id: 'offer-discount',
    tag: 'Discount Collection',
    title: 'Kids & Everyday Essentials',
    discountText: 'Buy 2, Extra 15% Off',
    description: 'Supima knit basics, quilted jackets, and versatile wardrobe staples.',
    ctaLabel: 'Browse Discount Rack',
    route: '/offers',
    image: ASSETS.kidsJacket,
    accent: 'surface',
  },
];

export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 'rev-1',
    name: 'Ananya Deshmukh',
    role: 'Interior Architect',
    city: 'Mumbai',
    rating: 5,
    productPurchased: 'Royal Banarasi Zari Silk Saree',
    quote:
      'The drape and antique gold zari finish look even richer in person than the studio photos. Packaging felt like receiving a couture trunk from a Paris flagship.',
    date: '14 Nov 2026',
  },
  {
    id: 'rev-2',
    name: 'Vikramaditya Rao',
    role: 'Creative Director',
    city: 'Bengaluru',
    rating: 5,
    productPurchased: 'Structured Italian Linen Blazer',
    quote:
      'Impeccable shoulder line and breathable linen weave. The sizing guide matched my exact measurements, and express delivery arrived in 36 hours.',
    date: '09 Nov 2026',
  },
  {
    id: 'rev-3',
    name: 'Sana Siddiqui',
    role: 'Luxury Hospitality Lead',
    city: 'New Delhi',
    rating: 4.9,
    productPurchased: 'Belted Cashmere-Wool Trench Coat',
    quote:
      'Warm without bulk, with clean horn buttons and tailored cuffs. I am genuinely excited to walk through the full 3D showroom in the next release.',
    date: '02 Nov 2026',
  },
];

export const SHOWROOM_ZONES: ShowroomZone[] = [
  {
    id: 'zone-entrance',
    name: 'Grand Entrance Atrium',
    category: 'Showroom Entrance',
    rackCount: 4,
    mannequinCount: 3,
    lightingPreset: 'Concentric Warm Gold Ring Chandelier (3000K)',
    floorFinish: 'Polished Cream Crema Marfil Marble',
    cameraAngle: 0,
    hotspotX: 50,
    hotspotY: 58,
    description:
      'Signature arrival vista featuring a brushed brass circular podium, concentric ceiling ring luminaires, and obsidian fluted wall panels.',
    featuredSkus: ['FW-TR-204', 'FW-MN-118'],
  },
  {
    id: 'zone-men',
    name: "Men's Collection Wing",
    category: 'Men',
    rackCount: 8,
    mannequinCount: 4,
    lightingPreset: 'Directional Track Spotlights (3500K)',
    floorFinish: 'Crema Marfil with Brass Inlay',
    cameraAngle: -32,
    hotspotX: 16,
    hotspotY: 52,
    description:
      'Architectural walnut-and-brass clothing bays displaying tailored shirts, Italian blazers, and Japanese selvedge denim.',
    featuredSkus: ['FW-MN-101', 'FW-MN-118', 'FW-MN-132'],
  },
  {
    id: 'zone-women',
    name: "Women's Luxury Atelier",
    category: 'Women',
    rackCount: 10,
    mannequinCount: 5,
    lightingPreset: 'Soft Diffused Gallery Wash (3200K)',
    floorFinish: 'Honed Champagne Limestone',
    cameraAngle: 28,
    hotspotX: 84,
    hotspotY: 52,
    description:
      'Elevated boutique shelving with recessed cove backlighting, curved brass garment rails, and full-height mirrors.',
    featuredSkus: ['FW-WM-312'],
  },
  {
    id: 'zone-traditional',
    name: 'Traditional Heritage Pavilion',
    category: 'Traditional Wear',
    rackCount: 6,
    mannequinCount: 4,
    lightingPreset: 'Warm Couture Spotlight (2800K)',
    floorFinish: 'Polished Marble + Illuminated Brass Plinth',
    cameraAngle: 12,
    hotspotX: 64,
    hotspotY: 46,
    description:
      'Curated couture showcase honoring Banarasi silk weaves, zari embroidery, and ceremonial drapes on spotlighted plinths.',
    featuredSkus: ['FW-TR-204', 'FW-TR-219', 'FW-TR-231'],
  },
  {
    id: 'zone-kids',
    name: 'Kids Boutique Gallery',
    category: 'Kids',
    rackCount: 5,
    mannequinCount: 3,
    lightingPreset: 'Balanced Daylight LED (4000K)',
    floorFinish: 'Matte Warm Oak & Marble Trim',
    cameraAngle: -16,
    hotspotX: 33,
    hotspotY: 46,
    description:
      'Lower-profile wooden racks with rounded brass hardware designed for effortless browsing of seasonal kids collections.',
    featuredSkus: ['FW-KD-405'],
  },
];

export const ADMIN_SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'payments', label: 'Payments' },
  { id: 'analytics', label: 'Sales Analytics' },
  { id: 'offers', label: 'Offers & Coupons' },
  { id: 'showroom', label: '3D Showroom' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
] as const;

export type AdminSectionId = (typeof ADMIN_SIDEBAR_ITEMS)[number]['id'];

export interface AdminOrder {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: 'Delivered' | 'Shipped' | 'Processing' | 'Pending' | 'Cancelled';
  date: string;
  paymentMethod: string;
}

export const ADMIN_ORDERS: AdminOrder[] = [
  {
    id: '#FW-9482',
    customer: 'Aarav Sharma',
    items: 2,
    total: 8999,
    status: 'Delivered',
    date: '21 Nov 2026',
    paymentMethod: 'UPI',
  },
  {
    id: '#FW-9481',
    customer: 'Meera Nair',
    items: 1,
    total: 6499,
    status: 'Shipped',
    date: '21 Nov 2026',
    paymentMethod: 'Card',
  },
  {
    id: '#FW-9480',
    customer: 'Rohan Kapoor',
    items: 3,
    total: 6998,
    status: 'Processing',
    date: '20 Nov 2026',
    paymentMethod: 'Card',
  },
  {
    id: '#FW-9479',
    customer: 'Zoya Khan',
    items: 1,
    total: 2799,
    status: 'Pending',
    date: '20 Nov 2026',
    paymentMethod: 'COD',
  },
  {
    id: '#FW-9478',
    customer: 'Kabir Malhotra',
    items: 2,
    total: 5599,
    status: 'Delivered',
    date: '19 Nov 2026',
    paymentMethod: 'UPI',
  },
  {
    id: '#FW-9477',
    customer: 'Ananya Verma',
    items: 1,
    total: 2449,
    status: 'Cancelled',
    date: '19 Nov 2026',
    paymentMethod: 'Card',
  },
];

export const SALES_SERIES = {
  '7D': [
    { label: 'Mon', value: 14200 },
    { label: 'Tue', value: 18500 },
    { label: 'Wed', value: 16900 },
    { label: 'Thu', value: 22400 },
    { label: 'Fri', value: 19800 },
    { label: 'Sat', value: 28100 },
    { label: 'Sun', value: 31400 },
  ],
  '30D': [
    { label: '1 Nov', value: 28000 },
    { label: '5 Nov', value: 44000 },
    { label: '10 Nov', value: 62000 },
    { label: '15 Nov', value: 58000 },
    { label: '20 Nov', value: 89000 },
    { label: '25 Nov', value: 84000 },
    { label: '30 Nov', value: 124560 },
  ],
  Quarter: [
    { label: 'Sep', value: 295000 },
    { label: 'Oct', value: 382000 },
    { label: 'Nov', value: 468500 },
  ],
} as const;

export const ORDER_STATUS_BREAKDOWN = [
  { label: 'Delivered', count: 128, color: '#16A34A' },
  { label: 'Shipped', count: 62, color: '#2563EB' },
  { label: 'Processing', count: 37, color: '#FF7A00' },
  { label: 'Pending', count: 24, color: '#F59E0B' },
  { label: 'Cancelled', count: 5, color: '#DC2626' },
] as const;

export interface LowStockAlert {
  sku: string;
  name: string;
  remaining: number;
  severity: 'warning' | 'error';
}

export const LOW_STOCK_ALERTS: LowStockAlert[] = [
  { sku: 'FW-TR-231', name: 'Champagne Zari Bandhgala Sherwani', remaining: 4, severity: 'error' },
  { sku: 'FW-TR-219', name: 'Ivory Silk Embroidered Artisan Kurti', remaining: 6, severity: 'warning' },
  { sku: 'FW-MN-101', name: 'Premium Tailored Casual Shirt', remaining: 12, severity: 'warning' },
];

export const RECENT_ACTIVITY = [
  { id: 'act-1', title: 'Order #FW-9482 marked Delivered', time: '8 mins ago', tone: 'success' as const },
  { id: 'act-2', title: '3D Showroom Podium lighting preset saved', time: '32 mins ago', tone: 'info' as const },
  { id: 'act-3', title: 'Low stock threshold hit on SKU FW-TR-219', time: '1 hr ago', tone: 'warning' as const },
  { id: 'act-4', title: 'Payment retry failed on Order #FW-9477', time: '3 hrs ago', tone: 'error' as const },
];

export const ADMIN_NOTIFICATIONS = [
  { id: 'notif-1', message: '6 units left for Ivory Silk Embroidered Kurti', type: 'warning' as const, time: '14m ago' },
  { id: 'notif-2', message: 'New high-value order #FW-9482 (₹8,999)', type: 'success' as const, time: '42m ago' },
  { id: 'notif-3', message: 'Winter 3D Showroom layout draft approved for Phase 3', type: 'info' as const, time: '2h ago' },
];
