/**
 * Property 3: Media Type Icon Mapping
 *
 * For *any* search result, `mediaType` of `text` → 📄, `image` → 🖼️,
 * `video` → 🎥, `audio` → 🔊, and unknown values → default 📄.
 * The mapping is bijective for known types and deterministic for all inputs.
 *
 * **Validates: Requirements 4.1**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getMediaTypeIcon,
  MEDIA_TYPE_ICONS,
} from '@/components/chat/MediaTypeIndicator';

// ---------------------------------------------------------------------------
// Expected mapping
// ---------------------------------------------------------------------------

const EXPECTED: Record<string, string> = {
  text: '📄',
  image: '🖼️',
  video: '🎥',
  audio: '🔊',
};

const VALID_TYPES = Object.keys(EXPECTED);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 3: Media Type Icon Mapping', () => {
  it('known mediaType values always return the correct icon', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_TYPES), (mediaType) => {
        expect(getMediaTypeIcon(mediaType)).toBe(EXPECTED[mediaType]);
      }),
      { numRuns: 200 },
    );
  });

  it('unknown mediaType strings always return the default icon (📄)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) => !VALID_TYPES.includes(s),
        ),
        (unknownType) => {
          expect(getMediaTypeIcon(unknownType)).toBe(EXPECTED.text);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('undefined / empty input returns the default icon (📄)', () => {
    expect(getMediaTypeIcon(undefined)).toBe(EXPECTED.text);
    expect(getMediaTypeIcon('')).toBe(EXPECTED.text);
  });

  it('mapping is deterministic — same input always yields same output', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 30 }), (input) => {
        const first = getMediaTypeIcon(input);
        const second = getMediaTypeIcon(input);
        expect(first).toBe(second);
      }),
      { numRuns: 200 },
    );
  });

  it('MEDIA_TYPE_ICONS constant covers exactly the four known types', () => {
    expect(Object.keys(MEDIA_TYPE_ICONS).sort()).toEqual(VALID_TYPES.sort());
  });

  it('mapping is injective for known types — no two types share an icon', () => {
    const icons = VALID_TYPES.map((t) => getMediaTypeIcon(t));
    const unique = new Set(icons);
    expect(unique.size).toBe(VALID_TYPES.length);
  });
});
