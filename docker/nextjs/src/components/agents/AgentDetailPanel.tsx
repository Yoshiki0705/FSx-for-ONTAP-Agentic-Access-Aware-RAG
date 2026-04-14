'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { exportAgentConfig } from '@/utils/agentConfigUtils';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { ScheduleForm } from './ScheduleForm';
import { ExecutionHistoryList } from './ExecutionHistoryList';
import { ConnectedKBList } from './ConnectedKBList';
import { PolicyDisplay } from './PolicyDisplay';
import { PolicyBadge } from './PolicyBadge';
import type { AgentDetail } from '@/types/agent-directory';
import type { CreateScheduleParams, ScheduleTask, ExecutionRecord } from '@/types/enterprise-agent';

interface AgentDetailPanelProps {
  agent: AgentDetail;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUseInChat: (agentId: string) => void;
  locale: string;
}

export function AgentDetailPanel({ agent, onClose, onEdit, onDelete, onUseInChat, locale }: AgentDetailPanelProps) {
  const t = useTranslations('agentDirectory');
  const tKb = useTranslations('kbSelector');
  const [instructionExpanded, setInstructionExpanded] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleTask[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [manualRunning, setManualRunning] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const { agentRegistryEnabled: enableRegistry, agentPolicyEnabled } = useFeatureFlags();

  // Export agent config as JSON file download
  const handleExport = useCallback(() => {
    const config = exportAgentConfig(agent);
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.agentName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [agent]);

  // Upload to shared S3 bucket
  const handleUploadToS3 = useCallback(async () => {
    setUploadStatus(null);
    try {
      const config = exportAgentConfig(agent);
      const res = await fetch('/api/bedrock/agent-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uploadSharedConfig', config }),
      });
      const data = await res.json();
      setUploadStatus(data.success ? t('sharing.uploadSuccess') : (data.error || t('sharing.uploadError')));
    } catch {
      setUploadStatus(t('sharing.uploadError'));
    }
  }, [agent, t]);

  // Publish to Agent Registry
  const handlePublishToRegistry = useCallback(async () => {
    setIsPublishing(true);
    setPublishStatus(null);
    try {
      const res = await fetch('/api/bedrock/agent-registry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.agentId, description: agent.description }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishStatus(data.status === 'PENDING_APPROVAL' ? 'Published — pending approval' : 'Published successfully');
      } else {
        setPublishStatus(data.error || 'Publish failed');
      }
    } catch {
      setPublishStatus('Failed to publish to Registry');
    } finally {
      setIsPublishing(false);
    }
  }, [agent]);

  // Create schedule
  const handleCreateSchedule = useCallback(async (params: CreateScheduleParams) => {
    const res = await fetch('/api/bedrock/agent-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createSchedule', ...params }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    setShowScheduleForm(false);
    // Refresh schedules
    fetchSchedules();
  }, []);

  // Fetch schedules for this agent
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/bedrock/agent-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listSchedules', agentId: agent.agentId }),
      });
      const data = await res.json();
      if (data.success) setSchedules(data.schedules || []);
    } catch { /* ignore */ }
  }, [agent.agentId]);

  // Fetch execution history
  const fetchExecutionHistory = useCallback(async (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setExecutionsLoading(true);
    try {
      const res = await fetch('/api/bedrock/agent-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getExecutionHistory', scheduleId }),
      });
      const data = await res.json();
      if (data.success) setExecutions(data.executions || []);
    } catch { /* ignore */ }
    finally { setExecutionsLoading(false); }
  }, []);

  // Manual trigger
  const handleManualTrigger = useCallback(async (inputPrompt: string) => {
    setManualRunning(true);
    try {
      await fetch('/api/bedrock/agent-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manualTrigger', agentId: agent.agentId, inputPrompt }),
      });
    } catch { /* ignore */ }
    finally { setManualRunning(false); }
  }, [agent.agentId]);

  // Delete schedule
  const handleDeleteSchedule = useCallback(async (scheduleId: string) => {
    await fetch('/api/bedrock/agent-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteSchedule', scheduleId }),
    });
    fetchSchedules();
  }, [fetchSchedules]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{agent.agentName}</h2>
          {agent.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{agent.description}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label={t('close') || 'Close'}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div><span className="text-gray-500 dark:text-gray-400">{t('agentId')}</span><p className="font-mono text-gray-900 dark:text-gray-100">{agent.agentId}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('status')}</span><p className="text-gray-900 dark:text-gray-100">{agent.agentStatus}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('model')}</span><p className="text-gray-900 dark:text-gray-100">{agent.foundationModel || 'N/A'}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('version')}</span><p className="text-gray-900 dark:text-gray-100">{agent.agentVersion || 'N/A'}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('createdAt')}</span><p className="text-gray-900 dark:text-gray-100">{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString(locale) : 'N/A'}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('updatedAt')}</span><p className="text-gray-900 dark:text-gray-100">{agent.updatedAt ? new Date(agent.updatedAt).toLocaleDateString(locale) : 'N/A'}</p></div>
      </div>

      {/* System Prompt */}
      {agent.instruction && (
        <div className="mb-6">
          <button onClick={() => setInstructionExpanded(!instructionExpanded)} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <svg className={`w-4 h-4 transition-transform ${instructionExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            {t('systemPrompt')}
          </button>
          {instructionExpanded && (
            <pre className="text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{agent.instruction}</pre>
          )}
        </div>
      )}

      {/* Policy Display */}
      {agentPolicyEnabled && (
        <div className="mb-6">
          <PolicyBadge hasPolicy={!!agent.policyText} />
          <div className="mt-2">
            <PolicyDisplay policyText={agent.policyText || null} policyId={agent.policyId} />
          </div>
        </div>
      )}

      {/* Action Groups */}
      {Array.isArray(agent.actionGroups) && agent.actionGroups.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('actionGroups')}</h3>
          <ul className="space-y-1">
            {agent.actionGroups.map(ag => (
              <li key={ag.actionGroupId} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />{ag.actionGroupName}
                {ag.description && <span className="text-gray-400">— {ag.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Schedule Section */}
      <div className="mb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('schedule.title')}</h3>
          <button onClick={() => setShowScheduleForm(!showScheduleForm)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            {showScheduleForm ? (t('cancel') || 'Cancel') : t('schedule.createSchedule')}
          </button>
        </div>
        {showScheduleForm && (
          <ScheduleForm agentId={agent.agentId} onSave={handleCreateSchedule} onCancel={() => setShowScheduleForm(false)} />
        )}
        {schedules.length > 0 && (
          <div className="space-y-2 mt-3">
            {schedules.map(s => (
              <div key={s.scheduleId} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                <div>
                  <span className="font-medium">{s.cronExpression}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {s.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fetchExecutionHistory(s.scheduleId)} className="text-blue-600 hover:underline">History</button>
                  <button onClick={() => handleDeleteSchedule(s.scheduleId)} className="text-red-500 hover:underline">{t('schedule.deleteSchedule')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedScheduleId && (
          <div className="mt-3">
            <ExecutionHistoryList scheduleId={selectedScheduleId} executions={executions} isLoading={executionsLoading} />
          </div>
        )}
        {/* Manual Trigger */}
        {schedules.length > 0 && (
          <button
            onClick={() => { const s = schedules[0]; if (s) handleManualTrigger(s.inputPrompt || 'test'); }}
            disabled={manualRunning}
            className="mt-3 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {manualRunning ? '...' : t('schedule.manualTrigger')}
          </button>
        )}
      </div>

      {/* Connected Knowledge Bases */}
      <div className="mb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{tKb('connected')}</h3>
        <ConnectedKBList agentId={agent.agentId} locale={locale} />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button onClick={() => onUseInChat(agent.agentId)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">{t('useInChat')}</button>
        <button onClick={onEdit} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">{t('editAgent')}</button>
        <button onClick={handleExport} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">{t('sharing.export')}</button>
        <button onClick={handleUploadToS3} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">{t('sharing.uploadToS3')}</button>
        {enableRegistry && (
          <button
            onClick={handlePublishToRegistry}
            disabled={isPublishing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
          >
            {isPublishing ? 'Publishing...' : 'Publish to Registry'}
          </button>
        )}
        <button onClick={onDelete} className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 text-sm font-medium">{t('deleteAgent')}</button>
      </div>
      {uploadStatus && <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">{uploadStatus}</p>}
      {publishStatus && <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">{publishStatus}</p>}
    </div>
  );
}
