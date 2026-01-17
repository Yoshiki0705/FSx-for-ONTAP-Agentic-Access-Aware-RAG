import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class ImportedDatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDBテーブル（インポート用）
    const sessionsTable = new dynamodb.Table(this, "ImportedSessionsTable", {
      tableName: "imported-sessions-table",
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
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    const documentsTable = new dynamodb.Table(this, "ImportedDocumentsTable", {
      tableName: "imported-documents-table",
      partitionKey: {
        name: "documentId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // 出力
    new cdk.CfnOutput(this, "SessionsTableName", {
      value: sessionsTable.tableName,
      description: "Imported sessions table name",
      exportName: `${this.stackName}-SessionsTableName`,
    });

    new cdk.CfnOutput(this, "DocumentsTableName", {
      value: documentsTable.tableName,
      description: "Imported documents table name",
      exportName: `${this.stackName}-DocumentsTableName`,
    });
  }
}