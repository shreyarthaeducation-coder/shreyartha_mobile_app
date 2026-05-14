// Matches the Shreyartha website brand colors
export const COLORS = {
  primary: '#b0003a',        // Brand red/maroon (from LoginDropdown gradient)
  primaryDark: '#8a002e',
  primaryLight: '#d4004a',
  secondary: '#1a1a2e',      // Dark navy (from LandingPage.css)
  accent: '#4F46E5',         // Indigo accent
  background: '#ffffff',
  surface: '#f8f9fa',
  surfaceAlt: '#f0f2f5',
  text: '#1a1a2e',
  textSecondary: '#666666',
  textLight: '#999999',
  border: '#eeeeee',
  borderDark: '#d0d0d0',
  error: '#dc3545',
  success: '#28a745',
  white: '#ffffff',
  overlay: 'rgba(26,26,46,0.6)',
};

export const FONTS = {
  regular: { fontSize: 16, color: COLORS.text },
  bold: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.secondary },
  subtitle: { fontSize: 18, color: COLORS.textSecondary },
  small: { fontSize: 13, color: COLORS.textLight },
};

export const SPACING = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  md: {
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3,
  },
  lg: {
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 6,
  },
};

// Dark futuristic student panel theme
export const STUDENT = {
  bg: '#0a0f1e',
  bgCard: '#111827',
  bgCardAlt: '#1a2236',
  bgCardGlow: '#1e2d4a',
  accent: '#4F46E5',
  accentCyan: '#06b6d4',
  accentGold: '#f59e0b',
  accentGreen: '#10b981',
  accentRose: '#f43f5e',
  border: 'rgba(79, 70, 229, 0.25)',
  borderCyan: 'rgba(6, 182, 212, 0.25)',
  glow: 'rgba(79, 70, 229, 0.15)',
  glowCyan: 'rgba(6, 182, 212, 0.12)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.4)',
  tabBar: '#0f1729',
  tabBarBorder: 'rgba(79, 70, 229, 0.3)',
  shadow: {
    shadowColor: '#4F46E5',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
};