import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

/**
 * Normalise any captured image into something the doubt endpoint will actually accept.
 *
 * ── WHY EVERY CAPTURE ROUTE MUST GO THROUGH THIS ────────────────────────────
 * `S3StorageService.ALLOWED_IMAGE_TYPES` is **PNG / JPEG / GIF / WebP / SVG only**, and the doubt
 * service caps uploads at **5 MB**. Two consequences the web never has to think about:
 *
 *   * **An iPhone camera produces HEIC**, which is not on that list. Uploading it raw returns
 *     `"Unsupported file type: image/heic"` as a 400 — a real photo of a real question, refused for
 *     a reason the student cannot act on. Re-encoding to JPEG is the fix, and it has to happen for
 *     the gallery route too, because a HEIC already in the camera roll picks the same way.
 *   * A modern phone camera JPEG is routinely 4-8 MB, so the size cap is not theoretical.
 *
 * ── THE SIZING IS THE WEB'S ─────────────────────────────────────────────────
 * `DoubtResolutionModal.downscaleImage`: leave it alone when the long side is ≤1600 AND it is under
 * 4.5 MB; otherwise scale the long side to 1600 and re-encode as JPEG at 0.85.
 *
 * The one deliberate difference is that we ALWAYS re-encode, even when the web would skip. RN gives
 * us no cheap way to know a picked file is really a JPEG — `expo-image-picker` reports a `mimeType`
 * that can disagree with the bytes — and a skipped HEIC is a guaranteed 400. Re-encoding a
 * small image costs a few hundred milliseconds; getting it wrong costs the student their question.
 *
 * `utils/snipCapture.js` solves the same problem for the teacher's snip tool and this follows its
 * shape (per-axis measure, ImageManipulator resize, JPEG out).
 */

/** The web's `MAX_DIMENSION`. */
export const MAX_SIDE = 1600;

/** The web's JPEG quality for every re-encode. */
export const JPEG_QUALITY = 0.85;

/** Hard server limit. We aim well under it; this is the tripwire, not the target. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** ImageManipulator gives no dimensions for the INPUT, and we need them to decide on a resize. */
function imageSize(uri) {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      // A size we cannot read is not fatal — fall through to a resize-less re-encode, which still
      // fixes the format problem that actually blocks the upload.
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

/**
 * @param {string} uri  a local file uri from the camera, the gallery, or captureRef
 * @returns {Promise<{ uri, name, type }>} ready for `studentApi.multipart({ files: { file } })`
 *
 * The filename is always `doubt.jpg`, matching the web's `fd.append("file", blob, "doubt.jpg")`.
 * The server derives nothing from it, but keeping it identical means one less difference when a
 * stored image is compared across platforms.
 */
export async function normaliseDoubtImage(uri) {
  if (!uri) throw new Error('Please choose an image of your doubt.');

  const { width, height } = await imageSize(uri);
  const longest = Math.max(width, height);

  const actions = [];
  if (longest > MAX_SIDE) {
    const k = MAX_SIDE / longest;
    actions.push({ resize: { width: Math.round(width * k), height: Math.round(height * k) } });
  }

  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: out.uri, name: 'doubt.jpg', type: 'image/jpeg' };
}

export default normaliseDoubtImage;
