import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface ImportedEmbeddingStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class ImportedEmbeddingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportedEmbeddingStackProps) {
    super(scope, id, props);

    // Embedding Lambda関数（インポート用）
    // 実際のインポート時には既存のEmbedding Lambda関数を取り込む
    const ragFunction = new lambda.Function(this, "ImportedEmbeddingRagFunction", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
def handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Embedding RAG function placeholder for import'
    }
      `),
      vpc: props.vpc,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        DYNAMODB_TABLE_NAME: "imported-sessions-table",
        OPENSEARCH_ENDPOINT: "imported-opensearch-endpoint",
      },
    });

    const embeddingFunction = new lambda.Function(this, "ImportedEmbeddingFunction", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
def handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Embedding function placeholder for import'
    }
      `),
      vpc: props.vpc,
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
    });

    // 出力
    new cdk.CfnOutput(this, "RagFunctionArn", {
      value: ragFunction.functionArn,
      description: "Imported RAG function ARN",
      exportName: `${this.stackName}-RagFunctionArn`,
    });

    new cdk.CfnOutput(this, "EmbeddingFunctionArn", {
      value: embeddingFunction.functionArn,
      description: "Imported embedding function ARN",
      exportName: `${this.stackName}-EmbeddingFunctionArn`,
    });
  }
}