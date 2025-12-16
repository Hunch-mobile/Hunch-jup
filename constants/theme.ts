/**
 * Dark Professional Theme with Electric Cyan Accent
 * Brand color: #3FE3FF (electric cyan) - Use sparingly for CTAs, active states, key indicators
 */

import { Platform } from 'react-native';

// Brand accent color
const brandAccent = '#3FE3FF';

// Dark theme palette
export const Theme = {
  // Brand
  accent: brandAccent,

  // Backgrounds
  bgMain: '#000000',
  bgCard: '#111827',
  bgElevated: '#161C24',

  // Borders
  border: '#1F2937',

  // Text hierarchy
  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textDisabled: '#6B7280',

  // State colors
  success: '#4ade80',
  error: '#f87171',

  // Component-specific
  accentMuted: 'rgba(63, 227, 255, 0.1)',
  accentLight: 'rgba(63, 227, 255, 0.15)',
  accentMedium: 'rgba(63, 227, 255, 0.2)',

  // Legacy support
  successMuted: 'rgba(74, 222, 128, 0.15)',
  errorMuted: 'rgba(248, 113, 113, 0.15)',
};

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: Theme.textPrimary,
    background: Theme.bgMain,
    tint: Theme.accent,
    icon: Theme.textSecondary,
    tabIconDefault: Theme.textSecondary,
    tabIconSelected: Theme.accent,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
