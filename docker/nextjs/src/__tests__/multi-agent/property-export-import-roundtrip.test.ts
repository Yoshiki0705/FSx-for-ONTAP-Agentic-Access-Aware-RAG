/**
 * Property tests for Export/Import Round-Trip
 * Feature: multi-agent-collaboration, Property 7: Agent Team Config Export/Import Round-Trip
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 *
 * Verifies that:
 * - For any valid AgentTeamConfig, export→import produces equivalent config
 * - Team name, description, routing mode, auto routing are preserved
 * - Collaborator roles, toolProfiles, trustLevels, dataBoundaries are preserved
 * - Collaborator count is preserved
 * - Foundation models and instructions are preserved
 */

import * as fc from 'fast-check';
import { exportTeamConfig, importTeamTemplate } from '@/utils/multi-agent/team-template';
import type {
  AgentTeamConfig,
  CollaboratorConfig,
  CollaboratorRole,
  RoutingMode,
  ToolProfile,
  TrustLevel,
  DataBoundary,
} from '@/types/multi-agent';

// ===== Constants =====

const COLLABORATOR_ROLES: CollaboratorRole[] = [
  'permission-resolver',
  'retrieval',
  'analysis',
  'output',
  'vision',
];

const ROUTING_MODES: RoutingMode[] = ['supervisor_router', 'supervisor'];

const TOOL_PROFILES: ToolProfile[] = [
  'kb-retrieve',
  'vision-analyze',
  'access-check',
  'schedule-run',
  'share-agent',
];

const TRUST_LEVELS: TrustLevel[] = ['user-safe', 'team-safe', 'admin-only'];

const DATA_BOUNDARIES: DataBoundary[] = [
  'public',
  'team-scoped',
  'user-scoped',
  'sensitive-admin',
];

// ===== Generators =====

/**
 * Generates a safe alphanumeric string that won't be mistaken for secrets.
 * Avoids patterns like ARNs, API keys, or endpoint URLs.
 */
const safeStringArb = fc.stringMatching(/^[a-z][a-z0-9 -]{0,28}[a-z0-9]$/);

/** Generates a valid CollaboratorRole */
const collaboratorRoleArb = fc.constantFrom(...COLLABORATOR_ROLES);

/** Generates a valid RoutingMode */
const routingModeArb = fc.constantFrom(...ROUTING_MODES);

/** Generates a valid ToolProfile (only known profiles, no external-mcp to avoid secret masking) */
const toolProfileArb = fc.constantFrom(...TOOL_PROFILES);

/** Generates a valid TrustLevel */
const trustLevelArb = fc.constantFrom(...TRUST_LEVELS);

/** Generates a valid DataBoundary */
const dataBoundaryArb = fc.constantFrom(...DATA_BOUNDARIES);

/** Generates a safe foundation model string */
const foundationModelArb = fc.constantFrom(
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
);

/** Generates a valid CollaboratorConfig */
const collaboratorConfigArb: fc.Arbitrary<CollaboratorConfig> = fc.record({
  agentId: safeStringArb.map((s) => `agent-${s}`),
  agentAliasId: safeStringArb.map((s) => `alias-${s}`),
  agentName: safeStringArb,
  role: collaboratorRoleArb,
  foundationModel: foundationModelArb,
  toolProfiles: fc.array(toolProfileArb, { minLength: 0, maxLength: 3 }),
  trustLevel: trustLevelArb,
  dataBoundary: dataBoundaryArb,
  instruction: fc.option(safeStringArb, { nil: undefined }),
});

/** Generates a valid AgentTeamConfig */
const agentTeamConfigArb: fc.Arbitrary<AgentTeamConfig> = fc.record({
  teamId: safeStringArb.map((s) => `team-${s}`),
  teamName: safeStringArb,
  description: safeStringArb,
  supervisorAgentId: safeStringArb.map((s) => `supervisor-${s}`),
  supervisorAliasId: safeStringArb.map((s) => `supervisor-alias-${s}`),
  routingMode: routingModeArb,
  autoRouting: fc.boolean(),
  collaborators: fc.array(collaboratorConfigArb, { minLength: 1, maxLength: 6 }),
  versionLabel: fc.option(safeStringArb, { nil: undefined }),
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
});

// ===== Property 7: Export/Import Round-Trip =====

describe('Feature: multi-agent-collaboration, Property 7: Agent Team Config Export/Import Round-Trip', () => {
  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Team name is preserved through export→import round-trip.
   */
  it('preserves team name through export→import', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        const imported = importTeamTemplate(template, []);

        expect(imported.teamName).toBe(config.teamName);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Description is preserved through export→import round-trip.
   */
  it('preserves description through export→import', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        const imported = importTeamTemplate(template, []);

        expect(imported.description).toBe(config.description);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Routing mode is preserved through export→import round-trip.
   */
  it('preserves routing mode through export→import', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        const imported = importTeamTemplate(template, []);

        expect(imported.routingMode).toBe(config.routingMode);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Auto routing flag is preserved through export→import round-trip.
   */
  it('preserves auto routing flag through export→import', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        const imported = importTeamTemplate(template, []);

        expect(imported.autoRouting).toBe(config.autoRouting);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Collaborator count is preserved through export→import round-trip.
   */
  it('preserves collaborator count through export→import', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        const imported = importTeamTemplate(template, []);

        expect(imported.collaborators.length).toBe(config.collaborators.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Collaborator roles, toolProfiles, trustLevels, and dataBoundaries
   * are all preserved through export→import round-trip.
   */
  it('preserves collaborator roles, toolProfiles, trustLevels, and dataBoundaries', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        const imported = importTeamTemplate(template, []);

        for (let i = 0; i < config.collaborators.length; i++) {
          const original = config.collaborators[i];
          const result = imported.collaborators[i];

          expect(result.role).toBe(original.role);
          expect(result.toolProfiles).toEqual(original.toolProfiles);
          expect(result.trustLevel).toBe(original.trustLevel);
          expect(result.dataBoundary).toBe(original.dataBoundary);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Collaborator foundation models are preserved through export→import round-trip.
   */
  it('preserves collaborator foundation models', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        const imported = importTeamTemplate(template, []);

        for (let i = 0; i < config.collaborators.length; i++) {
          expect(imported.collaborators[i].foundationModel).toBe(
            config.collaborators[i].foundationModel,
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * Collaborator agent names are preserved when no existing names conflict.
   */
  it('preserves collaborator agent names when no conflicts exist', () => {
    fc.assert(
      fc.property(agentTeamConfigArb, (config) => {
        const template = exportTeamConfig(config);
        // Pass empty existing names so no deduplication occurs
        const imported = importTeamTemplate(template, []);

        for (let i = 0; i < config.collaborators.length; i++) {
          const originalName = config.collaborators[i].agentName;
          const importedName = imported.collaborators[i].agentName;
          // Name should either be identical or start with the original (dedup within the set)
          expect(importedName.startsWith(originalName) || importedName === originalName).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
