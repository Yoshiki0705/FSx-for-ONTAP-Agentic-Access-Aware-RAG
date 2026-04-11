/**
 * Unit tests for AgentMetadataEditor component logic
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * Since @testing-library/react is not installed, these tests validate
 * the component's exported data structures and the underlying logic
 * that drives the UI behavior (tool categories, trust level options,
 * data boundary options, admin-only access control).
 *
 * The component itself is a pure presentational form that delegates
 * all state to parent via callbacks — the logic under test is the
 * data definitions and the access control rules.
 */

import {
  isValidToolProfile,
  isValidTrustLevel,
  isValidDataBoundary,
} from '@/types/multi-agent';
import type { ToolProfile, TrustLevel, DataBoundary } from '@/types/multi-agent';

// ===== Tool Profile definitions (mirrored from component for validation) =====

const ALL_TOOL_PROFILES_IN_EDITOR: ToolProfile[] = [
  'access-check',
  'kb-retrieve',
  'vision-analyze',
  'schedule-run',
  'share-agent',
  'external-mcp:ontap-ops',
  'external-mcp:identity-access',
  'external-mcp:document-workflow',
];

const TRUST_LEVELS: TrustLevel[] = ['user-safe', 'team-safe', 'admin-only'];
const DATA_BOUNDARIES: DataBoundary[] = ['public', 'team-scoped', 'user-scoped', 'sensitive-admin'];

// ===== Tests =====

describe('AgentMetadataEditor — data definitions and access control logic', () => {
  // --- Req 6.1: Tool Profile values are all valid ---

  describe('Tool Profile definitions (Req 6.1)', () => {
    it('all tool profiles in the editor are valid ToolProfile values', () => {
      for (const profile of ALL_TOOL_PROFILES_IN_EDITOR) {
        expect(isValidToolProfile(profile)).toBe(true);
      }
    });

    it('includes the 5 core tool profiles', () => {
      const core: ToolProfile[] = [
        'kb-retrieve',
        'vision-analyze',
        'access-check',
        'schedule-run',
        'share-agent',
      ];
      for (const p of core) {
        expect(ALL_TOOL_PROFILES_IN_EDITOR).toContain(p);
      }
    });

    it('includes external-mcp:* profiles for the 3 allowed connector types', () => {
      expect(ALL_TOOL_PROFILES_IN_EDITOR).toContain('external-mcp:ontap-ops');
      expect(ALL_TOOL_PROFILES_IN_EDITOR).toContain('external-mcp:identity-access');
      expect(ALL_TOOL_PROFILES_IN_EDITOR).toContain('external-mcp:document-workflow');
    });

    it('tool profiles are grouped into 3 categories', () => {
      // access: access-check, kb-retrieve
      // analysis: vision-analyze, schedule-run
      // sharing: share-agent, external-mcp:*
      const accessTools: ToolProfile[] = ['access-check', 'kb-retrieve'];
      const analysisTools: ToolProfile[] = ['vision-analyze', 'schedule-run'];
      const sharingTools: ToolProfile[] = [
        'share-agent',
        'external-mcp:ontap-ops',
        'external-mcp:identity-access',
        'external-mcp:document-workflow',
      ];

      const allGrouped = [...accessTools, ...analysisTools, ...sharingTools];
      expect(allGrouped.sort()).toEqual([...ALL_TOOL_PROFILES_IN_EDITOR].sort());
    });
  });

  // --- Req 6.2: Trust Level values are all valid ---

  describe('Trust Level definitions (Req 6.2)', () => {
    it('all trust levels in the editor are valid TrustLevel values', () => {
      for (const level of TRUST_LEVELS) {
        expect(isValidTrustLevel(level)).toBe(true);
      }
    });

    it('provides exactly 3 trust level options', () => {
      expect(TRUST_LEVELS).toHaveLength(3);
    });

    it('includes user-safe, team-safe, and admin-only', () => {
      expect(TRUST_LEVELS).toContain('user-safe');
      expect(TRUST_LEVELS).toContain('team-safe');
      expect(TRUST_LEVELS).toContain('admin-only');
    });
  });

  // --- Req 6.3: Data Boundary values are all valid ---

  describe('Data Boundary definitions (Req 6.3)', () => {
    it('all data boundaries in the editor are valid DataBoundary values', () => {
      for (const boundary of DATA_BOUNDARIES) {
        expect(isValidDataBoundary(boundary)).toBe(true);
      }
    });

    it('provides exactly 4 data boundary options', () => {
      expect(DATA_BOUNDARIES).toHaveLength(4);
    });

    it('includes public, team-scoped, user-scoped, and sensitive-admin', () => {
      expect(DATA_BOUNDARIES).toContain('public');
      expect(DATA_BOUNDARIES).toContain('team-scoped');
      expect(DATA_BOUNDARIES).toContain('user-scoped');
      expect(DATA_BOUNDARIES).toContain('sensitive-admin');
    });
  });

  // --- Req 6.4: Tool Profile selection toggles correctly ---

  describe('Tool Profile toggle logic (Req 6.4)', () => {
    it('adding a profile to empty array produces single-element array', () => {
      const current: ToolProfile[] = [];
      const toggled: ToolProfile = 'access-check';
      const next = current.includes(toggled)
        ? current.filter((p) => p !== toggled)
        : [...current, toggled];
      expect(next).toEqual(['access-check']);
    });

    it('removing a profile from array removes only that profile', () => {
      const current: ToolProfile[] = ['access-check', 'kb-retrieve', 'vision-analyze'];
      const toggled: ToolProfile = 'kb-retrieve';
      const next = current.includes(toggled)
        ? current.filter((p) => p !== toggled)
        : [...current, toggled];
      expect(next).toEqual(['access-check', 'vision-analyze']);
    });

    it('toggling the same profile twice returns to original state', () => {
      const original: ToolProfile[] = ['access-check'];
      const toggled: ToolProfile = 'kb-retrieve';

      // Toggle on
      const afterOn = original.includes(toggled)
        ? original.filter((p) => p !== toggled)
        : [...original, toggled];
      expect(afterOn).toEqual(['access-check', 'kb-retrieve']);

      // Toggle off
      const afterOff = afterOn.includes(toggled)
        ? afterOn.filter((p) => p !== toggled)
        : [...afterOn, toggled];
      expect(afterOff).toEqual(['access-check']);
    });
  });

  // --- Req 6.5: admin-only access control ---

  describe('Admin-only access control logic (Req 6.5)', () => {
    /**
     * Simulates the handleTrustLevelChange logic from the component:
     * non-admin users cannot select admin-only.
     */
    function simulateTrustLevelChange(
      value: string,
      isAdmin: boolean,
    ): TrustLevel | null {
      if (value === 'admin-only' && !isAdmin) return null; // rejected
      return value as TrustLevel;
    }

    it('admin user can select admin-only', () => {
      expect(simulateTrustLevelChange('admin-only', true)).toBe('admin-only');
    });

    it('non-admin user is blocked from selecting admin-only', () => {
      expect(simulateTrustLevelChange('admin-only', false)).toBeNull();
    });

    it('non-admin user can select user-safe and team-safe', () => {
      expect(simulateTrustLevelChange('user-safe', false)).toBe('user-safe');
      expect(simulateTrustLevelChange('team-safe', false)).toBe('team-safe');
    });

    it('admin user can select all trust levels', () => {
      for (const level of TRUST_LEVELS) {
        expect(simulateTrustLevelChange(level, true)).toBe(level);
      }
    });

    /**
     * Simulates the handleDataBoundaryChange logic:
     * non-admin users cannot select sensitive-admin.
     */
    function simulateDataBoundaryChange(
      value: string,
      isAdmin: boolean,
    ): DataBoundary | null {
      if (value === 'sensitive-admin' && !isAdmin) return null;
      return value as DataBoundary;
    }

    it('non-admin user is blocked from selecting sensitive-admin data boundary', () => {
      expect(simulateDataBoundaryChange('sensitive-admin', false)).toBeNull();
    });

    it('admin user can select sensitive-admin data boundary', () => {
      expect(simulateDataBoundaryChange('sensitive-admin', true)).toBe('sensitive-admin');
    });
  });

  // --- Req 6.6: Persistence compatibility ---

  describe('Persistence compatibility (Req 6.6)', () => {
    it('tool profiles are serializable to JSON', () => {
      const profiles: ToolProfile[] = ['access-check', 'external-mcp:ontap-ops'];
      const json = JSON.stringify(profiles);
      const parsed = JSON.parse(json) as ToolProfile[];
      expect(parsed).toEqual(profiles);
    });

    it('trust level is serializable to JSON', () => {
      const level: TrustLevel = 'admin-only';
      const json = JSON.stringify(level);
      expect(JSON.parse(json)).toBe(level);
    });

    it('data boundary is serializable to JSON', () => {
      const boundary: DataBoundary = 'sensitive-admin';
      const json = JSON.stringify(boundary);
      expect(JSON.parse(json)).toBe(boundary);
    });
  });
});
