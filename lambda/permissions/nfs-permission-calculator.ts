/**
 * NFS権限計算ロジック
 * 
 * POSIX権限モデルに基づいてNFSの権限を計算します。
 * UID/GID情報とNFSエクスポートポリシーを使用して、
 * ユーザーのアクセス権限を判定します。
 * 
 * Validates: Requirements 9.1, 9.2, 9.4
 */

import {
  UserSIDInfo,
  NfsExportPolicyRule,
  PosixPermissions,
  CalculatedPermissions,
} from './types';

/**
 * POSIX権限モードを解析
 * 
 * 8進数表記の権限モード（例: 0755）をPosixPermissions形式に変換します。
 * 
 * @param mode - 8進数表記の権限モード
 * @returns POSIX権限情報
 * 
 * Validates: Requirements 9.4
 */
export function parsePosixMode(mode: number): PosixPermissions {
  // 8進数の各桁を抽出
  const ownerMode = (mode >> 6) & 0o7;
  const groupMode = (mode >> 3) & 0o7;
  const otherMode = mode & 0o7;

  return {
    owner: {
      read: (ownerMode & 0o4) !== 0,
      write: (ownerMode & 0o2) !== 0,
      execute: (ownerMode & 0o1) !== 0,
    },
    group: {
      read: (groupMode & 0o4) !== 0,
      write: (groupMode & 0o2) !== 0,
      execute: (groupMode & 0o1) !== 0,
    },
    other: {
      read: (otherMode & 0o4) !== 0,
      write: (otherMode & 0o2) !== 0,
      execute: (otherMode & 0o1) !== 0,
    },
    mode: `0${mode.toString(8)}`,
  };
}

/**
 * NFSエクスポートポリシールールをチェック
 * 
 * ユーザーのIPアドレスがエクスポートポリシールールにマッチするかチェックします。
 * 
 * @param rule - NFSエクスポートポリシールール
 * @param clientIp - クライアントIPアドレス（オプション）
 * @returns ルールにマッチする場合true
 * 
 * Validates: Requirements 9.3
 */
export function matchesExportPolicyRule(
  rule: NfsExportPolicyRule,
  clientIp?: string
): boolean {
  // クライアントIPが指定されていない場合、すべてのルールにマッチ
  if (!clientIp) {
    return true;
  }

  // クライアントマッチパターンをチェック
  for (const client of rule.clients) {
    const match = client.match;
    
    // 0.0.0.0/0 または any はすべてにマッチ
    if (match === '0.0.0.0/0' || match === 'any') {
      return true;
    }
    
    // 完全一致
    if (match === clientIp) {
      return true;
    }
    
    // CIDR表記のマッチング（簡易実装）
    if (match.includes('/')) {
      // 実際の実装では、IPアドレスのCIDRマッチングを行う
      // ここでは簡易的に実装
      const [network] = match.split('/');
      if (clientIp.startsWith(network.split('.').slice(0, 3).join('.'))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * NFSエクスポートポリシーから権限を取得
 * 
 * エクスポートポリシールールから読み取り/書き込み権限を判定します。
 * 
 * @param rule - NFSエクスポートポリシールール
 * @param authType - 認証タイプ（sys | krb5 | krb5i | krb5p）
 * @returns 計算された権限
 * 
 * Validates: Requirements 9.3, 9.4
 */
export function getExportPolicyPermissions(
  rule: NfsExportPolicyRule,
  authType: string = 'sys'
): CalculatedPermissions {
  // 読み取り専用ルールをチェック
  const hasReadOnly = rule.ro_rule.includes(authType) || rule.ro_rule.includes('any');
  
  // 読み書きルールをチェック
  const hasReadWrite = rule.rw_rule.includes(authType) || rule.rw_rule.includes('any');
  
  // スーパーユーザールールをチェック
  const hasSuperuser = rule.superuser.includes(authType) || rule.superuser.includes('any');

  return {
    read: hasReadOnly || hasReadWrite,
    write: hasReadWrite,
    admin: hasSuperuser,
  };
}

/**
 * POSIX権限からユーザー権限を計算
 * 
 * ユーザーのUID/GID情報とPOSIX権限から、実際のアクセス権限を計算します。
 * 
 * @param userInfo - ユーザーSID情報（UID/GID含む）
 * @param posixPerms - POSIX権限情報
 * @param fileOwnerUid - ファイル所有者のUID
 * @param fileGroupGid - ファイルグループのGID
 * @returns 計算された権限
 * 
 * Validates: Requirements 9.2, 9.4
 */
export function calculatePosixPermissions(
  userInfo: UserSIDInfo,
  posixPerms: PosixPermissions,
  fileOwnerUid: number,
  fileGroupGid: number
): CalculatedPermissions {
  // UID/GID情報が存在しない場合、権限なし
  if (userInfo.uid === undefined || userInfo.gid === undefined) {
    return {
      read: false,
      write: false,
      admin: false,
    };
  }

  // 所有者の場合
  if (userInfo.uid === fileOwnerUid) {
    return {
      read: posixPerms.owner.read,
      write: posixPerms.owner.write,
      admin: posixPerms.owner.write, // 書き込み権限がある場合、管理者権限とみなす
    };
  }

  // グループメンバーの場合
  if (userInfo.gid === fileGroupGid) {
    return {
      read: posixPerms.group.read,
      write: posixPerms.group.write,
      admin: false,
    };
  }

  // ユーザーが所属する他のグループをチェック
  if (userInfo.unixGroups) {
    for (const group of userInfo.unixGroups) {
      if (group.gid === fileGroupGid) {
        return {
          read: posixPerms.group.read,
          write: posixPerms.group.write,
          admin: false,
        };
      }
    }
  }

  // その他のユーザー
  return {
    read: posixPerms.other.read,
    write: posixPerms.other.write,
    admin: false,
  };
}

/**
 * NFS権限を統合計算
 * 
 * エクスポートポリシーとPOSIX権限を組み合わせて、
 * 最終的なユーザー権限を計算します。
 * 
 * @param userInfo - ユーザーSID情報（UID/GID含む）
 * @param exportPolicyRule - NFSエクスポートポリシールール
 * @param posixPerms - POSIX権限情報
 * @param fileOwnerUid - ファイル所有者のUID
 * @param fileGroupGid - ファイルグループのGID
 * @param clientIp - クライアントIPアドレス（オプション）
 * @param authType - 認証タイプ（デフォルト: sys）
 * @returns 計算された権限
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export function calculateNfsPermissions(
  userInfo: UserSIDInfo,
  exportPolicyRule: NfsExportPolicyRule,
  posixPerms: PosixPermissions,
  fileOwnerUid: number,
  fileGroupGid: number,
  clientIp?: string,
  authType: string = 'sys'
): CalculatedPermissions {
  // エクスポートポリシールールにマッチしない場合、アクセス拒否
  if (!matchesExportPolicyRule(exportPolicyRule, clientIp)) {
    return {
      read: false,
      write: false,
      admin: false,
    };
  }

  // エクスポートポリシーから権限を取得
  const exportPerms = getExportPolicyPermissions(exportPolicyRule, authType);

  // POSIX権限から権限を計算
  const posixCalculated = calculatePosixPermissions(
    userInfo,
    posixPerms,
    fileOwnerUid,
    fileGroupGid
  );

  // 両方の権限の論理積（AND）を取る
  // エクスポートポリシーとPOSIX権限の両方で許可されている場合のみアクセス可能
  return {
    read: exportPerms.read && posixCalculated.read,
    write: exportPerms.write && posixCalculated.write,
    admin: exportPerms.admin && posixCalculated.admin,
  };
}
