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
 * connection, which is exactly the situation a rep is in. Only when it yields nothing usable does
 * this fall back to the server's Google Geocoding proxy — where the key lives, so it never ships
 * in this bundle.
 *
 * Returns an empty object rather than throwing: the pincode field is editable, and typing it is a
 * perfectly good fallback.
 *
 * ── THE ADDRESS AND THE PINCODE ARE SEPARATE ANSWERS ────────────────────────
 * This used to return the whole result ONLY `if (first?.postalCode)`. A reverse-geocode that gave a
 * perfectly good street address but no postal code was therefore discarded in full — and outside a
 * town that is the common shape of the answer, not an edge case. They are now independent: either
 * can come back on its own, and the caller decides what to do with each.
 *
 * The device result is still preferred WHOLE where it has both. The server is consulted when the
 * device produced neither — and, separately, when it produced an address but no pincode, since the
 * pincode is what the visit is filed under.
 */
export async function resolvePincode(latitude, longitude) {
  if (latitude == null || longitude == null) return {};

  const out = {};

  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = results?.[0];
    if (first) {
      if (first.postalCode) {
        out.pincode = String(first.postalCode).replace(/\D/g, '').slice(0, 6);
      }
      const address = [first.name, first.street, first.district, first.city, first.region]
        .filter(Boolean)
        .join(', ');
      if (address) out.address = address;
      if (first.city) out.city = first.city;
      if (first.region) out.state = first.region;
      if (out.pincode || out.address) out.source = 'device';
    }
  } catch {
    // Fall through to the server.
  }

  // Only what the device could not supply. Note this reaches the server whenever the PINCODE is
  // missing even if an address was found, because the pincode is what the visit is filed under —
  // and the server call is a no-op returning `{available:false}` when GOOGLE_MAPS_API_KEY is unset.
  if (!out.pincode) {
    try {
      const geo = await reverseGeocode(latitude, longitude);
      if (geo?.pincode) {
        out.pincode = String(geo.pincode).replace(/\D/g, '').slice(0, 6);
        out.source = out.source || 'server';
      }
      if (!out.address && geo?.formattedAddress) {
        out.address = geo.formattedAddress;
        out.source = out.source || 'server';
      }
      if (!out.city && geo?.city) out.city = geo.city;
      if (!out.state && geo?.state) out.state = geo.state;
    } catch {
      // Both geocoders are optional.
    }
  }

  return out;
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
