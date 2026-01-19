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
exports.Api = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const aws_apigateway_1 = require("aws-cdk-lib/aws-apigateway");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const constructs_1 = require("constructs");
const repository_1 = require("./repository");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const cdk_nag_1 = require("cdk-nag");
const aws_logs_1 = require("aws-cdk-lib/aws-logs");
class Api extends constructs_1.Construct {
    restApi;
    lambda;
    constructor(scope, id, props) {
        super(scope, id);
        const lambdaRepository = new repository_1.ECR(this, "ecr", {
            path: `${props.imagePath}/lambda`,
            tag: props.tag,
        });
        this.lambda = new aws_lambda_1.DockerImageFunction(this, "lambda", {
            code: aws_lambda_1.DockerImageCode.fromEcr(lambdaRepository.repository, {
                tagOrDigest: props.tag,
            }),
            architecture: aws_lambda_1.Architecture.ARM_64,
            memorySize: 2048,
            timeout: cdk.Duration.minutes(5),
            environment: {
                COLLECTION_NAME: props.collectionName,
            },
        });
        this.lambda.node.addDependency(lambdaRepository);
        this.lambda.addToRolePolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: [
                "bedrock:GetFoundationModel",
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
            ],
            resources: [
                cdk.Stack.of(this).region === "us-east-1"
                    ? `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`
                    : `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`,
                "arn:aws:bedrock:us-east-1::foundation-model/*",
            ],
        }));
        this.lambda.addToRolePolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: [
                "dynamodb:ListTables",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
            ],
            resources: [props.db.tableArn],
        }));
        const accessLogGroup = new aws_logs_1.LogGroup(this, "AccessLog");
        this.restApi = new aws_apigateway_1.LambdaRestApi(this, "LambdaRestApi", {
            handler: this.lambda,
            cloudWatchRole: true,
            cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY,
            deployOptions: {
                loggingLevel: aws_apigateway_1.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                tracingEnabled: true,
                accessLogDestination: new aws_apigateway_1.LogGroupLogDestination(accessLogGroup),
            },
            defaultMethodOptions: {
                authorizationType: aws_apigateway_1.AuthorizationType.IAM,
            },
        });
        cdk_nag_1.NagSuppressions.addResourceSuppressions([this.lambda.role, this.restApi], [
            {
                id: "AwsSolutions-IAM4",
                reason: "Given the least privilege to this role",
            },
            {
                id: "AwsSolutions-IAM5",
                reason: "Given the least privilege to this role",
            },
            {
                id: "AwsSolutions-COG4",
                reason: "No use of Cognito",
            },
            {
                id: "AwsSolutions-APIG2",
                reason: "No need the setting for PoC",
            },
            {
                id: "AwsSolutions-APIG3",
                reason: "IAM Auth instead of WAF for security",
            },
        ], true);
    }
}
exports.Api = Api;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQywrREFLb0M7QUFDcEMsdURBS2dDO0FBQ2hDLDJDQUF1QztBQUN2Qyw2Q0FBbUM7QUFDbkMsaURBQThEO0FBRTlELHFDQUEwQztBQUMxQyxtREFBZ0Q7QUFPaEQsTUFBYSxHQUFJLFNBQVEsc0JBQVM7SUFDaEIsT0FBTyxDQUFnQjtJQUN2QixNQUFNLENBQVc7SUFDakMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFlO1FBQ3ZELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLGdCQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtZQUM1QyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsU0FBUyxTQUFTO1lBQ2pDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztTQUNmLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxnQ0FBbUIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQ3BELElBQUksRUFBRSw0QkFBZSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUU7Z0JBQ3pELFdBQVcsRUFBRSxLQUFLLENBQUMsR0FBRzthQUN2QixDQUFDO1lBQ0YsWUFBWSxFQUFFLHlCQUFZLENBQUMsTUFBTTtZQUNqQyxVQUFVLEVBQUUsSUFBSTtZQUNoQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFdBQVcsRUFBRTtnQkFDWCxlQUFlLEVBQUUsS0FBSyxDQUFDLGNBQWM7YUFDdEM7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FDekIsSUFBSSx5QkFBZSxDQUFDO1lBQ2xCLE1BQU0sRUFBRSxnQkFBTSxDQUFDLEtBQUs7WUFDcEIsT0FBTyxFQUFFO2dCQUNQLDRCQUE0QjtnQkFDNUIscUJBQXFCO2dCQUNyQix1Q0FBdUM7YUFDeEM7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLFdBQVc7b0JBQ3ZDLENBQUMsQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxzQkFBc0I7b0JBQ3BFLENBQUMsQ0FBQyxtQkFDRSxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUNyQixzQkFBc0I7Z0JBQzFCLCtDQUErQzthQUNoRDtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQ3pCLElBQUkseUJBQWUsQ0FBQztZQUNsQixNQUFNLEVBQUUsZ0JBQU0sQ0FBQyxLQUFLO1lBQ3BCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLGtCQUFrQjtnQkFDbEIsa0JBQWtCO2dCQUNsQixxQkFBcUI7YUFDdEI7WUFDRCxTQUFTLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUMvQixDQUFDLENBQ0gsQ0FBQztRQUVGLE1BQU0sY0FBYyxHQUFHLElBQUksbUJBQVEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFdkQsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLDhCQUFhLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN0RCxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDcEIsY0FBYyxFQUFFLElBQUk7WUFDcEIsMkJBQTJCLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3RELGFBQWEsRUFBRTtnQkFDYixZQUFZLEVBQUUsbUNBQWtCLENBQUMsSUFBSTtnQkFDckMsZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsY0FBYyxFQUFFLElBQUk7Z0JBQ3BCLG9CQUFvQixFQUFFLElBQUksdUNBQXNCLENBQUMsY0FBYyxDQUFDO2FBQ2pFO1lBQ0Qsb0JBQW9CLEVBQUU7Z0JBQ3BCLGlCQUFpQixFQUFFLGtDQUFpQixDQUFDLEdBQUc7YUFDekM7U0FDRixDQUFDLENBQUM7UUFFSCx5QkFBZSxDQUFDLHVCQUF1QixDQUNyQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsRUFDakM7WUFDRTtnQkFDRSxFQUFFLEVBQUUsbUJBQW1CO2dCQUN2QixNQUFNLEVBQUUsd0NBQXdDO2FBQ2pEO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLG1CQUFtQjtnQkFDdkIsTUFBTSxFQUFFLHdDQUF3QzthQUNqRDtZQUNEO2dCQUNFLEVBQUUsRUFBRSxtQkFBbUI7Z0JBQ3ZCLE1BQU0sRUFBRSxtQkFBbUI7YUFDNUI7WUFDRDtnQkFDRSxFQUFFLEVBQUUsb0JBQW9CO2dCQUN4QixNQUFNLEVBQUUsNkJBQTZCO2FBQ3RDO1lBQ0Q7Z0JBQ0UsRUFBRSxFQUFFLG9CQUFvQjtnQkFDeEIsTUFBTSxFQUFFLHNDQUFzQzthQUMvQztTQUNGLEVBQ0QsSUFBSSxDQUNMLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFuR0Qsa0JBbUdDIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqICBDb3B5cmlnaHQgMjAyNSBBbWF6b24uY29tLCBJbmMuIG9yIGl0cyBhZmZpbGlhdGVzLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBMaWNlbnNlUmVmLS5hbWF6b24uY29tLi1BbXpuU0wtMS4wXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFtYXpvbiBTb2Z0d2FyZSBMaWNlbnNlICBodHRwOi8vYXdzLmFtYXpvbi5jb20vYXNsL1xuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7XG4gIEF1dGhvcml6YXRpb25UeXBlLFxuICBMYW1iZGFSZXN0QXBpLFxuICBMb2dHcm91cExvZ0Rlc3RpbmF0aW9uLFxuICBNZXRob2RMb2dnaW5nTGV2ZWwsXG59IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xuaW1wb3J0IHtcbiAgQXJjaGl0ZWN0dXJlLFxuICBEb2NrZXJJbWFnZUNvZGUsXG4gIERvY2tlckltYWdlRnVuY3Rpb24sXG4gIEZ1bmN0aW9uLFxufSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCB7IEVDUiB9IGZyb20gXCIuL3JlcG9zaXRvcnlcIjtcbmltcG9ydCB7IEVmZmVjdCwgUG9saWN5U3RhdGVtZW50IH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcbmltcG9ydCB7IFRhYmxlVjIgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XG5pbXBvcnQgeyBOYWdTdXBwcmVzc2lvbnMgfSBmcm9tIFwiY2RrLW5hZ1wiO1xuaW1wb3J0IHsgTG9nR3JvdXAgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxvZ3NcIjtcbmltcG9ydCB7IENoYXRBcHBDb25maWcgfSBmcm9tIFwiLi4vLi4vdHlwZXMvdHlwZVwiO1xuXG5pbnRlcmZhY2UgQXBpUHJvcHMgZXh0ZW5kcyBDaGF0QXBwQ29uZmlnIHtcbiAgZGI6IFRhYmxlVjI7XG4gIGNvbGxlY3Rpb25OYW1lOiBzdHJpbmc7XG59XG5leHBvcnQgY2xhc3MgQXBpIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IHJlc3RBcGk6IExhbWJkYVJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGE6IEZ1bmN0aW9uO1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBpUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgY29uc3QgbGFtYmRhUmVwb3NpdG9yeSA9IG5ldyBFQ1IodGhpcywgXCJlY3JcIiwge1xuICAgICAgcGF0aDogYCR7cHJvcHMuaW1hZ2VQYXRofS9sYW1iZGFgLFxuICAgICAgdGFnOiBwcm9wcy50YWcsXG4gICAgfSk7XG5cbiAgICB0aGlzLmxhbWJkYSA9IG5ldyBEb2NrZXJJbWFnZUZ1bmN0aW9uKHRoaXMsIFwibGFtYmRhXCIsIHtcbiAgICAgIGNvZGU6IERvY2tlckltYWdlQ29kZS5mcm9tRWNyKGxhbWJkYVJlcG9zaXRvcnkucmVwb3NpdG9yeSwge1xuICAgICAgICB0YWdPckRpZ2VzdDogcHJvcHMudGFnLFxuICAgICAgfSksXG4gICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5BUk1fNjQsXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBDT0xMRUNUSU9OX05BTUU6IHByb3BzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMubGFtYmRhLm5vZGUuYWRkRGVwZW5kZW5jeShsYW1iZGFSZXBvc2l0b3J5KTtcbiAgICB0aGlzLmxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImJlZHJvY2s6R2V0Rm91bmRhdGlvbk1vZGVsXCIsXG4gICAgICAgICAgXCJiZWRyb2NrOkludm9rZU1vZGVsXCIsXG4gICAgICAgICAgXCJiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGNkay5TdGFjay5vZih0aGlzKS5yZWdpb24gPT09IFwidXMtZWFzdC0xXCJcbiAgICAgICAgICAgID8gYGFybjphd3M6YmVkcm9jazoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsLypgXG4gICAgICAgICAgICA6IGBhcm46YXdzOmJlZHJvY2s6JHtcbiAgICAgICAgICAgICAgICBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uXG4gICAgICAgICAgICAgIH06OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgICAgXCJhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsLypcIixcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICB0aGlzLmxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImR5bmFtb2RiOkxpc3RUYWJsZXNcIixcbiAgICAgICAgICBcImR5bmFtb2RiOkdldEl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlB1dEl0ZW1cIixcbiAgICAgICAgICBcImR5bmFtb2RiOlVwZGF0ZUl0ZW1cIixcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbcHJvcHMuZGIudGFibGVBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3QgYWNjZXNzTG9nR3JvdXAgPSBuZXcgTG9nR3JvdXAodGhpcywgXCJBY2Nlc3NMb2dcIik7XG5cbiAgICB0aGlzLnJlc3RBcGkgPSBuZXcgTGFtYmRhUmVzdEFwaSh0aGlzLCBcIkxhbWJkYVJlc3RBcGlcIiwge1xuICAgICAgaGFuZGxlcjogdGhpcy5sYW1iZGEsXG4gICAgICBjbG91ZFdhdGNoUm9sZTogdHJ1ZSxcbiAgICAgIGNsb3VkV2F0Y2hSb2xlUmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBNZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgdHJhY2luZ0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIGFjY2Vzc0xvZ0Rlc3RpbmF0aW9uOiBuZXcgTG9nR3JvdXBMb2dEZXN0aW5hdGlvbihhY2Nlc3NMb2dHcm91cCksXG4gICAgICB9LFxuICAgICAgZGVmYXVsdE1ldGhvZE9wdGlvbnM6IHtcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IEF1dGhvcml6YXRpb25UeXBlLklBTSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoXG4gICAgICBbdGhpcy5sYW1iZGEucm9sZSEsIHRoaXMucmVzdEFwaV0sXG4gICAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtSUFNNFwiLFxuICAgICAgICAgIHJlYXNvbjogXCJHaXZlbiB0aGUgbGVhc3QgcHJpdmlsZWdlIHRvIHRoaXMgcm9sZVwiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLUlBTTVcIixcbiAgICAgICAgICByZWFzb246IFwiR2l2ZW4gdGhlIGxlYXN0IHByaXZpbGVnZSB0byB0aGlzIHJvbGVcIixcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1DT0c0XCIsXG4gICAgICAgICAgcmVhc29uOiBcIk5vIHVzZSBvZiBDb2duaXRvXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtQVBJRzJcIixcbiAgICAgICAgICByZWFzb246IFwiTm8gbmVlZCB0aGUgc2V0dGluZyBmb3IgUG9DXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtQVBJRzNcIixcbiAgICAgICAgICByZWFzb246IFwiSUFNIEF1dGggaW5zdGVhZCBvZiBXQUYgZm9yIHNlY3VyaXR5XCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgdHJ1ZVxuICAgICk7XG4gIH1cbn1cbiJdfQ==