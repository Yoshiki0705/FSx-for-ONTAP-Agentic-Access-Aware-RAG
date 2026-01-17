"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FSxN = void 0;
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const aws_ec2_1 = require("aws-cdk-lib/aws-ec2");
const aws_fsx_1 = require("aws-cdk-lib/aws-fsx");
const aws_secretsmanager_1 = require("aws-cdk-lib/aws-secretsmanager");
const cdk_nag_1 = require("cdk-nag");
const aws_cdk_lib_1 = require("aws-cdk-lib");
class FSxN extends constructs_1.Construct {
    cifsVol;
    ragdbVol;
    svm;
    fsxAdminSecret;
    serviceAccountSecret;
    constructor(scope, id, props) {
        super(scope, id);
        let privateSubnets = props.subnetIds.length > 0
            ? props.subnetIds
            : props.vpc.privateSubnets.map((subnet) => subnet.subnetId);
        if (props.deploymentType === 'SINGLE_AZ_1') {
            privateSubnets = [privateSubnets[0]];
        }
        const fileSystemSg = new aws_ec2_1.SecurityGroup(this, "SgForFSxN", {
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        // https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/limit-access-security-groups.html
        const tcpList = [
            22, 111, 135, 139, 161, 162, 443, 445, 635, 749, 2049, 3260, 4045, 4046,
            10000, 11104, 11105,
        ];
        const udpList = [111, 135, 137, 139, 161, 162, 635, 2049, 4045, 4046, 4049];
        //Add alltrafic testing
        fileSystemSg.addIngressRule(aws_ec2_1.Peer.ipv4(`0.0.0.0/0`), aws_ec2_1.Port.allTraffic());
        fileSystemSg.addIngressRule(aws_ec2_1.Peer.ipv4(props.vpc.vpcCidrBlock), aws_ec2_1.Port.icmpPing(), "Pinging the instance");
        tcpList.map((port) => {
            fileSystemSg.addIngressRule(aws_ec2_1.Peer.ipv4(props.vpc.vpcCidrBlock), aws_ec2_1.Port.tcp(port));
        });
        udpList.map((port) => {
            fileSystemSg.addIngressRule(aws_ec2_1.Peer.ipv4(props.vpc.vpcCidrBlock), aws_ec2_1.Port.udp(port));
        });
        const fsxAdminSecret = !props.fsxAdminPassword
            ? new aws_secretsmanager_1.Secret(this, "fsxAdminSecrets", {
                generateSecretString: {
                    generateStringKey: "password",
                    passwordLength: 32,
                    requireEachIncludedType: true,
                    secretStringTemplate: JSON.stringify({ username: "fsxadmin" }),
                },
            })
            : new aws_secretsmanager_1.Secret(this, "fsxAdminSecrets", {
                secretObjectValue: {
                    username: aws_cdk_lib_1.SecretValue.unsafePlainText("fsxadmin"),
                    password: aws_cdk_lib_1.SecretValue.unsafePlainText(props.fsxAdminPassword),
                },
            });
        this.fsxAdminSecret = fsxAdminSecret;
        const fileSystem = new aws_fsx_1.CfnFileSystem(this, "FileSystem", {
            fileSystemType: "ONTAP",
            subnetIds: privateSubnets,
            storageCapacity: props.storageCapacity,
            securityGroupIds: [fileSystemSg.securityGroupId],
            ontapConfiguration: {
                deploymentType: props.deploymentType,
                throughputCapacity: props.throughputCapacity,
                fsxAdminPassword: new cdk.CfnDynamicReference(cdk.CfnDynamicReferenceService.SECRETS_MANAGER, `${this.fsxAdminSecret.secretArn}:SecretString:password`).toString(),
                preferredSubnetId: privateSubnets[0],
            },
        });
        // Service Accountのパスワード設定が空の場合は、AdAdminのパスワードを設定
        const serviceAccountSecret = !props.adConfig.serviceAccountPassword
            ? new aws_secretsmanager_1.Secret(this, "serviceAccountSecret", {
                secretObjectValue: {
                    username: aws_cdk_lib_1.SecretValue.unsafePlainText(props.adConfig.serviceAccountUserName),
                    password: aws_cdk_lib_1.SecretValue.unsafePlainText(new cdk.CfnDynamicReference(cdk.CfnDynamicReferenceService.SECRETS_MANAGER, `${props.adAdminSecret.secretArn}:SecretString:password`).toString()),
                },
            })
            : new aws_secretsmanager_1.Secret(this, "serviceAccountSecret", {
                secretObjectValue: {
                    username: aws_cdk_lib_1.SecretValue.unsafePlainText(props.adConfig.serviceAccountUserName),
                    password: aws_cdk_lib_1.SecretValue.unsafePlainText(props.adConfig.serviceAccountPassword),
                },
            });
        this.serviceAccountSecret = serviceAccountSecret;
        const svm = new aws_fsx_1.CfnStorageVirtualMachine(this, "SVM", {
            fileSystemId: fileSystem.ref,
            name: props.adConfig.svmNetBiosName,
            svmAdminPassword: new cdk.CfnDynamicReference(cdk.CfnDynamicReferenceService.SECRETS_MANAGER, `${this.fsxAdminSecret.secretArn}:SecretString:password`).toString(),
            activeDirectoryConfiguration: {
                netBiosName: props.adConfig.svmNetBiosName,
                selfManagedActiveDirectoryConfiguration: {
                    dnsIps: props.adDnsIps,
                    domainName: props.adConfig.adDomainName,
                    userName: props.adConfig.serviceAccountUserName,
                    password: new cdk.CfnDynamicReference(cdk.CfnDynamicReferenceService.SECRETS_MANAGER, `${serviceAccountSecret.secretArn}:SecretString:password`).toString(),
                    organizationalUnitDistinguishedName: props.adConfig.adOu,
                    fileSystemAdministratorsGroup: props.adConfig.fileSystemAdministratorsGroup
                },
            },
        });
        this.svm = svm;
        this.cifsVol = new aws_fsx_1.CfnVolume(this, "BedrockRag", {
            name: "bedrockrag",
            ontapConfiguration: {
                storageVirtualMachineId: svm.ref,
                junctionPath: "/bedrockrag",
                sizeInMegabytes: "1024",
                storageEfficiencyEnabled: "true",
                securityStyle: "MIXED",
            },
            volumeType: "ONTAP",
        });
        this.ragdbVol = new aws_fsx_1.CfnVolume(this, "RagDB", {
            name: "ragdb",
            ontapConfiguration: {
                storageVirtualMachineId: svm.ref,
                junctionPath: "/ragdb",
                sizeInMegabytes: "1024",
                storageEfficiencyEnabled: "true",
                securityStyle: "UNIX",
            },
            volumeType: "ONTAP",
        });
        cdk_nag_1.NagSuppressions.addResourceSuppressions([fileSystemSg, fsxAdminSecret, serviceAccountSecret], [
            {
                id: "AwsSolutions-SMG4",
                reason: "Need for FSxN ONTAP mount",
            },
            {
                id: "AwsSolutions-EC23",
                reason: "Need for FSxN ONTAP mount",
            },
            {
                id: "AwsSolutions-SMG4",
                reason: "No need rotation for PoC",
            },
        ], true);
    }
}
exports.FSxN = FSxN;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnN4LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZnN4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7R0FJRztBQUNILDJDQUF1QztBQUN2QyxpREFBbUM7QUFDbkMsaURBQTJFO0FBQzNFLGlEQUk2QjtBQUM3Qix1RUFBd0Q7QUFDeEQscUNBQTBDO0FBRTFDLDZDQUEwQztBQXFCMUMsTUFBYSxJQUFLLFNBQVEsc0JBQVM7SUFDakIsT0FBTyxDQUFZO0lBQ25CLFFBQVEsQ0FBWTtJQUNwQixHQUFHLENBQTJCO0lBQzlCLGNBQWMsQ0FBUztJQUN2QixvQkFBb0IsQ0FBUztJQUM3QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWdCO1FBQ3hELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxjQUFjLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQztZQUM3QyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVM7WUFDakIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFBO1FBQzdELElBQUcsS0FBSyxDQUFDLGNBQWMsS0FBSyxhQUFhLEVBQUMsQ0FBQztZQUFBLGNBQWMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQUEsQ0FBQztRQUVoRixNQUFNLFlBQVksR0FBRyxJQUFJLHVCQUFhLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUN4RCxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDZCxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILHNGQUFzRjtRQUN0RixNQUFNLE9BQU8sR0FBRztZQUNkLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFF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QUFFLE9BQU87WUFDYixrQkFBa0IsRUFBRTtnQkFDbEIsdUJBQXVCLEVBQUUsR0FBRyxDQUFDLEdBQUc7Z0JBQ2hDLFlBQVksRUFBRSxRQUFRO2dCQUN0QixlQUFlLEVBQUUsTUFBTTtnQkFDdkIsd0JBQXdCLEVBQUUsTUFBTTtnQkFDaEMsYUFBYSxFQUFFLE1BQU07YUFDdEI7WUFDRCxVQUFVLEVBQUUsT0FBTztTQUNwQixDQUFDLENBQUM7UUFFSCx5QkFBZSxDQUFDLHVCQUF1QixDQUNyQyxDQUFDLFlBQVksRUFBRSxjQUFjLEVBQUMsb0JBQW9CLENBQUMsRUFDbkQ7WUFDRTtnQkFDRSxFQUFFLEVBQUUsbUJBQW1CO2dCQUN2QixNQUFNLEVBQUUsMkJBQTJCO2FBQ3BDO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLG1CQUFtQjtnQkFDdkIsTUFBTSxFQUFFLDJCQUEyQjthQUNwQztZQUNEO2dCQUNFLEVBQUUsRUFBRSxtQkFBbUI7Z0JBQ3ZCLE1BQU0sRUFBRSwwQkFBMEI7YUFDbkM7U0FDRixFQUNELElBQUksQ0FDTCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBektELG9CQXlLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiAgQ29weXJpZ2h0IDIwMjUgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqICBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTGljZW5zZVJlZi0uYW1hem9uLmNvbS4tQW16blNMLTEuMFxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBbWF6b24gU29mdHdhcmUgTGljZW5zZSAgaHR0cDovL2F3cy5hbWF6b24uY29tL2FzbC9cbiAqL1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7IElWcGMsIFBlZXIsIFBvcnQsIFNlY3VyaXR5R3JvdXAsIFZwYyB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWMyXCI7XG5pbXBvcnQge1xuICBDZm5GaWxlU3lzdGVtLFxuICBDZm5TdG9yYWdlVmlydHVhbE1hY2hpbmUsXG4gIENmblZvbHVtZSxcbn0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1mc3hcIjtcbmltcG9ydCB7IFNlY3JldCB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXJcIjtcbmltcG9ydCB7IE5hZ1N1cHByZXNzaW9ucyB9IGZyb20gXCJjZGstbmFnXCI7XG5pbXBvcnQgeyBGc3hDb25maWcgfSBmcm9tIFwiLi4vLi4vdHlwZXMvdHlwZVwiO1xuaW1wb3J0IHsgU2VjcmV0VmFsdWUgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5cbmludGVyZmFjZSBGU3hOUHJvcHMge1xuICB2cGM6IFZwYyB8IElWcGM7XG4gIGFkQWRtaW5TZWNyZXQ6IFNlY3JldDtcbiAgc3VibmV0SWRzOiBzdHJpbmdbXTtcbiAgZGVwbG95bWVudFR5cGU6IHN0cmluZztcbiAgZnN4QWRtaW5QYXNzd29yZD86IHN0cmluZztcbiAgYWRDb25maWc/OiB7XG4gICAgZXhpc3RpbmdBZDogYm9vbGVhbjtcbiAgICBzdm1OZXRCaW9zTmFtZTogc3RyaW5nO1xuICAgIGFkRG5zSXBzPzogc3RyaW5nW107XG4gICAgYWREb21haW5OYW1lOiBzdHJpbmc7XG4gICAgYWRBZG1pblBhc3N3b3JkOiBzdHJpbmc7XG4gICAgc2VydmljZUFjY291bnRVc2VyTmFtZTogc3RyaW5nO1xuICAgIHNlcnZpY2VBY2NvdW50UGFzc3dvcmQ6IHN0cmluZztcbiAgICBhZE91OiBzdHJpbmc7XG4gICAgZmlsZVN5c3RlbUFkbWluaXN0cmF0b3JzR3JvdXA6IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIEZTeE4gZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgY2lmc1ZvbDogQ2ZuVm9sdW1lO1xuICBwdWJsaWMgcmVhZG9ubHkgcmFnZGJWb2w6IENmblZvbHVtZTtcbiAgcHVibGljIHJlYWRvbmx5IHN2bTogQ2ZuU3RvcmFnZVZpcnR1YWxNYWNoaW5lO1xuICBwdWJsaWMgcmVhZG9ubHkgZnN4QWRtaW5TZWNyZXQ6IFNlY3JldDtcbiAgcHVibGljIHJlYWRvbmx5IHNlcnZpY2VBY2NvdW50U2VjcmV0OiBTZWNyZXQ7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBGU3hOUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgbGV0IHByaXZhdGVTdWJuZXRzID0gcHJvcHMuc3VibmV0SWRzLmxlbmd0aCA+IDAgXG4gICAgICA/IHByb3BzLnN1Ym5ldElkc1xuICAgICAgOiBwcm9wcy52cGMucHJpdmF0ZVN1Ym5ldHMubWFwKChzdWJuZXQpID0+IHN1Ym5ldC5zdWJuZXRJZClcbiAgICBpZihwcm9wcy5kZXBsb3ltZW50VHlwZSA9PT0gJ1NJTkdMRV9BWl8xJyl7cHJpdmF0ZVN1Ym5ldHMgPSBbcHJpdmF0ZVN1Ym5ldHNbMF1dfVxuXG4gICAgY29uc3QgZmlsZVN5c3RlbVNnID0gbmV3IFNlY3VyaXR5R3JvdXAodGhpcywgXCJTZ0ZvckZTeE5cIiwge1xuICAgICAgdnBjOiBwcm9wcy52cGMsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2ZzeC9sYXRlc3QvT05UQVBHdWlkZS9saW1pdC1hY2Nlc3Mtc2VjdXJpdHktZ3JvdXBzLmh0bWxcbiAgICBjb25zdCB0Y3BMaXN0ID0gW1xuICAgICAgMjIsIDExMSwgMTM1LCAxMzksIDE2MSwgMTYyLCA0NDMsIDQ0NSwgNjM1LCA3NDksIDIwNDksIDMyNjAsIDQwNDUsIDQwNDYsXG4gICAgICAxMDAwMCwgMTExMDQsIDExMTA1LFxuICAgIF07XG4gICAgY29uc3QgdWRwTGlzdCA9IFsxMTEsIDEzNSwgMTM3LCAxMzksIDE2MSwgMTYyLCA2MzUsIDIwNDksIDQwNDUsIDQwNDYsIDQwNDldO1xuXG4gIC8vQWRkIGFsbHRyYWZpYyB0ZXN0aW5nXG4gICAgZmlsZVN5c3RlbVNnLmFkZEluZ3Jlc3NSdWxlKFBlZXIuaXB2NChgMC4wLjAuMC8wYCksIFBvcnQuYWxsVHJhZmZpYygpKTtcblxuICAgIGZpbGVTeXN0ZW1TZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIFBlZXIuaXB2NChwcm9wcy52cGMudnBjQ2lkckJsb2NrKSxcbiAgICAgIFBvcnQuaWNtcFBpbmcoKSxcbiAgICAgIFwiUGluZ2luZyB0aGUgaW5zdGFuY2VcIlxuICAgICk7XG4gICAgdGNwTGlzdC5tYXAoKHBvcnQpID0+IHtcbiAgICAgIGZpbGVTeXN0ZW1TZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgICAgUGVlci5pcHY0KHByb3BzLnZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgICBQb3J0LnRjcChwb3J0KVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIHVkcExpc3QubWFwKChwb3J0KSA9PiB7XG4gICAgICBmaWxlU3lzdGVtU2cuYWRkSW5ncmVzc1J1bGUoXG4gICAgICAgIFBlZXIuaXB2NChwcm9wcy52cGMudnBjQ2lkckJsb2NrKSxcbiAgICAgICAgUG9ydC51ZHAocG9ydClcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBmc3hBZG1pblNlY3JldCA9ICFwcm9wcy5mc3hBZG1pblBhc3N3b3JkXG4gICAgICA/IG5ldyBTZWNyZXQodGhpcywgXCJmc3hBZG1pblNlY3JldHNcIiwge1xuICAgICAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogXCJwYXNzd29yZFwiLFxuICAgICAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDMyLFxuICAgICAgICAgICAgcmVxdWlyZUVhY2hJbmNsdWRlZFR5cGU6IHRydWUsXG4gICAgICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogXCJmc3hhZG1pblwiIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICA6IG5ldyBTZWNyZXQodGhpcywgXCJmc3hBZG1pblNlY3JldHNcIiwge1xuICAgICAgICBzZWNyZXRPYmplY3RWYWx1ZToge1xuICAgICAgICAgIHVzZXJuYW1lOiBTZWNyZXRWYWx1ZS51bnNhZmVQbGFpblRleHQoXCJmc3hhZG1pblwiKSxcbiAgICAgICAgICBwYXNzd29yZDogU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KHByb3BzLmZzeEFkbWluUGFzc3dvcmQpLFxuICAgICAgICB9LFxuICAgICAgfSlcblxuICAgIHRoaXMuZnN4QWRtaW5TZWNyZXQgPSBmc3hBZG1pblNlY3JldDtcblxuICAgIGNvbnN0IGZpbGVTeXN0ZW0gPSBuZXcgQ2ZuRmlsZVN5c3RlbSh0aGlzLCBcIkZpbGVTeXN0ZW1cIiwge1xuICAgICAgZmlsZVN5c3RlbVR5cGU6IFwiT05UQVBcIixcbiAgICAgIHN1Ym5ldElkczogcHJpdmF0ZVN1Ym5ldHMsXG4gICAgICBzdG9yYWdlQ2FwYWNpdHk6IHByb3BzLnN0b3JhZ2VDYXBhY2l0eSxcbiAgICAgIHNlY3VyaXR5R3JvdXBJZHM6IFtmaWxlU3lzdGVtU2cuc2VjdXJpdHlHcm91cElkXSxcbiAgICAgIG9udGFwQ29uZmlndXJhdGlvbjoge1xuICAgICAgICBkZXBsb3ltZW50VHlwZTogcHJvcHMuZGVwbG95bWVudFR5cGUsXG4gICAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogcHJvcHMudGhyb3VnaHB1dENhcGFjaXR5LFxuICAgICAgICBmc3hBZG1pblBhc3N3b3JkOiBuZXcgY2RrLkNmbkR5bmFtaWNSZWZlcmVuY2UoXG4gICAgICAgICAgY2RrLkNmbkR5bmFtaWNSZWZlcmVuY2VTZXJ2aWNlLlNFQ1JFVFNfTUFOQUdFUixcbiAgICAgICAgICBgJHt0aGlzLmZzeEFkbWluU2VjcmV0LnNlY3JldEFybn06U2VjcmV0U3RyaW5nOnBhc3N3b3JkYFxuICAgICAgICApLnRvU3RyaW5nKCksXG4gICAgICAgIHByZWZlcnJlZFN1Ym5ldElkOiBwcml2YXRlU3VibmV0c1swXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTZXJ2aWNlIEFjY291bnTjga7jg5Hjgrnjg6/jg7zjg4noqK3lrprjgYznqbrjga7loLTlkIjjga/jgIFBZEFkbWlu44Gu44OR44K544Ov44O844OJ44KS6Kit5a6aXG4gICAgY29uc3Qgc2VydmljZUFjY291bnRTZWNyZXQgPSAhcHJvcHMuYWRDb25maWcuc2VydmljZUFjY291bnRQYXNzd29yZFxuICAgICAgPyBuZXcgU2VjcmV0KHRoaXMsIFwic2VydmljZUFjY291bnRTZWNyZXRcIiwge1xuICAgICAgICBzZWNyZXRPYmplY3RWYWx1ZToge1xuICAgICAgICAgIHVzZXJuYW1lOiBTZWNyZXRWYWx1ZS51bnNhZmVQbGFpblRleHQocHJvcHMuYWRDb25maWcuc2VydmljZUFjY291bnRVc2VyTmFtZSksXG4gICAgICAgICAgcGFzc3dvcmQ6IFNlY3JldFZhbHVlLnVuc2FmZVBsYWluVGV4dChuZXcgY2RrLkNmbkR5bmFtaWNSZWZlcmVuY2UoXG4gICAgICAgICAgICBjZGsuQ2ZuRHluYW1pY1JlZmVyZW5jZVNlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgICAgICAgYCR7cHJvcHMuYWRBZG1pblNlY3JldC5zZWNyZXRBcm59OlNlY3JldFN0cmluZzpwYXNzd29yZGApLnRvU3RyaW5nKClcbiAgICAgICAgICApLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICAgIDogbmV3IFNlY3JldCh0aGlzLCBcInNlcnZpY2VBY2NvdW50U2VjcmV0XCIsIHtcbiAgICAgICAgc2VjcmV0T2JqZWN0VmFsdWU6IHtcbiAgICAgICAgICB1c2VybmFtZTogU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KHByb3BzLmFkQ29uZmlnLnNlcnZpY2VBY2NvdW50VXNlck5hbWUpLFxuICAgICAgICAgIHBhc3N3b3JkOiBTZWNyZXRWYWx1ZS51bnNhZmVQbGFpblRleHQocHJvcHMuYWRDb25maWcuc2VydmljZUFjY291bnRQYXNzd29yZCksXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgIHRoaXMuc2VydmljZUFjY291bnRTZWNyZXQgPSBzZXJ2aWNlQWNjb3VudFNlY3JldFxuICAgIFxuICAgIGNvbnN0IHN2bSA9IG5ldyBDZm5TdG9yYWdlVmlydHVhbE1hY2hpbmUodGhpcywgXCJTVk1cIiwge1xuICAgICAgZmlsZVN5c3RlbUlkOiBmaWxlU3lzdGVtLnJlZixcbiAgICAgIG5hbWU6IHByb3BzLmFkQ29uZmlnLnN2bU5ldEJpb3NOYW1lLFxuICAgICAgc3ZtQWRtaW5QYXNzd29yZDogbmV3IGNkay5DZm5EeW5hbWljUmVmZXJlbmNlKFxuICAgICAgICBjZGsuQ2ZuRHluYW1pY1JlZmVyZW5jZVNlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgICBgJHt0aGlzLmZzeEFkbWluU2VjcmV0LnNlY3JldEFybn06U2VjcmV0U3RyaW5nOnBhc3N3b3JkYFxuICAgICAgKS50b1N0cmluZygpLFxuICAgICAgYWN0aXZlRGlyZWN0b3J5Q29uZmlndXJhdGlvbjoge1xuICAgICAgICBuZXRCaW9zTmFtZTogcHJvcHMuYWRDb25maWcuc3ZtTmV0Qmlvc05hbWUsXG4gICAgICAgIHNlbGZNYW5hZ2VkQWN0aXZlRGlyZWN0b3J5Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgIGRuc0lwczogcHJvcHMuYWREbnNJcHMsXG4gICAgICAgICAgZG9tYWluTmFtZTogcHJvcHMuYWRDb25maWcuYWREb21haW5OYW1lLFxuICAgICAgICAgIHVzZXJOYW1lOiBwcm9wcy5hZENvbmZpZy5zZXJ2aWNlQWNjb3VudFVzZXJOYW1lLFxuICAgICAgICAgIHBhc3N3b3JkOiBuZXcgY2RrLkNmbkR5bmFtaWNSZWZlcmVuY2UoXG4gICAgICAgICAgICBjZGsuQ2ZuRHluYW1pY1JlZmVyZW5jZVNlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgICAgICAgYCR7c2VydmljZUFjY291bnRTZWNyZXQuc2VjcmV0QXJufTpTZWNyZXRTdHJpbmc6cGFzc3dvcmRgXG4gICAgICAgICAgKS50b1N0cmluZygpLFxuICAgICAgICAgIG9yZ2FuaXphdGlvbmFsVW5pdERpc3Rpbmd1aXNoZWROYW1lOiBwcm9wcy5hZENvbmZpZy5hZE91LFxuICAgICAgICAgIGZpbGVTeXN0ZW1BZG1pbmlzdHJhdG9yc0dyb3VwOiBwcm9wcy5hZENvbmZpZy5maWxlU3lzdGVtQWRtaW5pc3RyYXRvcnNHcm91cFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuc3ZtID0gc3ZtO1xuXG4gICAgdGhpcy5jaWZzVm9sID0gbmV3IENmblZvbHVtZSh0aGlzLCBcIkJlZHJvY2tSYWdcIiwge1xuICAgICAgbmFtZTogXCJiZWRyb2NrcmFnXCIsXG4gICAgICBvbnRhcENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgc3RvcmFnZVZpcnR1YWxNYWNoaW5lSWQ6IHN2bS5yZWYsXG4gICAgICAgIGp1bmN0aW9uUGF0aDogXCIvYmVkcm9ja3JhZ1wiLFxuICAgICAgICBzaXplSW5NZWdhYnl0ZXM6IFwiMTAyNFwiLFxuICAgICAgICBzdG9yYWdlRWZmaWNpZW5jeUVuYWJsZWQ6IFwidHJ1ZVwiLFxuICAgICAgICBzZWN1cml0eVN0eWxlOiBcIk1JWEVEXCIsXG4gICAgICB9LFxuICAgICAgdm9sdW1lVHlwZTogXCJPTlRBUFwiLFxuICAgIH0pO1xuXG4gICAgdGhpcy5yYWdkYlZvbCA9IG5ldyBDZm5Wb2x1bWUodGhpcywgXCJSYWdEQlwiLCB7XG4gICAgICBuYW1lOiBcInJhZ2RiXCIsXG4gICAgICBvbnRhcENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgc3RvcmFnZVZpcnR1YWxNYWNoaW5lSWQ6IHN2bS5yZWYsXG4gICAgICAgIGp1bmN0aW9uUGF0aDogXCIvcmFnZGJcIixcbiAgICAgICAgc2l6ZUluTWVnYWJ5dGVzOiBcIjEwMjRcIixcbiAgICAgICAgc3RvcmFnZUVmZmljaWVuY3lFbmFibGVkOiBcInRydWVcIixcbiAgICAgICAgc2VjdXJpdHlTdHlsZTogXCJVTklYXCIsXG4gICAgICB9LFxuICAgICAgdm9sdW1lVHlwZTogXCJPTlRBUFwiLFxuICAgIH0pO1xuXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKFxuICAgICAgW2ZpbGVTeXN0ZW1TZywgZnN4QWRtaW5TZWNyZXQsc2VydmljZUFjY291bnRTZWNyZXRdLFxuICAgICAgW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLVNNRzRcIixcbiAgICAgICAgICByZWFzb246IFwiTmVlZCBmb3IgRlN4TiBPTlRBUCBtb3VudFwiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLUVDMjNcIixcbiAgICAgICAgICByZWFzb246IFwiTmVlZCBmb3IgRlN4TiBPTlRBUCBtb3VudFwiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLVNNRzRcIixcbiAgICAgICAgICByZWFzb246IFwiTm8gbmVlZCByb3RhdGlvbiBmb3IgUG9DXCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgdHJ1ZVxuICAgICk7XG4gIH1cbn1cbiJdfQ==