'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { AvailableActionGroup } from '@/types/enterprise-agent';

interface ActionGroupSelectorProps {
  agentId?: string;
  selectedGroups: string[];
  onSelectionChange: (groups: string[]) => void;
  disabled?: boolean;
}

export function ActionGroupSelector({ agentId, selectedGroups, onSelectionChange, disabled }: ActionGroupSelectorProps) {
  const t = useTranslations('agentDirectory');
  const [availableGroups, setAvailableGroups] = useState<AvailableActionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch available templates
        const res = await fetch('/api/bedrock/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'listAvailableActionGroups' }),
        });
        const data = await res.json();
        if (data.success) {
          setAvailableGroups(data.actionGroups);
          // If no selection yet, default-select the default group
          if (selectedGroups.length === 0) {
            const defaults = data.actionGroups.filter((g: AvailableActionGroup) => g.isDefault).map((g: AvailableActionGroup) => g.name);
            if (defaults.length > 0) onSelectionChange(defaults);
          }
        } else {
          setError(data.error || t('toolSelection.loadError'));
          // Fallback: default PermissionAwareSearch
          if (selectedGroups.length === 0) onSelectionChange(['PermissionAwareSearch']);
        }

        // If editing, also fetch attached groups
        if (agentId) {
          const attachedRes = await fetch('/api/bedrock/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'listActionGroups', agentId }),
          });
          const attachedData = await attachedRes.json();
          if (attachedData.success && attachedData.actionGroups) {
            const attachedNames = attachedData.actionGroups.map((g: any) => g.actionGroupName);
            onSelectionChange(attachedNames);
          }
        }
      } catch {
        setError(t('toolSelection.loadError'));
        if (selectedGroups.length === 0) onSelectionChange(['PermissionAwareSearch']);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGroups();
  }, [agentId]);

  const handleToggle = (name: string) => {
    if (disabled) return;
    const newSelection = selectedGroups.includes(name)
      ? selectedGroups.filter(g => g !== name)
      : [...selectedGroups, name];
    onSelectionChange(newSelection);
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('toolSelection.title')}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('toolSelection.selectTools')}</p>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {!isLoading && (
        <div className="space-y-2">
          {availableGroups.map(group => (
            <label key={group.name} className="flex items-start gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedGroups.includes(group.name)}
                onChange={() => handleToggle(group.name)}
                disabled={disabled}
                className="mt-0.5 rounded border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t(`toolSelection.${group.descriptionKey || group.name.toLowerCase()}`)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`toolSelection.${group.descriptionKey || group.name.toLowerCase()}Desc`)}
                </div>
              </div>
              {group.isDefault && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">default</span>
              )}
            </label>
          ))}
          {availableGroups.length === 0 && !error && (
            <p className="text-xs text-gray-500">{t('toolSelection.noToolsAvailable')}</p>
          )}
        </div>
      )}
    </div>
  );
}
