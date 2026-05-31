'use client';

/**
 * TriggersTab — Event-Driven Agent Trigger Management UI
 *
 * Displays configured triggers and their execution history.
 * Allows enabling/disabling triggers and viewing recent executions.
 *
 * Inspired by MOCA's trigger management UI pattern.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';

interface TriggerConfig {
  triggerId: string;
  triggerType: 'KB_INGESTION_COMPLETE' | 'BREAK_GLASS' | 'SCHEDULE';
  name: string;
  description: string;
  agentId: string;
  enabled: boolean;
  prompt: string;
  lastExecutionAt?: string;
  lastStatus?: 'SUCCESS' | 'FAILURE';
}

interface TriggerExecution {
  executionId: string;
  triggerId: string;
  triggerType: string;
  status: 'SUCCESS' | 'FAILURE';
  executedAt: string;
  durationMs: number;
  sessionId?: string;
  error?: string;
}

interface TriggersTabProps {
  locale: string;
}

export function TriggersTab({ locale }: TriggersTabProps) {
  const [triggers, setTriggers] = useState<TriggerConfig[]>([]);
  const [executions, setExecutions] = useState<TriggerExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [executionsLoading, setExecutionsLoading] = useState(false);

  // Fetch trigger configurations
  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/agent-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listTriggers' }),
      });
      const data = await resp.json();
      if (data.success) {
        setTriggers(data.triggers || []);
      }
    } catch (err) {
      console.error('[Triggers] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch execution history for a trigger
  const fetchExecutions = useCallback(async (triggerId: string) => {
    setExecutionsLoading(true);
    try {
      const resp = await fetch('/api/agent-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listExecutions', triggerId }),
      });
      const data = await resp.json();
      if (data.success) {
        setExecutions(data.executions || []);
      }
    } catch (err) {
      console.error('[Triggers] Failed to fetch executions:', err);
    } finally {
      setExecutionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  useEffect(() => {
    if (selectedTrigger) {
      fetchExecutions(selectedTrigger);
    }
  }, [selectedTrigger, fetchExecutions]);

  // Toggle trigger enabled/disabled
  const toggleTrigger = async (triggerId: string, enabled: boolean) => {
    try {
      await fetch('/api/agent-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleTrigger', triggerId, enabled }),
      });
      setTriggers(prev =>
        prev.map(t => t.triggerId === triggerId ? { ...t, enabled } : t)
      );
    } catch (err) {
      console.error('[Triggers] Failed to toggle:', err);
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'KB_INGESTION_COMPLETE': return '📚';
      case 'BREAK_GLASS': return '🚨';
      case 'SCHEDULE': return '⏰';
      default: return '⚡';
    }
  };

  const getTriggerTypeLabel = (type: string) => {
    switch (type) {
      case 'KB_INGESTION_COMPLETE': return 'KB Ingestion Complete';
      case 'BREAK_GLASS': return 'BREAK_GLASS Activation';
      case 'SCHEDULE': return 'Scheduled';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (triggers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⚡</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No Event Triggers Configured
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Event-Driven Agent Triggers automatically invoke agents when specific events occur
          (KB ingestion complete, capacity guardrail activation, etc.).
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
          Enable with: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            -c enableEventDrivenAgentTrigger=true
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trigger List */}
      <div className="grid gap-3">
        {triggers.map(trigger => (
          <div
            key={trigger.triggerId}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedTrigger === trigger.triggerId
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setSelectedTrigger(
              selectedTrigger === trigger.triggerId ? null : trigger.triggerId
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getTriggerIcon(trigger.triggerType)}</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {trigger.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getTriggerTypeLabel(trigger.triggerType)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {trigger.lastExecutionAt && (
                  <span className="text-xs text-gray-400">
                    Last: {new Date(trigger.lastExecutionAt).toLocaleString(locale)}
                    {trigger.lastStatus === 'SUCCESS' ? ' ✅' : ' ❌'}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTrigger(trigger.triggerId, !trigger.enabled);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    trigger.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      trigger.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {trigger.description}
            </p>

            {/* Prompt preview */}
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 truncate">
              Prompt: {trigger.prompt.substring(0, 100)}...
            </div>
          </div>
        ))}
      </div>

      {/* Execution History (when a trigger is selected) */}
      {selectedTrigger && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
            📋 Execution History
          </h4>
          {executionsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
            </div>
          ) : executions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No executions recorded yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.map(exec => (
                <div
                  key={exec.executionId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{exec.status === 'SUCCESS' ? '✅' : '❌'}</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {new Date(exec.executedAt).toLocaleString(locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span>{exec.durationMs}ms</span>
                    {exec.sessionId && (
                      <span className="text-xs font-mono">{exec.sessionId.substring(0, 12)}...</span>
                    )}
                  </div>
                  {exec.error && (
                    <span className="text-xs text-red-500 truncate max-w-48" title={exec.error}>
                      {exec.error.substring(0, 50)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
