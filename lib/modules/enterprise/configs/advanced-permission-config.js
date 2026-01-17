"use strict";
/**
 * 高度な権限制御設定
 *
 * 時間ベース制限、地理的制限、動的権限の統合設定
 * エンタープライズグレードのセキュリティ要件対応
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataClassificationHierarchy = exports.RoleLevelHierarchy = exports.ProductionAdvancedPermissionConfig = exports.DevelopmentAdvancedPermissionConfig = exports.TokyoAdvancedPermissionConfig = void 0;
exports.getAdvancedPermissionConfig = getAdvancedPermissionConfig;
exports.isBusinessHours = isBusinessHours;
exports.isIpInRange = isIpInRange;
exports.calculateInheritedPermissions = calculateInheritedPermissions;
exports.validatePermissionConfig = validatePermissionConfig;
/**
 * 東京本社向け高度権限制御設定
 */
exports.TokyoAdvancedPermissionConfig = {
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
                '2025-12-31' // 大晦日
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
            '203.0.113.0/24', // 本社オフィス
            '198.51.100.0/24', // 支社オフィス
            '192.0.2.0/24', // リモートワーク用VPN
            '10.0.0.0/8', // 内部ネットワーク
            '172.16.0.0/12', // プライベートネットワーク
            '192.168.0.0/16' // ローカルネットワーク
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
exports.DevelopmentAdvancedPermissionConfig = {
    ...exports.TokyoAdvancedPermissionConfig,
    /** 開発環境では一部制限を緩和 */
    timeBasedRestriction: {
        ...exports.TokyoAdvancedPermissionConfig.timeBasedRestriction,
        enabled: false // 開発環境では時間制限無効
    },
    advancedGeographicRestriction: {
        ...exports.TokyoAdvancedPermissionConfig.advancedGeographicRestriction,
        enabled: false, // 開発環境では地理的制限無効
        allowedCountries: ['JP', 'US', 'SG', 'AU'], // より多くの国を許可
        vpnDetection: {
            ...exports.TokyoAdvancedPermissionConfig.advancedGeographicRestriction.vpnDetection,
            enabled: false // VPN検出無効
        }
    },
    dynamicPermissionConfig: {
        ...exports.TokyoAdvancedPermissionConfig.dynamicPermissionConfig,
        refreshIntervalSeconds: 60, // より頻繁な更新
        temporaryAccess: {
            ...exports.TokyoAdvancedPermissionConfig.dynamicPermissionConfig.temporaryAccess,
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
exports.ProductionAdvancedPermissionConfig = {
    ...exports.TokyoAdvancedPermissionConfig,
    /** 本番環境では最大限のセキュリティ */
    adminBypass: false, // 管理者も例外なし
    timeBasedRestriction: {
        ...exports.TokyoAdvancedPermissionConfig.timeBasedRestriction,
        emergencyAccessUsers: [
            'emergency001' // 緊急アクセスユーザーを最小限に
        ],
        afterHoursRoles: ['admin'] // 管理者のみ時間外アクセス可能
    },
    advancedGeographicRestriction: {
        ...exports.TokyoAdvancedPermissionConfig.advancedGeographicRestriction,
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
        ...exports.TokyoAdvancedPermissionConfig.dynamicPermissionConfig,
        temporaryAccess: {
            ...exports.TokyoAdvancedPermissionConfig.dynamicPermissionConfig.temporaryAccess,
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
function getAdvancedPermissionConfig(environment) {
    switch (environment.toLowerCase()) {
        case 'development':
        case 'dev':
            return exports.DevelopmentAdvancedPermissionConfig;
        case 'production':
        case 'prod':
            return exports.ProductionAdvancedPermissionConfig;
        case 'staging':
        case 'test':
            return exports.TokyoAdvancedPermissionConfig;
        default:
            return exports.TokyoAdvancedPermissionConfig;
    }
}
/**
 * 役職レベル階層定義
 */
exports.RoleLevelHierarchy = {
    'admin': ['admin', 'manager', 'user', 'guest'],
    'manager': ['manager', 'user', 'guest'],
    'user': ['user', 'guest'],
    'guest': ['guest']
};
/**
 * データ分類レベル階層定義
 */
exports.DataClassificationHierarchy = {
    'restricted': ['restricted', 'confidential', 'internal', 'public'],
    'confidential': ['confidential', 'internal', 'public'],
    'internal': ['internal', 'public'],
    'public': ['public']
};
/**
 * 営業時間判定関数（改善版）
 */
function isBusinessHours(date, config, timezone = 'Asia/Tokyo') {
    // 入力値検証
    if (!date || !(date instanceof Date) || !config) {
        return false;
    }
    if (!config.enabled)
        return true;
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
    }
    catch (error) {
        // エラー時は安全側に倒してfalseを返す
        console.error('営業時間判定エラー:', error);
        return false;
    }
}
/**
 * IP範囲チェック関数（改善版）
 */
function isIpInRange(ipAddress, allowedRanges) {
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
            }
            else {
                // 完全一致の場合
                if (ipAddress === range) {
                    return true;
                }
            }
        }
    }
    catch (error) {
        // エラー時は安全側に倒してfalseを返す
        console.error('IP範囲チェックエラー:', error);
        return false;
    }
    return false;
}
/**
 * IPアドレスを32ビット整数に変換
 */
function ipToInt(ip) {
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
function calculateInheritedPermissions(userRole, dataClassification) {
    return {
        allowedRoles: exports.RoleLevelHierarchy[userRole] || ['guest'],
        allowedClassifications: exports.DataClassificationHierarchy[dataClassification] || ['public']
    };
}
/**
 * 設定検証関数
 */
function validatePermissionConfig(config) {
    const errors = [];
    const warnings = [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2YW5jZWQtcGVybWlzc2lvbi1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhZHZhbmNlZC1wZXJtaXNzaW9uLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7OztBQThSSCxrRUFpQkM7QUF5QkQsMENBc0RDO0FBS0Qsa0NBOENDO0FBbUJELHNFQVdDO0FBS0QsNERBK0RDO0FBeGdCRDs7R0FFRztBQUNVLFFBQUEsNkJBQTZCLEdBQTJCO0lBQ25FLGdCQUFnQjtJQUNoQixPQUFPLEVBQUUsSUFBSTtJQUViLGlCQUFpQjtJQUNqQixXQUFXLEVBQUUsSUFBSTtJQUVqQixjQUFjO0lBQ2QsV0FBVyxFQUFFLEtBQUssRUFBRSx3QkFBd0I7SUFFNUMsY0FBYztJQUNkLFlBQVksRUFBRSxJQUFJO0lBRWxCLGNBQWM7SUFDZCxXQUFXLEVBQUU7UUFDWCxPQUFPLEVBQUUsSUFBSTtRQUNiLFVBQVUsRUFBRSxHQUFHLEVBQUUsS0FBSztRQUN0QixVQUFVLEVBQUUsS0FBSztRQUNqQixZQUFZO1FBQ1osaUJBQWlCLEVBQUU7WUFDakIsa0JBQWtCLEVBQUUsR0FBRyxFQUFFLGNBQWM7WUFDdkMsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLHFCQUFxQjtZQUNqRCxjQUFjLEVBQUUsSUFBSSxFQUFFLGFBQWE7WUFDbkMsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLFlBQVk7U0FDNUM7UUFDRCxhQUFhO1FBQ2IsaUJBQWlCLEVBQUU7WUFDakIsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0Qix5QkFBeUIsRUFBRSxJQUFJO1lBQy9CLHNCQUFzQixFQUFFLElBQUk7U0FDN0I7S0FDRjtJQUVELGdCQUFnQjtJQUNoQixpQkFBaUIsRUFBRTtRQUNqQixhQUFhLEVBQUUsSUFBSTtRQUNuQixTQUFTLEVBQUUsSUFBSTtRQUNmLFNBQVMsRUFBRSxHQUFHO0tBQ2Y7SUFFRCxjQUFjO0lBQ2Qsb0JBQW9CLEVBQUU7UUFDcEIsT0FBTyxFQUFF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TSxTQUFTLEdBQUcsTUFBTSxDQUFDLDZCQUE2QixDQUFDO1FBRXZELElBQUksU0FBUyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM1QyxRQUFRLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFFRCxZQUFZO1FBQ1osS0FBSyxNQUFNLE9BQU8sSUFBSSxTQUFTLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDaEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxDQUFDLEVBQUUsQ0FBQztnQkFDckYsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDdkMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsWUFBWTtJQUNaLElBQUksTUFBTSxDQUFDLHVCQUF1QixFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQzVDLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQztRQUVyRCxJQUFJLGFBQWEsQ0FBQyxzQkFBc0IsR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUM5QyxRQUFRLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELElBQUksYUFBYSxDQUFDLGVBQWUsRUFBRSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsZUFBZSxFQUFFLHNCQUFzQixFQUFFLENBQUM7WUFDOUcsTUFBTSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ2pELENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTztRQUNMLE9BQU8sRUFBRSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUM7UUFDNUIsTUFBTTtRQUNOLFFBQVE7S0FDVCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog6auY5bqm44Gq5qip6ZmQ5Yi25b6h6Kit5a6aXG4gKiBcbiAqIOaZgumWk+ODmeODvOOCueWItumZkOOAgeWcsOeQhueahOWItumZkOOAgeWLleeahOaoqemZkOOBrue1seWQiOioreWumlxuICog44Ko44Oz44K/44O844OX44Op44Kk44K644Kw44Os44O844OJ44Gu44K744Kt44Ol44Oq44OG44Kj6KaB5Lu25a++5b+cXG4gKi9cblxuaW1wb3J0IHtcbiAgUGVybWlzc2lvbkZpbHRlckNvbmZpZyxcbiAgVGltZUJhc2VkUmVzdHJpY3Rpb24sXG4gIEFkdmFuY2VkR2VvZ3JhcGhpY1Jlc3RyaWN0aW9uLFxuICBEeW5hbWljUGVybWlzc2lvbkNvbmZpZyxcbiAgUm9sZUxldmVsLFxuICBEYXRhQ2xhc3NpZmljYXRpb25MZXZlbFxufSBmcm9tICcuLi9pbnRlcmZhY2VzL3Blcm1pc3Npb24tY29uZmlnJztcblxuLyoqXG4gKiDmnbHkuqzmnKznpL7lkJHjgZHpq5jluqbmqKnpmZDliLblvqHoqK3lrppcbiAqL1xuZXhwb3J0IGNvbnN0IFRva3lvQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnOiBQZXJtaXNzaW9uRmlsdGVyQ29uZmlnID0ge1xuICAvKiog5qip6ZmQ44OB44Kn44OD44Kv5pyJ5Yq55YyWICovXG4gIGVuYWJsZWQ6IHRydWUsXG4gIFxuICAvKiog44OH44OV44Kp44Or44OI5ouS5ZCm44Oi44O844OJICovXG4gIGRlZmF1bHREZW55OiB0cnVlLFxuICBcbiAgLyoqIOeuoeeQhuiAheODkOOCpOODkeOCuSAqL1xuICBhZG1pbkJ5cGFzczogZmFsc2UsIC8vIOOCu+OCreODpeODquODhuOCo+W8t+WMluOBruOBn+OCgeeuoeeQhuiAheOCguODgeOCp+ODg+OCr+WvvuixoVxuICBcbiAgLyoqIOebo+afu+ODreOCsOacieWKueWMliAqL1xuICBhdWRpdExvZ2dpbmc6IHRydWUsXG4gIFxuICAvKiog44Kt44Oj44OD44K344Ol6Kit5a6aICovXG4gIGNhY2hlQ29uZmlnOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICB0dGxTZWNvbmRzOiAzMDAsIC8vIDXliIZcbiAgICBtYXhFbnRyaWVzOiAxMDAwMCxcbiAgICAvLyDpmo7lsaTjgq3jg6Pjg4Pjgrfjg6XoqK3lrppcbiAgICBoaWVyYXJjaGljYWxDYWNoZToge1xuICAgICAgdXNlclBlcm1pc3Npb25zVHRsOiA2MDAsIC8vIOODpuODvOOCtuODvOaoqemZkDogMTDliIZcbiAgICAgIHByb2plY3RNZW1iZXJzaGlwVHRsOiAxODAwLCAvLyDjg5fjg63jgrjjgqfjgq/jg4jjg6Hjg7Pjg5Djg7zjgrfjg4Pjg5c6IDMw5YiGXG4gICAgICBnZW9sb2NhdGlvblR0bDogMzYwMCwgLy8g5Zyw55CG55qE5oOF5aCxOiAx5pmC6ZaTXG4gICAgICBvcmdhbml6YXRpb25IaWVyYXJjaHlUdGw6IDcyMDAgLy8g57WE57mU6ZqO5bGkOiAy5pmC6ZaTXG4gICAgfSxcbiAgICAvLyDjgq3jg6Pjg4Pjgrfjg6XnhKHlirnljJboqK3lrppcbiAgICBpbnZhbGlkYXRpb25SdWxlczoge1xuICAgICAgb25Vc2VyUm9sZUNoYW5nZTogdHJ1ZSxcbiAgICAgIG9uUHJvamVjdE1lbWJlcnNoaXBDaGFuZ2U6IHRydWUsXG4gICAgICBvblNlY3VyaXR5UG9saWN5VXBkYXRlOiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgLyoqIOODkeODleOCqeODvOODnuODs+OCueioreWumiAqL1xuICBwZXJmb3JtYW5jZUNvbmZpZzoge1xuICAgIG1heEZpbHRlclNpemU6IDEwMDAsXG4gICAgdGltZW91dE1zOiA1MDAwLFxuICAgIGJhdGNoU2l6ZTogMTAwXG4gIH0sXG4gIFxuICAvKiog5pmC6ZaT44OZ44O844K55Yi26ZmQICovXG4gIHRpbWVCYXNlZFJlc3RyaWN0aW9uOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBidXNpbmVzc0hvdXJzOiB7XG4gICAgICBzdGFydEhvdXI6IDksXG4gICAgICBlbmRIb3VyOiAxOCxcbiAgICAgIGJ1c2luZXNzRGF5czogWzEsIDIsIDMsIDQsIDVdLCAvLyDmnIgt6YeRXG4gICAgICB0aW1lem9uZTogJ0FzaWEvVG9reW8nXG4gICAgfSxcbiAgICBlbWVyZ2VuY3lBY2Nlc3NVc2VyczogW1xuICAgICAgJ2FkbWluMDAxJyxcbiAgICAgICdlbWVyZ2VuY3kwMDEnLFxuICAgICAgJ3NlY3VyaXR5X2FkbWluJyxcbiAgICAgICdzeXN0ZW1fYWRtaW4nXG4gICAgXSxcbiAgICBhZnRlckhvdXJzUm9sZXM6IFsnYWRtaW4nLCAnbWFuYWdlciddLFxuICAgIGhvbGlkYXlzOiB7XG4gICAgICBkYXRlczogW1xuICAgICAgICAnMjAyNS0wMS0wMScsIC8vIOWFg+aXpVxuICAgICAgICAnMjAyNS0wMS0xMycsIC8vIOaIkOS6uuOBruaXpVxuICAgICAgICAnMjAyNS0wMi0xMScsIC8vIOW7uuWbveiomOW/teOBruaXpVxuICAgICAgICAnMjAyNS0wMi0yMycsIC8vIOWkqeeah+iqleeUn+aXpVxuICAgICAgICAnMjAyNS0wMy0yMCcsIC8vIOaYpeWIhuOBruaXpVxuICAgICAgICAnMjAyNS0wNC0yOScsIC8vIOaYreWSjOOBruaXpVxuICAgICAgICAnMjAyNS0wNS0wMycsIC8vIOaGsuazleiomOW/teaXpVxuICAgICAgICAnMjAyNS0wNS0wNCcsIC8vIOOBv+OBqeOCiuOBruaXpVxuICAgICAgICAnMjAyNS0wNS0wNScsIC8vIOOBk+OBqeOCguOBruaXpVxuICAgICAgICAnMjAyNS0wNy0yMScsIC8vIOa1t+OBruaXpVxuICAgICAgICAnMjAyNS0wOC0xMScsIC8vIOWxseOBruaXpVxuICAgICAgICAnMjAyNS0wOS0xNScsIC8vIOaVrOiAgeOBruaXpVxuICAgICAgICAnMjAyNS0wOS0yMycsIC8vIOeni+WIhuOBruaXpVxuICAgICAgICAnMjAyNS0xMC0xMycsIC8vIOOCueODneODvOODhOOBruaXpVxuICAgICAgICAnMjAyNS0xMS0wMycsIC8vIOaWh+WMluOBruaXpVxuICAgICAgICAnMjAyNS0xMS0yMycsIC8vIOWLpOWKtOaEn+isneOBruaXpVxuICAgICAgICAnMjAyNS0xMi0yOScsIC8vIOW5tOacq+S8keaah1xuICAgICAgICAnMjAyNS0xMi0zMCcsIC8vIOW5tOacq+S8keaah1xuICAgICAgICAnMjAyNS0xMi0zMScgIC8vIOWkp+aZpuaXpVxuICAgICAgXSxcbiAgICAgIGFsbG93QWNjZXNzOiBmYWxzZSAvLyDnpZ3ml6Xjga/jgqLjgq/jgrvjgrnmi5LlkKZcbiAgICB9XG4gIH0sXG4gIFxuICAvKiog6auY5bqm44Gq5Zyw55CG55qE5Yi26ZmQICovXG4gIGFkdmFuY2VkR2VvZ3JhcGhpY1Jlc3RyaWN0aW9uOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBhbGxvd2VkQ291bnRyaWVzOiBbJ0pQJ10sIC8vIOaXpeacrOOBruOBv1xuICAgIGFsbG93ZWRSZWdpb25zOiBbXG4gICAgICAnVG9reW8nLFxuICAgICAgJ09zYWthJyxcbiAgICAgICdOYWdveWEnLFxuICAgICAgJ0Z1a3Vva2EnLFxuICAgICAgJ1NhcHBvcm8nXG4gICAgXSxcbiAgICBhbGxvd2VkSXBSYW5nZXM6IFtcbiAgICAgICcyMDMuMC4xMTMuMC8yNCcsICAgIC8vIOacrOekvuOCquODleOCo+OCuVxuICAgICAgJzE5OC41MS4xMDAuMC8yNCcsICAgLy8g5pSv56S+44Kq44OV44Kj44K5XG4gICAgICAnMTkyLjAuMi4wLzI0JywgICAgICAvLyDjg6rjg6Ljg7zjg4jjg6/jg7zjgq/nlKhWUE5cbiAgICAgICcxMC4wLjAuMC84JywgICAgICAgIC8vIOWGhemDqOODjeODg+ODiOODr+ODvOOCr1xuICAgICAgJzE3Mi4xNi4wLjAvMTInLCAgICAgLy8g44OX44Op44Kk44OZ44O844OI44ON44OD44OI44Ov44O844KvXG4gICAgICAnMTkyLjE2OC4wLjAvMTYnICAgICAvLyDjg63jg7zjgqvjg6vjg43jg4Pjg4jjg6/jg7zjgq9cbiAgICBdLFxuICAgIHZwbkRldGVjdGlvbjoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGFsbG93ZWRWcG5Vc2VyczogW1xuICAgICAgICAnYWRtaW4wMDEnLFxuICAgICAgICAndnBuX3VzZXIwMDEnLFxuICAgICAgICAncmVtb3RlX21hbmFnZXInLFxuICAgICAgICAnZmllbGRfZW5naW5lZXInXG4gICAgICBdLFxuICAgICAgZGV0ZWN0aW9uQXBpOiB7XG4gICAgICAgIGVuZHBvaW50OiAnYXBpLnZwbmRldGVjdGlvbi5jb20nLFxuICAgICAgICBhcGlLZXk6IHByb2Nlc3MuZW52LlZQTl9ERVRFQ1RJT05fQVBJX0tFWSB8fCAnJywgLy8g55Kw5aKD5aSJ5pWw44GL44KJ5a6J5YWo44Gr5Y+W5b6XXG4gICAgICAgIHRpbWVvdXQ6IDMwMDBcbiAgICAgIH1cbiAgICB9LFxuICAgIGV4ZW1wdFVzZXJzOiBbXG4gICAgICAnZW1lcmdlbmN5MDAxJyxcbiAgICAgICdnbG9iYWxfYWRtaW4nLFxuICAgICAgJ3NlY3VyaXR5X2FkbWluJ1xuICAgIF0sXG4gICAgcmlza0Jhc2VkQXV0aDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGFub21hbHlEZXRlY3Rpb246IHRydWUsXG4gICAgICByZXF1aXJlQWRkaXRpb25hbEF1dGg6IHRydWVcbiAgICB9XG4gIH0sXG4gIFxuICAvKiog5YuV55qE5qip6ZmQ6Kit5a6aICovXG4gIGR5bmFtaWNQZXJtaXNzaW9uQ29uZmlnOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBwcm9qZWN0QmFzZWRBY2Nlc3M6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBwcm9qZWN0UGVybWlzc2lvbnM6IHtcbiAgICAgICAgJ3Byb2plY3RfYWxwaGEnOiBbJ2NvbmZpZGVudGlhbCcsICdpbnRlcm5hbCcsICdwdWJsaWMnXSxcbiAgICAgICAgJ3Byb2plY3RfYmV0YSc6IFsnaW50ZXJuYWwnLCAncHVibGljJ10sXG4gICAgICAgICdwcm9qZWN0X2dhbW1hJzogWydyZXN0cmljdGVkJywgJ2NvbmZpZGVudGlhbCcsICdpbnRlcm5hbCcsICdwdWJsaWMnXSxcbiAgICAgICAgJ3Byb2plY3RfZGVsdGEnOiBbJ3B1YmxpYyddLFxuICAgICAgICAnZW1lcmdlbmN5X3Jlc3BvbnNlJzogWydyZXN0cmljdGVkJywgJ2NvbmZpZGVudGlhbCcsICdpbnRlcm5hbCcsICdwdWJsaWMnXVxuICAgICAgfSxcbiAgICAgIHByb2plY3RNZW1iZXJzaGlwQXBpOiB7XG4gICAgICAgIGVuZHBvaW50OiAnYXBpLnByb2plY3RtYW5hZ2VtZW50LmludGVybmFsJyxcbiAgICAgICAgYXBpS2V5OiBwcm9jZXNzLmVudi5QUk9KRUNUX0FQSV9LRVkgfHwgJycsIC8vIOeSsOWig+WkieaVsOOBi+OCieWuieWFqOOBq+WPluW+l1xuICAgICAgICBjYWNoZVNlY29uZHM6IDYwMCAvLyAxMOWIhuOCreODo+ODg+OCt+ODpVxuICAgICAgfSxcbiAgICAgIGF1dG9HcmFudFBlcm1pc3Npb25zOiB0cnVlXG4gICAgfSxcbiAgICBvcmdhbml6YXRpb25hbEhpZXJhcmNoeToge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGhpZXJhcmNoeToge1xuICAgICAgICAnQ0VPJzogWydDVE8nLCAnQ0ZPJywgJ0NPTyddLFxuICAgICAgICAnQ1RPJzogWydFbmdpbmVlcmluZ19EaXJlY3RvcicsICdJVF9EaXJlY3RvciddLFxuICAgICAgICAnQ0ZPJzogWydGaW5hbmNlX0RpcmVjdG9yJywgJ0FjY291bnRpbmdfTWFuYWdlciddLFxuICAgICAgICAnQ09PJzogWydPcGVyYXRpb25zX0RpcmVjdG9yJywgJ0hSX0RpcmVjdG9yJ10sXG4gICAgICAgICdFbmdpbmVlcmluZ19EaXJlY3Rvcic6IFsnU2VuaW9yX0VuZ2luZWVyJywgJ1RlY2hfTGVhZCddLFxuICAgICAgICAnSVRfRGlyZWN0b3InOiBbJ1N5c3RlbV9BZG1pbicsICdTZWN1cml0eV9BZG1pbiddLFxuICAgICAgICAnRmluYW5jZV9EaXJlY3Rvcic6IFsnU2VuaW9yX0FjY291bnRhbnQnLCAnRmluYW5jaWFsX0FuYWx5c3QnXSxcbiAgICAgICAgJ09wZXJhdGlvbnNfRGlyZWN0b3InOiBbJ09wZXJhdGlvbnNfTWFuYWdlcicsICdQcm9qZWN0X01hbmFnZXInXSxcbiAgICAgICAgJ0hSX0RpcmVjdG9yJzogWydIUl9NYW5hZ2VyJywgJ1JlY3J1aXRlciddXG4gICAgICB9LFxuICAgICAgaW5oZXJpdGVkUGVybWlzc2lvbnM6IHRydWUsXG4gICAgICBtYXhEZXB0aDogNVxuICAgIH0sXG4gICAgdGVtcG9yYXJ5QWNjZXNzOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgZGVmYXVsdER1cmF0aW9uU2Vjb25kczogNzIwMCwgLy8gMuaZgumWk1xuICAgICAgbWF4RHVyYXRpb25TZWNvbmRzOiA4NjQwMCwgLy8gMjTmmYLplpNcbiAgICAgIGFwcHJvdmVyczogW1xuICAgICAgICAnYWRtaW4wMDEnLFxuICAgICAgICAnc2VjdXJpdHlfYWRtaW4nLFxuICAgICAgICAnZGVwYXJ0bWVudF9tYW5hZ2VyJ1xuICAgICAgXSxcbiAgICAgIGF1dG9BcHByb3ZhbFJ1bGVzOiB7XG4gICAgICAgIG1heER1cmF0aW9uU2Vjb25kczogMzYwMCwgLy8gMeaZgumWk+S7peS4i+OBr+iHquWLleaJv+iqjVxuICAgICAgICBhbGxvd2VkUm9sZXM6IFsnbWFuYWdlcicsICdhZG1pbiddLFxuICAgICAgICBhbGxvd2VkRGF0YUNsYXNzaWZpY2F0aW9uczogWydwdWJsaWMnLCAnaW50ZXJuYWwnXVxuICAgICAgfVxuICAgIH0sXG4gICAgcmVmcmVzaEludGVydmFsU2Vjb25kczogMzAwLCAvLyA15YiGXG4gICAgaW5oZXJpdGFuY2VSdWxlczoge1xuICAgICAgZGVwYXJ0bWVudEluaGVyaXRhbmNlOiB0cnVlLFxuICAgICAgcHJvamVjdEluaGVyaXRhbmNlOiB0cnVlLFxuICAgICAgdGltZVJlc3RyaWN0aW9uSW5oZXJpdGFuY2U6IGZhbHNlIC8vIOaZgumWk+WItumZkOOBr+e2meaJv+OBl+OBquOBhFxuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiDplovnmbrnkrDlooPlkJHjgZHnt6nlkozoqK3lrppcbiAqL1xuZXhwb3J0IGNvbnN0IERldmVsb3BtZW50QWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnOiBQZXJtaXNzaW9uRmlsdGVyQ29uZmlnID0ge1xuICAuLi5Ub2t5b0FkdmFuY2VkUGVybWlzc2lvbkNvbmZpZyxcbiAgXG4gIC8qKiDplovnmbrnkrDlooPjgafjga/kuIDpg6jliLbpmZDjgpLnt6nlkowgKi9cbiAgdGltZUJhc2VkUmVzdHJpY3Rpb246IHtcbiAgICAuLi5Ub2t5b0FkdmFuY2VkUGVybWlzc2lvbkNvbmZpZy50aW1lQmFzZWRSZXN0cmljdGlvbixcbiAgICBlbmFibGVkOiBmYWxzZSAvLyDplovnmbrnkrDlooPjgafjga/mmYLplpPliLbpmZDnhKHlirlcbiAgfSxcbiAgXG4gIGFkdmFuY2VkR2VvZ3JhcGhpY1Jlc3RyaWN0aW9uOiB7XG4gICAgLi4uVG9reW9BZHZhbmNlZFBlcm1pc3Npb25Db25maWcuYWR2YW5jZWRHZW9ncmFwaGljUmVzdHJpY3Rpb24sXG4gICAgZW5hYmxlZDogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+WcsOeQhueahOWItumZkOeEoeWKuVxuICAgIGFsbG93ZWRDb3VudHJpZXM6IFsnSlAnLCAnVVMnLCAnU0cnLCAnQVUnXSwgLy8g44KI44KK5aSa44GP44Gu5Zu944KS6Kix5Y+vXG4gICAgdnBuRGV0ZWN0aW9uOiB7XG4gICAgICAuLi5Ub2t5b0FkdmFuY2VkUGVybWlzc2lvbkNvbmZpZy5hZHZhbmNlZEdlb2dyYXBoaWNSZXN0cmljdGlvbi52cG5EZXRlY3Rpb24sXG4gICAgICBlbmFibGVkOiBmYWxzZSAvLyBWUE7mpJzlh7rnhKHlirlcbiAgICB9XG4gIH0sXG4gIFxuICBkeW5hbWljUGVybWlzc2lvbkNvbmZpZzoge1xuICAgIC4uLlRva3lvQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnLmR5bmFtaWNQZXJtaXNzaW9uQ29uZmlnLFxuICAgIHJlZnJlc2hJbnRlcnZhbFNlY29uZHM6IDYwLCAvLyDjgojjgorpoLvnuYHjgarmm7TmlrBcbiAgICB0ZW1wb3JhcnlBY2Nlc3M6IHtcbiAgICAgIC4uLlRva3lvQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnLmR5bmFtaWNQZXJtaXNzaW9uQ29uZmlnLnRlbXBvcmFyeUFjY2VzcyxcbiAgICAgIGRlZmF1bHREdXJhdGlvblNlY29uZHM6IDI4ODAwLCAvLyA45pmC6ZaTXG4gICAgICBtYXhEdXJhdGlvblNlY29uZHM6IDYwNDgwMCwgLy8gMemAsemWk1xuICAgICAgYXV0b0FwcHJvdmFsUnVsZXM6IHtcbiAgICAgICAgbWF4RHVyYXRpb25TZWNvbmRzOiA4NjQwMCwgLy8gMjTmmYLplpPku6XkuIvjga/oh6rli5Xmib/oqo1cbiAgICAgICAgYWxsb3dlZFJvbGVzOiBbJ3VzZXInLCAnbWFuYWdlcicsICdhZG1pbiddLFxuICAgICAgICBhbGxvd2VkRGF0YUNsYXNzaWZpY2F0aW9uczogWydwdWJsaWMnLCAnaW50ZXJuYWwnLCAnY29uZmlkZW50aWFsJ11cbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICog5pys55Wq55Kw5aKD5ZCR44GR5Y6z5qC86Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBQcm9kdWN0aW9uQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnOiBQZXJtaXNzaW9uRmlsdGVyQ29uZmlnID0ge1xuICAuLi5Ub2t5b0FkdmFuY2VkUGVybWlzc2lvbkNvbmZpZyxcbiAgXG4gIC8qKiDmnKznlarnkrDlooPjgafjga/mnIDlpKfpmZDjga7jgrvjgq3jg6Xjg6rjg4bjgqMgKi9cbiAgYWRtaW5CeXBhc3M6IGZhbHNlLCAvLyDnrqHnkIbogIXjgoLkvovlpJbjgarjgZdcbiAgXG4gIHRpbWVCYXNlZFJlc3RyaWN0aW9uOiB7XG4gICAgLi4uVG9reW9BZHZhbmNlZFBlcm1pc3Npb25Db25maWcudGltZUJhc2VkUmVzdHJpY3Rpb24sXG4gICAgZW1lcmdlbmN5QWNjZXNzVXNlcnM6IFtcbiAgICAgICdlbWVyZ2VuY3kwMDEnIC8vIOe3iuaApeOCouOCr+OCu+OCueODpuODvOOCtuODvOOCkuacgOWwj+mZkOOBq1xuICAgIF0sXG4gICAgYWZ0ZXJIb3Vyc1JvbGVzOiBbJ2FkbWluJ10gLy8g566h55CG6ICF44Gu44G/5pmC6ZaT5aSW44Ki44Kv44K744K55Y+v6IO9XG4gIH0sXG4gIFxuICBhZHZhbmNlZEdlb2dyYXBoaWNSZXN0cmljdGlvbjoge1xuICAgIC4uLlRva3lvQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnLmFkdmFuY2VkR2VvZ3JhcGhpY1Jlc3RyaWN0aW9uLFxuICAgIGFsbG93ZWRDb3VudHJpZXM6IFsnSlAnXSwgLy8g5pel5pys44Gu44G/5Y6z5qC844Gr5Yi26ZmQXG4gICAgZXhlbXB0VXNlcnM6IFtcbiAgICAgICdlbWVyZ2VuY3kwMDEnIC8vIOS+i+WkluODpuODvOOCtuODvOOCkuacgOWwj+mZkOOBq1xuICAgIF0sXG4gICAgcmlza0Jhc2VkQXV0aDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGFub21hbHlEZXRlY3Rpb246IHRydWUsXG4gICAgICByZXF1aXJlQWRkaXRpb25hbEF1dGg6IHRydWVcbiAgICB9XG4gIH0sXG4gIFxuICBkeW5hbWljUGVybWlzc2lvbkNvbmZpZzoge1xuICAgIC4uLlRva3lvQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnLmR5bmFtaWNQZXJtaXNzaW9uQ29uZmlnLFxuICAgIHRlbXBvcmFyeUFjY2Vzczoge1xuICAgICAgLi4uVG9reW9BZHZhbmNlZFBlcm1pc3Npb25Db25maWcuZHluYW1pY1Blcm1pc3Npb25Db25maWcudGVtcG9yYXJ5QWNjZXNzLFxuICAgICAgZGVmYXVsdER1cmF0aW9uU2Vjb25kczogMzYwMCwgLy8gMeaZgumWk1xuICAgICAgbWF4RHVyYXRpb25TZWNvbmRzOiAxNDQwMCwgLy8gNOaZgumWk1xuICAgICAgYXV0b0FwcHJvdmFsUnVsZXM6IHtcbiAgICAgICAgbWF4RHVyYXRpb25TZWNvbmRzOiAxODAwLCAvLyAzMOWIhuS7peS4i+OBruOBv+iHquWLleaJv+iqjVxuICAgICAgICBhbGxvd2VkUm9sZXM6IFsnYWRtaW4nXSxcbiAgICAgICAgYWxsb3dlZERhdGFDbGFzc2lmaWNhdGlvbnM6IFsncHVibGljJ11cbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICog55Kw5aKD5Yil6Kit5a6a5Y+W5b6X6Zai5pWwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBZHZhbmNlZFBlcm1pc3Npb25Db25maWcoZW52aXJvbm1lbnQ6IHN0cmluZyk6IFBlcm1pc3Npb25GaWx0ZXJDb25maWcge1xuICBzd2l0Y2ggKGVudmlyb25tZW50LnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdkZXZlbG9wbWVudCc6XG4gICAgY2FzZSAnZGV2JzpcbiAgICAgIHJldHVybiBEZXZlbG9wbWVudEFkdmFuY2VkUGVybWlzc2lvbkNvbmZpZztcbiAgICBcbiAgICBjYXNlICdwcm9kdWN0aW9uJzpcbiAgICBjYXNlICdwcm9kJzpcbiAgICAgIHJldHVybiBQcm9kdWN0aW9uQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnO1xuICAgIFxuICAgIGNhc2UgJ3N0YWdpbmcnOlxuICAgIGNhc2UgJ3Rlc3QnOlxuICAgICAgcmV0dXJuIFRva3lvQWR2YW5jZWRQZXJtaXNzaW9uQ29uZmlnO1xuICAgIFxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gVG9reW9BZHZhbmNlZFBlcm1pc3Npb25Db25maWc7XG4gIH1cbn1cblxuLyoqXG4gKiDlvbnogbfjg6zjg5njg6vpmo7lsaTlrprnvqlcbiAqL1xuZXhwb3J0IGNvbnN0IFJvbGVMZXZlbEhpZXJhcmNoeTogUmVjb3JkPFJvbGVMZXZlbCwgUm9sZUxldmVsW10+ID0ge1xuICAnYWRtaW4nOiBbJ2FkbWluJywgJ21hbmFnZXInLCAndXNlcicsICdndWVzdCddLFxuICAnbWFuYWdlcic6IFsnbWFuYWdlcicsICd1c2VyJywgJ2d1ZXN0J10sXG4gICd1c2VyJzogWyd1c2VyJywgJ2d1ZXN0J10sXG4gICdndWVzdCc6IFsnZ3Vlc3QnXVxufTtcblxuLyoqXG4gKiDjg4fjg7zjgr/liIbpoZ7jg6zjg5njg6vpmo7lsaTlrprnvqlcbiAqL1xuZXhwb3J0IGNvbnN0IERhdGFDbGFzc2lmaWNhdGlvbkhpZXJhcmNoeTogUmVjb3JkPERhdGFDbGFzc2lmaWNhdGlvbkxldmVsLCBEYXRhQ2xhc3NpZmljYXRpb25MZXZlbFtdPiA9IHtcbiAgJ3Jlc3RyaWN0ZWQnOiBbJ3Jlc3RyaWN0ZWQnLCAnY29uZmlkZW50aWFsJywgJ2ludGVybmFsJywgJ3B1YmxpYyddLFxuICAnY29uZmlkZW50aWFsJzogWydjb25maWRlbnRpYWwnLCAnaW50ZXJuYWwnLCAncHVibGljJ10sXG4gICdpbnRlcm5hbCc6IFsnaW50ZXJuYWwnLCAncHVibGljJ10sXG4gICdwdWJsaWMnOiBbJ3B1YmxpYyddXG59O1xuXG4vKipcbiAqIOWWtualreaZgumWk+WIpOWumumWouaVsO+8iOaUueWWhOeJiO+8iVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNCdXNpbmVzc0hvdXJzKFxuICBkYXRlOiBEYXRlLCBcbiAgY29uZmlnOiBUaW1lQmFzZWRSZXN0cmljdGlvbixcbiAgdGltZXpvbmU6IHN0cmluZyA9ICdBc2lhL1Rva3lvJ1xuKTogYm9vbGVhbiB7XG4gIC8vIOWFpeWKm+WApOaknOiovFxuICBpZiAoIWRhdGUgfHwgIShkYXRlIGluc3RhbmNlb2YgRGF0ZSkgfHwgIWNvbmZpZykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgaWYgKCFjb25maWcuZW5hYmxlZCkgcmV0dXJuIHRydWU7XG4gIFxuICB0cnkge1xuICAgIC8vIOOCv+OCpOODoOOCvuODvOODs+WkieaPm++8iEludGwuRGF0ZVRpbWVGb3JtYXTjgpLkvb/nlKjvvIlcbiAgICBjb25zdCBmb3JtYXR0ZXIgPSBuZXcgSW50bC5EYXRlVGltZUZvcm1hdCgnamEtSlAnLCB7XG4gICAgICB0aW1lWm9uZTogdGltZXpvbmUsXG4gICAgICB5ZWFyOiAnbnVtZXJpYycsXG4gICAgICBtb250aDogJzItZGlnaXQnLFxuICAgICAgZGF5OiAnMi1kaWdpdCcsXG4gICAgICBob3VyOiAnMi1kaWdpdCcsXG4gICAgICBtaW51dGU6ICcyLWRpZ2l0JyxcbiAgICAgIGhvdXIxMjogZmFsc2VcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBwYXJ0cyA9IGZvcm1hdHRlci5mb3JtYXRUb1BhcnRzKGRhdGUpO1xuICAgIGNvbnN0IHllYXIgPSBwYXJzZUludChwYXJ0cy5maW5kKHAgPT4gcC50eXBlID09PSAneWVhcicpPy52YWx1ZSB8fCAnMCcpO1xuICAgIGNvbnN0IG1vbnRoID0gcGFyc2VJbnQocGFydHMuZmluZChwID0+IHAudHlwZSA9PT0gJ21vbnRoJyk/LnZhbHVlIHx8ICcwJyk7XG4gICAgY29uc3QgZGF5ID0gcGFyc2VJbnQocGFydHMuZmluZChwID0+IHAudHlwZSA9PT0gJ2RheScpPy52YWx1ZSB8fCAnMCcpO1xuICAgIGNvbnN0IGhvdXIgPSBwYXJzZUludChwYXJ0cy5maW5kKHAgPT4gcC50eXBlID09PSAnaG91cicpPy52YWx1ZSB8fCAnMCcpO1xuICAgIFxuICAgIGNvbnN0IGxvY2FsRGF0ZSA9IG5ldyBEYXRlKHllYXIsIG1vbnRoIC0gMSwgZGF5KTtcbiAgICBjb25zdCBkYXlPZldlZWsgPSBsb2NhbERhdGUuZ2V0RGF5KCk7XG4gICAgXG4gICAgLy8g56Wd5pel44OB44Kn44OD44KvXG4gICAgaWYgKGNvbmZpZy5ob2xpZGF5cykge1xuICAgICAgY29uc3QgZGF0ZVN0cmluZyA9IGAke3llYXJ9LSR7bW9udGgudG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpfS0ke2RheS50b1N0cmluZygpLnBhZFN0YXJ0KDIsICcwJyl9YDtcbiAgICAgIGlmIChjb25maWcuaG9saWRheXMuZGF0ZXMuaW5jbHVkZXMoZGF0ZVN0cmluZykpIHtcbiAgICAgICAgcmV0dXJuIGNvbmZpZy5ob2xpZGF5cy5hbGxvd0FjY2VzcztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5Za25qWt5pel44OB44Kn44OD44KvXG4gICAgaWYgKCFjb25maWcuYnVzaW5lc3NIb3Vycy5idXNpbmVzc0RheXMuaW5jbHVkZXMoZGF5T2ZXZWVrKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICAvLyDllrbmpa3mmYLplpPjg4Hjgqfjg4Pjgq9cbiAgICByZXR1cm4gaG91ciA+PSBjb25maWcuYnVzaW5lc3NIb3Vycy5zdGFydEhvdXIgJiYgaG91ciA8IGNvbmZpZy5idXNpbmVzc0hvdXJzLmVuZEhvdXI7XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8g44Ko44Op44O85pmC44Gv5a6J5YWo5YG044Gr5YCS44GX44GmZmFsc2XjgpLov5TjgZlcbiAgICBjb25zb2xlLmVycm9yKCfllrbmpa3mmYLplpPliKTlrprjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vKipcbiAqIElQ56+E5Zuy44OB44Kn44OD44Kv6Zai5pWw77yI5pS55ZaE54mI77yJXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0lwSW5SYW5nZShpcEFkZHJlc3M6IHN0cmluZywgYWxsb3dlZFJhbmdlczogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgLy8g5YWl5Yqb5YCk5qSc6Ki8XG4gIGlmICghaXBBZGRyZXNzIHx8ICFBcnJheS5pc0FycmF5KGFsbG93ZWRSYW5nZXMpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICAvLyBJUHY05b2i5byP44Gu5Z+65pys5qSc6Ki8XG4gIGNvbnN0IGlwdjRSZWdleCA9IC9eKFxcZHsxLDN9XFwuKXszfVxcZHsxLDN9JC87XG4gIGlmICghaXB2NFJlZ2V4LnRlc3QoaXBBZGRyZXNzKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgdHJ5IHtcbiAgICBmb3IgKGNvbnN0IHJhbmdlIG9mIGFsbG93ZWRSYW5nZXMpIHtcbiAgICAgIGlmIChyYW5nZS5pbmNsdWRlcygnLycpKSB7XG4gICAgICAgIC8vIENJRFLoqJjms5Xjga7loLTlkIhcbiAgICAgICAgY29uc3QgW25ldHdvcmssIHByZWZpeExlbmd0aF0gPSByYW5nZS5zcGxpdCgnLycpO1xuICAgICAgICBjb25zdCBwcmVmaXggPSBwYXJzZUludChwcmVmaXhMZW5ndGgsIDEwKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOODl+ODrOODleOCo+ODg+OCr+OCuemVt+OBruaknOiovFxuICAgICAgICBpZiAoaXNOYU4ocHJlZml4KSB8fCBwcmVmaXggPCAwIHx8IHByZWZpeCA+IDMyKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIElQ44Ki44OJ44Os44K544KSMzLjg5Pjg4Pjg4jmlbTmlbDjgavlpInmj5tcbiAgICAgICAgY29uc3QgaXBJbnQgPSBpcFRvSW50KGlwQWRkcmVzcyk7XG4gICAgICAgIGNvbnN0IG5ldHdvcmtJbnQgPSBpcFRvSW50KG5ldHdvcmspO1xuICAgICAgICBjb25zdCBtYXNrID0gKDB4RkZGRkZGRkYgPDwgKDMyIC0gcHJlZml4KSkgPj4+IDA7XG4gICAgICAgIFxuICAgICAgICBpZiAoKGlwSW50ICYgbWFzaykgPT09IChuZXR3b3JrSW50ICYgbWFzaykpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8g5a6M5YWo5LiA6Ie044Gu5aC05ZCIXG4gICAgICAgIGlmIChpcEFkZHJlc3MgPT09IHJhbmdlKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8g44Ko44Op44O85pmC44Gv5a6J5YWo5YG044Gr5YCS44GX44GmZmFsc2XjgpLov5TjgZlcbiAgICBjb25zb2xlLmVycm9yKCdJUOevhOWbsuODgeOCp+ODg+OCr+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogSVDjgqLjg4njg6zjgrnjgpIzMuODk+ODg+ODiOaVtOaVsOOBq+WkieaPm1xuICovXG5mdW5jdGlvbiBpcFRvSW50KGlwOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBwYXJ0cyA9IGlwLnNwbGl0KCcuJykubWFwKHBhcnQgPT4gcGFyc2VJbnQocGFydCwgMTApKTtcbiAgXG4gIC8vIOWQhOOCquOCr+ODhuODg+ODiOOBruevhOWbsuaknOiovFxuICBpZiAocGFydHMuc29tZShwYXJ0ID0+IGlzTmFOKHBhcnQpIHx8IHBhcnQgPCAwIHx8IHBhcnQgPiAyNTUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGDnhKHlirnjgapJUOOCouODieODrOOCuTogJHtpcH1gKTtcbiAgfVxuICBcbiAgcmV0dXJuIChwYXJ0c1swXSA8PCAyNCkgKyAocGFydHNbMV0gPDwgMTYpICsgKHBhcnRzWzJdIDw8IDgpICsgcGFydHNbM107XG59XG5cbi8qKlxuICog5qip6ZmQ57aZ5om/6KiI566X6Zai5pWwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVJbmhlcml0ZWRQZXJtaXNzaW9ucyhcbiAgdXNlclJvbGU6IFJvbGVMZXZlbCxcbiAgZGF0YUNsYXNzaWZpY2F0aW9uOiBEYXRhQ2xhc3NpZmljYXRpb25MZXZlbFxuKToge1xuICBhbGxvd2VkUm9sZXM6IFJvbGVMZXZlbFtdO1xuICBhbGxvd2VkQ2xhc3NpZmljYXRpb25zOiBEYXRhQ2xhc3NpZmljYXRpb25MZXZlbFtdO1xufSB7XG4gIHJldHVybiB7XG4gICAgYWxsb3dlZFJvbGVzOiBSb2xlTGV2ZWxIaWVyYXJjaHlbdXNlclJvbGVdIHx8IFsnZ3Vlc3QnXSxcbiAgICBhbGxvd2VkQ2xhc3NpZmljYXRpb25zOiBEYXRhQ2xhc3NpZmljYXRpb25IaWVyYXJjaHlbZGF0YUNsYXNzaWZpY2F0aW9uXSB8fCBbJ3B1YmxpYyddXG4gIH07XG59XG5cbi8qKlxuICog6Kit5a6a5qSc6Ki86Zai5pWwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVBlcm1pc3Npb25Db25maWcoY29uZmlnOiBQZXJtaXNzaW9uRmlsdGVyQ29uZmlnKToge1xuICBpc1ZhbGlkOiBib29sZWFuO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59IHtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgXG4gIC8vIOWfuuacrOioreWumuOBruaknOiovFxuICBpZiAoY29uZmlnLnBlcmZvcm1hbmNlQ29uZmlnLnRpbWVvdXRNcyA8IDEwMDApIHtcbiAgICB3YXJuaW5ncy5wdXNoKCfjgr/jgqTjg6DjgqLjgqbjg4jmmYLplpPjgYznn63jgZnjgY7jgb7jgZnvvIjmjqjlpag6IDUwMDBtc+S7peS4iu+8iScpO1xuICB9XG4gIFxuICBpZiAoY29uZmlnLnBlcmZvcm1hbmNlQ29uZmlnLm1heEZpbHRlclNpemUgPiAxMDAwMCkge1xuICAgIHdhcm5pbmdzLnB1c2goJ+acgOWkp+ODleOCo+ODq+OCv+ODvOOCteOCpOOCuuOBjOWkp+OBjeOBmeOBjuOBvuOBme+8iOaOqOWlqDogMTAwMOS7peS4i++8iScpO1xuICB9XG4gIFxuICAvLyDmmYLplpPjg5njg7zjgrnliLbpmZDjga7mpJzoqLxcbiAgaWYgKGNvbmZpZy50aW1lQmFzZWRSZXN0cmljdGlvbj8uZW5hYmxlZCkge1xuICAgIGNvbnN0IGJ1c2luZXNzSG91cnMgPSBjb25maWcudGltZUJhc2VkUmVzdHJpY3Rpb24uYnVzaW5lc3NIb3VycztcbiAgICBpZiAoYnVzaW5lc3NIb3Vycy5zdGFydEhvdXIgPj0gYnVzaW5lc3NIb3Vycy5lbmRIb3VyKSB7XG4gICAgICBlcnJvcnMucHVzaCgn5Za25qWt6ZaL5aeL5pmC6ZaT44GM57WC5LqG5pmC6ZaT5Lul6ZmN44Gr6Kit5a6a44GV44KM44Gm44GE44G+44GZJyk7XG4gICAgfVxuICAgIFxuICAgIGlmIChidXNpbmVzc0hvdXJzLmJ1c2luZXNzRGF5cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGVycm9ycy5wdXNoKCfllrbmpa3ml6XjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIOWcsOeQhueahOWItumZkOOBruaknOiovFxuICBpZiAoY29uZmlnLmFkdmFuY2VkR2VvZ3JhcGhpY1Jlc3RyaWN0aW9uPy5lbmFibGVkKSB7XG4gICAgY29uc3QgZ2VvQ29uZmlnID0gY29uZmlnLmFkdmFuY2VkR2VvZ3JhcGhpY1Jlc3RyaWN0aW9uO1xuICAgIFxuICAgIGlmIChnZW9Db25maWcuYWxsb3dlZENvdW50cmllcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ+ioseWPr+WbveOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cbiAgICBcbiAgICAvLyBJUOevhOWbsuOBruWfuuacrOaknOiovFxuICAgIGZvciAoY29uc3QgaXBSYW5nZSBvZiBnZW9Db25maWcuYWxsb3dlZElwUmFuZ2VzKSB7XG4gICAgICBpZiAoIWlwUmFuZ2UuaW5jbHVkZXMoJy8nKSAmJiAhaXBSYW5nZS5tYXRjaCgvXlxcZHsxLDN9XFwuXFxkezEsM31cXC5cXGR7MSwzfVxcLlxcZHsxLDN9JC8pKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGDnhKHlirnjgapJUOevhOWbsuW9ouW8jzogJHtpcFJhbmdlfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgLy8g5YuV55qE5qip6ZmQ6Kit5a6a44Gu5qSc6Ki8XG4gIGlmIChjb25maWcuZHluYW1pY1Blcm1pc3Npb25Db25maWc/LmVuYWJsZWQpIHtcbiAgICBjb25zdCBkeW5hbWljQ29uZmlnID0gY29uZmlnLmR5bmFtaWNQZXJtaXNzaW9uQ29uZmlnO1xuICAgIFxuICAgIGlmIChkeW5hbWljQ29uZmlnLnJlZnJlc2hJbnRlcnZhbFNlY29uZHMgPCA2MCkge1xuICAgICAgd2FybmluZ3MucHVzaCgn5qip6ZmQ5pu05paw6ZaT6ZqU44GM55+t44GZ44GO44G+44GZ77yI5o6o5aWoOiAzMDDnp5Lku6XkuIrvvIknKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGR5bmFtaWNDb25maWcudGVtcG9yYXJ5QWNjZXNzPy5tYXhEdXJhdGlvblNlY29uZHMgPCBkeW5hbWljQ29uZmlnLnRlbXBvcmFyeUFjY2Vzcz8uZGVmYXVsdER1cmF0aW9uU2Vjb25kcykge1xuICAgICAgZXJyb3JzLnB1c2goJ+S4gOaZguOCouOCr+OCu+OCueOBruacgOWkp+acn+mWk+OBjOODh+ODleOCqeODq+ODiOacn+mWk+OCiOOCiuefreOBj+ioreWumuOBleOCjOOBpuOBhOOBvuOBmScpO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHtcbiAgICBpc1ZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgIGVycm9ycyxcbiAgICB3YXJuaW5nc1xuICB9O1xufSJdfQ==