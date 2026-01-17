'use client';

import { useState, useEffect } from 'react';
import { Globe, MapPin, Check } from 'lucide-react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

export interface AWSRegion {
  id: string;
  name: string;
  location: string;
  flag: string;
  bedrockAvailable: boolean;
  latency?: number;
}

export const AWS_REGIONS: AWSRegion[] = [
  {
    id: 'ap-northeast-1',
    name: 'Asia Pacific (Tokyo)',
    location: '東京',
    flag: '🇯🇵',
    bedrockAvailable: true,
    latency: 10
  },
  {
    id: 'ap-northeast-3',
    name: 'Asia Pacific (Osaka)',
    location: '大阪',
    flag: '🇯🇵',
    bedrockAvailable: false,
    latency: 15
  },
  {
    id: 'ap-southeast-1',
    name: 'Asia Pacific (Singapore)',
    location: 'シンガポール',
    flag: '🇸🇬',
    bedrockAvailable: true,
    latency: 45
  },
  {
    id: 'ap-southeast-2',
    name: 'Asia Pacific (Sydney)',
    location: 'シドニー',
    flag: '🇦🇺',
    bedrockAvailable: true,
    latency: 120
  },
  {
    id: 'us-east-1',
    name: 'US East (N. Virginia)',
    location: 'バージニア',
    flag: '🇺🇸',
    bedrockAvailable: true,
    latency: 180
  },
  {
    id: 'us-west-2',
    name: 'US West (Oregon)',
    location: 'オレゴン',
    flag: '🇺🇸',
    bedrockAvailable: true,
    latency: 150
  },
  {
    id: 'eu-west-1',
    name: 'Europe (Ireland)',
    location: 'アイルランド',
    flag: '🇮🇪',
    bedrockAvailable: true,
    latency: 200
  },
  {
    id: 'eu-central-1',
    name: 'Europe (Frankfurt)',
    location: 'フランクフルト',
    flag: '🇩🇪',
    bedrockAvailable: true,
    latency: 220
  }
];

interface RegionSelectorProps {
  currentRegion: string;
  onRegionChange: (regionId: string) => void;
  variant?: 'dropdown' | 'compact';
  className?: string;
}

export function RegionSelector({ 
  currentRegion, 
  onRegionChange, 
  variant = 'dropdown',
  className = '' 
}: RegionSelectorProps) {
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentRegionData = AWS_REGIONS.find(r => r.id === currentRegion);
  const bedrockRegions = AWS_REGIONS.filter(r => r.bedrockAvailable);

  const handleRegionChange = async (regionId: string) => {
    if (regionId === currentRegion) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      // リージョン変更をバックエンドに通知
      await fetch('/api/region/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: regionId })
      });

      onRegionChange(regionId);
      localStorage.setItem('selectedRegion', regionId);
    } catch (error) {
      console.error('Region change failed:', error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <MapPin className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium">
          {currentRegionData?.flag} {currentRegionData?.location}
        </span>
        {currentRegionData?.bedrockAvailable && (
          <div className="w-2 h-2 bg-green-400 rounded-full" title="Bedrock利用可能" />
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        title="リージョンを変更"
      >
        <Globe className="w-4 h-4" />
        <span>{currentRegionData?.flag}</span>
        <span>{currentRegionData?.location || 'リージョン選択'}</span>
        {isLoading ? (
          <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        ) : (
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* ドロップダウンメニュー */}
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-20">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                AWS リージョン選択
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Bedrock利用可能リージョンのみ表示
              </p>
            </div>
            
            <div className="py-1 max-h-64 overflow-y-auto">
              {bedrockRegions.map((region) => (
                <button
                  key={region.id}
                  onClick={() => handleRegionChange(region.id)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                    currentRegion === region.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{region.flag}</span>
                    <div>
                      <div className="font-medium">{region.location}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {region.name}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {region.latency && (
                      <span className="text-xs text-gray-500">
                        {region.latency}ms
                      </span>
                    )}
                    <div className="w-2 h-2 bg-green-400 rounded-full" title="Bedrock利用可能" />
                    {currentRegion === region.id && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                現在のリージョン: <span className="font-medium">{currentRegionData?.name}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}