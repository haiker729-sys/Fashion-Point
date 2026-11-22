import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_SHOWROOM_RACKS,
  placeProductOnRack,
  type ShowroomRack,
} from '../data/showroomLayout';
import type { ShowroomProduct } from '../data/showroomProducts';
import { INITIAL_CATALOG_CATEGORIES, INITIAL_CATALOG_PRODUCTS } from '../data/catalogSeed';
import type {
  CatalogCategory,
  CatalogProduct,
  ProductVisibilityStatus,
  ResolvedCatalogProduct,
} from '../types/catalog';
import {
  calculateDiscountPercentage,
  resolveCatalogProduct,
  sanitizeText,
  slugify,
  toShowroomProduct,
} from '../utils/catalogHelpers';
import {
  isFirebaseConfigured,
  testFirestoreConnection,
  type ConnectionCheckResult,
} from '../firebase/firebaseConfig';
import {
  bulkDeleteProductsInFirestore,
  bulkUpdateProductStatusInFirestore,
  createCategoryInFirestore,
  createProductInFirestore,
  deleteCategoryInFirestore,
  deleteProductInFirestore,
  migrateLocalCatalogToFirestore,
  reassignProductsCategoryInFirestore,
  reorderCategoriesInFirestore,
  saveStoreSettingsInFirestore,
  subscribeCategories,
  subscribeProducts,
  subscribeStoreSettings,
  updateCategoryInFirestore,
  updateProductInFirestore,
  updateProductVariantsInFirestore,
  type MigrationReport,
  type StoreSettingsDoc,
} from '../firebase/firestore';
import { deleteImageFromFirebaseStorage } from '../firebase/storage';
import { formatFirebaseError } from '../firebase/firebaseErrors';
import { appendActivityLogApi } from '../services/adminApi';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/Overlays';

const STORAGE_KEY = 'fw_phase4_demo_catalog_v1';

interface StoredCatalogState {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  lowStockThreshold: number;
}

function loadLocalDemoCatalog(): StoredCatalogState {
  if (typeof window === 'undefined') {
    return {
      products: INITIAL_CATALOG_PRODUCTS,
      categories: INITIAL_CATALOG_CATEGORIES,
      lowStockThreshold: 10,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        products: INITIAL_CATALOG_PRODUCTS,
        categories: INITIAL_CATALOG_CATEGORIES,
        lowStockThreshold: 10,
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredCatalogState>;
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.categories)) {
      throw new Error('Invalid local catalog cache');
    }
    return {
      products: parsed.products,
      categories: parsed.categories,
      lowStockThreshold:
        typeof parsed.lowStockThreshold === 'number' && parsed.lowStockThreshold >= 1
          ? parsed.lowStockThreshold
          : 10,
    };
  } catch {
    return {
      products: INITIAL_CATALOG_PRODUCTS,
      categories: INITIAL_CATALOG_CATEGORIES,
      lowStockThreshold: 10,
    };
  }
}

export type ProductDraftInput = Omit<CatalogProduct, 'id' | 'createdAt' | 'updatedAt' | 'isDemoData'>;

export interface DatabaseMonitorState {
  connectionStatus: 'checking' | 'connected' | 'offline' | 'unconfigured';
  connectionCheck: ConnectionCheckResult | null;
  firestoreStatus: 'connecting' | 'live' | 'empty_cloud' | 'error' | 'offline';
  storageStatus: 'ready' | 'uploading' | 'error' | 'unconfigured';
  dataSource: 'firestore' | 'local_demo';
  lastSyncAt: string | null;
  lastError: string | null;
  pendingUploads: number;
  cloudProductCount: number;
  cloudCategoryCount: number;
  localDemoProductCount: number;
  localDemoCategoryCount: number;
  isMigrating: boolean;
  lastMigrationReport: MigrationReport | null;
}

interface CatalogContextValue {
  products: ResolvedCatalogProduct[];
  publishedProducts: ResolvedCatalogProduct[];
  categories: CatalogCategory[];
  lowStockThreshold: number;
  storeSettings: StoreSettingsDoc | null;
  loadingCatalog: boolean;
  monitor: DatabaseMonitorState;
  setLowStockThreshold: (threshold: number) => void;
  saveStoreSettings: (settings: Omit<StoreSettingsDoc, 'id' | 'updatedAt'>) => Promise<boolean>;
  getProductByIdOrSlug: (idOrSlug: string) => ResolvedCatalogProduct | undefined;
  addProduct: (input: ProductDraftInput) => ResolvedCatalogProduct;
  updateProduct: (id: string, input: ProductDraftInput) => void;
  deleteProduct: (id: string) => void;
  bulkUpdateStatus: (ids: string[], status: ProductVisibilityStatus) => void;
  bulkDeleteProducts: (ids: string[]) => void;
  updateVariantStock: (productId: string, variantId: string, nextStock: number) => void;
  addCategory: (input: {
    name: string;
    departmentKey: CatalogCategory['departmentKey'];
    description: string;
    image?: string;
    status?: ProductVisibilityStatus;
  }) => CatalogCategory | null;
  updateCategory: (
    categoryId: string,
    patch: Partial<Pick<CatalogCategory, 'name' | 'departmentKey' | 'description' | 'image' | 'status' | 'sortOrder'>>
  ) => void;
  reorderCategories: (orderedIds: string[]) => void;
  reassignProductsCategory: (
    fromCategoryId: string,
    toCategoryId: string,
    toSubcategoryId?: string
  ) => Promise<boolean>;
  deleteCategory: (categoryId: string) => void;
  addSubcategory: (categoryId: string, name: string) => void;
  deleteSubcategory: (categoryId: string, subcategoryId: string) => void;
  resetDemoCatalog: () => void;
  // Phase 5 Firebase Monitoring & Migration Tools
  refreshConnectionCheck: () => Promise<void>;
  exportLocalDemoBackup: () => void;
  runDemoToFirestoreMigration: () => Promise<MigrationReport | null>;
  reportPendingUploadDelta: (delta: number, hadError?: string | null) => void;
  // Phase 3 3D Showroom live integration bridge
  showroomRacks: ShowroomRack[];
  showroomProductsById: Record<string, ShowroomProduct>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToast } = useToast();
  const { user, isAdmin, isStaff, hasPermission, authReady } = useAuth();
  const canManageProducts = isAdmin || hasPermission('products:manage');
  const canManageCategories = isAdmin || hasPermission('categories:manage');
  const canAdjustInventory = isAdmin || hasPermission('inventory:adjust');

  // Local Phase 4 demo state (preserved intact for backup, migration, and empty-cloud fallback)
  const [localState, setLocalState] = useState<StoredCatalogState>(() => loadLocalDemoCatalog());

  // Live Cloud Firestore state
  const [cloudProducts, setCloudProducts] = useState<CatalogProduct[]>([]);
  const [cloudCategories, setCloudCategories] = useState<CatalogCategory[]>([]);
  const [cloudLoadedProducts, setCloudLoadedProducts] = useState(false);
  const [cloudLoadedCategories, setCloudLoadedCategories] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettingsDoc | null>(null);

  // Real Database Monitoring state (never faked)
  const [connectionStatus, setConnectionStatus] =
    useState<DatabaseMonitorState['connectionStatus']>(
      isFirebaseConfigured ? 'checking' : 'unconfigured'
    );
  const [connectionCheck, setConnectionCheck] = useState<ConnectionCheckResult | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [isMigrating, setIsMigrating] = useState(false);
  const [lastMigrationReport, setLastMigrationReport] = useState<MigrationReport | null>(null);

  // Keep local demo cache persisted (never auto-deleted during migration)
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
    } catch {
      // Ignore quota errors on local fallback storage
    }
  }, [localState]);

  const refreshConnectionCheck = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setConnectionStatus('unconfigured');
      return;
    }
    setConnectionStatus('checking');
    const result = await testFirestoreConnection();
    setConnectionCheck(result);
    setConnectionStatus(result.online ? 'connected' : 'offline');
    if (!result.online) {
      setFirestoreError(result.message);
    }
  }, []);

  // Run startup Firestore reachability verification
  useEffect(() => {
    void refreshConnectionCheck();
  }, [refreshConnectionCheck]);

  // Real-time Firestore onSnapshot listeners (re-binds cleanly when admin role changes)
  useEffect(() => {
    if (!isFirebaseConfigured || !authReady) {
      return;
    }

    const unsubProducts = subscribeProducts(
      isStaff,
      (items) => {
        setCloudProducts(items);
        setCloudLoadedProducts(true);
        setFirestoreError(null);
        setLastSyncAt(new Date().toISOString());
      },
      (err) => {
        const formatted = formatFirebaseError(err);
        setFirestoreError(formatted.message);
        setCloudLoadedProducts(true);
      }
    );

    const unsubCategories = subscribeCategories(
      isStaff,
      (items) => {
        setCloudCategories(items);
        setCloudLoadedCategories(true);
        setLastSyncAt(new Date().toISOString());
      },
      (err) => {
        const formatted = formatFirebaseError(err);
        setFirestoreError(formatted.message);
        setCloudLoadedCategories(true);
      }
    );

    const unsubSettings = subscribeStoreSettings(
      (settings) => {
        setStoreSettings(settings);
      },
      () => {
        // Settings doc may not exist yet before first admin save
      }
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSettings();
    };
  }, [isStaff, authReady]);

  // Use Cloud Firestore as the active source whenever Firestore holds data
  const useFirestoreProducts = isFirebaseConfigured && cloudProducts.length > 0;
  const useFirestoreCategories = isFirebaseConfigured && cloudCategories.length > 0;
  const activeRawProducts = useFirestoreProducts ? cloudProducts : localState.products;
  const activeCategories = useFirestoreCategories ? cloudCategories : localState.categories;
  const effectiveThreshold = storeSettings?.lowStockThreshold ?? localState.lowStockThreshold;

  const loadingCatalog =
    isFirebaseConfigured &&
    connectionStatus === 'checking' &&
    (!cloudLoadedProducts || !cloudLoadedCategories);

  const monitor = useMemo<DatabaseMonitorState>(() => {
    let firestoreStatus: DatabaseMonitorState['firestoreStatus'] = 'connecting';
    if (!isFirebaseConfigured || connectionStatus === 'offline') {
      firestoreStatus = 'offline';
    } else if (firestoreError) {
      firestoreStatus = 'error';
    } else if (cloudLoadedProducts && cloudLoadedCategories) {
      firestoreStatus =
        cloudProducts.length > 0 || cloudCategories.length > 0 ? 'live' : 'empty_cloud';
    }

    let storageStatus: DatabaseMonitorState['storageStatus'] = isFirebaseConfigured
      ? 'ready'
      : 'unconfigured';
    if (pendingUploads > 0) storageStatus = 'uploading';
    else if (storageError) storageStatus = 'error';

    return {
      connectionStatus,
      connectionCheck,
      firestoreStatus,
      storageStatus,
      dataSource: useFirestoreProducts ? 'firestore' : 'local_demo',
      lastSyncAt,
      lastError: firestoreError || storageError,
      pendingUploads,
      cloudProductCount: cloudProducts.length,
      cloudCategoryCount: cloudCategories.length,
      localDemoProductCount: localState.products.length,
      localDemoCategoryCount: localState.categories.length,
      isMigrating,
      lastMigrationReport,
    };
  }, [
    connectionStatus,
    connectionCheck,
    firestoreError,
    storageError,
    cloudLoadedProducts,
    cloudLoadedCategories,
    cloudProducts.length,
    cloudCategories.length,
    pendingUploads,
    useFirestoreProducts,
    lastSyncAt,
    localState.products.length,
    localState.categories.length,
    isMigrating,
    lastMigrationReport,
  ]);

  const products = useMemo<ResolvedCatalogProduct[]>(
    () =>
      activeRawProducts.map((p) =>
        resolveCatalogProduct(p, activeCategories, effectiveThreshold)
      ),
    [activeRawProducts, activeCategories, effectiveThreshold]
  );

  const publishedProducts = useMemo(
    () => products.filter((p) => p.status === 'published'),
    [products]
  );

  const getProductByIdOrSlug = useCallback(
    (idOrSlug: string) =>
      products.find((p) => p.id === idOrSlug || p.slug === idOrSlug),
    [products]
  );

  const reportPendingUploadDelta = useCallback(
    (delta: number, hadError?: string | null) => {
      setPendingUploads((prev) => Math.max(0, prev + delta));
      if (hadError !== undefined) {
        setStorageError(hadError);
      }
    },
    []
  );

  const setLowStockThreshold = useCallback(
    (threshold: number) => {
      const safe = Math.max(1, Math.min(500, Math.floor(threshold || 1)));
      setLocalState((prev) => ({ ...prev, lowStockThreshold: safe }));
      if (isFirebaseConfigured && isAdmin) {
        void saveStoreSettingsInFirestore(
          {
            storeName: storeSettings?.storeName || '3D Jummo Fashion World',
            currencyCode: storeSettings?.currencyCode || 'INR',
            lowStockThreshold: safe,
            announcementText:
              storeSettings?.announcementText ||
              'Complimentary Express Insured Delivery on Orders Above ₹999',
            showroomDefaultLighting: storeSettings?.showroomDefaultLighting || 'warm_luxury',
          },
          Boolean(storeSettings)
        ).catch((err) => {
          const formatted = formatFirebaseError(err);
          setFirestoreError(formatted.message);
        });
      }
    },
    [isAdmin, storeSettings]
  );

  const saveStoreSettings = useCallback(
    async (settings: Omit<StoreSettingsDoc, 'id' | 'updatedAt'>): Promise<boolean> => {
      if (!isFirebaseConfigured || !isAdmin) {
        addToast({
          type: 'error',
          title: 'Admin Sign-In Required',
          description: 'Sign in with an authorized Admin account to update Firestore settings.',
        });
        return false;
      }
      try {
        await saveStoreSettingsInFirestore(settings, Boolean(storeSettings));
        setLastSyncAt(new Date().toISOString());
        void appendActivityLogApi(user, {
          action: 'Store Settings Updated',
          entityType: 'settings',
          entityId: 'storefront',
          summary: `Updated store settings (Low-stock threshold: ${settings.lowStockThreshold}, Lighting: ${settings.showroomDefaultLighting})`,
        });
        addToast({
          type: 'success',
          title: 'Store Settings Synced',
          description: 'Saved global storefront configuration to Cloud Firestore.',
        });
        return true;
      } catch (err) {
        const formatted = formatFirebaseError(err);
        setFirestoreError(formatted.message);
        addToast({
          type: formatted.tone,
          title: formatted.title,
          description: formatted.message,
        });
        return false;
      }
    },
    [addToast, isAdmin, storeSettings, user]
  );

  const addProduct = useCallback(
    (input: ProductDraftInput): ResolvedCatalogProduct => {
      const now = new Date().toISOString();
      const id = `prod-${Date.now().toString(36)}`;
      const cleanName = sanitizeText(input.name);
      const cleanSku = sanitizeText(input.sku).toUpperCase();
      const cleanSlug = slugify(input.slug || cleanName) || id;
      const discountPercentage = calculateDiscountPercentage(
        input.originalPrice,
        input.salePrice && input.salePrice > 0 && input.salePrice < input.sellingPrice
          ? input.salePrice
          : input.sellingPrice
      );

      const newProduct: CatalogProduct = {
        ...input,
        id,
        name: cleanName,
        slug: cleanSlug,
        sku: cleanSku,
        description: sanitizeText(input.description),
        brand: sanitizeText(input.brand) || 'Fashion World',
        fabric: sanitizeText(input.fabric) || 'Premium Cotton Blend',
        weight: sanitizeText(input.weight) || '350g',
        discountPercentage,
        showroomMapping: {
          ...input.showroomMapping,
          productId: id,
        },
        isDemoData: !isFirebaseConfigured,
        createdAt: now,
        updatedAt: now,
      };

      if (isFirebaseConfigured && canManageProducts) {
        // Ensure core categories exist in Firestore when creating first cloud product
        void (async () => {
          try {
            if (cloudCategories.length === 0) {
              for (const cat of localState.categories) {
                await createCategoryInFirestore(cat).catch(() => {});
              }
            }
            await createProductInFirestore(newProduct);
            setLastSyncAt(new Date().toISOString());
            void appendActivityLogApi(user, {
              action: 'Product Created',
              entityType: 'product',
              entityId: id,
              summary: `Created product "${cleanName}" (SKU: ${cleanSku}) at ₹${input.sellingPrice}`,
            });
            addToast({
              type: 'success',
              title: 'Product Saved to Cloud Firestore',
              description: `${cleanName} (${cleanSku}) is now synced in real time.`,
            });
          } catch (err) {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          }
        })();
      } else {
        setLocalState((prev) => ({
          ...prev,
          products: [newProduct, ...prev.products],
        }));
        addToast({
          type: 'warning',
          title: 'Saved Locally Only',
          description: 'Sign in as an authorized Admin with active Firebase connection to write to Firestore.',
        });
      }

      return resolveCatalogProduct(newProduct, activeCategories, effectiveThreshold);
    },
    [
      activeCategories,
      addToast,
      cloudCategories.length,
      effectiveThreshold,
      isAdmin,
      localState.categories,
    ]
  );

  const updateProduct = useCallback(
    (id: string, input: ProductDraftInput) => {
      const now = new Date().toISOString();
      const existing = activeRawProducts.find((p) => p.id === id);
      const cleanName = sanitizeText(input.name);
      const cleanSku = sanitizeText(input.sku).toUpperCase();
      const discountPercentage = calculateDiscountPercentage(
        input.originalPrice,
        input.salePrice && input.salePrice > 0 && input.salePrice < input.sellingPrice
          ? input.salePrice
          : input.sellingPrice
      );

      const updated: CatalogProduct = {
        ...(existing || ({} as CatalogProduct)),
        ...input,
        id,
        name: cleanName,
        slug: slugify(input.slug || cleanName) || existing?.slug || id,
        sku: cleanSku,
        description: sanitizeText(input.description),
        brand: sanitizeText(input.brand) || existing?.brand || 'Fashion World',
        fabric: sanitizeText(input.fabric),
        weight: sanitizeText(input.weight),
        discountPercentage,
        showroomMapping: {
          ...input.showroomMapping,
          productId: id,
        },
        isDemoData: !useFirestoreProducts,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      if (isFirebaseConfigured && canManageProducts && useFirestoreProducts) {
        void updateProductInFirestore(updated)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            void appendActivityLogApi(user, {
              action: 'Product Updated',
              entityType: 'product',
              entityId: id,
              summary: `Updated product "${cleanName}" (SKU: ${cleanSku}, status: ${updated.status}, price: ₹${updated.sellingPrice})`,
            });
            addToast({
              type: 'success',
              title: 'Product Updated in Firestore',
              description: `Saved real-time changes to ${cleanName} (${cleanSku}).`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else if (isFirebaseConfigured && canManageProducts && !useFirestoreProducts) {
        // Product exists only in local demo so far — promote it to Firestore cleanly
        void createProductInFirestore(updated)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            addToast({
              type: 'success',
              title: 'Product Synced to Firestore',
              description: `Saved ${cleanName} to Cloud Firestore.`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        setLocalState((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === id ? updated : p)),
        }));
        addToast({
          type: 'warning',
          title: 'Updated Local Cache Only',
          description: 'Admin Firebase authentication is required to persist to Cloud Firestore.',
        });
      }
    },
    [activeRawProducts, addToast, isAdmin, useFirestoreProducts]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      const existing = activeRawProducts.find((p) => p.id === id);

      if (isFirebaseConfigured && canManageProducts && useFirestoreProducts) {
        void (async () => {
          try {
            await deleteProductInFirestore(id);
            // Also clean up any Firebase Storage images owned by this product
            if (existing) {
              for (const img of existing.images) {
                if (img.storagePath) {
                  await deleteImageFromFirebaseStorage(img.storagePath).catch(() => {});
                }
              }
            }
            setLastSyncAt(new Date().toISOString());
            void appendActivityLogApi(user, {
              action: 'Product Deleted',
              entityType: 'product',
              entityId: id,
              summary: `Deleted product "${existing?.name || id}" (SKU: ${existing?.sku || 'N/A'})`,
            });
            addToast({
              type: 'warning',
              title: 'Product Deleted from Firestore',
              description: existing
                ? `${existing.name} was permanently removed from Cloud Firestore.`
                : 'Product deleted.',
            });
          } catch (err) {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          }
        })();
      } else {
        setLocalState((prev) => ({
          ...prev,
          products: prev.products.filter((p) => p.id !== id),
        }));
        addToast({
          type: 'warning',
          title: 'Product Deleted (Local Demo)',
          description: existing ? `${existing.name} removed from local demo data.` : 'Removed.',
        });
      }
    },
    [activeRawProducts, addToast, isAdmin, useFirestoreProducts]
  );

  const bulkUpdateStatus = useCallback(
    (ids: string[], status: ProductVisibilityStatus) => {
      if (ids.length === 0) return;

      if (isFirebaseConfigured && isAdmin && useFirestoreProducts) {
        void bulkUpdateProductStatusInFirestore(ids, status)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            addToast({
              type: 'success',
              title: 'Bulk Status Synced to Firestore',
              description: `${ids.length} product${ids.length > 1 ? 's' : ''} marked as ${status}.`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        const idSet = new Set(ids);
        const now = new Date().toISOString();
        setLocalState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            idSet.has(p.id) ? { ...p, status, updatedAt: now } : p
          ),
        }));
        addToast({
          type: 'success',
          title: 'Bulk Status Updated (Local Demo)',
          description: `${ids.length} product${ids.length > 1 ? 's' : ''} marked as ${status}.`,
        });
      }
    },
    [addToast, isAdmin, useFirestoreProducts]
  );

  const bulkDeleteProducts = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      if (isFirebaseConfigured && isAdmin && useFirestoreProducts) {
        void bulkDeleteProductsInFirestore(ids)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            addToast({
              type: 'warning',
              title: 'Products Deleted from Firestore',
              description: `Removed ${ids.length} selected product${ids.length > 1 ? 's' : ''}.`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        const idSet = new Set(ids);
        setLocalState((prev) => ({
          ...prev,
          products: prev.products.filter((p) => !idSet.has(p.id)),
        }));
        addToast({
          type: 'warning',
          title: 'Products Deleted (Local Demo)',
          description: `Removed ${ids.length} selected product${ids.length > 1 ? 's' : ''}.`,
        });
      }
    },
    [addToast, isAdmin, useFirestoreProducts]
  );

  const updateVariantStock = useCallback(
    (productId: string, variantId: string, nextStock: number) => {
      const safeQty = Math.max(0, Math.floor(Number.isFinite(nextStock) ? nextStock : 0));
      const target = activeRawProducts.find((p) => p.id === productId);
      if (!target) return;

      const updatedVariants = target.variants.map((v) =>
        v.id === variantId ? { ...v, stockQuantity: safeQty } : v
      );

      if (isFirebaseConfigured && canAdjustInventory && useFirestoreProducts) {
        void updateProductVariantsInFirestore(productId, updatedVariants)
          .then(() => setLastSyncAt(new Date().toISOString()))
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        const now = new Date().toISOString();
        setLocalState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId ? { ...p, variants: updatedVariants, updatedAt: now } : p
          ),
        }));
      }
    },
    [activeRawProducts, addToast, canAdjustInventory, useFirestoreProducts]
  );

  const addCategory = useCallback(
    (input: {
      name: string;
      departmentKey: CatalogCategory['departmentKey'];
      description: string;
      image?: string;
      status?: ProductVisibilityStatus;
    }): CatalogCategory | null => {
      const cleanName = sanitizeText(input.name);
      if (!cleanName) return null;
      const slug = slugify(cleanName);
      if (activeCategories.some((c) => c.slug === slug)) {
        addToast({
          type: 'error',
          title: 'Category Already Exists',
          description: `A category named "${cleanName}" already exists.`,
        });
        return null;
      }

      const newCat: CatalogCategory = {
        id: `cat-${Date.now().toString(36)}`,
        name: cleanName,
        slug,
        departmentKey: input.departmentKey,
        description: sanitizeText(input.description) || 'Custom fashion collection category.',
        image: input.image || INITIAL_CATALOG_CATEGORIES[0].image,
        status: input.status || 'published',
        sortOrder: activeCategories.length,
        isCustom: true,
        subcategories: [],
      };

      if (isFirebaseConfigured && canManageCategories) {
        void createCategoryInFirestore(newCat)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            void appendActivityLogApi(user, {
              action: 'Category Updated',
              entityType: 'category',
              entityId: newCat.id,
              summary: `Created category "${cleanName}" (${input.departmentKey})`,
            });
            addToast({
              type: 'success',
              title: 'Category Created in Firestore',
              description: `"${cleanName}" is now synced in real time.`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        setLocalState((prev) => ({
          ...prev,
          categories: [...prev.categories, newCat],
        }));
        addToast({
          type: 'success',
          title: 'Category Created (Local Demo)',
          description: `"${cleanName}" added to local demo hierarchy.`,
        });
      }
      return newCat;
    },
    [activeCategories, addToast, canManageCategories, user]
  );

  const updateCategory = useCallback(
    (
      categoryId: string,
      patch: Partial<
        Pick<
          CatalogCategory,
          'name' | 'departmentKey' | 'description' | 'image' | 'status' | 'sortOrder'
        >
      >
    ) => {
      const existing = activeCategories.find((c) => c.id === categoryId);
      if (!existing) return;
      const nextName = patch.name !== undefined ? sanitizeText(patch.name) : existing.name;
      const updatedCat: CatalogCategory = {
        ...existing,
        ...patch,
        name: nextName || existing.name,
        slug: patch.name ? slugify(nextName) || existing.slug : existing.slug,
        description:
          patch.description !== undefined
            ? sanitizeText(patch.description)
            : existing.description,
      };

      if (isFirebaseConfigured && canManageCategories && useFirestoreCategories) {
        void updateCategoryInFirestore(updatedCat)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            void appendActivityLogApi(user, {
              action: 'Category Updated',
              entityType: 'category',
              entityId: categoryId,
              summary: `Updated category "${updatedCat.name}" (visibility: ${updatedCat.status || 'published'})`,
            });
            addToast({
              type: 'success',
              title: 'Category Updated',
              description: `Saved changes to "${updatedCat.name}".`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        setLocalState((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => (c.id === categoryId ? updatedCat : c)),
        }));
        addToast({
          type: 'success',
          title: 'Category Updated',
          description: `Saved changes to "${updatedCat.name}".`,
        });
      }
    },
    [activeCategories, addToast, canManageCategories, useFirestoreCategories, user]
  );

  const reorderCategories = useCallback(
    (orderedIds: string[]) => {
      if (orderedIds.length === 0) return;
      if (isFirebaseConfigured && canManageCategories && useFirestoreCategories) {
        void reorderCategoriesInFirestore(orderedIds)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            void appendActivityLogApi(user, {
              action: 'Category Updated',
              entityType: 'category',
              entityId: orderedIds[0],
              summary: `Reordered ${orderedIds.length} storefront categories`,
            });
            addToast({
              type: 'success',
              title: 'Category Order Saved',
              description: 'Updated category display order in Cloud Firestore.',
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        const orderIndex = new Map(orderedIds.map((id, idx) => [id, idx]));
        setLocalState((prev) => ({
          ...prev,
          categories: [...prev.categories]
            .map((c) => ({ ...c, sortOrder: orderIndex.get(c.id) ?? c.sortOrder ?? 99 }))
            .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)),
        }));
      }
    },
    [addToast, canManageCategories, useFirestoreCategories, user]
  );

  const reassignProductsCategory = useCallback(
    async (
      fromCategoryId: string,
      toCategoryId: string,
      toSubcategoryId?: string
    ): Promise<boolean> => {
      if (fromCategoryId === toCategoryId) return false;
      const targetCat = activeCategories.find((c) => c.id === toCategoryId);
      if (!targetCat) return false;
      const nextSubId = toSubcategoryId || targetCat.subcategories[0]?.id || '';
      const affectedIds = activeRawProducts
        .filter((p) => p.categoryId === fromCategoryId)
        .map((p) => p.id);
      if (affectedIds.length === 0) return true;

      if (isFirebaseConfigured && canManageCategories && useFirestoreProducts) {
        try {
          await reassignProductsCategoryInFirestore(affectedIds, toCategoryId, nextSubId);
          setLastSyncAt(new Date().toISOString());
          void appendActivityLogApi(user, {
            action: 'Category Updated',
            entityType: 'category',
            entityId: fromCategoryId,
            summary: `Reassigned ${affectedIds.length} product(s) to "${targetCat.name}"`,
          });
          addToast({
            type: 'success',
            title: 'Products Reassigned',
            description: `Moved ${affectedIds.length} product(s) to "${targetCat.name}".`,
          });
          return true;
        } catch (err) {
          const formatted = formatFirebaseError(err);
          addToast({
            type: formatted.tone,
            title: formatted.title,
            description: formatted.message,
          });
          return false;
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.categoryId === fromCategoryId
              ? { ...p, categoryId: toCategoryId, subcategoryId: nextSubId }
              : p
          ),
        }));
        return true;
      }
    },
    [activeCategories, activeRawProducts, addToast, canManageCategories, useFirestoreProducts, user]
  );

  const deleteCategory = useCallback(
    (categoryId: string) => {
      const target = activeCategories.find((c) => c.id === categoryId);
      if (!target) return;
      const inUseCount = activeRawProducts.filter((p) => p.categoryId === categoryId).length;
      if (inUseCount > 0) {
        addToast({
          type: 'error',
          title: 'Cannot Delete Category',
          description: `${inUseCount} product(s) are assigned to "${target.name}". Reassign them first.`,
        });
        return;
      }

      if (isFirebaseConfigured && isAdmin && useFirestoreCategories) {
        void deleteCategoryInFirestore(categoryId)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            addToast({
              type: 'warning',
              title: 'Category Deleted from Firestore',
              description: `"${target.name}" was removed.`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        setLocalState((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => c.id !== categoryId),
        }));
        addToast({
          type: 'warning',
          title: 'Category Deleted (Local Demo)',
          description: `"${target.name}" was removed.`,
        });
      }
    },
    [activeCategories, activeRawProducts, addToast, isAdmin, useFirestoreCategories]
  );

  const addSubcategory = useCallback(
    (categoryId: string, name: string) => {
      const cleanName = sanitizeText(name);
      if (!cleanName) return;
      const cat = activeCategories.find((c) => c.id === categoryId);
      if (!cat) return;
      const slug = slugify(cleanName);
      if (cat.subcategories.some((s) => s.slug === slug)) {
        addToast({
          type: 'error',
          title: 'Duplicate Subcategory',
          description: `"${cleanName}" already exists in ${cat.name}.`,
        });
        return;
      }

      const updatedCat: CatalogCategory = {
        ...cat,
        subcategories: [
          ...cat.subcategories,
          {
            id: `sub-${Date.now().toString(36)}`,
            categoryId,
            name: cleanName,
            slug,
            isCustom: true,
          },
        ],
      };

      if (isFirebaseConfigured && isAdmin && useFirestoreCategories) {
        void updateCategoryInFirestore(updatedCat)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            addToast({
              type: 'success',
              title: 'Subcategory Saved to Firestore',
              description: `Added "${cleanName}" under ${cat.name}.`,
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        setLocalState((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => (c.id === categoryId ? updatedCat : c)),
        }));
        addToast({
          type: 'success',
          title: 'Subcategory Added (Local Demo)',
          description: `Added "${cleanName}" under ${cat.name}.`,
        });
      }
    },
    [activeCategories, addToast, isAdmin, useFirestoreCategories]
  );

  const deleteSubcategory = useCallback(
    (categoryId: string, subcategoryId: string) => {
      const inUse = activeRawProducts.filter((p) => p.subcategoryId === subcategoryId).length;
      if (inUse > 0) {
        addToast({
          type: 'error',
          title: 'Subcategory In Use',
          description: `${inUse} product(s) currently use this subcategory.`,
        });
        return;
      }
      const cat = activeCategories.find((c) => c.id === categoryId);
      if (!cat) return;
      const updatedCat: CatalogCategory = {
        ...cat,
        subcategories: cat.subcategories.filter((s) => s.id !== subcategoryId),
      };

      if (isFirebaseConfigured && isAdmin && useFirestoreCategories) {
        void updateCategoryInFirestore(updatedCat)
          .then(() => {
            setLastSyncAt(new Date().toISOString());
            addToast({
              type: 'warning',
              title: 'Subcategory Removed from Firestore',
              description: 'Subcategory deleted from live catalog hierarchy.',
            });
          })
          .catch((err) => {
            const formatted = formatFirebaseError(err);
            setFirestoreError(formatted.message);
            addToast({
              type: formatted.tone,
              title: formatted.title,
              description: formatted.message,
            });
          });
      } else {
        setLocalState((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => (c.id === categoryId ? updatedCat : c)),
        }));
        addToast({
          type: 'warning',
          title: 'Subcategory Removed',
          description: 'Subcategory was deleted from local demo hierarchy.',
        });
      }
    },
    [activeCategories, activeRawProducts, addToast, isAdmin, useFirestoreCategories]
  );

  const resetDemoCatalog = useCallback(() => {
    setLocalState({
      products: INITIAL_CATALOG_PRODUCTS,
      categories: INITIAL_CATALOG_CATEGORIES,
      lowStockThreshold: 10,
    });
    addToast({
      type: 'info',
      title: 'Local Demo Cache Restored',
      description: 'Restored default Phase 4 local demo products and categories without affecting Firestore.',
    });
  }, [addToast]);

  const exportLocalDemoBackup = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: '3D Jummo Fashion World — Phase 4 Local Demo Catalog',
      lowStockThreshold: localState.lowStockThreshold,
      categoriesCount: localState.categories.length,
      productsCount: localState.products.length,
      categories: localState.categories,
      products: localState.products,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fashion-world-demo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'Backup Downloaded',
      description: `Exported ${localState.categories.length} categories & ${localState.products.length} products as JSON.`,
    });
  }, [addToast, localState]);

  const runDemoToFirestoreMigration = useCallback(async (): Promise<MigrationReport | null> => {
    if (!isFirebaseConfigured || !isAdmin) {
      addToast({
        type: 'error',
        title: 'Admin Authorization Required',
        description: 'Sign in with a verified Admin account to migrate local demo data to Cloud Firestore.',
      });
      return null;
    }

    setIsMigrating(true);
    setFirestoreError(null);
    try {
      const report = await migrateLocalCatalogToFirestore(
        localState.categories,
        localState.products
      );
      setLastMigrationReport(report);
      setLastSyncAt(new Date().toISOString());

      const hasFailures = report.failed.length > 0;
      addToast({
        type: hasFailures ? 'warning' : 'success',
        title: hasFailures ? 'Migration Completed with Warnings' : 'Migration Completed Successfully',
        description: `Imported ${report.categoriesCreated} categories & ${report.productsCreated} products (${report.categoriesSkipped + report.productsSkipped} skipped duplicates, ${report.failed.length} failed). Local backup preserved.`,
      });
      return report;
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setFirestoreError(formatted.message);
      addToast({
        type: formatted.tone,
        title: formatted.title,
        description: formatted.message,
      });
      return null;
    } finally {
      setIsMigrating(false);
    }
  }, [addToast, isAdmin, localState.categories, localState.products]);

  // Phase 3 3D Showroom Live Bridge: maps published catalog products (Firestore or local demo) onto 3D racks
  const showroomProductsById = useMemo<Record<string, ShowroomProduct>>(() => {
    const map: Record<string, ShowroomProduct> = {};
    for (const p of products) {
      map[p.id] = toShowroomProduct(p);
    }
    return map;
  }, [products]);

  const showroomRacks = useMemo<ShowroomRack[]>(() => {
    let racks = INITIAL_SHOWROOM_RACKS.map((r) => ({
      ...r,
      slots: r.slots.map((s) => ({ ...s })),
    }));
    const publishedIds = new Set(publishedProducts.map((p) => p.id));

    racks = racks.map((r) => ({
      ...r,
      slots: r.slots.map((s) =>
        s.productId && !publishedIds.has(s.productId)
          ? { ...s, productId: null, displayStatus: 'empty' as const }
          : s
      ),
    }));

    for (const prod of publishedProducts) {
      const m = prod.showroomMapping;
      if (!m.enabled || !m.rackId) continue;
      const slotIdx = Math.max(0, Math.min(2, m.displaySlot));
      racks = placeProductOnRack(racks, m.rackId, slotIdx, prod.id);
    }

    return racks;
  }, [publishedProducts]);

  return (
    <CatalogContext.Provider
      value={{
        products,
        publishedProducts,
        categories: activeCategories,
        lowStockThreshold: effectiveThreshold,
        storeSettings,
        loadingCatalog,
        monitor,
        setLowStockThreshold,
        saveStoreSettings,
        getProductByIdOrSlug,
        addProduct,
        updateProduct,
        deleteProduct,
        bulkUpdateStatus,
        bulkDeleteProducts,
        updateVariantStock,
        addCategory,
        updateCategory,
        reorderCategories,
        reassignProductsCategory,
        deleteCategory,
        addSubcategory,
        deleteSubcategory,
        resetDemoCatalog,
        refreshConnectionCheck,
        exportLocalDemoBackup,
        runDemoToFirestoreMigration,
        reportPendingUploadDelta,
        showroomRacks,
        showroomProductsById,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error('useCatalog must be used inside CatalogProvider');
  }
  return ctx;
};
