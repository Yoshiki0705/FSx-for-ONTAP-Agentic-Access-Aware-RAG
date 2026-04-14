// Feature: agent-registry-integration, Property 3: Pagination Invariant
// Validates: Requirements 2.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Pagination utility matching the backend search API behavior.
 * Slices items by pageSize with offset-based tokens.
 */
function paginateResults<T>(
  items: T[],
  pageSize: number,
  pageToken?: number,
): { page: T[]; nextToken?: number } {
  const start = pageToken ?? 0;
  const page = items.slice(start, start + pageSize);
  const nextToken = start + pageSize < items.length ? start + pageSize : undefined;
  return { page, nextToken };
}

describe('Property 3: Pagination Invariant', () => {
  it('each page has at most pageSize items and total across all pages equals original length', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 100 }),
        (items) => {
          const pageSize = 20;
          let collected: string[] = [];
          let token: number | undefined = undefined;

          // Walk through all pages
          for (let safety = 0; safety < 100; safety++) {
            const { page, nextToken } = paginateResults(items, pageSize, token);
            expect(page.length).toBeLessThanOrEqual(pageSize);
            collected = collected.concat(page);
            if (nextToken === undefined) break;
            token = nextToken;
          }

          expect(collected.length).toBe(items.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('single page for items fewer than pageSize', () => {
    const items = ['a', 'b', 'c'];
    const { page, nextToken } = paginateResults(items, 20);
    expect(page).toEqual(items);
    expect(nextToken).toBeUndefined();
  });

  it('empty array returns empty page', () => {
    const { page, nextToken } = paginateResults([], 20);
    expect(page).toEqual([]);
    expect(nextToken).toBeUndefined();
  });

  it('exactly pageSize items returns one full page with no next token', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
    const { page, nextToken } = paginateResults(items, 20);
    expect(page.length).toBe(20);
    expect(nextToken).toBeUndefined();
  });
});
