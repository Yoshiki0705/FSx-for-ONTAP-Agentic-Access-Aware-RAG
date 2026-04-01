/**
 * i18n翻訳キー完全性 プロパティベーステスト
 *
 * Feature: cognito-ad-federation, Property 7: i18n翻訳キー完全性
 * **Validates: Requirements 3.7**
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'] as const;
const REQUIRED_KEYS = ['adSignIn', 'adSignInDesc', 'orDivider', 'emailSignIn'] as const;
const MESSAGES_DIR = path.join(__dirname, '../../docker/nextjs/src/messages');

describe('Property 7: i18n翻訳キー完全性', () => {
  // Feature: cognito-ad-federation, Property 7: i18n翻訳キー完全性
  // **Validates: Requirements 3.7**

  it('8言語すべてにAD Federation関連の翻訳キーが非空文字列として存在する', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCALES),
        fc.constantFrom(...REQUIRED_KEYS),
        (locale, key) => {
          const filePath = path.join(MESSAGES_DIR, `${locale}.json`);

          // ファイルが存在すること
          expect(fs.existsSync(filePath)).toBe(true);

          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // signin セクションが存在すること
          expect(content.signin).toBeDefined();
          expect(typeof content.signin).toBe('object');

          // キーが存在し、非空文字列であること
          const value = content.signin[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
