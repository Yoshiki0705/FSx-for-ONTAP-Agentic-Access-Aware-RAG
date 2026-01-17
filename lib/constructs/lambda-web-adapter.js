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
exports.LambdaWebAdapter = void 0;
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const repository_1 = require("./repository");
const aws_cloudfront_1 = require("aws-cdk-lib/aws-cloudfront");
const aws_cloudfront_origins_1 = require("aws-cdk-lib/aws-cloudfront-origins");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const cdk_nag_1 = require("cdk-nag");
const aws_s3_1 = require("aws-cdk-lib/aws-s3");
const config_1 = require("../../config");
class LambdaWebAdapter extends constructs_1.Construct {
    lambda;
    constructor(scope, id, props) {
        super(scope, id);
        const chatAppRepository = new repository_1.ECR(this, "ecr", {
            path: `${props.imagePath}/nextjs`,
            tag: props.tag,
        });
        const lambda = new aws_lambda_1.DockerImageFunction(this, "lambda", {
            code: aws_lambda_1.DockerImageCode.fromEcr(chatAppRepository.repository, {
                tagOrDigest: props.tag,
            }),
            architecture: aws_lambda_1.Architecture.X86_64,
            memorySize: 2048,
            timeout: cdk.Duration.minutes(5),
            environment: {
                // Server-side environment variables
                USER_POOL_ID: props.cognito.userPoolId,
                USER_POOL_CLIENT_ID: props.cognito.userPoolClientId,
                IDENTITY_ID: props.cognito.identityPoolId,
                TABLE_NAME: props.db.tableName,
                // Client-side environment variables (NEXT_PUBLIC_ prefix)
                NEXT_PUBLIC_USER_POOL_ID: props.cognito.userPoolId,
                NEXT_PUBLIC_USER_POOL_CLIENT_ID: props.cognito.userPoolClientId,
                NEXT_PUBLIC_AWS_REGION: "us-east-1",
            },
            // vpc: props.vpcConfig.vpc,
            // vpcSubnets: {subnets: props.vpcConfig.subnets}
        });
        this.lambda = lambda;
        lambda.role?.addToPrincipalPolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
            ],
            resources: [
                "arn:aws:bedrock:*:*:foundation-model/*",
                "arn:aws:bedrock:*:*:inference-profile/*",
            ],
        }));
        lambda.addToRolePolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: [
                "dynamodb:ListTables",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
            ],
            resources: [props.db.tableArn],
        }));
        if (props.vpcConfig && props.vpcConfig.vpc) {
            lambda.role.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"));
        }
        if (config_1.devConfig.databaseConfig.userAccessTable) {
            const userAccessTable = aws_dynamodb_1.TableV2.fromTableName(this, "UserAccessTable", config_1.devConfig.databaseConfig.userAccessTable);
            userAccessTable.grantReadData(lambda);
            lambda.addEnvironment("USER_ACCESS_TABLE_NAME", config_1.devConfig.databaseConfig.userAccessTable);
        }
        lambda.node.addDependency(chatAppRepository);
        const functionUrl = lambda.addFunctionUrl({
            authType: aws_lambda_1.FunctionUrlAuthType.NONE,
            cors: {
                allowedMethods: [aws_lambda_1.HttpMethod.ALL],
                allowedOrigins: ["*"],
            },
            invokeMode: aws_lambda_1.InvokeMode.RESPONSE_STREAM,
        });
        const accessLoggingBucket = new aws_s3_1.Bucket(this, "AccessLogBucket", {
            blockPublicAccess: aws_s3_1.BlockPublicAccess.BLOCK_ALL,
            encryption: aws_s3_1.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            autoDeleteObjects: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            versioned: false,
            objectOwnership: aws_s3_1.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        });
        const distribution = new aws_cloudfront_1.Distribution(this, "cloudfront", {
            webAclId: props.wafAttrArn,
            enableIpv6: false,
            // geoRestriction: GeoRestriction.allowlist("JP"), // Uncomment to restrict access to Japan only
            enableLogging: true,
            logBucket: accessLoggingBucket,
            minimumProtocolVersion: aws_cloudfront_1.SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: {
                origin: new aws_cloudfront_origins_1.FunctionUrlOrigin(functionUrl, {
                    readTimeout: cdk.Duration.seconds(60),
                }),
                viewerProtocolPolicy: aws_cloudfront_1.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                originRequestPolicy: aws_cloudfront_1.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                allowedMethods: aws_cloudfront_1.AllowedMethods.ALLOW_ALL,
                cachePolicy: aws_cloudfront_1.CachePolicy.CACHING_DISABLED,
                responseHeadersPolicy: aws_cloudfront_1.ResponseHeadersPolicy.SECURITY_HEADERS,
                ...(props.edgeFnVersion ? {
                    edgeLambdas: [
                        {
                            eventType: aws_cloudfront_1.LambdaEdgeEventType.ORIGIN_REQUEST,
                            functionVersion: props.edgeFnVersion,
                            includeBody: true,
                        },
                    ],
                } : {}),
            },
        });
        const oac = new aws_cloudfront_1.CfnOriginAccessControl(this, "oac", {
            originAccessControlConfig: {
                name: config_1.devConfig.userName,
                originAccessControlOriginType: "lambda",
                signingBehavior: "always",
                signingProtocol: "sigv4",
            },
        });
        const cfnDistribution = distribution.node.defaultChild;
        cfnDistribution.addPropertyOverride("DistributionConfig.Origins.0.OriginAccessControlId", oac.attrId);
        lambda.addPermission("CloudFrontLambdaIntegration", {
            principal: new aws_iam_1.ServicePrincipal("cloudfront.amazonaws.com"),
            action: "lambda:InvokeFunctionUrl",
            sourceArn: `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${distribution.distributionId}`,
        });
        new cdk.CfnOutput(this, "url", {
            value: `https://${distribution.domainName}`,
        });
        cdk_nag_1.NagSuppressions.addResourceSuppressions([lambda.role, distribution, accessLoggingBucket], [
            {
                id: "AwsSolutions-IAM4",
                reason: "Given the least privilege to this role for lambda",
            },
            {
                id: "AwsSolutions-IAM5",
                reason: "Given the least privilege to this role for lambda",
            },
            {
                id: "AwsSolutions-CFR4",
                reason: "Added SecurityPolicyProtocol.TLS_V1_2_2021 to CF",
            },
            {
                id: "AwsSolutions-S1",
                reason: "This bucket is the access logging bucket",
            },
        ], true);
    }
}
exports.LambdaWebAdapter = LambdaWebAdapter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXdlYi1hZGFwdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXdlYi1hZGFwdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7R0FJRztBQUNILDJDQUF1QztBQUN2QyxpREFBbUM7QUFFbkMsdURBU2dDO0FBRWhDLDZDQUFtQztBQUNuQywrREFZb0M7QUFDcEMsK0VBQXVFO0FBQ3ZFLGlEQUs2QjtBQUU3QiwyREFBbUQ7QUFDbkQscUNBQTBDO0FBQzFDLCtDQUs0QjtBQUc1Qix5Q0FBeUM7QUFlekMsTUFBYSxnQkFBaUIsU0FBUSxzQkFBUztJQUM3QixNQUFNLENBQVc7SUFDakMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxnQkFBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDN0MsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLFNBQVMsU0FBUztZQUNqQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7U0FDZixDQUFDLENBQUM7UUFFSCxNQUFNLE1BQU0sR0FBRyxJQUFJLGdDQUFtQixDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDckQsSUFBSSxFQUFFLDRCQUFlLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRTtnQkFDMUQsV0FBVyxFQUFFLEtBQUssQ0FBQyxHQUFHO2FBQ3ZCLENBQUM7WUFDRixZQUFZLEVBQUUseUJBQVksQ0FBQyxNQUFNO1lBQ2pDLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDaEMsV0FBVyxFQUFFO2dCQUNYLG9DQUFvQztnQkFDcEMsWUFBWSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVTtnQkFDdEMsbUJBQW1CLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0I7Z0JBQ25ELFdBQVcsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLGNBQWM7Z0JBQ3pDLFVBQVUsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLFNBQVM7Z0JBQzlCLDBEQUEwRDtnQkFDMUQsd0JBQXdCLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVO2dCQUNsRCwrQkFBK0IsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLGdCQUFnQjtnQkFDL0Qsc0JBQXNCLEVBQUUsV0FBVzthQUNwQztZQUNELDRCQUE0QjtZQUM1QixpREFBaUQ7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFckIsTUFBTSxDQUFDLElBQUksRUFBRSxvQkFBb0IsQ0FDL0IsSUFBSSx5QkFBZSxDQUFDO1lBQ2xCLE1BQU0sRUFBRSxnQkFBTSxDQUFDLEtBQUs7WUFDcEIsT0FBTyxFQUFFO2dCQUNQLHFCQUFxQjtnQkFDckIsdUNBQXVDO2FBQ3hDO1lBQ0QsU0FBUyxFQUFFO2dCQUNULHdDQUF3QztnQkFDeEMseUNBQXlDO2FBQzFDO1NBQ0YsQ0FBQyxDQUNILENBQUM7UUFDRixNQUFNLENBQUMsZUFBZSxDQUNwQixJQUFJLHlCQUFlLENBQUM7WUFDbEIsTUFBTSxFQUFFLGdCQUFNLENBQUMsS0FBSztZQUNwQixPQUFPLEVBQUU7Z0JBQ1AscUJBQXFCO2dCQUNyQixrQkFBa0I7Z0JBQ2xCLGtCQUFrQjtnQkFDbEIscUJBQXFCO2FBQ3RCO1lBQ0QsU0FBUyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDL0IsQ0FBQyxDQUNILENBQUM7UUFDRixJQUFJLEtBQUssQ0FBQyxTQUFTLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUMzQyxNQUFNLENBQUMsSUFBSyxDQUFDLGdCQUFnQixDQUMzQix1QkFBYSxDQUFDLHdCQUF3QixDQUNwQyw4Q0FBOEMsQ0FDL0MsQ0FDRixDQUFDO1FBQ0osQ0FBQztRQUNELElBQUksa0JBQVMsQ0FBQyxjQUFjLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDN0MsTUFBTSxlQUFlLEdBQUcsc0JBQU8sQ0FBQyxhQUFhLENBQzNDLElBQUksRUFDSixpQkFBaUIsRUFDakIsa0JBQVMsQ0FBQyxjQUFjLENBQUMsZUFBZ0IsQ0FDMUMsQ0FBQztZQUNGLGVBQWUsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEMsTUFBTSxDQUFDLGNBQWMsQ0FDbkIsd0JBQXdCLEVBQ3hCLGtCQUFTLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FDekMsQ0FBQztRQUNKLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRTdDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxjQUFjLENBQUM7WUFDeEMsUUFBUSxFQUFFLGdDQUFtQixDQUFDLElBQUk7WUFDbEMsSUFBSSxFQUFFO2dCQUNKLGNBQWMsRUFBRSxDQUFDLHVCQUFVLENBQUMsR0FBRyxDQUFDO2dCQUNoQyxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7YUFDdEI7WUFDRCxVQUFVLEVBQUUsdUJBQVUsQ0FBQyxlQUFlO1NBQ3ZDLENBQUMsQ0FBQztRQUVILE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFNLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzlELGlCQUFpQixFQUFFLDBCQUFpQixDQUFDLFNBQVM7WUFDOUMsVUFBVSxFQUFFLHlCQUFnQixDQUFDLFVBQVU7WUFDdkMsVUFBVSxFQUFFLElBQUk7WUFDaEIsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLFNBQVMsRUFBRSxLQUFLO1lBQ2hCLGVBQWUsRUFBRSx3QkFBZSxDQUFDLHNCQUFzQjtTQUN4RCxDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLDZCQUFZLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN4RCxRQUFRLEVBQUUsS0FBSyxDQUFDLFVBQVU7WUFDMUIsVUFBVSxFQUFFLEtBQUs7WUFDakIsZ0dBQWdHO1lBQ2hHLGFBQWEsRUFBRSxJQUFJO1lBQ25CLFNBQVMsRUFBRSxtQkFBbUI7WUFDOUIsc0JBQXNCLEVBQUUsdUNBQXNCLENBQUMsYUFBYTtZQUM1RCxlQUFlLEVBQUU7Z0JBQ2YsTUFBTSxFQUFFLElBQUksMENBQWlCLENBQUMsV0FBVyxFQUFFO29CQUMzQyxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2lCQUN0QyxDQUFDO2dCQUNBLG9CQUFvQixFQUFFLHFDQUFvQixDQUFDLGlCQUFpQjtnQkFDNUQsbUJBQW1CLEVBQUUsb0NBQW1CLENBQUMsNkJBQTZCO2dCQUN0RSxjQUFjLEVBQUUsK0JBQWMsQ0FBQyxTQUFTO2dCQUN4QyxXQUFXLEVBQUUsNEJBQVcsQ0FBQyxnQkFBZ0I7Z0JBQ3pDLHFCQUFxQixFQUFFLHNDQUFxQixDQUFDLGdCQUFnQjtnQkFDN0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO29CQUN4QixXQUFXLEVBQUU7d0JBQ1g7NEJBQ0UsU0FBUyxFQUFFLG9DQUFtQixDQUFDLGNBQWM7NEJBQzdDLGVBQWUsRUFBRSxLQUFLLENBQUMsYUFBYTs0QkFDcEMsV0FBVyxFQUFFLElBQUk7eUJBQ2xCO3FCQUNGO2lCQUNGLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUNSO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSx1Q0FBc0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO1lBQ2xELHlCQUF5QixFQUFFO2dCQUN6QixJQUFJLEVBQUUsa0JBQVMsQ0FBQyxRQUFRO2dCQUN4Qiw2QkFBNkIsRUFBRSxRQUFRO2dCQUN2QyxlQUFlLEVBQUUsUUFBUTtnQkFDekIsZUFBZSxFQUFFLE9BQU87YUFDekI7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLGVBQWUsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQStCLENBQUM7UUFDMUUsZUFBZSxDQUFDLG1CQUFtQixDQUNqQyxvREFBb0QsRUFDcEQsR0FBRyxDQUFDLE1BQU0sQ0FDWCxDQUFDO1FBRUYsTUFBTSxDQUFDLGFBQWEsQ0FBQyw2QkFBNkIsRUFBRTtZQUNsRCxTQUFTLEVBQUUsSUFBSSwwQkFBZ0IsQ0FBQywwQkFBMEIsQ0FBQztZQUMzRCxNQUFNLEVBQUUsMEJBQTBCO1lBQ2xDLFNBQVMsRUFBRSx1QkFDVCxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUNyQixpQkFBaUIsWUFBWSxDQUFDLGNBQWMsRUFBRTtTQUMvQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtZQUM3QixLQUFLLEVBQUUsV0FBVyxZQUFZLENBQUMsVUFBVSxFQUFFO1NBQzVDLENBQUMsQ0FBQztRQUVILHlCQUFlLENBQUMsdUJBQXVCLENBQ3JDLENBQUMsTUFBTSxDQUFDLElBQUssRUFBRSxZQUFZLEVBQUUsbUJBQW1CLENBQUMsRUFDakQ7WUFDRTtnQkFDRSxFQUFFLEVBQUUsbUJBQW1CO2dCQUN2QixNQUFNLEVBQUUsbURBQW1EO2FBQzVEO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLG1CQUFtQjtnQkFDdkIsTUFBTSxFQUFFLG1EQUFtRDthQUM1RDtZQUNEO2dCQUNFLEVBQUUsRUFBRSxtQkFBbUI7Z0JBQ3ZCLE1BQU0sRUFBRSxrREFBa0Q7YUFDM0Q7WUFDRDtnQkFDRSxFQUFFLEVBQUUsaUJBQWlCO2dCQUNyQixNQUFNLEVBQUUsMENBQTBDO2FBQ25EO1NBQ0YsRUFDRCxJQUFJLENBQ0wsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWpMRCw0Q0FpTEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogIENvcHlyaWdodCAyMDI1IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiAgU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IExpY2Vuc2VSZWYtLmFtYXpvbi5jb20uLUFtem5TTC0xLjBcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQW1hem9uIFNvZnR3YXJlIExpY2Vuc2UgIGh0dHA6Ly9hd3MuYW1hem9uLmNvbS9hc2wvXG4gKi9cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XG5cbmltcG9ydCB7XG4gIEFyY2hpdGVjdHVyZSxcbiAgRG9ja2VySW1hZ2VDb2RlLFxuICBEb2NrZXJJbWFnZUZ1bmN0aW9uLFxuICBGdW5jdGlvbixcbiAgRnVuY3Rpb25VcmxBdXRoVHlwZSxcbiAgSHR0cE1ldGhvZCxcbiAgSW52b2tlTW9kZSxcbiAgVmVyc2lvbiwgSVZlcnNpb24sXG59IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgeyBJU3VibmV0LCBTdWJuZXQsIFZwYyB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWMyXCI7XG5pbXBvcnQgeyBFQ1IgfSBmcm9tIFwiLi9yZXBvc2l0b3J5XCI7XG5pbXBvcnQge1xuICBBbGxvd2VkTWV0aG9kcyxcbiAgQ2FjaGVQb2xpY3ksXG4gIENmbkRpc3RyaWJ1dGlvbixcbiAgQ2ZuT3JpZ2luQWNjZXNzQ29udHJvbCxcbiAgRGlzdHJpYnV0aW9uLFxuICBHZW9SZXN0cmljdGlvbixcbiAgTGFtYmRhRWRnZUV2ZW50VHlwZSxcbiAgT3JpZ2luUmVxdWVzdFBvbGljeSxcbiAgUmVzcG9uc2VIZWFkZXJzUG9saWN5LFxuICBTZWN1cml0eVBvbGljeVByb3RvY29sLFxuICBWaWV3ZXJQcm90b2NvbFBvbGljeSxcbn0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1jbG91ZGZyb250XCI7XG5pbXBvcnQgeyBGdW5jdGlvblVybE9yaWdpbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zXCI7XG5pbXBvcnQge1xuICBFZmZlY3QsXG4gIE1hbmFnZWRQb2xpY3ksXG4gIFBvbGljeVN0YXRlbWVudCxcbiAgU2VydmljZVByaW5jaXBhbCxcbn0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcblxuaW1wb3J0IHsgVGFibGVWMiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGJcIjtcbmltcG9ydCB7IE5hZ1N1cHByZXNzaW9ucyB9IGZyb20gXCJjZGstbmFnXCI7XG5pbXBvcnQge1xuICBCbG9ja1B1YmxpY0FjY2VzcyxcbiAgQnVja2V0LFxuICBCdWNrZXRFbmNyeXB0aW9uLFxuICBPYmplY3RPd25lcnNoaXAsXG59IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcbmltcG9ydCB7IENvZ25pdG9QYXJhbXMgfSBmcm9tIFwiLi9hdXRoXCI7XG5pbXBvcnQgeyBDaGF0QXBwQ29uZmlnIH0gZnJvbSBcIi4uLy4uL3R5cGVzL3R5cGVcIjtcbmltcG9ydCB7IGRldkNvbmZpZyB9IGZyb20gXCIuLi8uLi9jb25maWdcIjtcblxuaW50ZXJmYWNlIFZwY0NvbmZpZyB7XG4gIHZwYzogY2RrLmF3c19lYzIuSVZwYztcbiAgc3VibmV0czogSVN1Ym5ldFtdO1xufVxuXG5pbnRlcmZhY2UgTGFtYmRhV2ViQWRhcHRlclByb3BzIGV4dGVuZHMgQ2hhdEFwcENvbmZpZyB7XG4gIHdhZkF0dHJBcm4/OiBzdHJpbmc7XG4gIGVkZ2VGblZlcnNpb24/OiBJVmVyc2lvbjtcbiAgZGI6IFRhYmxlVjI7XG4gIGNvZ25pdG86IENvZ25pdG9QYXJhbXM7XG4gIHZwY0NvbmZpZzogVnBjQ29uZmlnIHwgbnVsbDtcbn1cblxuZXhwb3J0IGNsYXNzIExhbWJkYVdlYkFkYXB0ZXIgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgbGFtYmRhOiBGdW5jdGlvbjtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IExhbWJkYVdlYkFkYXB0ZXJQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCBjaGF0QXBwUmVwb3NpdG9yeSA9IG5ldyBFQ1IodGhpcywgXCJlY3JcIiwge1xuICAgICAgcGF0aDogYCR7cHJvcHMuaW1hZ2VQYXRofS9uZXh0anNgLFxuICAgICAgdGFnOiBwcm9wcy50YWcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsYW1iZGEgPSBuZXcgRG9ja2VySW1hZ2VGdW5jdGlvbih0aGlzLCBcImxhbWJkYVwiLCB7XG4gICAgICBjb2RlOiBEb2NrZXJJbWFnZUNvZGUuZnJvbUVjcihjaGF0QXBwUmVwb3NpdG9yeS5yZXBvc2l0b3J5LCB7XG4gICAgICAgIHRhZ09yRGlnZXN0OiBwcm9wcy50YWcsXG4gICAgICB9KSxcbiAgICAgIGFyY2hpdGVjdHVyZTogQXJjaGl0ZWN0dXJlLlg4Nl82NCxcbiAgICAgIG1lbW9yeVNpemU6IDIwNDgsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC8vIFNlcnZlci1zaWRlIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgICAgICBVU0VSX1BPT0xfSUQ6IHByb3BzLmNvZ25pdG8udXNlclBvb2xJZCxcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogcHJvcHMuY29nbml0by51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBJREVOVElUWV9JRDogcHJvcHMuY29nbml0by5pZGVudGl0eVBvb2xJZCxcbiAgICAgICAgVEFCTEVfTkFNRTogcHJvcHMuZGIudGFibGVOYW1lLFxuICAgICAgICAvLyBDbGllbnQtc2lkZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgKE5FWFRfUFVCTElDXyBwcmVmaXgpXG4gICAgICAgIE5FWFRfUFVCTElDX1VTRVJfUE9PTF9JRDogcHJvcHMuY29nbml0by51c2VyUG9vbElkLFxuICAgICAgICBORVhUX1BVQkxJQ19VU0VSX1BPT0xfQ0xJRU5UX0lEOiBwcm9wcy5jb2duaXRvLnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIE5FWFRfUFVCTElDX0FXU19SRUdJT046IFwidXMtZWFzdC0xXCIsXG4gICAgICB9LFxuICAgICAgLy8gdnBjOiBwcm9wcy52cGNDb25maWcudnBjLFxuICAgICAgLy8gdnBjU3VibmV0czoge3N1Ym5ldHM6IHByb3BzLnZwY0NvbmZpZy5zdWJuZXRzfVxuICAgIH0pO1xuXG4gICAgdGhpcy5sYW1iZGEgPSBsYW1iZGE7XG5cbiAgICBsYW1iZGEucm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3koXG4gICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImJlZHJvY2s6SW52b2tlTW9kZWxcIixcbiAgICAgICAgICBcImJlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW1cIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgXCJhcm46YXdzOmJlZHJvY2s6KjoqOmZvdW5kYXRpb24tbW9kZWwvKlwiLFxuICAgICAgICAgIFwiYXJuOmF3czpiZWRyb2NrOio6KjppbmZlcmVuY2UtcHJvZmlsZS8qXCIsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG4gICAgbGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiZHluYW1vZGI6TGlzdFRhYmxlc1wiLFxuICAgICAgICAgIFwiZHluYW1vZGI6R2V0SXRlbVwiLFxuICAgICAgICAgIFwiZHluYW1vZGI6UHV0SXRlbVwiLFxuICAgICAgICAgIFwiZHluYW1vZGI6VXBkYXRlSXRlbVwiLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtwcm9wcy5kYi50YWJsZUFybl0sXG4gICAgICB9KVxuICAgICk7XG4gICAgaWYgKHByb3BzLnZwY0NvbmZpZyAmJiBwcm9wcy52cGNDb25maWcudnBjKSB7XG4gICAgICBsYW1iZGEucm9sZSEuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhVlBDQWNjZXNzRXhlY3V0aW9uUm9sZVwiXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChkZXZDb25maWcuZGF0YWJhc2VDb25maWcudXNlckFjY2Vzc1RhYmxlKSB7XG4gICAgICBjb25zdCB1c2VyQWNjZXNzVGFibGUgPSBUYWJsZVYyLmZyb21UYWJsZU5hbWUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiVXNlckFjY2Vzc1RhYmxlXCIsXG4gICAgICAgIGRldkNvbmZpZy5kYXRhYmFzZUNvbmZpZy51c2VyQWNjZXNzVGFibGUhXG4gICAgICApO1xuICAgICAgdXNlckFjY2Vzc1RhYmxlLmdyYW50UmVhZERhdGEobGFtYmRhKTtcbiAgICAgIGxhbWJkYS5hZGRFbnZpcm9ubWVudChcbiAgICAgICAgXCJVU0VSX0FDQ0VTU19UQUJMRV9OQU1FXCIsXG4gICAgICAgIGRldkNvbmZpZy5kYXRhYmFzZUNvbmZpZy51c2VyQWNjZXNzVGFibGVcbiAgICAgICk7XG4gICAgfVxuICAgIGxhbWJkYS5ub2RlLmFkZERlcGVuZGVuY3koY2hhdEFwcFJlcG9zaXRvcnkpO1xuXG4gICAgY29uc3QgZnVuY3Rpb25VcmwgPSBsYW1iZGEuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IEZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtIdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbXCIqXCJdLFxuICAgICAgfSxcbiAgICAgIGludm9rZU1vZGU6IEludm9rZU1vZGUuUkVTUE9OU0VfU1RSRUFNLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYWNjZXNzTG9nZ2luZ0J1Y2tldCA9IG5ldyBCdWNrZXQodGhpcywgXCJBY2Nlc3NMb2dCdWNrZXRcIiwge1xuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IEJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIGVuY3J5cHRpb246IEJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGVuZm9yY2VTU0w6IHRydWUsXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgICAgb2JqZWN0T3duZXJzaGlwOiBPYmplY3RPd25lcnNoaXAuQlVDS0VUX09XTkVSX1BSRUZFUlJFRCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBEaXN0cmlidXRpb24odGhpcywgXCJjbG91ZGZyb250XCIsIHtcbiAgICAgIHdlYkFjbElkOiBwcm9wcy53YWZBdHRyQXJuLFxuICAgICAgZW5hYmxlSXB2NjogZmFsc2UsXG4gICAgICAvLyBnZW9SZXN0cmljdGlvbjogR2VvUmVzdHJpY3Rpb24uYWxsb3dsaXN0KFwiSlBcIiksIC8vIFVuY29tbWVudCB0byByZXN0cmljdCBhY2Nlc3MgdG8gSmFwYW4gb25seVxuICAgICAgZW5hYmxlTG9nZ2luZzogdHJ1ZSxcbiAgICAgIGxvZ0J1Y2tldDogYWNjZXNzTG9nZ2luZ0J1Y2tldCxcbiAgICAgIG1pbmltdW1Qcm90b2NvbFZlcnNpb246IFNlY3VyaXR5UG9saWN5UHJvdG9jb2wuVExTX1YxXzJfMjAyMSxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBGdW5jdGlvblVybE9yaWdpbihmdW5jdGlvblVybCwge1xuICAgICAgICByZWFkVGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgfSksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBWaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IEFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgY2FjaGVQb2xpY3k6IENhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogUmVzcG9uc2VIZWFkZXJzUG9saWN5LlNFQ1VSSVRZX0hFQURFUlMsXG4gICAgICAgIC4uLihwcm9wcy5lZGdlRm5WZXJzaW9uID8ge1xuICAgICAgICAgIGVkZ2VMYW1iZGFzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGV2ZW50VHlwZTogTGFtYmRhRWRnZUV2ZW50VHlwZS5PUklHSU5fUkVRVUVTVCxcbiAgICAgICAgICAgICAgZnVuY3Rpb25WZXJzaW9uOiBwcm9wcy5lZGdlRm5WZXJzaW9uLFxuICAgICAgICAgICAgICBpbmNsdWRlQm9keTogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBvYWMgPSBuZXcgQ2ZuT3JpZ2luQWNjZXNzQ29udHJvbCh0aGlzLCBcIm9hY1wiLCB7XG4gICAgICBvcmlnaW5BY2Nlc3NDb250cm9sQ29uZmlnOiB7XG4gICAgICAgIG5hbWU6IGRldkNvbmZpZy51c2VyTmFtZSxcbiAgICAgICAgb3JpZ2luQWNjZXNzQ29udHJvbE9yaWdpblR5cGU6IFwibGFtYmRhXCIsXG4gICAgICAgIHNpZ25pbmdCZWhhdmlvcjogXCJhbHdheXNcIixcbiAgICAgICAgc2lnbmluZ1Byb3RvY29sOiBcInNpZ3Y0XCIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2ZuRGlzdHJpYnV0aW9uID0gZGlzdHJpYnV0aW9uLm5vZGUuZGVmYXVsdENoaWxkIGFzIENmbkRpc3RyaWJ1dGlvbjtcbiAgICBjZm5EaXN0cmlidXRpb24uYWRkUHJvcGVydHlPdmVycmlkZShcbiAgICAgIFwiRGlzdHJpYnV0aW9uQ29uZmlnLk9yaWdpbnMuMC5PcmlnaW5BY2Nlc3NDb250cm9sSWRcIixcbiAgICAgIG9hYy5hdHRySWRcbiAgICApO1xuXG4gICAgbGFtYmRhLmFkZFBlcm1pc3Npb24oXCJDbG91ZEZyb250TGFtYmRhSW50ZWdyYXRpb25cIiwge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgU2VydmljZVByaW5jaXBhbChcImNsb3VkZnJvbnQuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgIGFjdGlvbjogXCJsYW1iZGE6SW52b2tlRnVuY3Rpb25VcmxcIixcbiAgICAgIHNvdXJjZUFybjogYGFybjphd3M6Y2xvdWRmcm9udDo6JHtcbiAgICAgICAgY2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnRcbiAgICAgIH06ZGlzdHJpYnV0aW9uLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcInVybFwiLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZG9tYWluTmFtZX1gLFxuICAgIH0pO1xuXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKFxuICAgICAgW2xhbWJkYS5yb2xlISwgZGlzdHJpYnV0aW9uLCBhY2Nlc3NMb2dnaW5nQnVja2V0XSxcbiAgICAgIFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1JQU00XCIsXG4gICAgICAgICAgcmVhc29uOiBcIkdpdmVuIHRoZSBsZWFzdCBwcml2aWxlZ2UgdG8gdGhpcyByb2xlIGZvciBsYW1iZGFcIixcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1JQU01XCIsXG4gICAgICAgICAgcmVhc29uOiBcIkdpdmVuIHRoZSBsZWFzdCBwcml2aWxlZ2UgdG8gdGhpcyByb2xlIGZvciBsYW1iZGFcIixcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1DRlI0XCIsXG4gICAgICAgICAgcmVhc29uOiBcIkFkZGVkIFNlY3VyaXR5UG9saWN5UHJvdG9jb2wuVExTX1YxXzJfMjAyMSB0byBDRlwiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLVMxXCIsXG4gICAgICAgICAgcmVhc29uOiBcIlRoaXMgYnVja2V0IGlzIHRoZSBhY2Nlc3MgbG9nZ2luZyBidWNrZXRcIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICB0cnVlXG4gICAgKTtcbiAgfVxufVxuIl19