// Feature: agent-registry-integration, Property 2: Detail Panel Required Metadata
// Validates: Requirements 3.2

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render } from '@testing-library/react';
import type { RegistryRecordDetail } from '@/types/registry';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

// Mock useRegistryStore to avoid Zustand issues in test
vi.mock('@/store/useRegistryStore', () => ({
  useRegistryStore: () => ({
    isImporting: false,
    setImporting: () => {},
    setError: () => {},
  }),
}));

import { RegistryDetailPanel } from '@/components/agents/registry/RegistryDetailPanel';

const RESOURCE_TYPES = ['Agent', 'Tool', 'McpServer', 'Custom'] as const;
const APPROVAL_STATUSES = ['APPROVED', 'PENDING', 'REJECTED'] as const;

// Generator for RegistryRecordDetail with all required metadata
const registryDetailArb: fc.Arbitrary<RegistryRecordDetail> = fc.record({
  resourceId: fc.uuid(),
  resourceName: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
  resourceType: fc.constantFrom(...RESOURCE_TYPES),
  description: fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
  publisherName: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  createdAt: fc.constant('2025-01-15T10:30:00Z'),
  updatedAt: fc.constant('2025-06-20T14:00:00Z'),
  approvalStatus: fc.constantFrom(...APPROVAL_STATUSES),
  protocols: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
  relatedServices: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
  invocationMethod: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
});

describe('Property 2: Detail Panel Required Metadata', () => {
  it('rendered panel contains all required metadata fields', () => {
    fc.assert(
      fc.property(registryDetailArb, (record) => {
        const { container } = render(
          <RegistryDetailPanel record={record} onClose={() => {}} />
        );
        const text = container.textContent || '';

        // Required fields from Property 2
        expect(text).toContain(record.resourceName);
        expect(text).toContain(record.description);
        expect(text).toContain(record.publisherName);
        expect(text).toContain(record.approvalStatus);
        expect(text).toContain(record.invocationMethod);

        // Protocols should be rendered
        record.protocols.forEach((p) => {
          expect(text).toContain(p);
        });

        // Related services should be rendered
        record.relatedServices.forEach((s) => {
          expect(text).toContain(s);
        });
      }),
      { numRuns: 30 }
    );
  });
});
