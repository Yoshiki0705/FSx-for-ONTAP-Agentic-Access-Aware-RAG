/**
 * 国際化（i18n）設定
 * next-intlを使用した多言語対応
 */

export const locales = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'fr', 'de', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ja';

/**
 * ロケール設定
 */
export const localeConfig = {
  locales,
  defaultLocale,
  localeDetection: false, // URLのロケールを優先（ブラウザ言語の自動検出を無効化）
};

/**
 * ロケール表示名
 */
export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

/**
 * ロケールアイコン（絵文字）
 */
export const localeIcons: Record<Locale, string> = {
  ja: '🇯🇵',
  en: '🇺🇸',
  'zh-CN': '🇨🇳',
  'zh-TW': '🇹🇼',
  ko: '🇰🇷',
  fr: '🇫🇷',
  de: '🇩🇪',
  es: '🇪🇸',
};
