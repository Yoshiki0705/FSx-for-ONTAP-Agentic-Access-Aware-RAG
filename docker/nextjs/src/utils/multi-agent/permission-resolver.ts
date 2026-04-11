/**
 * Permission Resolution ユーティリティ
 *
 * ユーザーIDからFiltered Context（SIDs, groupSIDs, UID, GID, UNIXグループ, accessDeniedフラグ）
 * を構造化する関数を提供する。
 *
 * User Access Tableにエントリがない場合はFail-Closed原則に基づき、
 * accessDenied=true で空の権限セットを返却する。
 *
 * Validates: Requirements 2.3, 2.5, 2.6
 */

// ===== Filtered Context =====

/**
 * Permission Resolver が返却するフィルタ済みコンテキスト。
 * Retrieval Agent や他の Collaborator が使用する権限情報を構造化する。
 */
export interface FilteredContext {
  /** Windows SID の配列 */
  sids: string[];
  /** グループ SID の配列 */
  groupSids: string[];
  /** UNIX UID */
  uid: string;
  /** UNIX GID */
  gid: string;
  /** UNIX グループ名の配列 */
  unixGroups: string[];
  /** アクセス拒否フラグ（Fail-Closed: エントリなし時は true） */
  accessDenied: boolean;
  /** アクセス拒否の理由（accessDenied=true 時のみ設定） */
  accessDeniedReason?: string;
}

// ===== User Access Entry =====

/**
 * User Access Table（DynamoDB）のエントリ型。
 * lookup 関数が返却するデータ構造。
 */
export interface UserAccessEntry {
  userId: string;
  sids?: string[];
  groupSids?: string[];
  uid?: string;
  gid?: string;
  unixGroups?: string[];
}

// ===== Lookup Function Type =====

/**
 * User Access Table からユーザー情報を取得する関数型。
 * テスタビリティのため、DI パターンで注入可能にする。
 * 本番環境では DynamoDB GetItem を呼び出す実装を渡す。
 *
 * @param userId - 検索対象のユーザーID
 * @returns エントリが存在する場合は UserAccessEntry、存在しない場合は null
 */
export type UserAccessLookup = (userId: string) => Promise<UserAccessEntry | null>;

// ===== Fail-Closed Context Factory =====

/**
 * Fail-Closed 原則に基づくアクセス拒否コンテキストを生成する。
 * 全配列フィールドは空、accessDenied=true を返却する。
 */
function createFailClosedContext(reason: string): FilteredContext {
  return {
    sids: [],
    groupSids: [],
    uid: '',
    gid: '',
    unixGroups: [],
    accessDenied: true,
    accessDeniedReason: reason,
  };
}

// ===== Permission Resolution =====

/**
 * ユーザーIDから Filtered Context を解決する。
 *
 * 1. lookup(userId) で User Access Table からエントリを取得
 * 2. エントリが null → Fail-Closed（accessDenied=true, 空配列）
 * 3. エントリが存在 → 各フィールドを展開して FilteredContext を構築（accessDenied=false）
 * 4. lookup でエラー発生 → Fail-Closed（accessDenied=true）
 *
 * @param userId - 解決対象のユーザーID
 * @param lookup - User Access Table 検索関数
 * @returns Filtered Context
 */
export async function resolvePermissions(
  userId: string,
  lookup: UserAccessLookup,
): Promise<FilteredContext> {
  // 空の userId は即座に Fail-Closed
  if (!userId || userId.trim() === '') {
    return createFailClosedContext('User ID is empty or not provided');
  }

  try {
    const entry = await lookup(userId);

    // エントリなし → Fail-Closed (Requirement 2.6)
    if (entry === null || entry === undefined) {
      return createFailClosedContext(
        `No entry found in User Access Table for user: ${userId}`,
      );
    }

    // エントリあり → Filtered Context を構築 (Requirement 2.3, 2.5)
    return {
      sids: entry.sids ?? [],
      groupSids: entry.groupSids ?? [],
      uid: entry.uid ?? '',
      gid: entry.gid ?? '',
      unixGroups: entry.unixGroups ?? [],
      accessDenied: false,
    };
  } catch (error) {
    // lookup エラー → Fail-Closed（安全側に倒す）
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return createFailClosedContext(
      `Failed to resolve permissions for user ${userId}: ${errorMessage}`,
    );
  }
}
