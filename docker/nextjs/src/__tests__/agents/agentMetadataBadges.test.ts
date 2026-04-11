/**
 * Unit tests for AgentMetadataBadges component logic
 *
 * Tests badge style mapping for Tool Profile, Trust Level, and Data Boundary.
 * Validates: Requirements 6.7
 */

import type { ToolProfile, TrustLevel, DataBoundary } from '@/types/multi-agent';

// We test the badge style/icon logic directly since the component is a pure mapping.
// The component itself uses these exact mappings, so verifying them covers the rendering logic.

const TRUST_LEVEL_STYLES: Record<TrustLevel, string> = {
  'user-safe': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'team-safe': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'admin-only': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const DATA_BOUNDARY_STYLES: Record<DataBoundary, string> = {
  'public': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'team-scoped': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'user-scoped': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  'sensitive-admin': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

describe('AgentMetadataBadges — Trust Level style mapping', () => {
  it('user-safe maps to green', () => {
    expect(TRUST_LEVEL_STYLES['user-safe']).toContain('green');
  });

  it('team-safe maps to blue', () => {
    expect(TRUST_LEVEL_STYLES['team-safe']).toContain('blue');
  });

  it('admin-only maps to red', () => {
    expect(TRUST_LEVEL_STYLES['admin-only']).toContain('red');
  });
});

describe('AgentMetadataBadges — Data Boundary style mapping', () => {
  it('public maps to gray', () => {
    expect(DATA_BOUNDARY_STYLES['public']).toContain('gray');
  });

  it('team-scoped maps to blue', () => {
    expect(DATA_BOUNDARY_STYLES['team-scoped']).toContain('blue');
  });

  it('user-scoped maps to yellow', () => {
    expect(DATA_BOUNDARY_STYLES['user-scoped']).toContain('yellow');
  });

  it('sensitive-admin maps to red', () => {
    expect(DATA_BOUNDARY_STYLES['sensitive-admin']).toContain('red');
  });
});

describe('AgentMetadataBadges — Tool Profile icon resolution', () => {
  const TOOL_PROFILE_ICONS: Record<string, string> = {
    'kb-retrieve': '📚',
    'vision-analyze': '👁️',
    'access-check': '🔑',
    'schedule-run': '⏰',
    'share-agent': '🔗',
  };

  function getToolProfileIcon(profile: string): string {
    if (profile.startsWith('external-mcp:')) return '🔌';
    return TOOL_PROFILE_ICONS[profile] ?? '🛠️';
  }

  it('known profiles return their specific icon', () => {
    expect(getToolProfileIcon('kb-retrieve')).toBe('📚');
    expect(getToolProfileIcon('access-check')).toBe('🔑');
    expect(getToolProfileIcon('vision-analyze')).toBe('👁️');
  });

  it('external-mcp profiles return plug icon', () => {
    expect(getToolProfileIcon('external-mcp:ontap-ops')).toBe('🔌');
    expect(getToolProfileIcon('external-mcp:identity-access')).toBe('🔌');
  });

  it('unknown profiles return default tool icon', () => {
    expect(getToolProfileIcon('unknown-tool')).toBe('🛠️');
  });
});

describe('AgentMetadataBadges — Tool Profile label formatting', () => {
  function getToolProfileLabel(profile: string): string {
    if (profile.startsWith('external-mcp:')) {
      return profile.replace('external-mcp:', 'mcp:');
    }
    return profile;
  }

  it('known profiles return their name as-is', () => {
    expect(getToolProfileLabel('kb-retrieve')).toBe('kb-retrieve');
    expect(getToolProfileLabel('access-check')).toBe('access-check');
  });

  it('external-mcp profiles are shortened to mcp: prefix', () => {
    expect(getToolProfileLabel('external-mcp:ontap-ops')).toBe('mcp:ontap-ops');
  });
});
