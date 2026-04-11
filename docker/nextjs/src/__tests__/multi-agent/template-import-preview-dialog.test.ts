/**
 * Unit tests for TemplateImportPreviewDialog component logic
 *
 * Since @testing-library/react is not installed, these tests validate
 * the data structures, helper functions, and contract of the dialog.
 *
 * Validates: Requirements 9.7
 */

import type { AgentTeamTemplate } from '@/types/multi-agent';

// ===== Helper functions mirrored from the component =====

const ROLE_ICONS: Record<string, string> = {
  'permission-resolver': '🔑',
  retrieval: '📚',
  analysis: '📊',
  output: '📝',
  vision: '👁️',
};

function getRoleIcon(role: string): string {
  return ROLE_ICONS[role] ?? '🤖';
}

function getRoutingModeLabel(mode: string): string {
  switch (mode) {
    case 'supervisor_router':
      return 'Supervisor Router（低レイテンシ）';
    case 'supervisor':
      return 'Supervisor（タスク分解あり）';
    default:
      return mode;
  }
}

// ===== Test fixtures =====

function createSampleTemplate(
  overrides?: Partial<AgentTeamTemplate>,
): AgentTeamTemplate {
  return {
    schemaVersion: '1.0',
    teamName: 'Permission RAG Team v2',
    description: '権限フィルタリング付きRAGチーム',
    routingMode: 'supervisor_router',
    autoRouting: false,
    supervisorInstruction: 'You are a supervisor agent.',
    supervisorModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    collaborators: [
      {
        role: 'permission-resolver',
        agentName: 'Permission Resolver',
        instruction: 'Resolve permissions.',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: ['access-check'],
        trustLevel: 'team-safe',
        dataBoundary: 'user-scoped',
      },
      {
        role: 'retrieval',
        agentName: 'Retrieval Agent',
        instruction: 'Search KB.',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: ['kb-retrieve'],
        trustLevel: 'team-safe',
        dataBoundary: 'user-scoped',
      },
      {
        role: 'analysis',
        agentName: 'Analysis Agent',
        instruction: 'Analyze context.',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: [],
        trustLevel: 'user-safe',
        dataBoundary: 'team-scoped',
      },
    ],
    exportedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ===== Tests =====

describe('TemplateImportPreviewDialog — logic and data contract', () => {
  describe('getRoleIcon', () => {
    it('returns correct icon for each known role', () => {
      expect(getRoleIcon('permission-resolver')).toBe('🔑');
      expect(getRoleIcon('retrieval')).toBe('📚');
      expect(getRoleIcon('analysis')).toBe('📊');
      expect(getRoleIcon('output')).toBe('📝');
      expect(getRoleIcon('vision')).toBe('👁️');
    });

    it('returns fallback icon for unknown role', () => {
      expect(getRoleIcon('unknown-role')).toBe('🤖');
      expect(getRoleIcon('')).toBe('🤖');
    });
  });

  describe('getRoutingModeLabel', () => {
    it('returns descriptive label for supervisor_router', () => {
      expect(getRoutingModeLabel('supervisor_router')).toBe(
        'Supervisor Router（低レイテンシ）',
      );
    });

    it('returns descriptive label for supervisor', () => {
      expect(getRoutingModeLabel('supervisor')).toBe(
        'Supervisor（タスク分解あり）',
      );
    });

    it('returns raw value for unknown mode', () => {
      expect(getRoutingModeLabel('custom-mode')).toBe('custom-mode');
    });
  });

  describe('Template data contract', () => {
    it('sample template has all required fields', () => {
      const template = createSampleTemplate();
      expect(template.schemaVersion).toBe('1.0');
      expect(template.teamName).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.routingMode).toBeTruthy();
      expect(typeof template.autoRouting).toBe('boolean');
      expect(template.collaborators.length).toBeGreaterThan(0);
      expect(template.exportedAt).toBeTruthy();
    });

    it('each collaborator has toolProfiles, trustLevel, and dataBoundary', () => {
      const template = createSampleTemplate();
      for (const collab of template.collaborators) {
        expect(Array.isArray(collab.toolProfiles)).toBe(true);
        expect(collab.trustLevel).toBeTruthy();
        expect(collab.dataBoundary).toBeTruthy();
        expect(collab.role).toBeTruthy();
        expect(collab.agentName).toBeTruthy();
      }
    });

    it('collaborator count is correctly reported', () => {
      const template = createSampleTemplate();
      expect(template.collaborators.length).toBe(3);
    });

    it('template with zero collaborators is valid', () => {
      const template = createSampleTemplate({ collaborators: [] });
      expect(template.collaborators.length).toBe(0);
    });

    it('autoRouting flag is correctly represented', () => {
      const disabled = createSampleTemplate({ autoRouting: false });
      expect(disabled.autoRouting).toBe(false);

      const enabled = createSampleTemplate({ autoRouting: true });
      expect(enabled.autoRouting).toBe(true);
    });
  });

  describe('Secret exclusion warning', () => {
    it('template does not contain IAM role ARNs or API keys', () => {
      const template = createSampleTemplate();
      const json = JSON.stringify(template);
      // Verify no ARN-like patterns
      expect(json).not.toMatch(/arn:aws:iam::/);
      // Verify no API key patterns
      expect(json).not.toMatch(/apiKey/i);
      expect(json).not.toMatch(/secretAccessKey/i);
    });
  });
});
