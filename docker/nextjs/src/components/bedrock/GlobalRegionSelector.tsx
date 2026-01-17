'use client';

import { useState, useEffect } from 'react';
import { 
  AWS_REGIONS, 
  REGION_GROUP_NAMES, 
  getRegionsByGroup, 
  getRegionInfo,
  DEFAULT_REGION,
  type AWSRegion 
} from '@/config/aws-regions';
import { BEDROCK_MODELS } from '@/config/bedrock-models';
import { isModelAvailableInRegion } from '@/config/region-model-availability';

interface GlobalRegionSelectorProps {
  onRegionChange?: (region: string) => void;
}

export function GlobalRegionSelector({ onRegionChange }: GlobalRegionSelectorProps) {
  const [currentRegion, setCurrentRegion] = useState<string>(DEFAULT_REGION);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  
  // リージョンごとの利用可能モデル数を計算
  const getAvailableModelsCount = (regionId: string): number => {
    try {
      const count = BEDROCK_MODELS.filter(model => {
        try {
          return isModelAvailableInRegion(model.id, regionId);
        } catch (error) {
          console.warn(`モデル ${model.id} のリージョン ${regionId} での利用可能性チェックに失敗:`, error);
          return false;
        }
      }).length;
      return count;
    } catch (error) {
      console.error(`リージョン ${regionId} のモデル数計算エラー:`, error);
      return 0;
    }
  };
  
  // Cookieから現在のリージョンを取得
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const savedRegion = getCookie('bedrock_region');
    if (savedRegion) {
      setCurrentRegion(savedRegion);
    }
  }, []);
  
  const handleRegionChange = async (newRegion: string) => {
    const regionInfo = getRegionInfo(newRegion);
    
    if (!regionInfo) {
      alert('❌ 無効なリージョンです');
      return;
    }
    
    if (!regionInfo.bedrockAvailable) {
      alert(`❌ ${regionInfo.flag} ${regionInfo.displayName}\n\nこのリージョンではAmazon Bedrockが利用できません。\n別のリージョンを選択してください。`);
      return;
    }
    
    const message = `${regionInfo.flag} ${regionInfo.displayName} (${regionInfo.name})\n\nこのリージョンに切り替えますか？\n\n切り替え後、ページがリロードされます。`;
    
    if (!confirm(message)) {
      return;
    }
    
    setIsChanging(true);
    
    try {
      // リージョン変更APIを呼び出し
      const response = await fetch('/api/bedrock/change-region', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ region: newRegion }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          setCurrentRegion(newRegion);
          
          if (onRegionChange) {
            onRegionChange(newRegion);
          }
          
          alert(`✅ リージョンを ${regionInfo.flag} ${regionInfo.displayName} に変更しました！\n\nページをリロードします。`);
          window.location.reload();
        } else {
          alert(`❌ リージョン変更に失敗しました\n\n${data.error || '不明なエラー'}`);
        }
      } else {
        alert(`❌ リージョン変更APIの呼び出しに失敗しました\n\nHTTP ${response.status}`);
      }
    } catch (error) {
      console.error('リージョン変更エラー:', error);
      alert(`❌ リージョン変更中にエラーが発生しました\n\n${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsChanging(false);
    }
  };
  
  const currentRegionInfo = getRegionInfo(currentRegion);
  const regionsByGroup = getRegionsByGroup();
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">グローバルリージョン</label>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {isExpanded ? '閉じる' : '変更'}
        </button>
      </div>
      
      {/* 現在のリージョン表示 */}
      <div className="p-3 rounded-lg border-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{currentRegionInfo?.flag || '🌍'}</span>
            <div className="flex flex-col">
              <span className="font-semibold text-blue-900 text-sm">
                {currentRegionInfo?.displayName || currentRegion}
              </span>
              <span className="text-xs text-blue-700 font-mono">
                {currentRegionInfo?.name || currentRegion}
              </span>
            </div>
          </div>
          <div className="text-xs text-blue-800 font-medium">
            {currentRegionInfo?.bedrockAvailable ? '✅ 利用可能' : '❌ 利用不可'}
          </div>
        </div>
      </div>
      
      {/* リージョン選択 */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            {Object.entries(regionsByGroup).map(([group, regions]) => {
              if (regions.length === 0) return null;
              
              return (
                <div key={group}>
                  <div className="text-xs font-bold text-gray-700 mb-2 pb-1 border-b border-gray-300">
                    {REGION_GROUP_NAMES[group]}
                  </div>
                  <div className="space-y-1">
                    {regions.map((region) => (
                      <button
                        key={region.id}
                        onClick={() => handleRegionChange(region.id)}
                        disabled={!region.bedrockAvailable || region.id === currentRegion || isChanging}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-all ${
                          region.id === currentRegion
                            ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-400 cursor-default shadow-md'
                            : region.bedrockAvailable
                            ? 'bg-white border border-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-400 cursor-pointer shadow-sm hover:shadow-md'
                            : 'bg-gray-100 border border-gray-200 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{region.flag}</span>
                            <div className="flex flex-col">
                              <span className={`font-semibold ${
                                region.id === currentRegion ? 'text-blue-900' : 'text-gray-800'
                              }`}>
                                {region.displayName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {region.name} ({region.id})
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {region.bedrockAvailable && (
                              <span className="text-xs text-gray-600 font-medium">
                                🤖 {getAvailableModelsCount(region.id)}個
                              </span>
                            )}
                            {region.id === currentRegion && (
                              <span className="text-blue-600 font-bold">✓</span>
                            )}
                            {region.bedrockAvailable ? (
                              <span className="text-green-600 text-xs">✅</span>
                            ) : (
                              <span className="text-red-600 text-xs">❌</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* 注意事項 */}
          <div className="mt-4 p-2 bg-yellow-50 rounded border border-yellow-200">
            <div className="text-yellow-800 text-xs space-y-1">
              <div className="font-medium">⚠️ 注意事項:</div>
              <div>• リージョン変更後、ページがリロードされます</div>
              <div>• 利用可能なモデルはリージョンによって異なります</div>
              <div>• 一部のモデルは自動的に最適なリージョンにルーティングされます</div>
            </div>
          </div>
          
          {/* 統計情報 */}
          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
            <div className="text-blue-800 text-xs space-y-1">
              <div className="font-medium">📊 リージョン統計:</div>
              <div>• 全リージョン: {AWS_REGIONS.length}個</div>
              <div>• Bedrock利用可能: {AWS_REGIONS.filter(r => r.bedrockAvailable).length}個</div>
              <div>• 現在: {currentRegionInfo?.flag} {currentRegionInfo?.displayName}</div>
            </div>
          </div>
        </div>
      )}
      
      {isChanging && (
        <div className="flex items-center justify-center space-x-2 text-xs text-gray-600 p-2">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          <span>リージョンを変更中...</span>
        </div>
      )}
    </div>
  );
}
