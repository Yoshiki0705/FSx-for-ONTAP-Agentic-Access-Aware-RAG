'use client';

/**
 * GuardrailResultDisplay — Guardrail Evaluation Result in Agent Trace UI
 *
 * Shows guardrail pass/block status, filtered categories, and input block
 * → collaborator skip indication.
 *
 * Validates: Requirements 16.3, 16.4, 16.5
 */

import React from 'react';
import type { MultiAgentTraceResult } from '@/types/multi-agent';

export interface GuardrailResultDisplayProps {
  /** Guardrail evaluation result from the trace */
  guardrailResult: NonNullable<MultiAgentTraceResult['guardrailResult']>;
}

const ASSESSMENT_DISPLAY = {
  PASSED: { icon: '✅', label: '通過', className: 'text-green-600 dark:text-green-400' },
  BLOCKED: { icon: '🚫', label: 'ブロック', className: 'text-red-600 dark:text-red-400' },
  FILTERED: { icon: '⚠️', label: 'フィルタ適用', className: 'text-yellow-600 dark:text-yellow-400' },
} as const;

/**
 * Displays guardrail evaluation results in the trace panel.
 */
export default function GuardrailResultDisplay({
  guardrailResult,
}: GuardrailResultDisplayProps) {
  const inputInfo = ASSESSMENT_DISPLAY[guardrailResult.inputAssessment] ?? ASSESSMENT_DISPLAY.PASSED;
  const outputInfo = ASSESSMENT_DISPLAY[guardrailResult.outputAssessment] ?? ASSESSMENT_DISPLAY.PASSED;

  const isInputBlocked = guardrailResult.inputAssessment === 'BLOCKED';

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        isInputBlocked
          ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
      }`}
      role="region"
      aria-label="Guardrail評価結果"
    >
      <div className="flex items-center gap-2 text-sm">
        <span aria-hidden="true">🛡️</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          Guardrail評価
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Input assessment */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">入力評価:</span>
          <span className={`font-medium ${inputInfo.className}`}>
            {inputInfo.icon} {inputInfo.label}
          </span>
        </div>

        {/* Output assessment */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">出力評価:</span>
          <span className={`font-medium ${outputInfo.className}`}>
            {outputInfo.icon} {outputInfo.label}
          </span>
        </div>
      </div>

      {/* Filtered categories */}
      {guardrailResult.filteredCategories && guardrailResult.filteredCategories.length > 0 && (
        <div className="text-xs border-t border-gray-200 dark:border-gray-700 pt-2">
          <span className="text-gray-500 dark:text-gray-400">フィルタカテゴリ: </span>
          <span className="text-gray-700 dark:text-gray-300">
            {guardrailResult.filteredCategories.join(', ')}
          </span>
        </div>
      )}

      {/* Input blocked → collaborator skip notice (Requirement 16.5) */}
      {isInputBlocked && (
        <div
          className="text-xs bg-red-100 dark:bg-red-900/30 rounded p-2 text-red-700 dark:text-red-300"
          role="alert"
        >
          <span className="font-semibold">⚠️ 入力ブロック: </span>
          Guardrailにより入力がブロックされたため、Collaborator Agentの呼び出しはスキップされました。
        </div>
      )}
    </div>
  );
}
