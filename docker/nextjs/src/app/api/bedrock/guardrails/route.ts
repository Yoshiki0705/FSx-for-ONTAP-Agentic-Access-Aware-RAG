/**
 * Guardrails Status API
 *
 * GET /api/bedrock/guardrails/status
 * Returns standalone and organizational guardrails information.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockClient,
  ListGuardrailsCommand,
  GetGuardrailCommand,
} from '@aws-sdk/client-bedrock';

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const GUARDRAILS_ENABLED = process.env.GUARDRAILS_ENABLED === 'true';
const GUARDRAIL_ID = process.env.GUARDRAIL_ID || '';

export const dynamic = 'force-dynamic';

interface GuardrailInfo {
  guardrailId: string;
  guardrailArn: string;
  name: string;
  status: string;
  version: string;
  isOrganizational: boolean;
}

export async function GET(_request: NextRequest) {
  if (!GUARDRAILS_ENABLED) {
    return NextResponse.json({
      enabled: false,
      standaloneGuardrails: [],
      organizationalSafeguards: [],
    });
  }

  const client = new BedrockClient({ region: REGION });

  try {
    const listResult = await client.send(new ListGuardrailsCommand({}));
    const guardrails = listResult.guardrails || [];

    const standaloneGuardrails: GuardrailInfo[] = [];
    const organizationalSafeguards: GuardrailInfo[] = [];

    for (const gr of guardrails) {
      const info: GuardrailInfo = {
        guardrailId: gr.id || '',
        guardrailArn: gr.arn || '',
        name: gr.name || '',
        status: gr.status || 'UNKNOWN',
        version: gr.version || 'DRAFT',
        isOrganizational: (gr.arn || '').includes(':organizational-guardrail/'),
      };

      if (info.isOrganizational) {
        organizationalSafeguards.push(info);
      } else {
        standaloneGuardrails.push(info);
      }
    }

    // Get details for the current guardrail
    let currentGuardrailDetails: any = null;
    if (GUARDRAIL_ID) {
      try {
        const detail = await client.send(new GetGuardrailCommand({
          guardrailIdentifier: GUARDRAIL_ID,
        }));
        currentGuardrailDetails = {
          guardrailId: detail.guardrailId,
          name: detail.name,
          status: detail.status,
          contentPolicy: detail.contentPolicy,
          sensitiveInformationPolicy: detail.sensitiveInformationPolicy,
          topicPolicy: detail.topicPolicy,
          contextualGroundingPolicy: detail.contextualGroundingPolicy,
        };
      } catch (detailError) {
        console.error('[Guardrails] Failed to get guardrail details:', detailError);
      }
    }

    return NextResponse.json({
      enabled: true,
      guardrailId: GUARDRAIL_ID,
      standaloneGuardrails,
      organizationalSafeguards,
      currentGuardrailDetails,
      orgStatus: organizationalSafeguards.length > 0 ? 'enabled' : 'not_configured',
    });
  } catch (error) {
    console.error('[Guardrails] Status API error:', error);
    return NextResponse.json({
      enabled: true,
      guardrailId: GUARDRAIL_ID,
      standaloneGuardrails: [],
      organizationalSafeguards: [],
      orgStatus: 'unavailable',
      error: 'Failed to retrieve guardrails information',
    });
  }
}
