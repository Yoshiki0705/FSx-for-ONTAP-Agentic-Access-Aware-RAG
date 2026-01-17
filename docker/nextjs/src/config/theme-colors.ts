/**
 * テーマカラーパレット定義
 * ライトモードとダークモードのカラー設定
 */

/**
 * HSLカラー値の型
 */
export interface HSLColor {
  h: number; // 色相 (0-360)
  s: number; // 彩度 (0-100)
  l: number; // 明度 (0-100)
}

/**
 * カラーパレット
 */
export interface ColorPalette {
  background: HSLColor;
  foreground: HSLColor;
  card: HSLColor;
  cardForeground: HSLColor;
  popover: HSLColor;
  popoverForeground: HSLColor;
  primary: HSLColor;
  primaryForeground: HSLColor;
  secondary: HSLColor;
  secondaryForeground: HSLColor;
  muted: HSLColor;
  mutedForeground: HSLColor;
  accent: HSLColor;
  accentForeground: HSLColor;
  destructive: HSLColor;
  destructiveForeground: HSLColor;
  border: HSLColor;
  input: HSLColor;
  ring: HSLColor;
}

/**
 * ライトモードのカラーパレット
 */
export const lightPalette: ColorPalette = {
  background: { h: 0, s: 0, l: 100 },
  foreground: { h: 222.2, s: 84, l: 4.9 },
  card: { h: 0, s: 0, l: 100 },
  cardForeground: { h: 222.2, s: 84, l: 4.9 },
  popover: { h: 0, s: 0, l: 100 },
  popoverForeground: { h: 222.2, s: 84, l: 4.9 },
  primary: { h: 221.2, s: 83.2, l: 53.3 },
  primaryForeground: { h: 210, s: 40, l: 98 },
  secondary: { h: 210, s: 40, l: 96.1 },
  secondaryForeground: { h: 222.2, s: 47.4, l: 11.2 },
  muted: { h: 210, s: 40, l: 96.1 },
  mutedForeground: { h: 215.4, s: 16.3, l: 46.9 },
  accent: { h: 210, s: 40, l: 96.1 },
  accentForeground: { h: 222.2, s: 47.4, l: 11.2 },
  destructive: { h: 0, s: 84.2, l: 60.2 },
  destructiveForeground: { h: 210, s: 40, l: 98 },
  border: { h: 214.3, s: 31.8, l: 91.4 },
  input: { h: 214.3, s: 31.8, l: 91.4 },
  ring: { h: 221.2, s: 83.2, l: 53.3 },
};

/**
 * ダークモードのカラーパレット
 */
export const darkPalette: ColorPalette = {
  background: { h: 222.2, s: 84, l: 4.9 },
  foreground: { h: 210, s: 40, l: 98 },
  card: { h: 222.2, s: 84, l: 4.9 },
  cardForeground: { h: 210, s: 40, l: 98 },
  popover: { h: 222.2, s: 84, l: 4.9 },
  popoverForeground: { h: 210, s: 40, l: 98 },
  primary: { h: 217.2, s: 91.2, l: 59.8 },
  primaryForeground: { h: 222.2, s: 47.4, l: 11.2 },
  secondary: { h: 217.2, s: 32.6, l: 17.5 },
  secondaryForeground: { h: 210, s: 40, l: 98 },
  muted: { h: 217.2, s: 32.6, l: 17.5 },
  mutedForeground: { h: 215, s: 20.2, l: 65.1 },
  accent: { h: 217.2, s: 32.6, l: 17.5 },
  accentForeground: { h: 210, s: 40, l: 98 },
  destructive: { h: 0, s: 62.8, l: 30.6 },
  destructiveForeground: { h: 210, s: 40, l: 98 },
  border: { h: 217.2, s: 32.6, l: 17.5 },
  input: { h: 217.2, s: 32.6, l: 17.5 },
  ring: { h: 224.3, s: 76.3, l: 48 },
};

/**
 * HSLカラーをCSS変数形式に変換
 */
export const hslToString = (color: HSLColor): string => {
  return `${color.h} ${color.s}% ${color.l}%`;
};

/**
 * カラーパレットをCSS変数オブジェクトに変換
 */
export const paletteToCSS = (palette: ColorPalette): Record<string, string> => {
  return {
    '--background': hslToString(palette.background),
    '--foreground': hslToString(palette.foreground),
    '--card': hslToString(palette.card),
    '--card-foreground': hslToString(palette.cardForeground),
    '--popover': hslToString(palette.popover),
    '--popover-foreground': hslToString(palette.popoverForeground),
    '--primary': hslToString(palette.primary),
    '--primary-foreground': hslToString(palette.primaryForeground),
    '--secondary': hslToString(palette.secondary),
    '--secondary-foreground': hslToString(palette.secondaryForeground),
    '--muted': hslToString(palette.muted),
    '--muted-foreground': hslToString(palette.mutedForeground),
    '--accent': hslToString(palette.accent),
    '--accent-foreground': hslToString(palette.accentForeground),
    '--destructive': hslToString(palette.destructive),
    '--destructive-foreground': hslToString(palette.destructiveForeground),
    '--border': hslToString(palette.border),
    '--input': hslToString(palette.input),
    '--ring': hslToString(palette.ring),
  };
};
