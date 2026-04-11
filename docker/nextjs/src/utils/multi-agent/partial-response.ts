/**
 * Collaborator Timeout/Error Partial Response Logic
 *
 * Handles timeout (30s default) and error scenarios for collaborator agents:
 * - Timeout → skip collaborator, continue with remaining results
 * - Error → partial response from remaining collaborators
 * - All fail → error message to user
 *
 * Validates: Requirements 18.3, 18.4, 18.5
 */

import type { AgentTeamTraceEvent, CollaboratorRole } from '@/types/multi-agent';

// ===== Configuration =====

/** Default collaborator timeout in milliseconds */
export const DEFAULT_COLLABORATOR_TIMEOUT_MS = 30_000;

// ===== Types =====

export interface CollaboratorResult {
  collaboratorId: string;
  collaboratorName: string;
  role: CollaboratorRole;
  /** The response content from the collaborator, if successful */
  content?: string;
  /** Error message if the collaborator failed */
  error?: string;
  /** Whether the collaborator timed out */
  timedOut: boolean;
  /** Execution time in ms */
  executionTimeMs: number;
}

export interface PartialResponseResult {
  /** Aggregated response content from successful collaborators */
  content: string;
  /** Whether the response is partial (some collaborators failed/timed out) */
  isPartial: boolean;
  /** Whether all collaborators failed */
  allFailed: boolean;
  /** Summary of collaborator statuses */
  collaboratorSummary: Array<{
    name: string;
    role: CollaboratorRole;
    status: 'completed' | 'failed' | 'timeout' | 'skipped';
  }>;
  /** Error message (only when allFailed=true) */
  errorMessage?: string;
  /** Trace events for each collaborator */
  traceEvents: AgentTeamTraceEvent[];
}

// ===== Core Logic =====

/**
 * Build a partial response from collaborator results.
 *
 * - Successful results are aggregated into the response content.
 * - Timed-out collaborators are marked as SKIPPED (Requirement 18.3).
 * - Failed collaborators are logged, remaining results used (Requirement 18.4).
 * - If all collaborators fail, returns an error message (Requirement 18.5).
 *
 * @param results - Array of collaborator execution results
 * @returns Aggregated partial response with metadata
 */
export function buildPartialResponse(
  results: CollaboratorResult[],
): PartialResponseResult {
  const traceEvents: AgentTeamTraceEvent[] = [];
  const collaboratorSummary: PartialResponseResult['collaboratorSummary'] = [];
  const successfulContents: string[] = [];

  for (const result of results) {
    // Determine status
    let status: 'completed' | 'failed' | 'timeout' | 'skipped';
    let traceStatus: AgentTeamTraceEvent['status'];

    if (result.timedOut) {
      status = 'timeout';
      traceStatus = 'SKIPPED';
    } else if (result.error) {
      status = 'failed';
      traceStatus = 'FAILED';
    } else if (result.content) {
      status = 'completed';
      traceStatus = 'COMPLETED';
      successfulContents.push(result.content);
    } else {
      status = 'skipped';
      traceStatus = 'SKIPPED';
    }

    collaboratorSummary.push({
      name: result.collaboratorName,
      role: result.role,
      status,
    });

    traceEvents.push({
      collaboratorAgentId: result.collaboratorId,
      collaboratorRole: result.role,
      collaboratorName: result.collaboratorName,
      taskDescription: '',
      executionTimeMs: result.executionTimeMs,
      startTimeMs: 0,
      accessDenied: false,
      status: traceStatus,
      error: result.error || (result.timedOut ? `Timeout after ${result.executionTimeMs}ms` : undefined),
    });
  }

  const allFailed = successfulContents.length === 0 && results.length > 0;
  const isPartial = successfulContents.length > 0 && successfulContents.length < results.length;

  // Requirement 18.5: All collaborators failed → error message
  if (allFailed) {
    const failedNames = results.map((r) => r.collaboratorName).join(', ');
    return {
      content: '',
      isPartial: false,
      allFailed: true,
      collaboratorSummary,
      errorMessage:
        `全てのCollaborator Agent（${failedNames}）が失敗またはタイムアウトしました。` +
        'しばらく時間をおいて再度お試しください。',
      traceEvents,
    };
  }

  // Build aggregated content
  let content = successfulContents.join('\n\n');

  // Add partial response notice if some collaborators failed
  if (isPartial) {
    const failedCollabs = collaboratorSummary
      .filter((c) => c.status !== 'completed')
      .map((c) => `${c.name}(${c.status})`)
      .join(', ');
    content += `\n\n---\n⚠️ 一部のCollaborator（${failedCollabs}）が応答できなかったため、部分的な回答です。`;
  }

  return {
    content,
    isPartial,
    allFailed: false,
    collaboratorSummary,
    traceEvents,
  };
}

/**
 * Execute a collaborator with timeout.
 *
 * Wraps an async operation with a timeout. If the operation exceeds the
 * timeout, returns a timed-out result.
 *
 * @param collaboratorId - Agent ID
 * @param collaboratorName - Display name
 * @param role - Collaborator role
 * @param operation - Async operation to execute
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns CollaboratorResult
 */
export async function executeWithTimeout(
  collaboratorId: string,
  collaboratorName: string,
  role: CollaboratorRole,
  operation: () => Promise<string>,
  timeoutMs: number = DEFAULT_COLLABORATOR_TIMEOUT_MS,
): Promise<CollaboratorResult> {
  const startTime = Date.now();

  try {
    const content = await Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs),
      ),
    ]);

    return {
      collaboratorId,
      collaboratorName,
      role,
      content,
      timedOut: false,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.message === 'TIMEOUT';

    return {
      collaboratorId,
      collaboratorName,
      role,
      error: isTimeout ? undefined : (err instanceof Error ? err.message : String(err)),
      timedOut: isTimeout,
      executionTimeMs: elapsed,
    };
  }
}
