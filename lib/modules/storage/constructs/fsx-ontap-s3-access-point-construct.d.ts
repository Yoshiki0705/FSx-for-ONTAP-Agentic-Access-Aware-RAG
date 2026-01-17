/**
 * FSx for ONTAP + S3 Access Points統合Construct
 *
 * 目的:
 * - FSx for ONTAPボリュームへのS3 API経由アクセスを提供
 * - Lambda環境でのNFS/SMBマウント制限を解決
 * - Memory/Browser/Code Interpreter/Evaluations/Policy機能で共通使用
 *
 * 機能:
 * - S3 Access Point作成
 * - VPCエンドポイント作成
 * - IAMポリシー設定
 * - Lambda関数へのアクセス権限付与
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
/**
 * FSx for ONTAP + S3 Access Points Construct Props
 */
export interface FsxOntapS3AccessPointConstructProps {
    /**
     * FSx for ONTAPファイルシステムID
     */
    readonly fsxFileSystemId: string;
    /**
     * FSx for ONTAPボリュームパス
     * 例: '/memory-volume', '/browser-volume', '/code-interpreter-volume'
     */
    readonly volumePath: string;
    /**
     * 用途（機能名）
     * 例: 'memory', 'browser', 'code-interpreter', 'evaluations', 'policy'
     */
    readonly purpose: string;
    /**
     * VPC
     */
    readonly vpc: ec2.IVpc;
    /**
     * プライベートサブネット
     */
    readonly privateSubnets: ec2.ISubnet[];
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * 環境名
     */
    readonly environment: string;
    /**
     * KMSキー（オプション）
     */
    readonly kmsKey?: any;
}
/**
 * FSx for ONTAP + S3 Access Points Construct
 *
 * このConstructは、FSx for ONTAPボリュームへのS3 API経由アクセスを提供します。
 * Lambda環境ではNFS/SMBマウントができないため、S3 Access Pointsを使用します。
 */
export declare class FsxOntapS3AccessPointConstruct extends Construct {
    /**
     * S3 Access Point ARN
     */
    readonly accessPointArn: string;
    /**
     * S3 Access Point名
     */
    readonly accessPointName: string;
    /**
     * VPCエンドポイント
     */
    readonly vpcEndpoint: ec2.IVpcEndpoint;
    /**
     * IAMポリシー
     */
    readonly accessPolicy: iam.PolicyStatement;
    constructor(scope: Construct, id: string, props: FsxOntapS3AccessPointConstructProps);
    /**
     * Lambda関数にアクセス権限を付与
     *
     * @param lambdaFunction Lambda関数
     */
    grantReadWrite(lambdaFunction: lambda.IFunction): void;
    /**
     * Lambda関数に読み取り専用権限を付与
     *
     * @param lambdaFunction Lambda関数
     */
    grantRead(lambdaFunction: lambda.IFunction): void;
    /**
     * Lambda関数に書き込み専用権限を付与
     *
     * @param lambdaFunction Lambda関数
     */
    grantWrite(lambdaFunction: lambda.IFunction): void;
}
