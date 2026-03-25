'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { 
  RegionConfigManager, 
  SupportedRegion, 
  RegionSelectOption 
} from '../../config/region-config-manager';

interface RegionInfo {
  region: string;
  regionName: string;
  isCurrentRegion: boolean;
  supported?: boolean;
  modelCount?: number;
  description?: string;
  warningMessage?: string;
  isPrimary?: boolean;
  isNew?: boolean;
}

interface RegionSelectorProps {
  onRegionChange?: (region: string) => void;
  showRegionInfo?: boolean;
  showUnsupportedRegions?: boolean;
  enableTooltips?: boolean;
}

export function RegionSelector({ 
  onRegionChange, 
  showRegionInfo = true,
  showUnsupportedRegions = true,
  enableTooltips = true
}: RegionSelectorProps) {
  const t = useTranslations('region');
  const locale = useLocale(); // 現在のロケールを取得
  const [currentRegion, setCurrentRegion] = useState<SupportedRegion>('ap-northeast-1');
  const [supportedRegions, setSupportedRegions] = useState<RegionInfo[]>([]);
  const [unsupportedRegions, setUnsupportedRegions] = useState<RegionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 初期状態をtrueに変更
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // リージョン情報の取得（新しいRegionConfigManagerを使用）
  // localeが変更されたときも再実行
  useEffect(() => {
    const loadRegionInfo = async () => {
      setIsLoading(true);
      try {
        // 新しいRegionConfigManagerからリージョン情報を取得
        const regionOptions = RegionConfigManager.getRegionSelectOptions();
        
        // Cookieから現在のリージョンを取得
        let currentRegionFromCookie = 'ap-northeast-1';
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split(';');
          const regionCookie = cookies.find(c => c.trim().startsWith('bedrock_region='));
          if (regionCookie) {
            currentRegionFromCookie = regionCookie.split('=')[1].trim();
          }
        }
        
        const currentRegionFromEnv = currentRegionFromCookie || RegionConfigManager.getDefaultRegion();
        
        // サポート対象リージョンとサポート外リージョンを分離
        const supported: RegionInfo[] = [];
        const unsupported: RegionInfo[] = [];
        
        regionOptions.forEach(option => {
          // 現在のロケールに基づいてリージョン名を取得
          const regionName = RegionConfigManager.getRegionDisplayName(option.value, locale);
          
          const regionInfo: RegionInfo = {
            region: option.value,
            regionName: regionName,
            isCurrentRegion: option.value === currentRegionFromEnv,
            supported: option.supported,
            modelCount: option.modelCount,
            description: option.description,
            warningMessage: option.warningMessage,
            isPrimary: option.isPrimary,
            isNew: option.isNew
          };
          
          if (option.supported) {
            supported.push(regionInfo);
          } else {
            unsupported.push(regionInfo);
          }
        });
        
        setCurrentRegion(currentRegionFromEnv);
        setSupportedRegions(supported);
        setUnsupportedRegions(unsupported);
        
        console.log('[RegionSelector] リージョン情報を読み込みました:', {
          currentRegion: currentRegionFromEnv,
          supportedCount: supported.length,
          unsupportedCount: unsupported.length,
          locale: locale
        });
        
        // 既存APIからの情報も取得（動的モデル数を反映）
        try {
          const response = await fetch('/api/bedrock/region-info');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // APIから取得した現在のリージョンで更新
              const apiCurrentRegion = data.data.currentRegion;
              if (RegionConfigManager.isRegionSupported(apiCurrentRegion)) {
                setCurrentRegion(apiCurrentRegion as SupportedRegion);
              }
              
              // APIから取得した動的モデル数でサポート対象リージョンを更新
              if (data.data.supportedRegions && Array.isArray(data.data.supportedRegions)) {
                setSupportedRegions(prev => prev.map(region => {
                  const apiRegion = data.data.supportedRegions.find((r: any) => r.region === region.region);
                  // APIのモデル数が0の場合は、RegionConfigManagerで計算した値を使用
                  const apiModelCount = apiRegion?.modelCount;
                  const finalModelCount = (apiModelCount && apiModelCount > 0) ? apiModelCount : region.modelCount;
                  
                  return {
                    ...region,
                    isCurrentRegion: region.region === apiCurrentRegion,
                    modelCount: finalModelCount,
                    description: apiRegion?.description ?? region.description
                  };
                }));
                
                console.log('[RegionSelector] APIから動的モデル数を取得しました:', data.data.supportedRegions);
              }
            }
          }
        } catch (apiError) {
          console.warn('[RegionSelector] API情報の取得に失敗（新しい設定を使用）:', apiError);
        }
        
      } catch (error) {
        console.error('[RegionSelector] リージョン情報の読み込みに失敗:', error);
        
        // フォールバック: デフォルト設定を使用
        const fallbackRegion = RegionConfigManager.getDefaultRegion();
        setCurrentRegion(fallbackRegion);
        setSupportedRegions([{
          region: fallbackRegion,
          regionName: RegionConfigManager.getRegionDisplayName(fallbackRegion),
          isCurrentRegion: true,
          supported: true,
          modelCount: 0,
          description: 'デフォルトリージョン'
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRegionInfo();
  }, [locale]); // localeが変更されたときに再読み込み

  const handleRegionChange = async (newRegion: string) => {
    try {
      // リージョンの妥当性チェック
      const validation = RegionConfigManager.validateRegion(newRegion);
      
      if (!validation.isValid) {
        alert(t('validationWarning', {
          message: validation.message,
          fallbackRegion: RegionConfigManager.getRegionDisplayName(validation.fallbackRegion)
        }));
        return;
      }
      
      const allRegions = [...supportedRegions, ...unsupportedRegions];
      const regionInfo = allRegions.find(r => r.region === newRegion);
      const regionName = regionInfo?.regionName || newRegion;
      
      // サポート外リージョンの場合は警告
      if (regionInfo && !regionInfo.supported) {
        alert(t('unsupportedWarning', { 
          regionName, 
          warningMessage: regionInfo.warningMessage || t('futureSupport')
        }));
        return;
      }
      
      // リージョン変更を実行
      if (onRegionChange) {
        onRegionChange(newRegion);
      } else {
        // デフォルトの動作: APIを呼び出してリージョンを変更
        const modelCount = regionInfo?.modelCount || 0;
        
        const message = t('changeConfirm', {
          regionName,
          region: newRegion,
          modelCount: modelCount.toString()
        });
        
        if (confirm(message)) {
          setIsLoading(true);
          try {
            console.log('[RegionSelector] リージョン変更API呼び出し開始:', newRegion);
            
            // リージョン変更APIを呼び出し
            const response = await fetch('/api/bedrock/change-region', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ region: newRegion }),
            });
            
            console.log('[RegionSelector] APIレスポンス受信:', response.status);
            
            if (response.ok) {
              const data = await response.json();
              console.log('[RegionSelector] APIレスポンスデータ:', data);
              
              if (data.success) {
                // リージョン変更成功
                setCurrentRegion(newRegion as SupportedRegion);
                
                // サポート対象リージョンの現在リージョンフラグを更新
                setSupportedRegions(prev => prev.map(r => ({
                  ...r,
                  isCurrentRegion: r.region === newRegion
                })));
                
                alert(t('changeSuccess', { regionName }));
                
                // ページをリロード（エラーハンドリング付き）
                try {
                  window.location.reload();
                } catch (reloadError) {
                  console.error('[RegionSelector] ページリロードエラー:', reloadError);
                  alert(t('reloadError'));
                }
              } else {
                alert(t('changeError', { error: data.error || 'Unknown error' }));
              }
            } else {
              const errorText = await response.text();
              console.error('[RegionSelector] APIエラーレスポンス:', errorText);
              alert(t('changeApiError', { status: response.status.toString() }));
            }
          } catch (error) {
            console.error('[RegionSelector] リージョン変更エラー:', error);
            alert(t('changeError', { 
              error: error instanceof Error ? error.message : 'Unknown error' 
            }));
          } finally {
            setIsLoading(false);
          }
        }
      }
    } catch (error) {
      console.error('[RegionSelector] handleRegionChange全体エラー:', error);
      alert(t('changeUnexpectedError', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
      setIsLoading(false);
    }
  };

  const currentRegionInfo = supportedRegions.find(r => r.region === currentRegion);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">{t('bedrockRegion')}</label>
        <div className="flex items-center space-x-2">
          {/* 統計情報表示 */}
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <span className="flex items-center space-x-1">
              <span className="text-green-600">✅</span>
              <span>{supportedRegions.length}{t('supportedRegions')}</span>
            </span>
            {showUnsupportedRegions && unsupportedRegions.length > 0 && (
              <span className="flex items-center space-x-1">
                <span className="text-red-600">❌</span>
                <span>{unsupportedRegions.length}</span>
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {isExpanded ? t('close') : t('change')}
          </button>
        </div>
      </div>

      {/* 現在のリージョン表示 */}
      <div className={`p-3 rounded-lg border-2 ${
        currentRegionInfo?.isPrimary 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-sm' 
          : currentRegionInfo?.isNew
          ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-300 shadow-sm'
          : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-sm'
      }`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className={`text-lg ${
              currentRegionInfo?.isPrimary 
                ? 'text-blue-600' 
                : currentRegionInfo?.isNew 
                ? 'text-orange-600'
                : 'text-green-600'
            }`}>
              {currentRegionInfo?.isPrimary ? '🏆' : currentRegionInfo?.isNew ? '🆕' : '🌍'}
            </span>
            <span className={`font-semibold ${
              currentRegionInfo?.isPrimary 
                ? 'text-blue-900' 
                : currentRegionInfo?.isNew 
                ? 'text-orange-900'
                : 'text-green-900'
            }`}>
              {currentRegionInfo?.regionName || RegionConfigManager.getRegionDisplayName(currentRegion, locale)}
            </span>
            <span className={`font-mono text-xs ${
              currentRegionInfo?.isPrimary 
                ? 'text-blue-700' 
                : currentRegionInfo?.isNew 
                ? 'text-orange-700'
                : 'text-green-700'
            }`}>
              ({currentRegion})
            </span>
            {currentRegionInfo?.isNew && (
              <span className="px-2 py-1 bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-800 rounded-full text-xs font-bold border border-orange-200">
                {t('new')}
              </span>
            )}
          </div>
          {!isLoading && currentRegionInfo?.modelCount !== undefined && (
            <div className="flex items-center space-x-1">
              <span className="text-gray-600">🤖</span>
              <span className={`text-xs font-bold ${
                currentRegionInfo?.isPrimary 
                  ? 'text-blue-800' 
                  : currentRegionInfo?.isNew 
                  ? 'text-orange-800'
                  : 'text-green-800'
              }`}>
                {t('modelCount', { count: currentRegionInfo.modelCount })}
              </span>
            </div>
          )}
        </div>
        <div className={`text-xs mt-2 font-medium ${
          currentRegionInfo?.isPrimary 
            ? 'text-blue-800' 
            : currentRegionInfo?.isNew 
            ? 'text-orange-800'
            : 'text-green-800'
        }`}>
          {currentRegionInfo?.isPrimary && `🏆 ${t('primaryRegion')}`}
          {currentRegionInfo?.isNew && `🆕 ${t('newRegion')}`}
          {!currentRegionInfo?.isPrimary && !currentRegionInfo?.isNew && `✅ ${t('supportedRegion')}`}
        </div>
      </div>

      {/* リージョン選択 */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="space-y-3">
            {/* サポート対象リージョン */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <span>✅ {t('supportedRegions')}</span>
                <span className="text-gray-500">({supportedRegions.length}リージョン)</span>
              </div>
              
              {isLoading ? (
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span>{t('loadingRegionInfo')}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {supportedRegions.map((region) => (
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
                              : region.isNew
                              ? 'bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-900 border-2 border-orange-400 cursor-default shadow-md'
                              : 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-900 border-2 border-green-400 cursor-default shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-400 cursor-pointer shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">
                              {region.isCurrentRegion 
                                ? (region.isPrimary ? '🏆' : region.isNew ? '🆕' : '✅')
                                : (region.isPrimary ? '🏆' : region.isNew ? '🆕' : '🌍')
                              }
                            </span>
                            <div className="flex flex-col">
                              <span className="font-semibold">{region.regionName}</span>
                              <span className="text-xs text-gray-500 font-mono">({region.region})</span>
                            </div>
                            {region.isNew && (
                              <span className="px-2 py-1 bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-800 rounded-full text-xs font-bold border border-orange-200">
                                {t('new')}
                              </span>
                            )}
                            {region.isPrimary && !region.isCurrentRegion && (
                              <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 rounded-full text-xs font-bold border border-blue-200">
                                {t('recommended')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {!isLoading && region.modelCount !== undefined && (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-600">🤖</span>
                                <span className="text-gray-700 text-xs font-medium">
                                  {t('modelCount', { count: region.modelCount })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {region.isCurrentRegion && (
                          <div className={`text-xs mt-2 font-medium ${
                            region.isPrimary 
                              ? 'text-blue-700' 
                              : region.isNew 
                              ? 'text-orange-700'
                              : 'text-green-700'
                          }`}>
                            {region.isPrimary && `🏆 ${t('primaryRegionInUse')}`}
                            {region.isNew && `🆕 ${t('newRegionInUse')}`}
                            {!region.isPrimary && !region.isNew && `✅ ${t('currentlyInUse')}`}
                          </div>
                        )}
                      </button>
                      
                      {/* ツールチップ */}
                      {enableTooltips && hoveredRegion === region.region && (
                        <div className="absolute z-10 left-0 top-full mt-1 p-3 bg-gray-800 text-white text-xs rounded shadow-lg max-w-sm border border-gray-600">
                          <div className="font-medium text-white mb-2">{region.regionName}</div>
                          <div className="text-gray-200 mb-2">{region.description}</div>
                          
                          {region.modelCount !== undefined && (
                            <div className="mb-2">
                              <span className="text-green-300">{t('availableModels', { count: region.modelCount })}</span>
                            </div>
                          )}
                          
                          {region.isPrimary && (
                            <div className="mb-1">
                              <span className="text-blue-300">🏆 {t('primaryRegion')}</span>
                            </div>
                          )}
                          
                          {region.isNew && (
                            <div className="mb-1">
                              <span className="text-orange-300">🆕 {t('newRegion')}</span>
                            </div>
                          )}
                          
                          {/* モデル詳細情報 */}
                          {region.supported && RegionConfigManager.isRegionSupported(region.region) && region.modelCount !== undefined && (
                            <div className="mt-2 pt-2 border-t border-gray-600">
                              <div className="text-gray-300 text-xs">
                                <div className="space-y-1">
                                  <div>{t('availableModels', { count: region.modelCount })}</div>
                                  <div>{t('bedrockSupport')}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* サポート外リージョン */}
            {showUnsupportedRegions && unsupportedRegions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2 flex items-center space-x-2">
                  <span>❌ {t('unsupportedRegions')}</span>
                  <span className="text-gray-400">({unsupportedRegions.length}リージョン)</span>
                </div>
                <div className="space-y-1">
                  {unsupportedRegions.map((region) => (
                    <div
                      key={region.region}
                      className="relative"
                      onMouseEnter={() => enableTooltips && setHoveredRegion(region.region)}
                      onMouseLeave={() => enableTooltips && setHoveredRegion(null)}
                    >
                      <button
                        onClick={() => handleRegionChange(region.region)}
                        disabled={true}
                        className="w-full text-left p-3 rounded-lg text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed opacity-60 hover:opacity-70 transition-opacity"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">❌</span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-600">{region.regionName}</span>
                              <span className="text-xs text-gray-400 font-mono">({region.region})</span>
                            </div>
                            <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-bold border border-gray-300">
                              {t('preparing')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">🚫</span>
                            <span className="text-gray-400 text-xs font-medium">
                              {t('modelCount', { count: 0 })}
                            </span>
                          </div>
                        </div>
                        <div className="text-gray-400 text-xs mt-2 font-medium">
                          ❌ {t('currentlyUnsupported')}
                        </div>
                      </button>
                      
                      {/* ツールチップ */}
                      {enableTooltips && hoveredRegion === region.region && (
                        <div className="absolute z-10 left-0 top-full mt-1 p-3 bg-gray-800 text-white text-xs rounded shadow-lg max-w-sm border border-gray-600">
                          <div className="font-medium text-white mb-2">{region.regionName}</div>
                          <div className="text-gray-200 mb-2">{region.description}</div>
                          
                          <div className="mb-2">
                            <span className="text-red-300">❌ {t('currentlyUnsupported')}</span>
                          </div>
                          
                          <div className="text-yellow-300 mb-2">
                            {region.warningMessage || t('futureSupport')}
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <div className="text-gray-300 text-xs">
                              <div>{t('availableModels', { count: 0 })}</div>
                              <div>{t('status')}: {t('preparing')}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}