/**
 * Card Agent Binding Service
 *
 * ワークフローカードとBedrock Agentの紐付けを管理するサービス。
 * 静的agentId → キャッシュ → Agent検索 → 動的作成の4段階フローで
 * カードに最適なAgentを解決する。
 *
 * Requirements: 1.1-1.5, 2.1-2.6, 4.4, 10.1-10.3
 */

import type { CardData } from '@/constants/card-constants';
import { AGENT_CATEGORY_MAP } from '@/constants/card-constants';
import type { CardAgentMappingStore } from '@/store/useCardAgentMappingStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolveAgentResult {
  agentId: string;
  agentAliasId?: string;
  source: 'static' | 'cache' | 'resolved' | 'created';
}

export interface AgentCreationProgress {
  step: 'creating' | 'preparing' | 'creating-alias' | 'completed' | 'error';
  message: string;
}

/** Shape returned by GET /api/bedrock/agents/list */
interface AgentListResponse {
  success: boolean;
  agents: AgentSummary[];
  count: number;
  region: string;
}

export interface AgentSummary {
  agentId: string;
  agentName: string;
  status: string;
  description?: string;
  updatedAt?: string;
  latestAgentVersion?: string;
}

/** Shape returned by POST /api/bedrock/agent (action: 'create') */
interface CreateAgentResponse {
  success: boolean;
  agent: {
    agentId: string;
    agentName: string;
    agentAliasId?: string;
    status: string;
    createdAt?: string;
  };
  message: string;
}

// ---------------------------------------------------------------------------
// Internal helpers – API calls
// ---------------------------------------------------------------------------

/**
 * Fetch the list of Bedrock Agents from the backend API.
 */
export async function fetchAgentList(): Promise<AgentSummary[]> {
  const res = await fetch('/api/bedrock/agents/list?region=ap-northeast-1');
  if (!res.ok) {
    throw new Error(`Agent一覧取得に失敗しました (HTTP ${res.status})`);
  }
  const data: AgentListResponse = await res.json();
  if (!data.success) {
    throw new Error('Agent一覧取得に失敗しました');
  }
  return data.agents ?? [];
}

/**
 * Create a new Bedrock Agent via the backend API.
 */
async function createAgentViaApi(params: {
  agentName: string;
  instruction: string;
  foundationModel: string;
  description: string;
}): Promise<CreateAgentResponse> {
  const res = await fetch('/api/bedrock/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      agentName: params.agentName,
      instruction: params.instruction,
      foundationModel: params.foundationModel,
      description: params.description,
      attachActionGroup: true,
    }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      (errorBody as any)?.error ?? `Agent作成に失敗しました (HTTP ${res.status})`
    );
  }
  const data: CreateAgentResponse = await res.json();
  if (!data.success) {
    throw new Error(data.message ?? 'Agent作成に失敗しました');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point – resolve the best Agent for a given card.
 *
 * Resolution order:
 * 1. Static agentId on the card → return immediately (source: 'static')
 * 2. Cached mapping in the store → verify agent still exists (source: 'cache')
 * 3. Search existing agents by category keywords (source: 'resolved')
 * 4. Dynamically create a new agent (source: 'created')
 */
export async function resolveAgentForCard(
  card: CardData,
  mappingStore: Pick<CardAgentMappingStore, 'getMapping' | 'setMapping' | 'removeMapping'>,
  onProgress?: (progress: AgentCreationProgress) => void,
): Promise<ResolveAgentResult> {
  // --- Step 1: Static agentId ---
  if (card.agentId) {
    return { agentId: card.agentId, source: 'static' };
  }

  const categoryConfig = AGENT_CATEGORY_MAP[card.category];

  // --- Step 2: Cache check ---
  const cached = mappingStore.getMapping(card.id);
  if (cached) {
    try {
      const agents = await fetchAgentList();
      const stillExists = agents.some((a) => a.agentId === cached.agentId);
      if (stillExists) {
        return {
          agentId: cached.agentId,
          agentAliasId: cached.agentAliasId,
          source: 'cache',
        };
      }
      // Agent was deleted – invalidate cache and fall through
      mappingStore.removeMapping(card.id);
    } catch {
      // Network error during verification – trust the cache for now
      return {
        agentId: cached.agentId,
        agentAliasId: cached.agentAliasId,
        source: 'cache',
      };
    }
  }

  // If no category config exists, we cannot search or create
  if (!categoryConfig) {
    throw new Error(`カテゴリ "${card.category}" の設定が見つかりません`);
  }

  // --- Step 3: Search by category ---
  const found = await findAgentByCategory(card.category, categoryConfig);
  if (found) {
    mappingStore.setMapping(card.id, {
      agentId: found.agentId,
      agentAliasId: found.agentAliasId,
      resolvedAt: Date.now(),
    });
    return { agentId: found.agentId, agentAliasId: found.agentAliasId, source: 'resolved' };
  }

  // --- Step 4: Dynamic creation ---
  const created = await createAgentForCategory(card.category, categoryConfig, onProgress);
  mappingStore.setMapping(card.id, {
    agentId: created.agentId,
    agentAliasId: created.agentAliasId,
    resolvedAt: Date.now(),
  });
  return { agentId: created.agentId, agentAliasId: created.agentAliasId, source: 'created' };
}

/**
 * Search existing agents for one that matches the given category config.
 *
 * Matching logic: at least one keyword from `categoryConfig.matchKeywords`
 * must appear (case-insensitive) in the agent's name OR description.
 */
export async function findAgentByCategory(
  _category: string,
  categoryConfig: { matchKeywords: string[] },
): Promise<{ agentId: string; agentAliasId?: string } | null> {
  const agents = await fetchAgentList();
  const keywords = categoryConfig.matchKeywords.map((k) => k.toLowerCase());

  for (const agent of agents) {
    const name = (agent.agentName ?? '').toLowerCase();
    const desc = (agent.description ?? '').toLowerCase();
    const matched = keywords.some((kw) => name.includes(kw) || desc.includes(kw));
    if (matched) {
      return { agentId: agent.agentId };
    }
  }
  return null;
}

/**
 * Create a new Bedrock Agent using the category configuration.
 * Reports progress via the optional `onProgress` callback.
 */
export async function createAgentForCategory(
  _category: string,
  categoryConfig: {
    agentNamePattern: string;
    instruction: string;
    foundationModel: string;
    description: string;
  },
  onProgress?: (progress: AgentCreationProgress) => void,
): Promise<{ agentId: string; agentAliasId?: string }> {
  try {
    // Step: creating
    onProgress?.({ step: 'creating', message: 'Agent作成中...' });

    const result = await createAgentViaApi({
      agentName: categoryConfig.agentNamePattern,
      instruction: categoryConfig.instruction,
      foundationModel: categoryConfig.foundationModel,
      description: categoryConfig.description,
    });

    // The backend already handles PrepareAgent + CreateAgentAlias,
    // so we just report the intermediate steps for UX.
    onProgress?.({ step: 'preparing', message: 'Agent準備中...' });
    onProgress?.({ step: 'creating-alias', message: 'Alias作成中...' });
    onProgress?.({ step: 'completed', message: 'Agent作成完了' });

    return {
      agentId: result.agent.agentId,
      agentAliasId: result.agent.agentAliasId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent作成に失敗しました';
    onProgress?.({ step: 'error', message });
    throw error;
  }
}
