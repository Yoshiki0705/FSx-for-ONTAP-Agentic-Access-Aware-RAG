/**
 * Guardrails Organizational Safeguards — Backend Logic
 *
 * Provides guardrail trace parsing, structured intervention logging,
 * and EMF metrics emission for Bedrock Guardrails integration.
 */

// ========================================
// Types
// ========================================

export interface GuardrailResult {
  status: 'safe' | 'filtered' | 'blocked' | 'error' | 'disabled';
  action: string;
  inputAssessment: 'PASSED' | 'BLOCKED';
  outputAssessment: 'PASSED' | 'BLOCKED' | 'FILTERED';
  filteredCategories: string[];
  guardrailId?: string;
}

export interface GuardrailInterventionLog {
  timestamp: string;
  userId: string;
  sessionId: string;
  interventionType: 'INPUT_BLOCKED' | 'OUTPUT_FILTERED';
  filterCategories: string[];
  guardrailId: string;
}

// ========================================
// parseGuardrailTrace
// ========================================

/**
 * Parse a Bedrock guardrailTrace object into a normalized GuardrailResult.
 *
 * - action=NONE → safe
 * - action=GUARDRAIL_INTERVENED with inputAssessment blocked → blocked
 * - action=GUARDRAIL_INTERVENED with outputAssessment blocked/filtered → filtered
 * - Invalid/missing trace → error
 */
export function parseGuardrailTrace(trace: any): GuardrailResult {
  if (!trace || typeof trace !== 'object') {
    return {
      status: 'error',
      action: 'ERROR',
      inputAssessment: 'PASSED',
      outputAssessment: 'PASSED',
      filteredCategories: [],
    };
  }

  const action = trace.action || 'NONE';

  if (action === 'NONE') {
    return {
      status: 'safe',
      action: 'NONE',
      inputAssessment: 'PASSED',
      outputAssessment: 'PASSED',
      filteredCategories: [],
      guardrailId: trace.guardrailId,
    };
  }

  if (action === 'GUARDRAIL_INTERVENED') {
    const categories: string[] = [];

    // Extract filter categories from inputAssessments
    const inputAssessments = trace.inputAssessments || trace.inputAssessment;
    const outputAssessments = trace.outputAssessments || trace.outputAssessment;

    let inputBlocked = false;
    let outputFiltered = false;

    if (Array.isArray(inputAssessments)) {
      for (const assessment of inputAssessments) {
        if (assessment?.contentPolicy?.filters) {
          for (const filter of assessment.contentPolicy.filters) {
            if (filter.action === 'BLOCKED') {
              categories.push(filter.type || 'UNKNOWN');
              inputBlocked = true;
            }
          }
        }
        if (assessment?.topicPolicy?.topics) {
          for (const topic of assessment.topicPolicy.topics) {
            if (topic.action === 'BLOCKED') {
              categories.push(topic.name || 'TOPIC');
              inputBlocked = true;
            }
          }
        }
        if (assessment?.sensitiveInformationPolicy?.piiEntities) {
          for (const pii of assessment.sensitiveInformationPolicy.piiEntities) {
            if (pii.action === 'BLOCKED' || pii.action === 'ANONYMIZED') {
              categories.push('PII');
              inputBlocked = true;
            }
          }
        }
      }
    }

    if (Array.isArray(outputAssessments)) {
      for (const assessment of outputAssessments) {
        if (assessment?.contentPolicy?.filters) {
          for (const filter of assessment.contentPolicy.filters) {
            if (filter.action === 'BLOCKED') {
              categories.push(filter.type || 'UNKNOWN');
              outputFiltered = true;
            }
          }
        }
        if (assessment?.topicPolicy?.topics) {
          for (const topic of assessment.topicPolicy.topics) {
            if (topic.action === 'BLOCKED') {
              categories.push(topic.name || 'TOPIC');
              outputFiltered = true;
            }
          }
        }
      }
    }

    // If no specific categories found but action is INTERVENED, mark as filtered
    if (!inputBlocked && !outputFiltered) {
      inputBlocked = true; // Default assumption
    }

    const uniqueCategories = [...new Set(categories)];

    return {
      status: inputBlocked && !outputFiltered ? 'blocked' : 'filtered',
      action: 'GUARDRAIL_INTERVENED',
      inputAssessment: inputBlocked ? 'BLOCKED' : 'PASSED',
      outputAssessment: outputFiltered ? 'BLOCKED' : 'PASSED',
      filteredCategories: uniqueCategories,
      guardrailId: trace.guardrailId,
    };
  }

  // Unknown action
  return {
    status: 'error',
    action: action,
    inputAssessment: 'PASSED',
    outputAssessment: 'PASSED',
    filteredCategories: [],
  };
}

// ========================================
// logGuardrailIntervention
// ========================================

/**
 * Log a guardrail intervention event as structured JSON.
 * Privacy: NEVER includes blocked input text or filtered output text.
 *
 * Returns the log entry for testing purposes.
 */
export function logGuardrailIntervention(params: {
  userId: string;
  sessionId: string;
  interventionType: 'INPUT_BLOCKED' | 'OUTPUT_FILTERED';
  filterCategories: string[];
  guardrailId: string;
}): GuardrailInterventionLog {
  const logEntry: GuardrailInterventionLog = {
    timestamp: new Date().toISOString(),
    userId: params.userId,
    sessionId: params.sessionId,
    interventionType: params.interventionType,
    filterCategories: params.filterCategories,
    guardrailId: params.guardrailId,
  };

  const structuredLog = {
    level: 'WARN',
    service: 'permission-aware-rag',
    event: 'GUARDRAIL_INTERVENTION',
    ...logEntry,
  };

  console.log(JSON.stringify(structuredLog));

  return logEntry;
}

// ========================================
// emitGuardrailMetrics
// ========================================

/**
 * Emit EMF (Embedded Metric Format) metrics for a GuardrailResult.
 *
 * Metrics:
 * - GuardrailsInputBlocked: 1 if input was blocked, 0 otherwise
 * - GuardrailsOutputFiltered: 1 if output was filtered/blocked, 0 otherwise
 * - GuardrailsPassthrough: 1 if status is safe, 0 otherwise
 *
 * Returns the EMF object for testing purposes.
 */
export function emitGuardrailMetrics(result: GuardrailResult): Record<string, any> {
  const inputBlocked = result.inputAssessment === 'BLOCKED' ? 1 : 0;
  const outputFiltered = (result.outputAssessment === 'FILTERED' || result.outputAssessment === 'BLOCKED') ? 1 : 0;
  const passthrough = result.status === 'safe' ? 1 : 0;

  const emf = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: 'PermissionAwareRAG/Guardrails',
        Dimensions: [['Operation']],
        Metrics: [
          { Name: 'GuardrailsInputBlocked', Unit: 'Count' },
          { Name: 'GuardrailsOutputFiltered', Unit: 'Count' },
          { Name: 'GuardrailsPassthrough', Unit: 'Count' },
        ],
      }],
    },
    Operation: 'guardrails',
    GuardrailsInputBlocked: inputBlocked,
    GuardrailsOutputFiltered: outputFiltered,
    GuardrailsPassthrough: passthrough,
  };

  console.log(JSON.stringify(emf));

  return emf;
}

// ========================================
// safeGuardrailCheck
// ========================================

/**
 * Wrapper for Guardrails API calls with 5s timeout and Fail-Open strategy.
 * On timeout or error, returns a passthrough result (status: 'error').
 */
export async function safeGuardrailCheck(
  checkFn: () => Promise<any>,
): Promise<GuardrailResult> {
  try {
    const result = await Promise.race([
      checkFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Guardrail timeout')), 5000)
      ),
    ]);
    return parseGuardrailTrace(result);
  } catch (error) {
    console.error('[Guardrails] Check failed, falling back to passthrough:', error);
    return {
      status: 'error',
      action: 'ERROR',
      inputAssessment: 'PASSED',
      outputAssessment: 'PASSED',
      filteredCategories: [],
    };
  }
}
