'use client';

import { useTranslations } from 'next-intl';
import { AgentMetadataBadges } from './AgentMetadataBadges';
import type {
  AgentTeamTemplate,
  CollaboratorRole,
  TrustLevel,
  DataBoundary,
  ToolProfile,
} from '@/types/multi-agent';

/**
 * TemplateGallery — 事前構成済み Team テンプレートの表示とワンクリック追加
 *
 * bedrock-engineer の「Browse the Collection → One-Click Addition」パターンを踏襲。
 * 各テンプレートカードに Collaborator 数、ルーティングモード、Trust Level を表示し、
 * 「+ 追加」ボタンで Team 作成ウィザードにテンプレートを渡す。
 *
 * Validates: Requirements 9.5
 */

// ===== Built-in templates =====

const BUILTIN_TEMPLATES: AgentTeamTemplate[] = [
  {
    schemaVersion: '1.0',
    teamName: 'Permission RAG Team',
    description: '権限フィルタリング付き RAG チーム。SID/UID/GID ベースのアクセス制御を維持しつつ、検索・分析・出力を分担。',
    routingMode: 'supervisor_router',
    autoRouting: false,
    supervisorInstruction: 'ユーザーの意図を検出し、適切な Collaborator にタスクをルーティングしてください。',
    supervisorModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    collaborators: [
      {
        role: 'permission-resolver' as CollaboratorRole,
        agentName: 'Permission Resolver',
        instruction: 'ユーザーの SID/UID/GID 権限を解決し、フィルタ条件を構築する',
        foundationModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
        toolProfiles: ['access-check'] as ToolProfile[],
        trustLevel: 'team-safe' as TrustLevel,
        dataBoundary: 'user-scoped' as DataBoundary,
      },
      {
        role: 'retrieval' as CollaboratorRole,
        agentName: 'Retrieval Agent',
        instruction: 'KB メタデータフィルタ付き検索を実行し、権限フィルタリングされた結果を返却する',
        foundationModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
        toolProfiles: ['kb-retrieve'] as ToolProfile[],
        trustLevel: 'team-safe' as TrustLevel,
        dataBoundary: 'user-scoped' as DataBoundary,
      },
      {
        role: 'analysis' as CollaboratorRole,
        agentName: 'Analysis Agent',
        instruction: 'フィルタ済みコンテキストを要約・分析する',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: [] as ToolProfile[],
        trustLevel: 'user-safe' as TrustLevel,
        dataBoundary: 'team-scoped' as DataBoundary,
      },
      {
        role: 'output' as CollaboratorRole,
        agentName: 'Output Agent',
        instruction: 'レポート・提案書等のドキュメントを生成する',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: [] as ToolProfile[],
        trustLevel: 'user-safe' as TrustLevel,
        dataBoundary: 'team-scoped' as DataBoundary,
      },
      {
        role: 'vision' as CollaboratorRole,
        agentName: 'Vision Agent',
        instruction: '画像理解・分析を実行する',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: ['vision-analyze'] as ToolProfile[],
        trustLevel: 'user-safe' as TrustLevel,
        dataBoundary: 'team-scoped' as DataBoundary,
      },
    ],
    exportedAt: new Date().toISOString(),
  },
  {
    schemaVersion: '1.0',
    teamName: 'Analysis Team',
    description: '検索結果の深い分析に特化したチーム。Permission Resolver + Retrieval + Analysis の 3 エージェント構成。',
    routingMode: 'supervisor',
    autoRouting: false,
    supervisorInstruction: 'ユーザーのクエリを分析し、段階的にタスクを分解して各 Collaborator に指示してください。',
    supervisorModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    collaborators: [
      {
        role: 'permission-resolver' as CollaboratorRole,
        agentName: 'Permission Resolver',
        instruction: 'ユーザーの SID/UID/GID 権限を解決する',
        foundationModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
        toolProfiles: ['access-check'] as ToolProfile[],
        trustLevel: 'team-safe' as TrustLevel,
        dataBoundary: 'user-scoped' as DataBoundary,
      },
      {
        role: 'retrieval' as CollaboratorRole,
        agentName: 'Retrieval Agent',
        instruction: 'KB メタデータフィルタ付き検索を実行する',
        foundationModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
        toolProfiles: ['kb-retrieve'] as ToolProfile[],
        trustLevel: 'team-safe' as TrustLevel,
        dataBoundary: 'user-scoped' as DataBoundary,
      },
      {
        role: 'analysis' as CollaboratorRole,
        agentName: 'Analysis Agent',
        instruction: 'フィルタ済みコンテキストを深く分析し、インサイトを抽出する',
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        toolProfiles: [] as ToolProfile[],
        trustLevel: 'user-safe' as TrustLevel,
        dataBoundary: 'team-scoped' as DataBoundary,
      },
    ],
    exportedAt: new Date().toISOString(),
  },
  {
    schemaVersion: '1.0',
    teamName: 'Custom Team',
    description: 'ゼロから構成するカスタムチーム。テンプレートなしで自由に Collaborator を追加・設定。',
    routingMode: 'supervisor_router',
    autoRouting: false,
    supervisorInstruction: '',
    supervisorModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    collaborators: [],
    exportedAt: new Date().toISOString(),
  },
];

// ===== Props =====

export interface TemplateGalleryProps {
  /** Called when user clicks "+ 追加" on a template */
  onSelectTemplate: (template: AgentTeamTemplate) => void;
  /** Additional templates loaded from API (e.g. S3 shared templates) */
  additionalTemplates?: AgentTeamTemplate[];
}

export function TemplateGallery({ onSelectTemplate, additionalTemplates }: TemplateGalleryProps) {
  const t = useTranslations('templateGallery');
  const allTemplates = [...BUILTIN_TEMPLATES, ...(additionalTemplates ?? [])];

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {t('title')}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('description')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allTemplates.map((tmpl, idx) => {
          const isCustom = tmpl.collaborators.length === 0;
          const allTools = Array.from(
            new Set(tmpl.collaborators.flatMap((c) => c.toolProfiles))
          );
          const highestTrust: TrustLevel | undefined = (() => {
            const levels = tmpl.collaborators.map((c) => c.trustLevel);
            if (levels.includes('admin-only')) return 'admin-only';
            if (levels.includes('team-safe')) return 'team-safe';
            if (levels.includes('user-safe')) return 'user-safe';
            return undefined;
          })();

          return (
            <div
              key={`${tmpl.teamName}-${idx}`}
              className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">
                {tmpl.teamName}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 flex-1">
                {tmpl.description}
              </p>

              {/* Metadata */}
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {isCustom ? (
                  <span>🛠️ {t('customBuild')}</span>
                ) : (
                  <span>🤖 {tmpl.collaborators.length} agents · 📊 {tmpl.routingMode}</span>
                )}
              </div>

              {/* Badges */}
              {!isCustom && (
                <div className="mb-3">
                  <AgentMetadataBadges
                    toolProfiles={allTools}
                    trustLevel={highestTrust}
                    compact
                  />
                </div>
              )}

              {/* Action button */}
              <button
                onClick={() => onSelectTemplate(tmpl)}
                className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 mt-auto"
              >
                {isCustom ? t('createButton') : t('addButton')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
