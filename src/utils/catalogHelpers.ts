import type { Product, ProductColorOption, StockStatus } from '../data/catalog';
import type { ShowroomProduct } from '../data/showroomProducts';
import type {
  CatalogCategory,
  CatalogProduct,
  ProductVariant,
  ResolvedCatalogProduct,
} from '../types/catalog';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Strips HTML tags and control characters from user-entered strings.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

/**
 * Generates URL-safe kebab-case slugs.
 */
export function slugify(input: string): string {
  return sanitizeText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Accurately computes discount percentage while preventing negative or NaN values.
 */
export function calculateDiscountPercentage(
  originalPrice: number,
  sellingPrice: number
): number {
  if (!Number.isFinite(originalPrice) || !Number.isFinite(sellingPrice)) return 0;
  if (originalPrice <= 0 || sellingPrice < 0 || sellingPrice >= originalPrice) return 0;
  return Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
}

/**
 * Computes exact total stock from variant matrix (single source of truth).
 */
export function calculateTotalStock(variants: ProductVariant[]): number {
  return variants.reduce((sum, v) => {
    const qty = Number.isFinite(v.stockQuantity) ? Math.max(0, Math.floor(v.stockQuantity)) : 0;
    return sum + qty;
  }, 0);
}

/**
 * Computes stock status based on total stock and configurable low-stock threshold.
 */
export function computeStockStatus(totalStock: number, lowStockThreshold: number): StockStatus {
  if (totalStock <= 0) return 'out_of_stock';
  if (totalStock <= Math.max(1, lowStockThreshold)) return 'low_stock';
  return 'in_stock';
}

/**
 * Formats prices consistently in Indian Rupees (₹).
 */
export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return `₹${safe.toLocaleString('en-IN')}`;
}

/**
 * Validates image file type and size strictly before processing.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase();
  const forbiddenExts = ['.svg', '.html', '.htm', '.js', '.exe', '.php', '.sh'];
  if (forbiddenExts.some((ext) => lowerName.endsWith(ext))) {
    return {
      valid: false,
      error: `Blocked unsafe file format (${file.name}). Only JPG, PNG, and WEBP images are permitted.`,
    };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type for "${file.name}". Allowed formats: JPG, PNG, WEBP.`,
    };
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return {
      valid: false,
      error: `"${file.name}" exceeds the 5 MB file size limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  return { valid: true };
}

/**
 * Compresses an uploaded image file via Canvas into a compact JPEG/WebP data URL
 * so local demo storage remains lightweight and previews load instantaneously.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1000,
  quality = 0.82
): Promise<{ dataUrl: string; sizeKb: number; compressed: boolean }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read image file "${file.name}"`));
    reader.readAsDataURL(file);
  });

  // Attempt HTMLCanvasElement compression
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () => reject(new Error('Image decode failed'));
      imageEl.src = rawDataUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        dataUrl: rawDataUrl,
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        compressed: false,
      };
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);
    const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const compressedUrl = canvas.toDataURL(outputMime, quality);
    const approxBytes = Math.round((compressedUrl.length * 3) / 4);
    const shouldUseCompressed = compressedUrl.length < rawDataUrl.length;

    return {
      dataUrl: shouldUseCompressed ? compressedUrl : rawDataUrl,
      sizeKb: Math.max(1, Math.round((shouldUseCompressed ? approxBytes : file.size) / 1024)),
      compressed: shouldUseCompressed,
    };
  } catch {
    return {
      dataUrl: rawDataUrl,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      compressed: false,
    };
  }
}

/**
 * Maps a category department key to the legacy Phase 1-3 Product.category union.
 */
function resolveLegacyCategory(
  category: CatalogCategory | undefined
): Product['category'] {
  if (!category) return 'Men';
  switch (category.departmentKey) {
    case 'Men':
      return 'Men';
    case 'Women':
      return 'Women';
    case 'Kids':
      return 'Kids';
    case 'Traditional Wear':
      return 'Traditional Wear';
    default:
      return 'Men';
  }
}

/**
 * Resolves a CatalogProduct against the live category tree, producing derived
 * inventory totals, color/size summaries, and a Phase 1-3 compatible Product object.
 */
export function resolveCatalogProduct(
  product: CatalogProduct,
  categories: CatalogCategory[],
  globalLowStockThreshold: number
): ResolvedCatalogProduct {
  const category = categories.find((c) => c.id === product.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === product.subcategoryId);

  const categoryName = category?.name || 'Uncategorized';
  const subcategoryName = subcategory?.name || 'General';

  const totalStock = calculateTotalStock(product.variants);
  const effectiveThreshold = product.lowStockThreshold || globalLowStockThreshold;
  const stockStatus = computeStockStatus(totalStock, effectiveThreshold);

  const sortedImages = [...product.images].sort((a, b) => a.order - b.order);
  const mainImageObj = sortedImages.find((img) => img.isMain) || sortedImages[0];
  const mainImage = mainImageObj?.url || '';

  const colorMap = new Map<string, ProductColorOption>();
  const sizeSet = new Set<string>();
  for (const v of product.variants) {
    if (!colorMap.has(v.colour)) {
      colorMap.set(v.colour, { name: v.colour, hex: v.colourHex || '#1F1D2B' });
    }
    if (v.size) sizeSet.add(v.size);
  }
  const availableColors = Array.from(colorMap.values());
  const availableSizes = Array.from(sizeSet);

  const effectiveSellingPrice =
    product.salePrice && product.salePrice > 0 && product.salePrice < product.sellingPrice
      ? product.salePrice
      : product.sellingPrice;
  const discountPct = calculateDiscountPercentage(product.originalPrice, effectiveSellingPrice);

  const showroomZoneLabel = product.showroomMapping.enabled
    ? `${product.showroomMapping.showroomSection.toUpperCase()} · ${product.showroomMapping.rackId}`
    : 'Online Exclusive';

  const legacyProduct: Product = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: resolveLegacyCategory(category),
    subcategory: subcategoryName,
    image: mainImage,
    originalPrice: product.originalPrice,
    discountedPrice: effectiveSellingPrice,
    discountPercent: discountPct,
    rating: product.rating,
    reviewCount: product.reviewCount,
    sizes: availableSizes.length > 0 ? availableSizes : ['Free Size'],
    colors:
      availableColors.length > 0
        ? availableColors
        : [{ name: 'Signature', hex: '#1F1D2B' }],
    stockStatus,
    stockCount: totalStock,
    isNewArrival: product.newArrival,
    isBestSeller: product.bestSeller,
    isOffer: product.discountCollection || discountPct >= 25,
    has360Preview: product.showroomMapping.has3DModel,
    showroomZone: showroomZoneLabel,
    description: product.description,
  };

  return {
    ...product,
    discountPercentage: discountPct,
    categoryName,
    subcategoryName,
    totalStock,
    stockStatus,
    mainImage,
    availableColors: legacyProduct.colors,
    availableSizes: legacyProduct.sizes,
    legacyProduct,
  };
}

/**
 * Converts a ResolvedCatalogProduct into a Phase 3 ShowroomProduct for seamless 3D rendering.
 */
export function toShowroomProduct(resolved: ResolvedCatalogProduct): ShowroomProduct {
  return {
    ...resolved.legacyProduct,
    modelRef: resolved.showroomMapping.modelArchetype || 'shirt',
    has3DModel: resolved.showroomMapping.has3DModel,
    isDemoData: resolved.isDemoData,
    sectionId: resolved.showroomMapping.showroomSection,
    garmentScale: resolved.showroomMapping.scale || 1,
  };
}
