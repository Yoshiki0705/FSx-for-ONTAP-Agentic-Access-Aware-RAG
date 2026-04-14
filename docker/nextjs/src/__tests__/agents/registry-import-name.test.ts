// Feature: agent-registry-integration, Property 5: Import Name Uniqueness
// Validates: Requirements 4.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveAgentName } from '@/app/api/bedrock/agent-registry/import/route';

describe('resolveAgentName', () => {
  // Property 5: For any desired name and existing names list,
  // resolveAgentName returns a name not in existingNames
  it('Property 5: always returns a unique name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
        (desiredName, existingNames) => {
          const result = resolveAgentName(desiredName, existingNames);
          if (existingNames.includes(desiredName)) {
            // When there's a conflict, result should differ and contain suffix
            expect(result).not.toBe(desiredName);
            expect(result).toContain('_imported_');
          } else {
            // When no conflict, original name is returned
            expect(result).toBe(desiredName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Example-based tests
  it('returns original name when no conflict', () => {
    expect(resolveAgentName('MyAgent', ['Other'])).toBe('MyAgent');
  });

  it('adds suffix when name conflicts', () => {
    const result = resolveAgentName('MyAgent', ['MyAgent', 'Other']);
    expect(result).toMatch(/^MyAgent_imported_\d{8}$/);
  });

  it('handles empty existing names', () => {
    expect(resolveAgentName('MyAgent', [])).toBe('MyAgent');
  });
});
