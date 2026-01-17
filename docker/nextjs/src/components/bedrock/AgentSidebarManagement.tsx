/**
 * Agent管理サイドバーコンポーネント
 * サイドバー内でのAgent選択・作成・削除機能
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Settings, Trash2, ChevronDown, ChevronRight, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Agent {
  agentId: string;
  agentName: string;
  agentStatus: string;
  description?: string;
  foundationModel?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SSMSyncStatus {
  isSync: boolean;
  ssmAgentId: string | null;
  expectedAgentId?: string;
  message: string;
}

interface AgentListResponse {
  success: boolean;
  agents: Agent[];
  ssmSync: {
    currentAgentId: string | null;
    syncStatus: SSMSyncStatus;
  };
  message: string;
}

interface AgentSidebarManagementProps {
  locale: string;
  currentAgentId?: string;
  onAgentSelect?: (agentId: string) => void;
  onAgentChange?: () => void;
}

export function AgentSidebarManagement({
  locale,
  currentAgentId,
  onAgentSelect,
  onAgentChange
}: AgentSidebarManagementProps) {
  const t = useTranslations('agentManagement');
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [ssmSync, setSsmSync] = useState<SSMSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Agent一覧取得
  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'list',
        }),
      });

      const data: AgentListResponse = await response.json();
      
      if (data.success) {
        setAgents(data.agents);
        setSsmSync(data.ssmSync.syncStatus);
      } else {
        setError(data.message || 'Agent一覧取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // Agent作成
  const createAgent = async (agentData: {
    agentName: string;
    description: string;
    instruction: string;
    foundationModel: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          ...agentData,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchAgents(); // 一覧を再取得
        setShowCreateForm(false);
        onAgentChange?.(); // 親コンポーネントに変更を通知
        
        // 作成されたAgentを自動選択
        if (data.agent?.agentId && onAgentSelect) {
          onAgentSelect(data.agent.agentId);
        }
      } else {
        setError(data.error || 'Agent作成に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // Agent削除
  const deleteAgent = async (agentId: string, agentName: string) => {
    const confirmMessage = locale === 'ja'
      ? `Agent "${agentName}" を削除しますか？SSMパラメータからも削除されます。`
      : `Are you sure you want to delete Agent "${agentName}"? It will also be removed from SSM parameters.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          agentId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchAgents(); // 一覧を再取得
        onAgentChange?.(); // 親コンポーネントに変更を通知
        
        // 削除されたAgentが現在選択中の場合、選択を解除
        if (currentAgentId === agentId && onAgentSelect) {
          const remainingAgents = agents.filter(a => a.agentId !== agentId);
          if (remainingAgents.length > 0) {
            onAgentSelect(remainingAgents[0].agentId);
          }
        }
      } else {
        setError(data.error || 'Agent削除に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // 初期化
  useEffect(() => {
    fetchAgents();
  }, []);

  return (
    <div className="space-y-2">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <Bot className="w-4 h-4" />
          <span>Agent Management</span>
        </button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          disabled={loading}
          className="p-1"
          title="Create New Agent"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* SSM同期状態 */}
      {isExpanded && ssmSync && (
        <div className={`p-2 rounded text-xs ${
          ssmSync.isSync 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
            : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
        }`}>
          <div className="flex items-center space-x-1">
            <span>{ssmSync.isSync ? '✅' : '⚠️'}</span>
            <span className="font-medium">SSM:</span>
            <span>{ssmSync.message}</span>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {isExpanded && error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Agent一覧 */}
      {isExpanded && (
        <div className="space-y-1">
          {loading ? (
            <div className="p-2 text-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400">
              No agents found
            </div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.agentId}
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  currentAgentId === agent.agentId
                    ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
                onClick={() => onAgentSelect?.(agent.agentId)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <User className="w-3 h-3 text-gray-500" />
                      <h4 className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {agent.agentName}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      ID: {agent.agentId}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        agent.agentStatus === 'PREPARED' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      }`}>
                        {agent.agentStatus}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAgent(agent.agentId, agent.agentName);
                    }}
                    disabled={loading}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Agent作成フォーム */}
      {showCreateForm && (
        <AgentCreateFormMini
          onSubmit={createAgent}
          onCancel={() => setShowCreateForm(false)}
          loading={loading}
          locale={locale}
        />
      )}
    </div>
  );
}

/**
 * ミニAgent作成フォーム（サイドバー用）
 */
interface AgentCreateFormMiniProps {
  onSubmit: (data: {
    agentName: string;
    description: string;
    instruction: string;
    foundationModel: string;
  }) => void;
  onCancel: () => void;
  loading: boolean;
  locale: string;
}

function AgentCreateFormMini({ onSubmit, onCancel, loading, locale }: AgentCreateFormMiniProps) {
  const [formData, setFormData] = useState({
    agentName: '',
    description: '',
    instruction: 'You are a helpful AI assistant. Please provide accurate and helpful responses to user questions.',
    foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.agentName.trim()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Create New Agent
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.agentName}
              onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter agent name"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
              placeholder="Brief description"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Foundation Model
            </label>
            <select
              value={formData.foundationModel}
              onChange={(e) => setFormData({ ...formData, foundationModel: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
              <option value="anthropic.claude-3-opus-20240229-v1:0">Claude 3 Opus</option>
            </select>
          </div>
          
          <div className="flex space-x-2 pt-2">
            <button
              type="submit"
              disabled={loading || !formData.agentName.trim()}
              className="flex-1 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-3 py-1.5 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}