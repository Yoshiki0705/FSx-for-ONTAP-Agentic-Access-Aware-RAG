/**
 * Feature Flags API
 *
 * v4.0.0 フィーチャーフラグをサーバーサイドから提供。
 * NEXT_PUBLIC_* 環境変数はビルド時インライン化に依存するため、
 * Lambda 環境変数から直接読み取りランタイムで提供する。
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    voiceChatEnabled: process.env.VOICE_CHAT_ENABLED === 'true',
    guardrailsEnabled: process.env.GUARDRAILS_ENABLED === 'true',
    agentRegistryEnabled: process.env.ENABLE_AGENT_REGISTRY === 'true',
    agentRegistryRegion: process.env.AGENT_REGISTRY_REGION || 'ap-northeast-1',
    agentPolicyEnabled: process.env.AGENT_POLICY_ENABLED === 'true',
    episodicMemoryEnabled: process.env.EPISODIC_MEMORY_ENABLED === 'true' ||
      (process.env.ENABLE_AGENTCORE_MEMORY === 'true' && process.env.AGENTCORE_MEMORY_ID),
    agentCoreMemoryEnabled: process.env.ENABLE_AGENTCORE_MEMORY === 'true',
    multiAgentEnabled: !!process.env.SUPERVISOR_AGENT_ID,
    // v4.3 features
    feedbackEnabled: process.env.FEEDBACK_FUNCTION_NAME ? true : false,
    provenanceEnabled: process.env.PROVENANCE_FUNCTION_NAME ? true : false,
    policyConsentRequired: process.env.POLICY_CONSENT_REQUIRED === 'true',
    hybridSearchEnabled: (process.env.SEARCH_TYPE || '').toUpperCase() === 'HYBRID',
    // Agent defaults (for auto-selection when no agent explicitly chosen)
    defaultAgentId: process.env.BEDROCK_AGENT_ID || null,
    defaultAgentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID || null,
    supervisorAgentId: process.env.SUPERVISOR_AGENT_ID || null,
  });
}
