import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Lazy, *probe-first* handle on react-native-pdf.
 *
 * WHY THIS EXISTS — do not "simplify" it back to a plain import, and do not reduce it to a
 * try/catch around the require.
 *
 * `react-native-pdf` imports `react-native-blob-util`, whose `fs.js` runs
 * `TurboModuleRegistry.get('ReactNativeBlobUtil').getConstants()` **in its module body**. Without
 * the native module that registry lookup returns null and the dereference throws at *import*
 * time — nothing has to render for it to blow up.
 *
 * Two consequences, both learned the hard way on device:
 *
 * 1. A top-level import here killed the app at boot on every route, because
 *    `components/staff/index.js` is a barrel that every staff route imports, so expo-router's
 *    route scan pulled this whole chain in. In this repo a barrel import is an app-wide import.
 *
 * 2. Deferring to `require()` inside a try/catch was still not enough. Metro's
 *    `guardedLoadModule` reports a throw from a module factory to the global error handler before
 *    it ever reaches our `catch`, so the red box appears anyway and the module is left in a
 *    poisoned state.
 *
 * The only reliable answer is to **ask whether the native module exists before requiring
 * anything**. `TurboModuleRegistry.get` returns null rather than throwing (unlike `getEnforcing`),
 * so the probe itself is always safe, and the failing module body is simply never entered.
 *
 * Result: PDF viewing needs the EAS dev client; everything else in the app, this viewer's image
 * path included, keeps working in Expo Go.
 */

let cached;

/** The name react-native-blob-util registers under — see its codegenSpecs/NativeBlobUtils.js. */
const BLOB_UTIL = 'ReactNativeBlobUtil';

function nativeBlobUtilPresent() {
  try {
    if (TurboModuleRegistry?.get?.(BLOB_UTIL)) return true;
  } catch {
    // A registry that throws is a registry without the module.
  }
  return !!NativeModules?.[BLOB_UTIL];
}

/**
 * @returns {{ Pdf: any, available: boolean }} `available: false` means this build has no PDF
 *   support and the caller should render its own explanation — never a blank pane.
 */
export function loadPdf() {
  if (cached) return cached;

  if (!nativeBlobUtilPresent()) {
    cached = { Pdf: null, available: false };
    return cached;
  }

  try {
    // eslint-disable-next-line global-require
    const mod = require('react-native-pdf');
    const Pdf = mod?.default || mod;
    cached = { Pdf, available: !!Pdf };
  } catch {
    cached = { Pdf: null, available: false };
  }
  return cached;
}
