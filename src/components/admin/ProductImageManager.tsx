import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { ASSETS } from '../../data/catalog';
import {
  IMAGE_VIEW_TYPES,
  type ImageViewType,
  type ProductImageAsset,
} from '../../types/catalog';
import { validateImageFile } from '../../utils/catalogHelpers';
import { isFirebaseConfigured } from '../../firebase/firebaseConfig';
import {
  deleteImageFromFirebaseStorage,
  uploadImageToFirebaseStorage,
} from '../../firebase/storage';
import { formatFirebaseError } from '../../firebase/firebaseErrors';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { ResilientImage } from '../ui/Primitives';

interface ProductImageManagerProps {
  productId?: string;
  images: ProductImageAsset[];
  onChange: (nextImages: ProductImageAsset[]) => void;
}

const STUDIO_LIBRARY_PRESETS = [
  { label: 'Navy Shirt', url: ASSETS.navyShirt },
  { label: 'Crimson Saree', url: ASSETS.crimsonSaree },
  { label: 'Camel Coat', url: ASSETS.camelCoat },
  { label: 'Olive Blazer', url: ASSETS.oliveBlazer },
  { label: 'Ivory Kurti', url: ASSETS.ivoryKurti },
  { label: 'Kids Bomber', url: ASSETS.kidsJacket },
  { label: 'Selvedge Jeans', url: ASSETS.selvedgeJeans },
  { label: 'Supima Tee', url: ASSETS.supimaTshirt },
  { label: 'Royal Sherwani', url: ASSETS.royalSherwani },
];

export const ProductImageManager: React.FC<ProductImageManagerProps> = ({
  productId = 'draft-product',
  images,
  onChange,
}) => {
  const { isAdmin } = useAuth();
  const { reportPendingUploadDelta } = useCatalog();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    percent: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'error' | 'success' | 'warning';
    message: string;
  } | null>(null);
  const [showStudioPicker, setShowStudioPicker] = useState(false);

  const normalizeOrder = (list: ProductImageAsset[]): ProductImageAsset[] => {
    const hasMain = list.some((i) => i.isMain);
    return list.map((img, idx) => ({
      ...img,
      order: idx,
      isMain: hasMain ? img.isMain : idx === 0,
    }));
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setProcessing(true);
    setFeedback(null);

    const files = Array.from(fileList);
    const errors: string[] = [];
    const added: ProductImageAsset[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const check = validateImageFile(file);
      if (!check.valid) {
        errors.push(check.error || `Rejected ${file.name}`);
        continue;
      }

      if (!isFirebaseConfigured || !isAdmin) {
        errors.push(
          'Sign in as an authorized Admin with active Firebase Storage to upload cloud product images.'
        );
        continue;
      }

      const viewIndex = Math.min(images.length + added.length, IMAGE_VIEW_TYPES.length - 1);
      const viewType = IMAGE_VIEW_TYPES[viewIndex];

      reportPendingUploadDelta(1, null);
      setUploadProgress({ fileName: file.name, percent: 5 });

      try {
        const uploaded = await uploadImageToFirebaseStorage({
          file,
          folder: 'products',
          entityId: productId,
          label: viewType,
          onProgress: (pct) => setUploadProgress({ fileName: file.name, percent: pct }),
        });

        added.push({
          id: `img-${Date.now().toString(36)}-${i}`,
          url: uploaded.url,
          storagePath: uploaded.storagePath,
          viewType,
          isMain: images.length === 0 && added.length === 0,
          order: images.length + added.length,
          alt: file.name.replace(/\.[^.]+$/, ''),
          sizeKb: uploaded.sizeKb,
          compressed: uploaded.compressed,
        });
        reportPendingUploadDelta(-1, null);
      } catch (err) {
        const formatted = formatFirebaseError(err);
        reportPendingUploadDelta(-1, formatted.message);
        errors.push(`${file.name}: ${formatted.message}`);
      }
    }

    setUploadProgress(null);

    if (added.length > 0) {
      onChange(normalizeOrder([...images, ...added]));
    }

    if (errors.length > 0 && added.length > 0) {
      setFeedback({
        tone: 'warning',
        message: `Uploaded ${added.length} image(s) to Firebase Storage with ${errors.length} failed: ${errors[0]}`,
      });
    } else if (errors.length > 0) {
      setFeedback({ tone: 'error', message: errors[0] });
    } else if (added.length > 0) {
      const totalKb = added.reduce((sum, item) => sum + (item.sizeKb || 0), 0);
      setFeedback({
        tone: 'success',
        message: `Uploaded ${added.length} image${added.length > 1 ? 's' : ''} to Firebase Storage (${totalKb} KB total, download URL saved).`,
      });
    }

    setProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addStudioAsset = (url: string, label: string) => {
    const viewIndex = Math.min(images.length, IMAGE_VIEW_TYPES.length - 1);
    const next: ProductImageAsset = {
      id: `img-studio-${Date.now().toString(36)}`,
      url,
      viewType: IMAGE_VIEW_TYPES[viewIndex],
      isMain: images.length === 0,
      order: images.length,
      alt: `${label} studio view`,
    };
    onChange(normalizeOrder([...images, next]));
    setFeedback({
      tone: 'success',
      message: `Attached verified studio image "${label}".`,
    });
  };

  const setMainImage = (id: string) => {
    onChange(images.map((img) => ({ ...img, isMain: img.id === id })));
  };

  const updateViewType = (id: string, viewType: ImageViewType) => {
    onChange(images.map((img) => (img.id === id ? { ...img, viewType } : img)));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const copy = [...images];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChange(normalizeOrder(copy));
  };

  const removeImage = async (img: ProductImageAsset) => {
    if (img.storagePath) {
      try {
        await deleteImageFromFirebaseStorage(img.storagePath);
        setFeedback({
          tone: 'success',
          message: `Deleted image from Firebase Storage (${img.storagePath}).`,
        });
      } catch (err) {
        const formatted = formatFirebaseError(err);
        setFeedback({
          tone: 'warning',
          message: `Removed from product gallery; Storage cleanup note: ${formatted.message}`,
        });
      }
    }
    onChange(normalizeOrder(images.filter((item) => item.id !== img.id)));
  };

  return (
    <div className="space-y-4">
      {/* Firebase Cloud Storage Upload Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        className="rounded-2xl border-2 border-dashed border-[#1F1D2B]/20 bg-[#FFF8EF]/70 p-5 text-center transition-colors hover:border-[#FF7A00]"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void handleFiles(e.target.files)}
          className="hidden"
          id="product-image-upload-input"
          disabled={processing}
        />

        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFE4C7] text-[#FF7A00]">
          {processing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
        </div>
        <p className="mt-2.5 text-sm font-semibold text-[#1F1D2B]">
          {processing
            ? `Uploading to Firebase Storage (${uploadProgress?.percent ?? 0}%)...`
            : 'Upload Product Photography to Firebase Cloud Storage'}
        </p>
        <p className="mt-1 text-xs text-[#1F1D2B]/60">
          JPG, PNG, or WEBP up to 5 MB each · Auto-compressed &amp; stored under{' '}
          <span className="font-mono">products/{productId}/</span> · Download URLs saved to
          Firestore
        </p>

        {/* Real Upload Progress Indicator */}
        {uploadProgress && (
          <div className="mx-auto mt-3 max-w-md space-y-1 text-left">
            <div className="flex justify-between text-[11px] font-semibold text-[#1F1D2B]">
              <span className="truncate">{uploadProgress.fileName}</span>
              <span className="tabular-nums text-[#FF7A00]">{uploadProgress.percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#1F1D2B]/10">
              <div
                className="h-full rounded-full bg-[#FF7A00] transition-all duration-150"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <label
            htmlFor="product-image-upload-input"
            className={`inline-flex h-10 items-center gap-2 rounded-xl bg-[#FF7A00] px-4 text-xs font-semibold text-white hover:bg-[#e56d00] cursor-pointer ${
              processing ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <ImagePlus className="h-4 w-4" />
            Upload to Cloud Storage
          </label>
          <button
            type="button"
            onClick={() => setShowStudioPicker((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#1F1D2B]/15 bg-white px-4 text-xs font-semibold text-[#1F1D2B] hover:border-[#FF7A00] cursor-pointer"
          >
            {showStudioPicker ? 'Hide Studio Library' : 'Pick Verified Studio Assets'}
          </button>
        </div>
      </div>

      {/* Real Validation / Upload Feedback */}
      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            feedback.tone === 'error'
              ? 'border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626]'
              : feedback.tone === 'warning'
                ? 'border-[#F59E0B]/40 bg-[#F59E0B]/12 text-[#B45309]'
                : 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Local Studio Asset Picker */}
      {showStudioPicker && (
        <div className="rounded-xl border border-[#1F1D2B]/12 bg-white p-3.5">
          <p className="text-xs font-semibold text-[#1F1D2B] mb-2.5">
            Verified Studio Assets (Click to attach to gallery)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
            {STUDIO_LIBRARY_PRESETS.map((asset) => (
              <button
                key={asset.label}
                type="button"
                onClick={() => addStudioAsset(asset.url, asset.label)}
                className="group rounded-lg border border-[#1F1D2B]/10 bg-[#FFF8EF] p-1 text-left hover:border-[#FF7A00] cursor-pointer"
              >
                <ResilientImage
                  src={asset.url}
                  alt={asset.label}
                  className="aspect-[3/4] w-full rounded object-cover"
                />
                <span className="mt-1 block truncate text-[10px] font-medium text-[#1F1D2B]/80">
                  {asset.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview, Main Selector, View Type & Ordering Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`rounded-xl border p-2.5 bg-white space-y-2.5 ${
                img.isMain ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/20' : 'border-[#1F1D2B]/12'
              }`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#FFF8EF]">
                <ResilientImage
                  src={img.url}
                  alt={img.alt}
                  className="h-full w-full object-cover"
                />
                {img.isMain && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-[#FF7A00] px-2 py-0.5 text-[10px] font-bold text-white">
                    <Star className="h-3 w-3 fill-current" />
                    Main Image
                  </span>
                )}
                {img.storagePath && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <Cloud className="h-2.5 w-2.5" />
                    Cloud
                  </span>
                )}
                {img.sizeKb && (
                  <span className="absolute bottom-2 right-2 rounded bg-[#1F1D2B]/85 px-1.5 py-0.5 text-[10px] font-mono text-[#FFF8EF]">
                    {img.sizeKb} KB{img.compressed ? ' · Opt' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <select
                  aria-label={`Image ${idx + 1} view type`}
                  value={img.viewType}
                  onChange={(e) => updateViewType(img.id, e.target.value as ImageViewType)}
                  className="w-full h-9 rounded-lg border border-[#1F1D2B]/15 bg-[#FFF8EF]/60 px-2.5 text-xs font-medium text-[#1F1D2B] focus:border-[#FF7A00] focus:outline-none"
                >
                  {IMAGE_VIEW_TYPES.map((vt) => (
                    <option key={vt} value={vt}>
                      {vt}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMainImage(img.id)}
                    disabled={img.isMain}
                    className={`flex-1 h-8 rounded-lg px-2 text-[11px] font-semibold cursor-pointer ${
                      img.isMain
                        ? 'bg-[#FFE4C7] text-[#1F1D2B]/60 cursor-default'
                        : 'border border-[#1F1D2B]/15 bg-white text-[#1F1D2B] hover:border-[#FF7A00]'
                    }`}
                  >
                    {img.isMain ? 'Primary' : 'Set Main'}
                  </button>

                  <button
                    type="button"
                    onClick={() => moveImage(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move image earlier"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00] disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(idx, 1)}
                    disabled={idx === images.length - 1}
                    aria-label="Move image later"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00] disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeImage(img)}
                    aria-label="Remove image"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DC2626]/25 text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
