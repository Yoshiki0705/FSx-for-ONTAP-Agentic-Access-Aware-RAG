// Feature: agent-registry-integration, Property 6: Access Control Filtering
// Validates: Requirements 6.2, 6.3

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { RegistryRecord } from '@/types/registry';

const RESOURCE_TYPES = ['Agent', 'Tool', 'McpServer', 'Custom'] as const;

/**
 * Simulates permission-based filtering.
 * A user has access to a record if the record's resourceId is in their allowedResourceIds set.
 */
function filterByPermissions(
  records: RegistryRecord[],
  allowedResourceIds: Set<string>,
): RegistryRecord[] {
  return records.filter((r) => allowedResourceIds.has(r.resourceId));
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

describe('Property 6: Access Control Filtering', () => {
  it('filtered results only contain records the user has access to', () => {
    fc.assert(
      fc.property(
        fc.array(registryRecordArb, { minLength: 0, maxLength: 30 }),
        (records) => {
          // Grant access to a random subset of records
          const allowedIds = new Set(
            records
              .filter((_, i) => i % 2 === 0)
              .map((r) => r.resourceId)
          );

          const filtered = filterByPermissions(records, allowedIds);

          // Every returned record must be in the allowed set
          filtered.forEach((r) => {
            expect(allowedIds.has(r.resourceId)).toBe(true);
          });

          // No record outside the allowed set should appear
          expect(filtered.length).toBeLessThanOrEqual(allowedIds.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty permissions returns empty results', () => {
    fc.assert(
      fc.property(
        fc.array(registryRecordArb, { minLength: 1, maxLength: 20 }),
        (records) => {
          const filtered = filterByPermissions(records, new Set());
          expect(filtered.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('full permissions returns all records', () => {
    fc.assert(
      fc.property(
        fc.array(registryRecordArb, { minLength: 0, maxLength: 20 }),
        (records) => {
          const allIds = new Set(records.map((r) => r.resourceId));
          const filtered = filterByPermissions(records, allIds);
          expect(filtered.length).toBe(records.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
