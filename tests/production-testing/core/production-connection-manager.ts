/**
 * 本番環境接続管理システム
 * 
 * 実本番AWSリソースへの安全な接続を管理
 * 読み取り専用モードでの安全なアクセス制御を提供
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import {
  CloudFrontClient,
  GetDistributionCommand
} from '@aws-sdk/client-cloudfront';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DynamoDBClient,
  DescribeTableCommand
} from '@aws-sdk/client-dynamodb';
import {
  OpenSearchServerlessClient,
  GetCollectionCommand
} from '@aws-sdk/client-opensearchserverless';
import {
  BedrockRuntimeClient,
  ListFoundationModelsCommand
} from '@aws-sdk/client-bedrock-runtime';
import {
  FSxClient,
  DescribeFileSystemsCommand
} from '@aws-sdk/client-fsx';
import {
  CloudWatchClient,
  PutMetricDataCommand
} from '@aws-sdk/client-cloudwatch';

import { ProductionConfig } from '../config/production-config';

/**
 * 接続状態インターフェース
 */
export interface ConnectionStatus {
  service: string;
  connected: boolean;
  lastChecked: Date;
  responseTime: number;
  error?: string;
  metadata?: any;
}

/**
 * 接続結果インターフェース
 */
export interface ConnectionResult {
  success: boolean;
  connectedServices: string[];
  failedServices: string[];
  totalResponseTime: number;
  details: ConnectionStatus[];
}

/**
 * 本番環境接続管理クラス
 */
export class ProductionConnectionManager {
  private config: ProductionConfig;
  private clients: Map<string, any> = new Map();
  private connectionStatus: Map<string, ConnectionStatus> = new Map();
  private emergencyStopRequested: boolean = false;

  constructor(config: ProductionConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * AWSクライアントの初期化
   */
  private initializeClients(): void {
    console.log('🔧 AWS クライアントを初期化中...');

    const clientConfig = {
      region: this.config.region,
      credentials: {
        profile: this.config.awsProfile
      }
    };

    try {
      // フロントエンド関連クライアント
      this.clients.set('cloudfront', new CloudFrontClient(clientConfig));

      // 認証・セキュリティ関連クライアント
      this.clients.set('cognito', new CognitoIdentityProviderClient(clientConfig));

      // データベース関連クライアント
      this.clients.set('dynamodb', new DynamoDBClient(clientConfig));
      this.clients.set('opensearch', new OpenSearchServerlessClient(clientConfig));

      // AI関連クライアント
      this.clients.set('bedrock', new BedrockRuntimeClient(clientConfig));

      // ストレージ関連クライアント
      this.clients.set('fsx', new FSxClient(clientConfig));

      // 監視関連クライアント
      this.clients.set('cloudwatch', new CloudWatchClient(clientConfig));

      console.log('✅ AWS クライアント初期化完了');
    } catch (error) {
      console.error('❌ AWS クライアント初期化エラー:', error);
      throw new Error(`AWS クライアント初期化に失敗しました: ${error}`);
    }
  }

  /**
   * 本番環境への接続テスト
   */
  async testProductionConnection(): Promise<ConnectionResult> {
    console.log('🔗 本番環境接続テストを開始...');

    if (this.emergencyStopRequested) {
      throw new Error('緊急停止が要求されています。接続テストを中止します。');
    }

    const startTime = Date.now();
    const connectionTests = [
      { name: 'cloudfront', test: this.testCloudFrontConnection.bind(this) },
      { name: 'cognito', test: this.testCognitoConnection.bind(this) },
      { name: 'dynamodb', test: this.testDynamoDBConnection.bind(this) },
      { name: 'opensearch', test: this.testOpenSearchConnection.bind(this) },
      { name: 'bedrock', test: this.testBedrockConnection.bind(this) },
      { name: 'fsx', test: this.testFSxConnection.bind(this) }
    ];

    const results: ConnectionStatus[] = [];
    const connectedServices: string[] = [];
    const failedServices: string[] = [];

    // 並列で接続テストを実行
    const testPromises = connectionTests.map(async ({ name, test }) => {
      try {
        const testStartTime = Date.now();
        const result = await test();
        const responseTime = Date.now() - testStartTime;

        const status: ConnectionStatus = {
          service: name,
          connected: result.success,
          lastChecked: new Date(),
          responseTime,
          metadata: result.metadata
        };

        if (result.success) {
          connectedServices.push(name);
          console.log(`✅ ${name} 接続成功 (${responseTime}ms)`);
        } else {
          failedServices.push(name);
          status.error = result.error;
          console.error(`❌ ${name} 接続失敗: ${result.error}`);
        }

        this.connectionStatus.set(name, status);
        return status;

      } catch (error) {
        const status: ConnectionStatus = {
          service: name,
          connected: false,
          lastChecked: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : String(error)
        };

        failedServices.push(name);
        this.connectionStatus.set(name, status);
        console.error(`❌ ${name} 接続テスト例外:`, error);
        return status;
      }
    });

    results.push(...await Promise.all(testPromises));

    const totalResponseTime = Date.now() - startTime;
    const success = failedServices.length === 0;

    // CloudWatchにメトリクスを送信
    await this.sendConnectionMetrics(connectedServices.length, failedServices.length, totalResponseTime);

    console.log(`🔗 本番環境接続テスト完了: 成功 ${connectedServices.length}件, 失敗 ${failedServices.length}件 (${totalResponseTime}ms)`);

    return {
      success,
      connectedServices,
      failedServices,
      totalResponseTime,
      details: results
    };
  }

  /**
   * CloudFront接続テスト
   */
  private async testCloudFrontConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const client = this.clients.get('cloudfront') as CloudFrontClient;
      const command = new GetDistributionCommand({
        Id: this.config.resources.cloudFrontDistribution
      });

      const response = await client.send(command);
      
      return {
        success: true,
        metadata: {
          distributionId: response.Distribution?.Id,
          status: response.Distribution?.Status,
          domainName: response.Distribution?.DomainName,
          enabled: response.Distribution?.DistributionConfig?.Enabled
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Cognito接続テスト
   */
  private async testCognitoConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const client = this.clients.get('cognito') as CognitoIdentityProviderClient;
      const command = new DescribeUserPoolCommand({
        UserPoolId: this.config.resources.cognitoUserPool
      });

      const response = await client.send(command);
      
      return {
        success: true,
        metadata: {
          userPoolId: response.UserPool?.Id,
          name: response.UserPool?.Name,
          status: response.UserPool?.Status,
          userCount: response.UserPool?.EstimatedNumberOfUsers
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * DynamoDB接続テスト
   */
  private async testDynamoDBConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const client = this.clients.get('dynamodb') as DynamoDBClient;
      const command = new DescribeTableCommand({
        TableName: this.config.resources.dynamoDBTables.sessions
      });

      const response = await client.send(command);
      
      return {
        success: true,
        metadata: {
          tableName: response.Table?.TableName,
          status: response.Table?.TableStatus,
          itemCount: response.Table?.ItemCount,
          tableSize: response.Table?.TableSizeBytes
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * OpenSearch接続テスト
   */
  private async testOpenSearchConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const client = this.clients.get('opensearch') as OpenSearchServerlessClient;
      const command = new GetCollectionCommand({
        id: this.config.resources.openSearchDomain
      });

      const response = await client.send(command);
      
      return {
        success: true,
        metadata: {
          collectionId: response.collectionDetail?.id,
          name: response.collectionDetail?.name,
          status: response.collectionDetail?.status,
          type: response.collectionDetail?.type
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Bedrock接続テスト
   */
  private async testBedrockConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const client = this.clients.get('bedrock') as BedrockRuntimeClient;
      const command = new ListFoundationModelsCommand({});

      const response = await client.send(command);
      
      const availableModels = response.modelSummaries?.filter(model => 
        this.config.resources.bedrockModels.includes(model.modelId || '')
      );
      
      return {
        success: true,
        metadata: {
          totalModels: response.modelSummaries?.length || 0,
          availableConfiguredModels: availableModels?.length || 0,
          configuredModels: this.config.resources.bedrockModels
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * FSx接続テスト
   */
  private async testFSxConnection(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const client = this.clients.get('fsx') as FSxClient;
      const command = new DescribeFileSystemsCommand({
        FileSystemIds: [this.config.resources.fsxFileSystem]
      });

      const response = await client.send(command);
      const fileSystem = response.FileSystems?.[0];
      
      return {
        success: true,
        metadata: {
          fileSystemId: fileSystem?.FileSystemId,
          fileSystemType: fileSystem?.FileSystemType,
          lifecycle: fileSystem?.Lifecycle,
          storageCapacity: fileSystem?.StorageCapacity
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 接続メトリクスをCloudWatchに送信
   */
  private async sendConnectionMetrics(
    connectedCount: number,
    failedCount: number,
    responseTime: number
  ): Promise<void> {
    try {
      const client = this.clients.get('cloudwatch') as CloudWatchClient;
      const command = new PutMetricDataCommand({
        Namespace: 'ProductionTesting/Connection',
        MetricData: [
          {
            MetricName: 'ConnectedServices',
            Value: connectedCount,
            Unit: 'Count',
            Timestamp: new Date()
          },
          {
            MetricName: 'FailedServices',
            Value: failedCount,
            Unit: 'Count',
            Timestamp: new Date()
          },
          {
            MetricName: 'ConnectionTestResponseTime',
            Value: responseTime,
            Unit: 'Milliseconds',
            Timestamp: new Date()
          }
        ]
      });

      await client.send(command);
      console.log('📊 接続メトリクスをCloudWatchに送信しました');
    } catch (error) {
      console.warn('⚠️ CloudWatchメトリクス送信に失敗:', error);
    }
  }

  /**
   * 緊急停止の要求
   */
  requestEmergencyStop(reason: string): void {
    console.warn(`🚨 緊急停止が要求されました: ${reason}`);
    this.emergencyStopRequested = true;
  }

  /**
   * 緊急停止状態のリセット
   */
  resetEmergencyStop(): void {
    console.log('🔄 緊急停止状態をリセットしました');
    this.emergencyStopRequested = false;
  }

  /**
   * 現在の接続状態を取得
   */
  getConnectionStatus(): Map<string, ConnectionStatus> {
    return new Map(this.connectionStatus);
  }

  /**
   * 特定のサービスの接続状態を取得
   */
  getServiceConnectionStatus(serviceName: string): ConnectionStatus | undefined {
    return this.connectionStatus.get(serviceName);
  }

  /**
   * 接続の健全性チェック
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 最近の接続テスト結果をチェック
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分

    for (const [service, status] of this.connectionStatus) {
      const age = now - status.lastChecked.getTime();
      
      if (age > maxAge) {
        issues.push(`${service} の接続状態が古すぎます (${Math.round(age / 1000)}秒前)`);
        recommendations.push(`${service} の接続テストを再実行してください`);
      }

      if (!status.connected) {
        issues.push(`${service} への接続に失敗しています: ${status.error}`);
        recommendations.push(`${service} の設定と権限を確認してください`);
      }

      if (status.responseTime > 10000) {
        issues.push(`${service} の応答時間が遅すぎます (${status.responseTime}ms)`);
        recommendations.push(`${service} のパフォーマンスを確認してください`);
      }
    }

    const healthy = issues.length === 0;

    console.log(`🏥 健全性チェック完了: ${healthy ? '正常' : '問題あり'} (問題 ${issues.length}件)`);

    return {
      healthy,
      issues,
      recommendations
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 接続管理システムをクリーンアップ中...');
    
    // クライアントの切断
    this.clients.clear();
    this.connectionStatus.clear();
    
    console.log('✅ クリーンアップ完了');
  }
}

export default ProductionConnectionManager;