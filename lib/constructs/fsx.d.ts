import { Construct } from "constructs";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { CfnStorageVirtualMachine, CfnVolume } from "aws-cdk-lib/aws-fsx";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
interface FSxNProps {
    vpc: Vpc | IVpc;
    adAdminSecret: Secret;
    subnetIds: string[];
    deploymentType: string;
    fsxAdminPassword?: string;
    adConfig?: {
        existingAd: boolean;
        svmNetBiosName: string;
        adDnsIps?: string[];
        adDomainName: string;
        adAdminPassword: string;
        serviceAccountUserName: string;
        serviceAccountPassword: string;
        adOu: string;
        fileSystemAdministratorsGroup: string;
    };
}
export declare class FSxN extends Construct {
    readonly cifsVol: CfnVolume;
    readonly ragdbVol: CfnVolume;
    readonly svm: CfnStorageVirtualMachine;
    readonly fsxAdminSecret: Secret;
    readonly serviceAccountSecret: Secret;
    constructor(scope: Construct, id: string, props: FSxNProps);
}
export {};
