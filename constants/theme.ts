/**
 * Minimal Black & White Theme with Clean Design
 * Pure monochrome with subtle accent for critical interactions
 */

import { Platform } from 'react-native';

// Minimal accent - used sparingly for critical actions only
const minimalAccent = '#000000'; // Pure black for primary actions

// Clean monochrome palette
export const Theme = {
  // Primary Colors
  accent: minimalAccent,
  accentSubtle: '#333333', // Subtle dark gray for secondary actions

  // Backgrounds - Clean whites and light grays
  bgMain: '#FFFFFF', // Pure white background
  bgCard: '#FAFAFA', // Very light gray for cards
  bgElevated: '#F5F5F5', // Light gray for elevated elements
  bgDark: '#000000', // Pure black for dark elements

  // Borders - Subtle and clean
  border: '#E5E5E5', // Light gray border
  borderLight: '#F0F0F0', // Very light border
  borderDark: '#D0D0D0', // Slightly darker border for emphasis

  // Text hierarchy - High contrast
  textPrimary: '#000000', // Pure black for primary text
  textSecondary: '#666666', // Medium gray for secondary text
  textDisabled: '#999999', // Light gray for disabled text
  textInverse: '#FFFFFF', // White text on dark backgrounds

  // State colors - Minimal and clean
  success: '#000000', // Black for success (minimal approach)
  error: '#DC2626', // Subtle red for errors only
  warning: '#666666', // Gray for warnings

  // Component-specific - Subtle overlays
  accentMuted: 'rgba(0, 0, 0, 0.04)', // Very subtle black overlay
  accentLight: 'rgba(0, 0, 0, 0.08)', // Light black overlay
  accentMedium: 'rgba(0, 0, 0, 0.12)', // Medium black overlay

  // Special overlays
  overlay: 'rgba(0, 0, 0, 0.5)', // Modal overlay
  shadowColor: 'rgba(0, 0, 0, 0.1)', // Shadow color
  glassEffect: 'rgba(255, 255, 255, 0.9)', // Glass morphism effect

  // Legacy support - Monochrome versions
  successMuted: 'rgba(0, 0, 0, 0.08)',
  errorMuted: 'rgba(220, 38, 38, 0.08)',

  // Chart colors - Vibrant palette for mini charts
  chartPositive: '#FFD93D',       // Bright yellow for positive trends
  chartNegative: '#000000',       // Black for negative trends
  chartNeutral: '#22c55e',        // Green for neutral
  chartGradientStart: '#FFD93D',  // Yellow gradient start
  chartGradientEnd: '#FF6B9D',    // Pink gradient end
  chartLine: '#F97316',           // Orange for main line
  chartDot: '#FBBF24',            // Amber for data points
  chartBackground: 'rgba(255, 217, 61, 0.1)', // Subtle yellow background
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
