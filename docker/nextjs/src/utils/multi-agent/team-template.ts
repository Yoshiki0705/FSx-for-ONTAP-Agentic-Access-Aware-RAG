/**
 * Team Config Export/Import Utility
 *
 * AgentTeamConfig ↔ AgentTeamTemplate JSON の変換ユーティリティ。
 *
 * - Export: AgentTeamConfig → AgentTeamTemplate（シークレット除外）
 * - Import: AgentTeamTemplate → AgentTeamConfig（名前重複解決付き）
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6, 18.7
 */

import type {
  AgentTeamConfig,
  AgentTeamTemplate,
  CollaboratorConfig,
  RoutingMode,
} from '@/types/multi-agent';

// ===== Secret Exclusion Patterns (Requirement 9.6, 18.7) =====

/** IAM Role ARN パターン */
const IAM_ROLE_ARN_PATTERN = /arn:aws:iam::\d{12}:role\/[\w+=,.@\-/]+/g;

/** 汎用 ARN パターン */
const GENERIC_ARN_PATTERN = /arn:aws:[a-z0-9\-]+:[a-z0-9\-]*:\d{12}:[a-zA-Z0-9\-_/:.]+/g;

/** API Key / Secret パターン */
const API_KEY_PATTERN =
  /(?:api[_-]?key|secret|password|token|credential)["\s:=]+["']?([A-Za-z0-9+/=_\-]{20,})["']?/gi;

/** 内部 AWS エンドポイント URL パターン */
const INTERNAL_ENDPOINT_PATTERN =
  /https?:\/\/[a-z0-9\-]+\.(?:execute-api|lambda|bedrock-agent|bedrock-runtime)\.[a-z0-9\-]+\.amazonaws\.com[^\s"]*/gi;

/** シークレットとみなすキー名 */
const SENSITIVE_KEYS = new Set([
  'iamRoleArn',
  'roleArn',
  'apiKey',
  'secretKey',
  'password',
  'credentials',
  'accessKeyId',
  'secretAccessKey',
  'sessionToken',
]);

// ===== Secret Exclusion =====

/**
 * 文字列からシークレットパターンを除去する。
 */
function maskSecretString(value: string): string {
  let masked = value;
  masked = masked.replace(IAM_ROLE_ARN_PATTERN, '');
  masked = masked.replace(INTERNAL_ENDPOINT_PATTERN, '');
  masked = masked.replace(API_KEY_PATTERN, '');
  masked = masked.replace(GENERIC_ARN_PATTERN, '');
  return masked;
}

/**
 * オブジェクトの全文字列値から再帰的にシークレット情報を除去する。
 *
 * - 文字列: シークレットパターンをマスク
 * - 配列: 各要素を再帰処理
 * - オブジェクト: SENSITIVE_KEYS に該当するキーは値を空文字に置換、
 *   それ以外は再帰処理
 * - その他: そのまま返却
 *
 * Requirement 9.6, 18.7
 */
export function excludeSecrets(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return maskSecretString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(excludeSecrets);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        result[key] = '';
      } else {
        result[key] = excludeSecrets(value);
      }
    }
    return result;
  }
  return obj;
}

// ===== Name Deduplication (Requirement 9.4) =====

/**
 * 名前リストを既存名と衝突しないように重複解決する。
 *
 * 各名前が existingNames に含まれる場合、"-2", "-3", ... のサフィックスを付与して
 * 一意性を確保する。names 内の相互重複も解決する。
 *
 * @param names - 重複解決対象の名前リスト
 * @param existingNames - 既存の名前リスト（衝突チェック対象）
 * @returns 全て一意な名前リスト
 */
export function deduplicateNames(
  names: string[],
  existingNames: string[],
): string[] {
  const usedNames = new Set(existingNames);
  const result: string[] = [];

  for (const name of names) {
    let candidate = name;
    let suffix = 2;

    while (usedNames.has(candidate)) {
      candidate = `${name}-${suffix}`;
      suffix++;
    }

    usedNames.add(candidate);
    result.push(candidate);
  }

  return result;
}

// ===== Export: AgentTeamConfig → AgentTeamTemplate =====

/**
 * AgentTeamConfig を AgentTeamTemplate JSON 形式に変換する。
 *
 * 1. Agent ID、Alias ID 等の環境固有データを除外
 * 2. シークレット情報（IAMロールARN、APIキー等）を除外
 * 3. schemaVersion, exportedAt, exportedBy を付与
 *
 * Requirement 9.1, 9.2, 9.6
 *
 * @param config - 変換元の AgentTeamConfig
 * @param exportedBy - エクスポート実行者（オプション）
 * @returns シークレット除外済みの AgentTeamTemplate
 */
export function exportTeamConfig(
  config: AgentTeamConfig,
  exportedBy?: string,
): AgentTeamTemplate {
  const template: AgentTeamTemplate = {
    schemaVersion: '1.0',
    teamName: config.teamName,
    description: config.description,
    routingMode: config.routingMode,
    autoRouting: config.autoRouting,
    supervisorInstruction: '',
    supervisorModel: '',
    collaborators: config.collaborators.map((c) => ({
      role: c.role,
      agentName: c.agentName,
      instruction: c.instruction ?? '',
      foundationModel: c.foundationModel,
      toolProfiles: [...c.toolProfiles],
      trustLevel: c.trustLevel,
      dataBoundary: c.dataBoundary,
    })),
    exportedAt: new Date().toISOString(),
    exportedBy,
  };

  // テンプレート全体にシークレット除外を適用
  return excludeSecrets(template) as AgentTeamTemplate;
}

// ===== Import: AgentTeamTemplate → AgentTeamConfig =====

/**
 * AgentTeamTemplate JSON を AgentTeamConfig に変換する。
 *
 * 1. 新しい teamId を生成（プレースホルダー）
 * 2. 各 Collaborator に新しい agentId, agentAliasId プレースホルダーを生成
 * 3. Collaborator 名を既存名と衝突しないように重複解決
 *
 * Requirement 9.3, 9.4
 *
 * @param template - インポート対象の AgentTeamTemplate
 * @param existingNames - 既存の Collaborator 名リスト（重複チェック用）
 * @returns 新しい AgentTeamConfig
 */
export function importTeamTemplate(
  template: AgentTeamTemplate,
  existingNames: string[],
): AgentTeamConfig {
  const now = new Date().toISOString();

  // Collaborator 名の重複解決
  const originalNames = template.collaborators.map((c) => c.agentName);
  const deduplicatedCollaboratorNames = deduplicateNames(originalNames, existingNames);

  const collaborators: CollaboratorConfig[] = template.collaborators.map(
    (c, index) => ({
      agentId: `pending-agent-${index}`,
      agentAliasId: `pending-alias-${index}`,
      agentName: deduplicatedCollaboratorNames[index],
      role: c.role,
      foundationModel: c.foundationModel,
      toolProfiles: [...c.toolProfiles],
      trustLevel: c.trustLevel,
      dataBoundary: c.dataBoundary,
      instruction: c.instruction || undefined,
    }),
  );

  return {
    teamId: `pending-team-${Date.now()}`,
    teamName: template.teamName,
    description: template.description,
    supervisorAgentId: 'pending-supervisor',
    supervisorAliasId: 'pending-supervisor-alias',
    routingMode: template.routingMode,
    autoRouting: template.autoRouting,
    collaborators,
    createdAt: now,
    updatedAt: now,
  };
}
