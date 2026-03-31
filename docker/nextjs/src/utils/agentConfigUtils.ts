/**
 * Agent Config Utilities
 * Validation, export, and cron expression utilities for enterprise agent features
 */

import type { AgentConfig } from '@/types/enterprise-agent';
import type { AgentDetail } from '@/types/agent-directory';

const CURRENT_SCHEMA_VERSION = '1.0';

const REQUIRED_FIELDS: (keyof AgentConfig)[] = [
  'schemaVersion',
  'agentName',
  'instruction',
  'foundationModel',
];

const EXCLUDED_EXPORT_FIELDS = [
  'agentId',
  'agentResourceRoleArn',
  'agentVersion',
  'idleSessionTTLInSeconds',
  'agentStatus',
  'createdAt',
  'updatedAt',
];

/**
 * Validate an AgentConfig JSON object.
 * Returns { valid: true, errors: [] } if valid, or { valid: false, errors: [...] } with error messages.
 */
export function validateAgentConfig(json: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, errors: ['Invalid JSON: expected an object'] };
  }

  const obj = json as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (obj[field] === undefined || obj[field] === null) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof obj[field] !== 'string' || (obj[field] as string).trim().length === 0) {
      errors.push(`Field "${field}" must be a non-empty string`);
    }
  }

  if (obj.schemaVersion && obj.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push(`Incompatible schema version: ${obj.schemaVersion} (expected ${CURRENT_SCHEMA_VERSION})`);
  }

  if (obj.actionGroups !== undefined) {
    if (!Array.isArray(obj.actionGroups)) {
      errors.push('Field "actionGroups" must be an array');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Export an AgentDetail to a portable AgentConfig JSON.
 * Excludes environment-specific fields (agentId, agentResourceRoleArn, etc.)
 */
export function exportAgentConfig(agent: AgentDetail, exportedBy?: string): AgentConfig {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    agentName: agent.agentName,
    description: agent.description || '',
    instruction: agent.instruction || '',
    foundationModel: agent.foundationModel || '',
    actionGroups: (agent.actionGroups || []).map(ag => ({
      name: ag.actionGroupName,
      description: ag.description || '',
    })),
    exportedAt: new Date().toISOString(),
    exportedBy,
  };
}

/**
 * Validate an AWS EventBridge cron expression.
 * Format: cron(minute hour day-of-month month day-of-week year)
 * Each field can be: number, *, ?, or specific patterns.
 */
export function validateCronExpression(expr: string): boolean {
  if (!expr || typeof expr !== 'string') return false;

  const trimmed = expr.trim();

  // Must match cron(...) wrapper
  const match = trimmed.match(/^cron\((.+)\)$/);
  if (!match) return false;

  const parts = match[1].trim().split(/\s+/);
  if (parts.length !== 6) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek, year] = parts;

  // Basic field validation
  const isValidMinute = /^(\*|\?|\d{1,2}(,\d{1,2})*)$/.test(minute);
  const isValidHour = /^(\*|\?|\d{1,2}(,\d{1,2})*)$/.test(hour);
  const isValidDom = /^(\*|\?|\d{1,2}(,\d{1,2})*|L|LW|\d{1,2}W)$/.test(dayOfMonth);
  const isValidMonth = /^(\*|\?|\d{1,2}(,\d{1,2})*|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(month);
  const isValidDow = /^(\*|\?|[1-7](,[1-7])*|[1-7]-[1-7]|SUN|MON|TUE|WED|THU|FRI|SAT|[A-Z]{3}-[A-Z]{3}|[A-Z]{3}(,[A-Z]{3})*)$/i.test(dayOfWeek);
  const isValidYear = /^(\*|\d{4}(,\d{4})*)$/.test(year);

  return isValidMinute && isValidHour && isValidDom && isValidMonth && isValidDow && isValidYear;
}

/** Check if an exported config contains any excluded fields */
export function hasExcludedFields(config: Record<string, unknown>): boolean {
  return EXCLUDED_EXPORT_FIELDS.some(field => field in config);
}
