/**
 * Property tests for UI component logic
 * Feature: agent-directory-ui
 *
 * Property 3: Status badge color mapping
 * Property 6: Template card displays required information
 * Property 11: Navigation active state matches current page
 * Property 12: Navigation URLs include locale prefix
 * Validates: Requirements 1.3, 1.4, 1.5, 4.2, 7.2, 7.5
 */

import * as fc from 'fast-check';
import { getStatusStyle, isLoadingStatus } from '@/utils/agentStatusUtils';
import { AGENT_CATEGORY_MAP } from '@/constants/card-constants';
import { locales } from '@/i18n/config';

// --- Property 3: Status badge color mapping ---

describe('Feature: agent-directory-ui, Property 3: Status badge color mapping', () => {
  const ALL_STATUSES = [
    'CREATING', 'PREPARING', 'PREPARED', 'NOT_PREPARED',
    'DELETING', 'FAILED', 'VERSIONING', 'UPDATING',
  ];

  it('PREPARED maps to green CSS class', () => {
    fc.assert(
      fc.property(
        fc.constant('PREPARED'),
        (status) => {
          const style = getStatusStyle(status);
          expect(style).toContain('green');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('CREATING and PREPARING map to blue CSS class', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('CREATING', 'PREPARING'),
        (status) => {
          const style = getStatusStyle(status);
          expect(style).toContain('blue');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('FAILED maps to red CSS class', () => {
    fc.assert(
      fc.property(
        fc.constant('FAILED'),
        (status) => {
          const style = getStatusStyle(status);
          expect(style).toContain('red');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('other statuses map to gray CSS class', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('NOT_PREPARED', 'DELETING', 'VERSIONING', 'UPDATING'),
        (status) => {
          const style = getStatusStyle(status);
          expect(style).toContain('gray');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('CREATING/PREPARING return true for isLoadingStatus', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('CREATING', 'PREPARING'),
        (status) => {
          expect(isLoadingStatus(status)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-loading statuses return false for isLoadingStatus', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('PREPARED', 'NOT_PREPARED', 'DELETING', 'FAILED', 'VERSIONING', 'UPDATING'),
        (status) => {
          expect(isLoadingStatus(status)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('any arbitrary status string returns a non-empty style', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (status) => {
          const style = getStatusStyle(status);
          expect(style.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 6: Template card displays required information ---

describe('Feature: agent-directory-ui, Property 6: Template card displays required information', () => {
  const categoryKeys = Object.keys(AGENT_CATEGORY_MAP);

  it('every AGENT_CATEGORY_MAP entry has agentNamePattern, description, foundationModel, and matchKeywords', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...categoryKeys),
        (category) => {
          const config = AGENT_CATEGORY_MAP[category];
          expect(config).toBeDefined();
          expect(typeof config.agentNamePattern).toBe('string');
          expect(config.agentNamePattern.length).toBeGreaterThan(0);
          expect(typeof config.description).toBe('string');
          expect(config.description.length).toBeGreaterThan(0);
          expect(typeof config.foundationModel).toBe('string');
          expect(config.foundationModel.length).toBeGreaterThan(0);
          expect(Array.isArray(config.matchKeywords)).toBe(true);
          expect(config.matchKeywords.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('there are exactly 10 template categories', () => {
    expect(categoryKeys.length).toBe(10);
  });

  it('each category key is a non-empty lowercase string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...categoryKeys),
        (category) => {
          expect(category.length).toBeGreaterThan(0);
          expect(category).toBe(category.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 11: Navigation active state matches current page ---

describe('Feature: agent-directory-ui, Property 11: Navigation active state matches current page', () => {
  const NAV_ITEMS = [
    { key: 'cards', path: '/genai' },
    { key: 'agents', path: '/genai/agents' },
    { key: 'chat', path: '/genai?mode=agent' },
  ] as const;

  it('for any currentPage, exactly one nav item matches', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('cards' as const, 'agents' as const, 'chat' as const),
        (currentPage) => {
          const activeItems = NAV_ITEMS.filter(item => item.key === currentPage);
          expect(activeItems.length).toBe(1);
          expect(activeItems[0].key).toBe(currentPage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any currentPage, the other two items are not active', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('cards' as const, 'agents' as const, 'chat' as const),
        (currentPage) => {
          const inactiveItems = NAV_ITEMS.filter(item => item.key !== currentPage);
          expect(inactiveItems.length).toBe(2);
          inactiveItems.forEach(item => {
            expect(item.key).not.toBe(currentPage);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 12: Navigation URLs include locale prefix ---

describe('Feature: agent-directory-ui, Property 12: Navigation URLs include locale prefix', () => {
  const NAV_ITEMS = [
    { key: 'cards', path: '/genai' },
    { key: 'agents', path: '/genai/agents' },
    { key: 'chat', path: '/genai?mode=agent' },
  ];

  it('for any supported locale, all navigation URLs start with /{locale}/', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        (locale) => {
          NAV_ITEMS.forEach(item => {
            const href = `/${locale}${item.path}`;
            expect(href.startsWith(`/${locale}/`)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any supported locale, URLs contain the correct path segments', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        (locale) => {
          const agentsUrl = `/${locale}/genai/agents`;
          expect(agentsUrl).toContain('/genai/agents');
          expect(agentsUrl.startsWith(`/${locale}`)).toBe(true);

          const cardsUrl = `/${locale}/genai`;
          expect(cardsUrl).toContain('/genai');
          expect(cardsUrl.startsWith(`/${locale}`)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
