'use client'

import React from 'react'
import { 
  Wifi, 
  WifiOff, 
  User, 
  Bot, 
  Database, 
  Shield,
  Activity
} from 'lucide-react'

interface SessionStateIndicatorProps {
  isConnected: boolean
  sessionId?: string
  userId?: string
  agentId?: string
  model?: string
  region?: string
  mode?: 'agent' | 'kb'
  messageCount?: number
  lastActivity?: Date
  guardrailsEnabled?: boolean
  className?: string
}

export default function SessionStateIndicator({
  isConnected,
  sessionId,
  userId,
  agentId,
  model,
  region,
  mode = 'kb',
  messageCount = 0,
  lastActivity,
  guardrailsEnabled = true,
  className = ''
}: SessionStateIndicatorProps) {
  const formatLastActivity = (date?: Date) => {
    if (!date) return '未接続'
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'たった今'
    if (minutes < 60) return `${minutes}分前`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}時間前`
    
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        icon: WifiOff,
        text: 'オフライン',
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800'
      }
    }
    
    return {
      icon: Wifi,
      text: '接続中',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    }
  }

  const getModeInfo = () => {
    if (mode === 'agent') {
      return {
        icon: Bot,
        text: 'Agent モード',
        description: agentId ? `Agent ID: ${agentId}` : 'Agent未選択',
        color: 'text-blue-600'
      }
    }
    
    return {
      icon: Database,
      text: 'Knowledge Base モード',
      description: 'RAG検索を使用',
      color: 'text-purple-600'
    }
  }

  const connectionStatus = getConnectionStatus()
  const modeInfo = getModeInfo()
  const ConnectionIcon = connectionStatus.icon
  const ModeIcon = modeInfo.icon

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 接続状態 */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${connectionStatus.bgColor} ${connectionStatus.borderColor}`}>
        <ConnectionIcon className={`w-5 h-5 ${connectionStatus.color}`} />
        <div className="flex-1">
          <div className={`font-medium ${connectionStatus.color}`}>
            {connectionStatus.text}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            最終アクティビティ: {formatLastActivity(lastActivity)}
          </div>
        </div>
        {isConnected && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Activity className="w-3 h-3" />
            <span>{messageCount} メッセージ</span>
          </div>
        )}
      </div>

      {/* セッション情報 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* モード情報 */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <ModeIcon className={`w-5 h-5 ${modeInfo.color}`} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-white text-sm">
              {modeInfo.text}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {modeInfo.description}
            </div>
          </div>
        </div>

        {/* セキュリティ状態 */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Shield className={`w-5 h-5 ${guardrailsEnabled ? 'text-green-600' : 'text-yellow-600'}`} />
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-white text-sm">
              Guardrails
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {guardrailsEnabled ? '有効' : '無効'}
            </div>
          </div>
        </div>
      </div>

      {/* 詳細情報（展開可能） */}
      <details className="group">
        <summary className="flex items-center gap-2 p-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
          <span>詳細情報</span>
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </summary>
        
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2 text-sm">
          {sessionId && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">セッションID:</span>
              <span className="font-mono text-xs text-gray-800 dark:text-gray-200">
                {sessionId.substring(0, 8)}...
              </span>
            </div>
          )}
          
          {userId && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">ユーザーID:</span>
              <span className="font-mono text-xs text-gray-800 dark:text-gray-200">
                {userId.substring(0, 8)}...
              </span>
            </div>
          )}
          
          {model && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">モデル:</span>
              <span className="text-xs text-gray-800 dark:text-gray-200">
                {model.split('.')[1]?.split('-')[0] || model}
              </span>
            </div>
          )}
          
          {region && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">リージョン:</span>
              <span className="text-xs text-gray-800 dark:text-gray-200">
                {region}
              </span>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}