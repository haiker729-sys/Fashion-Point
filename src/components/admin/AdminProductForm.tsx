import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { ASSETS } from '../../data/catalog';
import { INITIAL_SHOWROOM_RACKS } from '../../data/showroomLayout';
import type { GarmentArchetype } from '../../data/showroomProducts';
import { SHOWROOM_SECTIONS, type ShowroomSectionId } from '../../data/showroomSections';
import { useCatalog, type ProductDraftInput } from '../../context/CatalogContext';
import {
  STANDARD_CLOTHING_SIZES,
  type ProductImageAsset,
  type ProductVariant,
  type ProductVisibilityStatus,
  type ResolvedCatalogProduct,
} from '../../types/catalog';
import {
  calculateDiscountPercentage,
  calculateTotalStock,
  computeStockStatus,
  formatINR,
  sanitizeText,
  slugify,
} from '../../utils/catalogHelpers';
import { Button, InputField, ProductBadge } from '../ui/Primitives';
import { ProductImageManager } from './ProductImageManager';

interface AdminProductFormProps {
  existingProduct?: ResolvedCatalogProduct | null;
  onCancel: () => void;
  onSaved: (productId: string) => void;
}

const GARMENT_ARCHETYPES: Array<{ value: GarmentArchetype; label: string }> = [
  { value: 'shirt', label: 'Tailored Shirt (3D Mesh)' },
  { value: 'tshirt', label: 'Supima T-Shirt (3D Mesh)' },
  { value: 'jeans', label: 'Selvedge Jeans (3D Mesh)' },
  { value: 'blazer', label: 'Italian Blazer (3D Mesh)' },
  { value: 'coat', label: 'Trench Coat (3D Mesh)' },
  { value: 'saree', label: 'Silk Saree (3D Mesh)' },
  { value: 'kurti', label: 'Artisan Kurti (3D Mesh)' },
  { value: 'sherwani', label: 'Bandhgala Sherwani (3D Mesh)' },
  { value: 'kids-jacket', label: 'Kids Quilted Bomber (3D Mesh)' },
];

export const AdminProductForm: React.FC<AdminProductFormProps> = ({
  existingProduct,
  onCancel,
  onSaved,
}) => {
  const { categories, lowStockThreshold, addProduct, updateProduct } = useCatalog();
  const isEditing = Boolean(existingProduct);

  const defaultCategory = categories[0];
  const [name, setName] = useState(existingProduct?.name || '');
  const [sku, setSku] = useState(
    existingProduct?.sku || `FW-${Math.floor(100 + Math.random() * 899)}`
  );
  const [slug, setSlug] = useState(existingProduct?.slug || '');
  const [description, setDescription] = useState(existingProduct?.description || '');
  const [categoryId, setCategoryId] = useState(
    existingProduct?.categoryId || defaultCategory?.id || 'cat-mens'
  );
  const [subcategoryId, setSubcategoryId] = useState(
    existingProduct?.subcategoryId || defaultCategory?.subcategories[0]?.id || ''
  );
  const [brand, setBrand] = useState(existingProduct?.brand || 'Jummo Atelier');

  const [originalPrice, setOriginalPrice] = useState<string>(
    String(existingProduct?.originalPrice ?? 2999)
  );
  const [sellingPrice, setSellingPrice] = useState<string>(
    String(existingProduct?.sellingPrice ?? 1999)
  );
  const [salePrice, setSalePrice] = useState<string>(
    existingProduct?.salePrice ? String(existingProduct.salePrice) : ''
  );
  const [taxInfoPlaceholder, setTaxInfoPlaceholder] = useState(
    existingProduct?.taxInfoPlaceholder || 'Inclusive of 12% GST (Placeholder)'
  );

  const [weight, setWeight] = useState(existingProduct?.weight || '340g');
  const [fabric, setFabric] = useState(existingProduct?.fabric || '100% Combed Cotton');
  const [tagsInput, setTagsInput] = useState(
    existingProduct?.tags.join(', ') || 'New Season, Tailored'
  );
  const [status, setStatus] = useState<ProductVisibilityStatus>(
    existingProduct?.status || 'published'
  );
  const [productLowStockThreshold, setProductLowStockThreshold] = useState<string>(
    String(existingProduct?.lowStockThreshold ?? lowStockThreshold)
  );

  const [featured, setFeatured] = useState(Boolean(existingProduct?.featured));
  const [bestSeller, setBestSeller] = useState(Boolean(existingProduct?.bestSeller));
  const [newArrival, setNewArrival] = useState(existingProduct?.newArrival ?? true);
  const [trending, setTrending] = useState(Boolean(existingProduct?.trending));
  const [discountCollection, setDiscountCollection] = useState(
    Boolean(existingProduct?.discountCollection)
  );

  const [images, setImages] = useState<ProductImageAsset[]>(
    existingProduct?.images || [
      {
        id: 'img-default-1',
        url: ASSETS.navyShirt,
        viewType: 'Front View',
        isMain: true,
        order: 0,
        alt: 'Default studio product view',
      },
    ]
  );

  // Colour & Size Variant Builder State
  const [variants, setVariants] = useState<ProductVariant[]>(
    existingProduct?.variants || [
      {
        id: 'var-init-1',
        colour: 'Midnight Navy',
        colourHex: '#1B2845',
        size: 'M',
        sku: `${sku}-MID-M`,
        stockQuantity: 10,
      },
      {
        id: 'var-init-2',
        colour: 'Midnight Navy',
        colourHex: '#1B2845',
        size: 'L',
        sku: `${sku}-MID-L`,
        stockQuantity: 15,
      },
      {
        id: 'var-init-3',
        colour: 'Midnight Navy',
        colourHex: '#1B2845',
        size: 'XL',
        sku: `${sku}-MID-XL`,
        stockQuantity: 8,
      },
    ]
  );

  const [newColourName, setNewColourName] = useState('');
  const [newColourHex, setNewColourHex] = useState('#1F1D2B');
  const [selectedSizesForAdd, setSelectedSizesForAdd] = useState<string[]>(['M', 'L', 'XL']);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [defaultVariantStock, setDefaultVariantStock] = useState('10');

  // Phase 3 Showroom Mapping State
  const [showroomEnabled, setShowroomEnabled] = useState(
    existingProduct?.showroomMapping.enabled ?? true
  );
  const [has3DModel, setHas3DModel] = useState(
    existingProduct?.showroomMapping.has3DModel ?? true
  );
  const [modelUrlPlaceholder, setModelUrlPlaceholder] = useState(
    existingProduct?.showroomMapping.modelUrlPlaceholder || 'procedural://garments/shirt'
  );
  const [modelArchetype, setModelArchetype] = useState<GarmentArchetype>(
    existingProduct?.showroomMapping.modelArchetype || 'shirt'
  );
  const [showroomSection, setShowroomSection] = useState<ShowroomSectionId>(
    existingProduct?.showroomMapping.showroomSection || 'men'
  );
  const [rackId, setRackId] = useState(
    existingProduct?.showroomMapping.rackId || INITIAL_SHOWROOM_RACKS[0].rackId
  );
  const [displaySlot, setDisplaySlot] = useState<number>(
    existingProduct?.showroomMapping.displaySlot ?? 1
  );
  const [posX, setPosX] = useState<string>(
    String(existingProduct?.showroomMapping.position[0] ?? 0)
  );
  const [posY, setPosY] = useState<string>(
    String(existingProduct?.showroomMapping.position[1] ?? 1.72)
  );
  const [posZ, setPosZ] = useState<string>(
    String(existingProduct?.showroomMapping.position[2] ?? 0)
  );
  const [rotY, setRotY] = useState<string>(
    String(existingProduct?.showroomMapping.rotation[1] ?? 0)
  );
  const [modelScale, setModelScale] = useState<string>(
    String(existingProduct?.showroomMapping.scale ?? 1)
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formBanner, setFormBanner] = useState<{
    tone: 'error' | 'warning' | 'success';
    message: string;
  } | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) || categories[0],
    [categories, categoryId]
  );

  const parsedOriginal = Number(originalPrice);
  const parsedSelling = Number(sellingPrice);
  const parsedSale = salePrice.trim() ? Number(salePrice) : undefined;
  const effectivePrice =
    parsedSale !== undefined && Number.isFinite(parsedSale) && parsedSale > 0 && parsedSale < parsedSelling
      ? parsedSale
      : parsedSelling;
  const computedDiscount = calculateDiscountPercentage(parsedOriginal, effectivePrice);
  const totalStock = calculateTotalStock(variants);
  const thresholdNum = Math.max(1, Number(productLowStockThreshold) || lowStockThreshold);
  const stockStatus = computeStockStatus(totalStock, thresholdNum);

  const handleCategoryChange = (nextCatId: string) => {
    setCategoryId(nextCatId);
    const cat = categories.find((c) => c.id === nextCatId);
    setSubcategoryId(cat?.subcategories[0]?.id || '');
  };

  const toggleSizeSelection = (size: string) => {
    setSelectedSizesForAdd((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const addCustomSizeChip = () => {
    const clean = sanitizeText(customSizeInput).toUpperCase();
    if (!clean) return;
    if (!selectedSizesForAdd.includes(clean)) {
      setSelectedSizesForAdd((prev) => [...prev, clean]);
    }
    setCustomSizeInput('');
  };

  const addColourVariants = () => {
    const cleanColour = sanitizeText(newColourName);
    if (!cleanColour) {
      setFormBanner({
        tone: 'warning',
        message: 'Enter a colour name (for example "Royal Blue" or "Jet Black") before generating variants.',
      });
      return;
    }
    if (selectedSizesForAdd.length === 0) {
      setFormBanner({
        tone: 'warning',
        message: 'Select at least one size (XS–XXXL or custom) to generate variants.',
      });
      return;
    }

    const baseQty = Math.max(0, Math.floor(Number(defaultVariantStock) || 0));
    const colorCode = cleanColour.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CLR';
    const baseSkuClean = (sanitizeText(sku) || 'FW-NEW').toUpperCase();

    const additions: ProductVariant[] = [];
    for (const size of selectedSizesForAdd) {
      const exists = variants.some(
        (v) =>
          v.colour.toLowerCase() === cleanColour.toLowerCase() &&
          v.size.toLowerCase() === size.toLowerCase()
      );
      if (exists) continue;
      additions.push({
        id: `var-${Date.now().toString(36)}-${colorCode}-${size}-${Math.random().toString(36).slice(2, 5)}`,
        colour: cleanColour,
        colourHex: newColourHex,
        size,
        sku: `${baseSkuClean}-${colorCode}-${size.replace(/\s+/g, '')}`,
        stockQuantity: baseQty,
      });
    }

    if (additions.length === 0) {
      setFormBanner({
        tone: 'warning',
        message: `All selected sizes for "${cleanColour}" already exist in the variant matrix.`,
      });
      return;
    }

    setVariants((prev) => [...prev, ...additions]);
    setNewColourName('');
    setFormBanner({
      tone: 'success',
      message: `Added ${additions.length} variant combination${additions.length > 1 ? 's' : ''} for ${cleanColour}.`,
    });
  };

  const updateVariantRow = (
    variantId: string,
    patch: Partial<Pick<ProductVariant, 'stockQuantity' | 'sku'>>
  ) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              ...patch,
              stockQuantity:
                patch.stockQuantity !== undefined
                  ? Math.max(0, Math.floor(Number.isFinite(patch.stockQuantity) ? patch.stockQuantity : 0))
                  : v.stockQuantity,
            }
          : v
      )
    );
  };

  const removeVariantRow = (variantId: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== variantId));
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!sanitizeText(name)) nextErrors.name = 'Product Name is required.';
    if (!sanitizeText(sku)) nextErrors.sku = 'Product SKU is required.';
    if (!sanitizeText(description) || sanitizeText(description).length < 10) {
      nextErrors.description = 'Enter a descriptive summary (at least 10 characters).';
    }
    if (!categoryId) nextErrors.categoryId = 'Select a main category.';
    if (!sanitizeText(brand)) nextErrors.brand = 'Brand name is required.';

    if (!Number.isFinite(parsedOriginal) || parsedOriginal <= 0) {
      nextErrors.originalPrice = 'Original price must be a positive number in ₹.';
    }
    if (!Number.isFinite(parsedSelling) || parsedSelling <= 0) {
      nextErrors.sellingPrice = 'Selling price must be a positive number in ₹.';
    }
    if (
      Number.isFinite(parsedOriginal) &&
      Number.isFinite(parsedSelling) &&
      parsedSelling > parsedOriginal
    ) {
      nextErrors.sellingPrice = 'Selling price cannot exceed Original Price.';
    }
    if (
      parsedSale !== undefined &&
      (!Number.isFinite(parsedSale) || parsedSale < 0 || parsedSale >= parsedSelling)
    ) {
      nextErrors.salePrice = 'Optional Sale Price must be positive and lower than Selling Price.';
    }

    if (images.length === 0) {
      nextErrors.images = 'Upload or pick at least one product image.';
    }
    if (variants.length === 0) {
      nextErrors.variants = 'Add at least one Colour × Size variant with stock quantity.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormBanner({
        tone: 'error',
        message: 'Please fix the highlighted validation errors before saving.',
      });
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => sanitizeText(t))
      .filter(Boolean);

    const payload: ProductDraftInput = {
      name: sanitizeText(name),
      slug: slugify(slug || name),
      sku: sanitizeText(sku).toUpperCase(),
      description: sanitizeText(description),
      categoryId,
      subcategoryId: subcategoryId || selectedCategory?.subcategories[0]?.id || '',
      brand: sanitizeText(brand),
      originalPrice: Math.round(parsedOriginal),
      sellingPrice: Math.round(parsedSelling),
      discountPercentage: computedDiscount,
      salePrice: parsedSale && parsedSale > 0 ? Math.round(parsedSale) : undefined,
      taxInfoPlaceholder: sanitizeText(taxInfoPlaceholder) || 'Tax calculated at checkout (Placeholder)',
      images,
      variants,
      tags,
      fabric: sanitizeText(fabric),
      weight: sanitizeText(weight),
      featured,
      bestSeller,
      newArrival,
      trending,
      discountCollection,
      status,
      lowStockThreshold: thresholdNum,
      rating: existingProduct?.rating ?? 4.8,
      reviewCount: existingProduct?.reviewCount ?? 1,
      showroomMapping: {
        enabled: showroomEnabled,
        productId: existingProduct?.id || '',
        modelUrlPlaceholder: sanitizeText(modelUrlPlaceholder),
        modelArchetype,
        has3DModel,
        showroomSection,
        rackId,
        displaySlot,
        position: [Number(posX) || 0, Number(posY) || 1.72, Number(posZ) || 0],
        rotation: [0, Number(rotY) || 0, 0],
        scale: Math.max(0.5, Math.min(1.6, Number(modelScale) || 1)),
      },
    };

    if (isEditing && existingProduct) {
      updateProduct(existingProduct.id, payload);
      onSaved(existingProduct.id);
    } else {
      const created = addProduct(payload);
      onSaved(created.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1F1D2B]/10">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#1F1D2B] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to All Products
          </button>
          <h2 className="mt-1 font-heading text-xl sm:text-2xl font-bold text-[#1F1D2B]">
            {isEditing ? `Edit Product — ${existingProduct?.name}` : 'Add New Clothing Product'}
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <Button type="button" variant="outline" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" leftIcon={<Save className="h-4 w-4" />}>
            {isEditing ? 'Save Changes' : 'Publish Product'}
          </Button>
        </div>
      </div>

      {/* Validation / Feedback Banner */}
      {formBanner && (
        <div
          role="alert"
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold ${
            formBanner.tone === 'error'
              ? 'border-[#DC2626]/35 bg-[#DC2626]/10 text-[#DC2626]'
              : formBanner.tone === 'warning'
                ? 'border-[#F59E0B]/40 bg-[#F59E0B]/12 text-[#B45309]'
                : 'border-[#16A34A]/35 bg-[#16A34A]/10 text-[#16A34A]'
          }`}
        >
          {formBanner.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{formBanner.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Main Left Column (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          {/* 1. Core Identity & Category */}
          <section className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
            <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
              1. Basic Product Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                id="prod-name"
                label="Product Name"
                placeholder="e.g. Royal Linen Mandarin Shirt"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!isEditing) setSlug(slugify(e.target.value));
                }}
                error={errors.name}
                required
              />
              <InputField
                id="prod-sku"
                label="Product SKU"
                placeholder="e.g. FW-MN-208"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                error={errors.sku}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="prod-cat" className="block text-xs font-semibold text-[#1F1D2B]">
                  Main Category <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  id="prod-cat"
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="text-xs text-[#DC2626]">{errors.categoryId}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prod-subcat" className="block text-xs font-semibold text-[#1F1D2B]">
                  Subcategory
                </label>
                <select
                  id="prod-subcat"
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                >
                  {selectedCategory?.subcategories.length ? (
                    selectedCategory.subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))
                  ) : (
                    <option value="">General</option>
                  )}
                </select>
              </div>

              <InputField
                id="prod-brand"
                label="Brand"
                placeholder="e.g. Jummo Atelier"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                error={errors.brand}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prod-desc" className="block text-xs font-semibold text-[#1F1D2B]">
                Product Description <span className="text-[#DC2626]">*</span>
              </label>
              <textarea
                id="prod-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe cut, fabric hand-feel, craftsmanship, and styling notes..."
                className={`w-full rounded-xl border bg-white p-3 text-sm text-[#1F1D2B] placeholder:text-[#1F1D2B]/40 focus:outline-none ${
                  errors.description
                    ? 'border-[#DC2626]'
                    : 'border-[#1F1D2B]/15 focus:border-[#FF7A00]'
                }`}
              />
              {errors.description && (
                <p className="text-xs text-[#DC2626]">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputField
                id="prod-fabric"
                label="Fabric Type"
                placeholder="e.g. 100% Katan Silk"
                value={fabric}
                onChange={(e) => setFabric(e.target.value)}
              />
              <InputField
                id="prod-weight"
                label="Product Weight"
                placeholder="e.g. 340g"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <InputField
                id="prod-tags"
                label="Product Tags (comma-separated)"
                placeholder="Luxury, Handloom, Festive"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </section>

          {/* 2. Product Image Management */}
          <section className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                2. Product Images &amp; Gallery Views
              </h3>
              <span className="text-xs text-[#1F1D2B]/55 tabular-nums">
                {images.length} image{images.length === 1 ? '' : 's'}
              </span>
            </div>
            {errors.images && <p className="text-xs font-semibold text-[#DC2626]">{errors.images}</p>}
            <ProductImageManager
              productId={existingProduct?.id || slugify(sku || name || 'new-product')}
              images={images}
              onChange={setImages}
            />
          </section>

          {/* 3. Size & Colour Variant Stock Matrix */}
          <section className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
                  3. Size, Colour &amp; Variant Stock Matrix
                </h3>
                <p className="text-xs text-[#1F1D2B]/60">
                  Every colour × size combination maintains its own SKU and exact stock quantity.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1F1D2B] tabular-nums">
                  Total Stock: {totalStock}
                </span>
                {stockStatus === 'out_of_stock' ? (
                  <ProductBadge tone="error">Out of Stock</ProductBadge>
                ) : stockStatus === 'low_stock' ? (
                  <ProductBadge tone="warning">Low Stock</ProductBadge>
                ) : (
                  <ProductBadge tone="success">In Stock</ProductBadge>
                )}
              </div>
            </div>

            {errors.variants && (
              <p className="text-xs font-semibold text-[#DC2626]">{errors.variants}</p>
            )}

            {/* Variant Generator Bar */}
            <div className="rounded-xl border border-[#1F1D2B]/12 bg-[#FFF8EF]/70 p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <InputField
                    id="var-colour-name"
                    label="Colour Name"
                    placeholder="e.g. Royal Blue, Jet Black"
                    value={newColourName}
                    onChange={(e) => setNewColourName(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="var-colour-hex" className="block text-xs font-semibold text-[#1F1D2B]">
                    Swatch
                  </label>
                  <input
                    id="var-colour-hex"
                    type="color"
                    value={newColourHex}
                    onChange={(e) => setNewColourHex(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#1F1D2B]/15 bg-white p-1 cursor-pointer"
                  />
                </div>
                <div className="sm:col-span-2">
                  <InputField
                    id="var-default-stock"
                    label="Default Qty"
                    type="number"
                    min={0}
                    value={defaultVariantStock}
                    onChange={(e) => setDefaultVariantStock(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={addColourVariants}
                  >
                    Add Variants
                  </Button>
                </div>
              </div>

              {/* Standard Sizes XS–XXXL + Custom Size Input */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1F1D2B]">
                  Select Sizes for this Colour (Standard XS–XXXL or Custom):
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {Array.from(
                    new Set([...STANDARD_CLOTHING_SIZES, ...selectedSizesForAdd])
                  ).map((sz) => {
                    const active = selectedSizesForAdd.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => toggleSizeSelection(sz)}
                        className={`min-w-[42px] h-9 px-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                            : 'bg-white border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00]'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}

                  <div className="inline-flex items-center gap-1 ml-1">
                    <input
                      type="text"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomSizeChip();
                        }
                      }}
                      placeholder="Custom (e.g. 38, Free Size)"
                      className="h-9 w-40 rounded-lg border border-[#1F1D2B]/15 bg-white px-2.5 text-xs text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCustomSizeChip}
                      className="h-9 rounded-lg border border-[#1F1D2B]/15 bg-white px-2.5 text-xs font-semibold text-[#FF7A00] hover:bg-[#FFE4C7]/50 cursor-pointer"
                    >
                      + Size
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Variants Editable Table */}
            {variants.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[#1F1D2B]/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1F1D2B]/10 bg-[#FFF8EF]/70 text-[#1F1D2B]/65">
                      <th className="py-2.5 px-3 font-semibold">Colour</th>
                      <th className="py-2.5 px-3 font-semibold">Size</th>
                      <th className="py-2.5 px-3 font-semibold">Variant SKU</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Stock Qty</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1D2B]/8">
                    {variants.map((v) => (
                      <tr key={v.id}>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2 font-medium text-[#1F1D2B]">
                            <span
                              className="h-4 w-4 rounded-full border border-[#1F1D2B]/25 shrink-0"
                              style={{ backgroundColor: v.colourHex }}
                            />
                            {v.colour}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#1F1D2B]">{v.size}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) =>
                              updateVariantRow(v.id, { sku: e.target.value.toUpperCase() })
                            }
                            className="h-8 w-full min-w-[140px] rounded-lg border border-[#1F1D2B]/15 bg-white px-2 font-mono text-xs text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            value={v.stockQuantity}
                            onChange={(e) =>
                              updateVariantRow(v.id, {
                                stockQuantity: Math.max(0, Number(e.target.value)),
                              })
                            }
                            className="h-8 w-20 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF] px-2 text-center font-mono font-bold text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeVariantRow(v.id)}
                            aria-label={`Remove ${v.colour} ${v.size}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Sticky Column (4 cols): Pricing, Status, Flags, 3D Showroom Mapping */}
        <div className="xl:col-span-4 space-y-6">
          {/* 4. Pricing (INR) */}
          <section className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4">
            <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
              4. Pricing &amp; Discount (₹)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                id="prod-orig-price"
                label="Original Price (₹)"
                type="number"
                min={1}
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                error={errors.originalPrice}
                required
              />
              <InputField
                id="prod-sell-price"
                label="Selling Price (₹)"
                type="number"
                min={1}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                error={errors.sellingPrice}
                required
              />
            </div>

            <InputField
              id="prod-sale-price"
              label="Optional Flash Sale Price (₹)"
              type="number"
              min={0}
              placeholder="Leave blank if no extra sale"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              error={errors.salePrice}
            />

            <div className="rounded-xl bg-[#FFF8EF] border border-[#1F1D2B]/10 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-[#1F1D2B]/60">Customer Price Preview</p>
                <p className="font-heading text-lg font-bold text-[#1F1D2B] tabular-nums">
                  {formatINR(effectivePrice)}
                </p>
              </div>
              <ProductBadge tone={computedDiscount > 0 ? 'accent' : 'surface'}>
                {computedDiscount}% OFF
              </ProductBadge>
            </div>

            <InputField
              id="prod-tax"
              label="Tax Information Placeholder"
              value={taxInfoPlaceholder}
              onChange={(e) => setTaxInfoPlaceholder(e.target.value)}
            />
          </section>

          {/* 5. Visibility, Status & Merchandising Flags */}
          <section className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-4">
            <h3 className="font-heading text-base font-bold text-[#1F1D2B]">
              5. Visibility &amp; Collections
            </h3>

            <div className="space-y-1.5">
              <label htmlFor="prod-status" className="block text-xs font-semibold text-[#1F1D2B]">
                Product Status
              </label>
              <select
                id="prod-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductVisibilityStatus)}
                className="w-full h-11 rounded-xl border border-[#1F1D2B]/15 bg-white px-3 text-sm font-medium text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
              >
                <option value="published">Published (Visible on Storefront &amp; Showroom)</option>
                <option value="draft">Draft (Hidden from Customers)</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <InputField
              id="prod-low-stock"
              label="Low-Stock Alert Threshold (Units)"
              type="number"
              min={1}
              value={productLowStockThreshold}
              onChange={(e) => setProductLowStockThreshold(e.target.value)}
            />

            <div className="space-y-2.5 pt-2 border-t border-[#1F1D2B]/10 text-xs">
              {[
                { label: 'Featured Product', checked: featured, onChange: setFeatured },
                { label: 'Best-Selling Product', checked: bestSeller, onChange: setBestSeller },
                { label: 'New Arrival', checked: newArrival, onChange: setNewArrival },
                { label: 'Trending Collection', checked: trending, onChange: setTrending },
                {
                  label: 'Discount Collection',
                  checked: discountCollection,
                  onChange: setDiscountCollection,
                },
              ].map((flag) => (
                <label
                  key={flag.label}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="font-medium text-[#1F1D2B]">{flag.label}</span>
                  <input
                    type="checkbox"
                    checked={flag.checked}
                    onChange={(e) => flag.onChange(e.target.checked)}
                    className="h-4 w-4 accent-[#FF7A00] cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* 6. Phase 3 3D Showroom Mapping */}
          <section className="rounded-2xl border border-[#1F1D2B]/10 bg-[#1F1D2B] text-[#FFF8EF] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-[#FF7A00]" />
                <h3 className="font-heading text-sm font-bold">
                  6. 3D Showroom Mapping (Phase 3 Bridge)
                </h3>
              </div>
              <input
                type="checkbox"
                checked={showroomEnabled}
                onChange={(e) => setShowroomEnabled(e.target.checked)}
                aria-label="Enable display in 3D Showroom"
                className="h-4 w-4 accent-[#FF7A00] cursor-pointer"
              />
            </div>

            <p className="text-[11px] text-[#FFF8EF]/70 leading-relaxed">
              Assign this product to a Phase 3 3D Showroom rack and slot. Full drag-and-drop 3D
              admin placement arrives in Phase 9.
            </p>

            {showroomEnabled && (
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[#FFE4C7]">Has Interactive 3D Garment Model</span>
                  <input
                    type="checkbox"
                    checked={has3DModel}
                    onChange={(e) => setHas3DModel(e.target.checked)}
                    className="h-4 w-4 accent-[#FF7A00] cursor-pointer"
                  />
                </label>

                <div className="space-y-1">
                  <label className="block text-[11px] text-[#FFE4C7]">3D Garment Archetype</label>
                  <select
                    value={modelArchetype}
                    onChange={(e) => {
                      const val = e.target.value as GarmentArchetype;
                      setModelArchetype(val);
                      setModelUrlPlaceholder(`procedural://garments/${val}`);
                    }}
                    className="w-full h-9 rounded-lg border border-white/15 bg-[#151320] px-2.5 text-xs text-[#FFF8EF] focus:border-[#FF7A00] focus:outline-none"
                  >
                    {GARMENT_ARCHETYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-[#FFE4C7]">
                    3D Model URL Placeholder (GLB / Procedural)
                  </label>
                  <input
                    type="text"
                    value={modelUrlPlaceholder}
                    onChange={(e) => setModelUrlPlaceholder(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/15 bg-[#151320] px-2.5 font-mono text-[11px] text-[#FFF8EF] focus:border-[#FF7A00] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] text-[#FFE4C7]">Showroom Section</label>
                    <select
                      value={showroomSection}
                      onChange={(e) => setShowroomSection(e.target.value as ShowroomSectionId)}
                      className="w-full h-9 rounded-lg border border-white/15 bg-[#151320] px-2 text-xs text-[#FFF8EF] focus:border-[#FF7A00] focus:outline-none"
                    >
                      {SHOWROOM_SECTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shortName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] text-[#FFE4C7]">Display Slot</label>
                    <select
                      value={displaySlot}
                      onChange={(e) => setDisplaySlot(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-white/15 bg-[#151320] px-2 text-xs text-[#FFF8EF] focus:border-[#FF7A00] focus:outline-none"
                    >
                      <option value={0}>Slot 1 (Left)</option>
                      <option value={1}>Slot 2 (Center)</option>
                      <option value={2}>Slot 3 (Right)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-[#FFE4C7]">Target 3D Rack ID</label>
                  <select
                    value={rackId}
                    onChange={(e) => setRackId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/15 bg-[#151320] px-2.5 text-xs text-[#FFF8EF] focus:border-[#FF7A00] focus:outline-none"
                  >
                    {INITIAL_SHOWROOM_RACKS.map((r) => (
                      <option key={r.rackId} value={r.rackId}>
                        {r.label} ({r.rackId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {[
                    { label: 'Pos X', val: posX, set: setPosX },
                    { label: 'Pos Y', val: posY, set: setPosY },
                    { label: 'Pos Z', val: posZ, set: setPosZ },
                    { label: 'Rot Y', val: rotY, set: setRotY },
                    { label: 'Scale', val: modelScale, set: setModelScale },
                  ].map((field) => (
                    <div key={field.label} className="space-y-1">
                      <label className="block text-[10px] text-[#FFF8EF]/60 text-center">
                        {field.label}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={field.val}
                        onChange={(e) => field.set(e.target.value)}
                        className="w-full h-8 rounded-lg border border-white/15 bg-[#151320] px-1 text-center font-mono text-[11px] text-[#FFF8EF]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </form>
  );
};
