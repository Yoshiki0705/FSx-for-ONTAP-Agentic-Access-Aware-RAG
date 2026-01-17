/**
 * FSx for ONTAP オプショナルコンストラクト
 *
 * 現在のFsxOntapConfigインターフェースに合わせて簡素化
 * 複雑な設定は将来のバージョンで実装予定
 */
import { Construct } from 'constructs';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { FsxOntapConfig } from '../../../config/interfaces/environment-config';
export interface FSxONTAPOptionalProps {
    readonly config: FsxOntapConfig;
    readonly projectName: string;
    readonly environment: string;
    readonly vpc?: ec2.IVpc;
    readonly subnetIds?: string[];
    readonly tags?: {
        [key: string]: string;
    };
}
/**
 * FSx for ONTAP オプショナルコンストラクト（簡素化版）
 */
export declare class FSxONTAPOptionalConstruct extends Construct {
    readonly fileSystem?: fsx.CfnFileSystem;
    readonly dnsName?: string;
    constructor(scope: Construct, id: string, props: FSxONTAPOptionalProps);
    private createBasicFsxFileSystem;
    /**
     * FSx機能が有効かどうかを確認
     */
    isEnabled(): boolean;
    /**
     * 接続情報を取得
     */
    getConnectionInfo(): {
        fileSystemId?: string;
        dnsName?: string;
    };
}
