import { Buffer } from 'buffer';
import 'react-native-get-random-values';
import "../global.css";

global.Buffer = Buffer;

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthInitializer } from '@/components/AuthInitializer';
import { PushNotificationProvider } from '@/components/PushNotificationProvider';
import { UserProvider, useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { OnboardingStep } from '@/lib/types';
import '@/lib/pushNotifications'; // Sets up setNotificationHandler at app root
import { usePrivy } from '@privy-io/expo';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'login',
};

function resolveOnboardingRoute(
  step?: OnboardingStep,
  completed?: boolean,
  hasTwitterLinked?: boolean,
  username?: string | null
) {
  if (completed) return '/(tabs)';
  switch (step) {
    case 'LINK_X':
      // Twitter users already have X linked — skip to username or further
      if (hasTwitterLinked) {
        return username ? '/preferences' : '/onboarding/username';
      }
      return '/onboarding/link-x';
    case 'USERNAME':
      // If username already claimed (e.g. via link-x auto-claim), skip ahead
      return username ? '/preferences' : '/onboarding/username';
    case 'INTERESTS':
      return '/preferences';
    case 'SUGGESTED_FOLLOWERS':
      return '/suggested-followers';
    case 'COMPLETE':
    default:
      return '/(tabs)';
  }
}

function AuthFlowGate() {
  const router = useRouter();
  const segments = useSegments();
  const { isReady, user } = usePrivy();
  const { backendUser, isLoading: isBackendUserLoading } = useUser();

  useEffect(() => {
    if (!isReady || isBackendUserLoading) return;

    const root = segments[0];
    const inLogin = root === 'login';
    const inTabs = root === '(tabs)';
    const inOnboarding =
      root === 'onboarding' || root === 'preferences' || root === 'suggested-followers';

    if (!user && (inTabs || inOnboarding)) {
      router.replace('/login');
      return;
    }

    // User is authenticated, but backend user not restored/synced yet:
    // force login screen where sync bootstrap logic runs.
    if (user && !backendUser && !inLogin) {
      router.replace('/login');
      return;
    }

    if (!user || !backendUser) return;

    const hasTwitterLinked = Boolean(
      user.linked_accounts?.some((a: any) => a.type === 'twitter_oauth')
    );

    const target = resolveOnboardingRoute(
      backendUser.onboardingStep as OnboardingStep | undefined,
      backendUser.hasCompletedOnboarding,
      hasTwitterLinked,
      backendUser.username
    );

    if (inLogin) {
      router.replace(target as any);
      return;
    }

    if (inTabs && !backendUser.hasCompletedOnboarding) {
      router.replace(target as any);
      return;
    }

    if (inOnboarding && backendUser.hasCompletedOnboarding) {
      router.replace('/(tabs)');
    }
  }, [isReady, isBackendUserLoading, user, backendUser, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Load Inter fonts for Android/Web (avoid loading system fonts for iOS)
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();

      // Set global default font for all Text components based on Platform
      // iOS: undefined (System). Android/Web: Inter.
      const TextComponent = Text as any;
      if (!TextComponent.defaultProps) {
        TextComponent.defaultProps = {};
      }
      const defaultStyle = TextComponent.defaultProps.style || {};

      const fontFamily = Platform.select({
        ios: undefined,
        default: 'Inter_400Regular',
      });

      // Only apply fontFamily if it's defined (i.e., not iOS)
      if (fontFamily) {
        TextComponent.defaultProps.style = Array.isArray(defaultStyle)
          ? [...defaultStyle, { fontFamily }]
          : [defaultStyle, { fontFamily }];
      }
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <PrivyProvider
      appId={Constants.expoConfig?.extra?.privyAppId}
      clientId={Constants.expoConfig?.extra?.privyClientId}
      config={{
        embedded: {
          solana: {
            createOnLogin: 'users-without-wallets'
          }
        }
      }}
    >
      <AuthInitializer>
        <UserProvider>
          <PushNotificationProvider>
          <AuthFlowGate />
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/link-x" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/username" options={{ headerShown: false }} />
                <Stack.Screen name="preferences" options={{ headerShown: false }} />
                <Stack.Screen name="suggested-followers" options={{ headerShown: false }} />
                <Stack.Screen
                  name="event/[ticker]"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                  }}
                />
                <Stack.Screen
                  name="market/[ticker]"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                  }}
                />
                <Stack.Screen
                  name="user/[userId]"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                  }}
                />
                <Stack.Screen
                  name="user/followers/[userId]"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                  }}
                />
                <Stack.Screen
                  name="trade/[tradeId]"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                  }}
                />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </GestureHandlerRootView>
          <PrivyElements />
          </PushNotificationProvider>
        </UserProvider>
      </AuthInitializer>
    </PrivyProvider>
  );
}
