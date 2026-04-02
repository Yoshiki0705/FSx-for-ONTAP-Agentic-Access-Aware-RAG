/**
 * Advanced Permission Control テスト
 *
 * CDK synth テスト + ScheduleEvaluator ユニットテスト
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DemoStorageStack } from '../../lib/stacks/demo/demo-storage-stack';
import { DemoNetworkingStack } from '../../lib/stacks/demo/demo-networking-stack';
import { evaluateSchedule, parseTimeToMinutes, AccessSchedule } from '../../lambda/permissions/schedule-evaluator';
import { checkSIDAccess } from '../../lambda/permissions/advanced-permission-filter';

// ========================================
// ヘルパー
// ========================================

function createTestStacks(enableAdvancedPermissions: boolean) {
  const app = new cdk.App();
  const env = { account: '123456789012', region: 'ap-northeast-1' };

  const networkingStack = new DemoNetworkingStack(app, 'TestNet', {
    projectName: 'test', environment: 'dev', env,
  });

  const storageStack = new DemoStorageStack(app, 'TestStorage', {
    projectName: 'test', environment: 'dev',
    vpc: networkingStack.vpc,
    privateSubnets: networkingStack.privateSubnets,
    fsxSg: networkingStack.fsxSg,
    enableAdvancedPermissions,
    env,
  });

  return { storageStack, template: Template.fromStack(storageStack) };
}

// ========================================
// CDK Synth テスト
// ========================================

describe('CDK: permission-audit テーブル', () => {
  it('enableAdvancedPermissions=true → permission-audit テーブルが作成される', () => {
    const { template } = createTestStacks(true);
    const resources = template.toJSON().Resources;
    const auditTables = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::DynamoDB::Table' && r.Properties?.TableName?.includes('permission-audit')
    );
    expect(auditTables.length).toBe(1);
  });

  it('enableAdvancedPermissions=false → permission-audit テーブルが作成されない', () => {
    const { template } = createTestStacks(false);
    const resources = template.toJSON().Resources;
    const auditTables = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::DynamoDB::Table' && r.Properties?.TableName?.includes('permission-audit')
    );
    expect(auditTables.length).toBe(0);
  });

  it('enableAdvancedPermissions=true → GSI userId-timestamp-index が存在する', () => {
    const { template } = createTestStacks(true);
    const resources = template.toJSON().Resources;
    const auditTable = Object.values(resources).find(
      (r: any) => r.Type === 'AWS::DynamoDB::Table' && r.Properties?.TableName?.includes('permission-audit')
    ) as any;
    expect(auditTable).toBeDefined();
    const gsi = auditTable.Properties.GlobalSecondaryIndexes;
    expect(gsi).toBeDefined();
    expect(gsi.length).toBe(1);
    expect(gsi[0].IndexName).toBe('userId-timestamp-index');
  });
});

// ========================================
// ScheduleEvaluator ユニットテスト
// ========================================

describe('parseTimeToMinutes', () => {
  it('"09:00" → 540', () => expect(parseTimeToMinutes('09:00')).toBe(540));
  it('"00:00" → 0', () => expect(parseTimeToMinutes('00:00')).toBe(0));
  it('"23:59" → 1439', () => expect(parseTimeToMinutes('23:59')).toBe(1439));
  it('invalid → -1', () => expect(parseTimeToMinutes('invalid')).toBe(-1));
});

describe('evaluateSchedule', () => {
  const weekdaySchedule: AccessSchedule = {
    timezone: 'Asia/Tokyo',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '09:00',
    endTime: '18:00',
  };

  it('平日9:00-18:00 JST内のアクセス → 許可', () => {
    // 2026-01-05 (Mon) 10:00 JST = 01:00 UTC
    const now = new Date('2026-01-05T01:00:00Z');
    const result = evaluateSchedule(weekdaySchedule, now);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('within_schedule');
  });

  it('土曜日のアクセス → 拒否', () => {
    // 2026-01-03 (Sat) 10:00 JST = 01:00 UTC
    const now = new Date('2026-01-03T01:00:00Z');
    const result = evaluateSchedule(weekdaySchedule, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_schedule');
  });

  it('18:01 JSTのアクセス → 拒否', () => {
    // 2026-01-05 (Mon) 18:01 JST = 09:01 UTC
    const now = new Date('2026-01-05T09:01:00Z');
    const result = evaluateSchedule(weekdaySchedule, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_schedule');
  });

  it('accessSchedule 未設定 → 許可', () => {
    const result = evaluateSchedule(undefined);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('no_schedule');
  });

  it('無効なタイムゾーン → 許可（フォールバック）', () => {
    const result = evaluateSchedule({
      timezone: 'Invalid/Timezone',
      daysOfWeek: [1],
      startTime: '09:00',
      endTime: '18:00',
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('invalid_schedule_fallback');
  });

  it('daysOfWeek が空配列 → 拒否', () => {
    const result = evaluateSchedule({
      timezone: 'Asia/Tokyo',
      daysOfWeek: [],
      startTime: '09:00',
      endTime: '18:00',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_schedule');
  });
});

// ========================================
// checkSIDAccess ユニットテスト
// ========================================

describe('checkSIDAccess', () => {
  it('SIDマッチ → true', () => {
    expect(checkSIDAccess(['S-1-1-0', 'S-1-5-21-512'], ['S-1-1-0'])).toBe(true);
  });

  it('SID不一致 → false', () => {
    expect(checkSIDAccess(['S-1-5-21-1001'], ['S-1-5-21-512'])).toBe(false);
  });

  it('空ユーザーSID → false', () => {
    expect(checkSIDAccess([], ['S-1-1-0'])).toBe(false);
  });

  it('空ドキュメントSID → false', () => {
    expect(checkSIDAccess(['S-1-1-0'], [])).toBe(false);
  });

  it('enableAdvancedPermissions に関わらず結果が同一', () => {
    const userSIDs = ['S-1-1-0', 'S-1-5-21-512'];
    const docSIDs = ['S-1-5-21-512'];
    // checkSIDAccess は enableAdvancedPermissions を参照しない（不変性）
    expect(checkSIDAccess(userSIDs, docSIDs)).toBe(true);
    expect(checkSIDAccess(userSIDs, docSIDs)).toBe(true);
  });
});

// ========================================
// プロパティベーステスト (fast-check)
// ========================================

import * as fc from 'fast-check';
import { createAuditRecord } from '../../lambda/permissions/audit-logger';
import { advancedPermissionFilter, ParsedDocument } from '../../lambda/permissions/advanced-permission-filter';

// ヘルパー: 有効なタイムゾーンリスト（テスト用に代表的なもの）
const VALID_TIMEZONES = [
  'Asia/Tokyo', 'America/New_York', 'Europe/London', 'UTC',
  'America/Los_Angeles', 'Europe/Berlin', 'Asia/Shanghai',
];

// ヘルパー: HH:mm形式の時刻ジェネレータ
const timeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

// ヘルパー: AccessScheduleジェネレータ
const scheduleArb = fc.record({
  timezone: fc.constantFrom(...VALID_TIMEZONES),
  daysOfWeek: fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }),
  startTime: timeArb,
  endTime: timeArb,
});

// ヘルパー: SIDジェネレータ
const sidArb = fc.stringMatching(/^S-1-[0-9]-[0-9]{1,4}$/);

// ヘルパー: ParsedDocumentジェネレータ
const docArb = fc.record({
  content: fc.string({ minLength: 1, maxLength: 50 }),
  s3Uri: fc.string({ minLength: 5, maxLength: 50 }).map(s => `s3://bucket/${s}`),
  metadata: fc.record({
    allowed_group_sids: fc.array(sidArb, { minLength: 1, maxLength: 3 }),
    access_level: fc.constantFrom('public', 'confidential', 'restricted'),
  }),
}).map(d => ({ ...d, metadata: d.metadata as Record<string, unknown> }));

// ========================================
// Property 2: スケジュール評価の正当性
// ========================================

describe('Property 2: スケジュール評価の正当性', () => {
  it('evaluateSchedule の allowed=true は、曜日が daysOfWeek に含まれ、かつ時刻が startTime 以上 endTime 未満の場合に限る', () => {
    fc.assert(
      fc.property(
        scheduleArb,
        fc.date({ min: new Date('2025-01-01'), max: new Date('2027-12-31') }),
        (schedule, now) => {
          // startTime >= endTime の場合はスキップ（範囲が無効）
          const start = parseTimeToMinutes(schedule.startTime);
          const end = parseTimeToMinutes(schedule.endTime);
          if (start >= end) return;

          const result = evaluateSchedule(schedule, now);

          // ローカル時刻を計算
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: schedule.timezone,
            hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
          });
          const parts = formatter.formatToParts(now);
          const hour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
          const minute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
          const localMinutes = hour * 60 + minute;

          const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: schedule.timezone, weekday: 'short' });
          const dayStr = dayFormatter.format(now);
          const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
          const localDay = dayMap[dayStr];

          const dayMatch = schedule.daysOfWeek.includes(localDay);
          const timeMatch = localMinutes >= start && localMinutes < end;
          const expected = dayMatch && timeMatch;

          expect(result.allowed).toBe(expected);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ========================================
// Property 5: 監査TTLの正当性
// ========================================

describe('Property 5: 監査TTLの正当性', () => {
  it('ttl は timestamp から90日後のUnixタイムスタンプ（±1秒）', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 20 }),  // userId
        fc.array(fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 20 }),
          s3Uri: fc.string({ minLength: 1, maxLength: 30 }),
          decision: fc.constantFrom('allow' as const, 'deny' as const),
          reason: fc.constantFrom('sid_match', 'sid_no_match', 'schedule_denied'),
        }), { minLength: 1, maxLength: 5 }),
        (userId, docs) => {
          const record = createAuditRecord(userId, docs, 'test query', 'kb-123', 'ap-northeast-1');
          const timestampMs = new Date(record.timestamp).getTime();
          const expected90Days = Math.floor(timestampMs / 1000) + 90 * 24 * 60 * 60;
          expect(Math.abs(record.ttl - expected90Days)).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ========================================
// Property 3: 機能フラグ無効時の後方互換性
// ========================================

describe('Property 3: 機能フラグ無効時の後方互換性', () => {
  it('enableAdvancedPermissions=false の場合、accessSchedule の有無に関わらず結果が同一', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(sidArb, { minLength: 1, maxLength: 4 }),
        fc.array(docArb, { minLength: 1, maxLength: 3 }),
        fc.option(scheduleArb),
        async (userSIDs, docs, maybeSchedule) => {
          const configOff = { enableAdvancedPermissions: false };

          const resultWith = await advancedPermissionFilter(
            'user1', userSIDs, docs as ParsedDocument[], configOff, maybeSchedule ?? undefined
          );

          const resultWithout = await advancedPermissionFilter(
            'user1', userSIDs, docs as ParsedDocument[], configOff, undefined
          );

          expect(resultWith.allowed.length).toBe(resultWithout.allowed.length);
          expect(resultWith.filterLog.filterMethod).not.toBe('ADVANCED_SID_SCHEDULE');
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ========================================
// Property 4: 監査レコードの完全性
// ========================================

describe('Property 4: 監査レコードの完全性', () => {
  it('監査レコードは入力ドキュメント数と同数のエントリを含み、必須フィールドが非空', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 20 }),
        fc.array(fc.record({
          fileName: fc.string({ minLength: 1, maxLength: 20 }),
          s3Uri: fc.string({ minLength: 1, maxLength: 30 }),
          decision: fc.constantFrom('allow' as const, 'deny' as const),
          reason: fc.constantFrom('sid_match', 'sid_no_match', 'schedule_denied'),
        }), { minLength: 1, maxLength: 5 }),
        (userId, docs) => {
          const record = createAuditRecord(userId, docs, 'query', 'kb-1', 'us-east-1');

          // ドキュメント数が一致
          expect(record.documents.length).toBe(docs.length);

          // 各エントリの必須フィールドが非空
          for (const doc of record.documents) {
            expect(doc.fileName.length).toBeGreaterThan(0);
            expect(doc.s3Uri.length).toBeGreaterThan(0);
            expect(['allow', 'deny']).toContain(doc.decision);
            expect(doc.reason.length).toBeGreaterThan(0);
          }

          // レコード自体の必須フィールド
          expect(record.userId.length).toBeGreaterThan(0);
          expect(record.timestamp.length).toBeGreaterThan(0);
          expect(['allow', 'deny', 'partial']).toContain(record.overallDecision);
          expect(record.auditId.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ========================================
// Property 6: SIDフィルタリングの不変性
// ========================================

describe('Property 6: SIDフィルタリングの不変性', () => {
  it('checkSIDAccess の結果は enableAdvancedPermissions の値に関わらず同一', () => {
    fc.assert(
      fc.property(
        fc.array(sidArb, { minLength: 0, maxLength: 5 }),
        fc.array(sidArb, { minLength: 0, maxLength: 5 }),
        fc.boolean(),
        (userSIDs, docSIDs, _enableFlag) => {
          // checkSIDAccess は enableAdvancedPermissions を参照しない
          const result1 = checkSIDAccess(userSIDs, docSIDs);
          const result2 = checkSIDAccess(userSIDs, docSIDs);
          expect(result1).toBe(result2);

          // 手動検証: 交差が空でなければ true
          const hasIntersection = userSIDs.length > 0 && docSIDs.length > 0 &&
            userSIDs.some(s => docSIDs.includes(s));
          expect(result1).toBe(hasIntersection);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ========================================
// Property 1: accessSchedule ラウンドトリップ
// ========================================

describe('Property 1: accessSchedule ラウンドトリップ', () => {
  it('AccessSchedule を JSON シリアライズ/デシリアライズしても等価', () => {
    fc.assert(
      fc.property(
        scheduleArb,
        (schedule) => {
          // DynamoDB marshall/unmarshall のシミュレーション（JSON round-trip）
          const serialized = JSON.stringify(schedule);
          const deserialized = JSON.parse(serialized) as AccessSchedule;

          expect(deserialized.timezone).toBe(schedule.timezone);
          expect(deserialized.daysOfWeek).toEqual(schedule.daysOfWeek);
          expect(deserialized.startTime).toBe(schedule.startTime);
          expect(deserialized.endTime).toBe(schedule.endTime);
        }
      ),
      { numRuns: 20 }
    );
  });
});
