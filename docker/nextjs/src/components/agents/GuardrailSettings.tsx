'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { GuardrailSummary } from '@/types/enterprise-agent';

interface GuardrailSettingsProps {
  enabled: boolean;
  guardrailId: string | null;
  guardrailVersion: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onGuardrailChange: (id: string, version: string) => void;
  disabled?: boolean;
}

export function GuardrailSettings({ enabled, guardrailId, guardrailVersion, onEnabledChange, onGuardrailChange, disabled }: GuardrailSettingsProps) {
  const t = useTranslations('agentDirectory');
  const [guardrails, setGuardrails] = useState<GuardrailSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const fetchGuardrails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/bedrock/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'listGuardrails' }),
        });
        const data = await res.json();
        if (data.success) {
          setGuardrails(data.guardrails);
        } else {
          setError(data.error || t('guardrails.loadError'));
          onEnabledChange(false);
        }
      } catch {
        setError(t('guardrails.loadError'));
        onEnabledChange(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGuardrails();
  }, [enabled]);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('guardrails.title')}</h3>

      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onEnabledChange(e.target.checked)}
          disabled={disabled}
          className="rounded border-gray-300"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">{t('guardrails.enable')}</span>
      </label>

      {enabled && (
        <>
          {isLoading && (
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          )}

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          {!isLoading && !error && (
            <select
              value={guardrailId || ''}
              onChange={e => {
                const selected = guardrails.find(g => g.guardrailId === e.target.value);
                if (selected) onGuardrailChange(selected.guardrailId, selected.version);
              }}
              disabled={disabled || !enabled}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="">{t('guardrails.selectGuardrail')}</option>
              {guardrails.map(g => (
                <option key={g.guardrailId} value={g.guardrailId}>
                  {g.name} ({g.status})
                </option>
              ))}
            </select>
          )}

          {!isLoading && guardrails.length === 0 && !error && (
            <p className="text-xs text-gray-500">{t('guardrails.noGuardrails')}</p>
          )}
        </>
      )}
    </div>
  );
}
