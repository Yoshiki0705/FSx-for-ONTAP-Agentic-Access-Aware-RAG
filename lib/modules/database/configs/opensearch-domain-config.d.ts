/**
 * OpenSearch Domain設定
 *
 * 環境別のOpenSearchドメイン設定を提供
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
/**
 * 開発環境用OpenSearch設定
 */
export declare function getDevOpenSearchConfig(projectName?: string): {
    domainName: string;
    environment: string;
    instanceConfig: {
        instanceType: ec2.InstanceType;
        instanceCount: number;
        dedicatedMasterEnabled: boolean;
    };
    storageConfig: {
        volumeType: ec2.EbsDeviceVolumeType;
        volumeSize: number;
        throughput: number;
    };
    networkConfig: {
        vpcEnabled: boolean;
    };
    securityConfig: {
        encryptionAtRest: boolean;
        nodeToNodeEncryption: boolean;
        enforceHttps: boolean;
        fineGrainedAccessControl: boolean;
    };
    monitoringConfig: {
        logsEnabled: boolean;
        slowLogsEnabled: boolean;
        appLogsEnabled: boolean;
        indexSlowLogsEnabled: boolean;
    };
    backupConfig: {
        automatedSnapshotStartHour: number;
    };
    indexConfig: {
        numberOfShards: number;
        numberOfReplicas: number;
    };
    tags: {
        Environment: string;
        Purpose: string;
        CostCenter: string;
    };
};
/**
 * ステージング環境用OpenSearch設定
 */
export declare function getStagingOpenSearchConfig(projectName?: string): {
    domainName: string;
    environment: string;
    instanceConfig: {
        instanceType: ec2.InstanceType;
        instanceCount: number;
        dedicatedMasterEnabled: boolean;
    };
    storageConfig: {
        volumeType: ec2.EbsDeviceVolumeType;
        volumeSize: number;
        throughput: number;
    };
    networkConfig: {
        vpcEnabled: boolean;
    };
    securityConfig: {
        encryptionAtRest: boolean;
        nodeToNodeEncryption: boolean;
        enforceHttps: boolean;
        fineGrainedAccessControl: boolean;
        masterUserName: string;
    };
    monitoringConfig: {
        logsEnabled: boolean;
        slowLogsEnabled: boolean;
        appLogsEnabled: boolean;
        indexSlowLogsEnabled: boolean;
    };
    backupConfig: {
        automatedSnapshotStartHour: number;
    };
    indexConfig: {
        numberOfShards: number;
        numberOfReplicas: number;
    };
    tags: {
        Environment: string;
        Purpose: string;
        CostCenter: string;
    };
};
/**
 * 本番環境用OpenSearch設定
 */
export declare function getProdOpenSearchConfig(projectName?: string): {
    domainName: string;
    environment: string;
    instanceConfig: {
        instanceType: ec2.InstanceType;
        instanceCount: number;
        dedicatedMasterEnabled: boolean;
        masterInstanceType: ec2.InstanceType;
        masterInstanceCount: number;
    };
    storageConfig: {
        volumeType: ec2.EbsDeviceVolumeType;
        volumeSize: number;
        throughput: number;
        iops: number;
    };
    networkConfig: {
        vpcEnabled: boolean;
    };
    securityConfig: {
        encryptionAtRest: boolean;
        nodeToNodeEncryption: boolean;
        enforceHttps: boolean;
        fineGrainedAccessControl: boolean;
        masterUserName: string;
    };
    monitoringConfig: {
        logsEnabled: boolean;
        slowLogsEnabled: boolean;
        appLogsEnabled: boolean;
        indexSlowLogsEnabled: boolean;
    };
    backupConfig: {
        automatedSnapshotStartHour: number;
    };
    indexConfig: {
        numberOfShards: number;
        numberOfReplicas: number;
    };
    tags: {
        Environment: string;
        Purpose: string;
        CostCenter: string;
    };
};
/**
 * 環境に応じた設定取得
 */
export declare function getOpenSearchDomainConfig(environment: string, projectName?: string): {
    domainName: string;
    environment: string;
    instanceConfig: {
        instanceType: ec2.InstanceType;
        instanceCount: number;
        dedicatedMasterEnabled: boolean;
    };
    storageConfig: {
        volumeType: ec2.EbsDeviceVolumeType;
        volumeSize: number;
        throughput: number;
    };
    networkConfig: {
        vpcEnabled: boolean;
    };
    securityConfig: {
        encryptionAtRest: boolean;
        nodeToNodeEncryption: boolean;
        enforceHttps: boolean;
        fineGrainedAccessControl: boolean;
    };
    monitoringConfig: {
        logsEnabled: boolean;
        slowLogsEnabled: boolean;
        appLogsEnabled: boolean;
        indexSlowLogsEnabled: boolean;
    };
    backupConfig: {
        automatedSnapshotStartHour: number;
    };
    indexConfig: {
        numberOfShards: number;
        numberOfReplicas: number;
    };
    tags: {
        Environment: string;
        Purpose: string;
        CostCenter: string;
    };
};
