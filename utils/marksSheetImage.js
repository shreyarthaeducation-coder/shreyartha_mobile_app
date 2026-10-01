import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

/**
 * A photographed answer-book cover, made ready to send.
 *
 * JPEG always — an iPhone's HEIC is re-encoded, as in utils/doubtImage.js, whose shape this follows
 * — and the long side at most SCAN_MAX_SIDE: the website's SCAN_MAX_EDGE. A doubt is read at 1600
 * px, but a mark in a 40-box grid is a handwritten digit in a 1 cm box and needs the detail; at
 * 3000 px it stays sharp and a 12-megapixel photo still travels as 1–3 MB.
 */
export const SCAN_MAX_SIDE = 3000;

/** The website's JPEG quality for a scan: a little higher than a doubt's, for the same reason. */
export const SCAN_JPEG_QUALITY = 0.92;

/** ImageManipulator gives no dimensions for the INPUT, and we need them to decide on a resize. */
function imageSize(uri) {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      // A size we cannot read is not fatal — a resize-less re-encode still fixes the format.
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

/**
 * @param {string} uri a local file uri from the camera or the gallery
 * @returns {Promise<{ uri, name, type }>} ready for `staffApi.multipart({ files: { file } })`
 */
export async function normaliseMarksSheetImage(uri) {
  if (!uri) throw new Error('Take or choose a photo of the answer book.');

  const { width, height } = await imageSize(uri);
  const longest = Math.max(width, height);

  const actions = [];
  if (longest > SCAN_MAX_SIDE) {
    const k = SCAN_MAX_SIDE / longest;
    actions.push({ resize: { width: Math.round(width * k), height: Math.round(height * k) } });
  }

  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: SCAN_JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: out.uri, name: 'marks-sheet.jpg', type: 'image/jpeg' };
}

export default normaliseMarksSheetImage;
