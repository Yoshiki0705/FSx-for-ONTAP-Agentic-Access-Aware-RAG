'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useRegionStore } from '@/store/useRegionStore';

interface AgentModelSelectorProps {
  agentId: string;
  currentModelId?: string;
  showAdvancedFilters?: boolean;
  showModelList?: boolean;  // 新規追加: モデルリスト表示フラグ
  onModelChange?: (modelId: string) => void;
  locale: string;
}

interface BedrockModel {
  modelId: string;
  modelName: string;
  providerName: string;
  inputModalities?: string[];
  outputModalities?: string[];
  responseStreamingSupported?: boolean;
  customizationsSupported?: string[];
  inferenceTypesSupported?: string[];
  modelLifecycle?: {
    status: string;
  };
}

export function AgentModelSelector({
  agentId,
  currentModelId,
  showAdvancedFilters = false,
  showModelList = false,  // デフォルトはfalse（既存の動作を維持）
  onModelChange,
  locale
}: AgentModelSelectorProps) {
  const t = useCustomTranslations(locale);
  const { selectedRegion } = useRegionStore();
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allModels, setAllModels] = useState<BedrockModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('All Providers');

  // Get region display name based on locale
  const getRegionDisplayName = (region: string) => {
    const regionNames = {
      'ap-northeast-1': 'Tokyo',
      'us-east-1': 'N. Virginia',
      'us-west-2': 'Oregon',
      'eu-west-1': 'Ireland',
      'eu-central-1': 'Frankfurt'
    };
    return regionNames[region as keyof typeof regionNames] || region;
  };

  // モデル一覧を取得（showModelList=trueの場合）
  useEffect(() => {
    const fetchAllModels = async () => {
      if (!showModelList) return;
      
      console.log('🔄 [AgentModelSelector] Fetching models for wizard mode, region:', selectedRegion);
      setIsLoading(true);
      try {
        const response = await fetch(`/api/bedrock/region-info?region=${selectedRegion}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // ✅ Fix: Use correct property names from API response
            const models = data.data.availableModels || [];
            console.log('✅ [AgentModelSelector] Raw models from API:', models.length);
            
            // ✅ Fix: Transform API response to expected format
            const transformedModels = models.map((model: any) => ({
              modelId: model.id || model.modelId,
              modelName: model.name || model.modelName || model.id,
              providerName: model.provider || 'Unknown',
              inputModalities: model.inputModalities || [],
              outputModalities: model.outputModalities || [],
              responseStreamingSupported: model.responseStreamingSupported || false
            }));
            
            setAllModels(transformedModels);
            console.log('✅ [AgentModelSelector] Transformed models:', transformedModels.length, 'models');
          } else {
            console.error('❌ [AgentModelSelector] Invalid API response:', data);
          }
        } else {
          console.error('❌ [AgentModelSelector] API request failed:', response.status);
        }
      } catch (error) {
        console.error('❌ [AgentModelSelector] モデル一覧取得エラー:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllModels();
  }, [showModelList, selectedRegion]);

  // 現在のモデル情報を取得（showModelList=falseの場合）
  useEffect(() => {
    const fetchModelInfo = async () => {
      if (!currentModelId || showModelList) return;
      
      setIsLoading(true);
      try {
        const response = await fetch('/api/bedrock/region-info');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const models = [
              ...(data.data.availableModels || []),
              ...(data.data.unavailableModels || [])
            ];
            const model = models.find(m => m.modelId === currentModelId);
            setModelInfo(model);
          }
        }
      } catch (error) {
        console.error('Failed to fetch model info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModelInfo();
  }, [currentModelId, selectedRegion, showModelList]);

  // プロバイダー一覧を取得
  const providers = useMemo(() => {
    const providerSet = new Set(allModels.map(model => model.providerName));
    return Array.from(providerSet).sort();
  }, [allModels]);

  // Agent対応モデルのフィルタリング
  const isAgentCompatibleModel = (modelId: string): boolean => {
    // Agent対応モデルのパターン
    const agentCompatiblePatterns = [
      /^amazon\.nova-/,                    // Amazon Nova シリーズ
      /^anthropic\.claude-/,               // Claude シリーズ
      /^meta\.llama/,                      // Llama シリーズ
      /^mistral\./,                        // Mistral シリーズ
      /^cohere\.command/,                  // Cohere Command シリーズ
      /^ai21\./,                           // AI21 シリーズ
      /^deepseek\./,                       // DeepSeek シリーズ
      /^qwen\./,                           // Qwen シリーズ
    ];
    
    return agentCompatiblePatterns.some(pattern => pattern.test(modelId));
  };

  // フィルタリング済みモデル
  const filteredModels = useMemo(() => {
    let models = allModels;
    
    // Agent作成時は、Agent対応モデルのみを表示
    if (showModelList) {
      models = models.filter(model => isAgentCompatibleModel(model.modelId));
      console.log('🔍 [AgentModelSelector] Agent compatible models:', models.length, 'out of', allModels.length);
    }
    
    // 検索とプロバイダーフィルター
    models = models.filter(model => {
      const matchesSearch = 
        model.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.modelId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProvider = 
        selectedProvider === 'All Providers' || 
        model.providerName === selectedProvider;
      return matchesSearch && matchesProvider;
    });
    
    // ソート: プロバイダー名 → モデル名
    models.sort((a, b) => {
      const providerCompare = a.providerName.localeCompare(b.providerName);
      if (providerCompare !== 0) return providerCompare;
      return a.modelName.localeCompare(b.modelName);
    });
    
    return models;
  }, [allModels, searchTerm, selectedProvider, showModelList]);

  // モデル選択ハンドラー
  const handleModelSelect = useCallback((modelId: string) => {
    console.log('🔄 [AgentModelSelector] モデル選択:', modelId);
    onModelChange?.(modelId);
  }, [onModelChange]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('model.selector.title')}
        </h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // モデルリスト表示モード（ウィザード用）
  if (showModelList) {
    return (
      <div className="space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('model.foundationModel')} ({filteredModels.length}/{allModels.length} {t('model.modelCount')})
          </span>
        </div>

        {/* フィルター（常に表示） */}
        <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <input
            type="text"
            placeholder={`${t('common.search')}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="All Providers">All Providers</option>
            {providers.map(provider => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
        </div>

        {/* ✅ Fix: Show loading state while fetching models */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Loading models...
            </span>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400">
              No Agent-compatible models found
            </div>
          </div>
        ) : (
          <>
            {/* モデル選択ドロップダウン */}
            <div className="space-y-2">
              <select
                value={currentModelId || ''}
                onChange={(e) => handleModelSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="" disabled>{t('model.selectModel')}</option>
                {filteredModels.map(model => (
                  <option key={model.modelId} value={model.modelId}>
                    {model.providerName || 'Unknown'} - {model.modelName || model.modelId}
                  </option>
                ))}
              </select>
              
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {filteredModels.length} Agent-compatible models available
              </div>
            </div>

            {/* 選択されたモデル情報 */}
            {currentModelId && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-800 dark:text-green-300">
                    {t('model.selectedModel')}: {filteredModels.find(m => m.modelId === currentModelId)?.modelName || currentModelId}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // 情報表示モード（既存の動作）
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {t('model.selector.title')}
      </h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-start">
          <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">
            {t('region.region')}:
          </span>
          <span className="text-gray-900 dark:text-gray-100">
            {getRegionDisplayName(selectedRegion)}
          </span>
        </div>
        
        {modelInfo && (
          <>
            <div className="flex items-start">
              <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">
                {t('model.current')}:
              </span>
              <span className="text-gray-900 dark:text-gray-100">
                {modelInfo.modelName || currentModelId}
              </span>
            </div>
            
            <div className="flex items-start">
              <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">
                {t('model.provider')}:
              </span>
              <span className="text-gray-900 dark:text-gray-100">
                {modelInfo.providerName || 'Amazon'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
