import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../services/apiService';

/**
 * Download an authenticated file and hand it to the OS share sheet.
 *
 * Used by the payslip PDF, which — unlike the exam and adaptive reports — is generated
 * server-side, so there is a real file to fetch rather than a view to screenshot.
 *
 * Imported from `expo-file-system/legacy`: SDK 54's new `File`/`Directory` API has no
 * download-with-headers equivalent, and the legacy subpath is the documented way to keep using
 * `downloadAsync`.
 *
 * THE CONTENT-TYPE CHECK IS NOT OPTIONAL. `GET /api/staff/hr/payslips/{id}/pdf` answers a failure
 * with **HTTP 400 and a JSON body**, not a PDF — so a download that skipped this would cheerfully
 * write `{"success":false,…}` to disk as `payslip-2026-08.pdf` and hand the teacher a corrupt file.
 *
 * `tokenKey` exists because this is used from both sides of the app: the staff panels hold their
 * JWT under `schoolUserToken`, the student panel under `studentToken`. Sending the wrong one is a
 * 401, and — because the failure body is JSON written to disk — it surfaces as "download failed"
 * rather than as anything that points at the token.
 *
 * @param {string} endpoint  path beginning `/api/…`
 * @param {string} filename  name the file is saved and shared under
 * @param {string} [expectedType]  substring the response Content-Type must contain
 * @param {string} [tokenKey]  AsyncStorage key holding the bearer token
 * @returns {Promise<{ shared: boolean, uri: string }>}
 */
export async function downloadAndShare(
  endpoint,
  filename,
  expectedType = 'application/pdf',
  tokenKey = 'schoolUserToken',
) {
  const token = await AsyncStorage.getItem(tokenKey);
  const target = `${FileSystem.cacheDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(`${API_BASE_URL}${endpoint}`, target, {
    headers: token ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` } : {},
  });

  if (result.status < 200 || result.status >= 300) {
    // The body on disk is the JSON error envelope; read it back for the real message.
    let message = `Download failed (${result.status}).`;
    try {
      const body = await FileSystem.readAsStringAsync(result.uri);
      const parsed = JSON.parse(body);
      if (parsed?.message) message = parsed.message;
    } catch {
      // Not JSON either — keep the status message.
    }
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error(message);
  }

  const contentType =
    result.headers?.['Content-Type'] || result.headers?.['content-type'] || '';
  if (expectedType && !contentType.toLowerCase().includes(expectedType)) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error('The server did not return a file. Please try again.');
  }

  if (!(await Sharing.isAvailableAsync())) {
    return { shared: false, uri: result.uri };
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: expectedType || undefined,
    dialogTitle: filename,
    UTI: expectedType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
  return { shared: true, uri: result.uri };
}
