
export const theme = {
  colors: {
    primary: '#14253A',
    primaryDark: '#653415',
    attention: '#f70d0d',
    secondary: '#6C757D',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    text: '#212529',
    textLight: '#5E6872',
    danger: '#DC3545',
    success: '#18794E',
    border: '#DEE2E6',
    brand: '#14253A',
    subtle: '#EDF1F5',

    map: {
      background: '#0B1220',
      surface: '#101827',
      input: '#1C2738',
      border: '#37465A',
      text: '#F8FAFC',
      textLight: '#9CAEC5',
      overlay: 'rgba(0,0,0,0.65)',
    },

    marker: {
      origem: '#28A745',
      destino: '#DC3545',
      passageiro: '#007BFF',
      endereco: '#007BFF',
      van: '#7952B3',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    pill: 9999,
  },

  typography: {
    size: {
      small: 12,
      regular: 16,
      large: 20,
      title: 24,
    },
    weight: {
      regular: '400' as const,
      bold: '700' as const,
    },
  },
};

export type ThemeMode = 'light' | 'dark';
const lightColors = theme.colors;
const darkColors: typeof lightColors = {
  ...lightColors,
  primary: '#B8D8FF', primaryDark: '#C6DEF7', secondary: '#B4C1D1',
  background: '#0B1421', surface: '#162437', text: '#EDF3FB', textLight: '#B4C1D1',
  danger: '#FF8C94', success: '#69D69B', border: '#34465F', subtle: '#22354B',
};
let currentMode: ThemeMode = 'light';
const listeners = new Set<() => void>();
Object.defineProperty(theme, 'colors', { get: () => currentMode === 'dark' ? darkColors : lightColors });
export function getThemeMode() { return currentMode; }
export function subscribeTheme(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function applyTheme(mode: ThemeMode) {
  if (currentMode === mode) return;
  currentMode = mode;
  listeners.forEach(listener => listener());
}
