/**
 * Structured Logger for Multi-Agent Execution
 *
 * JSON-format logging for all multi-agent execution steps.
 * Automatically excludes secret information (IAM Role ARNs, user SIDs, etc.)
 * from log output.
 *
 * Validates: Requirements 18.6
 */

// ===== Secret Exclusion Patterns =====

/** Patterns to redact from log values */
const REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /arn:aws:iam::\d{12}:role\/[\w+=,.@\-/]+/g, replacement: '[REDACTED_IAM_ARN]' },
  { pattern: /arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:[a-zA-Z0-9\-_/:.]+/g, replacement: '[REDACTED_ARN]' },
  { pattern: /S-1-5-21-\d+-\d+-\d+-\d+/g, replacement: '[REDACTED_SID]' },
  { pattern: /(?:api[_-]?key|secret|password|token)["\s:=]+["']?([A-Za-z0-9+/=_-]{16,})["']?/gi, replacement: '[REDACTED_SECRET]' },
];

/** Keys whose values should be fully redacted */
const SENSITIVE_KEYS = new Set([
  'iamRoleArn',
  'roleArn',
  'apiKey',
  'secretKey',
  'password',
  'credentials',
  'accessKeyId',
  'secretAccessKey',
  'sessionToken',
  'sid',
  'sids',
  'groupSids',
]);

// ===== Log Levels =====

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ===== Sanitization =====

/**
 * Recursively sanitize a value, redacting secrets.
 */
function sanitizeValue(value: unknown, key?: string): unknown {
  // Redact sensitive keys entirely
  if (key && SENSITIVE_KEYS.has(key)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    let sanitized = value;
    for (const { pattern, replacement } of REDACT_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeValue(v, k);
    }
    return result;
  }

  return value;
}

// ===== Structured Log Entry =====

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  action: string;
  traceId?: string;
  sessionId?: string;
  teamId?: string;
  collaboratorId?: string;
  collaboratorRole?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

// ===== Logger =====

/**
 * Create a structured logger for multi-agent execution.
 *
 * All log entries are JSON-formatted and secret-sanitized.
 *
 * @param component - Component name (e.g. 'supervisor', 'permission-resolver')
 * @returns Logger functions for each level
 */
export function createStructuredLogger(component: string) {
  function log(level: LogLevel, action: string, data?: Partial<StructuredLogEntry>) {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      action,
      ...data,
    };

    // Sanitize the entire entry
    const sanitized = sanitizeValue(entry) as StructuredLogEntry;
    const json = JSON.stringify(sanitized);

    switch (level) {
      case 'debug':
        console.debug(json);
        break;
      case 'info':
        console.info(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'error':
        console.error(json);
        break;
    }

    return sanitized;
  }

  return {
    debug: (action: string, data?: Partial<StructuredLogEntry>) => log('debug', action, data),
    info: (action: string, data?: Partial<StructuredLogEntry>) => log('info', action, data),
    warn: (action: string, data?: Partial<StructuredLogEntry>) => log('warn', action, data),
    error: (action: string, data?: Partial<StructuredLogEntry>) => log('error', action, data),
  };
}
