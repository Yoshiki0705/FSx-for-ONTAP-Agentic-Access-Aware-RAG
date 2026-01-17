'use client';

import { useState, useEffect } from 'react';

interface BedrockConfig {
  region: string;
  agentId?: string;
  agentAliasId?: string;
  sessionId?: string;
}

export function useBedrockConfig() {
  const [config, setConfig] = useState<BedrockConfig>({
    region: 'ap-northeast-1',
    agentId: undefined,
    agentAliasId: undefined,
    sessionId: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConfig = (newConfig: Partial<BedrockConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const resetConfig = () => {
    setConfig({
      region: 'ap-northeast-1',
      agentId: undefined,
      agentAliasId: undefined,
      sessionId: undefined,
    });
    setError(null);
  };

  return {
    config,
    updateConfig,
    resetConfig,
    isLoading,
    error,
    setIsLoading,
    setError,
  };
}
