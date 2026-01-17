/**
 * 権限計算ロジック
 * SIDマッチングと有効権限の計算を担当
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { OntapAclRecord, CalculatedPermissions, DirectoryPermission } from './types';

/**
 * 権限レベルの優先順位
 * 数値が大きいほど強い権限
 */
const PERMISSION_PRIORITY = {
  'no_access': 0,
  'read': 1,
  'change': 2,
  'full_control': 3,
} as const;

/**
 * ユーザーのSIDリストとACLレコードから有効な権限を計算
 * 
 * @param userSIDs - ユーザーのSIDリスト（個人SID + グループSID）
 * @param aclRecords - ONTAP ACLレコード
 * @returns 計算された権限
 * 
 * Validates: Requirements 3.1, 3.2
 */
export function calculateEffectivePermissions(
  userSIDs: string[],
  aclRecords: OntapAclRecord[]
): CalculatedPermissions {
  console.log(`権限計算開始: ${userSIDs.length}個のSID, ${aclRecords.length}個のACLレコード`);

  // マッチしたACLレコードを収集
  const matchedRecords: OntapAclRecord[] = [];

  for (const acl of aclRecords) {
    // ユーザーのSIDリストとACLのSIDをマッチング
    if (userSIDs.includes(acl.user_or_group)) {
      matchedRecords.push(acl);
      console.log(`SIDマッチ: ${acl.user_or_group} -> ${acl.permission}`);
    }
  }

  // マッチしたレコードがない場合、全ての権限をfalseに設定
  if (matchedRecords.length === 0) {
    console.log('権限マッチなし: すべての権限をfalseに設定');
    return {
      read: false,
      write: false,
      admin: false,
    };
  }

  // 複数のACLエントリがマッチする場合、最も強い権限を採用
  const strongestPermission = findStrongestPermission(matchedRecords);
  console.log(`最も強い権限: ${strongestPermission}`);

  // 権限レベルを具体的な権限にマッピング
  return mapPermissionToFlags(strongestPermission);
}

/**
 * 複数のACLレコードから最も強い権限を見つける
 * 
 * @param records - ACLレコードのリスト
 * @returns 最も強い権限レベル
 * 
 * Validates: Requirements 3.2
 */
function findStrongestPermission(
  records: OntapAclRecord[]
): 'full_control' | 'change' | 'read' | 'no_access' {
  let strongestPriority = -1;
  let strongestPermission: 'full_control' | 'change' | 'read' | 'no_access' = 'no_access';

  for (const record of records) {
    const priority = PERMISSION_PRIORITY[record.permission];
    if (priority > strongestPriority) {
      strongestPriority = priority;
      strongestPermission = record.permission;
    }
  }

  return strongestPermission;
}

/**
 * 権限レベルを具体的な権限フラグにマッピング
 * 
 * @param permission - 権限レベル
 * @returns 計算された権限フラグ
 * 
 * Validates: Requirements 3.3, 3.4, 3.5
 */
function mapPermissionToFlags(
  permission: 'full_control' | 'change' | 'read' | 'no_access'
): CalculatedPermissions {
  switch (permission) {
    case 'full_control':
      // full_control → read, write, admin すべてtrue
      return {
        read: true,
        write: true,
        admin: true,
      };

    case 'change':
      // change → read, write true, admin false
      return {
        read: true,
        write: true,
        admin: false,
      };

    case 'read':
      // read → read のみ true
      return {
        read: true,
        write: false,
        admin: false,
      };

    case 'no_access':
      // no_access → すべて false
      return {
        read: false,
        write: false,
        admin: false,
      };

    default:
      // 未知の権限レベル → すべて false
      console.warn(`未知の権限レベル: ${permission}`);
      return {
        read: false,
        write: false,
        admin: false,
      };
  }
}

/**
 * 権限計算結果をDirectoryPermission形式に変換
 * 
 * @param path - ディレクトリパス
 * @param calculatedPermissions - 計算された権限
 * @param owner - 所有者（オプション）
 * @param group - グループ（オプション）
 * @returns DirectoryPermission形式の結果
 * 
 * Validates: Requirements 3.7
 */
export function buildDirectoryPermission(
  path: string,
  calculatedPermissions: CalculatedPermissions,
  owner?: string,
  group?: string
): DirectoryPermission {
  // 権限フラグから権限配列を構築
  const permissions: ('read' | 'write')[] = [];

  if (calculatedPermissions.read) {
    permissions.push('read');
  }

  if (calculatedPermissions.write) {
    permissions.push('write');
  }

  return {
    path,
    permissions,
    owner: owner || 'unknown',
    group: group || 'unknown',
  };
}

/**
 * 複数のディレクトリに対して権限を計算
 * 
 * @param userSIDs - ユーザーのSIDリスト
 * @param pathAclMap - パスとACLレコードのマップ
 * @returns DirectoryPermissionの配列
 */
export function calculateMultipleDirectoryPermissions(
  userSIDs: string[],
  pathAclMap: Map<string, OntapAclRecord[]>
): DirectoryPermission[] {
  const results: DirectoryPermission[] = [];

  for (const [path, aclRecords] of pathAclMap.entries()) {
    const calculatedPermissions = calculateEffectivePermissions(userSIDs, aclRecords);
    const directoryPermission = buildDirectoryPermission(path, calculatedPermissions);
    results.push(directoryPermission);
  }

  return results;
}

/**
 * 権限計算のサマリーを生成
 * 
 * @param userSIDs - ユーザーのSIDリスト
 * @param aclRecords - ACLレコード
 * @param result - 計算結果
 * @returns サマリー文字列
 */
export function generatePermissionSummary(
  userSIDs: string[],
  aclRecords: OntapAclRecord[],
  result: CalculatedPermissions
): string {
  const matchedCount = aclRecords.filter(acl => 
    userSIDs.includes(acl.user_or_group)
  ).length;

  const permissionList: string[] = [];
  if (result.read) permissionList.push('読取');
  if (result.write) permissionList.push('書込');
  if (result.admin) permissionList.push('管理');

  if (permissionList.length === 0) {
    return `権限なし (${matchedCount}/${aclRecords.length}個のACLがマッチ)`;
  }

  return `${permissionList.join('、')} (${matchedCount}/${aclRecords.length}個のACLがマッチ)`;
}
