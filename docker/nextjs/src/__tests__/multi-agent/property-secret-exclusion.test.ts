/**
 * Property tests for Secret Exclusion from Exported Config
 * Feature: multi-agent-collaboration, Property 9: Secret Exclusion
 *
 * Validates: Requirements 9.6, 18.7
 *
 * Verifies that:
 * - For any AgentTeamConfig, exported JSON does not contain IAM role ARNs
 * - Exported JSON does not contain API keys or secrets
 * - Exported JSON does not contain internal AWS endpoint URLs
 * - Exported JSON does not contain generic ARN patterns
 * - Sensitive key values are cleared
 */

import * as fc from 'fast-check';
import { exportTeamConfig, excludeSecrets } from '@/utils/multi-agent/team-template';
import type {
  AgentTeamConfig,
  CollaboratorConfig,
  CollaboratorRole,
  RoutingMode,
  ToolProfile,
  TrustLevel,
  DataBoundary,
} from '@/types/multi-agent';

// ===== Secret Patterns for Verification =====

const IAM_ROLE_ARN_PATTERN = /arn:aws:iam::\d{12}:role\/[\w+=,.@\-/]+/;
const GENERIC_ARN_PATTERN = /arn:aws:[a-z0-9\-]+:[a-z0-9\-]*:\d{12}:[a-zA-Z0-9\-_/:.]+/;
const INTERNAL_ENDPOINT_PATTERN =
  /https?:\/\/[a-z0-9\-]+\.(?:execute-api|lambda|bedrock-agent|bedrock-runtime)\.[a-z0-9\-]+\.amazonaws\.com/;

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

// ===== Secret Injection Generators =====

/** Generates a realistic IAM role ARN */
const iamRoleArnArb = fc
  .nat({ max: 999999999999 })
  .map(
    (accountId) =>
      `arn:aws:iam::${String(accountId).padStart(12, '0')}:role/my-agent-role`,
  );

/** Generates a realistic API key string */
const apiKeyArb = fc
  .stringMatching(/^[A-Za-z0-9+/=]{20,40}$/)
  .map((key) => `api_key: "${key}"`);

/** Generates a realistic internal AWS endpoint URL */
const internalEndpointArb = fc.constantFrom(
  'https://abc123.execute-api.us-east-1.amazonaws.com/prod',
  'https://my-func.lambda.ap-northeast-1.amazonaws.com/2015-03-31/functions',
  'https://agent-xyz.bedrock-agent.us-west-2.amazonaws.com/agents',
  'https://runtime-abc.bedrock-runtime.eu-west-1.amazonaws.com/model',
);

/** Generates a generic ARN */
const genericArnArb = fc
  .nat({ max: 999999999999 })
  .map(
    (accountId) =>
      `arn:aws:bedrock:us-east-1:${String(accountId).padStart(12, '0')}:agent/ABCDEFGHIJ`,
  );

/** Generates a safe string (no secret patterns) */
const safeStringArb = fc.stringMatching(/^[a-z][a-z0-9 -]{0,18}[a-z0-9]$/);

const foundationModelArb = fc.constantFrom(
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
);

// ===== Config Generator with Injected Secrets =====

/**
 * Generates an AgentTeamConfig with secrets injected into various fields.
 * This tests that exportTeamConfig properly strips them out.
 */
const configWithSecretsArb: fc.Arbitrary<AgentTeamConfig> = fc
  .tuple(
    safeStringArb,
    safeStringArb,
    fc.constantFrom(...ROUTING_MODES),
    fc.boolean(),
    fc.array(
      fc.record({
        agentName: safeStringArb,
        role: fc.constantFrom(...COLLABORATOR_ROLES) as fc.Arbitrary<CollaboratorRole>,
        foundationModel: foundationModelArb,
        toolProfiles: fc.array(fc.constantFrom(...TOOL_PROFILES) as fc.Arbitrary<ToolProfile>, {
          minLength: 0,
          maxLength: 3,
        }),
        trustLevel: fc.constantFrom(...TRUST_LEVELS) as fc.Arbitrary<TrustLevel>,
        dataBoundary: fc.constantFrom(...DATA_BOUNDARIES) as fc.Arbitrary<DataBoundary>,
        instruction: fc.option(
          fc.oneof(
            safeStringArb,
            iamRoleArnArb,
            internalEndpointArb,
            genericArnArb,
          ),
          { nil: undefined },
        ),
      }),
      { minLength: 1, maxLength: 5 },
    ),
    iamRoleArnArb,
    genericArnArb,
  )
  .map(([teamName, description, routingMode, autoRouting, collabs, supervisorArn, agentArn]) => {
    const collaborators: CollaboratorConfig[] = collabs.map((c, i) => ({
      agentId: i % 2 === 0 ? agentArn : `agent-${i}`,
      agentAliasId: `alias-${i}`,
      agentName: c.agentName,
      role: c.role,
      foundationModel: c.foundationModel,
      toolProfiles: c.toolProfiles,
      trustLevel: c.trustLevel,
      dataBoundary: c.dataBoundary,
      instruction: c.instruction,
    }));

    return {
      teamId: `team-${Date.now()}`,
      teamName,
      description,
      supervisorAgentId: supervisorArn,
      supervisorAliasId: `alias-supervisor`,
      routingMode,
      autoRouting,
      collaborators,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AgentTeamConfig;
  });

// ===== Helpers =====

/** Recursively collect all string values from an object */
function collectAllStrings(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) return obj.flatMap(collectAllStrings);
  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).flatMap(collectAllStrings);
  }
  return [];
}

// ===== Property 9: Secret Exclusion =====

describe('Feature: multi-agent-collaboration, Property 9: Secret Exclusion from Exported Config', () => {
  /**
   * **Validates: Requirements 9.6, 18.7**
   *
   * Exported JSON must not contain IAM role ARN patterns.
   */
  it('exported JSON does not contain IAM role ARNs', () => {
    fc.assert(
      fc.property(configWithSecretsArb, (config) => {
        const template = exportTeamConfig(config);
        const jsonStr = JSON.stringify(template);

        expect(jsonStr).not.toMatch(IAM_ROLE_ARN_PATTERN);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.6, 18.7**
   *
   * Exported JSON must not contain generic ARN patterns.
   */
  it('exported JSON does not contain generic ARN patterns', () => {
    fc.assert(
      fc.property(configWithSecretsArb, (config) => {
        const template = exportTeamConfig(config);
        const jsonStr = JSON.stringify(template);

        expect(jsonStr).not.toMatch(GENERIC_ARN_PATTERN);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.6, 18.7**
   *
   * Exported JSON must not contain internal AWS endpoint URLs.
   */
  it('exported JSON does not contain internal AWS endpoint URLs', () => {
    fc.assert(
      fc.property(configWithSecretsArb, (config) => {
        const template = exportTeamConfig(config);
        const jsonStr = JSON.stringify(template);

        expect(jsonStr).not.toMatch(INTERNAL_ENDPOINT_PATTERN);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.6, 18.7**
   *
   * excludeSecrets clears values for sensitive keys (iamRoleArn, apiKey, etc.).
   */
  it('excludeSecrets clears sensitive key values', () => {
    fc.assert(
      fc.property(
        fc.record({
          iamRoleArn: iamRoleArnArb,
          apiKey: safeStringArb,
          secretKey: safeStringArb,
          password: safeStringArb,
          normalField: safeStringArb,
        }),
        (obj) => {
          const sanitized = excludeSecrets(obj) as Record<string, unknown>;

          expect(sanitized.iamRoleArn).toBe('');
          expect(sanitized.apiKey).toBe('');
          expect(sanitized.secretKey).toBe('');
          expect(sanitized.password).toBe('');
          // Normal fields should be preserved (not cleared)
          expect(sanitized.normalField).toBe(obj.normalField);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.6, 18.7**
   *
   * No string value in the exported template contains an ARN pattern,
   * even when secrets are injected into instruction fields.
   */
  it('no string value in exported template contains ARN patterns', () => {
    fc.assert(
      fc.property(configWithSecretsArb, (config) => {
        const template = exportTeamConfig(config);
        const allStrings = collectAllStrings(template);

        for (const str of allStrings) {
          expect(str).not.toMatch(IAM_ROLE_ARN_PATTERN);
          expect(str).not.toMatch(GENERIC_ARN_PATTERN);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.6, 18.7**
   *
   * Exported template still preserves non-secret structural data
   * (team name, collaborator roles, etc.) even after secret exclusion.
   */
  it('preserves non-secret structural data after secret exclusion', () => {
    fc.assert(
      fc.property(configWithSecretsArb, (config) => {
        const template = exportTeamConfig(config);

        // Structural data should be preserved
        expect(template.teamName).toBe(config.teamName);
        expect(template.description).toBe(config.description);
        expect(template.routingMode).toBe(config.routingMode);
        expect(template.collaborators.length).toBe(config.collaborators.length);

        for (let i = 0; i < config.collaborators.length; i++) {
          expect(template.collaborators[i].role).toBe(config.collaborators[i].role);
          expect(template.collaborators[i].trustLevel).toBe(config.collaborators[i].trustLevel);
          expect(template.collaborators[i].dataBoundary).toBe(config.collaborators[i].dataBoundary);
        }
      }),
      { numRuns: 100 },
    );
  });
});
