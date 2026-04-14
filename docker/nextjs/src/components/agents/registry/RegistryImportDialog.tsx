'use client';

import { useState, useCallback } from 'react';
import { useRegistryStore } from '@/store/useRegistryStore';
import type { RegistryRecordDetail, RegistryImportResponse } from '@/types/registry';

interface RegistryImportDialogProps {
  record: RegistryRecordDetail;
  onClose: () => void;
}

/**
 * Registry インポート確認ダイアログ（プログレスインジケータ付き）
 * Requirements: 4.1, 4.4
 */
export function RegistryImportDialog({ record, onClose }: RegistryImportDialogProps) {
  const { isImporting, setImporting } = useRegistryStore();
  const [result, setResult] = useState<RegistryImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/bedrock/agent-registry/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: record.resourceId }),
      });
      const data: RegistryImportResponse = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Import failed.');
      }
    } catch {
      setError('Failed to import agent.');
    } finally {
      setImporting(false);
    }
  }, [record.resourceId, setImporting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl w-full">
        {/* Success state */}
        {result?.success && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-500 text-xl">✓</span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Import Successful</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Agent &quot;{result.agentName}&quot; has been created. Switch to the Agents tab to view it.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </>
        )}

        {/* Confirmation / progress / error state */}
        {!result?.success && (
          <>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Import from Registry
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Import &quot;{record.resourceName}&quot; as a local Bedrock Agent?
            </p>

            {/* Progress indicator */}
            {isImporting && (
              <div className="flex items-center gap-2 mb-4 text-sm text-blue-600 dark:text-blue-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Importing...
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 mb-4">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
