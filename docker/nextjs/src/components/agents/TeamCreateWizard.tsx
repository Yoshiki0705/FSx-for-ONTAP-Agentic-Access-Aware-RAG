'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AgentMetadataBadges } from './AgentMetadataBadges';
import type {
  AgentTeamConfig,
  CollaboratorConfig,
  CollaboratorRole,
  RoutingMode,
  TrustLevel,
  DataBoundary,
  ToolProfile,
  AgentTeamTemplate,
} from '@/types/multi-agent';

/**
 * TeamCreateWizard — 5 ステップの Team 作成ウィザード
 *
 * Step 1: Team 名・説明入力
 * Step 2: Collaborator カスタマイズ（名前、instruction、モデル、Trust Level、Data Boundary）
 * Step 3: ツール選択（チェックボックス形式）
 * Step 4: ルーティングモード選択
 * Step 5: 確認画面（推定コスト表示）
 *
 * Validates: Requirements 6.4, 14.1
 */

// ===== Constants =====

const WIZARD_STEPS = [
  { key: 'teamInfo', icon: '📝' },
  { key: 'collaborators', icon: '🤖' },
  { key: 'tools', icon: '🛠️' },
  { key: 'routing', icon: '🧭' },
  { key: 'confirm', icon: '✅' },
] as const;

const AVAILABLE_TOOLS: { profile: ToolProfile; label: string; descKey: string; categoryKey: string }[] = [
  { profile: 'access-check', label: 'access-check', descKey: 'access-check', categoryKey: 'permission' },
  { profile: 'kb-retrieve', label: 'kb-retrieve', descKey: 'kb-retrieve', categoryKey: 'permission' },
  { profile: 'vision-analyze', label: 'vision-analyze', descKey: 'vision-analyze', categoryKey: 'analysis' },
  { profile: 'schedule-run', label: 'schedule-run', descKey: 'schedule-run', categoryKey: 'analysis' },
  { profile: 'share-agent', label: 'share-agent', descKey: 'share-agent', categoryKey: 'sharing' },
];

const FOUNDATION_MODELS = [
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'amazon.nova-pro-v1:0',
  'amazon.nova-lite-v1:0',
];

const COLLABORATOR_ROLES: { role: CollaboratorRole; label: string; defaultInstruction: string }[] = [
  { role: 'permission-resolver', label: 'Permission Resolver', defaultInstruction: 'ユーザーのSID/UID/GID権限を解決する' },
  { role: 'retrieval', label: 'Retrieval Agent', defaultInstruction: 'KBメタデータフィルタ付き検索を実行する' },
  { role: 'analysis', label: 'Analysis Agent', defaultInstruction: 'コンテキスト要約・推論を実行する' },
  { role: 'output', label: 'Output Agent', defaultInstruction: 'ドキュメント生成を実行する' },
  { role: 'vision', label: 'Vision Agent', defaultInstruction: '画像理解・分析を実行する' },
];

const TRUST_LEVELS: TrustLevel[] = ['user-safe', 'team-safe', 'admin-only'];
const DATA_BOUNDARIES: DataBoundary[] = ['public', 'team-scoped', 'user-scoped', 'sensitive-admin'];

/** Per-request cost estimate (rough) per collaborator */
const COST_PER_COLLABORATOR_USD = 0.025;

// ===== Collaborator draft type =====

interface CollaboratorDraft {
  agentName: string;
  role: CollaboratorRole;
  instruction: string;
  foundationModel: string;
  trustLevel: TrustLevel;
  dataBoundary: DataBoundary;
  toolProfiles: ToolProfile[];
}

// ===== Props =====

export interface TeamCreateWizardProps {
  /** Pre-fill from a template */
  template?: AgentTeamTemplate;
  onSubmit: (config: Omit<AgentTeamConfig, 'teamId' | 'supervisorAgentId' | 'supervisorAliasId' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isCreating?: boolean;
}

export function TeamCreateWizard({ template, onSubmit, onCancel, isCreating }: TeamCreateWizardProps) {
  const t = useTranslations('teamWizard');
  const [step, setStep] = useState(0);

  // Step 1 state
  const [teamName, setTeamName] = useState(template?.teamName ?? '');
  const [description, setDescription] = useState(template?.description ?? '');

  // Step 2 state — collaborator drafts
  const [collaborators, setCollaborators] = useState<CollaboratorDraft[]>(() => {
    if (template?.collaborators) {
      return template.collaborators.map((c) => ({
        agentName: c.agentName,
        role: c.role,
        instruction: c.instruction,
        foundationModel: c.foundationModel,
        trustLevel: c.trustLevel,
        dataBoundary: c.dataBoundary,
        toolProfiles: [...c.toolProfiles],
      }));
    }
    return COLLABORATOR_ROLES.slice(0, 3).map((r) => ({
      agentName: r.label,
      role: r.role,
      instruction: r.defaultInstruction,
      foundationModel: FOUNDATION_MODELS[0],
      trustLevel: 'team-safe' as TrustLevel,
      dataBoundary: 'user-scoped' as DataBoundary,
      toolProfiles: [] as ToolProfile[],
    }));
  });

  // Step 2 — active collaborator index for editing
  const [activeCollabIdx, setActiveCollabIdx] = useState(0);

  // Step 4 state
  const [routingMode, setRoutingMode] = useState<RoutingMode>(template?.routingMode ?? 'supervisor_router');
  const [autoRouting, setAutoRouting] = useState(template?.autoRouting ?? false);

  // ===== Navigation =====

  const canNext = useCallback((): boolean => {
    if (step === 0) return teamName.trim().length > 0;
    if (step === 1) return collaborators.length > 0 && collaborators.every((c) => c.agentName.trim().length > 0);
    return true;
  }, [step, teamName, collaborators]);

  const next = () => { if (canNext() && step < WIZARD_STEPS.length - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  // ===== Collaborator helpers =====

  const updateCollaborator = (idx: number, patch: Partial<CollaboratorDraft>) => {
    setCollaborators((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const addCollaborator = () => {
    const unused = COLLABORATOR_ROLES.find((r) => !collaborators.some((c) => c.role === r.role));
    if (!unused) return;
    setCollaborators((prev) => [
      ...prev,
      {
        agentName: unused.label,
        role: unused.role,
        instruction: unused.defaultInstruction,
        foundationModel: FOUNDATION_MODELS[0],
        trustLevel: 'user-safe',
        dataBoundary: 'team-scoped',
        toolProfiles: [],
      },
    ]);
    setActiveCollabIdx(collaborators.length);
  };

  const removeCollaborator = (idx: number) => {
    if (collaborators.length <= 1) return;
    setCollaborators((prev) => prev.filter((_, i) => i !== idx));
    setActiveCollabIdx(Math.max(0, activeCollabIdx - 1));
  };

  const toggleTool = (idx: number, profile: ToolProfile) => {
    const collab = collaborators[idx];
    const has = collab.toolProfiles.includes(profile);
    updateCollaborator(idx, {
      toolProfiles: has
        ? collab.toolProfiles.filter((p) => p !== profile)
        : [...collab.toolProfiles, profile],
    });
  };

  // ===== Submit =====

  const handleSubmit = () => {
    const collabConfigs: CollaboratorConfig[] = collaborators.map((c) => ({
      agentId: '',
      agentAliasId: '',
      agentName: c.agentName,
      role: c.role,
      foundationModel: c.foundationModel,
      toolProfiles: c.toolProfiles,
      trustLevel: c.trustLevel,
      dataBoundary: c.dataBoundary,
      instruction: c.instruction,
    }));

    onSubmit({
      teamName,
      description,
      routingMode,
      autoRouting,
      collaborators: collabConfigs,
    });
  };

  const estimatedCost = collaborators.length * COST_PER_COLLABORATOR_USD;

  // ===== Active collaborator shorthand =====
  const ac = collaborators[activeCollabIdx] as CollaboratorDraft | undefined;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {WIZARD_STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i === step
                  ? 'bg-blue-600 text-white'
                  : i < step
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
              }`}
            >
              {i < step ? '✓' : s.icon}
            </div>
            <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">{t(`steps.${s.key}`)}</span>
            {i < WIZARD_STEPS.length - 1 && (
              <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* ===== Step 1: Team Info ===== */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('teamInfo.title')}</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('teamInfo.name')}</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Permission RAG Team"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('teamInfo.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Team の目的・用途を記述..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
        </div>
      )}

      {/* ===== Step 2: Collaborator Customization ===== */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('collaborators.title')}</h2>
            {collaborators.length < COLLABORATOR_ROLES.length && (
              <button onClick={addCollaborator} className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-900">
                {t('buttons.add')}
              </button>
            )}
          </div>

          {/* Collaborator selector tabs */}
          <div className="flex gap-1 flex-wrap">
            {collaborators.map((c, i) => (
              <button
                key={i}
                onClick={() => setActiveCollabIdx(i)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  i === activeCollabIdx
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {c.agentName || c.role}
              </button>
            ))}
          </div>

          {/* Active collaborator editor */}
          {ac && (
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Role: {ac.role}</span>
                {collaborators.length > 1 && (
                  <button onClick={() => removeCollaborator(activeCollabIdx)} className="text-xs text-red-500 hover:underline">
                    {t('buttons.delete')}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('collaborators.agentName')}</label>
                <input
                  type="text"
                  value={ac.agentName}
                  onChange={(e) => updateCollaborator(activeCollabIdx, { agentName: e.target.value })}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('collaborators.instruction')}</label>
                <textarea
                  value={ac.instruction}
                  onChange={(e) => updateCollaborator(activeCollabIdx, { instruction: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('collaborators.foundationModel')}</label>
                  <select
                    value={ac.foundationModel}
                    onChange={(e) => updateCollaborator(activeCollabIdx, { foundationModel: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs"
                  >
                    {FOUNDATION_MODELS.map((m) => (
                      <option key={m} value={m}>{m.split('.').pop()?.replace(/:.*/, '') ?? m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('collaborators.trustLevel')}</label>
                  <select
                    value={ac.trustLevel}
                    onChange={(e) => updateCollaborator(activeCollabIdx, { trustLevel: e.target.value as TrustLevel })}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs"
                  >
                    {TRUST_LEVELS.map((tl) => <option key={tl} value={tl}>{tl}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('collaborators.dataBoundary')}</label>
                  <select
                    value={ac.dataBoundary}
                    onChange={(e) => updateCollaborator(activeCollabIdx, { dataBoundary: e.target.value as DataBoundary })}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs"
                  >
                    {DATA_BOUNDARIES.map((db) => <option key={db} value={db}>{db}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Step 3: Tool Selection ===== */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">🛠️ {t('tools.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('toolSelectDesc')}
          </p>

          {collaborators.map((collab, cIdx) => (
            <div key={cIdx} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                {collab.agentName} ({collab.role})
              </h3>
              <div className="space-y-2">
                {AVAILABLE_TOOLS.map((tool) => (
                  <label
                    key={tool.profile}
                    className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={collab.toolProfiles.includes(tool.profile)}
                      onChange={() => toggleTool(cIdx, tool.profile)}
                      className="mt-0.5 rounded border-gray-300"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tool.label}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t(`tools.descriptions.${tool.descKey}`)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('toolSecurityNote')}
          </p>
        </div>
      )}

      {/* ===== Step 4: Routing Mode ===== */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">🧭 {t('routing.title')}</h2>

          <div className="space-y-3">
            {([
              { mode: 'supervisor_router' as RoutingMode, label: t('routing.supervisorRouter'), desc: t('routing.supervisorRouterDesc') },
              { mode: 'supervisor' as RoutingMode, label: t('routing.supervisor'), desc: t('routing.supervisorDesc') },
            ]).map((opt) => (
              <label
                key={opt.mode}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  routingMode === opt.mode
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="routingMode"
                  value={opt.mode}
                  checked={routingMode === opt.mode}
                  onChange={() => setRoutingMode(opt.mode)}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={autoRouting}
              onChange={(e) => setAutoRouting(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('autoRouting')}
            </span>
          </label>
        </div>
      )}

      {/* ===== Step 5: Confirmation ===== */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">✅ {t('confirm.title')}</h2>

          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div>
              <span className="text-xs text-gray-500">{t('teamInfo.name')}</span>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{teamName}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">{t('teamInfo.description')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{description || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">{t('routing.title')}</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {routingMode} {autoRouting && '(自動)'}
              </p>
            </div>

            <div>
              <span className="text-xs text-gray-500">Collaborators ({collaborators.length})</span>
              <div className="mt-2 space-y-2">
                {collaborators.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.agentName}</span>
                    <AgentMetadataBadges
                      toolProfiles={c.toolProfiles}
                      trustLevel={c.trustLevel}
                      dataBoundary={c.dataBoundary}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Cost estimate */}
            <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">💰 {t('confirm.costEstimate')}</span>
              <p className="text-lg font-bold text-amber-800 dark:text-amber-200 mt-1">
                ~${estimatedCost.toFixed(3)}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {collaborators.length} Collaborators × ~${COST_PER_COLLABORATOR_USD}/agent
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== Footer navigation ===== */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={step === 0 ? onCancel : prev}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          disabled={isCreating}
        >
          {step === 0 ? t('buttons.cancel') : t('buttons.back')}
        </button>

        {step < WIZARD_STEPS.length - 1 ? (
          <button
            onClick={next}
            disabled={!canNext()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('buttons.next')}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isCreating || !canNext()}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isCreating ? '...' : t('buttons.create')}
          </button>
        )}
      </div>
    </div>
  );
}
