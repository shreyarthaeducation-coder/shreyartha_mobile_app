import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

/**
 * Capture a view and hand it to the OS share sheet.
 *
 * Replaces the web's `School/shared/pdfCapture.js`, which rasterises a live DOM node with
 * html2canvas, slices the resulting tall PNG across A4 pages by negative Y offset, and triggers a
 * browser download. None of that has a React Native equivalent — and a phone has no "Downloads"
 * folder worth targeting anyway, so sharing to WhatsApp or mail is the more useful ending.
 *
 * The caller wraps the report in a `<View ref={...} collapsable={false}>`. `collapsable={false}` is
 * required on Android: without it React Native may flatten a plain wrapper View out of the native
 * hierarchy, and `captureRef` then has nothing to capture.
 *
 * @param {object} viewRef        ref to the view being captured
 * @param {string} [filename]     shown as the share title on some targets
 * @returns {Promise<boolean>}    false when sharing isn't available on the device
 */
export async function captureAndShare(viewRef, filename = 'report') {
  if (!viewRef?.current) return false;

  const uri = await captureRef(viewRef, {
    format: 'png',
    quality: 1,
    // Matches the web's html2canvas scale: 2 — a report full of small type is unreadable at 1x.
    result: 'tmpfile',
  });

  if (!(await Sharing.isAvailableAsync())) return false;

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: filename,
    UTI: 'public.png',
  });
  return true;
}
