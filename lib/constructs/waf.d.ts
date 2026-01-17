import * as cdk from "aws-cdk-lib";
import { CfnWebACL, CfnWebACLAssociation, CfnWebACLAssociationProps } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
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
export declare class Waf extends Construct {
    readonly webAcl: CfnWebACL;
    constructor(scope: Construct, id: string, props: WafConstructProps);
    /**
     * プロパティの検証を行う
     * @param props WAFコンストラクトのプロパティ
     * @throws {Error} 検証に失敗した場合
     */
    private validateProps;
    /**
     * CIDR記法の妥当性を検証する
     * @param cidr 検証するCIDR文字列
     * @returns 妥当な場合true
     */
    private isValidCIDR;
}
/**
 * AWS WAF v2 WebACLクラス
 * CfnWebACLを拡張してカスタムルール管理機能を提供
 *
 * @example
 * ```typescript
 * const waf = new WAF(this, 'MyWAF', ipset, 'CLOUDFRONT', extraRules, geoRestriction);
 * ```
 */
export declare class WAF extends CfnWebACL {
    constructor(scope: Construct, id: string, ipset: cdk.aws_wafv2.CfnIPSet | null, distScope: string, extraRules?: WafRule[], geoRestriction?: GeoRestrictionConfig);
    /**
     * 地理的制限ルールを作成する
     * @param geoRestriction 地理的制限の設定
     * @returns 地理的制限WAFルール
     */
    private createGeoRestrictionRule;
}
/**
 * WebACL関連付けクラス
 * WAFをリソースに関連付けるためのヘルパークラス
 */
export declare class WebACLAssociation extends CfnWebACLAssociation {
    constructor(scope: Construct, id: string, props: CfnWebACLAssociationProps);
}
