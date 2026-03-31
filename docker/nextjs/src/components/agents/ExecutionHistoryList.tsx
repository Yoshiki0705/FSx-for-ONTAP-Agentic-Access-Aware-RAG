'use client';

import { useTranslations } from 'next-intl';
import type { ExecutionRecord } from '@/types/enterprise-agent';

interface ExecutionHistoryListProps {
  scheduleId: string;
  executions: ExecutionRecord[];
  isLoading: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

export function ExecutionHistoryList({ scheduleId, executions, isLoading }: ExecutionHistoryListProps) {
  const t = useTranslations('agentDirectory');

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (executions.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('schedule.noSchedules')}</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('schedule.executionHistory')}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3">{t('status')}</th>
              <th className="pb-2 pr-3">Prompt</th>
              <th className="pb-2">Response</th>
            </tr>
          </thead>
          <tbody>
            {executions.map(exec => (
              <tr key={exec.executionId} className="border-b dark:border-gray-700">
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(exec.startedAt).toLocaleString('ja-JP')}</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[exec.status] || 'bg-gray-100 text-gray-700'}`}>
                    {t(`schedule.${exec.status.toLowerCase()}` as any) || exec.status}
                  </span>
                </td>
                <td className="py-2 pr-3 max-w-[150px] truncate">{exec.inputPrompt}</td>
                <td className="py-2 max-w-[200px] truncate">
                  {exec.status === 'FAILED' ? (
                    <span className="text-red-500">{exec.errorMessage}</span>
                  ) : (
                    exec.responseSummary || '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
