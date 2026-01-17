import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as opensearch from "aws-cdk-lib/aws-opensearchserverless";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface ImportedStorageStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class ImportedStorageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportedStorageStackProps) {
    super(scope, id, props);

    // S3バケット（インポート用）
    const documentsBucket = new s3.Bucket(this, "ImportedDocumentsBucket", {
      bucketName: `imported-documents-bucket-${cdk.Aws.ACCOUNT_ID}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "DeleteOldVersions",
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // OpenSearch Serverlessコレクション（インポート用）
    const vectorCollection = new opensearch.CfnCollection(this, "ImportedVectorCollection", {
      name: "imported-vector-collection",
      type: "VECTORSEARCH",
      description: "Imported vector search collection for RAG system",
    });

    // FSx for NetApp ONTAPファイルシステム（プレースホルダー）
    // 実際のインポート時には既存のFSxリソースを取り込む
    
    // 出力
    new cdk.CfnOutput(this, "DocumentsBucketName", {
      value: documentsBucket.bucketName,
      description: "Imported documents bucket name",
      exportName: `${this.stackName}-DocumentsBucketName`,
    });

    new cdk.CfnOutput(this, "VectorCollectionArn", {
      value: vectorCollection.attrArn,
      description: "Imported vector collection ARN",
      exportName: `${this.stackName}-VectorCollectionArn`,
    });

    new cdk.CfnOutput(this, "VectorCollectionEndpoint", {
      value: vectorCollection.attrCollectionEndpoint,
      description: "Imported vector collection endpoint",
      exportName: `${this.stackName}-VectorCollectionEndpoint`,
    });
  }
}