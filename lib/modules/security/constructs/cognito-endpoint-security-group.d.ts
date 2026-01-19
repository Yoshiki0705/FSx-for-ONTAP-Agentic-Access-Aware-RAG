/**
 * Cognito VPC Endpoint用セキュリティグループコンストラクト
 *
 * VPC内からのHTTPS通信を許可し、Cognito User Poolsへの閉域網接続を実現
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface CognitoEndpointSecurityGroupProps {
    /**
     * セキュリティグループを作成するVPC
     */
    vpc: ec2.IVpc;
    /**
     * セキュリティグループの説明
     * @default 'Security group for Cognito VPC Endpoint'
     */
    description?: string;
    /**
     * インバウンドトラフィックを許可するCIDRブロック
     * @default VPC CIDR
     */
    allowedCidrs?: string[];
    /**
     * セキュリティグループを作成するかどうか
     * CDKコンテキスト変数 `cognitoPrivateEndpoint` で制御
     * @default false
     */
    enabled?: boolean;
    /**
     * プロジェクト名（タグ付け用）
     */
    projectName: string;
    /**
     * 環境名（タグ付け用）
     */
    environment: string;
}
/**
 * Cognito VPC Endpoint用セキュリティグループコンストラクト
 *
 * VPC内からのHTTPS（ポート443）通信を許可し、
 * Cognito User Poolsへの閉域網接続を実現します。
 *
 * 使用例:
 * ```typescript
 * const cognitoSg = new CognitoEndpointSecurityGroup(this, 'CognitoSG', {
 *   vpc,
 *   enabled: true,
 *   projectName: 'permission-aware-rag',
 *   environment: 'prod',
 * });
 * ```
 */
export declare class CognitoEndpointSecurityGroup extends Construct {
    /**
     * 作成されたセキュリティグループ（enabledがtrueの場合のみ）
     */
    readonly securityGroup?: ec2.SecurityGroup;
    /**
     * セキュリティグループが有効かどうか
     */
    readonly isEnabled: boolean;
    constructor(scope: Construct, id: string, props: CognitoEndpointSecurityGroupProps);
    /**
     * セキュリティグループIDを取得
     */
    getSecurityGroupId(): string | undefined;
    /**
     * Lambda関数などからの接続を許可
     *
     * @param peer 接続元（セキュリティグループまたはCIDR）
     * @param description ルールの説明
     */
    allowConnectionFrom(peer: ec2.IPeer, description?: string): void;
}
