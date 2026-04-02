'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { validateAgentConfig } from '@/utils/agentConfigUtils';
import { SharedConfigPreview } from './SharedConfigPreview';
import type { AgentConfig } from '@/types/enterprise-agent';

interface ImportDialogProps {
  onImport: (config: AgentConfig) => Promise<void>;
  onCancel: () => void;
  isImporting: boolean;
}

export function ImportDialog({ onImport, onCancel, isImporting }: ImportDialogProps) {
  const t = useTranslations('agentDirectory');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedConfig, setParsedConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsedConfig(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const validation = validateAgentConfig(json);
      if (!validation.valid) {
        setError(validation.errors.join('; '));
        return;
      }
      setParsedConfig(json as AgentConfig);
    } catch {
      setError(t('sharing.invalidJson'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg mx-4 shadow-xl w-full">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('sharing.import')}</h3>

        {!parsedConfig ? (
          <>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <span className="text-gray-500 dark:text-gray-400 text-sm">{t('sharing.selectJsonFile') || 'Select JSON file'}</span>
            </button>
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
            <div className="flex justify-end mt-4">
              <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{t('cancel') || 'Cancel'}</button>
            </div>
          </>
        ) : (
          <SharedConfigPreview
            config={parsedConfig}
            onImport={async () => { await onImport(parsedConfig); }}
            onCancel={() => { setParsedConfig(null); setError(null); }}
          />
        )}
      </div>
    </div>
  );
}
