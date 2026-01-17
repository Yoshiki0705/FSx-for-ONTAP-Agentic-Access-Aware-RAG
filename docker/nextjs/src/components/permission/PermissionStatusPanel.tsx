'use client';

import { useState, useEffect } from 'react';

interface PermissionSystemStatus {
  systemStatus: 'ACTIVE' | 'MAINTENANCE' | 'ERROR';
  timeBasedRestriction: {
    enabled: boolean;
    currentStatus: 'ALLOWED' | 'RESTRICTED';
    businessHours: string;
    currentTime: string;
    isBusinessHours: boolean;
  };
  geographicRestriction: {
    enabled: boolean;
    currentStatus: 'ALLOWED' | 'RESTRICTED';
    allowedRegions: string[];
    clientIP: string;
    detectedRegion: string;
  };
  dynamicPermission: {
    enabled: boolean;
    userPermissions: string[];
    projectAccess: string[];
    temporaryAccess: string[];
  };
  auditLog: {
    enabled: boolean;
    totalRequests: number;
    allowedRequests: number;
    deniedRequests: number;
    lastAccess: string;
  };
}

export function PermissionStatusPanel() {
  const [status, setStatus] = useState<PermissionSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissionStatus();
    // 30秒ごとに状態を更新
    const interval = setInterval(fetchPermissionStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPermissionStatus = async () => {
    try {
      const response = await fetch('/api/permission/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
        setError(null);
      } else {
        setError(data.message || 'ステータス取得に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
      console.error('Permission status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 text-sm">
          <div className="font-medium">エラー</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-4">
        <div className="text-gray-500 text-sm">
          ステータス情報を取得できませんでした
        </div>
      </div>
    );
  }

  const getStatusColor = (currentStatus: string) => {
    switch (currentStatus) {
      case 'ALLOWED':
      case 'ACTIVE':
        return 'text-green-600';
      case 'RESTRICTED':
        return 'text-yellow-600';
      case 'ERROR':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (currentStatus: string) => {
    switch (currentStatus) {
      case 'ALLOWED':
      case 'ACTIVE':
        return '🟢';
      case 'RESTRICTED':
        return '🟡';
      case 'ERROR':
        return '🔴';
      default:
        return '⚪';
    }
  };

  return (
    <div className="space-y-4">
      {/* システム全体状態 */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">システム状態</span>
          <span className={`text-sm font-medium ${getStatusColor(status.systemStatus)}`}>
            {getStatusIcon(status.systemStatus)} {status.systemStatus}
          </span>
        </div>
      </div>

      {/* 時間ベース制限 */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">⏰ 時間制限</span>
          <span className={`text-sm font-medium ${getStatusColor(status.timeBasedRestriction.currentStatus)}`}>
            {getStatusIcon(status.timeBasedRestriction.currentStatus)} {status.timeBasedRestriction.currentStatus}
          </span>
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <div>営業時間: {status.timeBasedRestriction.businessHours}</div>
          <div>現在時刻: {status.timeBasedRestriction.currentTime}</div>
          <div>営業時間内: {status.timeBasedRestriction.isBusinessHours ? 'はい' : 'いいえ'}</div>
        </div>
      </div>

      {/* 地理的制限 */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">🌍 地理制限</span>
          <span className={`text-sm font-medium ${getStatusColor(status.geographicRestriction.currentStatus)}`}>
            {getStatusIcon(status.geographicRestriction.currentStatus)} {status.geographicRestriction.currentStatus}
          </span>
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <div>許可地域: {status.geographicRestriction.allowedRegions.join(', ')}</div>
          <div>クライアントIP: {status.geographicRestriction.clientIP}</div>
          <div>検出地域: {status.geographicRestriction.detectedRegion}</div>
        </div>
      </div>

      {/* 動的権限 */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">🔒 動的権限</span>
          <span className="text-sm font-medium text-green-600">
            🟢 有効
          </span>
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <div>基本権限: {status.dynamicPermission.userPermissions.length}個</div>
          <div>プロジェクト: {status.dynamicPermission.projectAccess.length}個</div>
          <div>一時権限: {status.dynamicPermission.temporaryAccess.length}個</div>
        </div>
      </div>

      {/* 監査ログ */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">📊 監査ログ</span>
          <span className="text-sm font-medium text-blue-600">
            🔵 記録中
          </span>
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <div>総リクエスト: {status.auditLog.totalRequests.toLocaleString()}</div>
          <div>許可: {status.auditLog.allowedRequests.toLocaleString()}</div>
          <div>拒否: {status.auditLog.deniedRequests.toLocaleString()}</div>
          <div>成功率: {((status.auditLog.allowedRequests / status.auditLog.totalRequests) * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* 更新時刻 */}
      <div className="text-xs text-gray-500 text-center">
        最終更新: {new Date().toLocaleTimeString('ja-JP')}
      </div>
    </div>
  );
}