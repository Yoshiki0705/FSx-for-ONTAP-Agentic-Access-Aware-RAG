/**
 * Bedrock プロバイダーカテゴリ定義
 * 
 * 13のプロバイダーに対応したカテゴリ情報を提供
 * - 表示名
 * - カラーテーマ（Tailwind CSS）
 * - 優先順位
 */

export interface ProviderCategoryInfo {
  name: string;
  color: string;
  priority?: number;
}

/**
 * プロバイダーカテゴリ設定
 * 
 * Requirements: 1.1, 1.2 (モデル選択UI)
 */
export const PROVIDER_CATEGORIES: Record<string, ProviderCategoryInfo> = {
  // 主要プロバイダー（優先表示）
  'Amazon': { 
    name: 'Amazon', 
    color: 'bg-orange-50 border-orange-200 text-orange-800',
    priority: 1
  },
  'Anthropic': { 
    name: 'Anthropic', 
    color: 'bg-purple-50 border-purple-200 text-purple-800',
    priority: 2
  },
  'Meta': { 
    name: 'Meta', 
    color: 'bg-blue-50 border-blue-200 text-blue-800',
    priority: 3
  },
  'Cohere': { 
    name: 'Cohere', 
    color: 'bg-green-50 border-green-200 text-green-800',
    priority: 4
  },

  // その他のプロバイダー（アルファベット順）
  'AI21 Labs': { 
    name: 'AI21 Labs', 
    color: 'bg-indigo-50 border-indigo-200 text-indigo-800' 
  },
  'AI21': { 
    name: 'AI21', 
    color: 'bg-indigo-50 border-indigo-200 text-indigo-800' 
  },
  'Baichuan': { 
    name: 'Baichuan', 
    color: 'bg-amber-50 border-amber-200 text-amber-800' 
  },
  'Lightricks': { 
    name: 'Lightricks', 
    color: 'bg-teal-50 border-teal-200 text-teal-800' 
  },
  'Mistral AI': { 
    name: 'Mistral AI', 
    color: 'bg-yellow-50 border-yellow-200 text-yellow-800' 
  },
  'Moonshot AI': { 
    name: 'Moonshot AI', 
    color: 'bg-sky-50 border-sky-200 text-sky-800' 
  },
  'Reka AI': { 
    name: 'Reka AI', 
    color: 'bg-violet-50 border-violet-200 text-violet-800' 
  },
  'Stability AI': { 
    name: 'Stability AI', 
    color: 'bg-pink-50 border-pink-200 text-pink-800' 
  },
  'TwelveLabs': { 
    name: 'TwelveLabs', 
    color: 'bg-cyan-50 border-cyan-200 text-cyan-800' 
  },
  'Zhipu AI': { 
    name: 'Zhipu AI', 
    color: 'bg-rose-50 border-rose-200 text-rose-800' 
  }
} as const;

/**
 * プロバイダー優先順位を取得
 * 
 * @param providers プロバイダー名の配列
 * @returns 優先順位でソートされたプロバイダー配列
 */
export function getSortedProviders(providers: string[]): string[] {
  const priorityOrder = ['Amazon', 'Anthropic', 'Meta', 'Cohere'];
  
  return providers.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a);
    const bIndex = priorityOrder.indexOf(b);
    
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    } else if (aIndex !== -1) {
      return -1;
    } else if (bIndex !== -1) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  });
}

/**
 * プロバイダー情報を取得（フォールバック付き）
 * 
 * @param provider プロバイダー名
 * @returns プロバイダー情報
 */
export function getProviderInfo(provider: string): ProviderCategoryInfo {
  return PROVIDER_CATEGORIES[provider] || {
    name: provider,
    color: 'bg-gray-50 border-gray-200 text-gray-800'
  };
}