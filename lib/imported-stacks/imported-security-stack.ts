import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class ImportedSecurityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda実行ロール（インポート用）
    const lambdaExecutionRole = new iam.Role(this, "ImportedLambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
              ],
              resources: ["arn:aws:dynamodb:*:*:table/*"],
            }),
          ],
        }),
        OpenSearchAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "es:ESHttpGet",
                "es:ESHttpPost",
                "es:ESHttpPut",
                "es:ESHttpDelete",
              ],
              resources: ["arn:aws:es:*:*:domain/*"],
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // 出力
    new cdk.CfnOutput(this, "LambdaExecutionRoleArn", {
      value: lambdaExecutionRole.roleArn,
      description: "Imported Lambda execution role ARN",
      exportName: `${this.stackName}-LambdaExecutionRoleArn`,
    });
  }
}