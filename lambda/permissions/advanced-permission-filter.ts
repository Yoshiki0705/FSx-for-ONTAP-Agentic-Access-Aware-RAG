/**
 * AdvancedPermissionFilter — 拡張権限フィルタリング
 *
 * 既存SIDフィルタリング + 時間ベースアクセス制御 + 監査ログ記録を統合する。
 * enableAdvancedPermissions=false の場合は既存SIDフィルタリングのみ実行。
 */

import { AccessSchedule, evaluateSchedule } from './schedule-evaluator';
import { AuditDocumentEntry, createAuditRecord, writeAuditLog } from './audit-logger';

export interface AdvancedFilterConfig {
  enableAdvancedPermissions: boolean;
  auditTableName?: string;
  defaultTtlDays?: number;
}

export interface ParsedDocument {
  content: string;
  s3Uri: string;
  score?: number;
  metadata: Record<string, unknown>;
}

export interface AdvancedFilterResult {
  allowed: ParsedDocument[];
  denied: ParsedDocument[];
  filterLog: Record<string, unknown>;
  auditId?: string;
}

/**
 * SIDアクセスチェック（既存ロジックと同一）
 */
export function checkSIDAccess(
  userSIDs: string[],
  documentSIDs: string[]
): boolean {
  if (!userSIDs.length || !documentSIDs.length) return false;
  return documentSIDs.some(sid => userSIDs.includes(sid));
}

/**
 * 拡張権限フィルタリングを実行する
 */
export async function advancedPermissionFilter(
  userId: string,
  userSIDs: string[],
  parsedResults: ParsedDocument[],
  config: AdvancedFilterConfig,
  accessSchedule?: AccessSchedule,
  queryContext?: { query: string; knowledgeBaseId: string; region: string },
): Promise<AdvancedFilterResult> {
  const allowed: ParsedDocument[] = [];
  const denied: ParsedDocument[] = [];
  const auditDocs: AuditDocumentEntry[] = [];

  // 時間ベース制御（enableAdvancedPermissions=true の場合のみ）
  let scheduleResult = { allowed: true, reason: 'no_schedule' };
  if (config.enableAdvancedPermissions && accessSchedule) {
    scheduleResult = evaluateSchedule(accessSchedule);
  }

  for (const doc of parsedResults) {
    const docSIDs = extractSIDs(doc.metadata);
    const fileName = extractFileName(doc.s3Uri);
    const sidMatch = checkSIDAccess(userSIDs, docSIDs);

    let decision: 'allow' | 'deny';
    let reason: string;

    if (!sidMatch) {
      decision = 'deny';
      reason = 'sid_no_match';
    } else if (config.enableAdvancedPermissions && !scheduleResult.allowed) {
      // SIDマッチだがスケジュール外
      const docCategory = (doc.metadata.access_level as string) || '';
      if (accessSchedule?.documentCategories?.length) {
        // カテゴリ指定がある場合、対象カテゴリのみ時間制限
        if (accessSchedule.documentCategories.includes(docCategory)) {
          decision = 'deny';
          reason = 'schedule_denied';
        } else {
          decision = 'allow';
          reason = 'sid_match';
        }
      } else {
        decision = 'deny';
        reason = 'schedule_denied';
      }
    } else {
      decision = 'allow';
      reason = 'sid_match';
    }

    if (decision === 'allow') {
      allowed.push(doc);
    } else {
      denied.push(doc);
    }

    auditDocs.push({ fileName, s3Uri: doc.s3Uri, decision, reason });
  }

  const filterLog: Record<string, unknown> = {
    totalDocuments: parsedResults.length,
    allowedDocuments: allowed.length,
    deniedDocuments: denied.length,
    userId,
    filterMethod: config.enableAdvancedPermissions ? 'ADVANCED_SID_SCHEDULE' : 'SID_MATCHING',
    ...(config.enableAdvancedPermissions ? { scheduleEvaluation: scheduleResult } : {}),
  };

  // 監査ログ記録（enableAdvancedPermissions=true の場合のみ）
  let auditId: string | undefined;
  if (config.enableAdvancedPermissions && config.auditTableName) {
    const record = createAuditRecord(
      userId,
      auditDocs,
      queryContext?.query || '',
      queryContext?.knowledgeBaseId || '',
      queryContext?.region || '',
    );
    auditId = record.auditId;
    // 非ブロッキング
    writeAuditLog(record).catch(err => {
      console.error('[AdvancedPermissionFilter] Audit log write failed:', err);
    });
  }

  return { allowed, denied, filterLog, auditId };
}

function extractSIDs(metadata: Record<string, unknown>): string[] {
  const sids = metadata.allowed_group_sids;
  if (Array.isArray(sids)) return (sids as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s);
  if (typeof sids === 'string') {
    try { return (JSON.parse(sids) as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s); } catch { return [sids.replace(/^"|"$/g, '')]; }
  }
  return [];
}

function extractFileName(s3Uri: string): string {
  if (!s3Uri) return 'unknown';
  const withoutProtocol = s3Uri.replace(/^s3:\/\/[^/]+\//, '');
  return withoutProtocol || s3Uri;
}
