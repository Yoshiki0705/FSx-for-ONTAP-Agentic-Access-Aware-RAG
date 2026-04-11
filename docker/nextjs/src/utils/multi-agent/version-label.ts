/**
 * Version Label Utility for Agent Team Config
 *
 * Provides version labeling, comparison, and management for Agent Team
 * configurations. Supports semantic-style labels and active version switching.
 *
 * Validates: Requirements 17.1, 17.2
 */

import type { AgentTeamConfig } from '@/types/multi-agent';

// ===== Version Label Format =====

/** Version label pattern: v{major}.{minor}[-suffix] e.g. "v1.0", "v1.1-experiment" */
const VERSION_LABEL_PATTERN = /^v\d+\.\d+(-[a-zA-Z0-9_-]+)?$/;

/**
 * Validate a version label string.
 *
 * @param label - Version label to validate
 * @returns true if the label matches the expected format
 */
export function isValidVersionLabel(label: string): boolean {
  return VERSION_LABEL_PATTERN.test(label);
}

/**
 * Generate the next version label from the current one.
 *
 * Increments the minor version. If the current label has a suffix, it is removed.
 *
 * @param current - Current version label (e.g. "v1.0", "v1.2-experiment")
 * @returns Next version label (e.g. "v1.1", "v1.3")
 */
export function nextVersionLabel(current?: string): string {
  if (!current || !isValidVersionLabel(current)) {
    return 'v1.0';
  }

  const match = current.match(/^v(\d+)\.(\d+)/);
  if (!match) return 'v1.0';

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  return `v${major}.${minor + 1}`;
}

/**
 * Compare two version labels for sorting.
 *
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareVersionLabels(a: string, b: string): number {
  const parseVersion = (label: string) => {
    const match = label.match(/^v(\d+)\.(\d+)/);
    if (!match) return { major: 0, minor: 0 };
    return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
  };

  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major - vb.major;
  return va.minor - vb.minor;
}

/**
 * Apply a version label to an AgentTeamConfig.
 *
 * Returns a new config with the versionLabel set and updatedAt refreshed.
 *
 * @param config - The team config to label
 * @param label - Version label to apply
 * @returns New config with version label
 */
export function applyVersionLabel(
  config: AgentTeamConfig,
  label: string,
): AgentTeamConfig {
  if (!isValidVersionLabel(label)) {
    throw new Error(`Invalid version label: '${label}'. Expected format: v{major}.{minor}[-suffix]`);
  }

  return {
    ...config,
    versionLabel: label,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get the active version from a list of versioned configs.
 *
 * Returns the config with the highest version label, or the most recently
 * updated config if no version labels are present.
 *
 * @param configs - List of team configs (potentially multiple versions)
 * @returns The active (latest) config, or undefined if empty
 */
export function getActiveVersion(
  configs: AgentTeamConfig[],
): AgentTeamConfig | undefined {
  if (configs.length === 0) return undefined;

  const versioned = configs.filter((c) => c.versionLabel && isValidVersionLabel(c.versionLabel));

  if (versioned.length > 0) {
    return versioned.sort((a, b) =>
      compareVersionLabels(b.versionLabel!, a.versionLabel!),
    )[0];
  }

  // Fallback: most recently updated
  return [...configs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}
