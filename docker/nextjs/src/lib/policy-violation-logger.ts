/**
 * Policy Violation Logger — EMF (Embedded Metric Format) for CloudWatch
 *
 * Namespace: PermissionAwareRAG/AgentPolicy
 * Metrics: PolicyViolationCount, PolicyEvaluationLatency
 */

export interface PolicyViolationLogParams {
  agentId: string;
  policyId: string;
  violationReason: string;
  attemptedAction: string;
  userId: string;
}

export interface PolicyViolationLog {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: Array<{
      Namespace: string;
      Dimensions: string[][];
      Metrics: Array<{ Name: string; Unit: string }>;
    }>;
  };
  agentId: string;
  policyId: string;
  violationReason: string;
  attemptedAction: string;
  userId: string;
  timestamp: string;
  PolicyViolationCount: number;
  PolicyEvaluationLatency: number;
}

export function createViolationLog(
  params: PolicyViolationLogParams,
  evaluationTimeMs: number,
): PolicyViolationLog {
  const now = new Date();
  return {
    _aws: {
      Timestamp: now.getTime(),
      CloudWatchMetrics: [
        {
          Namespace: 'PermissionAwareRAG/AgentPolicy',
          Dimensions: [['AgentId']],
          Metrics: [
            { Name: 'PolicyViolationCount', Unit: 'Count' },
            { Name: 'PolicyEvaluationLatency', Unit: 'Milliseconds' },
          ],
        },
      ],
    },
    agentId: params.agentId,
    policyId: params.policyId,
    violationReason: params.violationReason,
    attemptedAction: params.attemptedAction,
    userId: params.userId,
    timestamp: now.toISOString(),
    PolicyViolationCount: 1,
    PolicyEvaluationLatency: evaluationTimeMs,
  };
}

export function emitViolationLog(params: PolicyViolationLogParams, evaluationTimeMs: number): PolicyViolationLog {
  const log = createViolationLog(params, evaluationTimeMs);
  console.log(JSON.stringify(log));
  return log;
}
