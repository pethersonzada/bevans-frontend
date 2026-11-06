export const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    attention: '#f70d0d',
    secondary: '#6C757D',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    text: '#212529',
    textLight: '#6C757D',
    danger: '#DC3545',
    success: '#28A745',
    border: '#DEE2E6',
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
    }
  }
};