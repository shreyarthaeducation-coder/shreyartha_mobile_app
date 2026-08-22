import { captureRef } from 'react-native-view-shot';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

/**
 * Crop a dragged rectangle out of the on-screen document.
 *
 * This replaces the web's canvas pipeline, which has no RN equivalent:
 *
 *   web    pdf.js renders each page to <canvas> at scale 2.0 → drag rect in CSS px →
 *          pick the page canvas with the largest intersection → map CSS px to backing-store px →
 *          crop into a second canvas → canvas.toBlob('image/jpeg', 0.92)
 *
 *   native captureRef() snapshots the document View to a JPEG → the drag rect is already in the
 *          same coordinate space as that View → scale by (capturedPixels / layoutDp) →
 *          ImageManipulator crops and re-encodes
 *
 * The two constants are ported verbatim so both platforms accept and cap the same selections.
 *
 * **Resolution is the honest weak point.** `captureRef` grabs the view at its on-screen pixel size
 * (a full-width view on a 1080p phone is ~1080 px), whereas the web renders at scale 2.0 of the
 * PDF's own page size. A small selection therefore yields a smaller crop than the web would, and
 * OCR quality drops with it. The mitigation is zoom: `<Pdf>`'s pinch-zoom raises the rendered
 * resolution before the capture, which is why the snip hint tells the teacher to zoom in first.
 */

/** A drag smaller than this on either side is an accidental tap, not a selection. */
export const MIN_SNIP_PX = 24;

/** Cap the long side — cost control on the vision API, and well under the upload limit. */
export const MAX_CROP_SIDE = 2000;

const JPEG_QUALITY = 0.92;

/** captureRef gives no dimensions back, and we need them to map dp → captured px. */
function imageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * @param {object} viewRef        ref to the View wrapping the document (needs collapsable={false})
 * @param {{x,y,w,h}} selection   the frozen rect, in the same dp space the View is laid out in
 * @param {{width,height}} layout the View's onLayout size, in dp
 * @returns {Promise<{ uri: string, width: number, height: number }>}
 */
export async function captureSelection(viewRef, selection, layout) {
  if (!viewRef?.current || !selection || !layout?.width || !layout?.height) {
    throw new Error('Please select an area on the document.');
  }
  if (selection.w < MIN_SNIP_PX || selection.h < MIN_SNIP_PX) {
    throw new Error('That selection is too small — drag a larger area.');
  }

  const shotUri = await captureRef(viewRef, {
    format: 'jpg',
    quality: 1, // Re-encoded below; compressing twice only loses detail the OCR needs.
    result: 'tmpfile',
  });

  const shot = await imageSize(shotUri);

  // captureRef renders at device pixels while the selection is in dp — one scale factor per axis
  // rather than assuming PixelRatio, because the two can disagree after a resize.
  const scaleX = shot.width / layout.width;
  const scaleY = shot.height / layout.height;

  // Clamp to the captured bitmap; a drag that ran past the edge would otherwise throw natively.
  const originX = Math.max(0, Math.round(selection.x * scaleX));
  const originY = Math.max(0, Math.round(selection.y * scaleY));
  const width = Math.max(1, Math.min(Math.round(selection.w * scaleX), shot.width - originX));
  const height = Math.max(1, Math.min(Math.round(selection.h * scaleY), shot.height - originY));

  const actions = [{ crop: { originX, originY, width, height } }];

  const longest = Math.max(width, height);
  if (longest > MAX_CROP_SIDE) {
    const k = MAX_CROP_SIDE / longest;
    actions.push({
      resize: { width: Math.round(width * k), height: Math.round(height * k) },
    });
  }

  const out = await ImageManipulator.manipulateAsync(shotUri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: out.uri, width: out.width, height: out.height };
}
