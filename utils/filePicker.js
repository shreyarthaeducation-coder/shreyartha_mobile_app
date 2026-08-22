import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

/**
 * Pick one attachment for a homework or resource upload.
 *
 * The MIME filter mirrors the web's `<input accept="image/*,application/pdf">` — the backend will
 * store anything, but those are the two types the rest of the platform renders.
 *
 * The returned shape is exactly what `staffApi.multipart({ files })` wants. Setting `type`
 * correctly matters: the backend derives `fileType` (IMAGE / PDF / VIDEO / OTHER) from the part's
 * Content-Type, so a missing or wrong type makes every upload land as OTHER. `name` must keep its
 * extension — it is stored verbatim as `fileName` and is what the teacher sees.
 *
 * @returns {Promise<{ uri: string, name: string, type: string, size?: number } | null>}
 *          null when the user cancels.
 */
export async function pickAttachment() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    // Needed so the file is readable at the returned uri when we hand it to fetch().
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    name: asset.name || 'attachment',
    type: asset.mimeType || 'application/octet-stream',
    size: asset.size,
  };
}

/**
 * Pick one file, filtered to the given MIME types.
 *
 * The generic form of `pickAttachment`, for callers whose accepted types are not "image or PDF" —
 * the Skills Edge certificate takes a video, a PDF and a PowerPoint in three separate slots, each
 * with its own filter (the web sets a different `accept` on each `<input type="file">`).
 *
 * Same return shape and the same reasons for it: `type` drives the backend's file-kind detection
 * and `name` must keep its extension.
 *
 * @param {string[]} types MIME types / extensions, as DocumentPicker's `type` option
 * @returns {Promise<{ uri, name, type, size? } | null>} null when the user cancels
 */
export async function pickFile(types) {
  const result = await DocumentPicker.getDocumentAsync({
    type: types && types.length ? types : '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    name: asset.name || 'file',
    type: asset.mimeType || 'application/octet-stream',
    size: asset.size,
  };
}

/**
 * Pick a PDF only — for the adaptive question importer, whose backend rejects anything whose
 * content type isn't exactly `application/pdf` with a 400. Filtering at the picker means the
 * teacher never gets that far.
 */
export async function pickPdf() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    name: asset.name || 'questions.pdf',
    type: asset.mimeType || 'application/pdf',
    size: asset.size,
  };
}

/**
 * Pick a profile photo from the library.
 *
 * `expo-image-picker` rather than the document picker: it gives the real photo grid and a square
 * crop, which is what a profile picture wants — the web has a bare `<input type="file">` and no
 * crop at all.
 *
 * The backend's `S3StorageService.validateImage` accepts **only** png / jpeg / gif / webp and
 * rejects anything else with a 400, so the picker is pinned to JPEG output rather than passing
 * through whatever the gallery held (HEIC on iPhones would be rejected).
 *
 * @returns {Promise<{ uri, name, type, size? } | { denied: true } | null>}
 *          null when cancelled; `{ denied: true }` when the library permission was refused.
 */
/**
 * Take a photo with the camera.
 *
 * ── NO NEW PERMISSION, NO REBUILD ───────────────────────────────────────────
 * `android.permission.CAMERA` is already in `app.json`'s `expo.android.permissions`, and
 * `NSCameraUsageDescription` is already in the iOS `infoPlist` — both were added for the profile
 * photo. **The iOS string still says "to let you upload a profile photo"**, which reads oddly on a
 * doubt capture. Widening it is a one-line change that needs a native build, so it is deliberately
 * not bundled with this feature.
 *
 * NO `allowsEditing` here, unlike `pickPhoto`. That option opens a 1:1 crop UI, which is right for
 * an avatar and wrong for a photograph of a question — it would cut off half the problem.
 *
 * @returns {Promise<{uri, name, type, size?} | {denied: true} | null>}
 */
export async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { denied: true };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9, // Re-encoded by utils/doubtImage anyway; keep detail for the OCR until then.
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    name: asset.fileName || 'photo.jpg',
    type: asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg',
    size: asset.fileSize,
  };
}

/**
 * Pick a photo from the gallery WITHOUT the square crop.
 *
 * `pickPhoto` forces `allowsEditing: true, aspect: [1,1]` because it exists for the profile avatar.
 * Reusing it for a question photo would silently crop the question. Same return shape.
 *
 * @returns {Promise<{uri, name, type, size?} | {denied: true} | null>}
 */
export async function pickImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { denied: true };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    ...(ImagePicker.UIImagePickerPreferredAssetRepresentationMode
      ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
      : {}),
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    name: asset.fileName || 'image.jpg',
    type: asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg',
    size: asset.fileSize,
  };
}

export async function pickPhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { denied: true };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    // Forces JPEG out of the picker; HEIC/HEIF would 400 at validateImage.
    ...(ImagePicker.UIImagePickerPreferredAssetRepresentationMode
      ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
      : {}),
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    name: asset.fileName || 'profile.jpg',
    // The picker's own mimeType can be absent on Android; the backend derives everything from
    // this header, so never let it fall through to octet-stream.
    type: asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg',
    size: asset.fileSize,
  };
}

/** Human-readable size for the picked-file chip. */
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
