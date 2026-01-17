/**
 * カスタム翻訳フック
 * 
 * next-intl の useTranslations の代替実装
 * webpack モジュールローディングエラーを回避するため、
 * シンプルな実装で翻訳機能を提供
 */

import { useCallback } from 'react';
import { type Locale } from '@/i18n/config';

// 翻訳ファイルを直接インポート
import jaMessages from '@/messages/ja.json';
import enMessages from '@/messages/en.json';
import zhCNMessages from '@/messages/zh-CN.json';
import zhTWMessages from '@/messages/zh-TW.json';
import koMessages from '@/messages/ko.json';
import frMessages from '@/messages/fr.json';
import deMessages from '@/messages/de.json';
import esMessages from '@/messages/es.json';

// 翻訳メッセージのマップ
const messages: Record<Locale, any> = {
  ja: jaMessages,
  en: enMessages,
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
  ko: koMessages,
  fr: frMessages,
  de: deMessages,
  es: esMessages
};

/**
 * カスタム翻訳フック
 * 
 * @param locale - 現在のロケール（string型を受け入れ、内部でLocale型にキャスト）
 * @returns 翻訳関数
 * 
 * @example
 * ```typescript
 * const locale = useLocale(); // string型
 * const t = useCustomTranslations(locale);
 * const text = t('button.send'); // '送信'
 * const textWithParams = t('permissions.directories', { count: 5 }); // パラメータ付き
 * ```
 */
export function useCustomTranslations(locale: string) {
  // string型をLocale型にキャスト（8言語対応）
  const validLocale = (['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'fr', 'de', 'es'].includes(locale) ? locale : 'ja') as Locale;
  
  const t = useCallback((key: string, params?: Record<string, any>): string => {
    // キーをドット区切りで分割
    const keys = key.split('.');
    let value: any = messages[validLocale];
    
    // ネストされたオブジェクトを辿る
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        // キーが見つからない場合はキー自体を返す
        return key;
      }
    }
    
    // 値が文字列でない場合はキーを返す
    if (typeof value !== 'string') {
      return key;
    }
    
    // パラメータがある場合は置換
    if (params) {
      return Object.entries(params).reduce((result, [paramKey, paramValue]) => {
        // {paramKey} の形式で置換
        return result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      }, value);
    }
    
    return value;
  }, [validLocale]);
  
  return t;
}

/**
 * 翻訳関数の型定義
 */
export type TranslationFunction = (key: string) => string;
