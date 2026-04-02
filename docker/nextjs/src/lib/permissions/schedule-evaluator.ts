/**
 * ScheduleEvaluator — 時間ベースアクセス制御
 *
 * ユーザーの accessSchedule に基づいて、現在時刻がアクセス許可範囲内かを評価する。
 * フェイルオープン設計: 無効な設定の場合はアクセスを許可する（ユーザーロックアウト防止）。
 */

export interface AccessSchedule {
  timezone: string;              // IANA タイムゾーン（例: "Asia/Tokyo"）
  daysOfWeek: number[];          // 許可曜日（0=日, 1=月, ..., 6=土）
  startTime: string;             // 開始時刻（"HH:mm" 形式）
  endTime: string;               // 終了時刻（"HH:mm" 形式）
  documentCategories?: string[]; // 対象ドキュメントカテゴリ（省略時: 全カテゴリ）
}

export interface ScheduleEvaluationResult {
  allowed: boolean;
  reason: string;    // "within_schedule" | "outside_schedule" | "no_schedule" | "invalid_schedule_fallback"
  evaluatedAt: string;
  localTime: string;
}

/**
 * 時刻文字列を0時からの分数に変換する
 */
export function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
  return hours * 60 + minutes;
}

/**
 * アクセススケジュールを評価する
 */
export function evaluateSchedule(
  schedule: AccessSchedule | undefined,
  now?: Date
): ScheduleEvaluationResult {
  const currentTime = now || new Date();
  const evaluatedAt = currentTime.toISOString();

  // スケジュール未設定 → 常に許可
  if (!schedule) {
    return { allowed: true, reason: 'no_schedule', evaluatedAt, localTime: evaluatedAt };
  }

  // daysOfWeek が空配列 → アクセス拒否
  if (!Array.isArray(schedule.daysOfWeek) || schedule.daysOfWeek.length === 0) {
    return { allowed: false, reason: 'outside_schedule', evaluatedAt, localTime: evaluatedAt };
  }

  // タイムゾーンでローカル時刻を取得
  let localTime: string;
  let localDay: number;
  let localMinutes: number;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(currentTime);
    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');
    if (!hourPart || !minutePart) {
      return { allowed: true, reason: 'invalid_schedule_fallback', evaluatedAt, localTime: evaluatedAt };
    }
    const hour = parseInt(hourPart.value, 10);
    const minute = parseInt(minutePart.value, 10);
    localMinutes = hour * 60 + minute;

    // ローカル曜日を取得
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone,
      weekday: 'short',
    });
    const dayStr = dayFormatter.format(currentTime);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    localDay = dayMap[dayStr] ?? -1;
    localTime = `${hourPart.value}:${minutePart.value} ${dayStr}`;
  } catch {
    // 無効なタイムゾーン → フェイルオープン
    return { allowed: true, reason: 'invalid_schedule_fallback', evaluatedAt, localTime: evaluatedAt };
  }

  // 時刻パース
  const startMinutes = parseTimeToMinutes(schedule.startTime);
  const endMinutes = parseTimeToMinutes(schedule.endTime);
  if (startMinutes < 0 || endMinutes < 0) {
    // 無効な時刻形式 → フェイルオープン
    return { allowed: true, reason: 'invalid_schedule_fallback', evaluatedAt, localTime };
  }

  // 曜日チェック
  if (!schedule.daysOfWeek.includes(localDay)) {
    return { allowed: false, reason: 'outside_schedule', evaluatedAt, localTime };
  }

  // 時刻範囲チェック
  if (localMinutes >= startMinutes && localMinutes < endMinutes) {
    return { allowed: true, reason: 'within_schedule', evaluatedAt, localTime };
  }

  return { allowed: false, reason: 'outside_schedule', evaluatedAt, localTime };
}
