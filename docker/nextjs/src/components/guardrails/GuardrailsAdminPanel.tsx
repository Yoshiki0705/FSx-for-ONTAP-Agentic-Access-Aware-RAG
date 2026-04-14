'use client';

/**
 * GuardrailsAdminPanel
 *
 * Read-only admin panel showing Guardrails configuration in the sidebar.
 * Displays account guardrails and organizational safeguards status.
 * Only visible to admin users when enableGuardrails=true.
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

export interface GuardrailsAdminPanelProps {
  enableGuardrails: boolean;
  isAdmin: boolean;
}

interface GuardrailsStatus {
  enabled: boolean;
  guardrailId?: string;
  standaloneGuardrails: any[];
  organizationalSafeguards: any[];
  currentGuardrailDetails?: any;
  orgStatus?: 'enabled' | 'not_configured' | 'unavailable';
  error?: string;
}

export function GuardrailsAdminPanel({ enableGuardrails, isAdmin }: GuardrailsAdminPanelProps) {
  const [status, setStatus] = useState<GuardrailsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let t: any;
  try {
    t = useTranslations('sidebar.guardrailsPanel');
  } catch {
    t = (key: string) => key;
  }

  useEffect(() => {
    if (!enableGuardrails || !isAdmin) return;

    const fetchStatus = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/bedrock/guardrails');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        setError('Guardrails 情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [enableGuardrails, isAdmin]);

  if (!enableGuardrails || !isAdmin) {
    return null;
  }

  return (
    <div className="p-3 space-y-3" data-testid="guardrails-admin-panel">
      <div className="flex items-center gap-2">
        <span>🛡️</span>
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {t('title')}
        </h3>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
          enableGuardrails
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {enableGuardrails ? t('enabled') : t('disabled')}
        </span>
      </div>

      {loading && (
        <div className="text-xs text-gray-500 animate-pulse">Loading...</div>
      )}

      {error && (
        <div className="text-xs text-red-500" data-testid="guardrails-error">
          {error}
        </div>
      )}

      {status && (
        <div className="space-y-3 text-xs">
          {/* Account Guardrails Section */}
          <div data-testid="account-guardrails-section">
            <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('accountGuardrails')}
            </div>
            {status.guardrailId && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('guardrailId')}</span>
                <span className="font-mono text-gray-700 dark:text-gray-300 truncate ml-2">
                  {status.guardrailId}
                </span>
              </div>
            )}
            {status.currentGuardrailDetails?.contentPolicy && (
              <div className="mt-1">
                <span className="text-gray-500">{t('contentFilters')}: </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {status.currentGuardrailDetails.contentPolicy.filters?.length || 0} categories
                </span>
              </div>
            )}
            {status.currentGuardrailDetails?.sensitiveInformationPolicy && (
              <div>
                <span className="text-gray-500">{t('piiDetection')}: </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {status.currentGuardrailDetails.sensitiveInformationPolicy.piiEntities?.length || 0} entities
                </span>
              </div>
            )}
          </div>

          {/* Organizational Guardrails Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2" data-testid="org-guardrails-section">
            <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('orgGuardrails')}
            </div>
            {status.orgStatus === 'enabled' && (
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                  {t('orgEnabled')}
                </span>
              </div>
            )}
            {status.orgStatus === 'not_configured' && (
              <div className="text-gray-500">{t('orgNotConfigured')}</div>
            )}
            {status.orgStatus === 'unavailable' && (
              <div className="text-yellow-600 dark:text-yellow-400">{t('orgUnavailable')}</div>
            )}
            {status.organizationalSafeguards && status.organizationalSafeguards.length > 0 && (
              <div className="mt-1 space-y-1">
                {status.organizationalSafeguards.map((sg: any) => (
                  <div key={sg.guardrailId} className="text-gray-600 dark:text-gray-400">
                    {sg.name} ({sg.guardrailId})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
