'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { NormalizedAgentInfo, AgentStatus } from '@/types/bedrock-agent';
import { formatAgentInfoForDisplay } from '@/hooks/useAgentInfoNormalization';
import { useTranslations } from 'next-intl';
import { useAgentsList, AgentSummary } from '@/hooks/useAgentsList';
import { useAgentStore } from '@/store/useAgentStore';
import { useChatStore } from '@/store/useChatStore';
import { useBedrockConfig } from '@/hooks';

interface AgentInfoSectionProps {
  agentInfo: NormalizedAgentInfo | null;
}

export function AgentInfoSection({ agentInfo }: AgentInfoSectionProps) {
  const t = useTranslations('agent');  // ✅ agentネームスペースを使用
  const tCommon = useTranslations('common');  // ✅ commonネームスペースも追加
  // ❌ REMOVED: tError - "b is not a function" エラーの原因（minified buildで問題発生）
  const { agents, isLoading: isLoadingAgents, error: agentsError } = useAgentsList();
  const { selectedAgentId, setSelectedAgentId } = useAgentStore();
  // ✅ FIX v8: Removed useChatStore.setSelectedAgentId (dual store update causing "h is not a function" error)
  
  // ✅ useBedrockConfigの安全な呼び出し（try-catch wrapper）
  let bedrockConfig = null;
  let bedrockConfigError = null;
  
  try {
    const result = useBedrockConfig();
    bedrockConfig = result.config;
    bedrockConfigError = result.error;
  } catch (error) {
    console.error('❌ [AgentInfoSection] useBedrockConfig error:', error);
    bedrockConfigError = error instanceof Error ? error.message : 'Unknown error';
  }

  // 選択されたAgentの情報を取得（動的）
  const selectedAgent = selectedAgentId 
    ? agents.find(agent => agent.agentId === selectedAgentId)
    : null;

  // 表示するAgent情報を決定（選択されたAgent > propsのagentInfo）
  const displayAgentInfo = selectedAgent || agentInfo;

  // NormalizedAgentInfoの場合のみフォーマット
  const displayInfo = agentInfo && !selectedAgent 
    ? formatAgentInfoForDisplay(agentInfo)
    : null;

  // 初期化時にAgent情報が既に選択されている場合のイベント発火
  useEffect(() => {
    if (selectedAgent && agents.length > 0) {
      console.log('🔄 [AgentInfoSection] 初期化時のAgent情報発火:', selectedAgent);
      
      const eventDetail = { 
        agentInfo: selectedAgent,
        timestamp: Date.now(),
        source: 'AgentInfoSection-Init',
        // ✅ 追加: 実行内容と進捗報告のプレースホルダー
        executionStatus: null,
        progressReport: null
      };
      
      const customEvent = new CustomEvent('agent-selection-changed', {
        detail: eventDetail,
        bubbles: true,      // ✅ イベントのバブリングを有効化
        cancelable: true,   // ✅ イベントのキャンセルを許可
        composed: true      // ✅ Shadow DOMを越えて伝播
      });
      
      window.dispatchEvent(customEvent);
      console.log('✅ [AgentInfoSection] 初期化時のイベント発火完了:', {
        agentId: selectedAgent.agentId,
        timestamp: eventDetail.timestamp
      });
    }
  }, [selectedAgent, agents.length]);

  // Agent作成ウィザードイベントリスナー
  useEffect(() => {
    const handleAgentCreationWizard = async (event: CustomEvent) => {
      console.log('🚀 [AgentInfoSection] Agent作成ウィザードイベント受信:', event.detail);
      
      // シンプルなAgent作成フォーム
      const agentName = prompt('Agent名を入力してください（例: マーケティング支援Agent）:');
      
      if (!agentName || !agentName.trim()) {
        return;
      }

      try {
        console.log('🚀 [AgentInfoSection] Agent作成開始:', agentName.trim());
        
        const response = await fetch('/api/bedrock/create-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: agentName.trim(),
            description: `${agentName.trim()} - Created via UI`,
            instructions: 'You are a helpful AI assistant. Please provide accurate and helpful responses to user questions.',
            foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
            region: bedrockConfig?.region || 'ap-northeast-1',
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          alert(`Agent "${agentName.trim()}" を作成しました！`);
          
          // 作成されたAgentを選択
          if (data.agent?.agentId) {
            setSelectedAgentId(data.agent.agentId);
          }
          
          // ページをリロードして最新の状態を反映
          window.location.reload();
        } else {
          console.error('❌ [AgentInfoSection] Agent作成失敗:', data.error);
          alert(`Agent作成に失敗しました: ${data.error}`);
        }
      } catch (error) {
        console.error('❌ [AgentInfoSection] Agent作成エラー:', error);
        alert('Agent作成中にエラーが発生しました');
      }
    };

    // イベントリスナーを追加
    window.addEventListener('open-agent-creation-wizard', handleAgentCreationWizard as EventListener);
    
    // クリーンアップ
    return () => {
      window.removeEventListener('open-agent-creation-wizard', handleAgentCreationWizard as EventListener);
    };
  }, [bedrockConfig?.region, setSelectedAgentId]);

  // ステータスに応じたスタイル設定
  const getStatusStyle = (status: AgentStatus) => {
    switch (status) {
      case 'PREPARED':
        return 'text-green-600';
      case 'CREATING':
      case 'PREPARING':
      case 'VERSIONING':
      case 'UPDATING':
        return 'text-blue-600';
      case 'FAILED':
        return 'text-red-600';
      case 'NOT_PREPARED':
        return 'text-yellow-600';
      case 'DELETING':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  // ステータスアイコンの取得
  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'PREPARED':
        return '✅';
      case 'CREATING':
      case 'PREPARING':
      case 'VERSIONING':
      case 'UPDATING':
        return '🔄';
      case 'FAILED':
        return '❌';
      case 'NOT_PREPARED':
        return '⚠️';
      case 'DELETING':
        return '🗑️';
      default:
        return '❓';
    }
  };

  // Agent選択ハンドラー
  const handleAgentChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    // ✅ FIX v7: Move newAgentId outside try block to fix "newAgentId is not defined" error
    const newAgentId = event.target.value;
    let selectedAgent = null;
    
    try {
      console.log('🔄 [AgentInfoSection] Agent選択:', newAgentId);
      
      // 選択されたAgentの詳細情報を取得
      if (newAgentId && agents && agents.length > 0) {
        selectedAgent = agents.find(agent => agent.agentId === newAgentId) || null;
        
        // ✅ Agent not found validation (警告のみ、エラーはスローしない)
        if (newAgentId && !selectedAgent) {
          console.warn(`⚠️ [AgentInfoSection] Agent not found: ${newAgentId}`);
          // エラーをスローせず、nullのまま続行
        }
      }
      
      // ストアを更新（useAgentStoreのみ使用）
      setSelectedAgentId(newAgentId || null);
      // ✅ FIX v8: Removed setChatSelectedAgentId (dual store update causing "h is not a function" error)
      
      // ✅ グローバルイベントを発火してメインページに通知（即座に実行）
      const eventDetail = { 
        agentInfo: selectedAgent,
        timestamp: Date.now(),
        source: 'AgentInfoSection',
        // ✅ 追加: 実行内容と進捗報告のプレースホルダー（将来の拡張用）
        executionStatus: null,
        progressReport: null
      };
      
      const customEvent = new CustomEvent('agent-selection-changed', {
        detail: eventDetail,
        bubbles: true,      // ✅ イベントのバブリングを有効化
        cancelable: true,   // ✅ イベントのキャンセルを許可
        composed: true      // ✅ Shadow DOMを越えて伝播
      });
      
      // 即座にイベントを発火
      window.dispatchEvent(customEvent);
      
      if (selectedAgent) {
        console.log('✅ [AgentInfoSection] Agent選択変更イベント発火:', {
          agentId: selectedAgent.agentId,
          agentName: selectedAgent.agentName,
          status: selectedAgent.agentStatus,
          timestamp: eventDetail.timestamp
        });
      } else {
        console.log('✅ [AgentInfoSection] Agent選択解除イベント発火');
      }
    } catch (error) {
      console.error('❌ [AgentInfoSection] Agent選択エラー:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        newAgentId,  // ✅ FIX v7: Now accessible in catch block
        selectedAgent,
        agentsCount: agents?.length
      });
      
      // ✅ FIX v4: alert()を削除（ユーザー体験を損なうため）
      // エラーはコンソールログのみに記録し、UIは継続動作
      // 理由: Agent選択エラーは致命的ではなく、ユーザーは再試行可能
      
      // エラーイベントを発火（デバッグ用）
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorEvent = new CustomEvent('agent-selection-error', {
        detail: {
          error: errorMessage,
          timestamp: Date.now(),
          source: 'AgentInfoSection',
          agentId: newAgentId,  // ✅ FIX v7: Now accessible in catch block
          errorType: error?.constructor?.name
        },
        bubbles: true
      });
      window.dispatchEvent(errorEvent);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          {t('information')}
        </h3>
        <Button
          onClick={() => {
            // Agent作成ウィザードを開くグローバルイベントを発火
            const event = new CustomEvent('open-agent-creation-wizard', {
              detail: {
                source: 'AgentInfoSection',
                timestamp: Date.now()
              }
            });
            window.dispatchEvent(event);
            console.log('🚀 [AgentInfoSection] Agent作成ウィザード開始イベント発火');
          }}
          size="sm"
          variant="outline"
          className="text-xs"
        >
          ➕
        </Button>
      </div>

      {/* Agent選択ドロップダウン */}
      <div className="space-y-2">
        <label className="text-xs text-gray-600">
          {t('selectAgent')}
        </label>
        <select
          value={selectedAgentId || ''}
          onChange={handleAgentChange}
          disabled={isLoadingAgents}
          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">
            {isLoadingAgents ? tCommon('loading') : t('selectAgent')}
          </option>
          {agents && agents.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.agentName} ({agent.agentId})
            </option>
          ))}
        </select>

        {/* エラー表示 */}
        {agentsError && (
          <div className="text-xs text-red-600">
            {agentsError.code === 'ACCESS_DENIED' ? (
              <div>
                <div>{t('permissionError')}</div>
                <div className="mt-1 text-gray-600">
                  {t('switchToKnowledgeBase')}
                </div>
              </div>
            ) : (
              agentsError.message
            )}
          </div>
        )}

        {/* Agents一覧が空の場合 */}
        {!isLoadingAgents && !agentsError && agents.length === 0 && (
          <div className="text-xs text-gray-500">
            {t('noAgentsAvailable')}
          </div>
        )}
      </div>

      {displayAgentInfo ? (
        <div className="space-y-2 text-xs">
          {/* Agent ID */}
          {displayAgentInfo.agentId && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('agentId')}:</span>
              <span className="font-mono text-gray-800 truncate max-w-[120px]" title={displayAgentInfo.agentId}>
                {displayAgentInfo.agentId}
              </span>
            </div>
          )}

          {/* Agent Name (AgentSummaryの場合) */}
          {'agentName' in displayAgentInfo && displayAgentInfo.agentName && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('agentName')}:</span>
              <span className="text-gray-800 truncate max-w-[120px]" title={displayAgentInfo.agentName}>
                {displayAgentInfo.agentName}
              </span>
            </div>
          )}

          {/* エイリアス (NormalizedAgentInfoの場合) */}
          {'alias' in displayAgentInfo && displayAgentInfo.alias && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('alias')}:</span>
              <span className="text-gray-800 truncate max-w-[120px]" title={displayAgentInfo.alias}>
                {displayAgentInfo.alias}
              </span>
            </div>
          )}

          {/* バージョン */}
          {'version' in displayAgentInfo && displayAgentInfo.version ? (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('version')}:</span>
              <span className="text-gray-800">{displayInfo?.versionText || displayAgentInfo.version}</span>
            </div>
          ) : 'latestAgentVersion' in displayAgentInfo && displayAgentInfo.latestAgentVersion && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('version')}:</span>
              <span className="text-gray-800">{displayAgentInfo.latestAgentVersion}</span>
            </div>
          )}

          {/* ステータス */}
          {'status' in displayAgentInfo && displayAgentInfo.status ? (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('status')}:</span>
              <span className={getStatusStyle(displayAgentInfo.status)}>
                {getStatusIcon(displayAgentInfo.status)} {displayInfo?.statusText || displayAgentInfo.status}
              </span>
            </div>
          ) : 'agentStatus' in displayAgentInfo && displayAgentInfo.agentStatus && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('status')}:</span>
              <span className={getStatusStyle(displayAgentInfo.agentStatus)}>
                {getStatusIcon(displayAgentInfo.agentStatus)} {displayAgentInfo.agentStatus}
              </span>
            </div>
          )}

          {/* アクティブ状態 (NormalizedAgentInfoの場合) */}
          {'isActive' in displayAgentInfo && typeof displayAgentInfo.isActive === 'boolean' && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('active')}:</span>
              <span className={displayAgentInfo.isActive ? 'text-green-600' : 'text-gray-500'}>
                {displayAgentInfo.isActive ? `🟢 ${t('activeStatus')}` : `⚫ ${t('inactiveStatus')}`}
              </span>
            </div>
          )}

          {/* 最終更新日時 (AgentSummaryの場合) */}
          {'updatedAt' in displayAgentInfo && displayAgentInfo.updatedAt && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('lastUpdated')}:</span>
              <span className="text-gray-800">{new Date(displayAgentInfo.updatedAt).toLocaleString('ja-JP')}</span>
            </div>
          )}

          {/* 最終使用日時 (NormalizedAgentInfoの場合) */}
          {'lastUsed' in displayAgentInfo && displayAgentInfo.lastUsed && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('lastUsed')}:</span>
              <span className="text-gray-800">{displayInfo?.lastActiveText || new Date(displayAgentInfo.lastUsed).toLocaleString('ja-JP')}</span>
            </div>
          )}

          {/* 説明（存在する場合） */}
          {displayAgentInfo.description && (
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="text-gray-600 mb-1">{t('description')}:</div>
              <div className="text-gray-800 text-xs leading-relaxed">
                {displayAgentInfo.description}
              </div>
            </div>
          )}

          {/* 基盤モデル (NormalizedAgentInfoの場合) */}
          {'foundationModel' in displayAgentInfo && displayAgentInfo.foundationModel && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('model')}:</span>
              <span className="text-gray-800 truncate max-w-[120px]" title={displayAgentInfo.foundationModel}>
                {displayAgentInfo.foundationModel}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500">
          {agentsError?.code === 'ACCESS_DENIED' ? (
            <div>
              <div className="text-red-600">{t('permissionError')}</div>
              <div className="mt-2">{t('switchToKnowledgeBase')}</div>
            </div>
          ) : (
            `${tCommon('loading')}...`
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => {
            // Agent作成ウィザードを開くグローバルイベントを発火
            const event = new CustomEvent('open-agent-creation-wizard', {
              detail: {
                source: 'AgentInfoSection-CreateButton',
                timestamp: Date.now()
              }
            });
            window.dispatchEvent(event);
            console.log('🚀 [AgentInfoSection] Agent作成ウィザード開始イベント発火（作成ボタン）');
          }}
          size="sm"
          className="flex-1 text-xs"
          disabled={
            (displayAgentInfo && 'status' in displayAgentInfo && (displayAgentInfo.status === 'CREATING' || displayAgentInfo.status === 'DELETING')) ||
            (displayAgentInfo && 'agentStatus' in displayAgentInfo && (displayAgentInfo.agentStatus === 'CREATING' || displayAgentInfo.agentStatus === 'DELETING'))
          }
        >
          🚀 {t('createNew')}
        </Button>

        {selectedAgentId && displayAgentInfo && (
          <Button
            onClick={async () => {
              if (!selectedAgentId || !displayAgentInfo) return;
              
              // Agent名を取得（AgentSummaryまたはNormalizedAgentInfo）
              const agentName = ('agentName' in displayAgentInfo && displayAgentInfo.agentName) 
                ? displayAgentInfo.agentName 
                : displayAgentInfo.agentId || 'Unknown Agent';
              
              // 削除確認（tを使用 - useTranslationsはイベントハンドラー内で呼べない）
              if (!confirm(t('deleteConfirm', { name: agentName }))) {
                return;
              }

              console.log('🗑️ [AgentInfoSection] Agent削除開始:', selectedAgentId);

              try {
                // Agent削除APIを使用（過去の実装に基づく）
                const response = await fetch(`/api/bedrock/agents/delete?agentId=${selectedAgentId}&region=${bedrockConfig?.region || 'ap-northeast-1'}`, {
                  method: 'DELETE',
                });

                const data = await response.json();

                if (data.success) {
                  console.log('✅ [AgentInfoSection] Agent削除成功');
                  alert(t('deleteSuccess'));
                  
                  // 選択をクリア
                  setSelectedAgentId(null);
                  
                  // Agent選択解除イベントを発火
                  const event = new CustomEvent('agent-selection-changed', {
                    detail: { 
                      agentInfo: null,
                      timestamp: Date.now(),
                      source: 'AgentInfoSection-Delete'
                    }
                  });
                  window.dispatchEvent(event);
                  console.log('✅ [AgentInfoSection] Agent削除後の選択解除イベント発火');
                  
                  // Agents一覧を再取得（useAgentsListが自動的に再取得）
                  window.location.reload();
                } else {
                  console.error('❌ [AgentInfoSection] Agent削除失敗:', data.error);
                  alert(t('deleteError') + ': ' + data.error);
                }
              } catch (error) {
                console.error('❌ [AgentInfoSection] Agent削除エラー:', error);
                alert(t('deleteError'));
              }
            }}
            size="sm"
            variant="outline"
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={
              (displayAgentInfo && 'status' in displayAgentInfo && displayAgentInfo.status && (displayAgentInfo.status === 'CREATING' || displayAgentInfo.status === 'DELETING')) ||
              (displayAgentInfo && 'agentStatus' in displayAgentInfo && displayAgentInfo.agentStatus && (displayAgentInfo.agentStatus === 'CREATING' || displayAgentInfo.agentStatus === 'DELETING'))
            }
          >
            🗑️ {
              ((displayAgentInfo && 'status' in displayAgentInfo && displayAgentInfo.status === 'DELETING') ||
               (displayAgentInfo && 'agentStatus' in displayAgentInfo && displayAgentInfo.agentStatus === 'DELETING'))
                ? t('deleting') 
                : t('deleteAgent')
            }
          </Button>
        )}
      </div>
    </div>
  );
}
