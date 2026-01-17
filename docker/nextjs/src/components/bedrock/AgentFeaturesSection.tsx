'use client';

import React from 'react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';

/**
 * AgentFeaturesSection Component
 * 
 * Agent Mode sidebar Agent Features explanation section
 * - Multi-step reasoning explanation
 * - Automatic document search explanation
 * - Context optimization explanation
 * 
 * Requirements: 6.3
 */

interface AgentFeaturesSectionProps {
  locale: string;
}

export function AgentFeaturesSection({ locale }: AgentFeaturesSectionProps) {
  const t = useCustomTranslations(locale);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {t('agent.features')}
      </h3>
      
      <div className="space-y-3">
        {/* Multi-step Reasoning */}
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('agent.multiStepReasoning')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {t('agent.multiStepReasoningDesc')}
          </p>
        </div>

        {/* Automatic Document Search */}
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('agent.automaticDocumentSearch')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {t('agent.automaticDocumentSearchDesc')}
          </p>
        </div>

        {/* Context Optimization */}
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('agent.contextOptimization')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {t('agent.contextOptimizationDesc')}
          </p>
        </div>

        {/* Hint */}
        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 {t('agent.hint')}: {t('agent.hintDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}
