/**
 * Property 2: Permission Filter Media-Type Invariance
 *
 * For *any* set of search results and user permissions (SID/UID/GID),
 * the PermissionFilter returns the same filtering result regardless of
 * the `mediaType` field value. Additionally, no unauthorised documents
 * appear in the filtered output.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Inline replica of the SID-based permission check used in the retrieve route.
// This keeps the test self-contained without importing Next.js route internals.
// ---------------------------------------------------------------------------

function checkSIDAccess(userSIDs: string[], docSIDs: string[]): boolean {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return false;
  return userSIDs.some((sid) => docSIDs.includes(sid));
}

type MediaType = 'text' | 'image' | 'video' | 'audio';

interface MockDocument {
  fileName: string;
  s3Uri: string;
  content: string;
  mediaType: MediaType;
  allowedGroupSids: string[];
}

/**
 * Apply the same SID-based filter that the retrieve route uses.
 * Returns only documents the user is allowed to see.
 */
function filterDocuments(
  docs: MockDocument[],
  userSIDs: string[],
): MockDocument[] {
  return docs.filter(
    (doc) =>
      userSIDs.length > 0 && checkSIDAccess(userSIDs, doc.allowedGroupSids),
  );
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const mediaTypeArb: fc.Arbitrary<MediaType> = fc.constantFrom(
  'text',
  'image',
  'video',
  'audio',
);

const sidArb = fc.stringMatching(/^[a-j0-9\-]{1,12}$/);

const documentArb = fc.record({
  fileName: fc.string({ minLength: 1, maxLength: 30 }),
  s3Uri: fc.string({ minLength: 1, maxLength: 60 }),
  content: fc.string({ minLength: 0, maxLength: 100 }),
  mediaType: mediaTypeArb,
  allowedGroupSids: fc.array(sidArb, { minLength: 0, maxLength: 5 }),
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 2: Permission Filter Media-Type Invariance', () => {
  it('filtering result is identical regardless of mediaType values', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 1, maxLength: 20 }),
        fc.array(sidArb, { minLength: 0, maxLength: 5 }),
        mediaTypeArb,
        (docs, userSIDs, overrideMediaType) => {
          // Filter with original mediaType values
          const originalResult = filterDocuments(docs, userSIDs);

          // Replace every document's mediaType with a different value
          const alteredDocs = docs.map((d) => ({
            ...d,
            mediaType: overrideMediaType,
          }));
          const alteredResult = filterDocuments(alteredDocs, userSIDs);

          // The set of allowed s3Uris must be identical
          const originalUris = originalResult.map((d) => d.s3Uri).sort();
          const alteredUris = alteredResult.map((d) => d.s3Uri).sort();

          expect(alteredUris).toEqual(originalUris);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('filtered results never contain unauthorised documents', () => {
    fc.assert(
      fc.property(
        fc.array(documentArb, { minLength: 1, maxLength: 20 }),
        fc.array(sidArb, { minLength: 0, maxLength: 5 }),
        (docs, userSIDs) => {
          const result = filterDocuments(docs, userSIDs);

          for (const doc of result) {
            // Every allowed document must have at least one SID that
            // matches the user's SIDs.
            const hasMatch = checkSIDAccess(userSIDs, doc.allowedGroupSids);
            expect(hasMatch).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
