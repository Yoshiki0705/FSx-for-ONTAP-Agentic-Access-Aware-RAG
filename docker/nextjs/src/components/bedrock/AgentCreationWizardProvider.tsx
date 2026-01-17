'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useEffect } from 'react';
import { AgentCreationWizard } from './AgentCreationWizard';
import { AgentCreationProgress } from './AgentCreationProgress';

/**
 * AgentCreationWizardProvider コンポーネント
 * 
 * Agent作成ウィザードとプログレス表示を管理するプロバイダー
 * グローバルイベントリスナーを使用してウィザードの開閉を制御
 * 
 * Requirements: 28.9
 */
export function AgentCreationWizardProvider() {
  const t = useTranslations();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  const [creatingAgentId, setCreatingAgentId] = useState<string | null>(null);

  // グローバルイベントリスナーの設定
  useEffect(() => {
    const handleOpenWizard = () => {
      setIsWizardOpen(true);
    };

    const handleCloseWizard = () => {
      setIsWizardOpen(false);
    };

    // イベントリスナーを追加
    window.addEventListener('open-agent-creation-wizard', handleOpenWizard);
    window.addEventListener('close-agent-creation-wizard', handleCloseWizard);

    // クリーンアップ
    return () => {
      window.removeEventListener('open-agent-creation-wizard', handleOpenWizard);
      window.removeEventListener('close-agent-creation-wizard', handleCloseWizard);
    };
  }, []);

  // Agent作成成功時の処理
  const handleAgentCreationSuccess = (agentId: string) => {
    console.log('✅ [AgentCreationWizardProvider] Agent作成成功:', agentId);
    
    setIsWizardOpen(false);
    setCreatingAgentId(agentId);
    setIsProgressVisible(true);
  };

  // Agent作成エラー時の処理
  const handleAgentCreationError = (error: string) => {
    console.error('❌ [AgentCreationWizardProvider] Agent作成エラー:', error);
    
    setIsWizardOpen(false);
    setIsProgressVisible(false);
    setCreatingAgentId(null);
    
    // エラーメッセージを表示（トースト通知など）
    // TODO: トースト通知システムの実装
  };

  // Agent作成完了時の処理
  const handleAgentCreationComplete = (agentId: string) => {
    console.log('🎉 [AgentCreationWizardProvider] Agent作成完了:', agentId);
    
    setIsProgressVisible(false);
    setCreatingAgentId(null);
    
    // Agent情報の再取得をトリガー
    const event = new CustomEvent('agent-created', { 
      detail: { agentId } 
    });
    window.dispatchEvent(event);
    
    // 成功メッセージを表示（トースト通知など）
    // TODO: トースト通知システムの実装
  };

  // プログレスエラー時の処理
  const handleProgressError = (error: string) => {
    console.error('❌ [AgentCreationWizardProvider] プログレスエラー:', error);
    
    setIsProgressVisible(false);
    setCreatingAgentId(null);
    
    // エラーメッセージを表示（トースト通知など）
    // TODO: トースト通知システムの実装
  };

  return (
    <>
      {/* Agent作成ウィザード */}
      <AgentCreationWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleAgentCreationSuccess}
      />

      {/* Agent作成プログレス */}
      {creatingAgentId && (
        <AgentCreationProgress
          agentId={creatingAgentId}
          isVisible={isProgressVisible}
          onComplete={handleAgentCreationComplete}
          onError={handleProgressError}
        />
      )}
    </>
  );
}
