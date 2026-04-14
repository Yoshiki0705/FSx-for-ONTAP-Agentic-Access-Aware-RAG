// Feature: agent-registry-integration, Property 1: Search Result Card Required Fields
// Validates: Requirements 2.2

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render } from '@testing-library/react';
import type { RegistryRecord } from '@/types/registry';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

// Import after mocks
import { RegistryCard } from '@/components/agents/registry/RegistryCard';

const RESOURCE_TYPES = ['Agent', 'Tool', 'McpServer', 'Custom'] as const;
const APPROVAL_STATUSES = ['APPROVED', 'PENDING', 'REJECTED'] as const;

// Generator for valid RegistryRecord with non-empty visible fields
const registryRecordArb: fc.Arbitrary<RegistryRecord> = fc.record({
  resourceId: fc.uuid(),
  resourceName: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
  resourceType: fc.constantFrom(...RESOURCE_TYPES),
  description: fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
  publisherName: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
  updatedAt: fc.constant('2025-06-01T00:00:00Z'),
  approvalStatus: fc.constantFrom(...APPROVAL_STATUSES),
});

describe('Property 1: Search Result Card Required Fields', () => {
  it('rendered card contains name, description, resourceType, and publisherName', () => {
    fc.assert(
      fc.property(registryRecordArb, (record) => {
        const { container } = render(
          <RegistryCard record={record} onClick={() => {}} />
        );
        const text = container.textContent || '';

        expect(text).toContain(record.resourceName);
        expect(text).toContain(record.description);
        expect(text).toContain(record.resourceType);
        expect(text).toContain(record.publisherName);
      }),
      { numRuns: 50 }
    );
  });
});
