'use client';

import { useState, useEffect } from 'react';

interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  version: string;
  environment: string;
  region: string;
  bedrockStatus: 'available' | 'unavailable';
}

export function SystemInfo() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          setSystemStatus({
            status: 'healthy',
            timestamp: data.timestamp || new Date().toISOString(),
            version: data.version || '1.0.0',
            environment: data.environment || 'production',
            region: data.bedrockRegion || 'ap-northeast-1',
            bedrockStatus: data.bedrockAutoDetection ? 'available' : 'unavailable'
          });
        } else {
          throw new Error('Health check failed');
        }
      } catch (error) {
        console.error('System status fetch error:', error);
        setSystemStatus({
          status: 'warning',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: 'production',
          region: 'ap-northeast-1',
          bedrockStatus: 'unavailable'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystemStatus();
    
    // 30秒ごとに更新
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!systemStatus) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-4">
        <p className="text-red-800 text-sm">システム情報を取得できませんでした。</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">システム情報</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">ステータス:</span>
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.status)}`}>
            <span className="mr-1">{getStatusIcon(systemStatus.status)}</span>
            {systemStatus.status.toUpperCase()}
          </div>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">環境:</span>
          <span className="font-medium text-gray-900">{systemStatus.environment}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">リージョン:</span>
          <span className="font-medium text-gray-900">{systemStatus.region}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">バージョン:</span>
          <span className="font-medium text-gray-900">{systemStatus.version}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Bedrock:</span>
          <span className={`font-medium ${systemStatus.bedrockStatus === 'available' ? 'text-green-600' : 'text-red-600'}`}>
            {systemStatus.bedrockStatus === 'available' ? '利用可能' : '利用不可'}
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          最終更新: {new Date(systemStatus.timestamp).toLocaleString('ja-JP')}
        </p>
      </div>
    </div>
  );
}
