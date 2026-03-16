/**
 * Production-ready push notifications for Hunch
 * - Permission requested only after login
 * - Expo Push Token registration with backend
 * - Deep link handling for TRADE notifications
 * - Foreground notification display
 * - Token refresh handling
 * - EAS Build compatible (requires expo-notifications plugin)
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ANDROID_NOTIFICATION_CHANNEL_ID = 'hunch-default';

// Notification data types from backend
export interface TradeNotificationData {
  type: 'TRADE';
  tradeId: string;
  [key: string]: unknown;
}

export type NotificationData = TradeNotificationData;

// Configure how notifications are presented when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldAnimate: true,
  }),
});

/**
 * Get the EAS project ID for push token (required for EAS builds)
 */
function getProjectId(): string | undefined {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  return projectId;
}

/**
 * Check if we're on a physical device (push not supported on simulators)
 */
function isPhysicalDevice(): boolean {
  return Platform.OS === 'web' ? false : Device.isDevice;
}

/**
 * Request notification permissions.
 * Only prompts if not yet determined; avoids duplicate prompts.
 * Returns status without re-prompting if already denied/blocked.
 */
export async function requestNotificationPermissions(): Promise<Notifications.PermissionStatus> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === Notifications.PermissionStatus.GRANTED) {
    return existingStatus;
  }

  // iOS: once denied, the system won't show the prompt again.
  // Android: re-requesting can still show the prompt unless "Don't ask again" was selected.
  if (
    existingStatus === Notifications.PermissionStatus.DENIED &&
    Platform.OS === 'ios'
  ) {
    return existingStatus;
  }

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status;
}

/**
 * Configure Android notification channel.
 * Must exist before receiving/displaying remote notifications on Android.
 */
export async function configureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
    name: 'General',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FFE500',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Get current permission status without prompting
 */
export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Generate Expo Push Token.
 * Requires projectId for EAS builds. Safe to call multiple times.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!isPhysicalDevice()) return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[Push] EAS projectId not found - push tokens may not work in production');
  }

  try {
    await configureAndroidNotificationChannel();
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    return token.data;
  } catch (error) {
    if (Platform.OS === 'android') {
      console.error(
        '[Push] Android push token failed. This usually means FCM is not configured (missing google-services.json / EAS FCM credentials).'
      );
    }
    console.error('[Push] Failed to get Expo Push Token:', error);
    return null;
  }
}

/**
 * Register for push notifications and return the token if permission granted.
 * Call this only after user has logged in.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const status = await requestNotificationPermissions();
  if (status !== Notifications.PermissionStatus.GRANTED) {
    return null;
  }

  // Android token retrieval can be briefly delayed on fresh installs.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = await getExpoPushToken();
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  return null;
}
