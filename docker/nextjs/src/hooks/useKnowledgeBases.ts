/**
 * Knowledge Base一覧取得・Agent接続KB取得 カスタムフック
 *
 * KB_Selectorコンポーネント等で使用する。
 * - マウント時に `/api/bedrock/knowledge-bases` からKB一覧を取得
 * - `fetchConnectedKBs(agentId)` で Agent に接続済みのKB IDリストを取得
 *
 * @version 1.0.0
 */

import { useCallback, useEffect, useState } from 'react';
import type { KnowledgeBaseSummary } from '@/types/kb-selector';

/**
 * useKnowledgeBases フックの戻り値型
 */
export interface UseKnowledgeBasesReturn {
  knowledgeBases: KnowledgeBaseSummary[];
  connectedKBIds: string[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  fetchConnectedKBs: (agentId: string) => Promise<void>;
}

/**
 * KB一覧取得APIレスポンス型
 */
interface KBListResponse {
  success: boolean;
  knowledgeBases: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
  }>;
  count: number;
  error?: string;
}

/**
 * Agent KB一覧取得APIレスポンス型
 */
interface AgentKBListResponse {
  success: boolean;
  knowledgeBases?: Array<{
    knowledgeBaseId: string;
    knowledgeBaseState?: string;
    description?: string;
  }>;
  error?: string;
}

/**
 * Knowledge Base一覧取得・Agent接続KB取得 カスタムフック
 */
export function useKnowledgeBases(): UseKnowledgeBasesReturn {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const [connectedKBIds, setConnectedKBIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * KB一覧を `/api/bedrock/knowledge-bases` から取得
   */
  const fetchKnowledgeBases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bedrock/knowledge-bases');

      if (!res.ok) {
        throw new Error(`KB一覧取得に失敗しました (HTTP ${res.status})`);
      }

      const data: KBListResponse = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'KB一覧取得に失敗しました');
      }

      const mapped: KnowledgeBaseSummary[] = (data.knowledgeBases || []).map((kb) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        status: (kb.status as KnowledgeBaseSummary['status']) || 'ACTIVE',
        updatedAt: undefined,
        dataSourceCount: 0,
      }));

      setKnowledgeBases(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'KB一覧取得に失敗しました';
      setError(message);
      console.error('❌ [useKnowledgeBases] KB一覧取得エラー:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Agent に接続済みのKB IDリストを取得
   */
  const fetchConnectedKBs = useCallback(async (agentId: string) => {
    try {
      const res = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'listAgentKnowledgeBases',
          agentId,
          agentVersion: 'DRAFT',
        }),
      });

      if (!res.ok) {
        throw new Error(`接続KB取得に失敗しました (HTTP ${res.status})`);
      }

      const data: AgentKBListResponse = await res.json();

      if (!data.success) {
        throw new Error(data.error || '接続KB取得に失敗しました');
      }

      const ids = (data.knowledgeBases || []).map((kb) => kb.knowledgeBaseId);
      setConnectedKBIds(ids);
    } catch (err) {
      const message = err instanceof Error ? err.message : '接続KB取得に失敗しました';
      setError(message);
      setConnectedKBIds([]);
      console.error('❌ [useKnowledgeBases] 接続KB取得エラー:', err);
    }
  }, []);

  /**
   * refetch — KB一覧を再取得
   */
  const refetch = useCallback(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  // マウント時にKB一覧を取得
  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  return {
    knowledgeBases,
    connectedKBIds,
    isLoading,
    error,
    refetch,
    fetchConnectedKBs,
  };
}
