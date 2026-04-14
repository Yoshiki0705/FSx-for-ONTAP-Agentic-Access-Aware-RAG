/**
 * Property Tests for AgentCore Policy i18n
 *
 * Feature: agentcore-policy
 * Property 8: Template translations exist for 8 languages × 3 templates
 * Property 15: i18n key completeness for 8 languages
 */
import * as fc from 'fast-check';

// Import all 8 language files
import ja from '@/messages/ja.json';
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import zhCN from '@/messages/zh-CN.json';
import zhTW from '@/messages/zh-TW.json';
import fr from '@/messages/fr.json';
import de from '@/messages/de.json';
import es from '@/messages/es.json';

const LANGUAGES = {
  ja, en, ko, 'zh-CN': zhCN, 'zh-TW': zhTW, fr, de, es,
} as Record<string, any>;

const LANG_CODES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'] as const;
const TEMPLATE_IDS = ['security', 'cost', 'flexibility'] as const;

const POLICY_KEYS = [
  'sectionTitle', 'templateLabel', 'templateNone',
  'securityName', 'securityDesc', 'securityText',
  'costName', 'costDesc', 'costText',
  'flexibilityName', 'flexibilityDesc', 'flexibilityText',
  'inputLabel', 'inputPlaceholder', 'charCount',
  'badge', 'noPolicy',
  'deleteConfirmTitle', 'deleteConfirmMessage', 'deleteConfirmButton', 'cancelButton',
  'saveError', 'deleteError',
  'evaluationBlocked', 'evaluationFailed',
  'detailTitle',
] as const;

// ============================================================
// Property 8: Template translations exist for 8 languages × 3 templates
// ============================================================
describe('Property 8: Template translations exist for 8 languages × 3 templates', () => {
  /**
   * **Validates: Requirements 6.3, 11.4**
   *
   * For any (language, template) pair (8 × 3 = 24 combinations),
   * the translation text exists and is non-empty.
   */
  it('all 24 language × template combinations have non-empty translations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LANG_CODES),
        fc.constantFrom(...TEMPLATE_IDS),
        (lang, templateId) => {
          const messages = LANGUAGES[lang];
          expect(messages).toBeDefined();

          const policy = messages.agentDirectory?.policy;
          expect(policy).toBeDefined();

          const textKey = `${templateId}Text`;
          const nameKey = `${templateId}Name`;
          const descKey = `${templateId}Desc`;

          expect(typeof policy[textKey]).toBe('string');
          expect(policy[textKey].length).toBeGreaterThan(0);
          expect(typeof policy[nameKey]).toBe('string');
          expect(policy[nameKey].length).toBeGreaterThan(0);
          expect(typeof policy[descKey]).toBe('string');
          expect(policy[descKey].length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 15: i18n key completeness for 8 languages
// ============================================================
describe('Property 15: i18n key completeness for 8 languages', () => {
  /**
   * **Validates: Requirements 11.1**
   *
   * For any supported language, all agentDirectory.policy.* keys
   * exist and are non-empty strings.
   */
  it('all policy keys exist and are non-empty in every language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LANG_CODES),
        (lang) => {
          const messages = LANGUAGES[lang];
          expect(messages).toBeDefined();

          const policy = messages.agentDirectory?.policy;
          expect(policy).toBeDefined();

          for (const key of POLICY_KEYS) {
            expect(typeof policy[key]).toBe('string');
            expect(policy[key].length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
