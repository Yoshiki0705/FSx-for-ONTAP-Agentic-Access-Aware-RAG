'use client';

import { useTranslations } from 'next-intl';

export interface PolicyTemplateSelectorProps {
  onSelect: (templateText: string) => void;
  disabled?: boolean;
}

const TEMPLATE_IDS = ['security', 'cost', 'flexibility'] as const;
export type PolicyTemplateId = typeof TEMPLATE_IDS[number];

export function PolicyTemplateSelector({ onSelect, disabled }: PolicyTemplateSelectorProps) {
  const t = useTranslations('agentDirectory.policy');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value as PolicyTemplateId | '';
    if (id && TEMPLATE_IDS.includes(id as PolicyTemplateId)) {
      onSelect(t(`${id}Text` as any));
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t('templateLabel')}
      </label>
      <select
        onChange={handleChange}
        disabled={disabled}
        defaultValue=""
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
      >
        <option value="">{t('templateNone')}</option>
        {TEMPLATE_IDS.map((id) => (
          <option key={id} value={id}>
            {t(`${id}Name` as any)} — {t(`${id}Desc` as any)}
          </option>
        ))}
      </select>
    </div>
  );
}
