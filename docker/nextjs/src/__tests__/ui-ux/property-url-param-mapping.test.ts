import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Property-Based Test: URLパラメータマッピングの一貫性 (Property 1)
 *
 * Feature: ui-ux-optimization, Property 1: URLパラメータマッピングの一貫性
 *
 * 任意のモード切替シーケンスに対して、chatMode の値と URL クエリパラメータの値は
 * 常に定義されたマッピングに一致すること:
 *   - 'kb'           → undefined (パラメータなし)
 *   - 'single-agent' → 'agent'
 *   - 'multi-agent'  → 'multi-agent'
 *
 * **Validates: Requirements 1.3**
 */

// Mock next-intl before importing the component
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/genai',
}));

// Mock the header store
vi.mock('@/store/useHeaderStore', () => ({
  useHeaderStore: () => vi.fn(),
}));

import * as fc from 'fast-check';
import { getModeQueryParam } from '../../components/chat/UnifiedModeToggle';
import type { ChatMode } from '../../components/chat/UnifiedModeToggle';

// Feature: ui-ux-optimization, Property 1: URLパラメータマッピングの一貫性
describe('Feature: ui-ux-optimization, Property 1: URLパラメータマッピングの一貫性', () => {
  /** 期待されるマッピング定義 */
  const expectedMapping: Record<ChatMode, string | undefined> = {
    'kb': undefined,
    'single-agent': 'agent',
    'multi-agent': 'multi-agent',
  };

  it('全モードに対して getModeQueryParam が定義されたマッピングに一致する', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ChatMode>('kb', 'single-agent', 'multi-agent'),
        (mode: ChatMode) => {
          const result = getModeQueryParam(mode);
          expect(result).toBe(expectedMapping[mode]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
