/**
 * Agent Category Utilities
 * カテゴリ推定、バリデーション、フィルタリングユーティリティ
 */

import { AGENT_CATEGORY_MAP } from '@/constants/card-constants';
import type { AgentSummary } from '@/hooks/useAgentsList';

/**
 * Agentのnameとdescriptionからカテゴリを推定する
 * AGENT_CATEGORY_MAPのmatchKeywordsに対してcase-insensitiveマッチング
 * 
 * @returns category key or undefined
 */
export function inferCategoryTag(agent: Pick<AgentSummary, 'agentName' | 'description'>): string | undefined {
  const name = agent.agentName.toLowerCase();
  const desc = (agent.description ?? '').toLowerCase();

  for (const [category, config] of Object.entries(AGENT_CATEGORY_MAP)) {
    if (config.matchKeywords.some(kw => name.includes(kw.toLowerCase()) || desc.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return undefined;
}

/**
 * Agent名のバリデーション
 * 空白を除いて3文字以上であること
 */
export function validateAgentName(name: string): boolean {
  return name.trim().length >= 3;
}

/**
 * 検索クエリとカテゴリによるAgent一覧フィルタリング
 * - searchQuery: name/descriptionに対するcase-insensitive部分一致
 * - category: 'all'の場合はカテゴリフィルタなし、それ以外はinferCategoryTagでマッチ
 */
export function filterAgents(
  agents: AgentSummary[],
  searchQuery: string,
  selectedCategory: string
): AgentSummary[] {
  const query = searchQuery.toLowerCase().trim();

  return agents.filter(agent => {
    // テキスト検索フィルタ
    const matchesSearch = query === '' || 
      agent.agentName.toLowerCase().includes(query) ||
      (agent.description ?? '').toLowerCase().includes(query);

    // カテゴリフィルタ
    const matchesCategory = selectedCategory === 'all' ||
      inferCategoryTag(agent) === selectedCategory;

    return matchesSearch && matchesCategory;
  });
}
