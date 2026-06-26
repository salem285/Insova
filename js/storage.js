/**
 * Firebase Storage helpers — upload files and resolve download URLs (admin)
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { storage } from './firebase-config.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
/** Per-image limit when storing Base64 in Firestore (1 MB document cap) */
export const MAX_FIRESTORE_IMAGE_SIZE = 400 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Validate image file before upload or Base64 encoding */
export function validateImageFile(file, label = 'Image', maxSize = MAX_FILE_SIZE) {
  if (!file || !file.size) return `${label} is required.`;
  const maxKb = Math.round(maxSize / 1024);
  if (file.size > maxSize) return `${label} must be under ${maxKb >= 1024 ? `${Math.round(maxKb / 1024)} MB` : `${maxKb} KB`}.`;
  if (!ALLOWED_TYPES.includes(file.type)) return `${label} must be JPG, PNG, WEBP, or GIF.`;
  return null;
}

/** Convert a File to a Base64 data URL via FileReader (data:image/jpeg;base64,...) */
export function fileToBase64DataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/** Get file extension from name or mime */
function getExtension(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[file.type] || 'jpg';
}

/** Upload a file and return its storage path */
export async function uploadFile(storagePath, file) {
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return storagePath;
}

/** Upload member photo (public registration or admin) */
export async function uploadMemberPhoto(nationalId, file, kind) {
  const ext = getExtension(file);
  const path = `members/${nationalId}/${kind}.${ext}`;
  return uploadFile(path, file);
}

/** Upload competition project image (admin only) */
export async function uploadProjectImage(competitionId, file) {
  const ext = getExtension(file);
  const path = `competitions/${competitionId}/project.${ext}`;
  return uploadFile(path, file);
}

/** Resolve storage path to a download URL (requires read permission) */
export async function resolveStorageUrl(path) {
  if (!path) return null;
  try {
    return await getDownloadURL(ref(storage, path));
  } catch {
    return null;
  }
}

/** Delete a storage file by path */
export async function deleteStorageFile(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* file may not exist */
  }
}

/** Preview image file in an img element */
export function previewImageFile(input, imgEl) {
  const file = input?.files?.[0];
  if (!file || !imgEl) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    imgEl.src = e.target.result;
    imgEl.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}
