'use client';

import { useTranslations } from 'next-intl';
import { AGENT_CATEGORY_MAP } from '@/constants/card-constants';

interface AgentTemplateSectionProps {
  onSelectTemplate: (category: string) => void;
  locale: string;
}

export function AgentTemplateSection({ onSelectTemplate, locale }: AgentTemplateSectionProps) {
  const t = useTranslations('agentDirectory');
  const categories = Object.entries(AGENT_CATEGORY_MAP);

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('templateSection')}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(([key, config]) => (
          <div key={key} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                {key}
              </span>
            </div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-1">{config.agentNamePattern}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{config.description}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-3 truncate">{config.foundationModel}</p>
            <button
              onClick={() => onSelectTemplate(key)}
              className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              {t('createFromTemplate')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
