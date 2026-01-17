"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebACLAssociation = exports.WAF = exports.Waf = void 0;
const lodash_1 = require("lodash");
const aws_wafv2_1 = require("aws-cdk-lib/aws-wafv2");
const constructs_1 = require("constructs");
/**
 * WAF設定定数
 */
const WAF_CONFIG = {
    /** デフォルトのレート制限（リクエスト/5分） */
    DEFAULT_RATE_LIMIT: 3000,
    /** IPアドレスバージョン */
    IP_ADDRESS_VERSION: "IPV4",
    /** カスタムレスポンスコード */
    BLOCKED_RESPONSE_CODE: 403,
    /** WAFスコープ */
    SCOPE: {
        CLOUDFRONT: "CLOUDFRONT",
        REGIONAL: "REGIONAL",
    },
    /** カスタムレスポンスボディキー */
    RESPONSE_BODY_KEYS: {
        ACCESS_DENIED: "access-denied",
        GEO_BLOCKED: "geo-blocked",
    },
    /** メトリクス設定 */
    METRICS: {
        SAMPLED_REQUESTS_ENABLED: true,
        CLOUDWATCH_METRICS_ENABLED: true,
    },
};
/**
 * AWS WAF v2 Webアプリケーションファイアウォールコンストラクト
 *
 * このコンストラクトは以下の機能を持つWebアプリケーションファイアウォールを作成します：
 * - レート制限による保護
 * - 一般的な脅威に対するAWSマネージドルールグループ
 * - IP許可リスト/拒否リスト機能
 * - 地理的アクセス制限
 *
 * @example
 * ```typescript
 * new Waf(this, 'MyWAF', {
 *   useCloudFront: true,
 *   allowedIps: ['192.168.1.0/24'],
 *   geoRestriction: {
 *     restrictionType: 'allowlist',
 *     locations: ['JP', 'US']
 *   }
 * });
 * ```
 */
class Waf extends constructs_1.Construct {
    webAcl;
    constructor(scope, id, props) {
        super(scope, id);
        // 入力値の検証
        this.validateProps(props);
        let ipset = null;
        const distScope = props.useCloudFront ? WAF_CONFIG.SCOPE.CLOUDFRONT : WAF_CONFIG.SCOPE.REGIONAL;
        // 許可IPアドレスが指定されている場合、IPセットを作成
        if (!(0, lodash_1.isEmpty)(props.allowedIps)) {
            ipset = new aws_wafv2_1.CfnIPSet(this, `${id}-ipset`, {
                addresses: props.allowedIps,
                ipAddressVersion: WAF_CONFIG.IP_ADDRESS_VERSION,
                scope: distScope,
                description: "アプリケーション許可IPv4アドレス",
                name: `${id}-app-ip-list`,
            });
        }
        // AWS WAFの作成
        this.webAcl = new WAF(this, `${id}-WAFv2`, ipset, distScope, props.extraRules, props.geoRestriction);
        // CloudFrontでない場合、リソースとの関連付けを作成
        if (!props.useCloudFront && props.webACLResourceArn) {
            new WebACLAssociation(this, `${id}-acl-Association`, {
                resourceArn: props.webACLResourceArn,
                webAclArn: this.webAcl.attrArn,
            });
        }
    }
    /**
     * プロパティの検証を行う
     * @param props WAFコンストラクトのプロパティ
     * @throws {Error} 検証に失敗した場合
     */
    validateProps(props) {
        // IPアドレスの検証
        if (props.allowedIps) {
            const invalidIps = [];
            props.allowedIps.forEach(ip => {
                if (!this.isValidCIDR(ip)) {
                    invalidIps.push(ip);
                }
            });
            if (invalidIps.length > 0) {
                throw new Error(`無効なIPアドレスまたはCIDR記法が検出されました: ${invalidIps.join(', ')}\n` +
                    `有効な形式: 192.168.1.1 または 192.168.1.0/24`);
            }
        }
        // 地理的制限の検証
        if (props.geoRestriction) {
            if (props.geoRestriction.locations.length === 0) {
                throw new Error('地理的制限の国コードリストが空です。' +
                    '少なくとも1つの国コードを指定してください（例: ["JP", "US"]）');
            }
            const invalidCodes = [];
            props.geoRestriction.locations.forEach(code => {
                if (!/^[A-Z]{2}$/.test(code)) {
                    invalidCodes.push(code);
                }
            });
            if (invalidCodes.length > 0) {
                throw new Error(`無効な国コードが検出されました: ${invalidCodes.join(', ')}\n` +
                    `ISO 3166-1 alpha-2形式（2文字の大文字）で指定してください（例: JP, US, CA）`);
            }
        }
        // CloudFront以外でリソースARNが必要な場合の検証
        if (!props.useCloudFront && !props.webACLResourceArn) {
            throw new Error('リージョナルWAFを使用する場合は webACLResourceArn を指定してください。' +
                'CloudFrontを使用する場合は useCloudFront: true を設定してください。');
        }
    }
    /**
     * CIDR記法の妥当性を検証する
     * @param cidr 検証するCIDR文字列
     * @returns 妥当な場合true
     */
    isValidCIDR(cidr) {
        // IPv4アドレスとCIDR記法の詳細検証
        const cidrRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d{1,2}))?$/;
        const match = cidr.match(cidrRegex);
        if (!match) {
            return false;
        }
        // IPアドレス各オクテットの範囲チェック (0-255)
        const octets = [match[1], match[2], match[3], match[4]].map(Number);
        if (octets.some(octet => octet < 0 || octet > 255)) {
            return false;
        }
        // CIDR プレフィックス長の範囲チェック (0-32)
        if (match[6]) {
            const prefixLength = Number(match[6]);
            if (prefixLength < 0 || prefixLength > 32) {
                return false;
            }
        }
        return true;
    }
}
exports.Waf = Waf;
/**
 * WAFルールの優先度定数
 * 優先度が低い数値ほど先に評価される
 */
const WAF_RULE_PRIORITIES = {
    GEO_RESTRICTION: 50, // 地理的制限（最高優先度）
    RATE_LIMITING: 100, // レート制限
    IP_REPUTATION: 200, // IP評価
    COMMON_RULES: 300, // 共通ルール
    BAD_INPUTS: 400, // 不正入力
    SQL_INJECTION: 500, // SQLインジェクション
    IP_ALLOWLIST: 600, // IP許可リスト（最低優先度）
    CUSTOM_RULES_START: 700, // カスタムルール開始位置
};
/**
 * WAFルールの優先度を管理するヘルパークラス
 */
class WafRulePriorityManager {
    static nextCustomPriority = WAF_RULE_PRIORITIES.CUSTOM_RULES_START;
    /**
     * カスタムルール用の次の優先度を取得
     * @returns 次の利用可能な優先度
     */
    static getNextCustomPriority() {
        return this.nextCustomPriority++;
    }
    /**
     * 優先度をリセット（テスト用）
     */
    static resetCustomPriority() {
        this.nextCustomPriority = WAF_RULE_PRIORITIES.CUSTOM_RULES_START;
    }
}
/**
 * デフォルトのWAFルール定義
 * グローバル変数を避けて、各インスタンスで新しいコピーを作成
 */
const DEFAULT_WAF_RULES = [
    // レート制限フィルター
    {
        name: "web-rate-filter",
        rule: {
            name: "web-rate-filter",
            priority: WAF_RULE_PRIORITIES.RATE_LIMITING,
            statement: {
                rateBasedStatement: {
                    limit: WAF_CONFIG.DEFAULT_RATE_LIMIT,
                    aggregateKeyType: "IP",
                },
            },
            action: {
                block: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: WAF_CONFIG.METRICS.SAMPLED_REQUESTS_ENABLED,
                cloudWatchMetricsEnabled: WAF_CONFIG.METRICS.CLOUDWATCH_METRICS_ENABLED,
                metricName: "web-rate-filter",
            },
        },
    },
    // AWS IP評価リスト - 既知の悪意のあるアクター/ボットを含み、定期的に更新される
    {
        name: "AWS-AWSManagedRulesAmazonIpReputationList",
        rule: {
            name: "AWS-AWSManagedRulesAmazonIpReputationList",
            priority: WAF_RULE_PRIORITIES.IP_REPUTATION,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesAmazonIpReputationList",
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWSManagedRulesAmazonIpReputationList",
            },
        },
    },
    // 共通ルールセット - OWASP Core Rule Setの主要部分と整合
    {
        name: "AWS-AWSManagedRulesCommonRuleSet",
        rule: {
            name: "AWS-AWSManagedRulesCommonRuleSet",
            priority: WAF_RULE_PRIORITIES.COMMON_RULES,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesCommonRuleSet",
                    // SNS通知のための汎用RFIボディルールを除外
                    // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
                    excludedRules: [
                        { name: "GenericRFI_BODY" },
                        { name: "SizeRestrictions_BODY" },
                        { name: "CrossSiteScripting_BODY" },
                    ],
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesCommonRuleSet",
            },
        },
    },
    // 既知の不正入力ルールセット
    {
        name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
        rule: {
            name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
            priority: WAF_RULE_PRIORITIES.BAD_INPUTS,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesKnownBadInputsRuleSet",
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
            },
        },
    },
    // SQLインジェクションルールセット
    {
        name: "AWS-AWSManagedRulesSQLiRuleSet",
        rule: {
            name: "AWS-AWSManagedRulesSQLiRuleSet",
            priority: WAF_RULE_PRIORITIES.SQL_INJECTION,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesSQLiRuleSet",
                },
            },
            overrideAction: {
                none: {},
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesSQLiRuleSet",
            },
        },
    },
];
/**
 * AWS WAF v2 WebACLクラス
 * CfnWebACLを拡張してカスタムルール管理機能を提供
 *
 * @example
 * ```typescript
 * const waf = new WAF(this, 'MyWAF', ipset, 'CLOUDFRONT', extraRules, geoRestriction);
 * ```
 */
class WAF extends aws_wafv2_1.CfnWebACL {
    constructor(scope, id, ipset, distScope, extraRules, geoRestriction) {
        // デフォルトルールの新しいコピーを作成（グローバル状態を避ける）
        let wafRules = [...DEFAULT_WAF_RULES];
        // 地理的制限ルールの追加（最高優先度）
        if (geoRestriction && geoRestriction.locations.length > 0) {
            const geoRule = this.createGeoRestrictionRule(geoRestriction);
            wafRules.unshift(geoRule); // 高い優先度で先頭に追加
        }
        // 追加ルールがある場合はマージ（重複は名前で除去）
        if (extraRules && !(0, lodash_1.isEmpty)(extraRules)) {
            wafRules = (0, lodash_1.uniqBy)((0, lodash_1.concat)(wafRules, extraRules), "name");
        }
        // IPセットが指定されている場合、IP許可リストルールを追加
        if (ipset) {
            wafRules.push({
                name: "custom-web-ip-allowlist",
                rule: {
                    name: "custom-web-ip-allowlist",
                    priority: WAF_RULE_PRIORITIES.IP_ALLOWLIST,
                    statement: {
                        notStatement: {
                            statement: {
                                ipSetReferenceStatement: {
                                    arn: ipset.attrArn,
                                },
                            },
                        },
                    },
                    action: {
                        block: {
                            customResponse: {
                                responseCode: WAF_CONFIG.BLOCKED_RESPONSE_CODE,
                                customResponseBodyKey: WAF_CONFIG.RESPONSE_BODY_KEYS.ACCESS_DENIED,
                            },
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: "custom-web-ip-allowlist",
                    },
                },
            });
        }
        super(scope, id, {
            defaultAction: { allow: {} },
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: `${id}-metric`,
                sampledRequestsEnabled: false,
            },
            customResponseBodies: {
                [WAF_CONFIG.RESPONSE_BODY_KEYS.ACCESS_DENIED]: {
                    contentType: "TEXT_HTML",
                    content: "<div>アクセスが拒否されました</div>",
                },
                [WAF_CONFIG.RESPONSE_BODY_KEYS.GEO_BLOCKED]: {
                    contentType: "TEXT_HTML",
                    content: "<div>お住まいの地域からのアクセスは制限されています</div>",
                },
            },
            scope: distScope,
            name: `${id}-waf`,
            rules: wafRules.map((wafRule) => wafRule.rule),
        });
    }
    /**
     * 地理的制限ルールを作成する
     * @param geoRestriction 地理的制限の設定
     * @returns 地理的制限WAFルール
     */
    createGeoRestrictionRule(geoRestriction) {
        const isAllowlist = geoRestriction.restrictionType === 'allowlist';
        return {
            name: "geo-restriction",
            rule: {
                name: "geo-restriction",
                priority: WAF_RULE_PRIORITIES.GEO_RESTRICTION,
                statement: isAllowlist ? {
                    // 許可リストの場合：指定国以外をブロック
                    notStatement: {
                        statement: {
                            geoMatchStatement: {
                                countryCodes: geoRestriction.locations,
                            },
                        },
                    },
                } : {
                    // 拒否リストの場合：指定国をブロック
                    geoMatchStatement: {
                        countryCodes: geoRestriction.locations,
                    },
                },
                action: {
                    block: {
                        customResponse: {
                            responseCode: WAF_CONFIG.BLOCKED_RESPONSE_CODE,
                            customResponseBodyKey: WAF_CONFIG.RESPONSE_BODY_KEYS.GEO_BLOCKED,
                        },
                    },
                },
                visibilityConfig: {
                    sampledRequestsEnabled: true,
                    cloudWatchMetricsEnabled: true,
                    metricName: "geo-restriction",
                },
            },
        };
    }
}
exports.WAF = WAF;
/**
 * WebACL関連付けクラス
 * WAFをリソースに関連付けるためのヘルパークラス
 */
class WebACLAssociation extends aws_wafv2_1.CfnWebACLAssociation {
    constructor(scope, id, props) {
        super(scope, id, {
            resourceArn: props.resourceArn,
            webAclArn: props.webAclArn,
        });
    }
}
exports.WebACLAssociation = WebACLAssociation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2FmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUFFSCxtQ0FBaUQ7QUFHakQscURBSytCO0FBRS9CLDJDQUF1QztBQUV2Qzs7R0FFRztBQUNILE1BQU0sVUFBVSxHQUFHO0lBQ2pCLDRCQUE0QjtJQUM1QixrQkFBa0IsRUFBRSxJQUFJO0lBQ3hCLGtCQUFrQjtJQUNsQixrQkFBa0IsRUFBRSxNQUFlO0lBQ25DLG1CQUFtQjtJQUNuQixxQkFBcUIsRUFBRSxHQUFHO0lBQzFCLGNBQWM7SUFDZCxLQUFLLEVBQUU7UUFDTCxVQUFVLEVBQUUsWUFBcUI7UUFDakMsUUFBUSxFQUFFLFVBQW1CO0tBQzlCO0lBQ0QscUJBQXFCO0lBQ3JCLGtCQUFrQixFQUFFO1FBQ2xCLGFBQWEsRUFBRSxlQUFlO1FBQzlCLFdBQVcsRUFBRSxhQUFhO0tBQzNCO0lBQ0QsY0FBYztJQUNkLE9BQU8sRUFBRTtRQUNQLHdCQUF3QixFQUFFLElBQUk7UUFDOUIsMEJBQTBCLEVBQUUsSUFBSTtLQUNqQztDQUNPLENBQUM7QUFvQ1g7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHO0FBQ0gsTUFBYSxHQUFJLFNBQVEsc0JBQVM7SUFDaEIsTUFBTSxDQUFZO0lBRWxDLFlBQ0UsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLEtBQXdCO1FBRXhCLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsU0FBUztRQUNULElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFMUIsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQztRQUVoRyw4QkFBOEI7UUFDOUIsSUFB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QkFBb0I7b0JBQ3BCLGlCQUFpQixFQUFFO3dCQUNqQixZQUFZLEVBQUUsY0FBYyxDQUFDLFNBQVM7cUJBQ3ZDO2lCQUNGO2dCQUNELE1BQU0sRUFBRTtvQkFDTixLQUFLLEVBQUU7d0JBQ0wsY0FBYyxFQUFFOzRCQUNkLFlBQVksRUFBRSxVQUFVLENBQUMscUJBQXFCOzRCQUM5QyxxQkFBcUIsRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsV0FBVzt5QkFDakU7cUJBQ0Y7aUJBQ0Y7Z0JBQ0QsZ0JBQWdCLEVBQUU7b0JBQ2hCLHNCQUFzQixFQUFFLElBQUk7b0JBQzVCLHdCQUF3QixFQUFFLElBQUk7b0JBQzlCLFVBQVUsRUFBRSxpQkFBaUI7aUJBQzlCO2FBQ0Y7U0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBM0hELGtCQTJIQztBQUVEOzs7R0FHRztBQUNILE1BQWEsaUJBQWtCLFNBQVEsZ0NBQW9CO0lBQ3pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUU7WUFDZixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7WUFDOUIsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTO1NBQzNCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQVBELDhDQU9DIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqICBDb3B5cmlnaHQgMjAyNSBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBMaWNlbnNlUmVmLS5hbWF6b24uY29tLi1BbXpuU0wtMS4wXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFtYXpvbiBTb2Z0d2FyZSBMaWNlbnNlICBodHRwOi8vYXdzLmFtYXpvbi5jb20vYXNsL1xuICovXG5cbmltcG9ydCB7IGNvbmNhdCwgaXNFbXB0eSwgdW5pcUJ5IH0gZnJvbSBcImxvZGFzaFwiO1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQge1xuICBDZm5JUFNldCxcbiAgQ2ZuV2ViQUNMLFxuICBDZm5XZWJBQ0xBc3NvY2lhdGlvbixcbiAgQ2ZuV2ViQUNMQXNzb2NpYXRpb25Qcm9wcyxcbn0gZnJvbSBcImF3cy1jZGstbGliL2F3cy13YWZ2MlwiO1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG4vKipcbiAqIFdBRuioreWumuWumuaVsFxuICovXG5jb25zdCBXQUZfQ09ORklHID0ge1xuICAvKiog44OH44OV44Kp44Or44OI44Gu44Os44O844OI5Yi26ZmQ77yI44Oq44Kv44Ko44K544OILzXliIbvvIkgKi9cbiAgREVGQVVMVF9SQVRFX0xJTUlUOiAzMDAwLFxuICAvKiogSVDjgqLjg4njg6zjgrnjg5Djg7zjgrjjg6fjg7MgKi9cbiAgSVBfQUREUkVTU19WRVJTSU9OOiBcIklQVjRcIiBhcyBjb25zdCxcbiAgLyoqIOOCq+OCueOCv+ODoOODrOOCueODneODs+OCueOCs+ODvOODiSAqL1xuICBCTE9DS0VEX1JFU1BPTlNFX0NPREU6IDQwMyxcbiAgLyoqIFdBRuOCueOCs+ODvOODlyAqL1xuICBTQ09QRToge1xuICAgIENMT1VERlJPTlQ6IFwiQ0xPVURGUk9OVFwiIGFzIGNvbnN0LFxuICAgIFJFR0lPTkFMOiBcIlJFR0lPTkFMXCIgYXMgY29uc3QsXG4gIH0sXG4gIC8qKiDjgqvjgrnjgr/jg6Djg6zjgrnjg53jg7Pjgrnjg5zjg4fjgqPjgq3jg7wgKi9cbiAgUkVTUE9OU0VfQk9EWV9LRVlTOiB7XG4gICAgQUNDRVNTX0RFTklFRDogXCJhY2Nlc3MtZGVuaWVkXCIsXG4gICAgR0VPX0JMT0NLRUQ6IFwiZ2VvLWJsb2NrZWRcIixcbiAgfSxcbiAgLyoqIOODoeODiOODquOCr+OCueioreWumiAqL1xuICBNRVRSSUNTOiB7XG4gICAgU0FNUExFRF9SRVFVRVNUU19FTkFCTEVEOiB0cnVlLFxuICAgIENMT1VEV0FUQ0hfTUVUUklDU19FTkFCTEVEOiB0cnVlLFxuICB9LFxufSBhcyBjb25zdDtcblxuLyoqXG4gKiBXQUbjg6vjg7zjg6vjga7lrprnvqnjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBXYWZSdWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBydWxlOiBDZm5XZWJBQ0wuUnVsZVByb3BlcnR5O1xufVxuXG4vKipcbiAqIOWcsOeQhueahOWItumZkOOBruioreWumuOCpOODs+OCv+ODvOODleOCp+ODvOOCuVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdlb1Jlc3RyaWN0aW9uQ29uZmlnIHtcbiAgLyoqIOioseWPr+ODquOCueODiO+8iGFsbG93bGlzdO+8ieOBvuOBn+OBr+aLkuWQpuODquOCueODiO+8iGRlbnlsaXN077yJ44Gu5oyH5a6aICovXG4gIHJlc3RyaWN0aW9uVHlwZTogJ2FsbG93bGlzdCcgfCAnZGVueWxpc3QnO1xuICAvKiogSVNPIDMxNjYtMSBhbHBoYS0yIOWbveOCs+ODvOODieOBruODquOCueODiO+8iOS+izogWydKUCcsICdVUycsICdDQSdd77yJICovXG4gIGxvY2F0aW9uczogc3RyaW5nW107XG59XG5cbi8qKlxuICogV0FG44Kz44Oz44K544OI44Op44Kv44OI44Gu44OX44Ot44OR44OG44KjXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgV2FmQ29uc3RydWN0UHJvcHMge1xuICAvKiogQ2xvdWRGcm9udOeUqFdBRuOBi+OBqeOBhuOBi++8iHRydWXvvInjgIHjg6rjg7zjgrjjg6fjg4rjg6vjg6rjgr3jg7zjgrnnlKjjgYvvvIhmYWxzZe+8iSAqL1xuICB1c2VDbG91ZEZyb250PzogYm9vbGVhbjtcbiAgLyoqIOOBk+OBrldBRuOBq+mWoumAo+S7mOOBkeOCi+ODquOCveODvOOCueOBrkFSTu+8iENsb3VkRnJvbnTjgafjga/kuI3opoHvvIkgKi9cbiAgd2ViQUNMUmVzb3VyY2VBcm4/OiBzdHJpbmc7XG4gIC8qKiDov73liqDjga7jgqvjgrnjgr/jg6BXQUbjg6vjg7zjg6sgKi9cbiAgZXh0cmFSdWxlcz86IFdhZlJ1bGVbXTtcbiAgLyoqIENJRFLoqJjms5XjgafmjIflrprjgZXjgozjgZ/oqLHlj69JUOOCouODieODrOOCueOBruODquOCueODiCAqL1xuICBhbGxvd2VkSXBzOiBzdHJpbmdbXTtcbiAgLyoqIOWcsOeQhueahOOCouOCr+OCu+OCueWItumZkOOBruioreWumiAqL1xuICBnZW9SZXN0cmljdGlvbj86IEdlb1Jlc3RyaWN0aW9uQ29uZmlnO1xufVxuXG4vKipcbiAqIEFXUyBXQUYgdjIgV2Vi44Ki44OX44Oq44Kx44O844K344On44Oz44OV44Kh44Kk44Ki44Km44Kp44O844Or44Kz44Oz44K544OI44Op44Kv44OIXG4gKiBcbiAqIOOBk+OBruOCs+ODs+OCueODiOODqeOCr+ODiOOBr+S7peS4i+OBruapn+iDveOCkuaMgeOBpFdlYuOCouODl+ODquOCseODvOOCt+ODp+ODs+ODleOCoeOCpOOCouOCpuOCqeODvOODq+OCkuS9nOaIkOOBl+OBvuOBme+8mlxuICogLSDjg6zjg7zjg4jliLbpmZDjgavjgojjgovkv53orbdcbiAqIC0g5LiA6Iis55qE44Gq6ISF5aiB44Gr5a++44GZ44KLQVdT44Oe44ON44O844K444OJ44Or44O844Or44Kw44Or44O844OXXG4gKiAtIElQ6Kix5Y+v44Oq44K544OIL+aLkuWQpuODquOCueODiOapn+iDvVxuICogLSDlnLDnkIbnmoTjgqLjgq/jgrvjgrnliLbpmZBcbiAqIFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIG5ldyBXYWYodGhpcywgJ015V0FGJywge1xuICogICB1c2VDbG91ZEZyb250OiB0cnVlLFxuICogICBhbGxvd2VkSXBzOiBbJzE5Mi4xNjguMS4wLzI0J10sXG4gKiAgIGdlb1Jlc3RyaWN0aW9uOiB7XG4gKiAgICAgcmVzdHJpY3Rpb25UeXBlOiAnYWxsb3dsaXN0JyxcbiAqICAgICBsb2NhdGlvbnM6IFsnSlAnLCAnVVMnXVxuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgV2FmIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IHdlYkFjbDogQ2ZuV2ViQUNMO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHNjb3BlOiBDb25zdHJ1Y3QsXG4gICAgaWQ6IHN0cmluZyxcbiAgICBwcm9wczogV2FmQ29uc3RydWN0UHJvcHNcbiAgKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOWFpeWKm+WApOOBruaknOiovFxuICAgIHRoaXMudmFsaWRhdGVQcm9wcyhwcm9wcyk7XG5cbiAgICBsZXQgaXBzZXQgPSBudWxsO1xuICAgIGNvbnN0IGRpc3RTY29wZSA9IHByb3BzLnVzZUNsb3VkRnJvbnQgPyBXQUZfQ09ORklHLlNDT1BFLkNMT1VERlJPTlQgOiBXQUZfQ09ORklHLlNDT1BFLlJFR0lPTkFMO1xuXG4gICAgLy8g6Kix5Y+vSVDjgqLjg4njg6zjgrnjgYzmjIflrprjgZXjgozjgabjgYTjgovloLTlkIjjgIFJUOOCu+ODg+ODiOOCkuS9nOaIkFxuICAgIGlmICghaXNFbXB0eShwcm9wcy5hbGxvd2VkSXBzKSkge1xuICAgICAgaXBzZXQgPSBuZXcgQ2ZuSVBTZXQodGhpcywgYCR7aWR9LWlwc2V0YCwge1xuICAgICAgICBhZGRyZXNzZXM6IHByb3BzLmFsbG93ZWRJcHMsXG4gICAgICAgIGlwQWRkcmVzc1ZlcnNpb246IFdBRl9DT05GSUcuSVBfQUREUkVTU19WRVJTSU9OLFxuICAgICAgICBzY29wZTogZGlzdFNjb3BlLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCLjgqLjg5fjg6rjgrHjg7zjgrfjg6fjg7PoqLHlj69JUHY044Ki44OJ44Os44K5XCIsXG4gICAgICAgIG5hbWU6IGAke2lkfS1hcHAtaXAtbGlzdGAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBV1MgV0FG44Gu5L2c5oiQXG4gICAgdGhpcy53ZWJBY2wgPSBuZXcgV0FGKFxuICAgICAgdGhpcyxcbiAgICAgIGAke2lkfS1XQUZ2MmAsXG4gICAgICBpcHNldCxcbiAgICAgIGRpc3RTY29wZSxcbiAgICAgIHByb3BzLmV4dHJhUnVsZXMsXG4gICAgICBwcm9wcy5nZW9SZXN0cmljdGlvblxuICAgICk7XG5cbiAgICAvLyBDbG91ZEZyb25044Gn44Gq44GE5aC05ZCI44CB44Oq44K944O844K544Go44Gu6Zai6YCj5LuY44GR44KS5L2c5oiQXG4gICAgaWYgKCFwcm9wcy51c2VDbG91ZEZyb250ICYmIHByb3BzLndlYkFDTFJlc291cmNlQXJuKSB7XG4gICAgICBuZXcgV2ViQUNMQXNzb2NpYXRpb24odGhpcywgYCR7aWR9LWFjbC1Bc3NvY2lhdGlvbmAsIHtcbiAgICAgICAgcmVzb3VyY2VBcm46IHByb3BzLndlYkFDTFJlc291cmNlQXJuLFxuICAgICAgICB3ZWJBY2xBcm46IHRoaXMud2ViQWNsLmF0dHJBcm4sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OX44Ot44OR44OG44Kj44Gu5qSc6Ki844KS6KGM44GGXG4gICAqIEBwYXJhbSBwcm9wcyBXQUbjgrPjg7Pjgrnjg4jjg6njgq/jg4jjga7jg5fjg63jg5Hjg4bjgqNcbiAgICogQHRocm93cyB7RXJyb3J9IOaknOiovOOBq+WkseaVl+OBl+OBn+WgtOWQiFxuICAgKi9cbiAgcHJpdmF0ZSB2YWxpZGF0ZVByb3BzKHByb3BzOiBXYWZDb25zdHJ1Y3RQcm9wcyk6IHZvaWQge1xuICAgIC8vIElQ44Ki44OJ44Os44K544Gu5qSc6Ki8XG4gICAgaWYgKHByb3BzLmFsbG93ZWRJcHMpIHtcbiAgICAgIGNvbnN0IGludmFsaWRJcHM6IHN0cmluZ1tdID0gW107XG4gICAgICBwcm9wcy5hbGxvd2VkSXBzLmZvckVhY2goaXAgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuaXNWYWxpZENJRFIoaXApKSB7XG4gICAgICAgICAgaW52YWxpZElwcy5wdXNoKGlwKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChpbnZhbGlkSXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGDnhKHlirnjgapJUOOCouODieODrOOCueOBvuOBn+OBr0NJRFLoqJjms5XjgYzmpJzlh7rjgZXjgozjgb7jgZfjgZ86ICR7aW52YWxpZElwcy5qb2luKCcsICcpfVxcbmAgK1xuICAgICAgICAgIGDmnInlirnjgarlvaLlvI86IDE5Mi4xNjguMS4xIOOBvuOBn+OBryAxOTIuMTY4LjEuMC8yNGBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDlnLDnkIbnmoTliLbpmZDjga7mpJzoqLxcbiAgICBpZiAocHJvcHMuZ2VvUmVzdHJpY3Rpb24pIHtcbiAgICAgIGlmIChwcm9wcy5nZW9SZXN0cmljdGlvbi5sb2NhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAn5Zyw55CG55qE5Yi26ZmQ44Gu5Zu944Kz44O844OJ44Oq44K544OI44GM56m644Gn44GZ44CCJyArXG4gICAgICAgICAgJ+WwkeOBquOBj+OBqOOCgjHjgaTjga7lm73jgrPjg7zjg4njgpLmjIflrprjgZfjgabjgY/jgaDjgZXjgYTvvIjkvos6IFtcIkpQXCIsIFwiVVNcIl3vvIknXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGludmFsaWRDb2Rlczogc3RyaW5nW10gPSBbXTtcbiAgICAgIHByb3BzLmdlb1Jlc3RyaWN0aW9uLmxvY2F0aW9ucy5mb3JFYWNoKGNvZGUgPT4ge1xuICAgICAgICBpZiAoIS9eW0EtWl17Mn0kLy50ZXN0KGNvZGUpKSB7XG4gICAgICAgICAgaW52YWxpZENvZGVzLnB1c2goY29kZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaW52YWxpZENvZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGDnhKHlirnjgarlm73jgrPjg7zjg4njgYzmpJzlh7rjgZXjgozjgb7jgZfjgZ86ICR7aW52YWxpZENvZGVzLmpvaW4oJywgJyl9XFxuYCArXG4gICAgICAgICAgYElTTyAzMTY2LTEgYWxwaGEtMuW9ouW8j++8iDLmloflrZfjga7lpKfmloflrZfvvInjgafmjIflrprjgZfjgabjgY/jgaDjgZXjgYTvvIjkvos6IEpQLCBVUywgQ0HvvIlgXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGcm9udOS7peWkluOBp+ODquOCveODvOOCuUFSTuOBjOW/heimgeOBquWgtOWQiOOBruaknOiovFxuICAgIGlmICghcHJvcHMudXNlQ2xvdWRGcm9udCAmJiAhcHJvcHMud2ViQUNMUmVzb3VyY2VBcm4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ+ODquODvOOCuOODp+ODiuODq1dBRuOCkuS9v+eUqOOBmeOCi+WgtOWQiOOBryB3ZWJBQ0xSZXNvdXJjZUFybiDjgpLmjIflrprjgZfjgabjgY/jgaDjgZXjgYTjgIInICtcbiAgICAgICAgJ0Nsb3VkRnJvbnTjgpLkvb/nlKjjgZnjgovloLTlkIjjga8gdXNlQ2xvdWRGcm9udDogdHJ1ZSDjgpLoqK3lrprjgZfjgabjgY/jgaDjgZXjgYTjgIInXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDSURS6KiY5rOV44Gu5aal5b2T5oCn44KS5qSc6Ki844GZ44KLXG4gICAqIEBwYXJhbSBjaWRyIOaknOiovOOBmeOCi0NJRFLmloflrZfliJdcbiAgICogQHJldHVybnMg5aal5b2T44Gq5aC05ZCIdHJ1ZVxuICAgKi9cbiAgcHJpdmF0ZSBpc1ZhbGlkQ0lEUihjaWRyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAvLyBJUHY044Ki44OJ44Os44K544GoQ0lEUuiomOazleOBruips+e0sOaknOiovFxuICAgIGNvbnN0IGNpZHJSZWdleCA9IC9eKFxcZHsxLDN9KVxcLihcXGR7MSwzfSlcXC4oXFxkezEsM30pXFwuKFxcZHsxLDN9KShcXC8oXFxkezEsMn0pKT8kLztcbiAgICBjb25zdCBtYXRjaCA9IGNpZHIubWF0Y2goY2lkclJlZ2V4KTtcblxuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBJUOOCouODieODrOOCueWQhOOCquOCr+ODhuODg+ODiOOBruevhOWbsuODgeOCp+ODg+OCryAoMC0yNTUpXG4gICAgY29uc3Qgb2N0ZXRzID0gW21hdGNoWzFdLCBtYXRjaFsyXSwgbWF0Y2hbM10sIG1hdGNoWzRdXS5tYXAoTnVtYmVyKTtcbiAgICBpZiAob2N0ZXRzLnNvbWUob2N0ZXQgPT4gb2N0ZXQgPCAwIHx8IG9jdGV0ID4gMjU1KSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENJRFIg44OX44Os44OV44Kj44OD44Kv44K56ZW344Gu56+E5Zuy44OB44Kn44OD44KvICgwLTMyKVxuICAgIGlmIChtYXRjaFs2XSkge1xuICAgICAgY29uc3QgcHJlZml4TGVuZ3RoID0gTnVtYmVyKG1hdGNoWzZdKTtcbiAgICAgIGlmIChwcmVmaXhMZW5ndGggPCAwIHx8IHByZWZpeExlbmd0aCA+IDMyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG4vKipcbiAqIFdBRuODq+ODvOODq+OBruWEquWFiOW6puWumuaVsFxuICog5YSq5YWI5bqm44GM5L2O44GE5pWw5YCk44G744Gp5YWI44Gr6KmV5L6h44GV44KM44KLXG4gKi9cbmNvbnN0IFdBRl9SVUxFX1BSSU9SSVRJRVMgPSB7XG4gIEdFT19SRVNUUklDVElPTjogNTAsICAgICAgLy8g5Zyw55CG55qE5Yi26ZmQ77yI5pyA6auY5YSq5YWI5bqm77yJXG4gIFJBVEVfTElNSVRJTkc6IDEwMCwgICAgICAgLy8g44Os44O844OI5Yi26ZmQXG4gIElQX1JFUFVUQVRJT046IDIwMCwgICAgICAgLy8gSVDoqZXkvqFcbiAgQ09NTU9OX1JVTEVTOiAzMDAsICAgICAgICAvLyDlhbHpgJrjg6vjg7zjg6tcbiAgQkFEX0lOUFVUUzogNDAwLCAgICAgICAgICAvLyDkuI3mraPlhaXliptcbiAgU1FMX0lOSkVDVElPTjogNTAwLCAgICAgICAvLyBTUUzjgqTjg7Pjgrjjgqfjgq/jgrfjg6fjg7NcbiAgSVBfQUxMT1dMSVNUOiA2MDAsICAgICAgICAvLyBJUOioseWPr+ODquOCueODiO+8iOacgOS9juWEquWFiOW6pu+8iVxuICBDVVNUT01fUlVMRVNfU1RBUlQ6IDcwMCwgIC8vIOOCq+OCueOCv+ODoOODq+ODvOODq+mWi+Wni+S9jee9rlxufSBhcyBjb25zdDtcblxuLyoqXG4gKiBXQUbjg6vjg7zjg6vjga7lhKrlhYjluqbjgpLnrqHnkIbjgZnjgovjg5jjg6vjg5Hjg7zjgq/jg6njgrlcbiAqL1xuY2xhc3MgV2FmUnVsZVByaW9yaXR5TWFuYWdlciB7XG4gIHByaXZhdGUgc3RhdGljIG5leHRDdXN0b21Qcmlvcml0eSA9IFdBRl9SVUxFX1BSSU9SSVRJRVMuQ1VTVE9NX1JVTEVTX1NUQVJUO1xuXG4gIC8qKlxuICAgKiDjgqvjgrnjgr/jg6Djg6vjg7zjg6vnlKjjga7mrKHjga7lhKrlhYjluqbjgpLlj5blvpdcbiAgICogQHJldHVybnMg5qyh44Gu5Yip55So5Y+v6IO944Gq5YSq5YWI5bqmXG4gICAqL1xuICBzdGF0aWMgZ2V0TmV4dEN1c3RvbVByaW9yaXR5KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMubmV4dEN1c3RvbVByaW9yaXR5Kys7XG4gIH1cblxuICAvKipcbiAgICog5YSq5YWI5bqm44KS44Oq44K744OD44OI77yI44OG44K544OI55So77yJXG4gICAqL1xuICBzdGF0aWMgcmVzZXRDdXN0b21Qcmlvcml0eSgpOiB2b2lkIHtcbiAgICB0aGlzLm5leHRDdXN0b21Qcmlvcml0eSA9IFdBRl9SVUxFX1BSSU9SSVRJRVMuQ1VTVE9NX1JVTEVTX1NUQVJUO1xuICB9XG59XG5cbi8qKlxuICog44OH44OV44Kp44Or44OI44GuV0FG44Or44O844Or5a6a576pXG4gKiDjgrDjg63jg7zjg5Djg6vlpInmlbDjgpLpgb/jgZHjgabjgIHlkITjgqTjg7Pjgrnjgr/jg7PjgrnjgafmlrDjgZfjgYTjgrPjg5Tjg7zjgpLkvZzmiJBcbiAqL1xuY29uc3QgREVGQVVMVF9XQUZfUlVMRVM6IHJlYWRvbmx5IFdhZlJ1bGVbXSA9IFtcbiAgLy8g44Os44O844OI5Yi26ZmQ44OV44Kj44Or44K/44O8XG4gIHtcbiAgICBuYW1lOiBcIndlYi1yYXRlLWZpbHRlclwiLFxuICAgIHJ1bGU6IHtcbiAgICAgIG5hbWU6IFwid2ViLXJhdGUtZmlsdGVyXCIsXG4gICAgICBwcmlvcml0eTogV0FGX1JVTEVfUFJJT1JJVElFUy5SQVRFX0xJTUlUSU5HLFxuICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgIHJhdGVCYXNlZFN0YXRlbWVudDoge1xuICAgICAgICAgIGxpbWl0OiBXQUZfQ09ORklHLkRFRkFVTFRfUkFURV9MSU1JVCxcbiAgICAgICAgICBhZ2dyZWdhdGVLZXlUeXBlOiBcIklQXCIsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYWN0aW9uOiB7XG4gICAgICAgIGJsb2NrOiB7fSxcbiAgICAgIH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IFdBRl9DT05GSUcuTUVUUklDUy5TQU1QTEVEX1JFUVVFU1RTX0VOQUJMRUQsXG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogV0FGX0NPTkZJRy5NRVRSSUNTLkNMT1VEV0FUQ0hfTUVUUklDU19FTkFCTEVELFxuICAgICAgICBtZXRyaWNOYW1lOiBcIndlYi1yYXRlLWZpbHRlclwiLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICAvLyBBV1MgSVDoqZXkvqHjg6rjgrnjg4ggLSDml6Lnn6Xjga7mgqrmhI/jga7jgYLjgovjgqLjgq/jgr/jg7wv44Oc44OD44OI44KS5ZCr44G/44CB5a6a5pyf55qE44Gr5pu05paw44GV44KM44KLXG4gIHtcbiAgICBuYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNBbWF6b25JcFJlcHV0YXRpb25MaXN0XCIsXG4gICAgcnVsZToge1xuICAgICAgbmFtZTogXCJBV1MtQVdTTWFuYWdlZFJ1bGVzQW1hem9uSXBSZXB1dGF0aW9uTGlzdFwiLFxuICAgICAgcHJpb3JpdHk6IFdBRl9SVUxFX1BSSU9SSVRJRVMuSVBfUkVQVVRBVElPTixcbiAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgdmVuZG9yTmFtZTogXCJBV1NcIixcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0FtYXpvbklwUmVwdXRhdGlvbkxpc3RcIixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvdmVycmlkZUFjdGlvbjoge1xuICAgICAgICBub25lOiB7fSxcbiAgICAgIH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljTmFtZTogXCJBV1NNYW5hZ2VkUnVsZXNBbWF6b25JcFJlcHV0YXRpb25MaXN0XCIsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIC8vIOWFsemAmuODq+ODvOODq+OCu+ODg+ODiCAtIE9XQVNQIENvcmUgUnVsZSBTZXTjga7kuLvopoHpg6jliIbjgajmlbTlkIhcbiAge1xuICAgIG5hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICBydWxlOiB7XG4gICAgICBuYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0XCIsXG4gICAgICBwcmlvcml0eTogV0FGX1JVTEVfUFJJT1JJVElFUy5DT01NT05fUlVMRVMsXG4gICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgbWFuYWdlZFJ1bGVHcm91cFN0YXRlbWVudDoge1xuICAgICAgICAgIHZlbmRvck5hbWU6IFwiQVdTXCIsXG4gICAgICAgICAgbmFtZTogXCJBV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0XCIsXG4gICAgICAgICAgLy8gU05T6YCa55+l44Gu44Gf44KB44Gu5rGO55SoUkZJ44Oc44OH44Kj44Or44O844Or44KS6Zmk5aSWXG4gICAgICAgICAgLy8gaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL3dhZi9sYXRlc3QvZGV2ZWxvcGVyZ3VpZGUvYXdzLW1hbmFnZWQtcnVsZS1ncm91cHMtbGlzdC5odG1sXG4gICAgICAgICAgZXhjbHVkZWRSdWxlczogW1xuICAgICAgICAgICAgeyBuYW1lOiBcIkdlbmVyaWNSRklfQk9EWVwiIH0sXG4gICAgICAgICAgICB7IG5hbWU6IFwiU2l6ZVJlc3RyaWN0aW9uc19CT0RZXCIgfSxcbiAgICAgICAgICAgIHsgbmFtZTogXCJDcm9zc1NpdGVTY3JpcHRpbmdfQk9EWVwiIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvdmVycmlkZUFjdGlvbjoge1xuICAgICAgICBub25lOiB7fSxcbiAgICAgIH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljTmFtZTogXCJBV1MtQVdTTWFuYWdlZFJ1bGVzQ29tbW9uUnVsZVNldFwiLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICAvLyDml6Lnn6Xjga7kuI3mraPlhaXlipvjg6vjg7zjg6vjgrvjg4Pjg4hcbiAge1xuICAgIG5hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc0tub3duQmFkSW5wdXRzUnVsZVNldFwiLFxuICAgIHJ1bGU6IHtcbiAgICAgIG5hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc0tub3duQmFkSW5wdXRzUnVsZVNldFwiLFxuICAgICAgcHJpb3JpdHk6IFdBRl9SVUxFX1BSSU9SSVRJRVMuQkFEX0lOUFVUUyxcbiAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgdmVuZG9yTmFtZTogXCJBV1NcIixcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0tub3duQmFkSW5wdXRzUnVsZVNldFwiLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG92ZXJyaWRlQWN0aW9uOiB7XG4gICAgICAgIG5vbmU6IHt9LFxuICAgICAgfSxcbiAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNLbm93bkJhZElucHV0c1J1bGVTZXRcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgLy8gU1FM44Kk44Oz44K444Kn44Kv44K344On44Oz44Or44O844Or44K744OD44OIXG4gIHtcbiAgICBuYW1lOiBcIkFXUy1BV1NNYW5hZ2VkUnVsZXNTUUxpUnVsZVNldFwiLFxuICAgIHJ1bGU6IHtcbiAgICAgIG5hbWU6IFwiQVdTLUFXU01hbmFnZWRSdWxlc1NRTGlSdWxlU2V0XCIsXG4gICAgICBwcmlvcml0eTogV0FGX1JVTEVfUFJJT1JJVElFUy5TUUxfSU5KRUNUSU9OLFxuICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgIG1hbmFnZWRSdWxlR3JvdXBTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICB2ZW5kb3JOYW1lOiBcIkFXU1wiLFxuICAgICAgICAgIG5hbWU6IFwiQVdTTWFuYWdlZFJ1bGVzU1FMaVJ1bGVTZXRcIixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvdmVycmlkZUFjdGlvbjoge1xuICAgICAgICBub25lOiB7fSxcbiAgICAgIH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljTmFtZTogXCJBV1MtQVdTTWFuYWdlZFJ1bGVzU1FMaVJ1bGVTZXRcIixcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbl0gYXMgY29uc3Q7XG5cbi8qKlxuICogQVdTIFdBRiB2MiBXZWJBQ0zjgq/jg6njgrlcbiAqIENmbldlYkFDTOOCkuaLoeW8teOBl+OBpuOCq+OCueOCv+ODoOODq+ODvOODq+euoeeQhuapn+iDveOCkuaPkOS+m1xuICogXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3Qgd2FmID0gbmV3IFdBRih0aGlzLCAnTXlXQUYnLCBpcHNldCwgJ0NMT1VERlJPTlQnLCBleHRyYVJ1bGVzLCBnZW9SZXN0cmljdGlvbik7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFdBRiBleHRlbmRzIENmbldlYkFDTCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHNjb3BlOiBDb25zdHJ1Y3QsXG4gICAgaWQ6IHN0cmluZyxcbiAgICBpcHNldDogY2RrLmF3c193YWZ2Mi5DZm5JUFNldCB8IG51bGwsXG4gICAgZGlzdFNjb3BlOiBzdHJpbmcsXG4gICAgZXh0cmFSdWxlcz86IFdhZlJ1bGVbXSxcbiAgICBnZW9SZXN0cmljdGlvbj86IEdlb1Jlc3RyaWN0aW9uQ29uZmlnXG4gICkge1xuICAgIC8vIOODh+ODleOCqeODq+ODiOODq+ODvOODq+OBruaWsOOBl+OBhOOCs+ODlOODvOOCkuS9nOaIkO+8iOOCsOODreODvOODkOODq+eKtuaFi+OCkumBv+OBkeOCi++8iVxuICAgIGxldCB3YWZSdWxlczogV2FmUnVsZVtdID0gWy4uLkRFRkFVTFRfV0FGX1JVTEVTXTtcblxuICAgIC8vIOWcsOeQhueahOWItumZkOODq+ODvOODq+OBrui/veWKoO+8iOacgOmrmOWEquWFiOW6pu+8iVxuICAgIGlmIChnZW9SZXN0cmljdGlvbiAmJiBnZW9SZXN0cmljdGlvbi5sb2NhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZ2VvUnVsZSA9IHRoaXMuY3JlYXRlR2VvUmVzdHJpY3Rpb25SdWxlKGdlb1Jlc3RyaWN0aW9uKTtcbiAgICAgIHdhZlJ1bGVzLnVuc2hpZnQoZ2VvUnVsZSk7IC8vIOmrmOOBhOWEquWFiOW6puOBp+WFiOmgreOBq+i/veWKoFxuICAgIH1cblxuICAgIC8vIOi/veWKoOODq+ODvOODq+OBjOOBguOCi+WgtOWQiOOBr+ODnuODvOOCuO+8iOmHjeikh+OBr+WQjeWJjeOBp+mZpOWOu++8iVxuICAgIGlmIChleHRyYVJ1bGVzICYmICFpc0VtcHR5KGV4dHJhUnVsZXMpKSB7XG4gICAgICB3YWZSdWxlcyA9IHVuaXFCeShjb25jYXQod2FmUnVsZXMsIGV4dHJhUnVsZXMpLCBcIm5hbWVcIik7XG4gICAgfVxuXG4gICAgLy8gSVDjgrvjg4Pjg4jjgYzmjIflrprjgZXjgozjgabjgYTjgovloLTlkIjjgIFJUOioseWPr+ODquOCueODiOODq+ODvOODq+OCkui/veWKoFxuICAgIGlmIChpcHNldCkge1xuICAgICAgd2FmUnVsZXMucHVzaCh7XG4gICAgICAgIG5hbWU6IFwiY3VzdG9tLXdlYi1pcC1hbGxvd2xpc3RcIixcbiAgICAgICAgcnVsZToge1xuICAgICAgICAgIG5hbWU6IFwiY3VzdG9tLXdlYi1pcC1hbGxvd2xpc3RcIixcbiAgICAgICAgICBwcmlvcml0eTogV0FGX1JVTEVfUFJJT1JJVElFUy5JUF9BTExPV0xJU1QsXG4gICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICBub3RTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgICAgaXBTZXRSZWZlcmVuY2VTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgICAgIGFybjogaXBzZXQuYXR0ckFybixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgYmxvY2s6IHtcbiAgICAgICAgICAgICAgY3VzdG9tUmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgICByZXNwb25zZUNvZGU6IFdBRl9DT05GSUcuQkxPQ0tFRF9SRVNQT05TRV9DT0RFLFxuICAgICAgICAgICAgICAgIGN1c3RvbVJlc3BvbnNlQm9keUtleTogV0FGX0NPTkZJRy5SRVNQT05TRV9CT0RZX0tFWVMuQUNDRVNTX0RFTklFRCxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJjdXN0b20td2ViLWlwLWFsbG93bGlzdFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzdXBlcihzY29wZSwgaWQsIHtcbiAgICAgIGRlZmF1bHRBY3Rpb246IHsgYWxsb3c6IHt9IH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljTmFtZTogYCR7aWR9LW1ldHJpY2AsXG4gICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGN1c3RvbVJlc3BvbnNlQm9kaWVzOiB7XG4gICAgICAgIFtXQUZfQ09ORklHLlJFU1BPTlNFX0JPRFlfS0VZUy5BQ0NFU1NfREVOSUVEXToge1xuICAgICAgICAgIGNvbnRlbnRUeXBlOiBcIlRFWFRfSFRNTFwiLFxuICAgICAgICAgIGNvbnRlbnQ6IFwiPGRpdj7jgqLjgq/jgrvjgrnjgYzmi5LlkKbjgZXjgozjgb7jgZfjgZ88L2Rpdj5cIixcbiAgICAgICAgfSxcbiAgICAgICAgW1dBRl9DT05GSUcuUkVTUE9OU0VfQk9EWV9LRVlTLkdFT19CTE9DS0VEXToge1xuICAgICAgICAgIGNvbnRlbnRUeXBlOiBcIlRFWFRfSFRNTFwiLFxuICAgICAgICAgIGNvbnRlbnQ6IFwiPGRpdj7jgYrkvY/jgb7jgYTjga7lnLDln5/jgYvjgonjga7jgqLjgq/jgrvjgrnjga/liLbpmZDjgZXjgozjgabjgYTjgb7jgZk8L2Rpdj5cIixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzY29wZTogZGlzdFNjb3BlLFxuICAgICAgbmFtZTogYCR7aWR9LXdhZmAsXG4gICAgICBydWxlczogd2FmUnVsZXMubWFwKCh3YWZSdWxlKSA9PiB3YWZSdWxlLnJ1bGUpLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWcsOeQhueahOWItumZkOODq+ODvOODq+OCkuS9nOaIkOOBmeOCi1xuICAgKiBAcGFyYW0gZ2VvUmVzdHJpY3Rpb24g5Zyw55CG55qE5Yi26ZmQ44Gu6Kit5a6aXG4gICAqIEByZXR1cm5zIOWcsOeQhueahOWItumZkFdBRuODq+ODvOODq1xuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVHZW9SZXN0cmljdGlvblJ1bGUoZ2VvUmVzdHJpY3Rpb246IEdlb1Jlc3RyaWN0aW9uQ29uZmlnKTogV2FmUnVsZSB7XG4gICAgY29uc3QgaXNBbGxvd2xpc3QgPSBnZW9SZXN0cmljdGlvbi5yZXN0cmljdGlvblR5cGUgPT09ICdhbGxvd2xpc3QnO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6IFwiZ2VvLXJlc3RyaWN0aW9uXCIsXG4gICAgICBydWxlOiB7XG4gICAgICAgIG5hbWU6IFwiZ2VvLXJlc3RyaWN0aW9uXCIsXG4gICAgICAgIHByaW9yaXR5OiBXQUZfUlVMRV9QUklPUklUSUVTLkdFT19SRVNUUklDVElPTixcbiAgICAgICAgc3RhdGVtZW50OiBpc0FsbG93bGlzdCA/IHtcbiAgICAgICAgICAvLyDoqLHlj6/jg6rjgrnjg4jjga7loLTlkIjvvJrmjIflrprlm73ku6XlpJbjgpLjg5bjg63jg4Pjgq9cbiAgICAgICAgICBub3RTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBnZW9NYXRjaFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICAgIGNvdW50cnlDb2RlczogZ2VvUmVzdHJpY3Rpb24ubG9jYXRpb25zLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9IDoge1xuICAgICAgICAgIC8vIOaLkuWQpuODquOCueODiOOBruWgtOWQiO+8muaMh+WumuWbveOCkuODluODreODg+OCr1xuICAgICAgICAgIGdlb01hdGNoU3RhdGVtZW50OiB7XG4gICAgICAgICAgICBjb3VudHJ5Q29kZXM6IGdlb1Jlc3RyaWN0aW9uLmxvY2F0aW9ucyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICBibG9jazoge1xuICAgICAgICAgICAgY3VzdG9tUmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgcmVzcG9uc2VDb2RlOiBXQUZfQ09ORklHLkJMT0NLRURfUkVTUE9OU0VfQ09ERSxcbiAgICAgICAgICAgICAgY3VzdG9tUmVzcG9uc2VCb2R5S2V5OiBXQUZfQ09ORklHLlJFU1BPTlNFX0JPRFlfS0VZUy5HRU9fQkxPQ0tFRCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIG1ldHJpY05hbWU6IFwiZ2VvLXJlc3RyaWN0aW9uXCIsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBXZWJBQ0zplqLpgKPku5jjgZHjgq/jg6njgrlcbiAqIFdBRuOCkuODquOCveODvOOCueOBq+mWoumAo+S7mOOBkeOCi+OBn+OCgeOBruODmOODq+ODkeODvOOCr+ODqeOCuVxuICovXG5leHBvcnQgY2xhc3MgV2ViQUNMQXNzb2NpYXRpb24gZXh0ZW5kcyBDZm5XZWJBQ0xBc3NvY2lhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDZm5XZWJBQ0xBc3NvY2lhdGlvblByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCB7XG4gICAgICByZXNvdXJjZUFybjogcHJvcHMucmVzb3VyY2VBcm4sXG4gICAgICB3ZWJBY2xBcm46IHByb3BzLndlYkFjbEFybixcbiAgICB9KTtcbiAgfVxufVxuIl19