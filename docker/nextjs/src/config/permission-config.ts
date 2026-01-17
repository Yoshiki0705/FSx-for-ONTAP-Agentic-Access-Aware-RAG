/**
 * 高度権限制御システム設定
 */

export interface PermissionConfig {
  timeBasedRestriction: {
    enabled: boolean;
    businessHours: {
      start: number; // 24時間形式
      end: number;
      weekdays: number[]; // 0=日曜日, 1=月曜日...
    };
    timezone: string;
  };
  geographicRestriction: {
    enabled: boolean;
    allowedCountries: string[];
    allowedIpRanges: string[];
    vpnDetection: boolean;
  };
  dynamicPermission: {
    enabled: boolean;
    defaultPermissions: string[];
    temporaryAccessDuration: number; // 時間
    maxTemporaryAccess: number; // 最大同時一時アクセス数
  };
  auditLog: {
    enabled: boolean;
    retentionDays: number;
    detailedLogging: boolean;
  };
}

/**
 * 環境別権限制御設定
 */
export const PERMISSION_CONFIGS: Record<string, PermissionConfig> = {
  development: {
    timeBasedRestriction: {
      enabled: false, // 開発環境では無効
      businessHours: {
        start: 9,
        end: 18,
        weekdays: [1, 2, 3, 4, 5] // 月-金
      },
      timezone: 'Asia/Tokyo'
    },
    geographicRestriction: {
      enabled: false, // 開発環境では無効
      allowedCountries: ['JP'],
      allowedIpRanges: [
        '127.0.0.1/32',
        '192.168.0.0/16',
        '10.0.0.0/8',
        '172.16.0.0/12'
      ],
      vpnDetection: false
    },
    dynamicPermission: {
      enabled: true,
      defaultPermissions: ['基本機能', 'チャット機能', 'ドキュメント検索'],
      temporaryAccessDuration: 8, // 開発環境では長め
      maxTemporaryAccess: 10
    },
    auditLog: {
      enabled: true,
      retentionDays: 7, // 短期保持
      detailedLogging: false
    }
  },
  
  staging: {
    timeBasedRestriction: {
      enabled: true,
      businessHours: {
        start: 9,
        end: 18,
        weekdays: [1, 2, 3, 4, 5]
      },
      timezone: 'Asia/Tokyo'
    },
    geographicRestriction: {
      enabled: true,
      allowedCountries: ['JP'],
      allowedIpRanges: [
        '203.0.113.0/24', // 本社オフィス
        '198.51.100.0/24', // 支社オフィス
        '192.0.2.0/24' // VPNレンジ
      ],
      vpnDetection: true
    },
    dynamicPermission: {
      enabled: true,
      defaultPermissions: ['基本機能', 'チャット機能'],
      temporaryAccessDuration: 4,
      maxTemporaryAccess: 5
    },
    auditLog: {
      enabled: true,
      retentionDays: 30,
      detailedLogging: true
    }
  },
  
  production: {
    timeBasedRestriction: {
      enabled: true,
      businessHours: {
        start: 9,
        end: 18,
        weekdays: [1, 2, 3, 4, 5]
      },
      timezone: 'Asia/Tokyo'
    },
    geographicRestriction: {
      enabled: true,
      allowedCountries: ['JP'],
      allowedIpRanges: [
        '203.0.113.0/24',
        '198.51.100.0/24',
        '192.0.2.0/24'
      ],
      vpnDetection: true
    },
    dynamicPermission: {
      enabled: true,
      defaultPermissions: ['基本機能'],
      temporaryAccessDuration: 2, // 本番環境では短め
      maxTemporaryAccess: 3
    },
    auditLog: {
      enabled: true,
      retentionDays: 90, // 長期保持
      detailedLogging: true
    }
  }
};

/**
 * 現在の環境設定を取得
 */
export function getPermissionConfig(): PermissionConfig {
  const environment = process.env.NODE_ENV || 'development';
  return PERMISSION_CONFIGS[environment] || PERMISSION_CONFIGS.development;
}

/**
 * 緊急アクセス許可ユーザー
 */
export const EMERGENCY_ACCESS_USERS = [
  'admin001',
  'emergency001',
  'security_admin',
  'system_admin'
];

/**
 * VPN許可ユーザー
 */
export const VPN_ALLOWED_USERS = [
  'admin001',
  'vpn_user001',
  'remote_manager',
  'field_engineer'
];

/**
 * プロジェクト権限マッピング
 */
export const PROJECT_PERMISSIONS = {
  project_alpha: ['confidential', 'internal', 'public'],
  project_beta: ['internal', 'public'],
  project_gamma: ['restricted', 'confidential', 'internal', 'public'],
  project_delta: ['public'],
  emergency_response: ['restricted', 'confidential', 'internal', 'public']
} as const;