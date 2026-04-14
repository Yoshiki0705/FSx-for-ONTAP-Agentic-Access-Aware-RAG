/**
 * AgentCore Policy CRUD API (GA版 — Policy Engine + Gateway モデル)
 *
 * POST   /api/bedrock/agent-policy — Create policy (in policy engine)
 * GET    /api/bedrock/agent-policy?policyEngineId=xxx — List policies
 * PUT    /api/bedrock/agent-policy — Update policy
 * DELETE /api/bedrock/agent-policy?policyId=xxx&policyEngineId=xxx — Delete policy
 *
 * GA版ではポリシーは Policy Engine に格納され、Gateway にアタッチされる。
 * ポリシーは Cedar 言語で記述し、自然言語からの変換もサポート。
 *
 * Requirements: 7.1, 7.4, 3.4, 10.4
 */

import { NextRequest, NextResponse } from 'next/server';

const MAX_POLICY_TEXT_LENGTH = 10_000; // Cedar policies can be longer
const POLICY_API_TIMEOUT_MS = 10_000;

function isPolicyEnabled(): boolean {
  return process.env.AGENT_POLICY_ENABLED === 'true';
}

function getRegion(): string {
  return process.env.AWS_REGION || 'ap-northeast-1';
}

/**
 * Execute a SigV4-signed HTTP request to the AgentCore Policy API (GA).
 *
 * GA版では bedrock-agentcore サービスのコントロールプレーンを使用。
 */
async function callPolicyAPI<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const region = getRegion();
  const hostname = `bedrock-agentcore.${region}.amazonaws.com`;
  const endpoint = `https://${hostname}`;
  const url = `${endpoint}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), POLICY_API_TIMEOUT_MS);

  try {
    const { defaultProvider } = await import('@aws-sdk/credential-provider-node');
    const { SignatureV4 } = await import('@smithy/signature-v4');
    const { Sha256 } = await import('@aws-crypto/sha256-js');
    const { HttpRequest } = await import('@smithy/protocol-http');

    const credentials = defaultProvider();
    const signer = new SignatureV4({
      service: 'bedrock-agentcore',
      region,
      credentials,
      sha256: Sha256,
    });

    const bodyStr = body ? JSON.stringify(body) : undefined;

    const httpRequest = new HttpRequest({
      method,
      hostname,
      path,
      headers: {
        'Content-Type': 'application/json',
        host: hostname,
      },
      ...(bodyStr && { body: bodyStr }),
    });

    const signedRequest = await signer.sign(httpRequest);

    const response = await fetch(url, {
      method,
      headers: signedRequest.headers as Record<string, string>,
      ...(bodyStr && { body: bodyStr }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error: any = new Error(
        `AgentCore Policy API failed: ${response.status} ${response.statusText}`,
      );
      error.statusCode = response.status;
      error.body = errorBody;
      throw error;
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      const timeoutError: any = new Error(
        `AgentCore Policy API timed out after ${POLICY_API_TIMEOUT_MS}ms`,
      );
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST — Create a policy in a policy engine.
 * Body: { policyEngineId, policyText, description? }
 */
export async function POST(request: NextRequest) {
  if (!isPolicyEnabled()) {
    return NextResponse.json({ error: 'AgentCore Policy is not enabled' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { policyEngineId, policyText, description } = body;

    if (!policyEngineId || !policyText) {
      return NextResponse.json(
        { error: 'policyEngineId and policyText are required' },
        { status: 400 },
      );
    }

    if (policyText.length > MAX_POLICY_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `policyText must be ${MAX_POLICY_TEXT_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    const result = await callPolicyAPI<{
      policyId: string;
      policyEngineId: string;
    }>('POST', `/policy-engines/${encodeURIComponent(policyEngineId)}/policies`, {
      policyDocument: policyText,
      ...(description && { description }),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Policy create error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create policy' },
      { status: error?.statusCode || 500 },
    );
  }
}

/**
 * GET — List policies in a policy engine, or get a specific policy.
 * Query: ?policyEngineId=xxx or ?policyEngineId=xxx&policyId=yyy
 */
export async function GET(request: NextRequest) {
  if (!isPolicyEnabled()) {
    return NextResponse.json({ error: 'AgentCore Policy is not enabled' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const policyEngineId = searchParams.get('policyEngineId');
    const policyId = searchParams.get('policyId');

    if (!policyEngineId) {
      return NextResponse.json(
        { error: 'policyEngineId query parameter is required' },
        { status: 400 },
      );
    }

    if (policyId) {
      // Get specific policy
      const result = await callPolicyAPI<Record<string, unknown>>(
        'GET',
        `/policy-engines/${encodeURIComponent(policyEngineId)}/policies/${encodeURIComponent(policyId)}`,
      );
      return NextResponse.json(result);
    } else {
      // List policies
      const result = await callPolicyAPI<{ policies: unknown[] }>(
        'GET',
        `/policy-engines/${encodeURIComponent(policyEngineId)}/policies`,
      );
      return NextResponse.json(result);
    }
  } catch (error: any) {
    console.error('Policy get error:', error);
    if (error?.statusCode === 404) {
      return NextResponse.json({ policies: [] });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to get policy' },
      { status: error?.statusCode || 500 },
    );
  }
}

/**
 * PUT — Update a policy.
 * Body: { policyEngineId, policyId, policyText, description? }
 */
export async function PUT(request: NextRequest) {
  if (!isPolicyEnabled()) {
    return NextResponse.json({ error: 'AgentCore Policy is not enabled' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { policyEngineId, policyId, policyText, description } = body;

    if (!policyEngineId || !policyId || !policyText) {
      return NextResponse.json(
        { error: 'policyEngineId, policyId, and policyText are required' },
        { status: 400 },
      );
    }

    if (policyText.length > MAX_POLICY_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `policyText must be ${MAX_POLICY_TEXT_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    const result = await callPolicyAPI<Record<string, unknown>>(
      'PUT',
      `/policy-engines/${encodeURIComponent(policyEngineId)}/policies/${encodeURIComponent(policyId)}`,
      {
        policyDocument: policyText,
        ...(description && { description }),
      },
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Policy update error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update policy' },
      { status: error?.statusCode || 500 },
    );
  }
}

/**
 * DELETE — Delete a policy.
 * Query: ?policyEngineId=xxx&policyId=yyy
 */
export async function DELETE(request: NextRequest) {
  if (!isPolicyEnabled()) {
    return NextResponse.json({ error: 'AgentCore Policy is not enabled' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const policyEngineId = searchParams.get('policyEngineId');
    const policyId = searchParams.get('policyId');

    if (!policyEngineId || !policyId) {
      return NextResponse.json(
        { error: 'policyEngineId and policyId query parameters are required' },
        { status: 400 },
      );
    }

    await callPolicyAPI<Record<string, unknown>>(
      'DELETE',
      `/policy-engines/${encodeURIComponent(policyEngineId)}/policies/${encodeURIComponent(policyId)}`,
    );

    return NextResponse.json({ success: true, policyId });
  } catch (error: any) {
    console.error('Policy delete error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete policy' },
      { status: error?.statusCode || 500 },
    );
  }
}
