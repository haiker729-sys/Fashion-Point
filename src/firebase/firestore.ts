import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { ASSETS } from '../data/catalog';
import type {
  CatalogCategory,
  CatalogProduct,
  ProductImageAsset,
  ProductShowroomMapping,
  ProductVariant,
  ProductVisibilityStatus,
} from '../types/catalog';
import { calculateDiscountPercentage, sanitizeText, slugify } from '../utils/catalogHelpers';
import { db } from './firebaseConfig';
import { OperationType, handleFirestoreError } from './firebaseErrors';

export const COLLECTIONS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  USERS: 'users',
  ADMINS: 'admins',
  SHOWROOM: 'showroom',
  SETTINGS: 'settings',
} as const;

export interface StoreSettingsDoc {
  id: string;
  storeName: string;
  currencyCode: string;
  lowStockThreshold: number;
  announcementText: string;
  showroomDefaultLighting: 'warm_luxury' | 'daylight_atelier' | 'evening_gala';
  updatedAt?: string;
}

export interface ShowroomSectionConfigDoc {
  id: string;
  sectionId: string;
  title: string;
  lightingPreset: 'warm_luxury' | 'daylight_atelier' | 'evening_gala';
  featuredProductIds: string[];
  active: boolean;
  updatedAt?: string;
}

export interface MigrationReport {
  categoriesCreated: number;
  categoriesSkipped: number;
  productsCreated: number;
  productsSkipped: number;
  failed: Array<{ entity: 'category' | 'product'; id: string; name: string; reason: string }>;
  completedAt: string;
}

function timestampToIso(value: unknown): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date().toISOString();
}

/**
 * Ensures image URLs stored in Firestore are clean HTTPS or verified relative asset paths
 * and NEVER raw binary/base64 data URLs (which belong in Firebase Storage).
 */
function sanitizeImageAssetsForFirestore(images: ProductImageAsset[]): ProductImageAsset[] {
  const cleaned = images
    .slice(0, 12)
    .map((img, idx) => {
      const safeUrl =
        img.url && !img.url.startsWith('data:')
          ? img.url.slice(0, 1024)
          : ASSETS.navyShirt;
      const record: ProductImageAsset = {
        id: (img.id || `img-${idx}`).slice(0, 80),
        url: safeUrl,
        viewType: img.viewType || 'Front View',
        isMain: Boolean(img.isMain),
        order: idx,
        alt: sanitizeText(img.alt || 'Fashion World product image').slice(0, 140),
      };
      if (img.storagePath) record.storagePath = img.storagePath.slice(0, 300);
      if (typeof img.sizeKb === 'number') record.sizeKb = Math.max(1, Math.round(img.sizeKb));
      if (typeof img.compressed === 'boolean') record.compressed = img.compressed;
      return record;
    });

  if (cleaned.length === 0) {
    return [
      {
        id: 'img-default',
        url: ASSETS.navyShirt,
        viewType: 'Front View',
        isMain: true,
        order: 0,
        alt: 'Default Fashion World studio image',
      },
    ];
  }
  if (!cleaned.some((i) => i.isMain)) {
    cleaned[0].isMain = true;
  }
  return cleaned;
}

function sanitizeVariantsForFirestore(variants: ProductVariant[]): ProductVariant[] {
  const list = variants.slice(0, 80).map((v, idx) => ({
    id: (v.id || `var-${idx}`).slice(0, 96),
    colour: sanitizeText(v.colour || 'Classic').slice(0, 60),
    colourHex: /^#[0-9A-Fa-f]{3,8}$/.test(v.colourHex || '') ? v.colourHex : '#1F1D2B',
    size: sanitizeText(v.size || 'M').slice(0, 24),
    sku: sanitizeText(v.sku || `SKU-${idx}`).toUpperCase().slice(0, 64),
    stockQuantity: Math.max(0, Math.min(100000, Math.floor(Number(v.stockQuantity) || 0))),
  }));

  if (list.length === 0) {
    return [
      {
        id: 'var-default',
        colour: 'Midnight Navy',
        colourHex: '#1F1D2B',
        size: 'M',
        sku: 'FW-DEFAULT-M',
        stockQuantity: 0,
      },
    ];
  }
  return list;
}

function sanitizeShowroomPlacement(
  productId: string,
  mapping: ProductShowroomMapping
): ProductShowroomMapping {
  const pos: [number, number, number] = [
    Number.isFinite(mapping.position?.[0]) ? mapping.position[0] : 0,
    Number.isFinite(mapping.position?.[1]) ? mapping.position[1] : 1.72,
    Number.isFinite(mapping.position?.[2]) ? mapping.position[2] : 0,
  ];
  const rot: [number, number, number] = [
    Number.isFinite(mapping.rotation?.[0]) ? mapping.rotation[0] : 0,
    Number.isFinite(mapping.rotation?.[1]) ? mapping.rotation[1] : 0,
    Number.isFinite(mapping.rotation?.[2]) ? mapping.rotation[2] : 0,
  ];

  return {
    enabled: Boolean(mapping.enabled),
    productId: productId.slice(0, 128),
    modelUrlPlaceholder: sanitizeText(mapping.modelUrlPlaceholder || 'procedural://garments/shirt').slice(0, 300),
    modelArchetype: mapping.modelArchetype || 'shirt',
    has3DModel: Boolean(mapping.has3DModel),
    showroomSection: mapping.showroomSection || 'men',
    rackId: sanitizeText(mapping.rackId || '').slice(0, 64),
    displaySlot: Math.max(0, Math.min(10, Math.floor(Number(mapping.displaySlot) || 0))),
    position: pos,
    rotation: rot,
    scale: Math.max(0.25, Math.min(3.0, Number(mapping.scale) || 1)),
  };
}

/**
 * Builds a strict Firestore-compliant product payload matching firebase-blueprint.json and firestore.rules.
 */
export function serializeProductForFirestore(product: CatalogProduct, isCreate: boolean) {
  const originalPrice = Math.max(1, Math.min(10000000, Math.round(Number(product.originalPrice) || 1)));
  const sellingPrice = Math.max(
    1,
    Math.min(originalPrice, Math.round(Number(product.sellingPrice) || originalPrice))
  );
  const rawSale = product.salePrice ? Math.round(Number(product.salePrice)) : 0;
  const salePrice = rawSale > 0 && rawSale < sellingPrice ? rawSale : 0;
  const effectivePrice = salePrice > 0 ? salePrice : sellingPrice;
  const discountPercentage = Math.min(
    95,
    Math.max(0, calculateDiscountPercentage(originalPrice, effectivePrice))
  );

  const safeId = product.id.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 128);
  const cleanName = sanitizeText(product.name).slice(0, 140) || 'Fashion World Garment';
  const cleanSlug = (slugify(product.slug || cleanName) || safeId).slice(0, 160);
  const cleanSku = (sanitizeText(product.sku).toUpperCase() || safeId.toUpperCase()).slice(0, 64);

  const basePayload = {
    id: safeId,
    name: cleanName,
    slug: cleanSlug,
    sku: cleanSku,
    description: sanitizeText(product.description || cleanName).slice(0, 4000),
    categoryId: sanitizeText(product.categoryId || 'cat-mens').slice(0, 128),
    subcategoryId: sanitizeText(product.subcategoryId || '').slice(0, 128),
    brand: sanitizeText(product.brand || 'Fashion World').slice(0, 80),
    originalPrice,
    sellingPrice,
    discountPercentage,
    salePrice,
    taxInfoPlaceholder: sanitizeText(
      product.taxInfoPlaceholder || 'Inclusive of all taxes'
    ).slice(0, 160),
    images: sanitizeImageAssetsForFirestore(product.images),
    variants: sanitizeVariantsForFirestore(product.variants),
    tags: (product.tags || [])
      .map((t) => sanitizeText(t).slice(0, 40))
      .filter(Boolean)
      .slice(0, 25),
    fabric: sanitizeText(product.fabric || 'Premium Cotton Blend').slice(0, 160),
    weight: sanitizeText(product.weight || '350g').slice(0, 60),
    featured: Boolean(product.featured),
    bestSeller: Boolean(product.bestSeller),
    newArrival: Boolean(product.newArrival),
    trending: Boolean(product.trending),
    discountCollection: Boolean(product.discountCollection),
    status: (['published', 'draft', 'archived'].includes(product.status)
      ? product.status
      : 'draft') as ProductVisibilityStatus,
    lowStockThreshold: Math.max(1, Math.min(500, Math.floor(Number(product.lowStockThreshold) || 10))),
    rating: Math.max(0, Math.min(5, Number(product.rating) || 4.8)),
    reviewCount: Math.max(0, Math.min(1000000, Math.floor(Number(product.reviewCount) || 0))),
    showroomPlacement: sanitizeShowroomPlacement(safeId, product.showroomMapping),
  };

  if (isCreate) {
    return {
      ...basePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }

  // On update, omit immutable `id` and `createdAt` from patch keys (Firestore updateDoc merges specified keys)
  const { id: _ignoreId, ...mutableFields } = basePayload;
  void _ignoreId;
  return {
    ...mutableFields,
    updatedAt: serverTimestamp(),
  };
}

export function deserializeProductFromFirestore(
  docId: string,
  data: Record<string, unknown>
): CatalogProduct {
  const placement = (data.showroomPlacement || data.showroomMapping || {}) as Partial<ProductShowroomMapping>;
  const saleNum = Number(data.salePrice || 0);

  return {
    id: String(data.id || docId),
    name: String(data.name || 'Untitled Garment'),
    slug: String(data.slug || docId),
    sku: String(data.sku || docId.toUpperCase()),
    description: String(data.description || ''),
    categoryId: String(data.categoryId || 'cat-mens'),
    subcategoryId: String(data.subcategoryId || ''),
    brand: String(data.brand || 'Fashion World'),
    originalPrice: Number(data.originalPrice || 0),
    sellingPrice: Number(data.sellingPrice || 0),
    discountPercentage: Number(data.discountPercentage || 0),
    salePrice: saleNum > 0 ? saleNum : undefined,
    taxInfoPlaceholder: String(data.taxInfoPlaceholder || 'Inclusive of all taxes'),
    images: Array.isArray(data.images) ? (data.images as ProductImageAsset[]) : [],
    variants: Array.isArray(data.variants) ? (data.variants as ProductVariant[]) : [],
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    fabric: String(data.fabric || ''),
    weight: String(data.weight || ''),
    featured: Boolean(data.featured),
    bestSeller: Boolean(data.bestSeller),
    newArrival: Boolean(data.newArrival),
    trending: Boolean(data.trending),
    discountCollection: Boolean(data.discountCollection),
    status: (['published', 'draft', 'archived'].includes(String(data.status))
      ? data.status
      : 'published') as ProductVisibilityStatus,
    lowStockThreshold: Number(data.lowStockThreshold || 10),
    rating: Number(data.rating || 4.8),
    reviewCount: Number(data.reviewCount || 0),
    showroomMapping: {
      enabled: Boolean(placement.enabled),
      productId: String(placement.productId || docId),
      modelUrlPlaceholder: String(placement.modelUrlPlaceholder || 'procedural://garments/shirt'),
      modelArchetype: (placement.modelArchetype || 'shirt') as ProductShowroomMapping['modelArchetype'],
      has3DModel: Boolean(placement.has3DModel ?? true),
      showroomSection: (placement.showroomSection || 'men') as ProductShowroomMapping['showroomSection'],
      rackId: String(placement.rackId || ''),
      displaySlot: Number(placement.displaySlot ?? 0),
      position: Array.isArray(placement.position) && placement.position.length === 3
        ? (placement.position as [number, number, number])
        : [0, 1.72, 0],
      rotation: Array.isArray(placement.rotation) && placement.rotation.length === 3
        ? (placement.rotation as [number, number, number])
        : [0, 0, 0],
      scale: Number(placement.scale || 1),
    },
    isDemoData: false,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function serializeCategoryForFirestore(category: CatalogCategory, isCreate: boolean) {
  const safeId = category.id.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 128);
  const safeImage =
    category.image && !category.image.startsWith('data:')
      ? category.image.slice(0, 1024)
      : ASSETS.navyShirt;

  const base = {
    id: safeId,
    name: sanitizeText(category.name).slice(0, 100) || 'Category',
    slug: (slugify(category.slug || category.name) || safeId).slice(0, 120),
    departmentKey: category.departmentKey || 'Custom',
    description: sanitizeText(category.description || '').slice(0, 500),
    image: safeImage,
    isCustom: Boolean(category.isCustom),
    status: (['published', 'draft', 'archived'].includes(String(category.status))
      ? category.status
      : 'published') as ProductVisibilityStatus,
    sortOrder: Math.max(0, Math.min(9999, Math.floor(Number(category.sortOrder ?? 0)))),
    subcategories: (category.subcategories || []).slice(0, 60).map((s) => ({
      id: s.id.slice(0, 128),
      categoryId: safeId,
      name: sanitizeText(s.name).slice(0, 80),
      slug: slugify(s.slug || s.name).slice(0, 100),
      isCustom: Boolean(s.isCustom),
    })),
  };

  if (isCreate) {
    return {
      ...base,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }
  const { id: _ignoreId, ...mutableFields } = base;
  void _ignoreId;
  return {
    ...mutableFields,
    updatedAt: serverTimestamp(),
  };
}

export function deserializeCategoryFromFirestore(
  docId: string,
  data: Record<string, unknown>
): CatalogCategory {
  return {
    id: String(data.id || docId),
    name: String(data.name || 'Category'),
    slug: String(data.slug || docId),
    departmentKey: (data.departmentKey || 'Custom') as CatalogCategory['departmentKey'],
    description: String(data.description || ''),
    image: String(data.image || ASSETS.navyShirt),
    status: (['published', 'draft', 'archived'].includes(String(data.status))
      ? data.status
      : 'published') as ProductVisibilityStatus,
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    isCustom: Boolean(data.isCustom),
    subcategories: Array.isArray(data.subcategories)
      ? (data.subcategories as CatalogCategory['subcategories'])
      : [],
  };
}

/* -------------------------------------------------------------------------- */
/* REAL-TIME ONSNAPSHOT SUBSCRIPTIONS                                         */
/* -------------------------------------------------------------------------- */

export function subscribeProducts(
  isAdmin: boolean,
  onData: (products: CatalogProduct[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db) return () => {};

  const productsRef = collection(db, COLLECTIONS.PRODUCTS);
  const q = isAdmin
    ? query(productsRef, limit(200))
    : query(productsRef, where('status', '==', 'published'), limit(120));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => deserializeProductFromFirestore(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.PRODUCTS);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeCategories(
  isAdmin: boolean,
  onData: (categories: CatalogCategory[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db) return () => {};

  const categoriesRef = collection(db, COLLECTIONS.CATEGORIES);
  const q = isAdmin
    ? query(categoriesRef, limit(100))
    : query(categoriesRef, where('status', '==', 'published'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => deserializeCategoryFromFirestore(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.CATEGORIES);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeStoreSettings(
  onData: (settings: StoreSettingsDoc | null) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!db) return () => {};
  const path = `${COLLECTIONS.SETTINGS}/storefront`;
  const ref = doc(db, COLLECTIONS.SETTINGS, 'storefront');

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      onData({
        id: snap.id,
        storeName: String(d.storeName || '3D Jummo Fashion World'),
        currencyCode: String(d.currencyCode || 'INR'),
        lowStockThreshold: Number(d.lowStockThreshold || 10),
        announcementText: String(d.announcementText || ''),
        showroomDefaultLighting: (d.showroomDefaultLighting || 'warm_luxury') as StoreSettingsDoc['showroomDefaultLighting'],
        updatedAt: timestampToIso(d.updatedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

/* -------------------------------------------------------------------------- */
/* ADMIN CRUD OPERATIONS (ALL PROTECTED BY FIRESTORE SECURITY RULES)          */
/* -------------------------------------------------------------------------- */

export async function createProductInFirestore(product: CatalogProduct): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.PRODUCTS}/${product.id}`;
  try {
    // Check SKU uniqueness against existing Firestore products
    const skuQuery = query(
      collection(db, COLLECTIONS.PRODUCTS),
      where('sku', '==', product.sku.toUpperCase()),
      limit(1)
    );
    const existingSku = await getDocs(skuQuery);
    if (!existingSku.empty && existingSku.docs[0].id !== product.id) {
      throw new Error(`A product with SKU "${product.sku}" already exists in Firestore.`);
    }

    const payload = serializeProductForFirestore(product, true);
    await setDoc(doc(db, COLLECTIONS.PRODUCTS, product.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProductInFirestore(product: CatalogProduct): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.PRODUCTS}/${product.id}`;
  try {
    const payload = serializeProductForFirestore(product, false);
    await updateDoc(doc(db, COLLECTIONS.PRODUCTS, product.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProductInFirestore(productId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.PRODUCTS}/${productId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function bulkUpdateProductStatusInFirestore(
  ids: string[],
  status: ProductVisibilityStatus
): Promise<void> {
  if (!db || ids.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.update(doc(db, COLLECTIONS.PRODUCTS, id), {
        status,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PRODUCTS);
  }
}

export async function bulkDeleteProductsInFirestore(ids: string[]): Promise<void> {
  if (!db || ids.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.delete(doc(db, COLLECTIONS.PRODUCTS, id));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.PRODUCTS);
  }
}

export async function updateProductVariantsInFirestore(
  productId: string,
  variants: ProductVariant[]
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.PRODUCTS}/${productId}`;
  try {
    await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), {
      variants: sanitizeVariantsForFirestore(variants),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCategoryInFirestore(category: CatalogCategory): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.CATEGORIES}/${category.id}`;
  try {
    const payload = serializeCategoryForFirestore(category, true);
    await setDoc(doc(db, COLLECTIONS.CATEGORIES, category.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCategoryInFirestore(category: CatalogCategory): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.CATEGORIES}/${category.id}`;
  try {
    const payload = serializeCategoryForFirestore(category, false);
    await updateDoc(doc(db, COLLECTIONS.CATEGORIES, category.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCategoryInFirestore(categoryId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.CATEGORIES}/${categoryId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function reorderCategoriesInFirestore(
  orderedIds: string[]
): Promise<void> {
  const firestoreDb = db;
  if (!firestoreDb || orderedIds.length === 0) return;
  try {
    const batch = writeBatch(firestoreDb);
    orderedIds.forEach((id, idx) => {
      batch.update(doc(firestoreDb, COLLECTIONS.CATEGORIES, id), {
        sortOrder: idx,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.CATEGORIES);
  }
}

export async function reassignProductsCategoryInFirestore(
  productIds: string[],
  targetCategoryId: string,
  targetSubcategoryId: string
): Promise<void> {
  if (!db || productIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of productIds) {
      batch.update(doc(db, COLLECTIONS.PRODUCTS, id), {
        categoryId: targetCategoryId,
        subcategoryId: targetSubcategoryId,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PRODUCTS);
  }
}

export async function saveStoreSettingsInFirestore(
  settings: Omit<StoreSettingsDoc, 'id' | 'updatedAt'>,
  isExisting: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const path = `${COLLECTIONS.SETTINGS}/storefront`;
  try {
    const ref = doc(db, COLLECTIONS.SETTINGS, 'storefront');
    const cleanPayload = {
      storeName: sanitizeText(settings.storeName || '3D Jummo Fashion World').slice(0, 120),
      currencyCode: sanitizeText(settings.currencyCode || 'INR').toUpperCase().slice(0, 8),
      lowStockThreshold: Math.max(1, Math.min(500, Math.floor(settings.lowStockThreshold || 10))),
      announcementText: sanitizeText(settings.announcementText || '').slice(0, 300),
      showroomDefaultLighting: settings.showroomDefaultLighting || 'warm_luxury',
    };
    if (isExisting) {
      await updateDoc(ref, {
        ...cleanPayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: 'storefront',
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/* -------------------------------------------------------------------------- */
/* SAFE LOCAL-TO-FIRESTORE MIGRATION (IDEMPOTENT, NO AUTO-DELETION)           */
/* -------------------------------------------------------------------------- */

export async function migrateLocalCatalogToFirestore(
  localCategories: CatalogCategory[],
  localProducts: CatalogProduct[]
): Promise<MigrationReport> {
  if (!db) {
    throw new Error('Cloud Firestore is not configured.');
  }

  const report: MigrationReport = {
    categoriesCreated: 0,
    categoriesSkipped: 0,
    productsCreated: 0,
    productsSkipped: 0,
    failed: [],
    completedAt: new Date().toISOString(),
  };

  // 1. Fetch existing category & product IDs/SKUs to prevent duplicates
  let existingCategoryIds = new Set<string>();
  let existingProductIds = new Set<string>();
  let existingProductSkus = new Set<string>();

  try {
    const [catSnap, prodSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.CATEGORIES), limit(200))),
      getDocs(query(collection(db, COLLECTIONS.PRODUCTS), limit(300))),
    ]);
    existingCategoryIds = new Set(catSnap.docs.map((d) => d.id));
    existingProductIds = new Set(prodSnap.docs.map((d) => d.id));
    existingProductSkus = new Set(
      prodSnap.docs.map((d) => String((d.data() as { sku?: string }).sku || '').toUpperCase())
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTIONS.PRODUCTS);
  }

  // 2. Migrate Categories first (preserving IDs & hierarchy)
  for (const cat of localCategories) {
    if (existingCategoryIds.has(cat.id)) {
      report.categoriesSkipped += 1;
      continue;
    }
    try {
      const payload = serializeCategoryForFirestore(cat, true);
      await setDoc(doc(db, COLLECTIONS.CATEGORIES, cat.id), payload);
      report.categoriesCreated += 1;
    } catch (error) {
      report.failed.push({
        entity: 'category',
        id: cat.id,
        name: cat.name,
        reason: error instanceof Error ? error.message : 'Write rejected',
      });
    }
  }

  // 3. Migrate Products preserving IDs and preventing SKU collisions
  for (const prod of localProducts) {
    const skuUpper = prod.sku.toUpperCase();
    if (existingProductIds.has(prod.id) || existingProductSkus.has(skuUpper)) {
      report.productsSkipped += 1;
      continue;
    }
    try {
      const payload = serializeProductForFirestore(prod, true);
      await setDoc(doc(db, COLLECTIONS.PRODUCTS, prod.id), payload);
      report.productsCreated += 1;
      existingProductSkus.add(skuUpper);
    } catch (error) {
      report.failed.push({
        entity: 'product',
        id: prod.id,
        name: prod.name,
        reason: error instanceof Error ? error.message : 'Write rejected',
      });
    }
  }

  report.completedAt = new Date().toISOString();
  return report;
}
