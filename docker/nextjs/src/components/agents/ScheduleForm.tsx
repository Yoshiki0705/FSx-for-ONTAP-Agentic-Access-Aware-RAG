'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { validateCronExpression } from '@/utils/agentConfigUtils';
import type { CreateScheduleParams, ScheduleTask } from '@/types/enterprise-agent';

interface ScheduleFormProps {
  agentId: string;
  existingSchedule?: ScheduleTask;
  onSave: (schedule: CreateScheduleParams) => Promise<void>;
  onCancel: () => void;
}

export function ScheduleForm({ agentId, existingSchedule, onSave, onCancel }: ScheduleFormProps) {
  const t = useTranslations('agentDirectory');
  const [cronExpression, setCronExpression] = useState(existingSchedule?.cronExpression || '');
  const [description, setDescription] = useState(existingSchedule?.description || '');
  const [inputPrompt, setInputPrompt] = useState(existingSchedule?.inputPrompt || '');
  const [enabled, setEnabled] = useState(existingSchedule?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cronValid = cronExpression.trim() === '' || validateCronExpression(cronExpression);

  const handleSave = async () => {
    if (!validateCronExpression(cronExpression) || !inputPrompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ agentId, cronExpression, description, inputPrompt, enabled });
    } catch (err: any) {
      setError(err?.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('schedule.title')}</h4>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('schedule.cronExpression')}</label>
        <input type="text" value={cronExpression} onChange={e => setCronExpression(e.target.value)}
          placeholder="cron(0 12 * * ? *)" disabled={saving}
          className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${!cronValid ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'}`} />
        {!cronValid && cronExpression.trim() !== '' && <p className="text-xs text-red-500 mt-1">{t('schedule.invalidCron')}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('schedule.description')}</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} disabled={saving}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('schedule.inputPrompt')}</label>
        <textarea rows={3} value={inputPrompt} onChange={e => setInputPrompt(e.target.value)} disabled={saving}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y disabled:opacity-50" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} disabled={saving} className="rounded" />
        <span className="text-gray-700 dark:text-gray-300">Enabled</span>
      </label>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving || !validateCronExpression(cronExpression) || !inputPrompt.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '...' : t('schedule.createSchedule')}
        </button>
        <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
          {t('cancel') || 'Cancel'}
        </button>
      </div>
    </div>
  );
}
