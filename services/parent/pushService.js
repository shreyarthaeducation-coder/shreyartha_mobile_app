// services/parent/pushService.js
//
// Phone push for the parent panel: school events aimed at the child's class.
//
// ══ NOTHING HERE MAY TAKE THE APP DOWN ═══════════════════════════════════════
// `expo-notifications` is a native module, and a native module imported at the top of anything the
// router reaches can crash boot on a build that lacks it — the react-native-pdf lesson recorded in
// memory. So it is required LAZILY, inside try, and every export here resolves rather than throws.
//
// Push is skipped outright:
//   • in Expo Go — remote push was removed from Expo Go on Android in SDK 53, and the token call
//     errors there;
//   • on an emulator/simulator — it cannot receive a push token;
//   • when permission is refused.
// In every one of those cases the in-app Notifications list still works; push is the extra.
//
// The token is kept in AsyncStorage (not an auth key — it identifies the phone, not the person) so
// that logout can unregister it while the session still exists. See ParentMenuScreen's
// `beforeLogout`.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerParentPushToken, unregisterParentPushToken } from './notificationService';

/** The Android channel the backend's pushes name (ParentEventNotifier.CHANNEL). */
export const PARENT_PUSH_CHANNEL = 'school-events';

const TOKEN_KEY = 'parentPushToken';

/** The native modules, or null when this build or runtime cannot do push. */
function loadNative() {
  // Expo Go: remote push is not available there (SDK 53+).
  if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') {
    return null;
  }
  try {
    // eslint-disable-next-line global-require
    const Notifications = require('expo-notifications');
    // eslint-disable-next-line global-require
    const Device = require('expo-device');
    return Notifications && Device ? { Notifications, Device } : null;
  } catch {
    return null;
  }
}

let handlerSet = false;

/** Show a push that arrives while the app is open, as a banner, rather than swallowing it. */
function ensureForegroundHandler(Notifications) {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 53+ names; shouldShowAlert kept for older runtimes.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask for permission (once), create the Android channel, get this phone's Expo token and register
 * it for the signed-in parent. Resolves to the token, or null when push is not possible.
 *
 * The channel is created BEFORE the token is requested: on Android 13+ the permission prompt only
 * appears once a channel exists, so the other order silently gets no prompt and no token.
 */
export async function registerParentPush() {
  const native = loadNative();
  if (!native) return null;
  const { Notifications, Device } = native;
  try {
    if (!Device.isDevice) return null;
    ensureForegroundHandler(Notifications);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(PARENT_PUSH_CHANNEL, {
        name: 'School events',
        description: 'Events for your child’s class — scheduled, changed, cancelled, and reminders.',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    // From config, never hardcoded: it is the EAS project the push credentials belong to.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    await registerParentPushToken(token, Platform.OS);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    // No Firebase config in this build, no network, a refused prompt — all mean "no push", never a crash.
    return null;
  }
}

/**
 * Stop pushing to this phone. MUST run before the auth keys are wiped — the call needs the token
 * that logout is about to remove. Never throws, so it can never trap the parent in the app.
 */
export async function unregisterParentPush() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await unregisterParentPushToken(token);
    } finally {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // A failed unregister leaves a token the server prunes when Expo reports it dead.
  }
}

/**
 * Call `onOpen` when the parent taps a push — including the one that launched the app from cold.
 * Returns an unsubscribe function (a no-op where push is unavailable).
 */
export function onParentPushOpened(onOpen) {
  const native = loadNative();
  if (!native) return () => {};
  const { Notifications } = native;
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      onOpen?.(response?.notification?.request?.content?.data || {});
    });
    Notifications.getLastNotificationResponseAsync?.()
      .then((response) => {
        if (response) onOpen?.(response?.notification?.request?.content?.data || {});
      })
      .catch(() => {});
    return () => sub?.remove?.();
  } catch {
    return () => {};
  }
}
