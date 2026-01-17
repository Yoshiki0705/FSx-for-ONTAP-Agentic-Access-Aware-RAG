import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StorageConfig } from '../interfaces/storage-config';
export interface StorageConstructProps {
    readonly config: StorageConfig;
    readonly vpc?: ec2.IVpc;
    readonly privateSubnetIds?: string[];
    readonly projectName?: string;
    readonly environment?: string;
    readonly kmsKey?: any;
}
export interface StorageOutputs {
    s3Buckets?: {
        [key: string]: s3.IBucket;
    };
    fsxFileSystemId?: string;
    fsxStorageVolumeId?: string;
    fsxDatabaseVolumeId?: string;
}
export declare class StorageConstruct extends Construct {
    fsxFileSystem?: fsx.CfnFileSystem;
    fsxStorageVolume?: fsx.CfnVolume;
    fsxDatabaseVolume?: fsx.CfnVolume;
    readonly outputs: StorageOutputs;
    documentsBucket?: s3.IBucket;
    backupBucket?: s3.IBucket;
    embeddingsBucket?: s3.IBucket;
    constructor(scope: Construct, id: string, props: StorageConstructProps);
    private readonly props;
    /**
     * S3バケット作成（オプション - FSx for ONTAPで代替可能）
     */
    private createS3Buckets;
    /**
     * FSx for ONTAP リソース作成（README.md準拠）
     */
    private createFSxOntapResources;
}
