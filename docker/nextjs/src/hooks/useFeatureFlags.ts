/**
 * Feature Flags Hook
 *
 * サーバーサイド API (/api/config/features) からフィーチャーフラグを取得。
 * NEXT_PUBLIC_* のビルド時インライン化に依存せず、Lambda 環境変数から
 * ランタイムでフラグを取得する。
 */
import { useState, useEffect } from 'react';

export interface FeatureFlags {
  voiceChatEnabled: boolean;
  guardrailsEnabled: boolean;
  agentRegistryEnabled: boolean;
  agentRegistryRegion: string;
  agentPolicyEnabled: boolean;
  episodicMemoryEnabled: boolean;
  agentCoreMemoryEnabled: boolean;
  multiAgentEnabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  voiceChatEnabled: false,
  guardrailsEnabled: false,
  agentRegistryEnabled: false,
  agentRegistryRegion: 'ap-northeast-1',
  agentPolicyEnabled: false,
  episodicMemoryEnabled: false,
  agentCoreMemoryEnabled: false,
  multiAgentEnabled: false,
};

let cachedFlags: FeatureFlags | null = null;

export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    // localStorageからキャッシュを復元（ページリロード時の初回レンダリングで即座にフラグを取得）
    if (cachedFlags) return cachedFlags;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('featureFlags');
        if (stored) {
          const parsed = JSON.parse(stored);
          cachedFlags = parsed;
          return parsed;
        }
      } catch {}
    }
    return DEFAULT_FLAGS;
  });

  useEffect(() => {
    fetch('/api/config/features')
      .then((r) => r.json())
      .then((data) => {
        cachedFlags = data;
        setFlags(data);
        try {
          localStorage.setItem('featureFlags', JSON.stringify(data));
        } catch {}
      })
      .catch(() => {});
  }, []);

  return flags;
}
