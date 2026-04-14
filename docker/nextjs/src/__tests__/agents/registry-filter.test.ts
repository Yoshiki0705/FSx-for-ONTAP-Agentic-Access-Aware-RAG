// Feature: agent-registry-integration, Property 4: Resource Type Filter Accuracy
// Validates: Requirements 2.6

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { RegistryRecord } from '@/types/registry';

const RESOURCE_TYPES = ['Agent', 'Tool', 'McpServer', 'Custom'] as const;

/**
 * Filter records by resourceType. 'all' returns everything.
 */
function filterByResourceType(
  records: RegistryRecord[],
  filter: string,
): RegistryRecord[] {
  if (filter === 'all') return records;
  return records.filter((r) => r.resourceType === filter);
}

// Generator for RegistryRecord
const registryRecordArb: fc.Arbitrary<RegistryRecord> = fc.record({
  resourceId: fc.uuid(),
  resourceName: fc.string({ minLength: 1, maxLength: 50 }),
  resourceType: fc.constantFrom(...RESOURCE_TYPES),
  description: fc.string({ maxLength: 100 }),
  publisherName: fc.string({ minLength: 1, maxLength: 30 }),
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
  updatedAt: fc.constant('2025-06-01T00:00:00Z'),
  approvalStatus: fc.constantFrom('APPROVED', 'PENDING', 'REJECTED'),
});

describe('Property 4: Resource Type Filter Accuracy', () => {
  it('filtered results only contain records matching the selected type', () => {
    fc.assert(
      fc.property(
        fc.array(registryRecordArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom(...RESOURCE_TYPES),
        (records, filterType) => {
          const filtered = filterByResourceType(records, filterType);
          filtered.forEach((r) => {
            expect(r.resourceType).toBe(filterType);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('"all" filter returns all records unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(registryRecordArb, { minLength: 0, maxLength: 30 }),
        (records) => {
          const filtered = filterByResourceType(records, 'all');
          expect(filtered.length).toBe(records.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filtered count is always <= total count', () => {
    fc.assert(
      fc.property(
        fc.array(registryRecordArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom('all', ...RESOURCE_TYPES),
        (records, filterType) => {
          const filtered = filterByResourceType(records, filterType);
          expect(filtered.length).toBeLessThanOrEqual(records.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
