'use client';

import { useState, useEffect } from 'react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';

import { 
  RegionConfigManager, 
  SupportedRegion
} from '../../config/region-config-manager';
import { useRegionStore } from '../../store/useRegionStore';
import { useLocale } from '../../hooks/useLocale';

interface AgentRegionInfo {
  region: string;
  regionName: string;
  isCurrentRegion: boolean;
  bedrockSupported: boolean;
  agentSupported: boolean;
  modelCount?: number;
  description?: string;
  warningMessage?: string;
  isPrimary?: boolean;
  isNew?: boolean;
  fallbackRegion?: string;
  status: 'available' | 'unavailable' | 'fallback';
}

interface AgentRegionSelectorProps {
  onRegionChange?: (region: string) => void;
  showRegionInfo?: boolean;
  showUnavailableRegions?: boolean;
  enableTooltips?: boolean;
  mode?: 'agent' | 'kb';
}

export function AgentRegionSelector({ 
  onRegionChange, 
  showRegionInfo = true,
  showUnavailableRegions = true,
  enableTooltips = true
}: AgentRegionSelectorProps) {
  // 翻訳フックと現在のロケールを取得
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  const currentLocale = useLocale();
  
  // Zustand Storeからリージョン情報を取得
  const { selectedRegion: contextRegion, setRegion: setContextRegion } = useRegionStore();
  const [currentRegion, setCurrentRegion] = useState<SupportedRegion>(contextRegion as SupportedRegion || 'ap-northeast-1');
  const [availableRegions, setAvailableRegions] = useState<AgentRegionInfo[]>([]);
  const [unavailableRegions, setUnavailableRegions] = useState<AgentRegionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // Storeのリージョンが変更されたら同期
  useEffect(() => {
    if (contextRegion && contextRegion !== currentRegion) {
      setCurrentRegion(contextRegion as SupportedRegion);
      console.log('✅ [AgentRegionSelector] Storeからリージョンを同期:', contextRegion);
    }
  }, [contextRegion]);

  // Bedrock Agentsリージョンリージョン情報の取得
  useEffect(() => {
    const loadAgentRegionInfo = async () => {
      setIsLoading(true);
      try {
        console.log('[AgentRegionSelector] Bedrock Agentsリージョンリージョン情報を取得中...');
        
        // 1. Bedrock Agentsリージョンリージョン情報を取得
        const agentsResponse = await fetch('/api/bedrock/agents-regions');
        let agentsData: any = null;
        
        if (agentsResponse.ok) {
          const response = await agentsResponse.json();
          if (response.success) {
            agentsData = response.data;
            console.log('[AgentRegionSelector] Bedrock Agents情報を取得:', agentsData);
          }
        }
        
        // 2. 現在のリージョンを決定
        let currentRegionFromStorage: SupportedRegion | null = null;
        if (typeof window !== 'undefined') {
          const savedRegion = localStorage.getItem('selectedRegion');
          if (savedRegion && RegionConfigManager.isRegionSupported(savedRegion)) {
            currentRegionFromStorage = savedRegion as SupportedRegion;
            console.log(`✅ localStorageからリージョンを読み込み: ${savedRegion}`);
          }
        }
        
        const currentRegionFromEnv = currentRegionFromStorage || RegionConfigManager.getDefaultRegion();
        
        // 3. 利用可能・利用不可能リージョンを分離
        const available: AgentRegionInfo[] = [];
        const unavailable: AgentRegionInfo[] = [];
        
        // Bedrock Agentsリージョンリージョンを処理
        if (agentsData?.supportedRegions) {
          agentsData.supportedRegions.forEach((agentRegion: any) => {
            const regionInfo: AgentRegionInfo = {
              region: agentRegion.region,
              regionName: currentLocale === 'en' ? agentRegion.name : agentRegion.nameJa,
              isCurrentRegion: agentRegion.region === currentRegionFromEnv,
              bedrockSupported: true,
              agentSupported: true,
              description: agentRegion.description,
              status: 'available',
              isPrimary: agentRegion.region === 'ap-northeast-1', // Tokyo as primary
              isNew: false
            };
            available.push(regionInfo);
          });
        }
        
        // Bedrock Agents未リージョンリージョンを処理
        if (agentsData?.unsupportedRegions) {
          agentsData.unsupportedRegions.forEach((agentRegion: any) => {
            const regionInfo: AgentRegionInfo = {
              region: agentRegion.region,
              regionName: currentLocale === 'en' ? agentRegion.name : agentRegion.nameJa,
              isCurrentRegion: agentRegion.region === currentRegionFromEnv,
              bedrockSupported: true,
              agentSupported: false,
              description: agentRegion.description,
              fallbackRegion: agentRegion.fallbackRegion,
              status: 'fallback',
              warningMessage: `${t('model.unavailable')} (Bedrock Agents) - ${t('permissions.available')} via ${agentRegion.fallbackRegion}`
            };
            unavailable.push(regionInfo);
          });
        }
        
        // 4. 各リージョンのモデル数を取得
        try {
          const modelCountPromises = available.map(async (regionInfo) => {
            try {
              const response = await fetch(`/api/bedrock/region-info?region=${regionInfo.region}`);
              if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                  return {
                    region: regionInfo.region,
                    modelCount: data.data.availableModelsCount
                  };
                }
              }
            } catch (error) {
              console.warn(`[AgentRegionSelector] ${regionInfo.region}のモデル数取得失敗:`, error);
            }
            return {
              region: regionInfo.region,
              modelCount: 0
            };
          });
          
          const modelCounts = await Promise.all(modelCountPromises);
          
          // モデル数を更新
          setAvailableRegions(available.map(region => {
            const count = modelCounts.find(mc => mc.region === region.region);
            return {
              ...region,
              modelCount: count?.modelCount || 0
            };
          }));
          
          console.log('[Component] Debug:', modelCounts);
        } catch (apiError) {
          console.warn('[AgentRegionSelector] モデル数取得に失敗:', apiError);
          setAvailableRegions(available);
        }
        
        setUnavailableRegions(unavailable);
        setCurrentRegion(currentRegionFromEnv);
        
        // Zustandストアにも反映
        if (currentRegionFromEnv !== contextRegion) {
          setContextRegion(currentRegionFromEnv);
          console.log('✅ [AgentRegionSelector] Zustandストアを更新:', currentRegionFromEnv);
        }
        
        // 親コンポーネントに初期リージョンを通知
        if (onRegionChange) {
          onRegionChange(currentRegionFromEnv);
        }
        
        console.log('[Component] Debug:', {
          currentRegion: currentRegionFromEnv,
          availableCount: available.length,
          unavailableCount: unavailable.length
        });
        
      } catch (error) {
        console.error('[AgentRegionSelector] リージョン情報の読み込みに失敗:', error);
        
        // フォールバック: デフォルトリージョンを使用
        const fallbackRegion = RegionConfigManager.getDefaultRegion();
        setCurrentRegion(fallbackRegion);
        setAvailableRegions([{
          region: fallbackRegion,
          regionName: RegionConfigManager.getRegionDisplayName(fallbackRegion),
          isCurrentRegion: true,
          bedrockSupported: true,
          agentSupported: true,
          modelCount: 0,
          description: 'Default region',
          status: 'available'
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAgentRegionInfo();
  }, []);

  const handleRegionChange = async (newRegion: string) => {
    // 🔒 セキュリティ: 入力サニタイゼーション
    if (!newRegion || typeof newRegion !== 'string') {
      console.error('❌ [AgentRegionSelector] 無効な入力: リージョンが指定されていません');
      alert('⚠️ エラー: 無効なリージョンが指定されました');
      return;
    }

    // 🔒 セキュリティ: 入力値の正規化とバリデーション
    const sanitizedRegion = newRegion.trim().toLowerCase();
    
    // 🔒 セキュリティ: 許可されたリージョンパターンのチェック
    const regionPattern = /^[a-z0-9-]+$/;
    if (!regionPattern.test(sanitizedRegion)) {
      console.error('❌ [AgentRegionSelector] セキュリティ違反: 無効な文字が含まれています:', newRegion);
      alert('⚠️ セキュリティエラー: リージョン名に無効な文字が含まれています');
      return;
    }

    // 🔒 セキュリティ: 最大長チェック
    if (sanitizedRegion.length > 50) {
      console.error('❌ [AgentRegionSelector] セキュリティ違反: リージョン名が長すぎます:', newRegion);
      alert('⚠️ セキュリティエラー: リージョン名が長すぎます');
      return;
    }

    // リージョンの妥当性チェック
    const validation = RegionConfigManager.validateRegion(sanitizedRegion);
    
    if (!validation.isValid) {
      console.error('❌ [AgentRegionSelector] リージョン検証失敗:', sanitizedRegion, validation.error);
      alert(`⚠️ ${validation.error}\n\n${t('region.recommendedRegion')}: ${RegionConfigManager.getRegionDisplayName(validation.region!)}`);
      return;
    }

    // 🔒 セキュリティ: 現在のリージョンと同じ場合は処理をスキップ
    if (sanitizedRegion === currentRegion) {
      console.log('✅ [AgentRegionSelector] 同じリージョンが選択されました:', sanitizedRegion);
      return;
    }
    
    if (onRegionChange) {
      // 🔒 セキュリティ: コールバック関数に正規化されたリージョンを渡す
      onRegionChange(sanitizedRegion);
    } else {
      // デフォルトの動作: APIを呼び出してリージョンを変更
      const allRegions = [...availableRegions, ...unavailableRegions];
      const regionInfo = allRegions.find(r => r.region === sanitizedRegion);
      const regionName = regionInfo?.regionName || sanitizedRegion;
      
      // Agent未リージョンリージョンの場合は警告
      if (regionInfo && !regionInfo.agentSupported) {
        const fallbackName = regionInfo.fallbackRegion ? 
          RegionConfigManager.getRegionDisplayName(regionInfo.fallbackRegion as SupportedRegion) : 'Tokyo Region';
        
        alert(`⚠️ ${t('model.unavailable')} (Bedrock Agents) in current region\n\n${regionName} does not support Bedrock Agents directly.\nProcessing via ${fallbackName} automatically.\n\nContinue?`);
      }
      
      // モデル数の情報を含める
      const modelCount = regionInfo?.modelCount || 0;
      const modelInfo = modelCount > 0 ? `(${t('region.availableModels')}: ${modelCount})` : '';
      
      const message = `${t('region.changeRegionConfirm').replace('{regionName}', regionName).replace('{region}', newRegion)}${modelInfo}\n\n⚠️ ${t('common.note')}: ${t('region.pageWillReload')}\n\n${regionInfo?.description || ''}`;
      
      if (confirm(message)) {
        try {
          setIsLoading(true);
          
          // APIを呼び出してリージョンを変更
          const response = await fetch('/api/bedrock/change-region', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ region: sanitizedRegion }),
          });
          
          const data = await response.json();
          
          if (data.success) {
            // Zustand Storeにリージョンを保存
            try {
              setContextRegion(sanitizedRegion);
              console.log(`✅ [AgentRegionSelector] Storeを更新: ${sanitizedRegion}`);
              
              // カスタムイベントを発火してModelSelectorに通知
              window.dispatchEvent(new CustomEvent('regionChanged', { 
                detail: { region: sanitizedRegion } 
              }));
              console.log(`✅ [AgentRegionSelector] カスタムイベント発火: regionChanged`);
              
            } catch (error) {
              console.error('❌ localStorage保存エラー:', error);
              alert(`❌ ${t('error.generic')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              setIsLoading(false);
              return;
            }
            
            alert(`✅ Region changed to ${regionName}. Reloading page...`);
            
            // 少し待ってからリロード
            setTimeout(() => {
              window.location.reload();
            }, 100);
          } else {
            alert(`❌ Region change failed: ${data.error}`);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('[AgentRegionSelector] リージョン変更エラー:', error);
          alert(`❌ ${t('error.generic')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    }
  };

  const currentRegionInfo = availableRegions.find(r => r.region === currentRegion) || 
                           unavailableRegions.find(r => r.region === currentRegion);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          🤖 Bedrock Region (Agent)
        </label>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {isExpanded ? t('common.close') : 'Change'}
        </button>
      </div>

      {/* 現在のリージョン表示 */}
      <div className={`p-3 rounded-lg border-2 ${
        currentRegionInfo?.agentSupported 
          ? currentRegionInfo?.isPrimary 
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-sm' 
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-sm'
          : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300 shadow-sm'
      }`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className={`text-lg ${
              currentRegionInfo?.agentSupported 
                ? currentRegionInfo?.isPrimary ? '🏆' : '🤖'
                : '⚠️'
            }`}>
            </span>
            <span className={`font-semibold ${
              currentRegionInfo?.agentSupported 
                ? currentRegionInfo?.isPrimary 
                  ? 'text-blue-900' 
                  : 'text-green-900'
                : 'text-yellow-900'
            }`}>
              {currentRegionInfo?.regionName || `${RegionConfigManager.getRegionDisplayName(currentRegion)} (${currentRegion})`}
            </span>
            {currentRegionInfo?.agentSupported && (
              <span className="px-2 py-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-full text-xs font-bold border border-green-200">
                {t('model.available')} (Agent)
              </span>
            )}
            {!currentRegionInfo?.agentSupported && (
              <span className="px-2 py-1 bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 rounded-full text-xs font-bold border border-yellow-200">
                {t('model.unavailable')} (Agent)
              </span>
            )}
          </div>
        </div>
        <div className={`text-xs mt-2 font-medium ${
          currentRegionInfo?.agentSupported 
            ? currentRegionInfo?.isPrimary 
              ? 'text-blue-800 dark:text-blue-200' 
              : 'text-green-800 dark:text-green-200'
            : 'text-yellow-800 dark:text-yellow-200'
        }`}>
          {currentRegionInfo?.agentSupported 
            ? currentRegionInfo?.isPrimary 
              ? `🏆 ${t('region.primaryRegionRecommended')}` 
              : `🤖 ${t('model.available')} (Bedrock Agents)`
            : `⚠️ ${t('model.unavailable')} (Agent) - ${currentRegionInfo?.fallbackRegion ? RegionConfigManager.getRegionDisplayName(currentRegionInfo.fallbackRegion as SupportedRegion) : 'Tokyo'} ${t('model.available')}`
          }
        </div>
      </div>

      {/* リージョン選択 */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="space-y-3">
            {/* 利用可能なリージョン */}
            <div>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center space-x-2">
                <span>🤖 {t('region.supportedRegions')}</span>
                <span className="text-gray-500 dark:text-gray-400">({availableRegions.length})</span>
              </div>
              
              {isLoading ? (
                <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span>{t('common.loading')}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {availableRegions.map((region) => (
                    <div
                      key={region.region}
                      className="relative"
                      onMouseEnter={() => enableTooltips && setHoveredRegion(region.region)}
                      onMouseLeave={() => enableTooltips && setHoveredRegion(null)}
                    >
                      <button
                        onClick={() => handleRegionChange(region.region)}
                        disabled={region.isCurrentRegion}
                        className={`w-full text-left p-3 rounded-lg text-xs transition-all duration-200 transform hover:scale-[1.02] ${
                          region.isCurrentRegion
                            ? region.isPrimary
                              ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 border-2 border-blue-400 cursor-default shadow-md'
                              : 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-900 border-2 border-green-400 cursor-default shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:border-green-400 cursor-pointer shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">
                              {region.isCurrentRegion 
                                ? (region.isPrimary ? '🏆' : '🤖')
                                : (region.isPrimary ? '🏆' : '🤖')
                              }
                            </span>
                            <div className="flex flex-col">
                              <span className="font-semibold">{region.regionName}</span>
                              <span className="text-xs text-gray-500 font-mono">({region.region})</span>
                            </div>
                            <span className="px-2 py-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-full text-xs font-bold border border-green-200">
                              {t('model.available')} (Agent)
                            </span>
                            {region.isPrimary && !region.isCurrentRegion && (
                              <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 rounded-full text-xs font-bold border border-blue-200">
                                {t('region.recommended')}
                              </span>
                            )}
                          </div>
                          {region.modelCount !== undefined && (
                            <div className="text-xs text-gray-600">
                              {region.modelCount} models
                            </div>
                          )}
                        </div>
                        {region.isCurrentRegion && (
                          <div className={`text-xs mt-2 font-medium ${
                            region.isPrimary 
                              ? 'text-blue-700 dark:text-blue-300' 
                              : 'text-green-700 dark:text-green-300'
                          }`}>
                            {region.isPrimary && `🏆 ${t('region.primaryRegionInUse')}`}
                            {!region.isPrimary && `🤖 ${t('region.currentlyInUse')}`}
                          </div>
                        )}
                      </button>
                      
                      {/* ツールチップ */}
                      {enableTooltips && hoveredRegion === region.region && (
                        <div className="absolute z-10 left-0 top-full mt-1 p-3 bg-gray-800 text-white text-xs rounded shadow-lg max-w-sm border border-gray-600">
                          <div className="font-medium text-white mb-2">{region.regionName}</div>
                          <div className="text-gray-200 mb-2">{region.description}</div>
                          
                          <div className="mb-2">
                            <span className="text-green-300">🤖 {t('model.available')} (Bedrock Agents)</span>
                          </div>
                          
                          {region.modelCount !== undefined && (
                            <div className="mb-2">
                              <span className="text-green-300">✅ {t('region.availableModels')}: {region.modelCount}</span>
                            </div>
                          )}
                          
                          {region.isPrimary && (
                            <div className="mb-1">
                              <span className="text-blue-300">🏆 {t('region.primaryRegion')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 利用不可能なリージョン */}
            {showUnavailableRegions && unavailableRegions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2 flex items-center space-x-2">
                  <span>❌ {t('region.unsupportedRegions')}</span>
                  <span className="text-gray-400">({unavailableRegions.length})</span>
                </div>
                <div className="space-y-1">
                  {unavailableRegions.map((region) => (
                    <div
                      key={region.region}
                      className="relative"
                      onMouseEnter={() => enableTooltips && setHoveredRegion(region.region)}
                      onMouseLeave={() => enableTooltips && setHoveredRegion(null)}
                    >
                      <button
                        onClick={() => handleRegionChange(region.region)}
                        className="w-full text-left p-3 rounded-lg text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border border-gray-300 cursor-pointer opacity-70 hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">⚠️</span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-700">{region.regionName}</span>
                              <span className="text-xs text-gray-400 font-mono">({region.region})</span>
                            </div>
                            <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-bold border border-yellow-300">
                              {t('model.unavailable')} (Agent)
                            </span>
                            {region.fallbackRegion && (
                              <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-bold border border-blue-300">
                                {RegionConfigManager.getRegionDisplayName(region.fallbackRegion as SupportedRegion)} via
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-gray-500 text-xs mt-2 font-medium">
                          ⚠️ {region.warningMessage || `${t('model.unavailable')} (Bedrock Agents) - ${t('permissions.available')}`}
                        </div>
                      </button>
                      
                      {/* ツールチップ */}
                      {enableTooltips && hoveredRegion === region.region && (
                        <div className="absolute z-10 left-0 top-full mt-1 p-3 bg-gray-800 text-white text-xs rounded shadow-lg max-w-sm border border-gray-600">
                          <div className="font-medium text-white mb-2">{region.regionName}</div>
                          <div className="text-gray-200 mb-2">{region.description}</div>
                          
                          <div className="mb-2">
                            <span className="text-yellow-300">⚠️ {t('model.unavailable')} (Bedrock Agents)</span>
                          </div>
                          
                          {region.fallbackRegion && (
                            <div className="text-blue-300 mb-2">
                              🔄 {t('permissions.available')} via {RegionConfigManager.getRegionDisplayName(region.fallbackRegion as SupportedRegion)}
                            </div>
                          )}
                          
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <div className="text-gray-300 text-xs">
                              <div>Auto fallback enables all Agent features</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 注意事項 */}
            <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
              <div className="text-blue-800 text-xs">
                <div className="font-medium">🤖 Notes (Bedrock Agents)</div>
                <div className="mt-1 space-y-1">
                  <div>• {t('model.available')} regions: Direct access</div>
                  <div>• {t('model.unavailable')} regions: Auto fallback</div>
                  <div>• Fallback latency: +10-20ms</div>
                  <div>• All features {t('permissions.available')}</div>
                </div>
              </div>
            </div>

            {/* 統計情報 */}
            {showRegionInfo && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <div className="text-gray-800 text-xs">
                  <div className="font-medium">📊 Region Statistics</div>
                  <div className="mt-1 space-y-1">
                    <div>• Agent {t('model.available')}: {availableRegions.length} regions</div>
                    <div>• Agent {t('model.unavailable')}: {unavailableRegions.length} regions</div>
                    <div>• {t('region.currentModels')}: {currentRegionInfo?.modelCount || 0}</div>
                    {currentRegionInfo?.isPrimary && (
                      <div>• {t('region.primaryRegionInUseShort')}</div>
                    )}
                    {!currentRegionInfo?.agentSupported && (
                      <div>• Fallback function in use</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}