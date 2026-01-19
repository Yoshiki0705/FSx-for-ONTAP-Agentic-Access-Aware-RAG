"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
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
exports.EmbeddingServer = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const aws_ec2_1 = require("aws-cdk-lib/aws-ec2");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_opensearchserverless_1 = require("aws-cdk-lib/aws-opensearchserverless");
const repository_1 = require("./repository");
const cdk_nag_1 = require("cdk-nag");
class EmbeddingServer extends constructs_1.Construct {
    microsoftAd;
    instance;
    constructor(scope, id, props) {
        super(scope, id);
        const fsxId = process.env.FSX_ID || props.svm?.fileSystemId || "fs-07b5a0bc2a1c342f4";
        // svmrefとsvmidは一緒
        const svmRef = process.env.SVM_REF || props.svm?.ref || "svm-default";
        const svmId = process.env.SVM_ID || props.svm?.attrStorageVirtualMachineId || "svm-default-id";
        // config.tsの設定を優先し、環境変数、既存ボリューム名の順で使用
        const cifsdataVolName = props.embeddingConfig?.cifsdataVolName || process.env.CIFSDATA_VOL_NAME || props.cifsVol?.name || "smb_share";
        // ragdbもconfig.tsの設定を優先し、smb_share配下に配置
        const ragdbVolpath = props.embeddingConfig?.ragdbVolPath || process.env.RAGDB_VOL_PATH || "/smb_share/ragdb";
        const embeddingRepository = new repository_1.ECR(this, "Ecr", {
            path: `${props.imagePath}/embed`,
            tag: props.tag,
        });
        const sg = new aws_ec2_1.SecurityGroup(this, "Sg", {
            vpc: props.vpcConfig.vpc,
        });
        props.vpcConfig.vpc.privateSubnets.map((value) => {
            sg.addIngressRule(aws_ec2_1.Peer.ipv4(`${value.ipv4CidrBlock}`), aws_ec2_1.Port.tcp(389));
        });
        props.vpcConfig.vpc.privateSubnets.map((value) => {
            sg.addIngressRule(aws_ec2_1.Peer.ipv4(`10.0.0.0/8`), aws_ec2_1.Port.allTraffic());
        });
        const instanceRole = props.role;
        if (props.vector instanceof cdk.aws_rds.DatabaseCluster) {
            props.vector.connections.allowFrom(sg, aws_ec2_1.Port.tcp(props.vector.clusterEndpoint.port));
            props.vector.grantDataApiAccess(instanceRole);
            props.vector.secret.grantRead(instanceRole);
        }
        // For fleet  Manager
        instanceRole.addToPrincipalPolicy(new aws_iam_1.PolicyStatement({
            actions: [
                "ssm:DescribeAssociation",
                "ssm:GetDeployablePatchSnapshotForInstance",
                "ssm:GetDocument",
                "ssm:DescribeDocument",
                "ssm:GetManifest",
                "ssm:GetParameter",
                "ssm:GetParameters",
                "ssm:ListAssociations",
                "ssm:ListInstanceAssociations",
                "ssm:PutInventory",
                "ssm:PutComplianceItems",
                "ssm:PutConfigurePackageResult",
                "ssm:UpdateAssociationStatus",
                "ssm:UpdateInstanceAssociationStatus",
                "ssm:UpdateInstanceInformation",
            ],
            resources: ["*"],
        }));
        instanceRole.addToPrincipalPolicy(new aws_iam_1.PolicyStatement({
            actions: [
                "ssmmessages:CreateControlChannel",
                "ssmmessages:CreateDataChannel",
                "ssmmessages:OpenControlChannel",
                "ssmmessages:OpenDataChannel",
            ],
            resources: ["*"],
        }));
        instanceRole.addToPrincipalPolicy(new aws_iam_1.PolicyStatement({
            actions: [
                "ec2messages:AcknowledgeMessage",
                "ec2messages:DeleteMessage",
                "ec2messages:FailMessage",
                "ec2messages:GetEndpoint",
                "ec2messages:GetMessages",
                "ec2messages:SendReply",
            ],
            resources: ["*"],
        }));
        instanceRole.addToPrincipalPolicy(new aws_iam_1.PolicyStatement({
            actions: [
                "fsx:DescribeStorageVirtualMachines",
                "fsx:DescribeFileSystems",
            ],
            resources: ["*"],
        }));
        instanceRole.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMDirectoryServiceAccess"));
        if (props.vector instanceof aws_opensearchserverless_1.CfnCollection) {
            instanceRole.addToPolicy(new aws_iam_1.PolicyStatement({
                effect: aws_iam_1.Effect.ALLOW,
                actions: [
                    "aoss:APIAccessAll",
                    "aoss:CreateAccessPolicy",
                    "aoss:CreateSecurityPolicy",
                    "aoss:CreateCollection",
                ],
                resources: [props.vector.attrArn],
            }));
        }
        instanceRole.addToPolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: ["bedrock:GetFoundationModel", "bedrock:InvokeModel"],
            resources: [
                cdk.Stack.of(this).region === "us-east-1"
                    ? `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`
                    : `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`,
                "arn:aws:bedrock:us-east-1::foundation-model/*",
            ],
        }));
        instanceRole.addToPolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"],
            resources: [embeddingRepository.repository.repositoryArn],
        }));
        instanceRole.addToPolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: [
                "aoss:ListCollections",
                "aoss:BatchGetCollection",
                "ecr:GetAuthorizationToken",
                "sts:GetCallerIdentity",
            ],
            resources: ["*"],
        }));
        instanceRole.addToPolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: ["secretsmanager:GetSecretValue"],
            resources: [props.adSecret.secretArn],
        }));
        const key = new aws_ec2_1.KeyPair(this, "Key");
        key.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
        const userData = aws_ec2_1.UserData.forLinux({ shebang: "#!/bin/sh" });
        userData.addCommands("set -ex", "sudo yum update -y", "sudo yum install -y cifs-utils python3-pip jq", "sudo amazon-linux-extras install docker -y", "sudo service docker start", "sudo usermod -a -G docker ec2-user", "sudo mkdir /tmp/data", "sudo mkdir /tmp/db", "pip3 install boto3", `echo 'import boto3
import json

def get_secret():
    secretsmanager = boto3.client("secretsmanager", region_name="${cdk.Stack.of(this).region}")
    response = secretsmanager.get_secret_value(SecretId="${props.adSecret.secretArn}")
    secret = json.loads(response["SecretString"])
    return secret["password"]

print(get_secret())' > /tmp/get_password.py`, "chmod +x /tmp/get_password.py", 'echo "Starting script execution..."', "python3 --version", "which python3", "ls -la /tmp/get_password.py", "if ! python3 /tmp/get_password.py; then", '  echo "Failed to get password"', "  exit 1", "fi", 
        // パスワードを取得して環境変数に設定
        "AD_PASSWORD=$(python3 /tmp/get_password.py)", 'echo "Password retrieved successfully"', `echo 'import boto3
fsx = boto3.client("fsx",region_name="${cdk.Stack.of(this).region}")
response = fsx.describe_storage_virtual_machines(StorageVirtualMachineIds=["${svmRef}"])
print(response["StorageVirtualMachines"][0]["Endpoints"]["Smb"]["IpAddresses"][0])' > /tmp/get_svm_endpoint.py`, "chmod +x /tmp/get_svm_endpoint.py", 'echo "Starting script execution..."', "ls -la /tmp/get_svm_endpoint.py", "if ! python3 /tmp/get_svm_endpoint.py; then", '  echo "Failed to get password"', "  exit 1", "fi", "SMB_IP=$(python3 /tmp/get_svm_endpoint.py)", `sudo mount -t cifs //$SMB_IP/c$/${cifsdataVolName} /tmp/data -o user=${props.adUserName},password="$AD_PASSWORD",domain=${props.adDomain},iocharset=utf8,mapchars,mfsymlinks`, 
        // ragdbもSMB経由でマウント（smb_share配下のragdbディレクトリ）
        `sudo mkdir -p /tmp/db`, `sudo mount -t cifs //$SMB_IP/c$/${cifsdataVolName}/ragdb /tmp/db -o user=${props.adUserName},password="$AD_PASSWORD",domain=${props.adDomain},iocharset=utf8,mapchars,mfsymlinks || sudo mkdir -p /tmp/data/ragdb && sudo mount --bind /tmp/data/ragdb /tmp/db`, `sudo aws ecr get-login-password --region ${cdk.Stack.of(this).region} | sudo docker login --username AWS --password-stdin ${cdk.Stack.of(this).account}.dkr.ecr.${cdk.Stack.of(this).region}.amazonaws.com`);
        if (props.vector instanceof aws_opensearchserverless_1.CfnCollection) {
            userData.addCommands(`sudo docker run --restart always -d -v /tmp/data:/opt/netapp/ai/data -v /tmp/db:/opt/netapp/ai/db -e ENV_REGION="${cdk.Stack.of(this).region}" -e ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME="${props.vector
                .name}" ${embeddingRepository.repository.repositoryUri}:latest`, "docker logs $(docker ps -aq | head -n1)");
        }
        else {
            userData.addCommands(`sudo docker run --restart always -d -v /tmp/data:/opt/netapp/ai/data -v /tmp/db:/opt/netapp/ai/db -e ENV_REGION="${cdk.Stack.of(this).region}" -e ENV_RDS_SECRETS_NAME="${props.vector.secret.secretName}" -e ENV_SECRETS_ARN="${props.vector.secret.secretArn}"  -e ENV_RDS_ARN="${props.vector.clusterArn}" ${embeddingRepository.repository.repositoryUri}:latest`, "docker logs $(docker ps -aq | head -n1)");
        }
        const embeddingServer = new aws_ec2_1.Instance(this, "Instance", {
            vpc: props.vpcConfig.vpc,
            vpcSubnets: {
                subnets: props.vpcConfig.subnets,
            },
            securityGroup: sg,
            instanceType: aws_ec2_1.InstanceType.of(aws_ec2_1.InstanceClass.M5, aws_ec2_1.InstanceSize.LARGE),
            machineImage: aws_ec2_1.MachineImage.fromSsmParameter("/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-ebs"),
            role: instanceRole,
            keyPair: key,
            userData: userData,
        });
        const launchTemplate = new aws_ec2_1.LaunchTemplate(this, "MetadataOptionsTemplate", {
            httpTokens: aws_ec2_1.LaunchTemplateHttpTokens.REQUIRED,
            httpPutResponseHopLimit: 2,
            requireImdsv2: true,
        });
        embeddingServer.instance.launchTemplate = {
            version: launchTemplate.versionNumber,
            launchTemplateId: launchTemplate.launchTemplateId,
        };
        this.instance = embeddingServer;
        cdk_nag_1.NagSuppressions.addResourceSuppressions(instanceRole, [
            {
                id: "AwsSolutions-IAM5",
                reason: "Use this role for only fleet manager access",
                appliesTo: ["Resource::*"],
            },
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(embeddingServer, [
            {
                id: "AwsSolutions-EC26",
                reason: "For FSxN mount",
            },
            {
                id: "AwsSolutions-EC28",
                reason: "For embedding job not accessing to the instance from user",
            },
            {
                id: "AwsSolutions-EC29",
                reason: "For embedding job not accessing to the instance from user",
            },
        ]);
    }
}
exports.EmbeddingServer = EmbeddingServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1iZWRkaW5nLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVtYmVkZGluZy1zZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsMkNBQXVDO0FBQ3ZDLGlEQUFtQztBQUNuQyxpREFjNkI7QUFDN0IsaURBSzZCO0FBRTdCLG1GQUFxRTtBQUNyRSw2Q0FBbUM7QUFFbkMscUNBQTBDO0FBaUMxQyxNQUFhLGVBQWdCLFNBQVEsc0JBQVM7SUFDNUIsV0FBVyxDQUFpQjtJQUM1QixRQUFRLENBQVc7SUFDbkMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXJCLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsWUFBWSxJQUFJLHNCQUFzQixDQUFBO1FBQ2pGLGtCQUFrQjtRQUN0QixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxhQUFhLENBQUE7UUFDckUsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLEdBQUcsRUFBRSwyQkFBMkIsSUFBSSxnQkFBZ0IsQ0FBQTtRQUM5RixzQ0FBc0M7UUFDdEMsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLGVBQWUsRUFBRSxlQUFlLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksSUFBSSxXQUFXLENBQUE7UUFDckksd0NBQXdDO1FBQ3hDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxlQUFlLEVBQUUsWUFBWSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FB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QixDQUFDLENBQUM7UUFDSCxlQUFlLENBQUMsUUFBUSxDQUFDLGNBQWMsR0FBRztZQUN4QyxPQUFPLEVBQUUsY0FBYyxDQUFDLGFBQWE7WUFDckMsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtTQUNsRCxDQUFDO1FBRUYsSUFBSSxDQUFDLFFBQVEsR0FBRyxlQUFlLENBQUM7UUFFaEMseUJBQWUsQ0FBQyx1QkFBdUIsQ0FDckMsWUFBWSxFQUNaO1lBQ0U7Z0JBQ0UsRUFBRSxFQUFFLG1CQUFtQjtnQkFDdkIsTUFBTSxFQUFFLDZDQUE2QztnQkFDckQsU0FBUyxFQUFFLENBQUMsYUFBYSxDQUFDO2FBQzNCO1NBQ0YsRUFDRCxJQUFJLENBQ0wsQ0FBQztRQUVGLHlCQUFlLENBQUMsdUJBQXVCLENBQUMsZUFBZSxFQUFFO1lBQ3ZEO2dCQUNFLEVBQUUsRUFBRSxtQkFBbUI7Z0JBQ3ZCLE1BQU0sRUFBRSxnQkFBZ0I7YUFDekI7WUFDRDtnQkFDRSxFQUFFLEVBQUUsbUJBQW1CO2dCQUN2QixNQUFNLEVBQUUsMkRBQTJEO2FBQ3BFO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLG1CQUFtQjtnQkFDdkIsTUFBTSxFQUFFLDJEQUEyRDthQUNwRTtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWhURCwwQ0FnVEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogIENvcHlyaWdodCAyMDI1IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiAgU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IExpY2Vuc2VSZWYtLmFtYXpvbi5jb20uLUFtem5TTC0xLjBcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQW1hem9uIFNvZnR3YXJlIExpY2Vuc2UgIGh0dHA6Ly9hd3MuYW1hem9uLmNvbS9hc2wvXG4gKi9cblxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7XG4gIEluc3RhbmNlLFxuICBJbnN0YW5jZUNsYXNzLFxuICBJbnN0YW5jZVNpemUsXG4gIEluc3RhbmNlVHlwZSxcbiAgSVN1Ym5ldCxcbiAgS2V5UGFpcixcbiAgTGF1bmNoVGVtcGxhdGUsXG4gIExhdW5jaFRlbXBsYXRlSHR0cFRva2VucyxcbiAgTWFjaGluZUltYWdlLFxuICBQZWVyLFxuICBQb3J0LFxuICBTZWN1cml0eUdyb3VwLFxuICBVc2VyRGF0YSxcbn0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1lYzJcIjtcbmltcG9ydCB7XG4gIEVmZmVjdCxcbiAgTWFuYWdlZFBvbGljeSxcbiAgUG9saWN5U3RhdGVtZW50LFxuICBSb2xlLFxufSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xuaW1wb3J0IHsgQ2ZuTWljcm9zb2Z0QUQgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWRpcmVjdG9yeXNlcnZpY2VcIjtcbmltcG9ydCB7IENmbkNvbGxlY3Rpb24gfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzXCI7XG5pbXBvcnQgeyBFQ1IgfSBmcm9tIFwiLi9yZXBvc2l0b3J5XCI7XG5pbXBvcnQgeyBJU2VjcmV0IH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlclwiO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSBcImNkay1uYWdcIjtcbmltcG9ydCB7IERhdGFiYXNlQ2x1c3RlciB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtcmRzXCI7XG5pbXBvcnQgeyBTZWNyZXQgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyXCI7XG5pbXBvcnQge1xuICBDZm5TdG9yYWdlVmlydHVhbE1hY2hpbmUsXG4gIENmblZvbHVtZSxcbn0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1mc3hcIjtcblxuaW50ZXJmYWNlIFZwY0NvbmZpZyB7XG4gIHZwYzogY2RrLmF3c19lYzIuSVZwYztcbiAgc3VibmV0czogSVN1Ym5ldFtdO1xufVxuXG5pbnRlcmZhY2UgRW1iZWRkaW5nU2VydmVyUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHZwY0NvbmZpZzogVnBjQ29uZmlnO1xuICB2ZWN0b3I6IENmbkNvbGxlY3Rpb24gfCBEYXRhYmFzZUNsdXN0ZXI7XG4gIGFkU2VjcmV0OiBJU2VjcmV0O1xuICBhZFVzZXJOYW1lOiBzdHJpbmc7XG4gIGFkRG9tYWluOiBzdHJpbmc7XG4gIHJvbGU6IFJvbGU7XG4gIGltYWdlUGF0aDogc3RyaW5nO1xuICB0YWc6IHN0cmluZztcbiAgYWRBZG1pblNlY3JldDogU2VjcmV0O1xuICBjaWZzVm9sPzogQ2ZuVm9sdW1lO1xuICByYWdkYlZvbD86IENmblZvbHVtZTtcbiAgc3ZtPzogQ2ZuU3RvcmFnZVZpcnR1YWxNYWNoaW5lO1xuICBmc3hBZG1pblNlY3JldD86IFNlY3JldDtcbiAgc2VydmljZUFjY291bnRTZWNyZXQ/OiBTZWNyZXQ7XG4gIGVtYmVkZGluZ0NvbmZpZz86IHtcbiAgICBjaWZzZGF0YVZvbE5hbWU/OiBzdHJpbmc7XG4gICAgcmFnZGJWb2xQYXRoPzogc3RyaW5nO1xuICB9O1xufVxuZXhwb3J0IGNsYXNzIEVtYmVkZGluZ1NlcnZlciBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBtaWNyb3NvZnRBZDogQ2ZuTWljcm9zb2Z0QUQ7XG4gIHB1YmxpYyByZWFkb25seSBpbnN0YW5jZTogSW5zdGFuY2U7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFbWJlZGRpbmdTZXJ2ZXJQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbmNvbnN0IGZzeElkID0gcHJvY2Vzcy5lbnYuRlNYX0lEIHx8IHByb3BzLnN2bT8uZmlsZVN5c3RlbUlkIHx8IFwiZnMtMDdiNWEwYmMyYTFjMzQyZjRcIlxuICAgIC8vIHN2bXJlZuOBqHN2bWlk44Gv5LiA57eSXG5jb25zdCBzdm1SZWYgPSBwcm9jZXNzLmVudi5TVk1fUkVGIHx8IHByb3BzLnN2bT8ucmVmIHx8IFwic3ZtLWRlZmF1bHRcIlxuY29uc3Qgc3ZtSWQgPSBwcm9jZXNzLmVudi5TVk1fSUQgfHwgcHJvcHMuc3ZtPy5hdHRyU3RvcmFnZVZpcnR1YWxNYWNoaW5lSWQgfHwgXCJzdm0tZGVmYXVsdC1pZFwiXG4vLyBjb25maWcudHPjga7oqK3lrprjgpLlhKrlhYjjgZfjgIHnkrDlooPlpInmlbDjgIHml6LlrZjjg5zjg6rjg6Xjg7zjg6DlkI3jga7poIbjgafkvb/nlKhcbmNvbnN0IGNpZnNkYXRhVm9sTmFtZSA9IHByb3BzLmVtYmVkZGluZ0NvbmZpZz8uY2lmc2RhdGFWb2xOYW1lIHx8IHByb2Nlc3MuZW52LkNJRlNEQVRBX1ZPTF9OQU1FIHx8IHByb3BzLmNpZnNWb2w/Lm5hbWUgfHwgXCJzbWJfc2hhcmVcIlxuLy8gcmFnZGLjgoJjb25maWcudHPjga7oqK3lrprjgpLlhKrlhYjjgZfjgIFzbWJfc2hhcmXphY3kuIvjgavphY3nva5cbmNvbnN0IHJhZ2RiVm9scGF0aCA9IHByb3BzLmVtYmVkZGluZ0NvbmZpZz8ucmFnZGJWb2xQYXRoIHx8IHByb2Nlc3MuZW52LlJBR0RCX1ZPTF9QQVRIIHx8IFwiL3NtYl9zaGFyZS9yYWdkYlwiXG5cbiAgICBjb25zdCBlbWJlZGRpbmdSZXBvc2l0b3J5ID0gbmV3IEVDUih0aGlzLCBcIkVjclwiLCB7XG4gICAgICBwYXRoOiBgJHtwcm9wcy5pbWFnZVBhdGh9L2VtYmVkYCxcbiAgICAgIHRhZzogcHJvcHMudGFnLFxuICAgIH0pO1xuICAgIGNvbnN0IHNnID0gbmV3IFNlY3VyaXR5R3JvdXAodGhpcywgXCJTZ1wiLCB7XG4gICAgICB2cGM6IHByb3BzLnZwY0NvbmZpZy52cGMsXG4gICAgfSk7XG5cbiAgICBwcm9wcy52cGNDb25maWcudnBjLnByaXZhdGVTdWJuZXRzLm1hcCgodmFsdWU6IElTdWJuZXQpID0+IHtcbiAgICAgIHNnLmFkZEluZ3Jlc3NSdWxlKFBlZXIuaXB2NChgJHt2YWx1ZS5pcHY0Q2lkckJsb2NrfWApLCBQb3J0LnRjcCgzODkpKTtcbiAgICB9KTtcblxuICAgIHByb3BzLnZwY0NvbmZpZy52cGMucHJpdmF0ZVN1Ym5ldHMubWFwKCh2YWx1ZTogSVN1Ym5ldCkgPT4ge1xuICAgICAgc2cuYWRkSW5ncmVzc1J1bGUoUGVlci5pcHY0KGAxMC4wLjAuMC84YCksIFBvcnQuYWxsVHJhZmZpYygpKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGluc3RhbmNlUm9sZSA9IHByb3BzLnJvbGU7XG4gICAgaWYgKHByb3BzLnZlY3RvciBpbnN0YW5jZW9mIGNkay5hd3NfcmRzLkRhdGFiYXNlQ2x1c3Rlcikge1xuICAgICAgcHJvcHMudmVjdG9yLmNvbm5lY3Rpb25zLmFsbG93RnJvbShcbiAgICAgICAgc2csXG4gICAgICAgIFBvcnQudGNwKHByb3BzLnZlY3Rvci5jbHVzdGVyRW5kcG9pbnQucG9ydClcbiAgICAgICk7XG4gICAgICBwcm9wcy52ZWN0b3IuZ3JhbnREYXRhQXBpQWNjZXNzKGluc3RhbmNlUm9sZSk7XG4gICAgICBwcm9wcy52ZWN0b3Iuc2VjcmV0IS5ncmFudFJlYWQoaW5zdGFuY2VSb2xlKTtcbiAgICB9XG5cbiAgICAvLyBGb3IgZmxlZXQgIE1hbmFnZXJcblxuICAgIGluc3RhbmNlUm9sZS5hZGRUb1ByaW5jaXBhbFBvbGljeShcbiAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJzc206RGVzY3JpYmVBc3NvY2lhdGlvblwiLFxuICAgICAgICAgIFwic3NtOkdldERlcGxveWFibGVQYXRjaFNuYXBzaG90Rm9ySW5zdGFuY2VcIixcbiAgICAgICAgICBcInNzbTpHZXREb2N1bWVudFwiLFxuICAgICAgICAgIFwic3NtOkRlc2NyaWJlRG9jdW1lbnRcIixcbiAgICAgICAgICBcInNzbTpHZXRNYW5pZmVzdFwiLFxuICAgICAgICAgIFwic3NtOkdldFBhcmFtZXRlclwiLFxuICAgICAgICAgIFwic3NtOkdldFBhcmFtZXRlcnNcIixcbiAgICAgICAgICBcInNzbTpMaXN0QXNzb2NpYXRpb25zXCIsXG4gICAgICAgICAgXCJzc206TGlzdEluc3RhbmNlQXNzb2NpYXRpb25zXCIsXG4gICAgICAgICAgXCJzc206UHV0SW52ZW50b3J5XCIsXG4gICAgICAgICAgXCJzc206UHV0Q29tcGxpYW5jZUl0ZW1zXCIsXG4gICAgICAgICAgXCJzc206UHV0Q29uZmlndXJlUGFja2FnZVJlc3VsdFwiLFxuICAgICAgICAgIFwic3NtOlVwZGF0ZUFzc29jaWF0aW9uU3RhdHVzXCIsXG4gICAgICAgICAgXCJzc206VXBkYXRlSW5zdGFuY2VBc3NvY2lhdGlvblN0YXR1c1wiLFxuICAgICAgICAgIFwic3NtOlVwZGF0ZUluc3RhbmNlSW5mb3JtYXRpb25cIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuICAgIGluc3RhbmNlUm9sZS5hZGRUb1ByaW5jaXBhbFBvbGljeShcbiAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJzc21tZXNzYWdlczpDcmVhdGVDb250cm9sQ2hhbm5lbFwiLFxuICAgICAgICAgIFwic3NtbWVzc2FnZXM6Q3JlYXRlRGF0YUNoYW5uZWxcIixcbiAgICAgICAgICBcInNzbW1lc3NhZ2VzOk9wZW5Db250cm9sQ2hhbm5lbFwiLFxuICAgICAgICAgIFwic3NtbWVzc2FnZXM6T3BlbkRhdGFDaGFubmVsXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBpbnN0YW5jZVJvbGUuYWRkVG9QcmluY2lwYWxQb2xpY3koXG4gICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiZWMybWVzc2FnZXM6QWNrbm93bGVkZ2VNZXNzYWdlXCIsXG4gICAgICAgICAgXCJlYzJtZXNzYWdlczpEZWxldGVNZXNzYWdlXCIsXG4gICAgICAgICAgXCJlYzJtZXNzYWdlczpGYWlsTWVzc2FnZVwiLFxuICAgICAgICAgIFwiZWMybWVzc2FnZXM6R2V0RW5kcG9pbnRcIixcbiAgICAgICAgICBcImVjMm1lc3NhZ2VzOkdldE1lc3NhZ2VzXCIsXG4gICAgICAgICAgXCJlYzJtZXNzYWdlczpTZW5kUmVwbHlcIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuICAgIGluc3RhbmNlUm9sZS5hZGRUb1ByaW5jaXBhbFBvbGljeShcbiAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJmc3g6RGVzY3JpYmVTdG9yYWdlVmlydHVhbE1hY2hpbmVzXCIsXG4gICAgICAgICAgXCJmc3g6RGVzY3JpYmVGaWxlU3lzdGVtc1wiLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICB9KVxuICAgICk7XG4gICAgaW5zdGFuY2VSb2xlLmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICBNYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcIkFtYXpvblNTTURpcmVjdG9yeVNlcnZpY2VBY2Nlc3NcIilcbiAgICApO1xuICAgIGlmIChwcm9wcy52ZWN0b3IgaW5zdGFuY2VvZiBDZm5Db2xsZWN0aW9uKSB7XG4gICAgICBpbnN0YW5jZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIFwiYW9zczpBUElBY2Nlc3NBbGxcIixcbiAgICAgICAgICAgIFwiYW9zczpDcmVhdGVBY2Nlc3NQb2xpY3lcIixcbiAgICAgICAgICAgIFwiYW9zczpDcmVhdGVTZWN1cml0eVBvbGljeVwiLFxuICAgICAgICAgICAgXCJhb3NzOkNyZWF0ZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogW3Byb3BzLnZlY3Rvci5hdHRyQXJuXSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaW5zdGFuY2VSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXCJiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbFwiLCBcImJlZHJvY2s6SW52b2tlTW9kZWxcIl0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGNkay5TdGFjay5vZih0aGlzKS5yZWdpb24gPT09IFwidXMtZWFzdC0xXCJcbiAgICAgICAgICAgID8gYGFybjphd3M6YmVkcm9jazoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsLypgXG4gICAgICAgICAgICA6IGBhcm46YXdzOmJlZHJvY2s6JHtcbiAgICAgICAgICAgICAgICBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uXG4gICAgICAgICAgICAgIH06OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgICAgXCJhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsLypcIixcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBpbnN0YW5jZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcImVjcjpCYXRjaEdldEltYWdlXCIsIFwiZWNyOkdldERvd25sb2FkVXJsRm9yTGF5ZXJcIl0sXG4gICAgICAgIHJlc291cmNlczogW2VtYmVkZGluZ1JlcG9zaXRvcnkucmVwb3NpdG9yeS5yZXBvc2l0b3J5QXJuXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBpbnN0YW5jZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImFvc3M6TGlzdENvbGxlY3Rpb25zXCIsXG4gICAgICAgICAgXCJhb3NzOkJhdGNoR2V0Q29sbGVjdGlvblwiLFxuICAgICAgICAgIFwiZWNyOkdldEF1dGhvcml6YXRpb25Ub2tlblwiLFxuICAgICAgICAgIFwic3RzOkdldENhbGxlcklkZW50aXR5XCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBpbnN0YW5jZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcInNlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlXCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtwcm9wcy5hZFNlY3JldC5zZWNyZXRBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3Qga2V5ID0gbmV3IEtleVBhaXIodGhpcywgXCJLZXlcIik7XG4gICAga2V5LmFwcGx5UmVtb3ZhbFBvbGljeShjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZKTtcblxuICAgIGNvbnN0IHVzZXJEYXRhID0gVXNlckRhdGEuZm9yTGludXgoeyBzaGViYW5nOiBcIiMhL2Jpbi9zaFwiIH0pO1xuICAgIHVzZXJEYXRhLmFkZENvbW1hbmRzKFxuICAgICAgXCJzZXQgLWV4XCIsXG4gICAgICBcInN1ZG8geXVtIHVwZGF0ZSAteVwiLFxuICAgICAgXCJzdWRvIHl1bSBpbnN0YWxsIC15IGNpZnMtdXRpbHMgcHl0aG9uMy1waXAganFcIixcbiAgICAgIFwic3VkbyBhbWF6b24tbGludXgtZXh0cmFzIGluc3RhbGwgZG9ja2VyIC15XCIsXG4gICAgICBcInN1ZG8gc2VydmljZSBkb2NrZXIgc3RhcnRcIixcbiAgICAgIFwic3VkbyB1c2VybW9kIC1hIC1HIGRvY2tlciBlYzItdXNlclwiLFxuICAgICAgXCJzdWRvIG1rZGlyIC90bXAvZGF0YVwiLFxuICAgICAgXCJzdWRvIG1rZGlyIC90bXAvZGJcIixcbiAgICAgIFwicGlwMyBpbnN0YWxsIGJvdG8zXCIsXG5cbiAgICAgIGBlY2hvICdpbXBvcnQgYm90bzNcbmltcG9ydCBqc29uXG5cbmRlZiBnZXRfc2VjcmV0KCk6XG4gICAgc2VjcmV0c21hbmFnZXIgPSBib3RvMy5jbGllbnQoXCJzZWNyZXRzbWFuYWdlclwiLCByZWdpb25fbmFtZT1cIiR7XG4gICAgICBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uXG4gICAgfVwiKVxuICAgIHJlc3BvbnNlID0gc2VjcmV0c21hbmFnZXIuZ2V0X3NlY3JldF92YWx1ZShTZWNyZXRJZD1cIiR7XG4gICAgICBwcm9wcy5hZFNlY3JldC5zZWNyZXRBcm5cbiAgICB9XCIpXG4gICAgc2VjcmV0ID0ganNvbi5sb2FkcyhyZXNwb25zZVtcIlNlY3JldFN0cmluZ1wiXSlcbiAgICByZXR1cm4gc2VjcmV0W1wicGFzc3dvcmRcIl1cblxucHJpbnQoZ2V0X3NlY3JldCgpKScgPiAvdG1wL2dldF9wYXNzd29yZC5weWAsXG4gICAgICBcImNobW9kICt4IC90bXAvZ2V0X3Bhc3N3b3JkLnB5XCIsXG4gICAgICAnZWNobyBcIlN0YXJ0aW5nIHNjcmlwdCBleGVjdXRpb24uLi5cIicsXG4gICAgICBcInB5dGhvbjMgLS12ZXJzaW9uXCIsXG4gICAgICBcIndoaWNoIHB5dGhvbjNcIixcbiAgICAgIFwibHMgLWxhIC90bXAvZ2V0X3Bhc3N3b3JkLnB5XCIsXG5cbiAgICAgIFwiaWYgISBweXRob24zIC90bXAvZ2V0X3Bhc3N3b3JkLnB5OyB0aGVuXCIsXG4gICAgICAnICBlY2hvIFwiRmFpbGVkIHRvIGdldCBwYXNzd29yZFwiJyxcbiAgICAgIFwiICBleGl0IDFcIixcbiAgICAgIFwiZmlcIixcblxuICAgICAgLy8g44OR44K544Ov44O844OJ44KS5Y+W5b6X44GX44Gm55Kw5aKD5aSJ5pWw44Gr6Kit5a6aXG4gICAgICBcIkFEX1BBU1NXT1JEPSQocHl0aG9uMyAvdG1wL2dldF9wYXNzd29yZC5weSlcIixcbiAgICAgICdlY2hvIFwiUGFzc3dvcmQgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseVwiJyxcblxuICAgICAgYGVjaG8gJ2ltcG9ydCBib3RvM1xuZnN4ID0gYm90bzMuY2xpZW50KFwiZnN4XCIscmVnaW9uX25hbWU9XCIke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259XCIpXG5yZXNwb25zZSA9IGZzeC5kZXNjcmliZV9zdG9yYWdlX3ZpcnR1YWxfbWFjaGluZXMoU3RvcmFnZVZpcnR1YWxNYWNoaW5lSWRzPVtcIiR7c3ZtUmVmfVwiXSlcbnByaW50KHJlc3BvbnNlW1wiU3RvcmFnZVZpcnR1YWxNYWNoaW5lc1wiXVswXVtcIkVuZHBvaW50c1wiXVtcIlNtYlwiXVtcIklwQWRkcmVzc2VzXCJdWzBdKScgPiAvdG1wL2dldF9zdm1fZW5kcG9pbnQucHlgLFx0ICAgIFxuXG4gICAgICBcImNobW9kICt4IC90bXAvZ2V0X3N2bV9lbmRwb2ludC5weVwiLFxuICAgICAgJ2VjaG8gXCJTdGFydGluZyBzY3JpcHQgZXhlY3V0aW9uLi4uXCInLFxuICAgICAgXCJscyAtbGEgL3RtcC9nZXRfc3ZtX2VuZHBvaW50LnB5XCIsXG5cbiAgICAgIFwiaWYgISBweXRob24zIC90bXAvZ2V0X3N2bV9lbmRwb2ludC5weTsgdGhlblwiLFxuICAgICAgJyAgZWNobyBcIkZhaWxlZCB0byBnZXQgcGFzc3dvcmRcIicsXG4gICAgICBcIiAgZXhpdCAxXCIsXG4gICAgICBcImZpXCIsXG4gICAgICBcIlNNQl9JUD0kKHB5dGhvbjMgL3RtcC9nZXRfc3ZtX2VuZHBvaW50LnB5KVwiLFxuXG4gICAgICBgc3VkbyBtb3VudCAtdCBjaWZzIC8vJFNNQl9JUC9jJC8ke2NpZnNkYXRhVm9sTmFtZX0gL3RtcC9kYXRhIC1vIHVzZXI9JHtwcm9wcy5hZFVzZXJOYW1lfSxwYXNzd29yZD1cIiRBRF9QQVNTV09SRFwiLGRvbWFpbj0ke3Byb3BzLmFkRG9tYWlufSxpb2NoYXJzZXQ9dXRmOCxtYXBjaGFycyxtZnN5bWxpbmtzYCxcbiAgICAgIC8vIHJhZ2Ri44KCU01C57WM55Sx44Gn44Oe44Km44Oz44OI77yIc21iX3NoYXJl6YWN5LiL44GucmFnZGLjg4fjgqPjg6zjgq/jg4jjg6rvvIlcbiAgICAgIGBzdWRvIG1rZGlyIC1wIC90bXAvZGJgLFxuICAgICAgYHN1ZG8gbW91bnQgLXQgY2lmcyAvLyRTTUJfSVAvYyQvJHtjaWZzZGF0YVZvbE5hbWV9L3JhZ2RiIC90bXAvZGIgLW8gdXNlcj0ke3Byb3BzLmFkVXNlck5hbWV9LHBhc3N3b3JkPVwiJEFEX1BBU1NXT1JEXCIsZG9tYWluPSR7cHJvcHMuYWREb21haW59LGlvY2hhcnNldD11dGY4LG1hcGNoYXJzLG1mc3ltbGlua3MgfHwgc3VkbyBta2RpciAtcCAvdG1wL2RhdGEvcmFnZGIgJiYgc3VkbyBtb3VudCAtLWJpbmQgL3RtcC9kYXRhL3JhZ2RiIC90bXAvZGJgLFxuICAgICAgYHN1ZG8gYXdzIGVjciBnZXQtbG9naW4tcGFzc3dvcmQgLS1yZWdpb24gJHtcbiAgICAgICAgY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvblxuICAgICAgfSB8IHN1ZG8gZG9ja2VyIGxvZ2luIC0tdXNlcm5hbWUgQVdTIC0tcGFzc3dvcmQtc3RkaW4gJHtcbiAgICAgICAgY2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnRcbiAgICAgIH0uZGtyLmVjci4ke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259LmFtYXpvbmF3cy5jb21gXG4gICAgKTtcblxuICAgIGlmIChwcm9wcy52ZWN0b3IgaW5zdGFuY2VvZiBDZm5Db2xsZWN0aW9uKSB7XG4gICAgICB1c2VyRGF0YS5hZGRDb21tYW5kcyhcbiAgICAgICAgYHN1ZG8gZG9ja2VyIHJ1biAtLXJlc3RhcnQgYWx3YXlzIC1kIC12IC90bXAvZGF0YTovb3B0L25ldGFwcC9haS9kYXRhIC12IC90bXAvZGI6L29wdC9uZXRhcHAvYWkvZGIgLWUgRU5WX1JFR0lPTj1cIiR7XG4gICAgICAgICAgY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvblxuICAgICAgICB9XCIgLWUgRU5WX09QRU5fU0VBUkNIX1NFUlZFUkxFU1NfQ09MTEVDVElPTl9OQU1FPVwiJHtwcm9wcy52ZWN0b3JcbiAgICAgICAgICAubmFtZSF9XCIgJHtlbWJlZGRpbmdSZXBvc2l0b3J5LnJlcG9zaXRvcnkucmVwb3NpdG9yeVVyaX06bGF0ZXN0YCxcbiAgICAgICAgXCJkb2NrZXIgbG9ncyAkKGRvY2tlciBwcyAtYXEgfCBoZWFkIC1uMSlcIlxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXNlckRhdGEuYWRkQ29tbWFuZHMoXG4gICAgICAgIGBzdWRvIGRvY2tlciBydW4gLS1yZXN0YXJ0IGFsd2F5cyAtZCAtdiAvdG1wL2RhdGE6L29wdC9uZXRhcHAvYWkvZGF0YSAtdiAvdG1wL2RiOi9vcHQvbmV0YXBwL2FpL2RiIC1lIEVOVl9SRUdJT049XCIke1xuICAgICAgICAgIGNkay5TdGFjay5vZih0aGlzKS5yZWdpb25cbiAgICAgICAgfVwiIC1lIEVOVl9SRFNfU0VDUkVUU19OQU1FPVwiJHtcbiAgICAgICAgICBwcm9wcy52ZWN0b3Iuc2VjcmV0IS5zZWNyZXROYW1lXG4gICAgICAgIH1cIiAtZSBFTlZfU0VDUkVUU19BUk49XCIke1xuICAgICAgICAgIHByb3BzLnZlY3Rvci5zZWNyZXQhLnNlY3JldEFyblxuICAgICAgICB9XCIgIC1lIEVOVl9SRFNfQVJOPVwiJHtwcm9wcy52ZWN0b3IuY2x1c3RlckFybn1cIiAke1xuICAgICAgICAgIGVtYmVkZGluZ1JlcG9zaXRvcnkucmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpXG4gICAgICAgIH06bGF0ZXN0YCxcbiAgICAgICAgXCJkb2NrZXIgbG9ncyAkKGRvY2tlciBwcyAtYXEgfCBoZWFkIC1uMSlcIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBlbWJlZGRpbmdTZXJ2ZXIgPSBuZXcgSW5zdGFuY2UodGhpcywgXCJJbnN0YW5jZVwiLCB7XG4gICAgICB2cGM6IHByb3BzLnZwY0NvbmZpZy52cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7XG5cdCAgICAgIHN1Ym5ldHM6IHByb3BzLnZwY0NvbmZpZy5zdWJuZXRzLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IHNnLFxuICAgICAgaW5zdGFuY2VUeXBlOiBJbnN0YW5jZVR5cGUub2YoSW5zdGFuY2VDbGFzcy5NNSwgSW5zdGFuY2VTaXplLkxBUkdFKSxcbiAgICAgIG1hY2hpbmVJbWFnZTogTWFjaGluZUltYWdlLmZyb21Tc21QYXJhbWV0ZXIoXG4gICAgICAgIFwiL2F3cy9zZXJ2aWNlL2FtaS1hbWF6b24tbGludXgtbGF0ZXN0L2Ftem4yLWFtaS1odm0teDg2XzY0LWVic1wiXG4gICAgICApLFxuICAgICAgcm9sZTogaW5zdGFuY2VSb2xlLFxuICAgICAga2V5UGFpcjoga2V5LFxuICAgICAgdXNlckRhdGE6IHVzZXJEYXRhLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbGF1bmNoVGVtcGxhdGUgPSBuZXcgTGF1bmNoVGVtcGxhdGUodGhpcywgXCJNZXRhZGF0YU9wdGlvbnNUZW1wbGF0ZVwiLCB7XG4gICAgICBodHRwVG9rZW5zOiBMYXVuY2hUZW1wbGF0ZUh0dHBUb2tlbnMuUkVRVUlSRUQsXG4gICAgICBodHRwUHV0UmVzcG9uc2VIb3BMaW1pdDogMixcbiAgICAgIHJlcXVpcmVJbWRzdjI6IHRydWUsXG4gICAgfSk7XG4gICAgZW1iZWRkaW5nU2VydmVyLmluc3RhbmNlLmxhdW5jaFRlbXBsYXRlID0ge1xuICAgICAgdmVyc2lvbjogbGF1bmNoVGVtcGxhdGUudmVyc2lvbk51bWJlcixcbiAgICAgIGxhdW5jaFRlbXBsYXRlSWQ6IGxhdW5jaFRlbXBsYXRlLmxhdW5jaFRlbXBsYXRlSWQsXG4gICAgfTtcblxuICAgIHRoaXMuaW5zdGFuY2UgPSBlbWJlZGRpbmdTZXJ2ZXI7XG5cbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoXG4gICAgICBpbnN0YW5jZVJvbGUsXG4gICAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtSUFNNVwiLFxuICAgICAgICAgIHJlYXNvbjogXCJVc2UgdGhpcyByb2xlIGZvciBvbmx5IGZsZWV0IG1hbmFnZXIgYWNjZXNzXCIsXG4gICAgICAgICAgYXBwbGllc1RvOiBbXCJSZXNvdXJjZTo6KlwiXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICB0cnVlXG4gICAgKTtcblxuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhlbWJlZGRpbmdTZXJ2ZXIsIFtcbiAgICAgIHtcbiAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLUVDMjZcIixcbiAgICAgICAgcmVhc29uOiBcIkZvciBGU3hOIG1vdW50XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtRUMyOFwiLFxuICAgICAgICByZWFzb246IFwiRm9yIGVtYmVkZGluZyBqb2Igbm90IGFjY2Vzc2luZyB0byB0aGUgaW5zdGFuY2UgZnJvbSB1c2VyXCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtRUMyOVwiLFxuICAgICAgICByZWFzb246IFwiRm9yIGVtYmVkZGluZyBqb2Igbm90IGFjY2Vzc2luZyB0byB0aGUgaW5zdGFuY2UgZnJvbSB1c2VyXCIsXG4gICAgICB9LFxuICAgIF0pO1xuICB9XG59XG4iXX0=