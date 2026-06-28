// Multiple Color Palettes for Testing
export const COLOR_PALETTES = {
  // Palette 1: NCIE Official Primary (80% usage) - Fixed for readability
  ncie_primary: {
    primary: { main: "#3C75BC", light: "#91B3E0", dark: "#0F2F57" }, // Blue (lighter for text)
    secondary: { main: "#A97233", light: "#FED702", dark: "#AC4C00" }, // Gold/Brown
    accent: { main: "#0080B3", light: "#4AC1F0", dark: "#36B4AC" }, // Blue/Teal
  },

  // Palette 2: NCIE Official Secondary (20% usage)
  ncie_secondary: {
    primary: { main: "#3C75BC", light: "#91B3E0", dark: "#0F2F57" }, // Blue
    secondary: { main: "#BE6EAB", light: "#D4AFD0", dark: "#BE4478" }, // Pink/Purple
    accent: { main: "#FED702", light: "#FFD37B", dark: "#F0832E" }, // Yellow/Orange
  },

  // Palette 3: NCIE Complete Brand (all colors) - Fixed for readability
  ncie_complete: {
    primary: { main: "#3C75BC", light: "#91B3E0", dark: "#0F2F57" }, // Blue (lighter for text)
    secondary: { main: "#A97233", light: "#FED702", dark: "#AC4C00" }, // Gold/Brown
    accent: { main: "#0080B3", light: "#4AC1F0", dark: "#36B4AC" }, // Blue/Teal
  },

  // Palette 4: NCIE Original (from logo)
  ncie_original: {
    primary: { main: "#1e3a8a", light: "#2563eb", dark: "#1e40af" }, // Dark Blue
    secondary: { main: "#60a5fa", light: "#93c5fd", dark: "#3b82f6" }, // Light Blue
    accent: { main: "#fbbf24", light: "#fcd34d", dark: "#f59e0b" }, // Yellow
  },

  // Palette 2: Professional Blue
  professional_blue: {
    primary: { main: "#1e40af", light: "#3b82f6", dark: "#1e3a8a" }, // Navy Blue
    secondary: { main: "#64748b", light: "#94a3b8", dark: "#475569" }, // Slate Gray
    accent: { main: "#0ea5e9", light: "#38bdf8", dark: "#0284c7" }, // Sky Blue
  },

  // Palette 3: Modern Green
  modern_green: {
    primary: { main: "#059669", light: "#10b981", dark: "#047857" }, // Emerald
    secondary: { main: "#6b7280", light: "#9ca3af", dark: "#4b5563" }, // Gray
    accent: { main: "#f59e0b", light: "#fbbf24", dark: "#d97706" }, // Amber
  },

  // Palette 4: Corporate Purple
  corporate_purple: {
    primary: { main: "#7c3aed", light: "#8b5cf6", dark: "#6d28d9" }, // Violet
    secondary: { main: "#64748b", light: "#94a3b8", dark: "#475569" }, // Slate
    accent: { main: "#ec4899", light: "#f472b6", dark: "#db2777" }, // Pink
  },

  // Palette 5: Warm Orange
  warm_orange: {
    primary: { main: "#ea580c", light: "#f97316", dark: "#c2410c" }, // Orange
    secondary: { main: "#78716c", light: "#a8a29e", dark: "#57534e" }, // Stone
    accent: { main: "#eab308", light: "#facc15", dark: "#ca8a04" }, // Yellow
  },

  // Palette 6: Cool Teal
  cool_teal: {
    primary: { main: "#0d9488", light: "#14b8a6", dark: "#0f766e" }, // Teal
    secondary: { main: "#64748b", light: "#94a3b8", dark: "#475569" }, // Slate
    accent: { main: "#06b6d4", light: "#22d3ee", dark: "#0891b2" }, // Cyan
  },

  // Palette 7: Bold Red
  bold_red: {
    primary: { main: "#dc2626", light: "#ef4444", dark: "#b91c1c" }, // Red
    secondary: { main: "#6b7280", light: "#9ca3af", dark: "#4b5563" }, // Gray
    accent: { main: "#f59e0b", light: "#fbbf24", dark: "#d97706" }, // Amber
  },

  // Palette 8: Elegant Gray
  elegant_gray: {
    primary: { main: "#374151", light: "#4b5563", dark: "#1f2937" }, // Gray
    secondary: { main: "#6b7280", light: "#9ca3af", dark: "#4b5563" }, // Gray
    accent: { main: "#3b82f6", light: "#60a5fa", dark: "#2563eb" }, // Blue
  },

  // Palette 9: Test Green
  test_green: {
    primary: { main: "#00ff00", light: "#33ff33", dark: "#00cc00" }, // Green
    secondary: { main: "#0066ff", light: "#3388ff", dark: "#0044cc" }, // Blue
    accent: { main: "#ff6600", light: "#ff8833", dark: "#cc4400" }, // Orange
  },

  // Palette 10: Default (normal colors)
  default: {
    primary: { main: "#3b82f6", light: "#60a5fa", dark: "#2563eb" }, // Blue
    secondary: { main: "#64748b", light: "#94a3b8", dark: "#475569" }, // Gray
    accent: { main: "#f59e0b", light: "#fbbf24", dark: "#d97706" }, // Amber
  },
} as const;

// Current active palette - change this to test different palettes
export const ACTIVE_PALETTE = "default"; // Default colors - client can change this

export const NCIE_COLORS = {
  // Primary Brand Colors - Uses active palette
  primary: COLOR_PALETTES[ACTIVE_PALETTE].primary,

  // Secondary Colors - Uses active palette
  secondary: COLOR_PALETTES[ACTIVE_PALETTE].secondary,

  // Accent Colors - Uses active palette
  accent: COLOR_PALETTES[ACTIVE_PALETTE].accent,

  // Extended Palette (for gradients and variations)
  extended: {
    // Blue variations - normal blue colors
    blue50: "#eff6ff",
    blue100: "#dbeafe",
    blue200: "#bfdbfe",
    blue300: "#93c5fd",
    blue400: "#60a5fa",
    blue500: "#3b82f6",
    blue600: "#2563eb",
    blue700: "#1d4ed8",
    blue800: "#1e40af",
    blue900: "#1e3a8a",

    // Yellow variations
    yellow50: "#fffbeb",
    yellow100: "#fef3c7",
    yellow200: "#fde68a",
    yellow300: "#fcd34d",
    yellow400: "#fbbf24",
    yellow500: "#f59e0b",
    yellow600: "#d97706",
    yellow700: "#b45309",
    yellow800: "#92400e",
    yellow900: "#78350f",
  },

  // Semantic Colors
  semantic: {
    success: "#10b981", // Green for success states
    warning: "#f59e0b", // Orange for warnings
    error: "#ef4444", // Red for errors
    info: "#3b82f6", // Blue for info
  },

  // Neutral Colors
  neutral: {
    white: "#ffffff",
    black: "#000000",
    gray50: "#f9fafb",
    gray100: "#f3f4f6",
    gray200: "#e5e7eb",
    gray300: "#d1d5db",
    gray400: "#9ca3af",
    gray500: "#6b7280",
    gray600: "#4b5563",
    gray700: "#374151",
    gray800: "#1f2937",
    gray900: "#111827",
  },
} as const;

/**
 * Theme-specific color configurations
 */
export const THEME_COLORS = {
  light: {
    background: NCIE_COLORS.neutral.white,
    surface: NCIE_COLORS.primary.light, // Changed to primary color
    border: NCIE_COLORS.primary.main, // Changed to primary color
    text: NCIE_COLORS.neutral.gray900,
    textSecondary: NCIE_COLORS.neutral.gray600,
    accent: NCIE_COLORS.primary.main, // Uses primary color
  },
  dark: {
    background: NCIE_COLORS.neutral.gray900,
    surface: NCIE_COLORS.secondary.dark, // Changed to secondary color
    border: NCIE_COLORS.secondary.main, // Changed to secondary color
    text: NCIE_COLORS.neutral.gray100,
    textSecondary: NCIE_COLORS.neutral.gray400,
    accent: NCIE_COLORS.secondary.main, // Uses secondary color
  },
} as const;

/**
 * Component-specific color mappings
 */
export const COMPONENT_COLORS = {
  // Chat interface
  chat: {
    userMessage: NCIE_COLORS.primary.main,
    aiMessage: NCIE_COLORS.neutral.gray100,
    thinkingIndicator: NCIE_COLORS.accent.main,
  },

  // Buttons and interactions
  buttons: {
    primary: NCIE_COLORS.primary.main,
    primaryHover: NCIE_COLORS.primary.light,
    secondary: NCIE_COLORS.secondary.main,
    secondaryHover: NCIE_COLORS.secondary.light,
    accent: NCIE_COLORS.accent.main,
    accentHover: NCIE_COLORS.accent.light,
  },

  // File and chart indicators
  indicators: {
    fileTag: NCIE_COLORS.primary.main,
    chartIcon: NCIE_COLORS.primary.main,
    rating: NCIE_COLORS.primary.main,
  },

  // Sidebar
  sidebar: {
    logo: NCIE_COLORS.primary.main,
    activeItem: NCIE_COLORS.primary.main,
    hoverItem: NCIE_COLORS.neutral.gray200,
  },
} as const;

/**
 * Utility function to get color with opacity
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Convert hex to RGB and add opacity
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Export all colors for easy access
 */
export default NCIE_COLORS;
