'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, Clock, AlertCircle, Loader2, Bot, ExternalLink } from 'lucide-react';

/**
 * AgentCreationProgress コンポーネント
 * 
 * Agent作成の進捗をリアルタイムで表示
 * - 作成ステータスの可視化
 * - エラー時の詳細メッセージ表示
 * - 作成完了時の自動リダイレクト
 * 
 * Requirements: 28.2, 28.5
 */

interface AgentCreationProgressProps {
  agentId: string;
  isVisible: boolean;
  onComplete?: (agentId: string) => void;
  onError?: (error: string) => void;
}

interface CreationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

const CREATION_STEPS: Omit<CreationStep, 'status' | 'startTime' | 'endTime' | 'error'>[] = [
  {
    id: 'agent-creation',
    title: 'Agent作成',
    description: 'Bedrock Agentを作成しています'
  },
  {
    id: 'alias-creation',
    title: 'Alias作成',
    description: 'Agent Aliasを作成しています'
  },
  {
    id: 'knowledge-base-association',
    title: 'Knowledge Base関連付け',
    description: 'Knowledge Baseを関連付けています'
  },
  {
    id: 'preparation',
    title: 'Agent準備',
    description: 'Agentを使用可能な状態にしています'
  },
  {
    id: 'validation',
    title: '動作確認',
    description: 'Agentの動作を確認しています'
  }
];

export function AgentCreationProgress({ 
  agentId, 
  isVisible, 
  onComplete, 
  onError 
}: AgentCreationProgressProps) {
  const t = useTranslations();
  const [steps, setSteps] = useState<CreationStep[]>(
    CREATION_STEPS.map(step => ({ ...step, status: 'pending' }))
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [overallError, setOverallError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(new Date());

  // 経過時間の更新
  useEffect(() => {
    if (!isVisible || isCompleted) return;

    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, isCompleted, startTime]);

  // Agent作成進捗の監視
  useEffect(() => {
    if (!isVisible || !agentId || isCompleted) return;

    let pollInterval: NodeJS.Timeout;

    const pollAgentStatus = async () => {
      try {
        const response = await fetch(`/api/bedrock/agent-creation-status?agentId=${agentId}`);
        const data = await response.json();

        if (data.success) {
          updateStepsFromStatus(data.status);
          
          if (data.status.isCompleted) {
            setIsCompleted(true);
            onComplete?.(agentId);
          } else if (data.status.hasFailed) {
            setOverallError(data.status.error || 'Agent作成に失敗しました');
            onError?.(data.status.error || 'Agent作成に失敗しました');
          }
        } else {
          setOverallError(data.error || 'ステータス取得に失敗しました');
          onError?.(data.error || 'ステータス取得に失敗しました');
        }
      } catch (error) {
        console.error('Agent作成ステータス取得エラー:', error);
        setOverallError('ステータス取得に失敗しました');
        onError?.('ステータス取得に失敗しました');
      }
    };

    // 初回実行
    pollAgentStatus();

    // 3秒間隔でポーリング
    pollInterval = setInterval(pollAgentStatus, 3000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isVisible, agentId, isCompleted, onComplete, onError]);

  // ステータスからステップを更新
  const updateStepsFromStatus = (status: any) => {
    setSteps(prevSteps => {
      const newSteps = [...prevSteps];
      
      // 各ステップのステータスを更新
      if (status.agentCreated) {
        newSteps[0].status = 'completed';
        newSteps[0].endTime = new Date();
      } else if (status.creatingAgent) {
        newSteps[0].status = 'in-progress';
        newSteps[0].startTime = new Date();
      }

      if (status.aliasCreated) {
        newSteps[1].status = 'completed';
        newSteps[1].endTime = new Date();
      } else if (status.creatingAlias) {
        newSteps[1].status = 'in-progress';
        newSteps[1].startTime = new Date();
      }

      if (status.knowledgeBaseAssociated) {
        newSteps[2].status = 'completed';
        newSteps[2].endTime = new Date();
      } else if (status.associatingKnowledgeBase) {
        newSteps[2].status = 'in-progress';
        newSteps[2].startTime = new Date();
      }

      if (status.agentPrepared) {
        newSteps[3].status = 'completed';
        newSteps[3].endTime = new Date();
      } else if (status.preparingAgent) {
        newSteps[3].status = 'in-progress';
        newSteps[3].startTime = new Date();
      }

      if (status.validated) {
        newSteps[4].status = 'completed';
        newSteps[4].endTime = new Date();
      } else if (status.validating) {
        newSteps[4].status = 'in-progress';
        newSteps[4].startTime = new Date();
      }

      // エラーがある場合
      if (status.errors) {
        Object.keys(status.errors).forEach(stepId => {
          const stepIndex = newSteps.findIndex(step => step.id === stepId);
          if (stepIndex !== -1) {
            newSteps[stepIndex].status = 'failed';
            newSteps[stepIndex].error = status.errors[stepId];
          }
        });
      }

      return newSteps;
    });

    // 現在のステップインデックスを更新
    const inProgressIndex = steps.findIndex(step => step.status === 'in-progress');
    if (inProgressIndex !== -1) {
      setCurrentStepIndex(inProgressIndex);
    }
  };

  // 経過時間のフォーマット
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ステップアイコンの取得
  const getStepIcon = (step: CreationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  // ステップの実行時間を計算
  const getStepDuration = (step: CreationStep): string => {
    if (!step.startTime) return '';
    
    const endTime = step.endTime || new Date();
    const duration = Math.floor((endTime.getTime() - step.startTime.getTime()) / 1000);
    
    return `(${duration}秒)`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Bot className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Agent作成中
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Agent ID: {agentId} • 経過時間: {formatElapsedTime(elapsedTime)}
              </p>
            </div>
          </div>
        </div>

        {/* 進捗表示 */}
        <div className="px-6 py-6">
          {overallError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                    Agent作成に失敗しました
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    {overallError}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 全体進捗バー */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    全体進捗
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {steps.filter(s => s.status === 'completed').length} / {steps.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%` 
                    }}
                  />
                </div>
              </div>

              {/* ステップ詳細 */}
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div 
                    key={step.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border ${
                      step.status === 'in-progress' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : step.status === 'completed'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : step.status === 'failed'
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {getStepIcon(step)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {step.title}
                        </h4>
                        {step.status === 'completed' && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {getStepDuration(step)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {step.description}
                      </p>
                      {step.error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          エラー: {step.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {isCompleted ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Agent作成が完了しました！</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Agentを使用する</span>
              </button>
            </div>
          ) : overallError ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600 dark:text-red-400">
                作成に失敗しました
              </span>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                閉じる
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Agent作成中...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}