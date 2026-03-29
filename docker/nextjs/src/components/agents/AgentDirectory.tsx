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
import type { AgentDetail, UpdateAgentFormData } from '@/types/agent-directory';

interface AgentDirectoryProps {
  locale: string;
  initialCreateCategory?: string;
}

export function AgentDirectory({ locale, initialCreateCategory }: AgentDirectoryProps) {
  const t = useTranslations('agentDirectory');
  const router = useRouter();
  const { setSelectedAgentId } = useAgentStore();

  const {
    agents, selectedAgent, searchQuery, selectedCategory,
    viewMode, isLoading, error, creationProgress,
    setAgents, setSelectedAgent, setSearchQuery, setSelectedCategory,
    setViewMode, setLoading, setError, setCreationProgress,
  } = useAgentDirectoryStore();

  const [deleteConfirm, setDeleteConfirm] = useState<AgentDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Track which template category is being configured for creation
  const [createCategory, setCreateCategory] = useState<string | null>(null);

  // Auto-open creation form when navigated with ?create= parameter
  useEffect(() => {
    if (initialCreateCategory && AGENT_CATEGORY_MAP[initialCreateCategory]) {
      setCreateCategory(initialCreateCategory);
      setViewMode('create');
    }
  }, [initialCreateCategory, setViewMode]);

  // Fetch agent list on mount
  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.agents)) {
        setAgents(data.agents);
      } else {
        setError(data.error || t('loadError'));
      }
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [setAgents, setLoading, setError, t]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // Fetch agent detail
  const fetchAgentDetail = useCallback(async (agentId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', agentId }),
      });
      const data = await res.json();
      if (data.success && data.agent) {
        setSelectedAgent(data.agent as AgentDetail);
        setViewMode('detail');
      } else {
        setError(data.error || 'Failed to load agent detail');
      }
    } catch {
      setError('Failed to load agent detail');
    } finally {
      setLoading(false);
    }
  }, [setSelectedAgent, setViewMode, setLoading, setError]);

  const handleCardClick = useCallback((agentId: string) => {
    fetchAgentDetail(agentId);
  }, [fetchAgentDetail]);

  const handleUseInChat = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    router.push(`/${locale}/genai?mode=agent`);
  }, [setSelectedAgentId, router, locale]);

  const handleEdit = useCallback(() => { setViewMode('edit'); }, [setViewMode]);

  const handleSave = useCallback(async (data: UpdateAgentFormData) => {
    if (!selectedAgent) return;
    const res = await fetch('/api/bedrock/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', agentId: selectedAgent.agentId, ...data }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || t('saveError'));
    await fetchAgentDetail(selectedAgent.agentId);
    await fetchAgents();
  }, [selectedAgent, fetchAgentDetail, fetchAgents, t]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', agentId: deleteConfirm.agentId }),
      });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        setSelectedAgent(null);
        setViewMode('grid');
        await fetchAgents();
      } else {
        setError(data.error || t('deleteError'));
      }
    } catch {
      setError(t('deleteError'));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirm, setSelectedAgent, setViewMode, fetchAgents, setError, t]);

  // Template click → open creation form with pre-filled values
  const handleTemplateSelect = useCallback((category: string) => {
    setCreateCategory(category);
    setViewMode('create');
  }, [setViewMode]);

  // Actual creation from the form
  const handleCreateAgent = useCallback(async (data: UpdateAgentFormData) => {
    if (!createCategory) return;
    setCreationProgress({ category: createCategory, step: 'creating', message: t('progress.creating') });
    try {
      const res = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          agentName: data.agentName,
          instruction: data.instruction,
          foundationModel: data.foundationModel,
          description: data.description,
          attachActionGroup: true,
        }),
      });
      setCreationProgress({ category: createCategory, step: 'preparing', message: t('progress.preparing') });
      const result = await res.json();
      if (result.success) {
        setCreationProgress({ category: createCategory, step: 'completed', message: t('progress.completed') });
        await fetchAgents();
        // Return to grid after short delay
        setTimeout(() => {
          setCreationProgress(null);
          setCreateCategory(null);
          setViewMode('grid');
        }, 1500);
      } else {
        setCreationProgress({ category: createCategory, step: 'error', message: result.error || t('createError') });
        throw new Error(result.error || t('createError'));
      }
    } catch (err: any) {
      if (!creationProgress || creationProgress.step !== 'error') {
        setCreationProgress({ category: createCategory, step: 'error', message: err?.message || t('createError') });
      }
      throw err;
    }
  }, [createCategory, setCreationProgress, fetchAgents, setViewMode, t, creationProgress]);

  const handleCancelCreate = useCallback(() => {
    setCreateCategory(null);
    setCreationProgress(null);
    setViewMode('grid');
  }, [setCreationProgress, setViewMode]);

  const filteredAgents = filterAgents(agents, searchQuery, selectedCategory);
  const categoryKeys = Object.keys(AGENT_CATEGORY_MAP);

  const handleBackToGrid = useCallback(() => {
    setSelectedAgent(null);
    setViewMode('grid');
  }, [setSelectedAgent, setViewMode]);

  // Build initial data for creator from template
  const creatorInitialData: UpdateAgentFormData | null = createCategory && AGENT_CATEGORY_MAP[createCategory]
    ? {
        agentName: AGENT_CATEGORY_MAP[createCategory].agentNamePattern,
        description: AGENT_CATEGORY_MAP[createCategory].description,
        instruction: AGENT_CATEGORY_MAP[createCategory].instruction,
        foundationModel: AGENT_CATEGORY_MAP[createCategory].foundationModel,
      }
    : null;

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{t('title')}</h1>

      {/* Create View */}
      {viewMode === 'create' && createCategory && creatorInitialData && (
        <div>
          <button onClick={handleCancelCreate} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-flex items-center gap-1">
            ← {t('title')}
          </button>
          <AgentCreator
            initialData={creatorInitialData}
            categoryKey={createCategory}
            onCreate={handleCreateAgent}
            onCancel={handleCancelCreate}
            isCreating={creationProgress !== null && creationProgress.step !== 'error'}
            progressMessage={creationProgress?.message}
            locale={locale}
          />
        </div>
      )}

      {/* Detail View */}
      {viewMode === 'detail' && selectedAgent && (
        <div>
          <button onClick={handleBackToGrid} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-flex items-center gap-1">
            ← {t('title')}
          </button>
          <AgentDetailPanel
            agent={selectedAgent}
            onClose={handleBackToGrid}
            onEdit={handleEdit}
            onDelete={() => setDeleteConfirm(selectedAgent)}
            onUseInChat={handleUseInChat}
            locale={locale}
          />
        </div>
      )}

      {/* Edit View */}
      {viewMode === 'edit' && selectedAgent && (
        <div>
          <button onClick={() => setViewMode('detail')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-flex items-center gap-1">
            ← {t('agentDetail')}
          </button>
          <AgentEditor
            agent={selectedAgent}
            onSave={handleSave}
            onCancel={() => setViewMode('detail')}
            locale={locale}
          />
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
              aria-label={t('searchPlaceholder')}
            />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
              aria-label="Category filter"
            >
              <option value="all">{t('categoryAll')}</option>
              {categoryKeys.map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>

          {isLoading && agents.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button onClick={fetchAgents} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                {t('retry')}
              </button>
            </div>
          )}

          {!isLoading && !error && filteredAgents.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {filteredAgents.map(agent => (
                <AgentCard key={agent.agentId} agent={agent} onClick={handleCardClick} />
              ))}
            </div>
          )}

          {!isLoading && !error && agents.length > 0 && filteredAgents.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('noAgentsFound')}</p>
          )}

          <AgentTemplateSection
            onSelectTemplate={handleTemplateSelect}
            locale={locale}
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('confirmDelete', { name: deleteConfirm.agentName })}</h3>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                {t('cancel' as any) || 'Cancel'}
              </button>
              <button onClick={handleDeleteConfirm} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting ? t('deleting') : t('deleteAgent')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
