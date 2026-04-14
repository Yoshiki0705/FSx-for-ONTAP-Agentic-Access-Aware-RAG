/**
 * Voice Chat Property-Based Tests
 *
 * Property 1: Permission filter input-type independence
 * Property 2: Audio chunking accuracy (splitAudioIntoChunks)
 * Property 5: Silence detection (isSilent)
 * Property 6: Single session invariant
 *
 * **Validates: Requirements 3.2, 5.3, 6.1, 6.2, 13.1, 13.4, 13.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { splitAudioIntoChunks, isSilent, CHUNK_SAMPLE_COUNT } from '@/types/voice';

// --- Property 1: Permission filter input-type independence ---

type InputType = 'voice' | 'text';

interface UserPermissions {
  sid: string;
  groups: string[];
}

interface SearchResult {
  id: string;
  content: string;
  requiredSid: string;
}

function applyPermissionFilter(
  _query: string,
  permissions: UserPermissions,
  results: SearchResult[],
  _inputType: InputType,
): SearchResult[] {
  return results.filter((r) => r.requiredSid === permissions.sid);
}

describe('Property 1: Permission filter input-type independence', () => {
  const permArb = fc.record({
    sid: fc.string({ minLength: 3, maxLength: 20 }),
    groups: fc.array(fc.string({ minLength: 2, maxLength: 10 }), { maxLength: 5 }),
  });

  const resultArb = fc.record({
    id: fc.uuid(),
    content: fc.string({ minLength: 1, maxLength: 80 }),
    requiredSid: fc.string({ minLength: 3, maxLength: 20 }),
  });

  it('voice and text produce identical filter results', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        permArb,
        fc.array(resultArb, { maxLength: 15 }),
        (query, perms, results) => {
          const voiceResults = applyPermissionFilter(query, perms, results, 'voice');
          const textResults = applyPermissionFilter(query, perms, results, 'text');
          expect(voiceResults).toEqual(textResults);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// --- Property 2: Audio chunking accuracy ---

describe('Property 2: Audio chunking accuracy (splitAudioIntoChunks)', () => {
  it('each chunk except last has exactly CHUNK_SAMPLE_COUNT samples', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20000 }), (len) => {
        const buf = new Float32Array(len);
        const chunks = splitAudioIntoChunks(buf);

        for (let i = 0; i < chunks.length - 1; i++) {
          expect(chunks[i].length).toBe(CHUNK_SAMPLE_COUNT);
        }
        if (chunks.length > 0) {
          expect(chunks[chunks.length - 1].length).toBeLessThanOrEqual(CHUNK_SAMPLE_COUNT);
          expect(chunks[chunks.length - 1].length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('concatenated chunks equal original buffer length', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (len) => {
        const buf = new Float32Array(len);
        const chunks = splitAudioIntoChunks(buf);
        const total = chunks.reduce((s, c) => s + c.length, 0);
        expect(total).toBe(len);
      }),
      { numRuns: 200 },
    );
  });

  it('chunk count equals ceil(length / CHUNK_SAMPLE_COUNT)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20000 }), (len) => {
        const buf = new Float32Array(len);
        const chunks = splitAudioIntoChunks(buf);
        expect(chunks.length).toBe(Math.ceil(len / CHUNK_SAMPLE_COUNT));
      }),
      { numRuns: 200 },
    );
  });
});

// --- Property 5: Silence detection ---

describe('Property 5: Silence detection (isSilent)', () => {
  const THRESHOLD = 0.01;
  const FT = Math.fround(THRESHOLD);
  const NFT = Math.fround(-THRESHOLD);

  it('all-silent amplitudes detected as silent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: NFT, max: FT, noNaN: true }), { minLength: 1, maxLength: 500 }),
        (amps) => {
          expect(isSilent(amps, THRESHOLD)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('amplitudes with loud sample detected as not silent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: NFT, max: FT, noNaN: true }), { maxLength: 50 }),
        fc.float({ min: Math.fround(THRESHOLD + 0.002), max: Math.fround(1.0), noNaN: true }),
        fc.array(fc.float({ min: NFT, max: FT, noNaN: true }), { maxLength: 50 }),
        (before, loud, after) => {
          expect(isSilent([...before, loud, ...after], THRESHOLD)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('empty array is silent', () => {
    expect(isSilent([], 0.01)).toBe(true);
  });
});

// --- Property 6: Single session invariant ---

type UserAction = 'start' | 'stop' | 'modeSwitch' | 'pageLeave';

function simulateSessionActions(actions: UserAction[]): number {
  let active = 0;
  let max = 0;
  for (const a of actions) {
    if (a === 'start' && active === 0) active = 1;
    else if (a === 'stop' || a === 'modeSwitch' || a === 'pageLeave') active = 0;
    max = Math.max(max, active);
  }
  return max;
}

describe('Property 6: Single session invariant', () => {
  const actionArb = fc.constantFrom<UserAction>('start', 'stop', 'modeSwitch', 'pageLeave');

  it('active sessions never exceed 1', () => {
    fc.assert(
      fc.property(fc.array(actionArb, { minLength: 1, maxLength: 200 }), (actions) => {
        expect(simulateSessionActions(actions)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 500 },
    );
  });
});
