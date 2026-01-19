/**
 * Cognito VPC Endpointコンストラクト
 *
 * AWS PrivateLinkを使用してCognito User Poolsへの閉域網接続を提供
 * CDKコンテキスト変数 `cognitoPrivateEndpoint` で有効化
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface CognitoVpcEndpointProps {
    /**
     * VPC Endpointを作成するVPC
     */
    vpc: ec2.IVpc;
    /**
     * VPC Endpointを配置するサブネット
     * プライベートサブネットを推奨
     */
    subnets?: ec2.SubnetSelection;
    /**
     * VPC Endpointに関連付けるセキュリティグループ
     */
    securityGroups?: ec2.ISecurityGroup[];
    /**
     * プライベートDNSを有効化するかどうか
     * @default true
     */
    enablePrivateDns?: boolean;
    /**
     * VPC Endpointを作成するかどうか
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
 * Cognito VPC Endpointコンストラクト
 *
 * AWS PrivateLinkを使用してCognito User Poolsへの閉域網接続を提供します。
 *
 * 使用例:
 * ```typescript
 * const cognitoEndpoint = new CognitoVpcEndpoint(this, 'CognitoEndpoint', {
 *   vpc,
 *   subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
 *   securityGroups: [cognitoEndpointSg],
 *   enabled: true,
 *   projectName: 'permission-aware-rag',
 *   environment: 'prod',
 * });
 * ```
 */
export declare class CognitoVpcEndpoint extends Construct {
    /**
     * 作成されたVPC Endpoint（enabledがtrueの場合のみ）
     */
    readonly vpcEndpoint?: ec2.InterfaceVpcEndpoint;
    /**
     * VPC Endpointが有効かどうか
     */
    readonly isEnabled: boolean;
    constructor(scope: Construct, id: string, props: CognitoVpcEndpointProps);
    /**
     * VPC EndpointのDNSエントリを取得
     */
    getDnsEntries(): string[];
    /**
     * VPC Endpoint IDを取得
     */
    getEndpointId(): string | undefined;
}
