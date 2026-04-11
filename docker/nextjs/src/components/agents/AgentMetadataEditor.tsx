'use client';

import { useCallback } from 'react';
import type { ToolProfile, TrustLevel, DataBoundary } from '@/types/multi-agent';

/**
 * AgentMetadataEditor — Tool Profile / Trust Level / Data Boundary 編集フォーム
 *
 * Agent作成・編集UIに埋め込み可能なフォームコンポーネント。
 * デザインドキュメントのワイヤーフレーム（bedrock-engineer参考のツール選択UI）に準拠。
 *
 * - Tool Profile: チェックボックス形式（カテゴリ別グループ化）
 * - Trust Level: ドロップダウン（user-safe / team-safe / admin-only）
 * - Data Boundary: ドロップダウン（public / team-scoped / user-scoped / sensitive-admin）
 * - admin-only 選択時のセキュリティ警告表示
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

// ===== Tool Profile definitions grouped by category =====

interface ToolProfileDef {
  value: ToolProfile;
  icon: string;
  label: string;
  description: string;
}

interface ToolCategory {
  key: string;
  label: string;
  tools: ToolProfileDef[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    key: 'access',
    label: '権限・アクセス系',
    tools: [
      {
        value: 'access-check',
        icon: '🔑',
        label: 'access-check',
        description: 'SID/UID/GID権限解決、User Access Table参照',
      },
      {
        value: 'kb-retrieve',
        icon: '📚',
        label: 'kb-retrieve',
        description: 'Bedrock KB検索（メタデータフィルタ付き）',
      },
    ],
  },
  {
    key: 'analysis',
    label: '分析・生成系',
    tools: [
      {
        value: 'vision-analyze',
        icon: '👁️',
        label: 'vision-analyze',
        description: '画像理解・分析（マルチモーダルモデル使用）',
      },
      {
        value: 'schedule-run',
        icon: '⏰',
        label: 'schedule-run',
        description: 'スケジュール実行（Background Agent）',
      },
    ],
  },
  {
    key: 'sharing',
    label: '共有・連携系',
    tools: [
      {
        value: 'share-agent',
        icon: '🔗',
        label: 'share-agent',
        description: 'S3バケット経由のAgent/Team共有',
      },
      {
        value: 'external-mcp:ontap-ops' as ToolProfile,
        icon: '🔌',
        label: 'external-mcp:ontap-ops',
        description: 'ONTAP操作（スナップショット、ボリューム状態）',
      },
      {
        value: 'external-mcp:identity-access' as ToolProfile,
        icon: '🔌',
        label: 'external-mcp:identity-access',
        description: 'Identity/Access確認（LDAP/ADグループ）',
      },
      {
        value: 'external-mcp:document-workflow' as ToolProfile,
        icon: '🔌',
        label: 'external-mcp:document-workflow',
        description: 'ドキュメントワークフロー（承認、チケット）',
      },
    ],
  },
];

// ===== Trust Level options =====

interface TrustLevelOption {
  value: TrustLevel;
  icon: string;
  label: string;
  description: string;
}

const TRUST_LEVEL_OPTIONS: TrustLevelOption[] = [
  { value: 'user-safe', icon: '👤', label: 'user-safe', description: '一般ユーザー操作可' },
  { value: 'team-safe', icon: '🔒', label: 'team-safe', description: 'チーム管理者操作可' },
  { value: 'admin-only', icon: '🛡️', label: 'admin-only', description: 'システム管理者のみ操作可' },
];

// ===== Data Boundary options =====

interface DataBoundaryOption {
  value: DataBoundary;
  icon: string;
  label: string;
  description: string;
}

const DATA_BOUNDARY_OPTIONS: DataBoundaryOption[] = [
  { value: 'public', icon: '🌐', label: 'public', description: '公開データのみ' },
  { value: 'team-scoped', icon: '👥', label: 'team-scoped', description: 'チーム範囲のデータ' },
  { value: 'user-scoped', icon: '🔑', label: 'user-scoped', description: 'ユーザー個人のデータ' },
  { value: 'sensitive-admin', icon: '⛔', label: 'sensitive-admin', description: '機密管理者データ' },
];

// ===== Component Props =====

export interface AgentMetadataEditorProps {
  /** 現在選択されているTool Profiles */
  toolProfiles: ToolProfile[];
  /** 現在のTrust Level */
  trustLevel: TrustLevel;
  /** 現在のData Boundary */
  dataBoundary: DataBoundary;
  /** Tool Profiles変更コールバック */
  onToolProfilesChange: (profiles: ToolProfile[]) => void;
  /** Trust Level変更コールバック */
  onTrustLevelChange: (level: TrustLevel) => void;
  /** Data Boundary変更コールバック */
  onDataBoundaryChange: (boundary: DataBoundary) => void;
  /** フォーム無効化 */
  disabled?: boolean;
  /** 現在のユーザーが管理者かどうか（admin-only操作制御用） */
  isAdmin?: boolean;
}

export function AgentMetadataEditor({
  toolProfiles,
  trustLevel,
  dataBoundary,
  onToolProfilesChange,
  onTrustLevelChange,
  onDataBoundaryChange,
  disabled = false,
  isAdmin = false,
}: AgentMetadataEditorProps) {
  // ===== Tool Profile toggle handler =====
  const handleToolToggle = useCallback(
    (profile: ToolProfile) => {
      if (disabled) return;
      const next = toolProfiles.includes(profile)
        ? toolProfiles.filter((p) => p !== profile)
        : [...toolProfiles, profile];
      onToolProfilesChange(next);
    },
    [toolProfiles, onToolProfilesChange, disabled],
  );

  // ===== Trust Level change handler =====
  const handleTrustLevelChange = useCallback(
    (value: string) => {
      if (disabled) return;
      // Reject admin-only selection by non-admin users (Req 6.5)
      if (value === 'admin-only' && !isAdmin) return;
      onTrustLevelChange(value as TrustLevel);
    },
    [onTrustLevelChange, disabled, isAdmin],
  );

  // ===== Data Boundary change handler =====
  const handleDataBoundaryChange = useCallback(
    (value: string) => {
      if (disabled) return;
      // Reject sensitive-admin selection by non-admin users
      if (value === 'sensitive-admin' && !isAdmin) return;
      onDataBoundaryChange(value as DataBoundary);
    },
    [onDataBoundaryChange, disabled, isAdmin],
  );

  const showAdminWarning = trustLevel === 'admin-only';

  return (
    <div className="space-y-6">
      {/* ===== Tool Profile Selection ===== */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          🛠️ ツール選択（Tool Profile）
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          利用可能なツールを選択してください
        </p>

        <div className="space-y-4">
          {TOOL_CATEGORIES.map((category) => (
            <fieldset
              key={category.key}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
            >
              <legend className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1">
                {category.label}
              </legend>
              <div className="space-y-2">
                {category.tools.map((tool) => (
                  <label
                    key={tool.value}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={toolProfiles.includes(tool.value)}
                      onChange={() => handleToolToggle(tool.value)}
                      disabled={disabled}
                      className="mt-0.5 rounded border-gray-300"
                      aria-label={`Tool profile: ${tool.label}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                        <span aria-hidden="true">{tool.icon}</span>
                        {tool.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {tool.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          ⚠️ 汎用シェル実行、無制限ファイル操作はセキュリティ上の理由で利用できません
        </p>
      </div>

      {/* ===== Trust Level & Data Boundary row ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Trust Level */}
        <div>
          <label
            htmlFor="trustLevel"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Trust Level
          </label>
          <select
            id="trustLevel"
            value={trustLevel}
            onChange={(e) => handleTrustLevelChange(e.target.value)}
            disabled={disabled}
            aria-label="Trust level"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          >
            {TRUST_LEVEL_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.value === 'admin-only' && !isAdmin}
              >
                {opt.icon} {opt.label} — {opt.description}
              </option>
            ))}
          </select>
        </div>

        {/* Data Boundary */}
        <div>
          <label
            htmlFor="dataBoundary"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Data Boundary
          </label>
          <select
            id="dataBoundary"
            value={dataBoundary}
            onChange={(e) => handleDataBoundaryChange(e.target.value)}
            disabled={disabled}
            aria-label="Data boundary"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          >
            {DATA_BOUNDARY_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.value === 'sensitive-admin' && !isAdmin}
              >
                {opt.icon} {opt.label} — {opt.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== Admin-only security warning ===== */}
      {showAdminWarning && (
        <div
          role="alert"
          className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
            <span aria-hidden="true">🛡️</span>
            admin-only Agent
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            このAgentはシステム管理者のみが操作できます。一般ユーザーによる編集・削除・チャットでの使用は拒否されます。
          </p>
        </div>
      )}

      {/* Non-admin attempting admin-only warning */}
      {!isAdmin && trustLevel === 'admin-only' && (
        <div
          role="alert"
          className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg"
        >
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            ⚠️ 管理者権限がないため、admin-only Agentの設定変更はできません。
          </p>
        </div>
      )}
    </div>
  );
}
