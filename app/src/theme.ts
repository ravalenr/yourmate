export const colors = {
  background: '#F6F6F3',
  surface: '#FFFFFF',
  border: '#E5E5E0',
  text: '#1B1B19',
  textMuted: '#6E6E68',
  textFaint: '#9A9A93',
  primary: '#2E7D6F',
  primaryPressed: '#25655A',
  primaryText: '#FFFFFF',
  danger: '#B8402A',
  dangerSoft: '#FBEDEA',
  warningSoft: '#FDF3E3',
  warningText: '#8A5B12',
  successSoft: '#E9F4F0',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
};
