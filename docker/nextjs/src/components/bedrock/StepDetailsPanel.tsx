'use client';

import React, { useState, useMemo } from 'react';
import { useSafeTranslations } from '../../hooks/useSafeTranslations';
import { 
  TraceStep, 
  TraceStepType, 
  TraceStepStatus,
  ActionGroupResult,
  KnowledgeBaseResult,
  MultiAgentCollaboration,
  InlineAgentExecution,
  PayloadReferencingOptimization,
  TraceStepTypeUtils
} from '../../types/bedrock-agent-trace';

/**
 * ステップ詳細パネルのプロパティ
 */
interface StepDetailsPanelProps {
  /** 表示するステップ */
  step: TraceStep;
  /** パネルを閉じる時のコールバック */
  onClose: () => void;
  /** 詳細モード */
  detailMode?: 'SIMPLE' | 'DETAILED';
}

/**
 * Action Group実行結果の詳細表示コンポーネント
 */
const ActionGroupResultDetails: React.FC<{ result: ActionGroupResult }> = ({ result }) => {
  const { t } = useSafeTranslations();

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">
          {t('trace.actionGroup.title')}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">{t('trace.actionGroup.name')}:</span>
            <span className="ml-2 text-gray-900">{result.actionGroupName}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">{t('trace.actionGroup.function')}:</span>
            <span className="ml-2 text-gray-900">{result.function}</span>
          </div>
        </div>
      </div>

      {result.parameters && Object.keys(result.parameters).length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">{t('trace.actionGroup.parameters')}:</h5>
          <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
            {JSON.stringify(result.parameters, null, 2)}
          </pre>
        </div>
      )}

      {result.response && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h5 className="font-medium text-green-900 mb-2">{t('trace.actionGroup.response')}:</h5>
          <div className="text-sm text-green-800">
            <div className="mb-2">
              <span className="font-medium">{t('trace.actionGroup.statusCode')}:</span>
              <span className="ml-2">{result.response.statusCode}</span>
            </div>
            {result.response.body && (
              <div>
                <span className="font-medium">{t('trace.actionGroup.responseBody')}:</span>
                <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                  {typeof result.response.body === 'string' 
                    ? result.response.body 
                    : JSON.stringify(result.response.body, null, 2)
                  }
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {result.executionTime && (
        <div className="bg-yellow-50 p-3 rounded-lg">
          <span className="font-medium text-yellow-900">{t('trace.performance.executionTime')}:</span>
          <span className="ml-2 text-yellow-800">{result.executionTime}ms</span>
        </div>
      )}
    </div>
  );
};

/**
 * Knowledge Base検索結果の詳細表示コンポーネント
 */
const KnowledgeBaseResultDetails: React.FC<{ result: KnowledgeBaseResult }> = ({ result }) => {
  const { t } = useSafeTranslations();

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 p-4 rounded-lg">
        <h4 className="font-semibold text-purple-900 mb-2">
          {t('trace.knowledgeBase.title')}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">{t('trace.knowledgeBase.id')}:</span>
            <span className="ml-2 text-gray-900">{result.knowledgeBaseId}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">{t('trace.knowledgeBase.query')}:</span>
            <span className="ml-2 text-gray-900">{result.query}</span>
          </div>
        </div>
      </div>

      {result.results && result.results.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-3">
            {t('trace.knowledgeBase.documents')} ({result.results.length})
          </h5>
          <div className="space-y-3">
            {result.results.map((doc, index) => (
              <div key={index} className="bg-white p-3 rounded border">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm text-gray-900">
                    {t('trace.knowledgeBase.document')} {index + 1}
                  </span>
                  {doc.score && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {t('trace.knowledgeBase.score')}: {doc.score.toFixed(3)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 line-clamp-3">
                  {doc.content}
                </div>
                {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      {t('trace.knowledgeBase.metadata')}
                    </summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(doc.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.retrievalTime && (
        <div className="bg-yellow-50 p-3 rounded-lg">
          <span className="font-medium text-yellow-900">{t('trace.performance.searchTime')}:</span>
          <span className="ml-2 text-yellow-800">{result.retrievalTime}ms</span>
        </div>
      )}
    </div>
  );
};

/**
 * Multi-Agent連携詳細の表示コンポーネント
 */
const MultiAgentDetailsComponent: React.FC<{ details: any }> = ({ details }) => {
  const { t } = useSafeTranslations();

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 p-4 rounded-lg">
        <h4 className="font-semibold text-indigo-900 mb-2">
          {t('trace.multiAgent.title')}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">{t('trace.multiAgent.role')}:</span>
            <span className="ml-2 text-gray-900">{details.agentRole}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">{t('trace.multiAgent.collaborators')}:</span>
            <span className="ml-2 text-gray-900">{details.taskDecomposition?.subTasks?.length || 0}</span>
          </div>
        </div>
      </div>

      {details.communicationLog && details.communicationLog.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-3">
            {t('trace.multiAgent.communication')}
          </h5>
          <div className="space-y-2">
            {details.communicationLog.map((comm: { fromAgentId: string; toAgentId: string; messageType: string; content: any }, index: number) => (
              <div key={index} className="bg-white p-3 rounded border">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm text-gray-900">
                    {comm.fromAgentId} → {comm.toAgentId}
                  </span>
                  <span className="text-xs text-gray-500">
                    {comm.messageType}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {JSON.stringify(comm.content)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {details.agentRole && (
        <div className="bg-blue-50 p-3 rounded-lg">
          <span className="font-medium text-blue-900">{t('trace.multiAgent.role')}:</span>
          <span className="ml-2 text-blue-800">{details.agentRole}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Inline Agent実行詳細の表示コンポーネント
 */
const InlineAgentDetailsComponent: React.FC<{ details: InlineAgentExecution }> = ({ details }) => {
  const { t } = useSafeTranslations();

  return (
    <div className="space-y-4">
      <div className="bg-teal-50 p-4 rounded-lg">
        <h4 className="font-semibold text-teal-900 mb-2">
          {t('trace.inlineAgent.title')}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">{t('trace.inlineAgent.id')}:</span>
            <span className="ml-2 text-gray-900">{details.inlineAgentId}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">{t('trace.inlineAgent.model')}:</span>
            <span className="ml-2 text-gray-900">{details.inputParameters.foundationModel}</span>
          </div>
        </div>
      </div>

      {details.inputParameters.prompt && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">{t('trace.inlineAgent.instruction')}:</h5>
          <div className="text-sm text-gray-800 bg-white p-3 rounded border">
            {details.inputParameters.prompt}
          </div>
        </div>
      )}

      {details.inputParameters.inferenceConfig && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">{t('trace.inlineAgent.inputVariables')}:</h5>
          <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
            {JSON.stringify(details.inputParameters.inferenceConfig, null, 2)}
          </pre>
        </div>
      )}

      {details.executionResult && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h5 className="font-medium text-green-900 mb-2">{t('trace.inlineAgent.output')}:</h5>
          <div className="text-sm text-green-800 bg-white p-3 rounded border">
            {details.executionResult.response}
          </div>
        </div>
      )}

      {details.executionResult && details.executionResult.executionTimeMs && (
        <div className="bg-yellow-50 p-3 rounded-lg">
          <span className="font-medium text-yellow-900">{t('trace.performance.executionTime')}:</span>
          <span className="ml-2 text-yellow-800">{details.executionResult.executionTimeMs}ms</span>
        </div>
      )}
    </div>
  );
};

/**
 * Payload Referencing最適化詳細の表示コンポーネント
 */
const PayloadReferencingDetailsComponent: React.FC<{ details: PayloadReferencingOptimization }> = ({ details }) => {
  const { t } = useSafeTranslations();

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 p-4 rounded-lg">
        <h4 className="font-semibold text-orange-900 mb-2">
          {t('trace.payloadReferencing.title')}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">{t('trace.payloadReferencing.originalSize')}:</span>
            <span className="ml-2 text-gray-900">{details.originalPayloadSize} bytes</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">{t('trace.payloadReferencing.optimizedSize')}:</span>
            <span className="ml-2 text-gray-900">{details.optimizedPayloadSize} bytes</span>
          </div>
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium text-green-900">{t('trace.payloadReferencing.reduction')}:</span>
          <span className="text-lg font-bold text-green-800">
            {details.reductionPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 bg-green-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${details.reductionPercentage}%` }}
          />
        </div>
      </div>

      {details.referenceInfo && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-3">
            {t('trace.payloadReferencing.referencedData')}
          </h5>
          <div className="bg-white p-3 rounded border">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm text-gray-900">
                {details.referenceInfo.referenceId}
              </span>
              <span className="text-xs text-gray-500">
                {details.referenceInfo.dataType}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {t('trace.payloadReferencing.uri')}: {details.referenceInfo.referenceUri}
            </div>
          </div>
        </div>
      )}

      {details.performanceImprovement && details.performanceImprovement.responseTimeReductionMs && (
        <div className="bg-yellow-50 p-3 rounded-lg">
          <span className="font-medium text-yellow-900">{t('trace.performance.optimizationTime')}:</span>
          <span className="ml-2 text-yellow-800">{details.performanceImprovement.responseTimeReductionMs}ms</span>
        </div>
      )}
    </div>
  );
};

/**
 * StepDetailsPanel - ステップ詳細表示パネル
 * 
 * 2024年GA機能対応のBedrock Agentトレースステップの詳細情報を表示
 */
export const StepDetailsPanel: React.FC<StepDetailsPanelProps> = ({
  step,
  onClose,
  detailMode = 'DETAILED'
}) => {
  const { t } = useSafeTranslations();
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'performance'>('overview');

  // ステップタイプに基づく詳細コンテンツの決定
  const detailContent = useMemo(() => {
    if (!step.details) return null;

    switch (step.type) {
      case 'ACTION_GROUP':
        return step.details.actionGroupResult ? (
          <ActionGroupResultDetails result={step.details.actionGroupResult} />
        ) : null;

      case 'KNOWLEDGE_BASE':
        return step.details.knowledgeBaseResult ? (
          <KnowledgeBaseResultDetails result={step.details.knowledgeBaseResult} />
        ) : null;

      case 'MULTI_AGENT_COLLABORATION':
        return step.details.multiAgentDetails ? (
          <MultiAgentDetailsComponent details={step.details.multiAgentDetails} />
        ) : null;

      case 'INLINE_AGENT_INVOCATION':
        return step.details.inlineAgentDetails ? (
          <InlineAgentDetailsComponent details={step.details.inlineAgentDetails} />
        ) : null;

      case 'PAYLOAD_REFERENCING':
        return step.details.payloadOptimizationDetails ? (
          <PayloadReferencingDetailsComponent details={step.details.payloadOptimizationDetails} />
        ) : null;

      default:
        return (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm">
              {t('trace.details.noSpecificDetails')}
            </p>
          </div>
        );
    }
  }, [step, t]);

  // パフォーマンス情報の表示
  const performanceInfo = useMemo(() => {
    const info = [];
    
    if (step.startTime && step.endTime) {
      const duration = new Date(step.endTime).getTime() - new Date(step.startTime).getTime();
      info.push({
        label: t('trace.performance.duration'),
        value: `${duration}ms`,
        color: 'blue'
      });
    }

    // Token usage might be available in some step details
    // Remove this section as tokenUsage is not part of TraceStep interface

    return info;
  }, [step, t]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {TraceStepTypeUtils.getDisplayName(step.type)}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {step.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('trace.tabs.overview')}
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('trace.tabs.details')}
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'performance'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('trace.tabs.performance')}
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{t('trace.overview.status')}</h4>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    step.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    step.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                    step.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {step.status}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{t('trace.overview.type')}</h4>
                  <span className="text-sm text-gray-700">
                    {TraceStepTypeUtils.getDisplayName(step.type)}
                  </span>
                </div>
              </div>

              {step.details?.input && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">{t('trace.overview.input')}</h4>
                  <pre className="text-sm text-blue-800 bg-white p-2 rounded border overflow-x-auto">
                    {typeof step.details.input === 'string' ? step.details.input : JSON.stringify(step.details.input, null, 2)}
                  </pre>
                </div>
              )}

              {step.details?.output && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">{t('trace.overview.output')}</h4>
                  <pre className="text-sm text-green-800 bg-white p-2 rounded border overflow-x-auto">
                    {typeof step.details.output === 'string' ? step.details.output : JSON.stringify(step.details.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div>
              {detailContent || (
                <div className="text-center py-8 text-gray-500">
                  {t('trace.details.noDetails')}
                </div>
              )}
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              {performanceInfo.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {performanceInfo.map((info, index) => (
                    <div key={index} className={`bg-${info.color}-50 p-4 rounded-lg`}>
                      <h4 className={`font-medium text-${info.color}-900 mb-1`}>
                        {info.label}
                      </h4>
                      <p className={`text-lg font-semibold text-${info.color}-800`}>
                        {info.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {t('trace.performance.noData')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepDetailsPanel;