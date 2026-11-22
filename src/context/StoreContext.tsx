import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS, type Product } from '../data/catalog';
import { useToast } from '../components/ui/Overlays';
import { useAuth } from './AuthContext';
import { useCatalog } from './CatalogContext';
import type { ResolvedCatalogProduct } from '../types/catalog';
import {
  type CartItemDoc,
  type CheckoutPriceBreakdown,
  type CouponDoc,
  type DeliveryAddressInput,
  type DeliveryMethod,
  type OrderDoc,
  type PaymentMethod,
  type SavedAddressDoc,
} from '../types/commerce';
import {
  buildCartItemId,
  calculateCheckoutTotals,
  findMatchingVariant,
  getTrustedUnitPrice,
  normalizeCouponCode,
  validateCouponRecord,
} from '../utils/commerceHelpers';
import {
  clearUserCartInFirestore,
  deleteCartItemFromFirestore,
  deleteSavedForLaterItem,
  deleteUserAddressInFirestore,
  fetchCouponByCode,
  mergeGuestCartIntoFirestore,
  moveCartItemToSavedForLater,
  moveSavedItemToCart,
  placeOrderWithTransaction,
  saveUserAddressInFirestore,
  setDefaultAddressInFirestore,
  subscribeCustomerOrders,
  subscribeSavedForLater,
  subscribeUserAddresses,
  subscribeUserCart,
  updateCartItemQtyInFirestore,
  upsertCartItemInFirestore,
} from '../firebase/commerce';

const GUEST_CART_STORAGE_KEY = 'fw_phase6_guest_cart_v1';
const GUEST_SAVED_STORAGE_KEY = 'fw_phase6_guest_saved_v1';
const WISHLIST_STORAGE_KEY = 'fw_phase6_wishlist_v1';

export interface CartEntry {
  key: string;
  productId: string;
  sku: string;
  product: Product;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  availableStock: number;
  isPublished: boolean;
  priceChangedFromSnapshot: boolean;
  rawDoc: CartItemDoc;
}

interface StoreContextValue {
  cart: CartEntry[];
  savedForLater: CartEntry[];
  totalCartItems: number;
  cartSubtotal: number;
  cartSummary: CheckoutPriceBreakdown;
  cartLoading: boolean;
  cartError: string | null;
  isCloudCart: boolean;
  wishlistIds: string[];
  quickViewProduct: Product | null;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  openQuickView: (product: Product) => void;
  closeQuickView: () => void;
  toggleWishlist: (product: Product) => void;
  addToCart: (product: Product, size: string, color: string, quantity?: number) => Promise<boolean>;
  updateCartQuantity: (key: string, delta: number) => Promise<void>;
  setCartQuantity: (key: string, nextQuantity: number) => Promise<void>;
  removeFromCart: (key: string) => Promise<void>;
  clearCart: () => Promise<void>;
  saveForLater: (key: string) => Promise<void>;
  moveToCart: (key: string) => Promise<void>;
  removeSavedItem: (key: string) => Promise<void>;
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  appliedCoupon: CouponDoc | null;
  couponError: string | null;
  couponLoading: boolean;
  applyCouponCode: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  addresses: SavedAddressDoc[];
  addressesLoading: boolean;
  saveAddress: (
    input: DeliveryAddressInput,
    options?: { addressId?: string; isDefault?: boolean }
  ) => Promise<SavedAddressDoc>;
  deleteAddress: (addressId: string) => Promise<void>;
  setDefaultAddress: (addressId: string) => Promise<void>;
  orders: OrderDoc[];
  ordersLoading: boolean;
  ordersError: string | null;
  placeOrder: (params: {
    deliveryAddress: DeliveryAddressInput;
    deliveryMethod: DeliveryMethod;
    paymentMethod: PaymentMethod;
    idempotencyKey: string;
  }) => Promise<OrderDoc>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function readLocalItems(storageKey: string): CartItemDoc[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItemDoc[]) : [];
  } catch {
    return [];
  }
}

function writeLocalItems(storageKey: string, items: CartItemDoc[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

function readLocalWishlist(): string[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return ['prod-1', 'prod-2'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function buildFallbackProductFromDoc(doc: CartItemDoc): Product {
  return {
    id: doc.productId,
    name: doc.productName,
    category: 'Men',
    subcategory: 'Fashion',
    originalPrice: doc.priceSnapshot,
    discountedPrice: doc.priceSnapshot,
    discountPercent: 0,
    rating: 4.8,
    reviewCount: 0,
    sku: doc.sku,
    showroomZone: 'Online Boutique',
    image: doc.productImage || ASSETS.navyShirt,
    colors: [{ name: doc.selectedColour, hex: '#1F1D2B' }],
    sizes: [doc.selectedSize],
    stockStatus: 'out_of_stock',
    stockCount: 0,
    description: doc.productName,
  };
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToast } = useToast();
  const { user, isFirebaseConfigured: firebaseConfigured } = useAuth();
  const { products: catalogProducts } = useCatalog();

  const [wishlistIds, setWishlistIds] = useState<string[]>(() => readLocalWishlist());
  const [guestCartDocs, setGuestCartDocs] = useState<CartItemDoc[]>(() =>
    readLocalItems(GUEST_CART_STORAGE_KEY)
  );
  const [guestSavedDocs, setGuestSavedDocs] = useState<CartItemDoc[]>(() =>
    readLocalItems(GUEST_SAVED_STORAGE_KEY)
  );

  const [cloudCartDocs, setCloudCartDocs] = useState<CartItemDoc[]>([]);
  const [cloudSavedDocs, setCloudSavedDocs] = useState<CartItemDoc[]>([]);
  const [cartLoading, setCartLoading] = useState<boolean>(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<SavedAddressDoc[]>([]);
  const [addressesLoading, setAddressesLoading] = useState<boolean>(false);

  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('standard');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponDoc | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState<boolean>(false);

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const mergedForUidRef = useRef<string | null>(null);

  const isCloudCart = Boolean(firebaseConfigured && user?.uid);

  const catalogById = useMemo(() => {
    const map = new Map<string, ResolvedCatalogProduct>();
    for (const p of catalogProducts) {
      map.set(p.id, p);
    }
    return map;
  }, [catalogProducts]);

  // Persist wishlist locally
  useEffect(() => {
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch {
      // ignore
    }
  }, [wishlistIds]);

  // Persist guest cart & saved items locally when signed out
  useEffect(() => {
    writeLocalItems(GUEST_CART_STORAGE_KEY, guestCartDocs);
  }, [guestCartDocs]);

  useEffect(() => {
    writeLocalItems(GUEST_SAVED_STORAGE_KEY, guestSavedDocs);
  }, [guestSavedDocs]);

  // Subscribe to real-time Firestore Cart, Saved-for-Later, Addresses, and Customer Orders when signed in
  useEffect(() => {
    if (!firebaseConfigured || !user?.uid) {
      setCloudCartDocs([]);
      setCloudSavedDocs([]);
      setAddresses([]);
      setOrders([]);
      setCartLoading(false);
      setCartError(null);
      setAddressesLoading(false);
      setOrdersLoading(false);
      setOrdersError(null);
      mergedForUidRef.current = null;
      return;
    }

    const uid = user.uid;
    setCartLoading(true);
    setCartError(null);
    setAddressesLoading(true);
    setOrdersLoading(true);
    setOrdersError(null);

    const unsubCart = subscribeUserCart(
      uid,
      (docs) => {
        setCloudCartDocs(docs);
        setCartLoading(false);
        setCartError(null);
      },
      (err) => {
        setCartError(err instanceof Error ? err.message : 'Unable to sync shopping cart.');
        setCartLoading(false);
      }
    );

    const unsubSaved = subscribeSavedForLater(
      uid,
      (docs) => {
        setCloudSavedDocs(docs);
      },
      () => {
        // Non-blocking
      }
    );

    const unsubAddresses = subscribeUserAddresses(
      uid,
      (list) => {
        setAddresses(list);
        setAddressesLoading(false);
      },
      () => {
        setAddressesLoading(false);
      }
    );

    const unsubOrders = subscribeCustomerOrders(
      uid,
      (list) => {
        setOrders(list);
        setOrdersLoading(false);
        setOrdersError(null);
      },
      (err) => {
        setOrdersError(err instanceof Error ? err.message : 'Unable to load order history.');
        setOrdersLoading(false);
      }
    );

    return () => {
      unsubCart();
      unsubSaved();
      unsubAddresses();
      unsubOrders();
    };
  }, [firebaseConfigured, user?.uid]);

  // Auto-merge guest cart into Firestore once when a customer signs in
  useEffect(() => {
    if (!firebaseConfigured || !user?.uid) return;
    if (mergedForUidRef.current === user.uid) return;
    mergedForUidRef.current = user.uid;

    const pendingGuest = readLocalItems(GUEST_CART_STORAGE_KEY);
    if (pendingGuest.length === 0) return;

    const inputs = pendingGuest.map((item) => {
      const resolved = catalogById.get(item.productId);
      const variant = resolved
        ? findMatchingVariant(resolved.variants, item.selectedSize, item.selectedColour)
        : undefined;
      return {
        productId: item.productId,
        productName: resolved?.name || item.productName,
        productImage: resolved?.mainImage || item.productImage,
        sku: variant?.sku || resolved?.sku || item.sku,
        selectedSize: item.selectedSize,
        selectedColour: item.selectedColour,
        quantityToAdd: item.quantity,
        priceSnapshot: resolved ? getTrustedUnitPrice(resolved) : item.priceSnapshot,
        maxStock: variant ? Math.max(1, variant.stockQuantity) : 10,
      };
    });

    void mergeGuestCartIntoFirestore(user.uid, inputs).then(() => {
      setGuestCartDocs([]);
      writeLocalItems(GUEST_CART_STORAGE_KEY, []);
      addToast({
        type: 'info',
        title: 'Shopping Bag Synced',
        description: 'Your guest bag items were saved to your cloud account.',
      });
    });
  }, [firebaseConfigured, user?.uid, catalogById, addToast]);

  // Resolve raw CartItemDocs against live CatalogContext (never trusting browser price snapshots!)
  const resolveCartEntries = useCallback(
    (docs: CartItemDoc[]): CartEntry[] => {
      return docs.map((doc) => {
        const liveProduct = catalogById.get(doc.productId);
        if (!liveProduct) {
          return {
            key: doc.id,
            productId: doc.productId,
            sku: doc.sku,
            product: buildFallbackProductFromDoc(doc),
            size: doc.selectedSize,
            color: doc.selectedColour,
            quantity: doc.quantity,
            unitPrice: doc.priceSnapshot,
            originalPrice: doc.priceSnapshot,
            availableStock: 0,
            isPublished: false,
            priceChangedFromSnapshot: false,
            rawDoc: doc,
          };
        }

        const matchedVariant = findMatchingVariant(
          liveProduct.variants,
          doc.selectedSize,
          doc.selectedColour
        );
        const unitPrice = getTrustedUnitPrice(liveProduct);
        const availableStock = matchedVariant ? matchedVariant.stockQuantity : 0;

        return {
          key: doc.id,
          productId: liveProduct.id,
          sku: matchedVariant?.sku || liveProduct.sku,
          product: liveProduct.legacyProduct,
          size: doc.selectedSize,
          color: doc.selectedColour,
          quantity: doc.quantity,
          unitPrice,
          originalPrice: Math.max(unitPrice, Math.round(liveProduct.originalPrice)),
          availableStock,
          isPublished: liveProduct.status === 'published',
          priceChangedFromSnapshot: Math.round(doc.priceSnapshot) !== unitPrice,
          rawDoc: doc,
        };
      });
    },
    [catalogById]
  );

  const activeRawCart = isCloudCart ? cloudCartDocs : guestCartDocs;
  const activeRawSaved = isCloudCart ? cloudSavedDocs : guestSavedDocs;

  const cart = useMemo(() => resolveCartEntries(activeRawCart), [activeRawCart, resolveCartEntries]);
  const savedForLater = useMemo(
    () => resolveCartEntries(activeRawSaved),
    [activeRawSaved, resolveCartEntries]
  );

  // Re-validate applied coupon whenever subtotal changes
  const rawSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0),
    [cart]
  );

  useEffect(() => {
    if (!appliedCoupon) return;
    if (rawSubtotal === 0) {
      setAppliedCoupon(null);
      setCouponError(null);
      return;
    }
    const check = validateCouponRecord(appliedCoupon, rawSubtotal);
    if (!check.valid) {
      setCouponError(check.message);
    } else {
      setCouponError(null);
    }
  }, [appliedCoupon, rawSubtotal]);

  const cartSummary = useMemo(
    () =>
      calculateCheckoutTotals({
        items: cart.map((item) => ({
          unitPrice: item.unitPrice,
          originalPrice: item.originalPrice,
          quantity: item.quantity,
        })),
        deliveryMethod,
        coupon: appliedCoupon,
      }),
    [cart, deliveryMethod, appliedCoupon]
  );

  const totalCartItems = cartSummary.totalItems;
  const cartSubtotal = cartSummary.subtotal;

  const toggleWishlist = useCallback(
    (product: Product) => {
      setWishlistIds((prev) => {
        const exists = prev.includes(product.id);
        if (exists) {
          addToast({
            type: 'info',
            title: 'Removed from Wishlist',
            description: product.name,
          });
          return prev.filter((id) => id !== product.id);
        }
        addToast({
          type: 'success',
          title: 'Saved to Wishlist',
          description: product.name,
        });
        return [...prev, product.id];
      });
    },
    [addToast]
  );

  const addToCart = useCallback(
    async (
      product: Product,
      size: string,
      color: string,
      quantity: number = 1
    ): Promise<boolean> => {
      const requestedQty = Math.max(1, Math.min(50, Math.floor(quantity || 1)));
      const liveProduct = catalogById.get(product.id);
      const matchedVariant = liveProduct
        ? findMatchingVariant(liveProduct.variants, size, color)
        : undefined;

      const availableStock = liveProduct
        ? matchedVariant?.stockQuantity ?? 0
        : product.stockStatus === 'out_of_stock'
          ? 0
          : Math.max(1, product.stockCount || 10);

      if (availableStock <= 0) {
        addToast({
          type: 'error',
          title: 'Variant Out of Stock',
          description: `${product.name} (${size} · ${color}) is currently out of stock.`,
        });
        return false;
      }

      const itemId = buildCartItemId(product.id, size, color);
      const unitPrice = liveProduct
        ? getTrustedUnitPrice(liveProduct)
        : Math.max(1, Math.round(product.discountedPrice));
      const sku = matchedVariant?.sku || liveProduct?.sku || product.id.toUpperCase();
      const image = liveProduct?.mainImage || product.image || ASSETS.navyShirt;

      if (isCloudCart && user?.uid) {
        try {
          const result = await upsertCartItemInFirestore(user.uid, {
            productId: product.id,
            productName: liveProduct?.name || product.name,
            productImage: image,
            sku,
            selectedSize: size,
            selectedColour: color,
            quantityToAdd: requestedQty,
            priceSnapshot: unitPrice,
            maxStock: availableStock,
          });
          addToast({
            type: result.capped ? 'warning' : 'success',
            title: result.capped ? 'Maximum Available Stock Added' : 'Added to Shopping Bag',
            description: result.capped
              ? `Quantity capped at available stock (${result.finalQuantity}) for ${product.name} (${size} · ${color}).`
              : `${product.name} (${size} · ${color}) × ${requestedQty} synced to your bag.`,
          });
          return true;
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Could Not Add to Bag',
            description: err instanceof Error ? err.message : 'Please try again.',
          });
          return false;
        }
      }

      // Guest local preview cart
      const nowIso = new Date().toISOString();
      let capped = false;
      let finalQuantity = requestedQty;

      setGuestCartDocs((prev) => {
        const existing = prev.find((i) => i.id === itemId);
        if (existing) {
          const desired = existing.quantity + requestedQty;
          finalQuantity = Math.min(availableStock, 50, desired);
          capped = desired > finalQuantity;
          return prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  quantity: finalQuantity,
                  priceSnapshot: unitPrice,
                  sku,
                  updatedAt: nowIso,
                }
              : i
          );
        }
        finalQuantity = Math.min(availableStock, 50, requestedQty);
        capped = requestedQty > finalQuantity;
        const nextDoc: CartItemDoc = {
          id: itemId,
          productId: product.id,
          productName: liveProduct?.name || product.name,
          productImage: image,
          sku,
          selectedSize: size,
          selectedColour: color,
          quantity: finalQuantity,
          priceSnapshot: unitPrice,
          addedAt: nowIso,
          updatedAt: nowIso,
        };
        return [nextDoc, ...prev];
      });

      addToast({
        type: capped ? 'warning' : 'success',
        title: capped ? 'Maximum Available Stock Added' : 'Added to Shopping Bag',
        description: capped
          ? `Quantity capped at available stock (${finalQuantity}) for ${product.name} (${size} · ${color}).`
          : `${product.name} (${size} · ${color}) added to your bag.`,
      });
      return true;
    },
    [catalogById, isCloudCart, user?.uid, addToast]
  );

  const setCartQuantity = useCallback(
    async (key: string, nextQuantity: number) => {
      const entry = cart.find((c) => c.key === key);
      if (!entry) return;

      const requested = Math.floor(nextQuantity);
      if (requested <= 0) {
        if (isCloudCart && user?.uid) {
          await deleteCartItemFromFirestore(user.uid, key);
        } else {
          setGuestCartDocs((prev) => prev.filter((i) => i.id !== key));
        }
        return;
      }

      const maxAllowed = Math.max(1, Math.min(50, entry.availableStock || 0));
      if (entry.availableStock <= 0) {
        addToast({
          type: 'error',
          title: 'Out of Stock',
          description: `${entry.product.name} (${entry.size} · ${entry.color}) is currently out of stock.`,
        });
        return;
      }

      const clamped = Math.min(maxAllowed, requested);
      if (requested > maxAllowed) {
        addToast({
          type: 'warning',
          title: 'Stock Limit Reached',
          description: `Only ${entry.availableStock} unit(s) available for ${entry.product.name} (${entry.size} · ${entry.color}).`,
        });
      }

      if (isCloudCart && user?.uid) {
        try {
          await updateCartItemQtyInFirestore(user.uid, key, clamped, entry.unitPrice);
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Update Failed',
            description: err instanceof Error ? err.message : 'Unable to update quantity.',
          });
        }
      } else {
        setGuestCartDocs((prev) =>
          prev.map((i) =>
            i.id === key
              ? { ...i, quantity: clamped, priceSnapshot: entry.unitPrice, updatedAt: new Date().toISOString() }
              : i
          )
        );
      }
    },
    [cart, isCloudCart, user?.uid, addToast]
  );

  const updateCartQuantity = useCallback(
    async (key: string, delta: number) => {
      const entry = cart.find((c) => c.key === key);
      if (!entry) return;
      await setCartQuantity(key, entry.quantity + delta);
    },
    [cart, setCartQuantity]
  );

  const removeFromCart = useCallback(
    async (key: string) => {
      if (isCloudCart && user?.uid) {
        try {
          await deleteCartItemFromFirestore(user.uid, key);
          addToast({
            type: 'info',
            title: 'Item Removed',
            description: 'Removed from your shopping bag.',
          });
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Remove Failed',
            description: err instanceof Error ? err.message : 'Unable to remove item.',
          });
        }
      } else {
        setGuestCartDocs((prev) => prev.filter((i) => i.id !== key));
        addToast({
          type: 'info',
          title: 'Item Removed',
          description: 'Removed from your shopping bag.',
        });
      }
    },
    [isCloudCart, user?.uid, addToast]
  );

  const clearCart = useCallback(async () => {
    if (isCloudCart && user?.uid) {
      try {
        await clearUserCartInFirestore(
          user.uid,
          cloudCartDocs.map((d) => d.id)
        );
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Clear Failed',
          description: err instanceof Error ? err.message : 'Unable to clear shopping bag.',
        });
        return;
      }
    } else {
      setGuestCartDocs([]);
    }
    setAppliedCoupon(null);
    setCouponError(null);
    addToast({
      type: 'warning',
      title: 'Shopping Bag Cleared',
      description: 'All items were removed from your bag.',
    });
  }, [isCloudCart, user?.uid, cloudCartDocs, addToast]);

  const saveForLater = useCallback(
    async (key: string) => {
      const entry = cart.find((c) => c.key === key);
      if (!entry) return;

      if (isCloudCart && user?.uid) {
        try {
          await moveCartItemToSavedForLater(user.uid, {
            ...entry.rawDoc,
            priceSnapshot: entry.unitPrice,
          });
          addToast({
            type: 'info',
            title: 'Saved for Later',
            description: `${entry.product.name} moved to Saved for Later.`,
          });
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Save Failed',
            description: err instanceof Error ? err.message : 'Unable to save item.',
          });
        }
      } else {
        setGuestCartDocs((prev) => prev.filter((i) => i.id !== key));
        setGuestSavedDocs((prev) => [
          entry.rawDoc,
          ...prev.filter((i) => i.id !== key),
        ]);
        addToast({
          type: 'info',
          title: 'Saved for Later',
          description: `${entry.product.name} moved to Saved for Later.`,
        });
      }
    },
    [cart, isCloudCart, user?.uid, addToast]
  );

  const moveToCart = useCallback(
    async (key: string) => {
      const entry = savedForLater.find((s) => s.key === key);
      if (!entry) return;
      if (entry.availableStock <= 0) {
        addToast({
          type: 'error',
          title: 'Variant Out of Stock',
          description: `${entry.product.name} (${entry.size} · ${entry.color}) is currently out of stock.`,
        });
        return;
      }

      if (isCloudCart && user?.uid) {
        try {
          await moveSavedItemToCart(
            user.uid,
            { ...entry.rawDoc, priceSnapshot: entry.unitPrice },
            entry.availableStock
          );
          addToast({
            type: 'success',
            title: 'Moved to Shopping Bag',
            description: `${entry.product.name} is back in your bag.`,
          });
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Move Failed',
            description: err instanceof Error ? err.message : 'Unable to move item to bag.',
          });
        }
      } else {
        setGuestSavedDocs((prev) => prev.filter((i) => i.id !== key));
        setGuestCartDocs((prev) => [
          { ...entry.rawDoc, quantity: Math.min(entry.quantity, entry.availableStock) },
          ...prev.filter((i) => i.id !== key),
        ]);
        addToast({
          type: 'success',
          title: 'Moved to Shopping Bag',
          description: `${entry.product.name} is back in your bag.`,
        });
      }
    },
    [savedForLater, isCloudCart, user?.uid, addToast]
  );

  const removeSavedItem = useCallback(
    async (key: string) => {
      if (isCloudCart && user?.uid) {
        try {
          await deleteSavedForLaterItem(user.uid, key);
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Remove Failed',
            description: err instanceof Error ? err.message : 'Unable to remove saved item.',
          });
        }
      } else {
        setGuestSavedDocs((prev) => prev.filter((i) => i.id !== key));
      }
    },
    [isCloudCart, user?.uid, addToast]
  );

  const applyCouponCode = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = normalizeCouponCode(rawCode);
      if (code.length < 3) {
        setCouponError('Please enter a valid coupon code (minimum 3 characters).');
        return false;
      }
      if (!user?.uid) {
        setCouponError('Please sign in to validate and apply Firestore coupon codes.');
        return false;
      }
      if (cartSubtotal <= 0) {
        setCouponError('Add products to your cart before applying a coupon.');
        return false;
      }

      setCouponLoading(true);
      setCouponError(null);
      try {
        const coupon = await fetchCouponByCode(code);
        const result = validateCouponRecord(coupon, cartSubtotal);
        if (!result.valid || !result.coupon) {
          setAppliedCoupon(null);
          setCouponError(result.message);
          return false;
        }
        setAppliedCoupon(result.coupon);
        setCouponError(null);
        addToast({
          type: 'success',
          title: 'Coupon Applied',
          description: result.message,
        });
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to verify coupon right now.';
        setCouponError(message);
        return false;
      } finally {
        setCouponLoading(false);
      }
    },
    [user?.uid, cartSubtotal, addToast]
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, []);

  const saveAddress = useCallback(
    async (
      input: DeliveryAddressInput,
      options?: { addressId?: string; isDefault?: boolean }
    ): Promise<SavedAddressDoc> => {
      if (!user?.uid) {
        throw new Error('Please sign in to save delivery addresses.');
      }
      const saved = await saveUserAddressInFirestore(user.uid, input, {
        addressId: options?.addressId,
        isDefault: options?.isDefault ?? addresses.length === 0,
        existingAddressIds: addresses.map((a) => a.id),
      });
      addToast({
        type: 'success',
        title: options?.addressId ? 'Address Updated' : 'Address Saved',
        description: `${saved.city}, ${saved.state} (${saved.pinCode})`,
      });
      return saved;
    },
    [user?.uid, addresses, addToast]
  );

  const deleteAddress = useCallback(
    async (addressId: string) => {
      if (!user?.uid) return;
      await deleteUserAddressInFirestore(user.uid, addressId);
      addToast({
        type: 'info',
        title: 'Address Deleted',
        description: 'Removed from your saved delivery addresses.',
      });
    },
    [user?.uid, addToast]
  );

  const setDefaultAddress = useCallback(
    async (addressId: string) => {
      if (!user?.uid) return;
      await setDefaultAddressInFirestore(
        user.uid,
        addressId,
        addresses.map((a) => a.id)
      );
      addToast({
        type: 'success',
        title: 'Default Address Updated',
        description: 'This address will be pre-selected at checkout.',
      });
    },
    [user?.uid, addresses, addToast]
  );

  const placeOrder = useCallback(
    async (params: {
      deliveryAddress: DeliveryAddressInput;
      deliveryMethod: DeliveryMethod;
      paymentMethod: PaymentMethod;
      idempotencyKey: string;
    }): Promise<OrderDoc> => {
      if (!user?.uid) {
        throw new Error('Please sign in to place your order.');
      }
      if (cloudCartDocs.length === 0) {
        throw new Error('Your cloud shopping cart is empty.');
      }

      const validCouponCode =
        appliedCoupon && validateCouponRecord(appliedCoupon, cartSubtotal).valid
          ? appliedCoupon.code
          : '';

      const order = await placeOrderWithTransaction({
        uid: user.uid,
        cartItems: cloudCartDocs,
        deliveryAddress: params.deliveryAddress,
        deliveryMethod: params.deliveryMethod,
        paymentMethod: params.paymentMethod,
        couponCode: validCouponCode,
        idempotencyKey: params.idempotencyKey,
      });

      setAppliedCoupon(null);
      setCouponError(null);
      return order;
    },
    [user?.uid, cloudCartDocs, appliedCoupon, cartSubtotal]
  );

  return (
    <StoreContext.Provider
      value={{
        cart,
        savedForLater,
        totalCartItems,
        cartSubtotal,
        cartSummary,
        cartLoading,
        cartError,
        isCloudCart,
        wishlistIds,
        quickViewProduct,
        cartDrawerOpen,
        setCartDrawerOpen,
        openQuickView: setQuickViewProduct,
        closeQuickView: () => setQuickViewProduct(null),
        toggleWishlist,
        addToCart,
        updateCartQuantity,
        setCartQuantity,
        removeFromCart,
        clearCart,
        saveForLater,
        moveToCart,
        removeSavedItem,
        deliveryMethod,
        setDeliveryMethod,
        appliedCoupon,
        couponError,
        couponLoading,
        applyCouponCode,
        removeCoupon,
        addresses,
        addressesLoading,
        saveAddress,
        deleteAddress,
        setDefaultAddress,
        orders,
        ordersLoading,
        ordersError,
        placeOrder,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return ctx;
};
