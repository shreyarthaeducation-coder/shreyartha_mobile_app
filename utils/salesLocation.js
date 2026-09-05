import * as Location from 'expo-location';
import { reverseGeocode } from '../services/sales/salesService';

/**
 * Location capture for a sales check-in.
 *
 * Distinct from `services/staffAttendanceService.captureLocation` on purpose. That one is
 * fire-and-forget at login: it races a 5 s timeout at Balanced accuracy and nobody notices if it
 * comes back empty. This one anchors a visit that incentive money is eventually computed from, so
 * it asks for High accuracy, waits longer, and reports its failure to the rep instead of
 * swallowing it.
 *
 * Never throws — a denied prompt or a dead GPS is an outcome the form has to render, not an error
 * that should stop a rep in a school corridor from logging their visit.
 */

const FIX_TIMEOUT_MS = 12000;

/** @returns {Promise<{status:'ok'|'denied'|'unavailable'|'error', latitude?, longitude?, accuracy?, message?, capturedAt:string}>} */
export async function captureVisitLocation() {
  const capturedAt = new Date().toISOString();
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return { status: 'unavailable', message: 'Location services are switched off.', capturedAt };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'denied', message: 'Location permission was not granted.', capturedAt };
    }

    // getCurrentPositionAsync takes no timeout option, so race it.
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);

    if (!position?.coords) {
      return { status: 'error', message: 'Could not get a GPS fix in time.', capturedAt };
    }

    return {
      status: 'ok',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt,
    };
  } catch (err) {
    return { status: 'error', message: err?.message || 'Location unavailable.', capturedAt };
  }
}

/**
 * Coordinates → { pincode, address, city, state }.
 *
 * Tries the OS geocoder first. It needs no API key, costs no request and often works with a weak
 * connection, which is exactly the situation a rep is in. Only when it yields no postal code does
 * this fall back to the server's Google Geocoding proxy — where the key lives, so it never ships
 * in this bundle.
 *
 * Returns an empty object rather than throwing: the pincode field is editable, and typing it is a
 * perfectly good fallback.
 */
export async function resolvePincode(latitude, longitude) {
  if (latitude == null || longitude == null) return {};

  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = results?.[0];
    if (first?.postalCode) {
      return {
        pincode: String(first.postalCode).replace(/\D/g, '').slice(0, 6),
        address: [first.name, first.street, first.district, first.city, first.region]
          .filter(Boolean)
          .join(', '),
        city: first.city || undefined,
        state: first.region || undefined,
        source: 'device',
      };
    }
  } catch {
    // Fall through to the server.
  }

  try {
    const geo = await reverseGeocode(latitude, longitude);
    if (geo?.pincode) {
      return {
        pincode: String(geo.pincode).replace(/\D/g, '').slice(0, 6),
        address: geo.formattedAddress,
        city: geo.city,
        state: geo.state,
        source: 'server',
      };
    }
  } catch {
    // Both geocoders are optional.
  }

  return {};
}

/**
 * A Google Maps embed URL for a WebView.
 *
 * The keyless `output=embed` form, deliberately. The Maps Embed API's keyed endpoint would put
 * GOOGLE_MAPS_API_KEY into the app bundle, where anyone can read it out of the APK; this variant
 * renders the same read-only pin without one. It also means no `react-native-maps` — that native
 * module would force a full store release, and versionCode here is bumped by hand with no OTA
 * channel to fall back on.
 *
 * There is nothing to drag anyway: the captured GPS is immutable by design.
 */
export function mapEmbedUrl(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  return `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
}
