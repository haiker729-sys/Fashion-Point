import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { validateImageFile } from '../utils/catalogHelpers';
import { isFirebaseConfigured, storage } from './firebaseConfig';

export interface UploadedStorageAsset {
  url: string;
  storagePath: string;
  sizeKb: number;
  compressed: boolean;
}

/**
 * Compresses an uploaded image file via Canvas to keep Firebase Storage assets fast and lightweight.
 */
async function compressImageToBlob(
  file: File,
  maxDimension = 1400,
  quality = 0.84
): Promise<{ blob: Blob; contentType: string; extension: string; compressed: boolean }> {
  const originalExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { blob: file, contentType: file.type, extension: originalExt, compressed: false };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () =>
      resolve({ blob: file, contentType: file.type, extension: originalExt, compressed: false });
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        resolve({ blob: file, contentType: file.type, extension: originalExt, compressed: false });
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, contentType: file.type, extension: originalExt, compressed: false });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const targetMime = file.type === 'image/png' ? 'image/webp' : file.type;
        const targetExt = targetMime === 'image/webp' ? 'webp' : 'jpg';

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve({
                blob: file,
                contentType: file.type,
                extension: originalExt,
                compressed: false,
              });
            } else {
              resolve({
                blob,
                contentType: targetMime,
                extension: targetExt,
                compressed: true,
              });
            }
          },
          targetMime,
          quality
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function buildSafeSegment(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'asset'
  );
}

/**
 * Uploads a validated, compressed image to Firebase Storage under structured folders:
 * - products/{productId}/{viewName}-{timestamp}.{ext}
 * - categories/{categoryId}/category-image-{timestamp}.{ext}
 * - showroom/assets/{assetName}-{timestamp}.{ext}
 */
export async function uploadImageToFirebaseStorage(params: {
  file: File;
  folder: 'products' | 'categories' | 'showroom';
  entityId: string;
  label?: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadedStorageAsset> {
  if (!isFirebaseConfigured || !storage) {
    throw new Error('Firebase Storage is not configured.');
  }

  const check = validateImageFile(params.file);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid image file.');
  }

  const { blob, contentType, extension, compressed } = await compressImageToBlob(params.file);

  const safeEntity = buildSafeSegment(params.entityId);
  const safeLabel = buildSafeSegment(params.label || params.file.name.replace(/\.[^.]+$/, ''));
  const stamp = Date.now().toString(36);

  let storagePath = `products/${safeEntity}/${safeLabel}-${stamp}.${extension}`;
  if (params.folder === 'categories') {
    storagePath = `categories/${safeEntity}/category-image-${stamp}.${extension}`;
  } else if (params.folder === 'showroom') {
    storagePath = `showroom/assets/${safeLabel}-${stamp}.${extension}`;
  }

  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, blob, {
    contentType,
    cacheControl: 'public, max-age=31536000',
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (params.onProgress && snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          params.onProgress(pct);
        }
      },
      (error) => reject(error),
      () => resolve()
    );
  });

  const url = await getDownloadURL(uploadTask.snapshot.ref);
  return {
    url,
    storagePath,
    sizeKb: Math.max(1, Math.round(blob.size / 1024)),
    compressed,
  };
}

/**
 * Deletes a previously uploaded asset from Firebase Storage.
 */
export async function deleteImageFromFirebaseStorage(storagePath: string): Promise<void> {
  if (!isFirebaseConfigured || !storage || !storagePath) return;
  const assetRef = ref(storage, storagePath);
  await deleteObject(assetRef);
}
