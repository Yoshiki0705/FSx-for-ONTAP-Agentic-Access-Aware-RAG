import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface RagSystemStackProps extends cdk.StackProps {
  vpc?: ec2.IVpc;
}

export class RagSystemStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: RagSystemStackProps) {
    super(scope, id, props);

    // RAG System Lambda Functions (実際のImport時に既存リソースを取り込む)
    
    // Core RAG Functions
    const cleanupScheduler = new lambda.Function(this, "CleanupScheduler", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-cleanup-scheduler",
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      // ServiceRoleは既存のものを使用するため、CDK管理外とする
      role: undefined,
    });

    const healthCheck = new lambda.Function(this, "HealthCheck", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-health-check",
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
    });

    const indexUpdater = new lambda.Function(this, "IndexUpdater", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-index-updater",
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
    });

    const documentProcessor = new lambda.Function(this, "DocumentProcessor", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-document-processor",
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
    });

    const authHandler = new lambda.Function(this, "AuthHandler", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-auth-handler",
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    const userSession = new lambda.Function(this, "UserSession", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-user-session",
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    const documentSearch = new lambda.Function(this, "DocumentSearch", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-document-search",
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
    });

    const embeddingGenerator = new lambda.Function(this, "EmbeddingGenerator", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-embedding-generator",
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
    });

    const permissionCheck = new lambda.Function(this, "PermissionCheck", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-permission-check",
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    const metricsCollector = new lambda.Function(this, "MetricsCollector", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-metrics-collector",
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
    });

    const logProcessor = new lambda.Function(this, "LogProcessor", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.handler",
      code: lambda.Code.fromInline("# Placeholder for import"),
      functionName: "rag-system-dev-log-processor",
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
    });

    // DynamoDB Tables
    const documentMetadata = new dynamodb.Table(this, "DocumentMetadata", {
      tableName: "rag-system-development-document-metadata",
      partitionKey: {
        name: "documentId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    const sessions = new dynamodb.Table(this, "Sessions", {
      tableName: "rag-system-development-sessions",
      partitionKey: {
        name: "sessionId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "timestamp",
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    const userAccess = new dynamodb.Table(this, "UserAccess", {
      tableName: "rag-system-development-user-access",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "resourceId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    // 出力
    new cdk.CfnOutput(this, "RagSystemFunctionsCount", {
      value: "11",
      description: "Number of RAG system Lambda functions",
    });

    new cdk.CfnOutput(this, "RagSystemTablesCount", {
      value: "3",
      description: "Number of RAG system DynamoDB tables",
    });
  }
}