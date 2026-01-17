import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { DatabaseConfig } from '../interfaces/database-config';
import { OpenSearchMultimodalConstruct } from './opensearch-multimodal-construct';

export interface DatabaseConstructProps {
  config: DatabaseConfig;
  projectName?: string;
  environment?: string;
  kmsKey?: any;
}

export interface DatabaseOutputs {
  dynamoDbTables?: {
    [key: string]: dynamodb.ITable;
  };
  openSearchEndpoint?: string;
  openSearchDomainArn?: string;
  openSearchDomainId?: string;
}

export class DatabaseConstruct extends Construct {
  public readonly outputs: DatabaseOutputs;
  private openSearchConstruct?: OpenSearchMultimodalConstruct;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);
    
    console.log('DatabaseConstruct initialized');
    
    // OpenSearch Serverless作成（修正版）
    const openSearchConfig: any = {
      domainName: 'permission-aware-rag-vectors',
      environment: props.environment || 'prod',
      collectionConfig: {
        type: 'VECTORSEARCH',
        description: 'Vector search collection for RAG embeddings',
      },
      networkConfig: {
        vpcEnabled: false, // パブリックアクセス
      },
      securityConfig: {
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHttps: true,
        kmsKey: props.kmsKey,
        fineGrainedAccessControl: false,
      },
      monitoringConfig: {
        logsEnabled: true,
        slowLogsEnabled: false,
        appLogsEnabled: false,
        indexSlowLogsEnabled: false,
      },
    };

    this.openSearchConstruct = new OpenSearchMultimodalConstruct(this, 'OpenSearch', openSearchConfig);
    
    // 出力を初期化
    this.outputs = {
      dynamoDbTables: {},
      openSearchEndpoint: this.openSearchConstruct?.outputs.domainEndpoint,
      openSearchDomainArn: this.openSearchConstruct?.outputs.domainArn,
      openSearchDomainId: this.openSearchConstruct?.outputs.domainName,
    };
  }
}
