/**
 * Team Config Export/Import Utility — Unit Tests
 *
 * exportTeamConfig, importTeamTemplate, deduplicateNames, excludeSecrets の
 * ユニットテストを提供する。
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6, 18.7
 */

import {
  exportTeamConfig,
  importTeamTemplate,
  deduplicateNames,
  excludeSecrets,
} from '../team-template';
import type { AgentTeamConfig, AgentTeamTemplate } from '@/types/multi-agent';

// ===== Test Fixtures =====

function createTestConfig(overrides?: Partial<AgentTeamConfig>): AgentTeamConfig {
  return {
    teamId: 'team-abc-123',
    teamName: 'Test Team',
    description: 'A test team',
    supervisorAgentId: 'agent-supervisor-001',
    supervisorAliasId: 'alias-supervisor-001',
    routingMode: 'supervisor_router',
    autoRouting: false,
    collaborators: [
      {
        agentId: 'agent-perm-001',
        agentAliasId: 'alias-perm-001',
        agentName: 'Permission Resolver',
        role: 'permission-resolver',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: ['access-check'],
        trustLevel: 'team-safe',
        dataBoundary: 'user-scoped',
        instruction: 'Resolve user permissions',
      },
      {
        agentId: 'agent-ret-002',
        agentAliasId: 'alias-ret-002',
        agentName: 'Retrieval Agent',
        role: 'retrieval',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: ['kb-retrieve'],
        trustLevel: 'team-safe',
        dataBoundary: 'user-scoped',
      },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTestTemplate(overrides?: Partial<AgentTeamTemplate>): AgentTeamTemplate {
  return {
    schemaVersion: '1.0',
    teamName: 'Imported Team',
    description: 'An imported team',
    routingMode: 'supervisor_router',
    autoRouting: false,
    supervisorInstruction: '',
    supervisorModel: '',
    collaborators: [
      {
        role: 'permission-resolver',
        agentName: 'Permission Resolver',
        instruction: 'Resolve permissions',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: ['access-check'],
        trustLevel: 'team-safe',
        dataBoundary: 'user-scoped',
      },
      {
        role: 'retrieval',
        agentName: 'Retrieval Agent',
        instruction: 'Search KB',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: ['kb-retrieve'],
        trustLevel: 'team-safe',
        dataBoundary: 'user-scoped',
      },
    ],
    exportedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ===== excludeSecrets =====

describe('excludeSecrets', () => {
  it('removes IAM Role ARNs from strings', () => {
    const input = 'Role: arn:aws:iam::123456789012:role/my-agent-role';
    const result = excludeSecrets(input);
    expect(result).not.toContain('arn:aws:iam::');
    expect(result).not.toContain('123456789012');
  });

  it('removes generic ARNs from strings', () => {
    const input = 'Resource: arn:aws:bedrock:us-east-1:123456789012:agent/ABCDEF';
    const result = excludeSecrets(input);
    expect(result).not.toContain('arn:aws:bedrock');
    expect(result).not.toContain('123456789012');
  });

  it('removes internal AWS endpoint URLs', () => {
    const input = 'Endpoint: https://abc123.execute-api.us-east-1.amazonaws.com/prod';
    const result = excludeSecrets(input);
    expect(result).not.toContain('amazonaws.com');
  });

  it('clears sensitive key values in objects', () => {
    const input = {
      name: 'test',
      iamRoleArn: 'arn:aws:iam::123456789012:role/test',
      apiKey: 'super-secret-key-12345678901234567890',
      password: 'my-password',
    };
    const result = excludeSecrets(input) as Record<string, unknown>;
    expect(result.name).toBe('test');
    expect(result.iamRoleArn).toBe('');
    expect(result.apiKey).toBe('');
    expect(result.password).toBe('');
  });

  it('recursively processes nested objects', () => {
    const input = {
      outer: {
        inner: {
          secretKey: 'should-be-cleared',
          value: 'keep this',
        },
      },
    };
    const result = excludeSecrets(input) as any;
    expect(result.outer.inner.secretKey).toBe('');
    expect(result.outer.inner.value).toBe('keep this');
  });

  it('processes arrays recursively', () => {
    const input = [
      { roleArn: 'arn:aws:iam::123456789012:role/test', name: 'a' },
      { roleArn: 'arn:aws:iam::123456789012:role/test2', name: 'b' },
    ];
    const result = excludeSecrets(input) as any[];
    expect(result[0].roleArn).toBe('');
    expect(result[0].name).toBe('a');
    expect(result[1].roleArn).toBe('');
    expect(result[1].name).toBe('b');
  });

  it('returns primitives unchanged', () => {
    expect(excludeSecrets(42)).toBe(42);
    expect(excludeSecrets(true)).toBe(true);
    expect(excludeSecrets(null)).toBe(null);
    expect(excludeSecrets(undefined)).toBe(undefined);
  });
});

// ===== deduplicateNames =====

describe('deduplicateNames', () => {
  it('returns names unchanged when no conflicts', () => {
    const result = deduplicateNames(['Alpha', 'Beta'], ['Gamma']);
    expect(result).toEqual(['Alpha', 'Beta']);
  });

  it('appends suffix for conflicting names', () => {
    const result = deduplicateNames(['Agent-A', 'Agent-B'], ['Agent-A']);
    expect(result).toEqual(['Agent-A-2', 'Agent-B']);
  });

  it('handles multiple conflicts with same name', () => {
    const result = deduplicateNames(['Agent'], ['Agent', 'Agent-2']);
    expect(result).toEqual(['Agent-3']);
  });

  it('handles internal duplicates in names array', () => {
    const result = deduplicateNames(['Agent', 'Agent'], []);
    expect(result[0]).toBe('Agent');
    expect(result[1]).toBe('Agent-2');
    expect(new Set(result).size).toBe(result.length);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateNames([], ['existing'])).toEqual([]);
  });

  it('ensures all results are unique', () => {
    const result = deduplicateNames(
      ['A', 'A', 'A', 'B', 'B'],
      ['A', 'A-2', 'B'],
    );
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });
});

// ===== exportTeamConfig =====

describe('exportTeamConfig', () => {
  it('converts AgentTeamConfig to AgentTeamTemplate format', () => {
    const config = createTestConfig();
    const template = exportTeamConfig(config, 'admin');

    expect(template.schemaVersion).toBe('1.0');
    expect(template.teamName).toBe('Test Team');
    expect(template.description).toBe('A test team');
    expect(template.routingMode).toBe('supervisor_router');
    expect(template.autoRouting).toBe(false);
    expect(template.exportedBy).toBe('admin');
    expect(template.exportedAt).toBeTruthy();
    expect(template.collaborators).toHaveLength(2);
  });

  it('strips agent IDs and alias IDs from collaborators', () => {
    const config = createTestConfig();
    const template = exportTeamConfig(config);

    for (const c of template.collaborators) {
      // Template collaborators should not have agentId or agentAliasId
      expect(c).not.toHaveProperty('agentId');
      expect(c).not.toHaveProperty('agentAliasId');
    }
  });

  it('strips environment-specific data (teamId, supervisorAgentId, etc.)', () => {
    const config = createTestConfig();
    const template = exportTeamConfig(config);

    expect(template).not.toHaveProperty('teamId');
    expect(template).not.toHaveProperty('supervisorAgentId');
    expect(template).not.toHaveProperty('supervisorAliasId');
    expect(template).not.toHaveProperty('createdAt');
    expect(template).not.toHaveProperty('updatedAt');
  });

  it('preserves collaborator role, model, toolProfiles, trustLevel, dataBoundary', () => {
    const config = createTestConfig();
    const template = exportTeamConfig(config);

    const first = template.collaborators[0];
    expect(first.role).toBe('permission-resolver');
    expect(first.foundationModel).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
    expect(first.toolProfiles).toEqual(['access-check']);
    expect(first.trustLevel).toBe('team-safe');
    expect(first.dataBoundary).toBe('user-scoped');
  });

  it('excludes secrets from instruction text containing ARNs', () => {
    const config = createTestConfig({
      collaborators: [
        {
          agentId: 'agent-001',
          agentAliasId: 'alias-001',
          agentName: 'Test Agent',
          role: 'analysis',
          foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          toolProfiles: [],
          trustLevel: 'user-safe',
          dataBoundary: 'public',
          instruction: 'Use role arn:aws:iam::123456789012:role/my-role for access',
        },
      ],
    });
    const template = exportTeamConfig(config);
    const instruction = template.collaborators[0].instruction;
    expect(instruction).not.toContain('arn:aws:iam::');
    expect(instruction).not.toContain('123456789012');
  });

  it('works without exportedBy parameter', () => {
    const config = createTestConfig();
    const template = exportTeamConfig(config);
    expect(template.exportedBy).toBeUndefined();
  });
});

// ===== importTeamTemplate =====

describe('importTeamTemplate', () => {
  it('converts AgentTeamTemplate to AgentTeamConfig', () => {
    const template = createTestTemplate();
    const config = importTeamTemplate(template, []);

    expect(config.teamName).toBe('Imported Team');
    expect(config.description).toBe('An imported team');
    expect(config.routingMode).toBe('supervisor_router');
    expect(config.autoRouting).toBe(false);
    expect(config.collaborators).toHaveLength(2);
  });

  it('generates placeholder teamId', () => {
    const template = createTestTemplate();
    const config = importTeamTemplate(template, []);
    expect(config.teamId).toMatch(/^pending-team-/);
  });

  it('generates placeholder supervisorAgentId and supervisorAliasId', () => {
    const template = createTestTemplate();
    const config = importTeamTemplate(template, []);
    expect(config.supervisorAgentId).toBe('pending-supervisor');
    expect(config.supervisorAliasId).toBe('pending-supervisor-alias');
  });

  it('generates placeholder agentId and agentAliasId for each collaborator', () => {
    const template = createTestTemplate();
    const config = importTeamTemplate(template, []);

    config.collaborators.forEach((c, i) => {
      expect(c.agentId).toBe(`pending-agent-${i}`);
      expect(c.agentAliasId).toBe(`pending-alias-${i}`);
    });
  });

  it('deduplicates collaborator names against existing names', () => {
    const template = createTestTemplate();
    const config = importTeamTemplate(template, ['Permission Resolver']);

    expect(config.collaborators[0].agentName).toBe('Permission Resolver-2');
    expect(config.collaborators[1].agentName).toBe('Retrieval Agent');
  });

  it('sets createdAt and updatedAt to current time', () => {
    const before = new Date().toISOString();
    const template = createTestTemplate();
    const config = importTeamTemplate(template, []);
    const after = new Date().toISOString();

    expect(config.createdAt >= before).toBe(true);
    expect(config.createdAt <= after).toBe(true);
    expect(config.updatedAt).toBe(config.createdAt);
  });

  it('preserves collaborator metadata (role, model, toolProfiles, trustLevel, dataBoundary)', () => {
    const template = createTestTemplate();
    const config = importTeamTemplate(template, []);

    const first = config.collaborators[0];
    expect(first.role).toBe('permission-resolver');
    expect(first.foundationModel).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
    expect(first.toolProfiles).toEqual(['access-check']);
    expect(first.trustLevel).toBe('team-safe');
    expect(first.dataBoundary).toBe('user-scoped');
  });
});
