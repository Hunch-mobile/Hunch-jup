import "../global.css";

import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text } from 'react-native';
import 'react-native-reanimated';

import { AuthInitializer } from '@/components/AuthInitializer';
import { UserProvider } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    WinkySans: require('../assets/fonts/WinkySans-VariableFont_wght.ttf'),
    BBHSansHegarty: require('../assets/fonts/BBHSansHegarty.ttf'),
    RobotoRoundRegular: require('../assets/fonts/Roboto-Round-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();

      // Set global default font for all Text components
      // Cast to any because defaultProps is deprecated but still works
      const TextComponent = Text as any;
      if (!TextComponent.defaultProps) {
        TextComponent.defaultProps = {};
      }
      const defaultStyle = TextComponent.defaultProps.style || {};
      TextComponent.defaultProps.style = Array.isArray(defaultStyle)
        ? [...defaultStyle, { fontFamily: 'RobotoRoundRegular' }]
        : [defaultStyle, { fontFamily: 'RobotoRoundRegular' }];
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <PrivyProvider
      appId={Constants.expoConfig?.extra?.privyAppId}
      clientId={Constants.expoConfig?.extra?.privyClientId}
    >
      <AuthInitializer>
        <UserProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
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
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
          <PrivyElements />
        </UserProvider>
      </AuthInitializer>
    </PrivyProvider>
  );
}
