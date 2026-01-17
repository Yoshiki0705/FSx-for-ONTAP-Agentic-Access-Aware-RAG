/**
 * 高度な権限制御設定
 * 
 * 時間ベース制限、地理的制限、動的権限の統合設定
 * エンタープライズグレードのセキュリティ要件対応
 */

import {
  PermissionFilterConfig,
  TimeBasedRestriction,
  AdvancedGeographicRestriction,
  DynamicPermissionConfig,
  RoleLevel,
  DataClassificationLevel
} from '../interfaces/permission-config';

/**
 * 東京本社向け高度権限制御設定
 */
export const TokyoAdvancedPermissionConfig: PermissionFilterConfig = {
  /** 権限チェック有効化 */
  enabled: true,
  
  /** デフォルト拒否モード */
  defaultDeny: true,
  
  /** 管理者バイパス */
  adminBypass: false, // セキュリティ強化のため管理者もチェック対象
  
  /** 監査ログ有効化 */
  auditLogging: true,
  
  /** キャッシュ設定 */
  cacheConfig: {
    enabled: true,
    ttlSeconds: 300, // 5分
    maxEntries: 10000,
    // 階層キャッシュ設定
    hierarchicalCache: {
      userPermissionsTtl: 600, // ユーザー権限: 10分
      projectMembershipTtl: 1800, // プロジェクトメンバーシップ: 30分
      geolocationTtl: 3600, // 地理的情報: 1時間
      organizationHierarchyTtl: 7200 // 組織階層: 2時間
    },
    // キャッシュ無効化設定
    invalidationRules: {
      onUserRoleChange: true,
      onProjectMembershipChange: true,
      onSecurityPolicyUpdate: true
    }
  },
  
  /** パフォーマンス設定 */
  performanceConfig: {
    maxFilterSize: 1000,
    timeoutMs: 5000,
    batchSize: 100
  },
  
  /** 時間ベース制限 */
  timeBasedRestriction: {
    enabled: true,
    businessHours: {
      startHour: 9,
      endHour: 18,
      businessDays: [1, 2, 3, 4, 5], // 月-金
      timezone: 'Asia/Tokyo'
    },
    emergencyAccessUsers: [
      'admin001',
      'emergency001',
      'security_admin',
      'system_admin'
    ],
    afterHoursRoles: ['admin', 'manager'],
    holidays: {
      dates: [
        '2025-01-01', // 元日
        '2025-01-13', // 成人の日
        '2025-02-11', // 建国記念の日
        '2025-02-23', // 天皇誕生日
        '2025-03-20', // 春分の日
        '2025-04-29', // 昭和の日
        '2025-05-03', // 憲法記念日
        '2025-05-04', // みどりの日
        '2025-05-05', // こどもの日
        '2025-07-21', // 海の日
        '2025-08-11', // 山の日
        '2025-09-15', // 敬老の日
        '2025-09-23', // 秋分の日
        '2025-10-13', // スポーツの日
        '2025-11-03', // 文化の日
        '2025-11-23', // 勤労感謝の日
        '2025-12-29', // 年末休暇
        '2025-12-30', // 年末休暇
        '2025-12-31'  // 大晦日
      ],
      allowAccess: false // 祝日はアクセス拒否
    }
  },
  
  /** 高度な地理的制限 */
  advancedGeographicRestriction: {
    enabled: true,
    allowedCountries: ['JP'], // 日本のみ
    allowedRegions: [
      'Tokyo',
      'Osaka',
      'Nagoya',
      'Fukuoka',
      'Sapporo'
    ],
    allowedIpRanges: [
      '203.0.113.0/24',    // 本社オフィス
      '198.51.100.0/24',   // 支社オフィス
      '192.0.2.0/24',      // リモートワーク用VPN
      '10.0.0.0/8',        // 内部ネットワーク
      '172.16.0.0/12',     // プライベートネットワーク
      '192.168.0.0/16'     // ローカルネットワーク
    ],
    vpnDetection: {
      enabled: true,
      allowedVpnUsers: [
        'admin001',
        'vpn_user001',
        'remote_manager',
        'field_engineer'
      ],
      detectionApi: {
        endpoint: 'api.vpndetection.com',
        apiKey: process.env.VPN_DETECTION_API_KEY || '', // 環境変数から安全に取得
        timeout: 3000
      }
    },
    exemptUsers: [
      'emergency001',
      'global_admin',
      'security_admin'
    ],
    riskBasedAuth: {
      enabled: true,
      anomalyDetection: true,
      requireAdditionalAuth: true
    }
  },
  
  /** 動的権限設定 */
  dynamicPermissionConfig: {
    enabled: true,
    projectBasedAccess: {
      enabled: true,
      projectPermissions: {
        'project_alpha': ['confidential', 'internal', 'public'],
        'project_beta': ['internal', 'public'],
        'project_gamma': ['restricted', 'confidential', 'internal', 'public'],
        'project_delta': ['public'],
        'emergency_response': ['restricted', 'confidential', 'internal', 'public']
      },
      projectMembershipApi: {
        endpoint: 'api.projectmanagement.internal',
        apiKey: process.env.PROJECT_API_KEY || '', // 環境変数から安全に取得
        cacheSeconds: 600 // 10分キャッシュ
      },
      autoGrantPermissions: true
    },
    organizationalHierarchy: {
      enabled: true,
      hierarchy: {
        'CEO': ['CTO', 'CFO', 'COO'],
        'CTO': ['Engineering_Director', 'IT_Director'],
        'CFO': ['Finance_Director', 'Accounting_Manager'],
        'COO': ['Operations_Director', 'HR_Director'],
        'Engineering_Director': ['Senior_Engineer', 'Tech_Lead'],
        'IT_Director': ['System_Admin', 'Security_Admin'],
        'Finance_Director': ['Senior_Accountant', 'Financial_Analyst'],
        'Operations_Director': ['Operations_Manager', 'Project_Manager'],
        'HR_Director': ['HR_Manager', 'Recruiter']
      },
      inheritedPermissions: true,
      maxDepth: 5
    },
    temporaryAccess: {
      enabled: true,
      defaultDurationSeconds: 7200, // 2時間
      maxDurationSeconds: 86400, // 24時間
      approvers: [
        'admin001',
        'security_admin',
        'department_manager'
      ],
      autoApprovalRules: {
        maxDurationSeconds: 3600, // 1時間以下は自動承認
        allowedRoles: ['manager', 'admin'],
        allowedDataClassifications: ['public', 'internal']
      }
    },
    refreshIntervalSeconds: 300, // 5分
    inheritanceRules: {
      departmentInheritance: true,
      projectInheritance: true,
      timeRestrictionInheritance: false // 時間制限は継承しない
    }
  }
};

/**
 * 開発環境向け緩和設定
 */
export const DevelopmentAdvancedPermissionConfig: PermissionFilterConfig = {
  ...TokyoAdvancedPermissionConfig,
  
  /** 開発環境では一部制限を緩和 */
  timeBasedRestriction: {
    ...TokyoAdvancedPermissionConfig.timeBasedRestriction,
    enabled: false // 開発環境では時間制限無効
  },
  
  advancedGeographicRestriction: {
    ...TokyoAdvancedPermissionConfig.advancedGeographicRestriction,
    enabled: false, // 開発環境では地理的制限無効
    allowedCountries: ['JP', 'US', 'SG', 'AU'], // より多くの国を許可
    vpnDetection: {
      ...TokyoAdvancedPermissionConfig.advancedGeographicRestriction.vpnDetection,
      enabled: false // VPN検出無効
    }
  },
  
  dynamicPermissionConfig: {
    ...TokyoAdvancedPermissionConfig.dynamicPermissionConfig,
    refreshIntervalSeconds: 60, // より頻繁な更新
    temporaryAccess: {
      ...TokyoAdvancedPermissionConfig.dynamicPermissionConfig.temporaryAccess,
      defaultDurationSeconds: 28800, // 8時間
      maxDurationSeconds: 604800, // 1週間
      autoApprovalRules: {
        maxDurationSeconds: 86400, // 24時間以下は自動承認
        allowedRoles: ['user', 'manager', 'admin'],
        allowedDataClassifications: ['public', 'internal', 'confidential']
      }
    }
  }
};

/**
 * 本番環境向け厳格設定
 */
export const ProductionAdvancedPermissionConfig: PermissionFilterConfig = {
  ...TokyoAdvancedPermissionConfig,
  
  /** 本番環境では最大限のセキュリティ */
  adminBypass: false, // 管理者も例外なし
  
  timeBasedRestriction: {
    ...TokyoAdvancedPermissionConfig.timeBasedRestriction,
    emergencyAccessUsers: [
      'emergency001' // 緊急アクセスユーザーを最小限に
    ],
    afterHoursRoles: ['admin'] // 管理者のみ時間外アクセス可能
  },
  
  advancedGeographicRestriction: {
    ...TokyoAdvancedPermissionConfig.advancedGeographicRestriction,
    allowedCountries: ['JP'], // 日本のみ厳格に制限
    exemptUsers: [
      'emergency001' // 例外ユーザーを最小限に
    ],
    riskBasedAuth: {
      enabled: true,
      anomalyDetection: true,
      requireAdditionalAuth: true
    }
  },
  
  dynamicPermissionConfig: {
    ...TokyoAdvancedPermissionConfig.dynamicPermissionConfig,
    temporaryAccess: {
      ...TokyoAdvancedPermissionConfig.dynamicPermissionConfig.temporaryAccess,
      defaultDurationSeconds: 3600, // 1時間
      maxDurationSeconds: 14400, // 4時間
      autoApprovalRules: {
        maxDurationSeconds: 1800, // 30分以下のみ自動承認
        allowedRoles: ['admin'],
        allowedDataClassifications: ['public']
      }
    }
  }
};

/**
 * 環境別設定取得関数
 */
export function getAdvancedPermissionConfig(environment: string): PermissionFilterConfig {
  switch (environment.toLowerCase()) {
    case 'development':
    case 'dev':
      return DevelopmentAdvancedPermissionConfig;
    
    case 'production':
    case 'prod':
      return ProductionAdvancedPermissionConfig;
    
    case 'staging':
    case 'test':
      return TokyoAdvancedPermissionConfig;
    
    default:
      return TokyoAdvancedPermissionConfig;
  }
}

/**
 * 役職レベル階層定義
 */
export const RoleLevelHierarchy: Record<RoleLevel, RoleLevel[]> = {
  'admin': ['admin', 'manager', 'user', 'guest'],
  'manager': ['manager', 'user', 'guest'],
  'user': ['user', 'guest'],
  'guest': ['guest']
};

/**
 * データ分類レベル階層定義
 */
export const DataClassificationHierarchy: Record<DataClassificationLevel, DataClassificationLevel[]> = {
  'restricted': ['restricted', 'confidential', 'internal', 'public'],
  'confidential': ['confidential', 'internal', 'public'],
  'internal': ['internal', 'public'],
  'public': ['public']
};

/**
 * 営業時間判定関数（改善版）
 */
export function isBusinessHours(
  date: Date, 
  config: TimeBasedRestriction,
  timezone: string = 'Asia/Tokyo'
): boolean {
  // 入力値検証
  if (!date || !(date instanceof Date) || !config) {
    return false;
  }
  
  if (!config.enabled) return true;
  
  try {
    // タイムゾーン変換（Intl.DateTimeFormatを使用）
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    
    const localDate = new Date(year, month - 1, day);
    const dayOfWeek = localDate.getDay();
    
    // 祝日チェック
    if (config.holidays) {
      const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      if (config.holidays.dates.includes(dateString)) {
        return config.holidays.allowAccess;
      }
    }
    
    // 営業日チェック
    if (!config.businessHours.businessDays.includes(dayOfWeek)) {
      return false;
    }
    
    // 営業時間チェック
    return hour >= config.businessHours.startHour && hour < config.businessHours.endHour;
    
  } catch (error) {
    // エラー時は安全側に倒してfalseを返す
    console.error('営業時間判定エラー:', error);
    return false;
  }
}

/**
 * IP範囲チェック関数（改善版）
 */
export function isIpInRange(ipAddress: string, allowedRanges: string[]): boolean {
  // 入力値検証
  if (!ipAddress || !Array.isArray(allowedRanges)) {
    return false;
  }
  
  // IPv4形式の基本検証
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ipAddress)) {
    return false;
  }
  
  try {
    for (const range of allowedRanges) {
      if (range.includes('/')) {
        // CIDR記法の場合
        const [network, prefixLength] = range.split('/');
        const prefix = parseInt(prefixLength, 10);
        
        // プレフィックス長の検証
        if (isNaN(prefix) || prefix < 0 || prefix > 32) {
          continue;
        }
        
        // IPアドレスを32ビット整数に変換
        const ipInt = ipToInt(ipAddress);
        const networkInt = ipToInt(network);
        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
        
        if ((ipInt & mask) === (networkInt & mask)) {
          return true;
        }
      } else {
        // 完全一致の場合
        if (ipAddress === range) {
          return true;
        }
      }
    }
  } catch (error) {
    // エラー時は安全側に倒してfalseを返す
    console.error('IP範囲チェックエラー:', error);
    return false;
  }
  
  return false;
}

/**
 * IPアドレスを32ビット整数に変換
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.').map(part => parseInt(part, 10));
  
  // 各オクテットの範囲検証
  if (parts.some(part => isNaN(part) || part < 0 || part > 255)) {
    throw new Error(`無効なIPアドレス: ${ip}`);
  }
  
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * 権限継承計算関数
 */
export function calculateInheritedPermissions(
  userRole: RoleLevel,
  dataClassification: DataClassificationLevel
): {
  allowedRoles: RoleLevel[];
  allowedClassifications: DataClassificationLevel[];
} {
  return {
    allowedRoles: RoleLevelHierarchy[userRole] || ['guest'],
    allowedClassifications: DataClassificationHierarchy[dataClassification] || ['public']
  };
}

/**
 * 設定検証関数
 */
export function validatePermissionConfig(config: PermissionFilterConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 基本設定の検証
  if (config.performanceConfig.timeoutMs < 1000) {
    warnings.push('タイムアウト時間が短すぎます（推奨: 5000ms以上）');
  }
  
  if (config.performanceConfig.maxFilterSize > 10000) {
    warnings.push('最大フィルターサイズが大きすぎます（推奨: 1000以下）');
  }
  
  // 時間ベース制限の検証
  if (config.timeBasedRestriction?.enabled) {
    const businessHours = config.timeBasedRestriction.businessHours;
    if (businessHours.startHour >= businessHours.endHour) {
      errors.push('営業開始時間が終了時間以降に設定されています');
    }
    
    if (businessHours.businessDays.length === 0) {
      errors.push('営業日が設定されていません');
    }
  }
  
  // 地理的制限の検証
  if (config.advancedGeographicRestriction?.enabled) {
    const geoConfig = config.advancedGeographicRestriction;
    
    if (geoConfig.allowedCountries.length === 0) {
      warnings.push('許可国が設定されていません');
    }
    
    // IP範囲の基本検証
    for (const ipRange of geoConfig.allowedIpRanges) {
      if (!ipRange.includes('/') && !ipRange.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        errors.push(`無効なIP範囲形式: ${ipRange}`);
      }
    }
  }
  
  // 動的権限設定の検証
  if (config.dynamicPermissionConfig?.enabled) {
    const dynamicConfig = config.dynamicPermissionConfig;
    
    if (dynamicConfig.refreshIntervalSeconds < 60) {
      warnings.push('権限更新間隔が短すぎます（推奨: 300秒以上）');
    }
    
    if (dynamicConfig.temporaryAccess?.maxDurationSeconds < dynamicConfig.temporaryAccess?.defaultDurationSeconds) {
      errors.push('一時アクセスの最大期間がデフォルト期間より短く設定されています');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}