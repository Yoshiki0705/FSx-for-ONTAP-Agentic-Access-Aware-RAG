import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class RagSystemMinimalStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables のみをImport（Lambda関数は後で追加）
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
    new cdk.CfnOutput(this, "RagSystemTablesCount", {
      value: "3",
      description: "Number of RAG system DynamoDB tables imported",
    });

    new cdk.CfnOutput(this, "DocumentMetadataTableName", {
      value: documentMetadata.tableName,
      description: "RAG system document metadata table name",
    });

    new cdk.CfnOutput(this, "SessionsTableName", {
      value: sessions.tableName,
      description: "RAG system sessions table name",
    });

    new cdk.CfnOutput(this, "UserAccessTableName", {
      value: userAccess.tableName,
      description: "RAG system user access table name",
    });
  }
}