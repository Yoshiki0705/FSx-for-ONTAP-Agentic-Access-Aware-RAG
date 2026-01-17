'use client';

import React, { useState, useMemo } from 'react';
import { useSafeTranslations } from '../../hooks/useSafeTranslations';
import { BedrockAgentTrace, TraceStep } from '../../types/bedrock-agent-trace';

/**
 * エクスポート形式の定義
 */
type ExportFormat = 'JSON' | 'CSV' | 'MARKDOWN';

/**
 * エクスポートオプションの定義
 */
interface ExportOptions {
  /** エクスポート形式 */
  format: ExportFormat;
  /** ステップ詳細を含めるか */
  includeStepDetails: boolean;
  /** パフォーマンス情報を含めるか */
  includePerformance: boolean;
  /** 2024年GA機能情報を含めるか */
  includeGAFeatures2024: boolean;
  /** セキュリティ情報をマスクするか */
  maskSensitiveData: boolean;
  /** 日時範囲フィルター */
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * トレースエクスポートパネルのプロパティ
 */
interface TraceExportPanelProps {
  /** エクスポート対象のトレース */
  traces: BedrockAgentTrace[];
  /** パネルを閉じる時のコールバック */
  onClose: () => void;
  /** エクスポート完了時のコールバック */
  onExportComplete?: (filename: string, format: ExportFormat) => void;
}

/**
 * TraceExportPanel - トレースエクスポート機能パネル
 * 
 * 2024年GA機能対応のBedrock Agentトレースデータをさまざまな形式でエクスポート
 */
export const TraceExportPanel: React.FC<TraceExportPanelProps> = ({
  traces,
  onClose,
  onExportComplete
}) => {
  const { t } = useSafeTranslations();
  
  // エクスポートオプションの状態管理
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'JSON',
    includeStepDetails: true,
    includePerformance: true,
    includeGAFeatures2024: true,
    maskSensitiveData: true
  });

  const [isExporting, setIsExporting] = useState(false);

  // エクスポート対象のトレース統計
  const exportStats = useMemo(() => {
    const totalSteps = traces.reduce((sum, trace) => sum + (trace.steps?.length ?? 0), 0);
    const gaFeatureSteps = traces.reduce((sum, trace) => 
      sum + (trace.steps?.filter(step => 
        ['MULTI_AGENT_COLLABORATION', 'INLINE_AGENT_INVOCATION', 'PAYLOAD_REFERENCING'].includes(step.type)
      ).length ?? 0), 0
    );

    return {
      totalTraces: traces.length,
      totalSteps,
      gaFeatureSteps,
      dateRange: traces.length > 0 ? {
        earliest: new Date(Math.min(...traces.map(t => new Date(t.startTime ?? new Date()).getTime()))),
        latest: new Date(Math.max(...traces.map(t => new Date(t.endTime ?? new Date()).getTime())))
      } : null
    };
  }, [traces]);

  // JSON形式でのエクスポート
  const exportAsJSON = (filteredTraces: BedrockAgentTrace[]): string => {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalTraces: filteredTraces.length,
        exportOptions,
        version: '2024-GA'
      },
      traces: filteredTraces.map(trace => ({
        ...trace,
        steps: exportOptions.includeStepDetails ? trace.steps : trace.steps?.map(step => ({
          id: step.stepId,
          name: step.name,
          type: step.type,
          status: step.status,
          startTime: step.startTime,
          endTime: step.endTime
        }))
      }))
    };

    return JSON.stringify(exportData, null, 2);
  };

  // CSV形式でのエクスポート
  const exportAsCSV = (filteredTraces: BedrockAgentTrace[]): string => {
    const headers = [
      'Trace ID',
      'Timestamp',
      'User Query',
      'Final Response',
      'Total Steps',
      'Duration (ms)',
      'Status'
    ];

    if (exportOptions.includePerformance) {
      headers.push('Input Tokens', 'Output Tokens');
    }

    if (exportOptions.includeGAFeatures2024) {
      headers.push('Multi-Agent Steps', 'Inline Agent Steps', 'Payload Optimization Steps');
    }

    const rows = filteredTraces.map(trace => {
      const duration = trace.endTime && trace.startTime 
        ? new Date(trace.endTime).getTime() - new Date(trace.startTime).getTime()
        : 0;

      const row = [
        trace.traceId,
        trace.startTime,
        `"${(trace.userQuery ?? '').replace(/"/g, '""')}"`,
        `"${(trace.finalResponse ?? '').replace(/"/g, '""')}"`,
        (trace.steps?.length ?? 0).toString(),
        duration.toString(),
        trace.status
      ];

      if (exportOptions.includePerformance) {
        // Token usage is not available in TraceStep interface
        // Remove token calculations and use execution time instead
        const totalDuration = trace.steps?.reduce((sum, step) => 
          sum + (step.executionTimeMs || 0), 0
        ) ?? 0;
        row.push(totalDuration.toString());
      }

      if (exportOptions.includeGAFeatures2024) {
        const multiAgentSteps = trace.steps?.filter(s => s.type === 'MULTI_AGENT_COLLABORATION').length ?? 0;
        const inlineAgentSteps = trace.steps?.filter(s => s.type === 'INLINE_AGENT_INVOCATION').length ?? 0;
        const payloadOptSteps = trace.steps?.filter(s => s.type === 'PAYLOAD_REFERENCING').length ?? 0;
        row.push(multiAgentSteps.toString(), inlineAgentSteps.toString(), payloadOptSteps.toString());
      }

      return row;
    });

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // Markdown形式でのエクスポート
  const exportAsMarkdown = (filteredTraces: BedrockAgentTrace[]): string => {
    let markdown = `# Bedrock Agent Trace Export\n\n`;
    markdown += `**Export Date:** ${new Date().toISOString()}\n`;
    markdown += `**Total Traces:** ${filteredTraces.length}\n`;
    markdown += `**Export Options:** ${JSON.stringify(exportOptions, null, 2)}\n\n`;

    filteredTraces.forEach((trace, index) => {
      markdown += `## Trace ${index + 1}: ${trace.traceId}\n\n`;
      markdown += `- **Timestamp:** ${trace.startTime}\n`;
      markdown += `- **Status:** ${trace.status}\n`;
      markdown += `- **User Query:** ${trace.userQuery ?? 'N/A'}\n`;
      markdown += `- **Final Response:** ${trace.finalResponse ?? 'N/A'}\n`;
      markdown += `- **Total Steps:** ${trace.steps?.length ?? 0}\n\n`;

      if (exportOptions.includeStepDetails && trace.steps) {
        markdown += `### Steps\n\n`;
        trace.steps.forEach((step, stepIndex) => {
          markdown += `#### Step ${stepIndex + 1}: ${step.name}\n\n`;
          markdown += `- **Type:** ${step.type}\n`;
          markdown += `- **Status:** ${step.status}\n`;
          if (step.startTime) markdown += `- **Start Time:** ${step.startTime}\n`;
          if (step.endTime) markdown += `- **End Time:** ${step.endTime}\n`;
          if (step.details?.input) markdown += `- **Input:** ${JSON.stringify(step.details.input)}\n`;
          if (step.details?.output) markdown += `- **Output:** ${JSON.stringify(step.details.output)}\n`;
          
          if (exportOptions.includePerformance && step.executionTimeMs) {
            markdown += `- **Execution Time:** ${step.executionTimeMs}ms\n`;
          }
          
          markdown += `\n`;
        });
      }

      markdown += `---\n\n`;
    });

    return markdown;
  };

  // データのマスキング処理
  const maskSensitiveData = (traces: BedrockAgentTrace[]): BedrockAgentTrace[] => {
    if (!exportOptions.maskSensitiveData) return traces;

    return traces.map(trace => ({
      ...trace,
      userQuery: (trace.userQuery ?? '').replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '****-****-****-****'),
      finalResponse: (trace.finalResponse ?? '').replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***'),
      steps: trace.steps?.map(step => ({
        ...step,
        // Remove rationale and observation as they don't exist in TraceStep interface
        details: {
          ...step.details,
          input: typeof step.details?.input === 'string' ? 
            step.details.input.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '****-****-****-****') : 
            step.details?.input,
          output: typeof step.details?.output === 'string' ? 
            step.details.output.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***') : 
            step.details?.output
        }
      }))
    }));
  };

  // エクスポート実行
  const handleExport = async () => {
    setIsExporting(true);

    try {
      // データの前処理
      let filteredTraces = [...traces];
      
      // 日時範囲フィルター
      if (exportOptions.dateRange) {
        filteredTraces = filteredTraces.filter(trace => {
          if (!trace.startTime) return false;
          const traceDate = new Date(trace.startTime);
          return traceDate >= exportOptions.dateRange!.start && traceDate <= exportOptions.dateRange!.end;
        });
      }

      // センシティブデータのマスキング
      filteredTraces = maskSensitiveData(filteredTraces);

      // 形式に応じたエクスポート
      let content: string;
      let mimeType: string;
      let fileExtension: string;

      switch (exportOptions.format) {
        case 'JSON':
          content = exportAsJSON(filteredTraces);
          mimeType = 'application/json';
          fileExtension = 'json';
          break;
        case 'CSV':
          content = exportAsCSV(filteredTraces);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'MARKDOWN':
          content = exportAsMarkdown(filteredTraces);
          mimeType = 'text/markdown';
          fileExtension = 'md';
          break;
        default:
          throw new Error(`Unsupported export format: ${exportOptions.format}`);
      }

      // ファイルダウンロード
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `bedrock-agent-traces-${timestamp}.${fileExtension}`;
      
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);

      // 完了コールバック
      onExportComplete?.(filename, exportOptions.format);
      
      // 成功メッセージ（実際の実装では toast などを使用）
      console.log(`Export completed: ${filename}`);
      
    } catch (error) {
      console.error('Export failed:', error);
      // エラーハンドリング（実際の実装では toast などを使用）
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('trace.export.title')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('trace.export.description')}
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

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* エクスポート統計 */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-blue-900 mb-2">{t('trace.export.statistics')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">{t('trace.export.totalTraces')}:</span>
                <span className="ml-2 font-semibold text-blue-900">{exportStats.totalTraces}</span>
              </div>
              <div>
                <span className="text-blue-700">{t('trace.export.totalSteps')}:</span>
                <span className="ml-2 font-semibold text-blue-900">{exportStats.totalSteps}</span>
              </div>
              <div>
                <span className="text-blue-700">{t('trace.export.gaFeatureSteps')}:</span>
                <span className="ml-2 font-semibold text-blue-900">{exportStats.gaFeatureSteps}</span>
              </div>
              {exportStats.dateRange && (
                <div>
                  <span className="text-blue-700">{t('trace.export.dateRange')}:</span>
                  <div className="text-xs text-blue-800 mt-1">
                    {exportStats.dateRange.earliest.toLocaleDateString()} - {exportStats.dateRange.latest.toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* エクスポート形式選択 */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-3">{t('trace.export.format')}</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['JSON', 'CSV', 'MARKDOWN'] as ExportFormat[]).map((format) => (
                <button
                  key={format}
                  onClick={() => setExportOptions(prev => ({ ...prev, format }))}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    exportOptions.format === format
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{format}</div>
                  <div className="text-xs mt-1">
                    {format === 'JSON' && t('trace.export.formatDesc.json')}
                    {format === 'CSV' && t('trace.export.formatDesc.csv')}
                    {format === 'MARKDOWN' && t('trace.export.formatDesc.markdown')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* エクスポートオプション */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-3">{t('trace.export.options')}</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeStepDetails}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    includeStepDetails: e.target.checked 
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('trace.export.includeStepDetails')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includePerformance}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    includePerformance: e.target.checked 
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('trace.export.includePerformance')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeGAFeatures2024}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    includeGAFeatures2024: e.target.checked 
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('trace.export.includeGAFeatures2024')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.maskSensitiveData}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    maskSensitiveData: e.target.checked 
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('trace.export.maskSensitiveData')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || traces.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('trace.export.exporting')}
              </div>
            ) : (
              t('trace.export.export')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TraceExportPanel;