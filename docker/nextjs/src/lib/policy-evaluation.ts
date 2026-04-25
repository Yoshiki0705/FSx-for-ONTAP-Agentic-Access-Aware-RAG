/**
 * Policy Evaluation Middleware
 *
 * Evaluates agent actions against AgentCore Policy before execution.
 * Supports fail-open (default) and fail-closed modes.
 */

import { emitViolationLog } from './policy-violation-logger';

export interface PolicyEvaluationResult {
  allowed: boolean;
  policyId: string;
  evaluationTimeMs: number;
  violationReason?: string;
}

const POLICY_TIMEOUT_MS = 3000;

function isPolicyEnabled(): boolean {
  return process.env.AGENT_POLICY_ENABLED === 'true';
}

function getFailureMode(): 'fail-open' | 'fail-closed' {
  const mode = process.env.POLICY_FAILURE_MODE;
  return mode === 'fail-closed' ? 'fail-closed' : 'fail-open';
}

/**
 * Evaluate an agent action against its policy.
 * Returns skip result if policy is disabled or agent has no policy.
 */
export async function evaluatePolicy(
  agentId: string,
  action: string,
  context: Record<string, unknown>,
): Promise<PolicyEvaluationResult> {
  // Skip if policy feature is disabled
  if (!isPolicyEnabled()) {
    return { allowed: true, policyId: '', evaluationTimeMs: 0 };
  }

  const policyId = (context.policyId as string) || '';
  const policyText = (context.policyText as string) || '';

  // Skip if no policy is set for this agent
  if (!policyId && !policyText) {
    return { allowed: true, policyId: '', evaluationTimeMs: 0 };
  }

  const startTime = Date.now();
  const failureMode = getFailureMode();

  try {
    // Call AgentCore Policy API with timeout
    const result = await Promise.race([
      callEvaluateAgentPolicy(agentId, policyId, action, context),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), POLICY_TIMEOUT_MS),
      ),
    ]);

    const evaluationTimeMs = Date.now() - startTime;

    if (!result.allowed) {
      const userId = (context.userId as string) || 'unknown';
      emitViolationLog(
        {
          agentId,
          policyId,
          violationReason: result.violationReason || 'Policy violation',
          attemptedAction: action,
          userId,
        },
        evaluationTimeMs,
      );
    }

    return { ...result, policyId, evaluationTimeMs };
  } catch (error: any) {
    const evaluationTimeMs = Date.now() - startTime;
    const errorType = error?.message === 'TIMEOUT' ? 'TIMEOUT' : 'SERVER_ERROR';

    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'AgentCorePolicy',
      operation: 'evaluate',
      errorType,
      errorMessage: error?.message || 'Unknown error',
      agentId,
      policyId,
      failureMode,
      actionTaken: failureMode === 'fail-open' ? 'ALLOWED' : 'BLOCKED',
      timestamp: new Date().toISOString(),
    }));

    if (failureMode === 'fail-open') {
      return { allowed: true, policyId, evaluationTimeMs };
    }
    return {
      allowed: false,
      policyId,
      evaluationTimeMs,
      violationReason: 'Policy evaluation failed',
    };
  }
}

/**
 * Call AgentCore Policy API: EvaluateAgentPolicy
 *
 * Uses SigV4-signed HTTP request to the bedrock:EvaluateAgentPolicy endpoint.
 * When dedicated SDK command classes become available in
 * @aws-sdk/client-bedrock-agentcore, this can be replaced with a standard
 * SDK client.send(command) call.
 */
async function callEvaluateAgentPolicy(
  agentId: string,
  policyId: string,
  action: string,
  context: Record<string, unknown>,
): Promise<{ allowed: boolean; violationReason?: string }> {
  const region = process.env.AWS_REGION || 'ap-northeast-1';
  const hostname = `bedrock.${region}.amazonaws.com`;
  const endpoint = `https://${hostname}`;
  const url = `${endpoint}/agent-policy/EvaluateAgentPolicy`;

  try {
    const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
    const { SignatureV4 } = await import('@smithy/signature-v4');
    const { Sha256 } = await import('@aws-crypto/sha256-js');
    const { HttpRequest } = await import('@smithy/protocol-http');

    const credentials = defaultProvider();
    const signer = new SignatureV4({
      service: 'bedrock',
      region,
      credentials,
      sha256: Sha256,
    });

    const body = JSON.stringify({
      agentId,
      policyId,
      action,
      context: {
        policyText: context.policyText || '',
        userId: context.userId || '',
      },
    });

    const httpRequest = new HttpRequest({
      method: 'POST',
      hostname,
      path: '/agent-policy/EvaluateAgentPolicy',
      headers: {
        'Content-Type': 'application/json',
        host: hostname,
      },
      body,
    });

    const signedRequest = await signer.sign(httpRequest);

    const response = await fetch(url, {
      method: 'POST',
      headers: signedRequest.headers as Record<string, string>,
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error: any = new Error(
        `EvaluateAgentPolicy failed: ${response.status} ${response.statusText}`,
      );
      error.statusCode = response.status;
      error.body = errorBody;
      throw error;
    }

    const result = await response.json();
    return {
      allowed: result.allowed ?? true,
      violationReason: result.violationReason,
    };
  } catch (error) {
    console.error('[PolicyEvaluation] EvaluateAgentPolicy call failed:', error);
    throw error;
  }
}
