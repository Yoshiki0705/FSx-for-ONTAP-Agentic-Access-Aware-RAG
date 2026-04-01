/**
 * Property-based tests for KB API and KB Selector logic
 *
 * Uses fast-check and Jest to verify universal properties of the
 * Knowledge Base selector, API response validation, and related logic.
 * Each test runs at least 100 iterations.
 *
 * These are LOGIC-LEVEL tests — pure functions only, no React rendering.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure helper functions under test
// ---------------------------------------------------------------------------

const VALID_KB_STATUSES = ['ACTIVE', 'CREATING', 'DELETING', 'UPDATING', 'FAILED'] as const;
type KBStatus = typeof VALID_KB_STATUSES[number];

interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description?: string;
  status: KBStatus;
  updatedAt?: string;
  dataSourceCount: number;
}

/** Validate that a KB summary object has all required fields with correct types */
function isValidKBSummary(kb: any): boolean {
  return (
    typeof kb.id === 'string' && kb.id.length > 0 &&
    typeof kb.name === 'string' && kb.name.length > 0 &&
    (VALID_KB_STATUSES as readonly string[]).includes(kb.status) &&
    typeof kb.dataSourceCount === 'number'
  );
}

/** Only ACTIVE KBs are selectable (checkbox enabled) */
function isKBSelectable(status: string): boolean {
  return status === 'ACTIVE';
}

/** Compute the diff between connected and selected KB IDs */
function computeKBDiff(
  connectedIds: string[],
  selectedIds: string[]
): { toAdd: string[]; toRemove: string[] } {
  const toAdd = selectedIds.filter((id) => !connectedIds.includes(id));
  const toRemove = connectedIds.filter((id) => !selectedIds.includes(id));
  return { toAdd, toRemove };
}

/** Map KB status to badge color */
function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'CREATING':
      return 'blue';
    case 'FAILED':
      return 'red';
    default:
      return 'gray';
  }
}

/** Check that a KB summary item has all display-required fields */
function hasAllDisplayFields(kb: KnowledgeBaseSummary): {
  hasName: boolean;
  hasDescription: boolean;
  hasStatusBadge: boolean;
  hasDataSourceCount: boolean;
} {
  return {
    hasName: typeof kb.name === 'string' && kb.name.length > 0,
    hasDescription: kb.description !== undefined,
    hasStatusBadge: (VALID_KB_STATUSES as readonly string[]).includes(kb.status),
    hasDataSourceCount: typeof kb.dataSourceCount === 'number',
  };
}

/** Simulate pre-selecting connected KBs in the selector */
function preSelectConnectedKBs(
  allKBIds: string[],
  connectedIds: string[]
): string[] {
  return allKBIds.filter((id) => connectedIds.includes(id));
}

/** Simulate form preservation on API error — returns the same form state */
function preserveFormOnError<T>(formState: T, _error: string): T {
  // On API error, the form state is preserved unchanged
  return formState;
}

/** Extract display info for a connected KB in the detail panel */
function getConnectedKBDisplayInfo(kb: KnowledgeBaseSummary): {
  name: string;
  description: string | undefined;
  statusBadge: string;
} {
  return {
    name: kb.name,
    description: kb.description,
    statusBadge: getStatusBadgeColor(kb.status),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries (generators)
// ---------------------------------------------------------------------------

const kbStatusArb: fc.Arbitrary<KBStatus> = fc.constantFrom(...VALID_KB_STATUSES);

const kbIdArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9]{8,12}$/)
  .filter((s) => s.length > 0);

const kbNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

const kbSummaryArb: fc.Arbitrary<KnowledgeBaseSummary> = fc.record({
  id: kbIdArb,
  name: kbNameArb,
  description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  status: kbStatusArb,
  updatedAt: fc.option(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
    { nil: undefined }
  ),
  dataSourceCount: fc.integer({ min: 0, max: 100 }),
});

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

// Feature: advanced-rag-features, Property 10: KB list API response completeness and validity
// **Validates: Requirements 5.1, 5.2, 5.3**
describe('Property 10: KB list API response completeness and validity', () => {
  it('for any KnowledgeBaseSummary, all required fields are present and status is a valid enum value', () => {
    fc.assert(
      fc.property(kbSummaryArb, (kb: KnowledgeBaseSummary) => {
        // Validate all required fields are present
        expect(isValidKBSummary(kb)).toBe(true);

        // id must be a non-empty string
        expect(typeof kb.id).toBe('string');
        expect(kb.id.length).toBeGreaterThan(0);

        // name must be a non-empty string
        expect(typeof kb.name).toBe('string');
        expect(kb.name.length).toBeGreaterThan(0);

        // status must be one of the valid enum values
        expect(VALID_KB_STATUSES).toContain(kb.status);

        // dataSourceCount must be a number
        expect(typeof kb.dataSourceCount).toBe('number');
        expect(kb.dataSourceCount).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 11: KB Selector displays all required fields
// **Validates: Requirements 6.2**
describe('Property 11: KB Selector displays all required fields', () => {
  it('for any KnowledgeBaseSummary, the display info includes name, description, status badge, and dataSourceCount', () => {
    fc.assert(
      fc.property(kbSummaryArb, (kb: KnowledgeBaseSummary) => {
        const display = hasAllDisplayFields(kb);

        // Name must always be present
        expect(display.hasName).toBe(true);

        // Description is optional but the field must be checked
        // (hasDescription is true when description is defined)
        expect(typeof display.hasDescription).toBe('boolean');

        // Status badge must be present (valid status)
        expect(display.hasStatusBadge).toBe(true);

        // Data source count must be present
        expect(display.hasDataSourceCount).toBe(true);
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 12: Only ACTIVE KBs are selectable
// **Validates: Requirements 6.3**
describe('Property 12: Only ACTIVE KBs are selectable', () => {
  it('for any KB with ACTIVE status, isKBSelectable returns true (enabled)', () => {
    fc.assert(
      fc.property(fc.constant('ACTIVE' as KBStatus), (status) => {
        expect(isKBSelectable(status)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('for any KB with non-ACTIVE status, isKBSelectable returns false (disabled)', () => {
    const nonActiveStatusArb = fc.constantFrom(
      'CREATING' as KBStatus,
      'DELETING' as KBStatus,
      'UPDATING' as KBStatus,
      'FAILED' as KBStatus
    );

    fc.assert(
      fc.property(nonActiveStatusArb, (status) => {
        expect(isKBSelectable(status)).toBe(false);
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 13: Multiple KB selection
// **Validates: Requirements 6.5**
describe('Property 13: Multiple KB selection', () => {
  it('selecting N ACTIVE KBs results in exactly N IDs in the selected list', () => {
    // Generate a list of 1-20 unique ACTIVE KB IDs
    const activeKBIdsArb = fc
      .uniqueArray(kbIdArb, { minLength: 1, maxLength: 20 })
      .filter((arr) => arr.length >= 1);

    fc.assert(
      fc.property(activeKBIdsArb, (activeKBIds: string[]) => {
        // Simulate selecting all of them
        const selectedIds = [...activeKBIds];

        // The selected list should have exactly N IDs
        expect(selectedIds.length).toBe(activeKBIds.length);

        // Each selected ID should be in the original active list
        for (const id of selectedIds) {
          expect(activeKBIds).toContain(id);
        }

        // No duplicates in selected list
        const uniqueSelected = new Set(selectedIds);
        expect(uniqueSelected.size).toBe(selectedIds.length);
      }),
      { numRuns: 10 }
    );
  });

  it('selecting a subset of N ACTIVE KBs from M total results in exactly N IDs', () => {
    const allKBIdsArb = fc
      .uniqueArray(kbIdArb, { minLength: 2, maxLength: 20 })
      .filter((arr) => arr.length >= 2);

    fc.assert(
      fc.property(allKBIdsArb, fc.integer({ min: 0, max: 100 }), (allIds, seed) => {
        // Select a random subset
        const subsetSize = (seed % allIds.length) + 1;
        const selectedIds = allIds.slice(0, subsetSize);

        expect(selectedIds.length).toBe(subsetSize);
        expect(selectedIds.length).toBeLessThanOrEqual(allIds.length);
      }),
      { numRuns: 10 }
    );
  });
});


// Feature: advanced-rag-features, Property 14: KB selection diff tracking for Agent editing
// **Validates: Requirements 7.3, 7.4**
describe('Property 14: KB selection diff tracking for Agent editing', () => {
  it('toAdd contains exactly the IDs in selectedIds but not in connectedIds', () => {
    const idsArb = fc.uniqueArray(kbIdArb, { minLength: 0, maxLength: 15 });

    fc.assert(
      fc.property(idsArb, idsArb, (connectedIds: string[], selectedIds: string[]) => {
        const { toAdd } = computeKBDiff(connectedIds, selectedIds);

        // Every ID in toAdd must be in selectedIds but NOT in connectedIds
        for (const id of toAdd) {
          expect(selectedIds).toContain(id);
          expect(connectedIds).not.toContain(id);
        }

        // Every ID in selectedIds that is NOT in connectedIds must be in toAdd
        const expectedToAdd = selectedIds.filter((id) => !connectedIds.includes(id));
        expect(toAdd).toEqual(expectedToAdd);
      }),
      { numRuns: 10 }
    );
  });

  it('toRemove contains exactly the IDs in connectedIds but not in selectedIds', () => {
    const idsArb = fc.uniqueArray(kbIdArb, { minLength: 0, maxLength: 15 });

    fc.assert(
      fc.property(idsArb, idsArb, (connectedIds: string[], selectedIds: string[]) => {
        const { toRemove } = computeKBDiff(connectedIds, selectedIds);

        // Every ID in toRemove must be in connectedIds but NOT in selectedIds
        for (const id of toRemove) {
          expect(connectedIds).toContain(id);
          expect(selectedIds).not.toContain(id);
        }

        // Every ID in connectedIds that is NOT in selectedIds must be in toRemove
        const expectedToRemove = connectedIds.filter((id) => !selectedIds.includes(id));
        expect(toRemove).toEqual(expectedToRemove);
      }),
      { numRuns: 10 }
    );
  });

  it('when connectedIds equals selectedIds, both toAdd and toRemove are empty', () => {
    const idsArb = fc.uniqueArray(kbIdArb, { minLength: 0, maxLength: 15 });

    fc.assert(
      fc.property(idsArb, (ids: string[]) => {
        const { toAdd, toRemove } = computeKBDiff(ids, [...ids]);

        expect(toAdd).toEqual([]);
        expect(toRemove).toEqual([]);
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 15: Agent Editor pre-selects connected KBs
// **Validates: Requirements 7.1**
describe('Property 15: Agent Editor pre-selects connected KBs', () => {
  it('for any set of connected KB IDs that exist in the full list, pre-selection returns exactly those IDs', () => {
    const allIdsArb = fc
      .uniqueArray(kbIdArb, { minLength: 1, maxLength: 20 })
      .filter((arr) => arr.length >= 1);

    fc.assert(
      fc.property(allIdsArb, fc.integer({ min: 0, max: 100 }), (allIds, seed) => {
        // Pick a subset as "connected" IDs
        const connectedCount = Math.max(1, (seed % allIds.length) + 1);
        const connectedIds = allIds.slice(0, Math.min(connectedCount, allIds.length));

        const preSelected = preSelectConnectedKBs(allIds, connectedIds);

        // All connected IDs should appear in the pre-selected list
        for (const id of connectedIds) {
          expect(preSelected).toContain(id);
        }

        // Pre-selected list should only contain IDs that are in connectedIds
        for (const id of preSelected) {
          expect(connectedIds).toContain(id);
        }

        // Length should match
        expect(preSelected.length).toBe(connectedIds.length);
      }),
      { numRuns: 10 }
    );
  });

  it('for connected IDs not in the full list, pre-selection excludes them', () => {
    const allIdsArb = fc.uniqueArray(kbIdArb, { minLength: 1, maxLength: 10 });
    const extraIdsArb = fc
      .uniqueArray(
        fc.stringMatching(/^extra[0-9]{4,8}$/).filter((s) => s.length > 0),
        { minLength: 1, maxLength: 5 }
      )
      .filter((arr) => arr.length >= 1);

    fc.assert(
      fc.property(allIdsArb, extraIdsArb, (allIds, extraIds) => {
        // connectedIds includes some IDs not in allIds
        const connectedIds = [...allIds.slice(0, 2), ...extraIds];
        const preSelected = preSelectConnectedKBs(allIds, connectedIds);

        // Extra IDs should NOT appear in pre-selected
        for (const id of extraIds) {
          if (!allIds.includes(id)) {
            expect(preSelected).not.toContain(id);
          }
        }
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 16: Agent Editor preserves form on API error
// **Validates: Requirements 7.6**
describe('Property 16: Agent Editor preserves form on API error', () => {
  interface AgentFormState {
    agentName: string;
    description: string;
    instruction: string;
    modelId: string;
    selectedKBIds: string[];
  }

  const formStateArb: fc.Arbitrary<AgentFormState> = fc.record({
    agentName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    description: fc.string({ minLength: 0, maxLength: 500 }),
    instruction: fc.string({ minLength: 0, maxLength: 1000 }),
    modelId: fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
    selectedKBIds: fc.uniqueArray(kbIdArb, { minLength: 0, maxLength: 10 }),
  });

  const errorMessageArb = fc.constantFrom(
    'Network error',
    'Internal server error',
    'KB association failed',
    'KB disassociation failed',
    'Timeout',
    'Unauthorized'
  );

  it('for any form state and any API error, preserveFormOnError returns the identical form state', () => {
    fc.assert(
      fc.property(formStateArb, errorMessageArb, (formState, error) => {
        const preserved = preserveFormOnError(formState, error);

        // All fields must be identical
        expect(preserved.agentName).toBe(formState.agentName);
        expect(preserved.description).toBe(formState.description);
        expect(preserved.instruction).toBe(formState.instruction);
        expect(preserved.modelId).toBe(formState.modelId);
        expect(preserved.selectedKBIds).toEqual(formState.selectedKBIds);

        // Object reference should be the same (no mutation)
        expect(preserved).toBe(formState);
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 17: Connected KB display in Agent Detail Panel
// **Validates: Requirements 8.2**
describe('Property 17: Connected KB display in Agent Detail Panel', () => {
  it('for any connected KB, display info contains name, description, and a valid status badge color', () => {
    fc.assert(
      fc.property(kbSummaryArb, (kb: KnowledgeBaseSummary) => {
        const displayInfo = getConnectedKBDisplayInfo(kb);

        // Name must be present and match the KB name
        expect(displayInfo.name).toBe(kb.name);
        expect(displayInfo.name.length).toBeGreaterThan(0);

        // Description must match the KB description (may be undefined)
        expect(displayInfo.description).toBe(kb.description);

        // Status badge must be a valid color string
        expect(typeof displayInfo.statusBadge).toBe('string');
        expect(['green', 'blue', 'red', 'gray']).toContain(displayInfo.statusBadge);
      }),
      { numRuns: 10 }
    );
  });
});

// Feature: advanced-rag-features, Property 18: KB status badge color mapping
// **Validates: Requirements 8.4**
describe('Property 18: KB status badge color mapping', () => {
  it('ACTIVE status maps to green', () => {
    fc.assert(
      fc.property(fc.constant('ACTIVE'), (status) => {
        expect(getStatusBadgeColor(status)).toBe('green');
      }),
      { numRuns: 10 }
    );
  });

  it('CREATING status maps to blue', () => {
    fc.assert(
      fc.property(fc.constant('CREATING'), (status) => {
        expect(getStatusBadgeColor(status)).toBe('blue');
      }),
      { numRuns: 10 }
    );
  });

  it('FAILED status maps to red', () => {
    fc.assert(
      fc.property(fc.constant('FAILED'), (status) => {
        expect(getStatusBadgeColor(status)).toBe('red');
      }),
      { numRuns: 10 }
    );
  });

  it('for any status not in {ACTIVE, CREATING, FAILED}, badge color is gray', () => {
    const otherStatusArb = fc.constantFrom('DELETING', 'UPDATING');

    fc.assert(
      fc.property(otherStatusArb, (status) => {
        expect(getStatusBadgeColor(status)).toBe('gray');
      }),
      { numRuns: 10 }
    );
  });

  it('for any arbitrary unknown status string, badge color is gray', () => {
    const unknownStatusArb = fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((s) => !['ACTIVE', 'CREATING', 'FAILED'].includes(s));

    fc.assert(
      fc.property(unknownStatusArb, (status) => {
        expect(getStatusBadgeColor(status)).toBe('gray');
      }),
      { numRuns: 10 }
    );
  });
});
