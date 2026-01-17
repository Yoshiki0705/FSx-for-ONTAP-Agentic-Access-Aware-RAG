/**
 * Agent管理コンポーネント
 * UI上でのAgent作成・削除・更新とSSMパラメータ自動同期
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface Agent {
  agentId: string;
  agentName: string;
  agentStatus: string;
  description?: string;
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

export function AgentManagement() {
  const t = useTranslations('agentManagement');
  const locale = useLocale();
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [ssmSync, setSsmSync] = useState<SSMSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

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
        alert(locale === 'ja' 
          ? 'Agentが作成され、SSMパラメータに登録されました' 
          : 'Agent created and registered to SSM parameters'
        );
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
        alert(locale === 'ja' 
          ? 'Agentが削除され、SSMパラメータからも削除されました' 
          : 'Agent deleted and removed from SSM parameters'
        );
      } else {
        setError(data.error || 'Agent削除に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // Agent詳細取得
  const getAgentDetails = async (agentId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get',
          agentId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSelectedAgent(data.agent);
        setSsmSync(data.ssmSync);
      } else {
        setError(data.error || 'Agent詳細取得に失敗しました');
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
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title', { default: 'Agent Management' })}
        </h2>
        <button
          onClick={() => setShowCreateForm(true)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {t('createAgent', { default: 'Create Agent' })}
        </button>
      </div>

      {/* SSM同期状態 */}
      {ssmSync && (
        <div className={`p-4 rounded-lg ${
          ssmSync.isSync 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-center space-x-2">
            <span className={`text-sm font-medium ${
              ssmSync.isSync ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'
            }`}>
              {ssmSync.isSync ? '✅' : '⚠️'} SSM同期状態:
            </span>
            <span className={`text-sm ${
              ssmSync.isSync ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'
            }`}>
              {ssmSync.message}
            </span>
          </div>
          {ssmSync.ssmAgentId && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              SSM Agent ID: {ssmSync.ssmAgentId}
            </div>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Agent一覧 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('agentList', { default: 'Agent List' })}
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {t('loading', { default: 'Loading...' })}
              </p>
            </div>
          ) : agents.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t('noAgents', { default: 'No agents found' })}
            </div>
          ) : (
            agents.map((agent) => (
              <div key={agent.agentId} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                      {agent.agentName}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      ID: {agent.agentId}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Status: <span className={`font-medium ${
                        agent.agentStatus === 'PREPARED' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {agent.agentStatus}
                      </span>
                    </p>
                    {agent.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {agent.description}
                      </p>
                    )}
                    {agent.createdAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Created: {new Date(agent.createdAt).toLocaleDateString(
                          locale === 'ja' ? 'ja-JP' : 'en-US'
                        )}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => getAgentDetails(agent.agentId)}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      {t('details', { default: 'Details' })}
                    </button>
                    <button
                      onClick={() => deleteAgent(agent.agentId, agent.agentName)}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                    >
                      {t('delete', { default: 'Delete' })}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agent作成フォーム */}
      {showCreateForm && (
        <AgentCreateForm
          onSubmit={createAgent}
          onCancel={() => setShowCreateForm(false)}
          loading={loading}
        />
      )}

      {/* Agent詳細モーダル */}
      {selectedAgent && (
        <AgentDetailsModal
          agent={selectedAgent}
          ssmSync={ssmSync}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}

/**
 * Agent作成フォーム
 */
interface AgentCreateFormProps {
  onSubmit: (data: {
    agentName: string;
    description: string;
    instruction: string;
    foundationModel: string;
  }) => void;
  onCancel: () => void;
  loading: boolean;
}

function AgentCreateForm({ onSubmit, onCancel, loading }: AgentCreateFormProps) {
  const t = useTranslations('agentManagement');
  const [formData, setFormData] = useState({
    agentName: '',
    description: '',
    instruction: '',
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {t('createAgent', { default: 'Create Agent' })}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('agentName', { default: 'Agent Name' })} *
            </label>
            <input
              type="text"
              value={formData.agentName}
              onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('description', { default: 'Description' })}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('instruction', { default: 'Instruction' })}
            </label>
            <textarea
              value={formData.instruction}
              onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={4}
              placeholder="You are a helpful AI assistant..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('foundationModel', { default: 'Foundation Model' })}
            </label>
            <select
              value={formData.foundationModel}
              onChange={(e) => setFormData({ ...formData, foundationModel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
              <option value="anthropic.claude-3-opus-20240229-v1:0">Claude 3 Opus</option>
            </select>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading || !formData.agentName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('creating', { default: 'Creating...' }) : t('create', { default: 'Create' })}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50"
            >
              {t('cancel', { default: 'Cancel' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Agent詳細モーダル
 */
interface AgentDetailsModalProps {
  agent: any;
  ssmSync: SSMSyncStatus | null;
  onClose: () => void;
}

function AgentDetailsModal({ agent, ssmSync, onClose }: AgentDetailsModalProps) {
  const t = useTranslations('agentManagement');
  const locale = useLocale();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('agentDetails', { default: 'Agent Details' })}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('agentName', { default: 'Agent Name' })}
            </label>
            <p className="text-gray-900 dark:text-white">{agent.agentName}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Agent ID
            </label>
            <p className="text-gray-900 dark:text-white font-mono text-sm">{agent.agentId}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <p className={`font-medium ${
              agent.agentStatus === 'PREPARED' 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-yellow-600 dark:text-yellow-400'
            }`}>
              {agent.agentStatus}
            </p>
          </div>
          
          {agent.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('description', { default: 'Description' })}
              </label>
              <p className="text-gray-900 dark:text-white">{agent.description}</p>
            </div>
          )}
          
          {agent.instruction && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('instruction', { default: 'Instruction' })}
              </label>
              <p className="text-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded">
                {agent.instruction}
              </p>
            </div>
          )}
          
          {agent.foundationModel && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('foundationModel', { default: 'Foundation Model' })}
              </label>
              <p className="text-gray-900 dark:text-white font-mono text-sm">{agent.foundationModel}</p>
            </div>
          )}
          
          {/* SSM同期状態 */}
          {ssmSync && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                SSM同期状態
              </label>
              <div className={`p-3 rounded ${
                ssmSync.isSync 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              }`}>
                <p className={`text-sm ${
                  ssmSync.isSync ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                  {ssmSync.isSync ? '✅' : '⚠️'} {ssmSync.message}
                </p>
                {ssmSync.ssmAgentId && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    SSM Agent ID: {ssmSync.ssmAgentId}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {agent.createdAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Created At
              </label>
              <p className="text-gray-900 dark:text-white text-sm">
                {new Date(agent.createdAt).toLocaleString(
                  locale === 'ja' ? 'ja-JP' : 'en-US'
                )}
              </p>
            </div>
          )}
          
          {agent.updatedAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Updated At
              </label>
              <p className="text-gray-900 dark:text-white text-sm">
                {new Date(agent.updatedAt).toLocaleString(
                  locale === 'ja' ? 'ja-JP' : 'en-US'
                )}
              </p>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            {t('close', { default: 'Close' })}
          </button>
        </div>
      </div>
    </div>
  );
}