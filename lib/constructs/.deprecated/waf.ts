/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { concat, isEmpty, uniqBy } from "lodash";

import * as cdk from "aws-cdk-lib";
import {
  CfnIPSet,
  CfnWebACL,
  CfnWebACLAssociation,
  CfnWebACLAssociationProps,
} from "aws-cdk-lib/aws-wafv2";

import { Construct } from "constructs";

/**
 * WAF設定定数
 */
const WAF_CONFIG = {
  /** デフォルトのレート制限（リクエスト/5分） */
  DEFAULT_RATE_LIMIT: 3000,
  /** IPアドレスバージョン */
  IP_ADDRESS_VERSION: "IPV4" as const,
  /** カスタムレスポンスコード */
  BLOCKED_RESPONSE_CODE: 403,
  /** WAFスコープ */
  SCOPE: {
    CLOUDFRONT: "CLOUDFRONT" as const,
    REGIONAL: "REGIONAL" as const,
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
} as const;

/**
 * WAFルールの定義インターフェース
 */
export interface WafRule {
  name: string;
  rule: CfnWebACL.RuleProperty;
}

/**
 * 地理的制限の設定インターフェース
 */
export interface GeoRestrictionConfig {
  /** 許可リスト（allowlist）または拒否リスト（denylist）の指定 */
  restrictionType: 'allowlist' | 'denylist';
  /** ISO 3166-1 alpha-2 国コードのリスト（例: ['JP', 'US', 'CA']） */
  locations: string[];
}

/**
 * WAFコンストラクトのプロパティ
 */
export interface WafConstructProps {
  /** CloudFront用WAFかどうか（true）、リージョナルリソース用か（false） */
  useCloudFront?: boolean;
  /** このWAFに関連付けるリソースのARN（CloudFrontでは不要） */
  webACLResourceArn?: string;
  /** 追加のカスタムWAFルール */
  extraRules?: WafRule[];
  /** CIDR記法で指定された許可IPアドレスのリスト */
  allowedIps: string[];
  /** 地理的アクセス制限の設定 */
  geoRestriction?: GeoRestrictionConfig;
}

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
export class Waf extends Construct {
  public readonly webAcl: CfnWebACL;

  constructor(
    scope: Construct,
    id: string,
    props: WafConstructProps
  ) {
    super(scope, id);

    // 入力値の検証
    this.validateProps(props);

    let ipset = null;
    const distScope = props.useCloudFront ? WAF_CONFIG.SCOPE.CLOUDFRONT : WAF_CONFIG.SCOPE.REGIONAL;

    // 許可IPアドレスが指定されている場合、IPセットを作成
    if (!isEmpty(props.allowedIps)) {
      ipset = new CfnIPSet(this, `${id}-ipset`, {
        addresses: props.allowedIps,
        ipAddressVersion: WAF_CONFIG.IP_ADDRESS_VERSION,
        scope: distScope,
        description: "アプリケーション許可IPv4アドレス",
        name: `${id}-app-ip-list`,
      });
    }

    // AWS WAFの作成
    this.webAcl = new WAF(
      this,
      `${id}-WAFv2`,
      ipset,
      distScope,
      props.extraRules,
      props.geoRestriction
    );

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
  private validateProps(props: WafConstructProps): void {
    // IPアドレスの検証
    if (props.allowedIps) {
      const invalidIps: string[] = [];
      props.allowedIps.forEach(ip => {
        if (!this.isValidCIDR(ip)) {
          invalidIps.push(ip);
        }
      });

      if (invalidIps.length > 0) {
        throw new Error(
          `無効なIPアドレスまたはCIDR記法が検出されました: ${invalidIps.join(', ')}\n` +
          `有効な形式: 192.168.1.1 または 192.168.1.0/24`
        );
      }
    }

    // 地理的制限の検証
    if (props.geoRestriction) {
      if (props.geoRestriction.locations.length === 0) {
        throw new Error(
          '地理的制限の国コードリストが空です。' +
          '少なくとも1つの国コードを指定してください（例: ["JP", "US"]）'
        );
      }

      const invalidCodes: string[] = [];
      props.geoRestriction.locations.forEach(code => {
        if (!/^[A-Z]{2}$/.test(code)) {
          invalidCodes.push(code);
        }
      });

      if (invalidCodes.length > 0) {
        throw new Error(
          `無効な国コードが検出されました: ${invalidCodes.join(', ')}\n` +
          `ISO 3166-1 alpha-2形式（2文字の大文字）で指定してください（例: JP, US, CA）`
        );
      }
    }

    // CloudFront以外でリソースARNが必要な場合の検証
    if (!props.useCloudFront && !props.webACLResourceArn) {
      throw new Error(
        'リージョナルWAFを使用する場合は webACLResourceArn を指定してください。' +
        'CloudFrontを使用する場合は useCloudFront: true を設定してください。'
      );
    }
  }

  /**
   * CIDR記法の妥当性を検証する
   * @param cidr 検証するCIDR文字列
   * @returns 妥当な場合true
   */
  private isValidCIDR(cidr: string): boolean {
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

/**
 * WAFルールの優先度定数
 * 優先度が低い数値ほど先に評価される
 */
const WAF_RULE_PRIORITIES = {
  GEO_RESTRICTION: 50,      // 地理的制限（最高優先度）
  RATE_LIMITING: 100,       // レート制限
  IP_REPUTATION: 200,       // IP評価
  COMMON_RULES: 300,        // 共通ルール
  BAD_INPUTS: 400,          // 不正入力
  SQL_INJECTION: 500,       // SQLインジェクション
  IP_ALLOWLIST: 600,        // IP許可リスト（最低優先度）
  CUSTOM_RULES_START: 700,  // カスタムルール開始位置
} as const;

/**
 * WAFルールの優先度を管理するヘルパークラス
 */
class WafRulePriorityManager {
  private static nextCustomPriority = WAF_RULE_PRIORITIES.CUSTOM_RULES_START;

  /**
   * カスタムルール用の次の優先度を取得
   * @returns 次の利用可能な優先度
   */
  static getNextCustomPriority(): number {
    return this.nextCustomPriority++;
  }

  /**
   * 優先度をリセット（テスト用）
   */
  static resetCustomPriority(): void {
    this.nextCustomPriority = WAF_RULE_PRIORITIES.CUSTOM_RULES_START;
  }
}

/**
 * デフォルトのWAFルール定義
 * グローバル変数を避けて、各インスタンスで新しいコピーを作成
 */
const DEFAULT_WAF_RULES: readonly WafRule[] = [
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
] as const;

/**
 * AWS WAF v2 WebACLクラス
 * CfnWebACLを拡張してカスタムルール管理機能を提供
 * 
 * @example
 * ```typescript
 * const waf = new WAF(this, 'MyWAF', ipset, 'CLOUDFRONT', extraRules, geoRestriction);
 * ```
 */
export class WAF extends CfnWebACL {
  constructor(
    scope: Construct,
    id: string,
    ipset: cdk.aws_wafv2.CfnIPSet | null,
    distScope: string,
    extraRules?: WafRule[],
    geoRestriction?: GeoRestrictionConfig
  ) {
    // デフォルトルールの新しいコピーを作成（グローバル状態を避ける）
    let wafRules: WafRule[] = [...DEFAULT_WAF_RULES];

    // 地理的制限ルールの追加（最高優先度）
    if (geoRestriction && geoRestriction.locations.length > 0) {
      const geoRule = this.createGeoRestrictionRule(geoRestriction);
      wafRules.unshift(geoRule); // 高い優先度で先頭に追加
    }

    // 追加ルールがある場合はマージ（重複は名前で除去）
    if (extraRules && !isEmpty(extraRules)) {
      wafRules = uniqBy(concat(wafRules, extraRules), "name");
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
  private createGeoRestrictionRule(geoRestriction: GeoRestrictionConfig): WafRule {
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

/**
 * WebACL関連付けクラス
 * WAFをリソースに関連付けるためのヘルパークラス
 */
export class WebACLAssociation extends CfnWebACLAssociation {
  constructor(scope: Construct, id: string, props: CfnWebACLAssociationProps) {
    super(scope, id, {
      resourceArn: props.resourceArn,
      webAclArn: props.webAclArn,
    });
  }
}
