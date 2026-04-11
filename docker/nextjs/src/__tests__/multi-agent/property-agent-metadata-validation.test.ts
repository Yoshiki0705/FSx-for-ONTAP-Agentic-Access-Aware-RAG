/**
 * Property tests for Agent Metadata Validation
 * Feature: multi-agent-collaboration, Property 5: Agent Metadata Validation
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 *
 * Verifies that:
 * - toolProfiles only contain values from the allowed set
 * - trustLevel only takes valid values
 * - dataBoundary only takes valid values
 * - external-mcp:* pattern is accepted for ToolProfile
 * - Empty strings are rejected by all validators
 */

import * as fc from 'fast-check';
import {
  isValidToolProfile,
  isValidTrustLevel,
  isValidDataBoundary,
  isValidCollaboratorRole,
  isValidRoutingMode,
} from '@/types/multi-agent';

// ===== Known valid value sets =====

const VALID_TOOL_PROFILES = [
  'kb-retrieve',
  'vision-analyze',
  'access-check',
  'schedule-run',
  'share-agent',
] as const;

const VALID_TRUST_LEVELS = ['user-safe', 'team-safe', 'admin-only'] as const;

const VALID_DATA_BOUNDARIES = ['public', 'team-scoped', 'user-scoped', 'sensitive-admin'] as const;

const VALID_COLLABORATOR_ROLES = [
  'permission-resolver',
  'retrieval',
  'analysis',
  'output',
  'vision',
] as const;

const VALID_ROUTING_MODES = ['supervisor_router', 'supervisor'] as const;

// ===== Generators =====

/** Generates arbitrary strings that are NOT any of the known valid values for any validator */
const invalidStringArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter(
    (s) =>
      !(VALID_TOOL_PROFILES as readonly string[]).includes(s) &&
      !(VALID_TRUST_LEVELS as readonly string[]).includes(s) &&
      !(VALID_DATA_BOUNDARIES as readonly string[]).includes(s) &&
      !(VALID_COLLABORATOR_ROLES as readonly string[]).includes(s) &&
      !(VALID_ROUTING_MODES as readonly string[]).includes(s) &&
      !s.startsWith('external-mcp:')
  );

/** Generates valid external-mcp: prefixed strings (at least 1 char after colon) */
const externalMcpArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .map((suffix) => `external-mcp:${suffix}`);

// ===== Property 5: Agent Metadata Validation =====

describe('Feature: multi-agent-collaboration, Property 5: Agent Metadata Validation', () => {
  // --- ToolProfile validation ---

  describe('isValidToolProfile', () => {
    it('accepts all known valid tool profile values', () => {
      fc.assert(
        fc.property(fc.constantFrom(...VALID_TOOL_PROFILES), (profile) => {
          expect(isValidToolProfile(profile)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('accepts external-mcp:* pattern with non-empty suffix', () => {
      fc.assert(
        fc.property(externalMcpArb, (profile) => {
          expect(isValidToolProfile(profile)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects arbitrary strings that are not valid tool profiles', () => {
      fc.assert(
        fc.property(invalidStringArb, (value) => {
          expect(isValidToolProfile(value)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects empty string', () => {
      expect(isValidToolProfile('')).toBe(false);
    });

    it('rejects external-mcp: with no suffix', () => {
      expect(isValidToolProfile('external-mcp:')).toBe(false);
    });
  });

  // --- TrustLevel validation ---

  describe('isValidTrustLevel', () => {
    it('accepts all known valid trust level values', () => {
      fc.assert(
        fc.property(fc.constantFrom(...VALID_TRUST_LEVELS), (level) => {
          expect(isValidTrustLevel(level)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects arbitrary strings that are not valid trust levels', () => {
      fc.assert(
        fc.property(invalidStringArb, (value) => {
          expect(isValidTrustLevel(value)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects empty string', () => {
      expect(isValidTrustLevel('')).toBe(false);
    });
  });

  // --- DataBoundary validation ---

  describe('isValidDataBoundary', () => {
    it('accepts all known valid data boundary values', () => {
      fc.assert(
        fc.property(fc.constantFrom(...VALID_DATA_BOUNDARIES), (boundary) => {
          expect(isValidDataBoundary(boundary)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects arbitrary strings that are not valid data boundaries', () => {
      fc.assert(
        fc.property(invalidStringArb, (value) => {
          expect(isValidDataBoundary(value)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects empty string', () => {
      expect(isValidDataBoundary('')).toBe(false);
    });
  });

  // --- CollaboratorRole validation ---

  describe('isValidCollaboratorRole', () => {
    it('accepts all known valid collaborator role values', () => {
      fc.assert(
        fc.property(fc.constantFrom(...VALID_COLLABORATOR_ROLES), (role) => {
          expect(isValidCollaboratorRole(role)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects arbitrary strings that are not valid collaborator roles', () => {
      fc.assert(
        fc.property(invalidStringArb, (value) => {
          expect(isValidCollaboratorRole(value)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects empty string', () => {
      expect(isValidCollaboratorRole('')).toBe(false);
    });
  });

  // --- RoutingMode validation ---

  describe('isValidRoutingMode', () => {
    it('accepts all known valid routing mode values', () => {
      fc.assert(
        fc.property(fc.constantFrom(...VALID_ROUTING_MODES), (mode) => {
          expect(isValidRoutingMode(mode)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects arbitrary strings that are not valid routing modes', () => {
      fc.assert(
        fc.property(invalidStringArb, (value) => {
          expect(isValidRoutingMode(value)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rejects empty string', () => {
      expect(isValidRoutingMode('')).toBe(false);
    });
  });
});
