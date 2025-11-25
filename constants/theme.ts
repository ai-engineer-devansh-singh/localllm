import { MD3DarkTheme } from 'react-native-paper';

/**
 * Colors for light and dark themes
 */
export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: '#8b5cf6',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#8b5cf6',
  },
  dark: {
    text: '#ECEDEE',
    background: '#0F172A',
    tint: '#8b5cf6',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#8b5cf6',
  },
};

/**
 * Modern Dark Theme Configuration for Local LLM Chat App
 * Vibrant gradient-inspired colors with smooth animations
 */

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Primary colors - Purple gradient
    primary: '#8b5cf6', // Vibrant purple
    primaryContainer: '#7c3aed',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#ede9fe',

    // Secondary colors - Blue gradient
    secondary: '#3b82f6', // Modern blue
    secondaryContainer: '#2563eb',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#dbeafe',

    // Background colors - Deep slate
    background: '#0F172A', // Slate 900
    onBackground: '#F1F5F9', // Slate 100

    // Surface colors - Slate variants
    surface: '#1E293B', // Slate 800
    surfaceVariant: '#334155', // Slate 700
    onSurface: '#F1F5F9',
    onSurfaceVariant: '#CBD5E1',

    // Error colors - Modern red
    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#DC2626',

    // Other colors
    outline: '#475569',
    outlineVariant: '#334155',
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: '#F1F5F9',
    inverseOnSurface: '#0F172A',
    inversePrimary: '#7c3aed',
    elevation: {
      level0: 'transparent',
      level1: '#1E293B',
      level2: '#1E293B',
      level3: '#334155',
      level4: '#334155',
      level5: '#475569',
    },

    // Custom colors for chat - Gradient themed
    userBubble: '#8b5cf6', // Purple
    userBubbleGradient: '#7c3aed', // Darker purple
    aiBubble: '#1E293B', // Slate
    aiBubbleAccent: '#334155',
    inputBackground: '#1E293B',
    timestamp: '#94A3B8',
    activeBadge: '#10B981', // Emerald
    downloadProgress: '#3b82f6', // Blue
    accentPink: '#ec4899', // Pink accent
    accentCyan: '#06b6d4', // Cyan accent
  },
  roundness: 16, // More rounded corners
};

export const typography = {
  headline: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  button: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
};

export const spacing = {
  xs: 5,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 32,
  xxxl: 40,
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 8,
  },
  glow: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
};

export const gradients = {
  primary: ['#a78bfa', '#8b5cf6', '#7c3aed'] as const,
  secondary: ['#60a5fa', '#3b82f6', '#2563eb'] as const,
  accent: ['#ec4899', '#d946ef', '#a855f7'] as const,
  background: ['#1e293b', '#0f172a', '#020617'] as const,
  subtle: ['rgba(139, 92, 246, 0.1)', 'rgba(139, 92, 246, 0.05)', 'transparent'] as const,
};

export const animations = {
  timing: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
  spring: {
    damping: 15,
    stiffness: 150,
  },
};

export const effects = {
  glassmorphism: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  blur: {
    light: 10,
    medium: 20,
    heavy: 40,
  },
};

export type AppTheme = typeof darkTheme;
