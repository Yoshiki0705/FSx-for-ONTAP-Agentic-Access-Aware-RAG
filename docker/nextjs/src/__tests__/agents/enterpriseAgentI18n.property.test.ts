/**
 * Property test for enterprise feature translation key completeness
 * Feature: enterprise-agent-enhancements, Property 18
 * Validates: Requirements 12.1, 12.2, 12.4
 */

import * as fc from 'fast-check';
import { locales } from '@/i18n/config';

const messagesByLocale: Record<string, any> = {};
for (const locale of locales) {
  try {
    messagesByLocale[locale] = require(`../../../messages/${locale}.json`);
  } catch {
    messagesByLocale[locale] = null;
  }
}

const TOOL_SELECTION_KEYS = ['title', 'selectTools', 'permissionAwareSearch', 'browser', 'codeInterpreter', 'noToolsAvailable', 'loadError'];
const GUARDRAILS_KEYS = ['title', 'enable', 'selectGuardrail', 'noGuardrails', 'loadError'];
const INFERENCE_PROFILE_KEYS = ['title', 'selectProfile', 'costTags', 'department', 'project', 'noProfiles', 'loadError'];
const SHARING_KEYS = ['title', 'export', 'import', 'uploadToS3', 'sharedAgents', 'preview', 'importConfirm', 'invalidJson', 'incompatibleVersion', 'uploadSuccess', 'uploadError', 'noSharedConfigs'];
const SCHEDULE_KEYS = ['title', 'cronExpression', 'description', 'inputPrompt', 'nextExecution', 'createSchedule', 'deleteSchedule', 'manualTrigger', 'executionHistory', 'invalidCron', 'scheduledTasks', 'noSchedules', 'running', 'success', 'failed'];
const TABS_KEYS = ['agents', 'shared', 'schedules'];

describe('Feature: enterprise-agent-enhancements, Property 18: Translation keys exist in all 8 locale files', () => {
  it('toolSelection keys exist in all locales', () => {
    fc.assert(fc.property(
      fc.constantFrom(...(locales as unknown as string[])),
      fc.constantFrom(...TOOL_SELECTION_KEYS),
      (locale, key) => {
        const value = messagesByLocale[locale]?.agentDirectory?.toolSelection?.[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    ), { numRuns: 100 });
  });

  it('guardrails keys exist in all locales', () => {
    fc.assert(fc.property(
      fc.constantFrom(...(locales as unknown as string[])),
      fc.constantFrom(...GUARDRAILS_KEYS),
      (locale, key) => {
        const value = messagesByLocale[locale]?.agentDirectory?.guardrails?.[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    ), { numRuns: 100 });
  });

  it('inferenceProfile keys exist in all locales', () => {
    fc.assert(fc.property(
      fc.constantFrom(...(locales as unknown as string[])),
      fc.constantFrom(...INFERENCE_PROFILE_KEYS),
      (locale, key) => {
        const value = messagesByLocale[locale]?.agentDirectory?.inferenceProfile?.[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    ), { numRuns: 100 });
  });

  it('sharing keys exist in all locales', () => {
    fc.assert(fc.property(
      fc.constantFrom(...(locales as unknown as string[])),
      fc.constantFrom(...SHARING_KEYS),
      (locale, key) => {
        const value = messagesByLocale[locale]?.agentDirectory?.sharing?.[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    ), { numRuns: 100 });
  });

  it('schedule keys exist in all locales', () => {
    fc.assert(fc.property(
      fc.constantFrom(...(locales as unknown as string[])),
      fc.constantFrom(...SCHEDULE_KEYS),
      (locale, key) => {
        const value = messagesByLocale[locale]?.agentDirectory?.schedule?.[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    ), { numRuns: 100 });
  });

  it('tabs keys exist in all locales', () => {
    fc.assert(fc.property(
      fc.constantFrom(...(locales as unknown as string[])),
      fc.constantFrom(...TABS_KEYS),
      (locale, key) => {
        const value = messagesByLocale[locale]?.agentDirectory?.tabs?.[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    ), { numRuns: 100 });
  });
});
