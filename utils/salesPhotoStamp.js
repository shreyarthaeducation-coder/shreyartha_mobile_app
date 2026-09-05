import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../services/apiService';

/**
 * Turning the rendered geo-stamp into an uploadable file.
 *
 * The rendering half lives in `components/staff/sales/SalesPhotoStamp.js`; this half fetches the
 * map thumbnail it needs and screenshots the result.
 */

const MAX_LONG_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Downloads the static-map thumbnail to a local file and returns its URI, or null.
 *
 * `<Image source={{ uri }}>` cannot send an Authorization header, and the endpoint is
 * authenticated — so the bytes have to be fetched to disk first. Follows `utils/downloadFile.js`,
 * including its **`expo-file-system/legacy`** import: SDK 54's new `File`/`Directory` API has no
 * download-with-headers equivalent.
 *
 * Never throws, and returns null far more often than not: the server answers **204** when the key
 * is unset or the quota is spent, and a rep checking in from inside a school building usually has
 * no signal at all. The stamp is designed to look right without it.
 */
export async function fetchMapThumbnail(latitude, longitude, sizePx = 240) {
  if (latitude == null || longitude == null) return null;
  try {
    const token = await AsyncStorage.getItem('schoolUserToken');
    const target = `${FileSystem.cacheDirectory}sales-map-${Date.now()}.png`;
    const url =
      `${API_BASE_URL}/api/staff/sales/geo/staticmap`
      + `?lat=${latitude}&lng=${longitude}&size=${sizePx}x${sizePx}`;

    const result = await FileSystem.downloadAsync(url, target, {
      headers: token
        ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` }
        : {},
    });

    // 204 writes a zero-byte file; anything non-2xx writes an error body. Neither is an image.
    const contentType =
      result.headers?.['Content-Type'] || result.headers?.['content-type'] || '';
    if (result.status < 200 || result.status >= 300 || !contentType.toLowerCase().includes('image')) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      return null;
    }
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || info.size === 0) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      return null;
    }
    return result.uri;
  } catch {
    return null;
  }
}

/**
 * Screenshots the rendered stamp and re-encodes it for upload.
 *
 * @param {object} viewRef ref to the `SalesPhotoStamp` view — must be mounted AND visible
 * @returns {Promise<{uri, name, type}|null>} the shape `uploadVisitPhoto` expects
 */
export async function captureStampedPhoto(viewRef) {
  if (!viewRef?.current) return null;

  const shotUri = await captureRef(viewRef, {
    format: 'jpg',
    // 1 here, compressed once below. Compressing twice only loses detail from a photo that is
    // meant to be evidence — the same reasoning as utils/snipCapture.js.
    quality: 1,
    result: 'tmpfile',
  });

  // captureRef returns no dimensions, so ask for them — same as utils/snipCapture.js.
  const size = await new Promise((resolve) => {
    Image.getSize(shotUri, (width, height) => resolve({ width, height }), () => resolve(null));
  });

  // Downscale ONLY when the capture is genuinely larger. Resizing unconditionally to a fixed width
  // would UPSCALE a screen-sized screenshot — more bytes and a blurrier photo, for nothing.
  const actions = [];
  if (size && Math.max(size.width, size.height) > MAX_LONG_SIDE) {
    actions.push(
      size.width >= size.height
        ? { resize: { width: MAX_LONG_SIDE } }
        : { resize: { height: MAX_LONG_SIDE } },
    );
  }

  // Re-encode even when `actions` is empty, never conditionally. `utils/doubtImage.js` explains
  // why: iPhone HEIC is not in S3StorageService.ALLOWED_IMAGE_TYPES and the reported mimeType can
  // disagree with the actual bytes, so a skipped conversion is a guaranteed 400 on upload. It also
  // keeps the file under the 5 MB `uploads.images.max-size-bytes` cap.
  const manipulated = await ImageManipulator.manipulateAsync(shotUri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: manipulated.uri, name: 'check-in.jpg', type: 'image/jpeg' };
}
