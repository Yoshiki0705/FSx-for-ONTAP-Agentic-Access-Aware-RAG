'use client';

import { useEffect, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAgentDirectoryStore } from '@/store/useAgentDirectoryStore';
import { useAgentStore } from '@/store/useAgentStore';
import { filterAgents } from '@/utils/agentCategoryUtils';
import { AGENT_CATEGORY_MAP } from '@/constants/card-constants';
import { AgentCard } from './AgentCard';
import { AgentDetailPanel } from './AgentDetailPanel';
import { AgentEditor } from './AgentEditor';
import { AgentCreator } from './AgentCreator';
import { AgentTemplateSection } from './AgentTemplateSection';
import { ImportDialog } from './ImportDialog';
import { SharedConfigPreview } from './SharedConfigPreview';
import { ExecutionHistoryList } from './ExecutionHistoryList';
import type { AgentDetail, UpdateAgentFormData } from '@/types/agent-directory';
import type { AgentConfig, ExecutionRecord } from '@/types/enterprise-agent';
import { TeamsTab } from './TeamsTab';
import { TemplateGallery } from './TemplateGallery';
import { TeamCreateWizard } from './TeamCreateWizard';
import { useAgentTeamStore } from '@/store/useAgentTeamStore';
import type { AgentTeamTemplate } from '@/types/multi-agent';

interface AgentDirectoryProps { locale: string; initialCreateCategory?: string; }

export function AgentDirectory({ locale, initialCreateCategory }: AgentDirectoryProps) {
  const t = useTranslations('agentDirectory');
  const router = useRouter();
  const { setSelectedAgentId } = useAgentStore();
  const {
    agents, selectedAgent, searchQuery, selectedCategory, viewMode, activeTab,
    isLoading, error, creationProgress, sharedConfigs, schedules,
    setAgents, setSelectedAgent, setSearchQuery, setSelectedCategory,
    setViewMode, setActiveTab, setLoading, setError, setCreationProgress,
    setSharedConfigs, setSchedules,
  } = useAgentDirectoryStore();

  const [deleteConfirm, setDeleteConfirm] = useState<AgentDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createCategory, setCreateCategory] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<AgentConfig | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [showTeamWizard, setShowTeamWizard] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTeamTemplate | null>(null);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const { setTeams } = useAgentTeamStore();

  useEffect(() => { if (initialCreateCategory && AGENT_CATEGORY_MAP[initialCreateCategory]) { setCreateCategory(initialCreateCategory); setViewMode('create'); } }, [initialCreateCategory, setViewMode]);

  const fetchAgents = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await fetch('/api/bedrock/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) }); const d = await r.json(); if (d.success && Array.isArray(d.agents)) setAgents(d.agents); else setError(d.error || t('loadError')); }
    catch { setError(t('loadError')); } finally { setLoading(false); }
  }, [setAgents, setLoading, setError, t]);
  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const fetchSharedConfigs = useCallback(async () => { try { const r = await fetch('/api/bedrock/agent-sharing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'listSharedConfigs' }) }); const d = await r.json(); if (d.success) setSharedConfigs(d.configs || []); } catch {} }, [setSharedConfigs]);
  const fetchSchedules = useCallback(async () => { try { const r = await fetch('/api/bedrock/agent-schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'listSchedules' }) }); const d = await r.json(); if (d.success) setSchedules(d.schedules || []); } catch {} }, [setSchedules]);
  useEffect(() => { if (activeTab === 'shared') fetchSharedConfigs(); if (activeTab === 'schedules') fetchSchedules(); }, [activeTab, fetchSharedConfigs, fetchSchedules]);

  const fetchAgentDetail = useCallback(async (agentId: string) => { setLoading(true); try { const r = await fetch('/api/bedrock/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get', agentId }) }); const d = await r.json(); if (d.success && d.agent) { setSelectedAgent(d.agent as AgentDetail); setViewMode('detail'); } else setError(d.error || 'Failed'); } catch { setError('Failed'); } finally { setLoading(false); } }, [setSelectedAgent, setViewMode, setLoading, setError]);
  const handleCardClick = useCallback((id: string) => fetchAgentDetail(id), [fetchAgentDetail]);
  const handleUseInChat = useCallback((id: string) => { setSelectedAgentId(id); router.push(`/${locale}/genai?mode=agent`); }, [setSelectedAgentId, router, locale]);
  const handleEdit = useCallback(() => setViewMode('edit'), [setViewMode]);
  const handleSave = useCallback(async (data: UpdateAgentFormData) => { if (!selectedAgent) return; const r = await fetch('/api/bedrock/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', agentId: selectedAgent.agentId, ...data }) }); const d = await r.json(); if (!d.success) throw new Error(d.error || t('saveError')); await fetchAgentDetail(selectedAgent.agentId); await fetchAgents(); }, [selectedAgent, fetchAgentDetail, fetchAgents, t]);
  const handleDeleteConfirm = useCallback(async () => { if (!deleteConfirm) return; setDeleting(true); try { const r = await fetch('/api/bedrock/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', agentId: deleteConfirm.agentId }) }); const d = await r.json(); if (d.success) { setDeleteConfirm(null); setSelectedAgent(null); setViewMode('grid'); await fetchAgents(); } else setError(d.error || t('deleteError')); } catch { setError(t('deleteError')); } finally { setDeleting(false); } }, [deleteConfirm, setSelectedAgent, setViewMode, fetchAgents, setError, t]);
  const handleTemplateSelect = useCallback((cat: string) => { setCreateCategory(cat); setViewMode('create'); }, [setViewMode]);

  const handleCreateAgent = useCallback(async (data: UpdateAgentFormData) => {
    if (!createCategory) return;
    setCreationProgress({ category: createCategory, step: 'creating', message: t('progress.creating') });
    try {
      const r = await fetch('/api/bedrock/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', agentName: data.agentName, instruction: data.instruction, foundationModel: data.foundationModel, description: data.description, attachActionGroup: true }) });
      setCreationProgress({ category: createCategory, step: 'preparing', message: t('progress.preparing') });
      const d = await r.json();
      if (d.success) { setCreationProgress({ category: createCategory, step: 'completed', message: t('progress.completed') }); await fetchAgents(); setTimeout(() => { setCreationProgress(null); setCreateCategory(null); setViewMode('grid'); }, 1500); }
      else { setCreationProgress({ category: createCategory, step: 'error', message: d.error || t('createError') }); throw new Error(d.error || t('createError')); }
    } catch (err: any) { if (!creationProgress || creationProgress.step !== 'error') setCreationProgress({ category: createCategory, step: 'error', message: err?.message || t('createError') }); throw err; }
  }, [createCategory, setCreationProgress, fetchAgents, setViewMode, t, creationProgress]);

  const handleCancelCreate = useCallback(() => { setCreateCategory(null); setCreationProgress(null); setViewMode('grid'); }, [setCreationProgress, setViewMode]);
  const handleImport = useCallback(async (config: AgentConfig) => {
    setIsImporting(true);
    try { const r = await fetch('/api/bedrock/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', agentName: config.agentName, instruction: config.instruction, foundationModel: config.foundationModel, description: config.description, attachActionGroup: true }) }); const d = await r.json(); if (!d.success) throw new Error(d.error); await fetchAgents(); setViewMode('grid'); } finally { setIsImporting(false); }
  }, [fetchAgents, setViewMode]);
  const handleSharedConfigClick = useCallback(async (key: string) => { try { const r = await fetch('/api/bedrock/agent-sharing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'downloadSharedConfig', key }) }); const d = await r.json(); if (d.success) setPreviewConfig(d.config); } catch {} }, []);
  const handleScheduleClick = useCallback(async (sid: string) => { setSelectedScheduleId(sid); setExecutionsLoading(true); try { const r = await fetch('/api/bedrock/agent-schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getExecutionHistory', scheduleId: sid }) }); const d = await r.json(); if (d.success) setExecutions(d.executions || []); } catch {} finally { setExecutionsLoading(false); } }, []);

  const filteredAgents = filterAgents(agents, searchQuery, selectedCategory);
  const categoryKeys = Object.keys(AGENT_CATEGORY_MAP);
  const handleBackToGrid = useCallback(() => { setSelectedAgent(null); setViewMode('grid'); }, [setSelectedAgent, setViewMode]);
  const creatorInitialData: UpdateAgentFormData | null = createCategory && AGENT_CATEGORY_MAP[createCategory] ? { agentName: AGENT_CATEGORY_MAP[createCategory].agentNamePattern, description: AGENT_CATEGORY_MAP[createCategory].description, instruction: AGENT_CATEGORY_MAP[createCategory].instruction, foundationModel: AGENT_CATEGORY_MAP[createCategory].foundationModel } : null;
  const TABS = [{ key: 'agents' as const, label: t('tabs.agents') }, { key: 'teams' as const, label: '👥 Teams' }, { key: 'shared' as const, label: t('tabs.shared') }, { key: 'schedules' as const, label: t('tabs.schedules') }];

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('title')}</h1>

      {viewMode === 'grid' && (
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
          {TABS.map(tab => (<button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>{tab.label}</button>))}
          <button onClick={() => setViewMode('import')} className="ml-auto px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 border border-gray-300 dark:border-gray-600 rounded-md">📥 {t('sharing.import')}</button>
        </div>
      )}

      {viewMode === 'import' && <ImportDialog onImport={handleImport} onCancel={() => setViewMode('grid')} isImporting={isImporting} />}

      {previewConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg mx-4 shadow-xl w-full">
            <SharedConfigPreview config={previewConfig} onImport={async () => { await handleImport(previewConfig); setPreviewConfig(null); }} onCancel={() => setPreviewConfig(null)} />
          </div>
        </div>
      )}

      {viewMode === 'create' && createCategory && creatorInitialData && (
        <div><button onClick={handleCancelCreate} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4">← {t('title')}</button>
        <AgentCreator initialData={creatorInitialData} categoryKey={createCategory} onCreate={handleCreateAgent} onCancel={handleCancelCreate} isCreating={creationProgress !== null && creationProgress.step !== 'error'} progressMessage={creationProgress?.message} locale={locale} /></div>
      )}

      {viewMode === 'detail' && selectedAgent && (
        <div><button onClick={handleBackToGrid} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4">← {t('title')}</button>
        <AgentDetailPanel agent={selectedAgent} onClose={handleBackToGrid} onEdit={handleEdit} onDelete={() => setDeleteConfirm(selectedAgent)} onUseInChat={handleUseInChat} locale={locale} /></div>
      )}

      {viewMode === 'edit' && selectedAgent && (
        <div><button onClick={() => setViewMode('detail')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4">← {t('agentDetail')}</button>
        <AgentEditor agent={selectedAgent} onSave={handleSave} onCancel={() => setViewMode('detail')} locale={locale} /></div>
      )}

      {viewMode === 'grid' && activeTab === 'agents' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input type="text" placeholder={t('searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm" />
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm">
              <option value="all">{t('categoryAll')}</option>
              {categoryKeys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {isLoading && agents.length === 0 && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>}
          {!isLoading && error && <div className="text-center py-12"><p className="text-red-500 mb-4">{error}</p><button onClick={fetchAgents} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{t('retry')}</button></div>}
          {!isLoading && !error && filteredAgents.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">{filteredAgents.map(a => <AgentCard key={a.agentId} agent={a} onClick={handleCardClick} />)}</div>}
          {!isLoading && !error && agents.length > 0 && filteredAgents.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('noAgentsFound')}</p>}
          <AgentTemplateSection onSelectTemplate={handleTemplateSelect} locale={locale} />
        </>
      )}

      {viewMode === 'grid' && activeTab === 'teams' && (
        <div>
          {showTeamWizard && selectedTemplate ? (
            <div>
              <button
                onClick={() => setShowTeamWizard(false)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
              >
                ← Teams
              </button>
              <TeamCreateWizard
                template={selectedTemplate}
                isCreating={isCreatingTeam}
                onCancel={() => setShowTeamWizard(false)}
                onSubmit={async (config) => {
                  setIsCreatingTeam(true);
                  try {
                    const r = await fetch('/api/bedrock/agent-team', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'create',
                        ...config,
                      }),
                    });
                    const d = await r.json();
                    if (d.success) {
                      // Refresh teams list
                      const listRes = await fetch('/api/bedrock/agent-team', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'list' }),
                      });
                      const listData = await listRes.json();
                      if (listData.success) setTeams(listData.teams || []);
                      setShowTeamWizard(false);
                      setSelectedTemplate(null);
                    } else {
                      setError(d.error || 'Failed to create team');
                    }
                  } catch {
                    setError('Failed to create team');
                  } finally {
                    setIsCreatingTeam(false);
                  }
                }}
              />
            </div>
          ) : (
            <>
              <TemplateGallery
                onSelectTemplate={(template: AgentTeamTemplate) => {
                  setSelectedTemplate(template);
                  setShowTeamWizard(true);
                }}
              />
              <TeamsTab
                activeTab="teams"
                onTabChange={(tab) => {
                  if (tab === 'agents') setActiveTab('agents');
                  else if (tab === 'shared') setActiveTab('shared');
                  else if (tab === 'teams') setActiveTab('teams');
                }}
                onUseInChat={(teamId) => {
                  router.push(`/${locale}/genai?mode=agent`);
                }}
              />
            </>
          )}
        </div>
      )}

      {viewMode === 'grid' && activeTab === 'shared' && (
        <div>{sharedConfigs.length === 0 ? <p className="text-center text-gray-500 py-12">{t('sharing.noSharedConfigs')}</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{sharedConfigs.map(c => (
            <button key={c.key} onClick={() => handleSharedConfigClick(c.key)} className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{c.agentName}</h3>
              <p className="text-xs text-gray-500 mt-1">{c.uploadedAt ? new Date(c.uploadedAt).toLocaleDateString(locale) : ''}</p>
              <p className="text-xs text-gray-400 mt-1">{(c.size / 1024).toFixed(1)} KB</p>
            </button>
          ))}</div>
        )}</div>
      )}

      {viewMode === 'grid' && activeTab === 'schedules' && (
        <div>{schedules.length === 0 ? <p className="text-center text-gray-500 py-12">{t('schedule.noSchedules')}</p> : (
          <div className="space-y-3">{schedules.map(s => (
            <div key={s.scheduleId} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div><span className="font-medium text-sm text-gray-900 dark:text-gray-100">{s.description || s.scheduleId}</span><span className="ml-2 text-xs font-mono text-gray-500">{s.cronExpression}</span><span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{s.enabled ? 'ON' : 'OFF'}</span></div>
                <button onClick={() => handleScheduleClick(s.scheduleId)} className="text-xs text-blue-600 hover:underline">{t('schedule.executionHistory')}</button>
              </div>
              {selectedScheduleId === s.scheduleId && <div className="mt-3"><ExecutionHistoryList scheduleId={s.scheduleId} executions={executions} isLoading={executionsLoading} /></div>}
            </div>
          ))}</div>
        )}</div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('confirmDelete', { name: deleteConfirm.agentName })}</h3>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="px-4 py-2 text-sm text-gray-600">{t('cancel') || 'Cancel'}</button>
              <button onClick={handleDeleteConfirm} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">{deleting ? t('deleting') : t('deleteAgent')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
