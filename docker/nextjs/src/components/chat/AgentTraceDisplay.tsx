'use client';

import { useState } from 'react';


// トレース情報の型定義
export interface AgentTrace {
  timestamp: number;
  query: string;
  trace: {
    orchestrationTrace?: {
      modelInvocationInput?: {
        text?: string;
        type?: string;
      };
      modelInvocationOutput?: {
        parsedResponse?: {
          rationale?: string;
          isValid?: boolean;
        };
      };
      observation?: {
        type?: string;
        knowledgeBaseLookupOutput?: {
          retrievedReferences?: Array<{
            content?: { text?: string };
            location?: { type?: string; s3Location?: { uri?: string } };
          }>;
        };
        actionGroupInvocationOutput?: {
          text?: string;
        };
      };
    };
    failureTrace?: {
      failureReason?: string;
      traceId?: string;
    };
    guardrailTrace?: {
      action?: string;
      inputAssessments?: any[];
      outputAssessments?: any[];
    };
  };
}

interface AgentTraceDisplayProps {
  traces: AgentTrace[];
}

/**
 * Bedrock Agent のトレース情報を表示するコンポーネント
 * 
 * AWSドキュメントに基づいた実装:
 * - orchestrationTrace: エージェントの推論プロセス
 * - failureTrace: エラー情報
 * - guardrailTrace: ガードレール評価結果
 */
export function AgentTraceDisplay({ traces }: AgentTraceDisplayProps) {
  
  const [expandedTraces, setExpandedTraces] = useState<Set<number>>(new Set());

  const toggleTrace = (index: number) => {
    const newExpanded = new Set(expandedTraces);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTraces(newExpanded);
  };

  if (traces.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        トレース情報はありません
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          📊 Agent実行トレース ({traces.length})
        </h3>
        <button
          onClick={() => setExpandedTraces(new Set())}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
        >
          全て閉じる
        </button>
      </div>

      {traces && Array.isArray(traces) && traces.map((traceItem, index) => {
        const isExpanded = expandedTraces.has(index);
        const trace = traceItem.trace;

        return (
          <div
            key={index}
            className="border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
          >
            {/* トレースヘッダー */}
            <button
              onClick={() => toggleTrace(index)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    トレース #{index + 1}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(traceItem.timestamp).toLocaleTimeString()} - {traceItem.query.substring(0, 50)}...
                  </div>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* トレース詳細 */}
            {isExpanded && (
              <div className="px-4 py-3 border-t dark:border-gray-700 space-y-3">
                {/* Orchestration Trace */}
                {trace.orchestrationTrace && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                      🔄 オーケストレーショントレース
                    </div>

                    {/* Model Invocation Input */}
                    {trace.orchestrationTrace.modelInvocationInput && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                        <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                          📥 モデル入力
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {trace.orchestrationTrace.modelInvocationInput.text || 'N/A'}
                        </div>
                      </div>
                    )}

                    {/* Model Invocation Output */}
                    {trace.orchestrationTrace.modelInvocationOutput?.parsedResponse && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                        <div className="text-xs font-medium text-green-900 dark:text-green-100 mb-1">
                          📤 モデル出力
                        </div>
                        {trace.orchestrationTrace.modelInvocationOutput.parsedResponse.rationale && (
                          <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                            <span className="font-medium">推論:</span>{' '}
                            {trace.orchestrationTrace.modelInvocationOutput.parsedResponse.rationale}
                          </div>
                        )}
                        <div className="text-xs">
                          <span className="font-medium">妥当性:</span>{' '}
                          {trace.orchestrationTrace.modelInvocationOutput.parsedResponse.isValid ? 
                            `✅ $有効` : 
                            `❌ $無効`
                          }
                        </div>
                      </div>
                    )}

                    {/* Observation */}
                    {trace.orchestrationTrace.observation && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                        <div className="text-xs font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                          👁️ 観測
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-300">
                          <div className="mb-2">
                            <span className="font-medium">タイプ:</span>{' '}
                            {trace.orchestrationTrace.observation.type || 'N/A'}
                          </div>

                          {/* Knowledge Base Lookup */}
                          {trace.orchestrationTrace.observation.knowledgeBaseLookupOutput?.retrievedReferences && Array.isArray(trace.orchestrationTrace.observation.knowledgeBaseLookupOutput.retrievedReferences) && (
                            <div className="space-y-2">
                              <div className="font-medium">📚 検索結果:</div>
                              {trace.orchestrationTrace.observation.knowledgeBaseLookupOutput.retrievedReferences.map((ref, refIndex) => (
                                <div key={refIndex} className="pl-3 border-l-2 border-yellow-300 dark:border-yellow-700">
                                  {ref.content?.text && (
                                    <div className="mb-1">{ref.content.text.substring(0, 200)}...</div>
                                  )}
                                  {ref.location?.s3Location?.uri && (
                                    <div className="text-xs text-gray-500">
                                      📄 {ref.location.s3Location.uri}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action Group Invocation */}
                          {trace.orchestrationTrace.observation.actionGroupInvocationOutput?.text && (
                            <div>
                              <span className="font-medium">⚡ アクション結果:</span>{' '}
                              {trace.orchestrationTrace.observation.actionGroupInvocationOutput.text}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Failure Trace */}
                {trace.failureTrace && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
                      ❌ エラー情報
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                      {trace.failureTrace.failureReason && (
                        <div>
                          <span className="font-medium">理由:</span> {trace.failureTrace.failureReason}
                        </div>
                      )}
                      {trace.failureTrace.traceId && (
                        <div>
                          <span className="font-medium">トレースID:</span> {trace.failureTrace.traceId}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Guardrail Trace */}
                {trace.guardrailTrace && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-md">
                    <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-2">
                      🛡️ ガードレール評価
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                      {trace.guardrailTrace.action && (
                        <div>
                          <span className="font-medium">アクション:</span> {trace.guardrailTrace.action}
                        </div>
                      )}
                      {trace.guardrailTrace.inputAssessments && trace.guardrailTrace.inputAssessments.length > 0 && (
                        <div>
                          <span className="font-medium">入力評価:</span> {trace.guardrailTrace.inputAssessments.length}件
                        </div>
                      )}
                      {trace.guardrailTrace.outputAssessments && trace.guardrailTrace.outputAssessments.length > 0 && (
                        <div>
                          <span className="font-medium">出力評価:</span> {trace.guardrailTrace.outputAssessments.length}件
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Raw Trace (デバッグ用) */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    🔍 生トレース
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                    {JSON.stringify(trace, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}