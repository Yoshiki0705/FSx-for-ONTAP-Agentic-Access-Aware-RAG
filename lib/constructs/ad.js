"use strict";
/**
 * Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
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
exports.Ad = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const aws_ec2_1 = require("aws-cdk-lib/aws-ec2");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_ssm_1 = require("aws-cdk-lib/aws-ssm");
const aws_directoryservice_1 = require("aws-cdk-lib/aws-directoryservice");
const aws_secretsmanager_1 = require("aws-cdk-lib/aws-secretsmanager");
const cdk_nag_1 = require("cdk-nag");
const aws_cdk_lib_1 = require("aws-cdk-lib");
class Ad extends constructs_1.Construct {
    microsoftAd;
    adAdminSecret;
    constructor(scope, id, props) {
        super(scope, id);
        const adAdminSecret = !props.adConfig.adAdminPassword
            ? new aws_secretsmanager_1.Secret(this, "AdSecrets", {
                generateSecretString: {
                    generateStringKey: "password",
                    passwordLength: 32,
                    requireEachIncludedType: true,
                    secretStringTemplate: JSON.stringify({ username: "Admin" }),
                },
            })
            : new aws_secretsmanager_1.Secret(this, "AdSecrets", {
                secretObjectValue: {
                    username: aws_cdk_lib_1.SecretValue.unsafePlainText("Admin"),
                    password: aws_cdk_lib_1.SecretValue.unsafePlainText(props.adConfig.adAdminPassword),
                },
            });
        this.adAdminSecret = adAdminSecret;
        if (!props.adConfig.existingAd) {
            // プライベートサブネットを取得（既存VPCの場合は設定から取得）
            let subnetIds;
            if (props.subnetIds && props.subnetIds.length > 0) {
                // 設定ファイルからサブネットIDを使用
                subnetIds = props.subnetIds.slice(0, 2);
            }
            else {
                // フォールバック: 利用可能なサブネットを使用
                subnetIds = ["subnet-036b9749b4c3f853b", "subnet-0e5e797d675b0b7cb"];
            }
            const ad = new aws_directoryservice_1.CfnMicrosoftAD(this, "MicrosoftAd", {
                name: props.adConfig.adDomainName,
                password: new cdk.CfnDynamicReference(cdk.CfnDynamicReferenceService.SECRETS_MANAGER, `${adAdminSecret.secretArn}:SecretString:password`).toString(),
                edition: "Standard",
                vpcSettings: {
                    vpcId: props.vpc.vpcId,
                    subnetIds: subnetIds,
                },
            });
            this.microsoftAd = ad;
            const sg = new aws_ec2_1.SecurityGroup(this, "SgForInstance", {
                vpc: props.vpc,
            });
            // セキュリティグループルールを設定（既存VPCのCIDRを使用）
            sg.addIngressRule(aws_ec2_1.Peer.ipv4("10.12.0.0/16"), aws_ec2_1.Port.tcp(389));
            sg.addIngressRule(aws_ec2_1.Peer.ipv4("10.12.0.0/16"), aws_ec2_1.Port.tcp(3389));
            sg.addIngressRule(aws_ec2_1.Peer.ipv4("10.12.0.0/16"), aws_ec2_1.Port.allTraffic());
            // For fleet Manager
            const instanceRole = new aws_iam_1.Role(this, "InstanceRole", {
                assumedBy: new aws_iam_1.ServicePrincipal("ec2.amazonaws.com"),
            });
            instanceRole.addToPrincipalPolicy(new aws_iam_1.PolicyStatement({
                effect: cdk.aws_iam.Effect.ALLOW,
                actions: [
                    "ssm:UpdateInstanceInformation",
                    "ssmmessages:CreateControlChannel",
                    "ssmmessages:CreateDataChannel",
                    "ssmmessages:OpenControlChannel",
                    "ssmmessages:OpenDataChannel",
                    "ec2messages:AcknowledgeMessage",
                    "ec2messages:DeleteMessage",
                    "ec2messages:FailMessage",
                    "ec2messages:GetEndpoint",
                    "ec2messages:GetMessages",
                    "ec2messages:SendReply",
                ],
                resources: ["*"],
            }));
            instanceRole.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMDirectoryServiceAccess"));
            instanceRole.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));
            const key = new aws_ec2_1.KeyPair(this, "KeyForInstance", {});
            key.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
            // 利用可能なサブネットタイプ（PRIVATE_ISOLATED）を使用
            const adHost = new aws_ec2_1.Instance(this, "HostInstance", {
                vpc: props.vpc,
                vpcSubnets: {
                    subnetType: aws_ec2_1.SubnetType.PRIVATE_ISOLATED,
                },
                securityGroup: sg,
                instanceType: aws_ec2_1.InstanceType.of(aws_ec2_1.InstanceClass.T3, aws_ec2_1.InstanceSize.MEDIUM),
                machineImage: aws_ec2_1.MachineImage.latestWindows(aws_ec2_1.WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE),
                keyPair: key,
                role: instanceRole,
                blockDevices: [
                    {
                        deviceName: "/dev/sda1",
                        volume: aws_ec2_1.BlockDeviceVolume.ebs(100, {
                            encrypted: true,
                        }),
                    },
                ],
            });
            // 終了保護を有効化
            const cfnInstance = adHost.node.defaultChild;
            cfnInstance.disableApiTermination = true;
            // SSM Association for domain join
            new aws_ssm_1.CfnAssociation(this, "DomainJoinAssociation", {
                name: "AWS-JoinDirectoryServiceDomain",
                targets: [
                    {
                        key: "InstanceIds",
                        values: [adHost.instanceId],
                    },
                ],
                parameters: {
                    directoryId: [ad.ref],
                    directoryName: [props.adConfig.adDomainName],
                    dnsIpAddresses: ad.attrDnsIpAddresses,
                },
            });
            // Nag suppressions - すべての警告を抑制
            cdk_nag_1.NagSuppressions.addResourceSuppressions(instanceRole, [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "For using AmazonSSMDirectoryServiceAccess",
                },
                {
                    id: "AwsSolutions-IAM5",
                    reason: "[Resource::*] Use this role for only fleet manager access",
                    appliesTo: [
                        "Resource::*",
                        "Action::ssm:*",
                        "Action::ssmmessages:*",
                        "Action::ec2messages:*"
                    ],
                },
            ]);
            cdk_nag_1.NagSuppressions.addResourceSuppressions(adHost, [
                {
                    id: "AwsSolutions-EC28",
                    reason: "For embedding job not accessing to the instance from user",
                },
                {
                    id: "AwsSolutions-EC29",
                    reason: "For embedding job not accessing to the instance from user",
                },
            ]);
            cdk_nag_1.NagSuppressions.addResourceSuppressions(adAdminSecret, [
                {
                    id: "AwsSolutions-SMG4",
                    reason: "No need rotation for PoC",
                },
            ]);
        }
    }
}
exports.Ad = Ad;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQ0FBdUM7QUFDdkMsaURBQW1DO0FBQ25DLGlEQWdCNkI7QUFDN0IsaURBSzZCO0FBQzdCLGlEQUFxRDtBQUNyRCwyRUFBa0U7QUFDbEUsdUVBQXdEO0FBQ3hELHFDQUEwQztBQUUxQyw2Q0FBMEM7QUFpQjFDLE1BQWEsRUFBRyxTQUFRLHNCQUFTO0lBQ2YsV0FBVyxDQUFrQjtJQUM3QixhQUFhLENBQVM7SUFFdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFjO1FBQ3RELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxhQUFhLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGVBQWU7WUFDbkQsQ0FBQyxDQUFDLElBQUksMkJBQU0sQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO2dCQUM1QixvQkFBb0IsRUFBRTtvQkFDcEIsaUJBQWlCLEVBQUUsVUFBVTtvQkFDN0IsY0FBYyxFQUFFLEVBQUU7b0JBQ2xCLHVCQUF1QixFQUFFLElBQUk7b0JBQzdCLG9CQUFvQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLENBQUM7aUJBQzVEO2FBQ0YsQ0FBQztZQUNKLENBQUMsQ0FBQyxJQUFJLDJCQUFNLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtnQkFDNUIsaUJBQWlCLEVBQUU7b0JBQ2pCLFFBQVEsRUFBRSx5QkFBVyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUM7b0JBQzlDLFFBQVEsRUFBRSx5QkFBVyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQztpQkFDdEU7YUFDRixDQUFDLENBQUM7UUFFUCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FB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QVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUM7b0JBQ3JCLGFBQWEsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO29CQUM1QyxjQUFjLEVBQUUsRUFBRSxDQUFDLGtCQUFrQjtpQkFDdEM7YUFDRixDQUFDLENBQUM7WUFFSCwrQkFBK0I7WUFDL0IseUJBQWUsQ0FBQyx1QkFBdUIsQ0FDckMsWUFBWSxFQUNaO2dCQUNFO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLE1BQU0sRUFBRSwyQ0FBMkM7aUJBQ3BEO2dCQUNEO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLE1BQU0sRUFBRSwyREFBMkQ7b0JBQ25FLFNBQVMsRUFBRTt3QkFDVCxhQUFhO3dCQUNiLGVBQWU7d0JBQ2YsdUJBQXVCO3dCQUN2Qix1QkFBdUI7cUJBQ3hCO2lCQUNGO2FBQ0YsQ0FDRixDQUFDO1lBRUYseUJBQWUsQ0FBQyx1QkFBdUIsQ0FDckMsTUFBTSxFQUNOO2dCQUNFO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLE1BQU0sRUFBRSwyREFBMkQ7aUJBQ3BFO2dCQUNEO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLE1BQU0sRUFBRSwyREFBMkQ7aUJBQ3BFO2FBQ0YsQ0FDRixDQUFDO1lBRUYseUJBQWUsQ0FBQyx1QkFBdUIsQ0FDckMsYUFBYSxFQUNiO2dCQUNFO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLE1BQU0sRUFBRSwwQkFBMEI7aUJBQ25DO2FBQ0YsQ0FDRixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7Q0FDRjtBQXpMRCxnQkF5TEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvcHlyaWdodCAyMDI1IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTGljZW5zZVJlZi0uYW1hem9uLmNvbS4tQW16blNMLTEuMFxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFtYXpvbiBTb2Z0d2FyZSBMaWNlbnNlICBodHRwOi8vYXdzLmFtYXpvbi5jb20vYXNsL1xuICovXG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQge1xuICBCbG9ja0RldmljZVZvbHVtZSxcbiAgSW5zdGFuY2UsXG4gIEluc3RhbmNlQ2xhc3MsXG4gIEluc3RhbmNlU2l6ZSxcbiAgSW5zdGFuY2VUeXBlLFxuICBJU3VibmV0LFxuICBJVnBjLFxuICBLZXlQYWlyLFxuICBNYWNoaW5lSW1hZ2UsXG4gIFBlZXIsXG4gIFBvcnQsXG4gIFNlY3VyaXR5R3JvdXAsXG4gIFZwYyxcbiAgV2luZG93c1ZlcnNpb24sXG4gIFN1Ym5ldFR5cGUsXG59IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWMyXCI7XG5pbXBvcnQge1xuICBNYW5hZ2VkUG9saWN5LFxuICBQb2xpY3lTdGF0ZW1lbnQsXG4gIFJvbGUsXG4gIFNlcnZpY2VQcmluY2lwYWwsXG59IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XG5pbXBvcnQgeyBDZm5Bc3NvY2lhdGlvbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc3NtXCI7XG5pbXBvcnQgeyBDZm5NaWNyb3NvZnRBRCB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZGlyZWN0b3J5c2VydmljZVwiO1xuaW1wb3J0IHsgU2VjcmV0IH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlclwiO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSBcImNkay1uYWdcIjtcbmltcG9ydCB7IEZzeENvbmZpZyB9IGZyb20gXCIuLi8uLi90eXBlcy90eXBlXCI7XG5pbXBvcnQgeyBTZWNyZXRWYWx1ZSB9IGZyb20gJ2F3cy1jZGstbGliJztcblxuaW50ZXJmYWNlIEFkUHJvcHMge1xuICB2cGM6IFZwYyB8IElWcGM7XG4gIGFkQ29uZmlnPzoge1xuICAgIGV4aXN0aW5nQWQ6IGJvb2xlYW47XG4gICAgc3ZtTmV0Qmlvc05hbWU6IHN0cmluZztcbiAgICBhZERuc0lwcz86IHN0cmluZ1tdO1xuICAgIGFkRG9tYWluTmFtZTogc3RyaW5nO1xuICAgIGFkQWRtaW5QYXNzd29yZDogc3RyaW5nO1xuICAgIHNlcnZpY2VBY2NvdW50VXNlck5hbWU6IHN0cmluZztcbiAgICBzZXJ2aWNlQWNjb3VudFBhc3N3b3JkOiBzdHJpbmc7XG4gICAgYWRPdTogc3RyaW5nO1xuICAgIGZpbGVTeXN0ZW1BZG1pbmlzdHJhdG9yc0dyb3VwOiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBBZCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBtaWNyb3NvZnRBZD86IENmbk1pY3Jvc29mdEFEO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRBZG1pblNlY3JldDogU2VjcmV0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBZFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IGFkQWRtaW5TZWNyZXQgPSAhcHJvcHMuYWRDb25maWcuYWRBZG1pblBhc3N3b3JkXG4gICAgICA/IG5ldyBTZWNyZXQodGhpcywgXCJBZFNlY3JldHNcIiwge1xuICAgICAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogXCJwYXNzd29yZFwiLFxuICAgICAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDMyLFxuICAgICAgICAgICAgcmVxdWlyZUVhY2hJbmNsdWRlZFR5cGU6IHRydWUsXG4gICAgICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogXCJBZG1pblwiIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICA6IG5ldyBTZWNyZXQodGhpcywgXCJBZFNlY3JldHNcIiwge1xuICAgICAgICAgIHNlY3JldE9iamVjdFZhbHVlOiB7XG4gICAgICAgICAgICB1c2VybmFtZTogU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KFwiQWRtaW5cIiksXG4gICAgICAgICAgICBwYXNzd29yZDogU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KHByb3BzLmFkQ29uZmlnLmFkQWRtaW5QYXNzd29yZCksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICB0aGlzLmFkQWRtaW5TZWNyZXQgPSBhZEFkbWluU2VjcmV0O1xuXG4gICAgaWYgKCFwcm9wcy5hZENvbmZpZy5leGlzdGluZ0FkKSB7XG4gICAgICAvLyDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4jjgpLlj5blvpfvvIjml6LlrZhWUEPjga7loLTlkIjjga/oqK3lrprjgYvjgonlj5blvpfvvIlcbiAgICAgIGxldCBzdWJuZXRJZHM6IHN0cmluZ1tdO1xuICAgICAgXG4gICAgICBpZiAocHJvcHMuc3VibmV0SWRzICYmIHByb3BzLnN1Ym5ldElkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIOioreWumuODleOCoeOCpOODq+OBi+OCieOCteODluODjeODg+ODiElE44KS5L2/55SoXG4gICAgICAgIHN1Ym5ldElkcyA9IHByb3BzLnN1Ym5ldElkcy5zbGljZSgwLCAyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIOODleOCqeODvOODq+ODkOODg+OCrzog5Yip55So5Y+v6IO944Gq44K144OW44ON44OD44OI44KS5L2/55SoXG4gICAgICAgIHN1Ym5ldElkcyA9IFtcInN1Ym5ldC0wMzZiOTc0OWI0YzNmODUzYlwiLCBcInN1Ym5ldC0wZTVlNzk3ZDY3NWIwYjdjYlwiXTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWQgPSBuZXcgQ2ZuTWljcm9zb2Z0QUQodGhpcywgXCJNaWNyb3NvZnRBZFwiLCB7XG4gICAgICAgIG5hbWU6IHByb3BzLmFkQ29uZmlnLmFkRG9tYWluTmFtZSxcbiAgICAgICAgcGFzc3dvcmQ6IG5ldyBjZGsuQ2ZuRHluYW1pY1JlZmVyZW5jZShcbiAgICAgICAgICBjZGsuQ2ZuRHluYW1pY1JlZmVyZW5jZVNlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgICAgIGAke2FkQWRtaW5TZWNyZXQuc2VjcmV0QXJufTpTZWNyZXRTdHJpbmc6cGFzc3dvcmRgXG4gICAgICAgICkudG9TdHJpbmcoKSxcbiAgICAgICAgZWRpdGlvbjogXCJTdGFuZGFyZFwiLFxuICAgICAgICB2cGNTZXR0aW5nczoge1xuICAgICAgICAgIHZwY0lkOiBwcm9wcy52cGMudnBjSWQsXG4gICAgICAgICAgc3VibmV0SWRzOiBzdWJuZXRJZHMsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5taWNyb3NvZnRBZCA9IGFkO1xuXG4gICAgICBjb25zdCBzZyA9IG5ldyBTZWN1cml0eUdyb3VwKHRoaXMsIFwiU2dGb3JJbnN0YW5jZVwiLCB7XG4gICAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+ODq+ODvOODq+OCkuioreWumu+8iOaXouWtmFZQQ+OBrkNJRFLjgpLkvb/nlKjvvIlcbiAgICAgIHNnLmFkZEluZ3Jlc3NSdWxlKFBlZXIuaXB2NChcIjEwLjEyLjAuMC8xNlwiKSwgUG9ydC50Y3AoMzg5KSk7XG4gICAgICBzZy5hZGRJbmdyZXNzUnVsZShQZWVyLmlwdjQoXCIxMC4xMi4wLjAvMTZcIiksIFBvcnQudGNwKDMzODkpKTtcbiAgICAgIHNnLmFkZEluZ3Jlc3NSdWxlKFBlZXIuaXB2NChcIjEwLjEyLjAuMC8xNlwiKSwgUG9ydC5hbGxUcmFmZmljKCkpO1xuXG4gICAgICAvLyBGb3IgZmxlZXQgTWFuYWdlclxuICAgICAgY29uc3QgaW5zdGFuY2VSb2xlID0gbmV3IFJvbGUodGhpcywgXCJJbnN0YW5jZVJvbGVcIiwge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKFwiZWMyLmFtYXpvbmF3cy5jb21cIiksXG4gICAgICB9KTtcblxuICAgICAgaW5zdGFuY2VSb2xlLmFkZFRvUHJpbmNpcGFsUG9saWN5KFxuICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGNkay5hd3NfaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBcInNzbTpVcGRhdGVJbnN0YW5jZUluZm9ybWF0aW9uXCIsXG4gICAgICAgICAgICBcInNzbW1lc3NhZ2VzOkNyZWF0ZUNvbnRyb2xDaGFubmVsXCIsXG4gICAgICAgICAgICBcInNzbW1lc3NhZ2VzOkNyZWF0ZURhdGFDaGFubmVsXCIsXG4gICAgICAgICAgICBcInNzbW1lc3NhZ2VzOk9wZW5Db250cm9sQ2hhbm5lbFwiLFxuICAgICAgICAgICAgXCJzc21tZXNzYWdlczpPcGVuRGF0YUNoYW5uZWxcIixcbiAgICAgICAgICAgIFwiZWMybWVzc2FnZXM6QWNrbm93bGVkZ2VNZXNzYWdlXCIsXG4gICAgICAgICAgICBcImVjMm1lc3NhZ2VzOkRlbGV0ZU1lc3NhZ2VcIixcbiAgICAgICAgICAgIFwiZWMybWVzc2FnZXM6RmFpbE1lc3NhZ2VcIixcbiAgICAgICAgICAgIFwiZWMybWVzc2FnZXM6R2V0RW5kcG9pbnRcIixcbiAgICAgICAgICAgIFwiZWMybWVzc2FnZXM6R2V0TWVzc2FnZXNcIixcbiAgICAgICAgICAgIFwiZWMybWVzc2FnZXM6U2VuZFJlcGx5XCIsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgICBpbnN0YW5jZVJvbGUuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJBbWF6b25TU01EaXJlY3RvcnlTZXJ2aWNlQWNjZXNzXCIpXG4gICAgICApO1xuICAgICAgaW5zdGFuY2VSb2xlLmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICAgIE1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwiQW1hem9uU1NNTWFuYWdlZEluc3RhbmNlQ29yZVwiKVxuICAgICAgKTtcblxuICAgICAgY29uc3Qga2V5ID0gbmV3IEtleVBhaXIodGhpcywgXCJLZXlGb3JJbnN0YW5jZVwiLCB7fSk7XG4gICAgICBrZXkuYXBwbHlSZW1vdmFsUG9saWN5KGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1kpO1xuXG4gICAgICAvLyDliKnnlKjlj6/og73jgarjgrXjg5bjg43jg4Pjg4jjgr/jgqTjg5fvvIhQUklWQVRFX0lTT0xBVEVE77yJ44KS5L2/55SoXG4gICAgICBjb25zdCBhZEhvc3QgPSBuZXcgSW5zdGFuY2UodGhpcywgXCJIb3N0SW5zdGFuY2VcIiwge1xuICAgICAgICB2cGM6IHByb3BzLnZwYyxcbiAgICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICAgIHN1Ym5ldFR5cGU6IFN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgICAgfSxcbiAgICAgICAgc2VjdXJpdHlHcm91cDogc2csXG4gICAgICAgIGluc3RhbmNlVHlwZTogSW5zdGFuY2VUeXBlLm9mKEluc3RhbmNlQ2xhc3MuVDMsIEluc3RhbmNlU2l6ZS5NRURJVU0pLFxuICAgICAgICBtYWNoaW5lSW1hZ2U6IE1hY2hpbmVJbWFnZS5sYXRlc3RXaW5kb3dzKFxuICAgICAgICAgIFdpbmRvd3NWZXJzaW9uLldJTkRPV1NfU0VSVkVSXzIwMTlfRU5HTElTSF9GVUxMX0JBU0VcbiAgICAgICAgKSxcbiAgICAgICAga2V5UGFpcjoga2V5LFxuICAgICAgICByb2xlOiBpbnN0YW5jZVJvbGUsXG4gICAgICAgIGJsb2NrRGV2aWNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGRldmljZU5hbWU6IFwiL2Rldi9zZGExXCIsXG4gICAgICAgICAgICB2b2x1bWU6IEJsb2NrRGV2aWNlVm9sdW1lLmVicygxMDAsIHtcbiAgICAgICAgICAgICAgZW5jcnlwdGVkOiB0cnVlLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDntYLkuobkv53orbfjgpLmnInlirnljJZcbiAgICAgIGNvbnN0IGNmbkluc3RhbmNlID0gYWRIb3N0Lm5vZGUuZGVmYXVsdENoaWxkIGFzIGNkay5hd3NfZWMyLkNmbkluc3RhbmNlO1xuICAgICAgY2ZuSW5zdGFuY2UuZGlzYWJsZUFwaVRlcm1pbmF0aW9uID0gdHJ1ZTtcblxuICAgICAgLy8gU1NNIEFzc29jaWF0aW9uIGZvciBkb21haW4gam9pblxuICAgICAgbmV3IENmbkFzc29jaWF0aW9uKHRoaXMsIFwiRG9tYWluSm9pbkFzc29jaWF0aW9uXCIsIHtcbiAgICAgICAgbmFtZTogXCJBV1MtSm9pbkRpcmVjdG9yeVNlcnZpY2VEb21haW5cIixcbiAgICAgICAgdGFyZ2V0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGtleTogXCJJbnN0YW5jZUlkc1wiLFxuICAgICAgICAgICAgdmFsdWVzOiBbYWRIb3N0Lmluc3RhbmNlSWRdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBkaXJlY3RvcnlJZDogW2FkLnJlZl0sXG4gICAgICAgICAgZGlyZWN0b3J5TmFtZTogW3Byb3BzLmFkQ29uZmlnLmFkRG9tYWluTmFtZV0sXG4gICAgICAgICAgZG5zSXBBZGRyZXNzZXM6IGFkLmF0dHJEbnNJcEFkZHJlc3NlcyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBOYWcgc3VwcHJlc3Npb25zIC0g44GZ44G544Gm44Gu6K2m5ZGK44KS5oqR5Yi2XG4gICAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoXG4gICAgICAgIGluc3RhbmNlUm9sZSxcbiAgICAgICAgW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1JQU00XCIsXG4gICAgICAgICAgICByZWFzb246IFwiRm9yIHVzaW5nIEFtYXpvblNTTURpcmVjdG9yeVNlcnZpY2VBY2Nlc3NcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1JQU01XCIsXG4gICAgICAgICAgICByZWFzb246IFwiW1Jlc291cmNlOjoqXSBVc2UgdGhpcyByb2xlIGZvciBvbmx5IGZsZWV0IG1hbmFnZXIgYWNjZXNzXCIsXG4gICAgICAgICAgICBhcHBsaWVzVG86IFtcbiAgICAgICAgICAgICAgXCJSZXNvdXJjZTo6KlwiLFxuICAgICAgICAgICAgICBcIkFjdGlvbjo6c3NtOipcIixcbiAgICAgICAgICAgICAgXCJBY3Rpb246OnNzbW1lc3NhZ2VzOipcIixcbiAgICAgICAgICAgICAgXCJBY3Rpb246OmVjMm1lc3NhZ2VzOipcIlxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdXG4gICAgICApO1xuXG4gICAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoXG4gICAgICAgIGFkSG9zdCxcbiAgICAgICAgW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1FQzI4XCIsXG4gICAgICAgICAgICByZWFzb246IFwiRm9yIGVtYmVkZGluZyBqb2Igbm90IGFjY2Vzc2luZyB0byB0aGUgaW5zdGFuY2UgZnJvbSB1c2VyXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtRUMyOVwiLFxuICAgICAgICAgICAgcmVhc29uOiBcIkZvciBlbWJlZGRpbmcgam9iIG5vdCBhY2Nlc3NpbmcgdG8gdGhlIGluc3RhbmNlIGZyb20gdXNlclwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIF1cbiAgICAgICk7XG5cbiAgICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhcbiAgICAgICAgYWRBZG1pblNlY3JldCxcbiAgICAgICAgW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1TTUc0XCIsXG4gICAgICAgICAgICByZWFzb246IFwiTm8gbmVlZCByb3RhdGlvbiBmb3IgUG9DXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==