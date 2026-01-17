"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDB = void 0;
const constructs_1 = require("constructs");
const aws_opensearchserverless_1 = require("aws-cdk-lib/aws-opensearchserverless");
const config_1 = require("../../config");
const aws_rds_1 = require("aws-cdk-lib/aws-rds");
const aws_ec2_1 = require("aws-cdk-lib/aws-ec2");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const custom_resources_1 = require("aws-cdk-lib/custom-resources");
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const cdk_nag_1 = require("cdk-nag");
class VectorDB extends constructs_1.Construct {
    db;
    constructor(scope, id, props) {
        super(scope, id);
        if (props.vector === "aurora" && props.vpcConfig) {
            const aurora = new aws_rds_1.DatabaseCluster(this, "AuroraServerless", {
                engine: aws_rds_1.DatabaseClusterEngine.auroraPostgres({
                    version: aws_rds_1.AuroraPostgresEngineVersion.VER_16_6,
                }),
                writer: aws_rds_1.ClusterInstance.serverlessV2("writer", {
                    scaleWithWriter: true,
                }),
                readers: [
                    aws_rds_1.ClusterInstance.serverlessV2("reader", {
                        scaleWithWriter: true,
                    }),
                ],
                serverlessV2MinCapacity: 0,
                vpc: props.vpcConfig.vpc,
                vpcSubnets: {
                    subnets: props.vpcConfig.subnets,
                },
                enableDataApi: true,
                removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
                iamAuthentication: true,
                storageEncrypted: true,
            });
            aurora.addRotationSingleUser();
            const setupFnRole = new aws_iam_1.Role(this, `${id}-SetupFnRole`, {
                assumedBy: new aws_iam_1.CompositePrincipal(new aws_iam_1.ServicePrincipal("lambda.amazonaws.com")),
                managedPolicies: [
                    aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                    aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("AWSLambda_FullAccess"),
                    aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
                ],
            });
            const pgVectorSetupFn = new aws_lambda_nodejs_1.NodejsFunction(this, "PgvectorSetupFn", {
                runtime: aws_lambda_1.Runtime.NODEJS_22_X,
                entry: "./lambda/pgvector/index.ts",
                handler: "handler",
                awsSdkConnectionReuse: false,
                timeout: aws_cdk_lib_1.Duration.minutes(1),
                environment: {
                    RDS_ARN: aurora.clusterArn,
                    RDS_SECRET_ARN: aurora.secret.secretArn,
                },
                vpc: props.vpcConfig.vpc,
                vpcSubnets: {
                    subnets: props.vpcConfig.subnets,
                },
                role: setupFnRole,
            });
            aurora.secret.grantRead(pgVectorSetupFn);
            aurora.connections.allowFrom(pgVectorSetupFn, aws_ec2_1.Port.tcp(aurora.clusterEndpoint.port));
            aurora.grantDataApiAccess(pgVectorSetupFn);
            const provider = new custom_resources_1.Provider(this, "CustomProvider", {
                onEventHandler: pgVectorSetupFn,
            });
            const cr = new aws_cdk_lib_1.CustomResource(this, "SetupPgvector", {
                serviceToken: provider.serviceToken,
            });
            cr.node.addDependency(aurora);
            this.db = aurora;
            cdk_nag_1.NagSuppressions.addResourceSuppressions([setupFnRole], [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "Given the least privilege to this role for lambda",
                },
                {
                    id: "AwsSolutions-IAM5",
                    reason: "Given the least privilege to this role for lambda",
                },
            ], true);
            cdk_nag_1.NagSuppressions.addResourceSuppressions([provider], [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "The role created automatically by CDK",
                },
                {
                    id: "AwsSolutions-IAM5",
                    reason: "The role created automatically by CDK",
                },
                {
                    id: "AwsSolutions-L1",
                    reason: "The role created automatically by CDK",
                },
            ], true);
            cdk_nag_1.NagSuppressions.addResourceSuppressions([aurora], [
                {
                    id: "AwsSolutions-RDS10",
                    reason: "Disable for PoC. You should enable it if deploying the app in production environment",
                },
            ], true);
        }
        else {
            const aoss = new aws_opensearchserverless_1.CfnCollection(this, "Aoss", {
                type: "VECTORSEARCH",
                name: `${config_1.devConfig.userName}-${props.collectionName}`,
            });
            const aossEncryptionPolicy = new aws_opensearchserverless_1.CfnSecurityPolicy(this, "AossEncryptionPolicy", {
                type: "encryption",
                name: `${config_1.devConfig.userName}-encryption-policy`,
                policy: JSON.stringify({
                    Rules: [
                        {
                            ResourceType: "collection",
                            Resource: [
                                `collection/${config_1.devConfig.userName}-${props.collectionName}`,
                            ],
                        },
                    ],
                    AWSOwnedKey: true,
                }),
            });
            aoss.addDependency(aossEncryptionPolicy);
            new aws_opensearchserverless_1.CfnSecurityPolicy(this, "AossNetworkPolicy", {
                name: `${config_1.devConfig.userName}-network-policy`,
                type: "network",
                policy: JSON.stringify([
                    {
                        Rules: [
                            {
                                ResourceType: "collection",
                                Resource: [
                                    `collection/${config_1.devConfig.userName}-${props.collectionName}`,
                                ],
                            },
                            {
                                ResourceType: "dashboard",
                                Resource: [
                                    `collection/${config_1.devConfig.userName}-${props.collectionName}`,
                                ],
                            },
                        ],
                        AllowFromPublic: true,
                    },
                ]),
            });
            new aws_opensearchserverless_1.CfnAccessPolicy(this, "AossAccessPolicy", {
                name: `${config_1.devConfig.userName}-access-policy`,
                type: "data",
                policy: JSON.stringify([
                    {
                        Rules: [
                            {
                                ResourceType: "index",
                                Resource: [
                                    `index/${config_1.devConfig.userName}-${props.collectionName}/*`,
                                ],
                                Permission: ["aoss:*"],
                            },
                            {
                                ResourceType: "collection",
                                Resource: [
                                    `collection/${config_1.devConfig.userName}-${props.collectionName}`,
                                ],
                                Permission: ["aoss:*"],
                            },
                        ],
                        Principal: props.roles,
                    },
                ]),
            });
            this.db = aoss;
        }
    }
}
exports.VectorDB = VectorDB;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmVjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUFFSCwyQ0FBdUM7QUFHdkMsbUZBSThDO0FBQzlDLHlDQUF5QztBQUN6QyxpREFLNkI7QUFDN0IsaURBQW9EO0FBQ3BELDZDQUFzRTtBQUN0RSxtRUFBd0Q7QUFDeEQscUVBQStEO0FBQy9ELHVEQUFpRDtBQUNqRCxpREFLNkI7QUFDN0IscUNBQTBDO0FBYzFDLE1BQWEsUUFBUyxTQUFRLHNCQUFTO0lBQ3JCLEVBQUUsQ0FBa0M7SUFDcEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2pELE1BQU0sTUFBTSxHQUFHLElBQUkseUJBQWUsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQzNELE1BQU0sRUFBRSwrQkFBcUIsQ0FBQyxjQUFjLENBQUM7b0JBQzNDLE9BQU8sRUFBRSxxQ0FBMkIsQ0FBQyxRQUFRO2lCQUM5QyxDQUFDO2dCQUNGLE1BQU0sRUFBRSx5QkFBZSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUU7b0JBQzdDLGVBQWUsRUFBRSxJQUFJO2lCQUN0QixDQUFDO2dCQUNGLE9BQU8sRUFBRTtvQkFDUCx5QkFBZSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUU7d0JBQ3JDLGVBQWUsRUFBRSxJQUFJO3FCQUN0QixDQUFDO2lCQUNIO2dCQUNELHVCQUF1QixFQUFFLENBQUM7Z0JBQzFCLEdBQUcsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUc7Z0JBQ3hCLFVBQVUsRUFBRTtvQkFDVixPQUFPLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPO2lCQUNqQztnQkFDRCxhQUFh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eXJpZ2h0IDIwMjUgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqICBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTGljZW5zZVJlZi0uYW1hem9uLmNvbS4tQW16blNMLTEuMFxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBbWF6b24gU29mdHdhcmUgTGljZW5zZSAgaHR0cDovL2F3cy5hbWF6b24uY29tL2FzbC9cbiAqL1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuXG5pbXBvcnQge1xuICBDZm5BY2Nlc3NQb2xpY3ksXG4gIENmbkNvbGxlY3Rpb24sXG4gIENmblNlY3VyaXR5UG9saWN5LFxufSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzXCI7XG5pbXBvcnQgeyBkZXZDb25maWcgfSBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQge1xuICBBdXJvcmFQb3N0Z3Jlc0VuZ2luZVZlcnNpb24sXG4gIENsdXN0ZXJJbnN0YW5jZSxcbiAgRGF0YWJhc2VDbHVzdGVyLFxuICBEYXRhYmFzZUNsdXN0ZXJFbmdpbmUsXG59IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtcmRzXCI7XG5pbXBvcnQgeyBQb3J0LCBJU3VibmV0IH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1lYzJcIjtcbmltcG9ydCB7IEN1c3RvbVJlc291cmNlLCBEdXJhdGlvbiwgUmVtb3ZhbFBvbGljeSB9IGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgUHJvdmlkZXIgfSBmcm9tIFwiYXdzLWNkay1saWIvY3VzdG9tLXJlc291cmNlc1wiO1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanNcIjtcbmltcG9ydCB7IFJ1bnRpbWUgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xuaW1wb3J0IHtcbiAgQ29tcG9zaXRlUHJpbmNpcGFsLFxuICBNYW5hZ2VkUG9saWN5LFxuICBSb2xlLFxuICBTZXJ2aWNlUHJpbmNpcGFsLFxufSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSBcImNkay1uYWdcIjtcbmltcG9ydCB7IFZlY3RvckNvbmZpZyB9IGZyb20gXCIuLi8uLi90eXBlcy90eXBlXCI7XG5cbmludGVyZmFjZSBWcGNDb25maWcge1xuICB2cGM6IGNkay5hd3NfZWMyLklWcGM7XG4gIHN1Ym5ldHM6IElTdWJuZXRbXTtcbn1cblxuaW50ZXJmYWNlIFZlY3RvckRCUHJvcHMgZXh0ZW5kcyBWZWN0b3JDb25maWcge1xuICByb2xlczogc3RyaW5nW107XG4gIHZwY0NvbmZpZzogVnBjQ29uZmlnIHwgbnVsbDtcbiAgdmVjdG9yOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBWZWN0b3JEQiBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBkYjogQ2ZuQ29sbGVjdGlvbiB8IERhdGFiYXNlQ2x1c3RlcjtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFZlY3RvckRCUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgaWYgKHByb3BzLnZlY3RvciA9PT0gXCJhdXJvcmFcIiAmJiBwcm9wcy52cGNDb25maWcpIHtcbiAgICAgIGNvbnN0IGF1cm9yYSA9IG5ldyBEYXRhYmFzZUNsdXN0ZXIodGhpcywgXCJBdXJvcmFTZXJ2ZXJsZXNzXCIsIHtcbiAgICAgICAgZW5naW5lOiBEYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhUG9zdGdyZXMoe1xuICAgICAgICAgIHZlcnNpb246IEF1cm9yYVBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTZfNixcbiAgICAgICAgfSksXG4gICAgICAgIHdyaXRlcjogQ2x1c3Rlckluc3RhbmNlLnNlcnZlcmxlc3NWMihcIndyaXRlclwiLCB7XG4gICAgICAgICAgc2NhbGVXaXRoV3JpdGVyOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgcmVhZGVyczogW1xuICAgICAgICAgIENsdXN0ZXJJbnN0YW5jZS5zZXJ2ZXJsZXNzVjIoXCJyZWFkZXJcIiwge1xuICAgICAgICAgICAgc2NhbGVXaXRoV3JpdGVyOiB0cnVlLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBzZXJ2ZXJsZXNzVjJNaW5DYXBhY2l0eTogMCxcbiAgICAgICAgdnBjOiBwcm9wcy52cGNDb25maWcudnBjLFxuICAgICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgICAgc3VibmV0czogcHJvcHMudnBjQ29uZmlnLnN1Ym5ldHMsXG4gICAgICAgIH0sXG4gICAgICAgIGVuYWJsZURhdGFBcGk6IHRydWUsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgaWFtQXV0aGVudGljYXRpb246IHRydWUsXG4gICAgICAgIHN0b3JhZ2VFbmNyeXB0ZWQ6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgYXVyb3JhLmFkZFJvdGF0aW9uU2luZ2xlVXNlcigpO1xuXG4gICAgICBjb25zdCBzZXR1cEZuUm9sZSA9IG5ldyBSb2xlKHRoaXMsIGAke2lkfS1TZXR1cEZuUm9sZWAsIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgQ29tcG9zaXRlUHJpbmNpcGFsKFxuICAgICAgICAgIG5ldyBTZXJ2aWNlUHJpbmNpcGFsKFwibGFtYmRhLmFtYXpvbmF3cy5jb21cIilcbiAgICAgICAgKSxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgICBcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGVcIlxuICAgICAgICAgICksXG4gICAgICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJBV1NMYW1iZGFfRnVsbEFjY2Vzc1wiKSxcbiAgICAgICAgICBNYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICAgIFwic2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGVcIlxuICAgICAgICAgICksXG4gICAgICAgIF0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgcGdWZWN0b3JTZXR1cEZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiUGd2ZWN0b3JTZXR1cEZuXCIsIHtcbiAgICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgICAgZW50cnk6IFwiLi9sYW1iZGEvcGd2ZWN0b3IvaW5kZXgudHNcIixcbiAgICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXG4gICAgICAgIGF3c1Nka0Nvbm5lY3Rpb25SZXVzZTogZmFsc2UsXG4gICAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgUkRTX0FSTjogYXVyb3JhLmNsdXN0ZXJBcm4sXG4gICAgICAgICAgUkRTX1NFQ1JFVF9BUk46IGF1cm9yYS5zZWNyZXQhLnNlY3JldEFybixcbiAgICAgICAgfSxcbiAgICAgICAgdnBjOiBwcm9wcy52cGNDb25maWcudnBjLFxuICAgICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgICAgc3VibmV0czogcHJvcHMudnBjQ29uZmlnLnN1Ym5ldHMsXG4gICAgICAgIH0sXG4gICAgICAgIHJvbGU6IHNldHVwRm5Sb2xlLFxuICAgICAgfSk7XG4gICAgICBhdXJvcmEuc2VjcmV0IS5ncmFudFJlYWQocGdWZWN0b3JTZXR1cEZuKTtcblxuICAgICAgYXVyb3JhLmNvbm5lY3Rpb25zLmFsbG93RnJvbShcbiAgICAgICAgcGdWZWN0b3JTZXR1cEZuLFxuICAgICAgICBQb3J0LnRjcChhdXJvcmEuY2x1c3RlckVuZHBvaW50LnBvcnQpXG4gICAgICApO1xuICAgICAgYXVyb3JhLmdyYW50RGF0YUFwaUFjY2VzcyhwZ1ZlY3RvclNldHVwRm4pO1xuXG4gICAgICBjb25zdCBwcm92aWRlciA9IG5ldyBQcm92aWRlcih0aGlzLCBcIkN1c3RvbVByb3ZpZGVyXCIsIHtcbiAgICAgICAgb25FdmVudEhhbmRsZXI6IHBnVmVjdG9yU2V0dXBGbixcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBjciA9IG5ldyBDdXN0b21SZXNvdXJjZSh0aGlzLCBcIlNldHVwUGd2ZWN0b3JcIiwge1xuICAgICAgICBzZXJ2aWNlVG9rZW46IHByb3ZpZGVyLnNlcnZpY2VUb2tlbixcbiAgICAgIH0pO1xuICAgICAgY3Iubm9kZS5hZGREZXBlbmRlbmN5KGF1cm9yYSk7XG5cbiAgICAgIHRoaXMuZGIgPSBhdXJvcmE7XG5cbiAgICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhcbiAgICAgICAgW3NldHVwRm5Sb2xlXSxcbiAgICAgICAgW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1JQU00XCIsXG4gICAgICAgICAgICByZWFzb246IFwiR2l2ZW4gdGhlIGxlYXN0IHByaXZpbGVnZSB0byB0aGlzIHJvbGUgZm9yIGxhbWJkYVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLUlBTTVcIixcbiAgICAgICAgICAgIHJlYXNvbjogXCJHaXZlbiB0aGUgbGVhc3QgcHJpdmlsZWdlIHRvIHRoaXMgcm9sZSBmb3IgbGFtYmRhXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgdHJ1ZVxuICAgICAgKTtcbiAgICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhcbiAgICAgICAgW3Byb3ZpZGVyXSxcbiAgICAgICAgW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1JQU00XCIsXG4gICAgICAgICAgICByZWFzb246IFwiVGhlIHJvbGUgY3JlYXRlZCBhdXRvbWF0aWNhbGx5IGJ5IENES1wiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLUlBTTVcIixcbiAgICAgICAgICAgIHJlYXNvbjogXCJUaGUgcm9sZSBjcmVhdGVkIGF1dG9tYXRpY2FsbHkgYnkgQ0RLXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtTDFcIixcbiAgICAgICAgICAgIHJlYXNvbjogXCJUaGUgcm9sZSBjcmVhdGVkIGF1dG9tYXRpY2FsbHkgYnkgQ0RLXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgdHJ1ZVxuICAgICAgKTtcbiAgICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhcbiAgICAgICAgW2F1cm9yYV0sXG4gICAgICAgIFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtUkRTMTBcIixcbiAgICAgICAgICAgIHJlYXNvbjpcbiAgICAgICAgICAgICAgXCJEaXNhYmxlIGZvciBQb0MuIFlvdSBzaG91bGQgZW5hYmxlIGl0IGlmIGRlcGxveWluZyB0aGUgYXBwIGluIHByb2R1Y3Rpb24gZW52aXJvbm1lbnRcIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB0cnVlXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhb3NzID0gbmV3IENmbkNvbGxlY3Rpb24odGhpcywgXCJBb3NzXCIsIHtcbiAgICAgICAgdHlwZTogXCJWRUNUT1JTRUFSQ0hcIixcbiAgICAgICAgbmFtZTogYCR7ZGV2Q29uZmlnLnVzZXJOYW1lfS0ke3Byb3BzLmNvbGxlY3Rpb25OYW1lfWAsXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgYW9zc0VuY3J5cHRpb25Qb2xpY3kgPSBuZXcgQ2ZuU2VjdXJpdHlQb2xpY3koXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiQW9zc0VuY3J5cHRpb25Qb2xpY3lcIixcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6IFwiZW5jcnlwdGlvblwiLFxuICAgICAgICAgIG5hbWU6IGAke2RldkNvbmZpZy51c2VyTmFtZX0tZW5jcnlwdGlvbi1wb2xpY3lgLFxuICAgICAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgUnVsZXM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFJlc291cmNlVHlwZTogXCJjb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgUmVzb3VyY2U6IFtcbiAgICAgICAgICAgICAgICAgIGBjb2xsZWN0aW9uLyR7ZGV2Q29uZmlnLnVzZXJOYW1lfS0ke3Byb3BzLmNvbGxlY3Rpb25OYW1lfWAsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBBV1NPd25lZEtleTogdHJ1ZSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICAgIGFvc3MuYWRkRGVwZW5kZW5jeShhb3NzRW5jcnlwdGlvblBvbGljeSk7XG5cbiAgICAgIG5ldyBDZm5TZWN1cml0eVBvbGljeSh0aGlzLCBcIkFvc3NOZXR3b3JrUG9saWN5XCIsIHtcbiAgICAgICAgbmFtZTogYCR7ZGV2Q29uZmlnLnVzZXJOYW1lfS1uZXR3b3JrLXBvbGljeWAsXG4gICAgICAgIHR5cGU6IFwibmV0d29ya1wiLFxuICAgICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBSdWxlczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiBcImNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICBSZXNvdXJjZTogW1xuICAgICAgICAgICAgICAgICAgYGNvbGxlY3Rpb24vJHtkZXZDb25maWcudXNlck5hbWV9LSR7cHJvcHMuY29sbGVjdGlvbk5hbWV9YCxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiBcImRhc2hib2FyZFwiLFxuICAgICAgICAgICAgICAgIFJlc291cmNlOiBbXG4gICAgICAgICAgICAgICAgICBgY29sbGVjdGlvbi8ke2RldkNvbmZpZy51c2VyTmFtZX0tJHtwcm9wcy5jb2xsZWN0aW9uTmFtZX1gLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgQWxsb3dGcm9tUHVibGljOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0pLFxuICAgICAgfSk7XG4gICAgICBuZXcgQ2ZuQWNjZXNzUG9saWN5KHRoaXMsIFwiQW9zc0FjY2Vzc1BvbGljeVwiLCB7XG4gICAgICAgIG5hbWU6IGAke2RldkNvbmZpZy51c2VyTmFtZX0tYWNjZXNzLXBvbGljeWAsXG4gICAgICAgIHR5cGU6IFwiZGF0YVwiLFxuICAgICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBSdWxlczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiBcImluZGV4XCIsXG4gICAgICAgICAgICAgICAgUmVzb3VyY2U6IFtcbiAgICAgICAgICAgICAgICAgIGBpbmRleC8ke2RldkNvbmZpZy51c2VyTmFtZX0tJHtwcm9wcy5jb2xsZWN0aW9uTmFtZX0vKmAsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBQZXJtaXNzaW9uOiBbXCJhb3NzOipcIl0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBSZXNvdXJjZVR5cGU6IFwiY29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFJlc291cmNlOiBbXG4gICAgICAgICAgICAgICAgICBgY29sbGVjdGlvbi8ke2RldkNvbmZpZy51c2VyTmFtZX0tJHtwcm9wcy5jb2xsZWN0aW9uTmFtZX1gLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgUGVybWlzc2lvbjogW1wiYW9zczoqXCJdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFByaW5jaXBhbDogcHJvcHMucm9sZXMsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSksXG4gICAgICB9KTtcbiAgICAgIHRoaXMuZGIgPSBhb3NzO1xuICAgIH1cbiAgfVxufVxuIl19