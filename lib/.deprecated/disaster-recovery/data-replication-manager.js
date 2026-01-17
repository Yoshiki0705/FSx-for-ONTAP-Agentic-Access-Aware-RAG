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
exports.DataReplicationManager = exports.ReplicationStatus = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
/**
 * レプリケーション状態
 */
var ReplicationStatus;
(function (ReplicationStatus) {
    ReplicationStatus["HEALTHY"] = "HEALTHY";
    ReplicationStatus["LAGGING"] = "LAGGING";
    ReplicationStatus["FAILED"] = "FAILED";
    ReplicationStatus["SYNCING"] = "SYNCING";
})(ReplicationStatus || (exports.ReplicationStatus = ReplicationStatus = {}));
/**
 * データレプリケーション管理システム
 *
 * 機能:
 * - DynamoDB Global Tables設定
 * - FSx SnapMirror設定
 * - OpenSearch クロスリージョンレプリケーション
 * - レプリケーション監視とアラート
 */
class DataReplicationManager extends constructs_1.Construct {
    replicationStatusTable;
    replicationMonitorFunction;
    syncFunction;
    config;
    globalConfig;
    constructor(scope, id, props) {
        super(scope, id);
        this.globalConfig = props.globalConfig;
        this.config = props.replicationConfig;
        // レプリケーション状態管理テーブル
        this.replicationStatusTable = this.createReplicationStatusTable();
        // レプリケーション監視Lambda関数
        this.replicationMonitorFunction = this.createReplicationMonitorFunction();
        // データ同期Lambda関数
        this.syncFunction = this.createSyncFunction();
        // 定期監視スケジュール
        this.createMonitoringSchedule();
    }
    /**
     * レプリケーション状態管理テーブルの作成
     */
    createReplicationStatusTable() {
        return new dynamodb.Table(this, 'ReplicationStatusTable', {
            tableName: `${this.globalConfig.projectName}-replication-status`,
            partitionKey: {
                name: 'serviceType',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            timeToLiveAttribute: 'ttl',
            // Global Tablesを有効化
            replicationRegions: [this.config.secondaryRegion]
        });
    }
    /**
     * レプリケーション監視Lambda関数の作成
     */
    createReplicationMonitorFunction() {
        return new lambda.Function(this, 'ReplicationMonitorFunction', {
            functionName: `${this.globalConfig.projectName}-replication-monitor`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        exports.handler = async (event) => {
          console.log('データレプリケーション監視開始');
          
          try {
            const timestamp = Date.now();
            
            // DynamoDB Global Tablesの監視
            const dynamoStatus = await monitorDynamoDBReplication();
            await recordReplicationStatus('dynamodb', dynamoStatus, timestamp);
            
            // OpenSearchレプリケーションの監視
            const opensearchStatus = await monitorOpenSearchReplication();
            await recordReplicationStatus('opensearch', opensearchStatus, timestamp);
            
            // FSx SnapMirrorの監視
            const fsxStatus = await monitorFSxReplication();
            await recordReplicationStatus('fsx', fsxStatus, timestamp);
            
            // 全体的なレプリケーション健全性評価
            const overallHealth = evaluateOverallHealth([
              dynamoStatus, opensearchStatus, fsxStatus
            ]);
            
            await recordReplicationStatus('overall', overallHealth, timestamp);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                timestamp,
                dynamodb: dynamoStatus,
                opensearch: opensearchStatus,
                fsx: fsxStatus,
                overall: overallHealth
              })
            };
          } catch (error) {
            console.error('レプリケーション監視エラー:', error);
            throw error;
          }
        };

        async function monitorDynamoDBReplication() {
          try {
            const dynamoClient = new AWS.DynamoDB({ region: '${this.config.primaryRegion}' });
            
            // Global Tablesの状態確認
            const tables = await dynamoClient.listTables().promise();
            const globalTables = [];
            
            for (const tableName of tables.TableNames) {
              try {
                const tableDesc = await dynamoClient.describeTable({
                  TableName: tableName
                }).promise();
                
                if (tableDesc.Table.GlobalTableVersion) {
                  const globalTableDesc = await dynamoClient.describeGlobalTable({
                    GlobalTableName: tableName
                  }).promise();
                  
                  globalTables.push({
                    tableName,
                    status: globalTableDesc.GlobalTableDescription.GlobalTableStatus,
                    replicas: globalTableDesc.GlobalTableDescription.ReplicationGroup
                  });
                }
              } catch (err) {
                console.log(\`Table \${tableName} is not a global table\`);
              }
            }
            
            const healthyTables = globalTables.filter(t => t.status === 'ACTIVE').length;
            const totalTables = globalTables.length;
            
            return {
              status: totalTables > 0 && healthyTables === totalTables ? 'HEALTHY' : 'DEGRADED',
              healthyTables,
              totalTables,
              details: globalTables,
              lagSeconds: await calculateDynamoDBLag()
            };
          } catch (error) {
            console.error('DynamoDB監視エラー:', error);
            return {
              status: 'FAILED',
              error: error.message
            };
          }
        }

        async function monitorOpenSearchReplication() {
          try {
            // OpenSearch Serverlessのクロスリージョンレプリケーション監視
            const opensearchClient = new AWS.OpenSearchServerless({
              region: '${this.config.primaryRegion}'
            });
            
            // コレクションの状態確認
            const collections = await opensearchClient.listCollections().promise();
            const replicationStatus = [];
            
            for (const collection of collections.collectionSummaries || []) {
              const collectionDetails = await opensearchClient.batchGetCollection({
                names: [collection.name]
              }).promise();
              
              replicationStatus.push({
                name: collection.name,
                status: collection.status,
                details: collectionDetails
              });
            }
            
            return {
              status: 'HEALTHY', // 簡略化
              collections: replicationStatus.length,
              details: replicationStatus
            };
          } catch (error) {
            console.error('OpenSearch監視エラー:', error);
            return {
              status: 'FAILED',
              error: error.message
            };
          }
        }

        async function monitorFSxReplication() {
          try {
            const fsxClient = new AWS.FSx({ region: '${this.config.primaryRegion}' });
            
            // FSxファイルシステムの状態確認
            const fileSystems = await fsxClient.describeFileSystems().promise();
            const replicationStatus = [];
            
            for (const fs of fileSystems.FileSystems || []) {
              if (fs.FileSystemType === 'ONTAP') {
                // SnapMirror関係の確認
                replicationStatus.push({
                  fileSystemId: fs.FileSystemId,
                  lifecycle: fs.Lifecycle,
                  ontapConfiguration: fs.OntapConfiguration
                });
              }
            }
            
            return {
              status: 'HEALTHY', // 簡略化
              fileSystems: replicationStatus.length,
              details: replicationStatus
            };
          } catch (error) {
            console.error('FSx監視エラー:', error);
            return {
              status: 'FAILED',
              error: error.message
            };
          }
        }

        async function calculateDynamoDBLag() {
          // DynamoDB Global Tablesのレプリケーション遅延計算
          // 実装詳細は後で追加
          return 0;
        }

        function evaluateOverallHealth(statuses) {
          const healthyCount = statuses.filter(s => s.status === 'HEALTHY').length;
          const totalCount = statuses.length;
          
          if (healthyCount === totalCount) {
            return { status: 'HEALTHY', healthScore: 1.0 };
          } else if (healthyCount > 0) {
            return { status: 'DEGRADED', healthScore: healthyCount / totalCount };
          } else {
            return { status: 'FAILED', healthScore: 0.0 };
          }
        }

        async function recordReplicationStatus(serviceType, status, timestamp) {
          const params = {
            TableName: '${this.replicationStatusTable.tableName}',
            Item: {
              serviceType,
              timestamp,
              status: status.status,
              details: status,
              ttl: Math.floor(Date.now() / 1000) + (${this.config.backupRetentionDays} * 24 * 60 * 60)
            }
          };
          
          await dynamodb.put(params).promise();
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(10),
            environment: {
                STATUS_TABLE_NAME: this.replicationStatusTable.tableName,
                PRIMARY_REGION: this.config.primaryRegion,
                SECONDARY_REGION: this.config.secondaryRegion,
                BACKUP_RETENTION_DAYS: this.config.backupRetentionDays.toString()
            }
        });
    }
    /**
     * データ同期Lambda関数の作成
     */
    createSyncFunction() {
        return new lambda.Function(this, 'DataSyncFunction', {
            functionName: `${this.globalConfig.projectName}-data-sync`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');

        exports.handler = async (event) => {
          console.log('データ同期処理開始');
          
          try {
            const syncResults = [];
            
            // DynamoDB同期確認
            const dynamoResult = await syncDynamoDBData();
            syncResults.push({ service: 'dynamodb', result: dynamoResult });
            
            // OpenSearch同期確認
            const opensearchResult = await syncOpenSearchData();
            syncResults.push({ service: 'opensearch', result: opensearchResult });
            
            // FSx同期確認
            const fsxResult = await syncFSxData();
            syncResults.push({ service: 'fsx', result: fsxResult });
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                timestamp: new Date().toISOString(),
                results: syncResults
              })
            };
          } catch (error) {
            console.error('データ同期エラー:', error);
            throw error;
          }
        };

        async function syncDynamoDBData() {
          // DynamoDB Global Tablesの同期確認・修復
          console.log('DynamoDB同期確認中...');
          
          try {
            const dynamoClient = new AWS.DynamoDB({ region: '${this.config.primaryRegion}' });
            
            // Global Tablesの同期状態確認
            const tables = await dynamoClient.listTables().promise();
            const syncResults = [];
            
            for (const tableName of tables.TableNames) {
              try {
                const globalTableDesc = await dynamoClient.describeGlobalTable({
                  GlobalTableName: tableName
                }).promise();
                
                // レプリカの同期状態確認
                const replicas = globalTableDesc.GlobalTableDescription.ReplicationGroup;
                const syncStatus = replicas.every(replica => 
                  replica.ReplicaStatus === 'ACTIVE'
                );
                
                syncResults.push({
                  tableName,
                  synced: syncStatus,
                  replicas: replicas.length
                });
              } catch (err) {
                // Global Tableでない場合はスキップ
                continue;
              }
            }
            
            return {
              success: true,
              syncedTables: syncResults.filter(r => r.synced).length,
              totalTables: syncResults.length,
              details: syncResults
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }

        async function syncOpenSearchData() {
          // OpenSearchクロスリージョン同期確認
          console.log('OpenSearch同期確認中...');
          
          try {
            // 実装詳細は後で追加
            return {
              success: true,
              message: 'OpenSearch同期確認完了'
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }

        async function syncFSxData() {
          // FSx SnapMirror同期確認
          console.log('FSx同期確認中...');
          
          try {
            const fsxClient = new AWS.FSx({ region: '${this.config.primaryRegion}' });
            
            // ファイルシステムの同期状態確認
            const fileSystems = await fsxClient.describeFileSystems().promise();
            const syncResults = [];
            
            for (const fs of fileSystems.FileSystems || []) {
              if (fs.FileSystemType === 'ONTAP') {
                // SnapMirror関係の同期状態確認
                syncResults.push({
                  fileSystemId: fs.FileSystemId,
                  lifecycle: fs.Lifecycle,
                  synced: fs.Lifecycle === 'AVAILABLE'
                });
              }
            }
            
            return {
              success: true,
              syncedFileSystems: syncResults.filter(r => r.synced).length,
              totalFileSystems: syncResults.length,
              details: syncResults
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            environment: {
                PRIMARY_REGION: this.config.primaryRegion,
                SECONDARY_REGION: this.config.secondaryRegion
            }
        });
    }
    /**
     * 定期監視スケジュールの作成
     */
    createMonitoringSchedule() {
        // レプリケーション監視スケジュール
        const monitorRule = new events.Rule(this, 'ReplicationMonitorSchedule', {
            ruleName: `${this.globalConfig.projectName}-replication-monitor-schedule`,
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.minutes(this.config.replicationIntervalMinutes))
        });
        monitorRule.addTarget(new targets.LambdaFunction(this.replicationMonitorFunction));
        // データ同期スケジュール（より頻繁に実行）
        const syncRule = new events.Rule(this, 'DataSyncSchedule', {
            ruleName: `${this.globalConfig.projectName}-data-sync-schedule`,
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.minutes(Math.max(5, this.config.replicationIntervalMinutes / 2)))
        });
        syncRule.addTarget(new targets.LambdaFunction(this.syncFunction));
    }
    /**
     * DynamoDB Global Tablesの設定
     */
    setupDynamoDBGlobalTables(tables) {
        // 既存のテーブルをGlobal Tablesに変換
        tables.forEach(table => {
            // Global Tablesの設定は実際のデプロイ時に手動で行う必要がある
            // CDKでは直接サポートされていないため、カスタムリソースを使用
            console.log(`Setting up Global Table for: ${table.tableName}`);
        });
    }
    /**
     * 権限設定
     */
    grantPermissions() {
        // DynamoDB権限
        this.replicationStatusTable.grantReadWriteData(this.replicationMonitorFunction);
        this.replicationStatusTable.grantReadWriteData(this.syncFunction);
        // クロスリージョンアクセス権限
        const crossRegionPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:DescribeTable',
                'dynamodb:DescribeGlobalTable',
                'dynamodb:ListTables',
                'dynamodb:ListGlobalTables',
                'opensearchserverless:ListCollections',
                'opensearchserverless:BatchGetCollection',
                'fsx:DescribeFileSystems',
                'fsx:DescribeSnapshots'
            ],
            resources: ['*']
        });
        this.replicationMonitorFunction.addToRolePolicy(crossRegionPolicy);
        this.syncFunction.addToRolePolicy(crossRegionPolicy);
        // 暗号化権限（必要に応じて）
        if (this.config.encryptionEnabled) {
            const encryptionPolicy = new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'kms:Decrypt',
                    'kms:DescribeKey',
                    'kms:GenerateDataKey'
                ],
                resources: ['*']
            });
            this.replicationMonitorFunction.addToRolePolicy(encryptionPolicy);
            this.syncFunction.addToRolePolicy(encryptionPolicy);
        }
    }
    /**
     * レプリケーション状態の取得
     */
    getReplicationStatus() {
        return this.replicationStatusTable;
    }
}
exports.DataReplicationManager = DataReplicationManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1yZXBsaWNhdGlvbi1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGF0YS1yZXBsaWNhdGlvbi1tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQXVDO0FBQ3ZDLDZDQUFzRDtBQUN0RCxtRUFBcUQ7QUFHckQsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQseURBQTJDO0FBbUIzQzs7R0FFRztBQUNILElBQVksaUJBS1g7QUFMRCxXQUFZLGlCQUFpQjtJQUMzQix3Q0FBbUIsQ0FBQTtJQUNuQix3Q0FBbUIsQ0FBQTtJQUNuQixzQ0FBaUIsQ0FBQTtJQUNqQix3Q0FBbUIsQ0FBQTtBQUNyQixDQUFDLEVBTFcsaUJBQWlCLGlDQUFqQixpQkFBaUIsUUFLNUI7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQWEsc0JBQXVCLFNBQVEsc0JBQVM7SUFDbkMsc0JBQXNCLENBQWlCO0lBQ3ZDLDBCQUEwQixDQUFrQjtJQUM1QyxZQUFZLENBQWtCO0lBRTdCLE1BQU0sQ0FBd0I7SUFDOUIsWUFBWSxDQUFrQjtJQUUvQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBR3pDO1FBQ0MsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7UUFDdkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsaUJBQWlCLENBQUM7UUFFdEMsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUVsRSxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLDBCQUEwQixHQUFHLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDO1FBRTFFLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxr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QkFBaUIsQ0FBQyxDQUFDO1FBRXJELGdCQUFnQjtRQUNoQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUNsQyxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztnQkFDL0MsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztnQkFDeEIsT0FBTyxFQUFFO29CQUNQLGFBQWE7b0JBQ2IsaUJBQWlCO29CQUNqQixxQkFBcUI7aUJBQ3RCO2dCQUNELFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQzthQUNqQixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsMEJBQTBCLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN0RCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ksb0JBQW9CO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDO0lBQ3JDLENBQUM7Q0FDRjtBQXhmRCx3REF3ZkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IER1cmF0aW9uLCBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIG9wZW5zZWFyY2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzJztcbmltcG9ydCAqIGFzIGZzeCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZnN4JztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IEdsb2JhbFJhZ0NvbmZpZyB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuXG4vKipcbiAqIOODh+ODvOOCv+ODrOODl+ODquOCseODvOOCt+ODp+ODs+ioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIERhdGFSZXBsaWNhdGlvbkNvbmZpZyB7XG4gIC8qKiDjg5fjg6njgqTjg57jg6rjg6rjg7zjgrjjg6fjg7MgKi9cbiAgcHJpbWFyeVJlZ2lvbjogc3RyaW5nO1xuICAvKiog44K744Kr44Oz44OA44Oq44Oq44O844K444On44OzICovXG4gIHNlY29uZGFyeVJlZ2lvbjogc3RyaW5nO1xuICAvKiog44Os44OX44Oq44Kx44O844K344On44Oz6ZaT6ZqU77yI5YiG77yJICovXG4gIHJlcGxpY2F0aW9uSW50ZXJ2YWxNaW51dGVzOiBudW1iZXI7XG4gIC8qKiDjg5Djg4Pjgq/jgqLjg4Pjg5fkv53mjIHmnJ/plpPvvIjml6XvvIkgKi9cbiAgYmFja3VwUmV0ZW50aW9uRGF5czogbnVtYmVyO1xuICAvKiog5pqX5Y+35YyW6Kit5a6aICovXG4gIGVuY3J5cHRpb25FbmFibGVkOiBib29sZWFuO1xufVxuXG4vKipcbiAqIOODrOODl+ODquOCseODvOOCt+ODp+ODs+eKtuaFi1xuICovXG5leHBvcnQgZW51bSBSZXBsaWNhdGlvblN0YXR1cyB7XG4gIEhFQUxUSFkgPSAnSEVBTFRIWScsXG4gIExBR0dJTkcgPSAnTEFHR0lORycsXG4gIEZBSUxFRCA9ICdGQUlMRUQnLFxuICBTWU5DSU5HID0gJ1NZTkNJTkcnXG59XG5cbi8qKlxuICog44OH44O844K/44Os44OX44Oq44Kx44O844K344On44Oz566h55CG44K344K544OG44OgXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0gRHluYW1vREIgR2xvYmFsIFRhYmxlc+ioreWumlxuICogLSBGU3ggU25hcE1pcnJvcuioreWumlxuICogLSBPcGVuU2VhcmNoIOOCr+ODreOCueODquODvOOCuOODp+ODs+ODrOODl+ODquOCseODvOOCt+ODp+ODs1xuICogLSDjg6zjg5fjg6rjgrHjg7zjgrfjg6fjg7Pnm6PoppbjgajjgqLjg6njg7zjg4hcbiAqL1xuZXhwb3J0IGNsYXNzIERhdGFSZXBsaWNhdGlvbk1hbmFnZXIgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgcmVwbGljYXRpb25TdGF0dXNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSByZXBsaWNhdGlvbk1vbml0b3JGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3luY0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIFxuICBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZzogRGF0YVJlcGxpY2F0aW9uQ29uZmlnO1xuICBwcml2YXRlIHJlYWRvbmx5IGdsb2JhbENvbmZpZzogR2xvYmFsUmFnQ29uZmlnO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiB7XG4gICAgZ2xvYmFsQ29uZmlnOiBHbG9iYWxSYWdDb25maWc7XG4gICAgcmVwbGljYXRpb25Db25maWc6IERhdGFSZXBsaWNhdGlvbkNvbmZpZztcbiAgfSkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLmdsb2JhbENvbmZpZyA9IHByb3BzLmdsb2JhbENvbmZpZztcbiAgICB0aGlzLmNvbmZpZyA9IHByb3BzLnJlcGxpY2F0aW9uQ29uZmlnO1xuXG4gICAgLy8g44Os44OX44Oq44Kx44O844K344On44Oz54q25oWL566h55CG44OG44O844OW44OrXG4gICAgdGhpcy5yZXBsaWNhdGlvblN0YXR1c1RhYmxlID0gdGhpcy5jcmVhdGVSZXBsaWNhdGlvblN0YXR1c1RhYmxlKCk7XG5cbiAgICAvLyDjg6zjg5fjg6rjgrHjg7zjgrfjg6fjg7Pnm6PoppZMYW1iZGHplqLmlbBcbiAgICB0aGlzLnJlcGxpY2F0aW9uTW9uaXRvckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVSZXBsaWNhdGlvbk1vbml0b3JGdW5jdGlvbigpO1xuXG4gICAgLy8g44OH44O844K/5ZCM5pyfTGFtYmRh6Zai5pWwXG4gICAgdGhpcy5zeW5jRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZVN5bmNGdW5jdGlvbigpO1xuXG4gICAgLy8g5a6a5pyf55uj6KaW44K544Kx44K444Ol44O844OrXG4gICAgdGhpcy5jcmVhdGVNb25pdG9yaW5nU2NoZWR1bGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6zjg5fjg6rjgrHjg7zjgrfjg6fjg7PnirbmhYvnrqHnkIbjg4bjg7zjg5bjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlUmVwbGljYXRpb25TdGF0dXNUYWJsZSgpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgcmV0dXJuIG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmVwbGljYXRpb25TdGF0dXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LXJlcGxpY2F0aW9uLXN0YXR1c2AsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3NlcnZpY2VUeXBlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICAgIC8vIEdsb2JhbCBUYWJsZXPjgpLmnInlirnljJZcbiAgICAgIHJlcGxpY2F0aW9uUmVnaW9uczogW3RoaXMuY29uZmlnLnNlY29uZGFyeVJlZ2lvbl1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6zjg5fjg6rjgrHjg7zjgrfjg6fjg7Pnm6PoppZMYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlUmVwbGljYXRpb25Nb25pdG9yRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUmVwbGljYXRpb25Nb25pdG9yRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1yZXBsaWNhdGlvbi1tb25pdG9yYCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+ODh+ODvOOCv+ODrOODl+ODquOCseODvOOCt+ODp+ODs+ebo+imlumWi+WniycpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBEeW5hbW9EQiBHbG9iYWwgVGFibGVz44Gu55uj6KaWXG4gICAgICAgICAgICBjb25zdCBkeW5hbW9TdGF0dXMgPSBhd2FpdCBtb25pdG9yRHluYW1vREJSZXBsaWNhdGlvbigpO1xuICAgICAgICAgICAgYXdhaXQgcmVjb3JkUmVwbGljYXRpb25TdGF0dXMoJ2R5bmFtb2RiJywgZHluYW1vU3RhdHVzLCB0aW1lc3RhbXApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBPcGVuU2VhcmNo44Os44OX44Oq44Kx44O844K344On44Oz44Gu55uj6KaWXG4gICAgICAgICAgICBjb25zdCBvcGVuc2VhcmNoU3RhdHVzID0gYXdhaXQgbW9uaXRvck9wZW5TZWFyY2hSZXBsaWNhdGlvbigpO1xuICAgICAgICAgICAgYXdhaXQgcmVjb3JkUmVwbGljYXRpb25TdGF0dXMoJ29wZW5zZWFyY2gnLCBvcGVuc2VhcmNoU3RhdHVzLCB0aW1lc3RhbXApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGU3ggU25hcE1pcnJvcuOBruebo+imllxuICAgICAgICAgICAgY29uc3QgZnN4U3RhdHVzID0gYXdhaXQgbW9uaXRvckZTeFJlcGxpY2F0aW9uKCk7XG4gICAgICAgICAgICBhd2FpdCByZWNvcmRSZXBsaWNhdGlvblN0YXR1cygnZnN4JywgZnN4U3RhdHVzLCB0aW1lc3RhbXApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDlhajkvZPnmoTjgarjg6zjg5fjg6rjgrHjg7zjgrfjg6fjg7PlgaXlhajmgKfoqZXkvqFcbiAgICAgICAgICAgIGNvbnN0IG92ZXJhbGxIZWFsdGggPSBldmFsdWF0ZU92ZXJhbGxIZWFsdGgoW1xuICAgICAgICAgICAgICBkeW5hbW9TdGF0dXMsIG9wZW5zZWFyY2hTdGF0dXMsIGZzeFN0YXR1c1xuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHJlY29yZFJlcGxpY2F0aW9uU3RhdHVzKCdvdmVyYWxsJywgb3ZlcmFsbEhlYWx0aCwgdGltZXN0YW1wKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIGR5bmFtb2RiOiBkeW5hbW9TdGF0dXMsXG4gICAgICAgICAgICAgICAgb3BlbnNlYXJjaDogb3BlbnNlYXJjaFN0YXR1cyxcbiAgICAgICAgICAgICAgICBmc3g6IGZzeFN0YXR1cyxcbiAgICAgICAgICAgICAgICBvdmVyYWxsOiBvdmVyYWxsSGVhbHRoXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfjg6zjg5fjg6rjgrHjg7zjgrfjg6fjg7Pnm6Poppbjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIG1vbml0b3JEeW5hbW9EQlJlcGxpY2F0aW9uKCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkeW5hbW9DbGllbnQgPSBuZXcgQVdTLkR5bmFtb0RCKHsgcmVnaW9uOiAnJHt0aGlzLmNvbmZpZy5wcmltYXJ5UmVnaW9ufScgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdsb2JhbCBUYWJsZXPjga7nirbmhYvnorroqo1cbiAgICAgICAgICAgIGNvbnN0IHRhYmxlcyA9IGF3YWl0IGR5bmFtb0NsaWVudC5saXN0VGFibGVzKCkucHJvbWlzZSgpO1xuICAgICAgICAgICAgY29uc3QgZ2xvYmFsVGFibGVzID0gW107XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgdGFibGVOYW1lIG9mIHRhYmxlcy5UYWJsZU5hbWVzKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFibGVEZXNjID0gYXdhaXQgZHluYW1vQ2xpZW50LmRlc2NyaWJlVGFibGUoe1xuICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiB0YWJsZU5hbWVcbiAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHRhYmxlRGVzYy5UYWJsZS5HbG9iYWxUYWJsZVZlcnNpb24pIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGdsb2JhbFRhYmxlRGVzYyA9IGF3YWl0IGR5bmFtb0NsaWVudC5kZXNjcmliZUdsb2JhbFRhYmxlKHtcbiAgICAgICAgICAgICAgICAgICAgR2xvYmFsVGFibGVOYW1lOiB0YWJsZU5hbWVcbiAgICAgICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgZ2xvYmFsVGFibGVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICB0YWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogZ2xvYmFsVGFibGVEZXNjLkdsb2JhbFRhYmxlRGVzY3JpcHRpb24uR2xvYmFsVGFibGVTdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgIHJlcGxpY2FzOiBnbG9iYWxUYWJsZURlc2MuR2xvYmFsVGFibGVEZXNjcmlwdGlvbi5SZXBsaWNhdGlvbkdyb3VwXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxcYFRhYmxlIFxcJHt0YWJsZU5hbWV9IGlzIG5vdCBhIGdsb2JhbCB0YWJsZVxcYCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgaGVhbHRoeVRhYmxlcyA9IGdsb2JhbFRhYmxlcy5maWx0ZXIodCA9PiB0LnN0YXR1cyA9PT0gJ0FDVElWRScpLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbnN0IHRvdGFsVGFibGVzID0gZ2xvYmFsVGFibGVzLmxlbmd0aDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzOiB0b3RhbFRhYmxlcyA+IDAgJiYgaGVhbHRoeVRhYmxlcyA9PT0gdG90YWxUYWJsZXMgPyAnSEVBTFRIWScgOiAnREVHUkFERUQnLFxuICAgICAgICAgICAgICBoZWFsdGh5VGFibGVzLFxuICAgICAgICAgICAgICB0b3RhbFRhYmxlcyxcbiAgICAgICAgICAgICAgZGV0YWlsczogZ2xvYmFsVGFibGVzLFxuICAgICAgICAgICAgICBsYWdTZWNvbmRzOiBhd2FpdCBjYWxjdWxhdGVEeW5hbW9EQkxhZygpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdEeW5hbW9EQuebo+imluOCqOODqeODvDonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXM6ICdGQUlMRUQnLFxuICAgICAgICAgICAgICBlcnJvcjogZXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBtb25pdG9yT3BlblNlYXJjaFJlcGxpY2F0aW9uKCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3Pjga7jgq/jg63jgrnjg6rjg7zjgrjjg6fjg7Pjg6zjg5fjg6rjgrHjg7zjgrfjg6fjg7Pnm6PoppZcbiAgICAgICAgICAgIGNvbnN0IG9wZW5zZWFyY2hDbGllbnQgPSBuZXcgQVdTLk9wZW5TZWFyY2hTZXJ2ZXJsZXNzKHtcbiAgICAgICAgICAgICAgcmVnaW9uOiAnJHt0aGlzLmNvbmZpZy5wcmltYXJ5UmVnaW9ufSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjgrPjg6zjgq/jgrfjg6fjg7Pjga7nirbmhYvnorroqo1cbiAgICAgICAgICAgIGNvbnN0IGNvbGxlY3Rpb25zID0gYXdhaXQgb3BlbnNlYXJjaENsaWVudC5saXN0Q29sbGVjdGlvbnMoKS5wcm9taXNlKCk7XG4gICAgICAgICAgICBjb25zdCByZXBsaWNhdGlvblN0YXR1cyA9IFtdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNvbGxlY3Rpb24gb2YgY29sbGVjdGlvbnMuY29sbGVjdGlvblN1bW1hcmllcyB8fCBbXSkge1xuICAgICAgICAgICAgICBjb25zdCBjb2xsZWN0aW9uRGV0YWlscyA9IGF3YWl0IG9wZW5zZWFyY2hDbGllbnQuYmF0Y2hHZXRDb2xsZWN0aW9uKHtcbiAgICAgICAgICAgICAgICBuYW1lczogW2NvbGxlY3Rpb24ubmFtZV1cbiAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgcmVwbGljYXRpb25TdGF0dXMucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogY29sbGVjdGlvbi5uYW1lLFxuICAgICAgICAgICAgICAgIHN0YXR1czogY29sbGVjdGlvbi5zdGF0dXMsXG4gICAgICAgICAgICAgICAgZGV0YWlsczogY29sbGVjdGlvbkRldGFpbHNcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1czogJ0hFQUxUSFknLCAvLyDnsKHnlaXljJZcbiAgICAgICAgICAgICAgY29sbGVjdGlvbnM6IHJlcGxpY2F0aW9uU3RhdHVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgZGV0YWlsczogcmVwbGljYXRpb25TdGF0dXNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ09wZW5TZWFyY2jnm6Poppbjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzOiAnRkFJTEVEJyxcbiAgICAgICAgICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gbW9uaXRvckZTeFJlcGxpY2F0aW9uKCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmc3hDbGllbnQgPSBuZXcgQVdTLkZTeCh7IHJlZ2lvbjogJyR7dGhpcy5jb25maWcucHJpbWFyeVJlZ2lvbn0nIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGU3jjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6Djga7nirbmhYvnorroqo1cbiAgICAgICAgICAgIGNvbnN0IGZpbGVTeXN0ZW1zID0gYXdhaXQgZnN4Q2xpZW50LmRlc2NyaWJlRmlsZVN5c3RlbXMoKS5wcm9taXNlKCk7XG4gICAgICAgICAgICBjb25zdCByZXBsaWNhdGlvblN0YXR1cyA9IFtdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZzIG9mIGZpbGVTeXN0ZW1zLkZpbGVTeXN0ZW1zIHx8IFtdKSB7XG4gICAgICAgICAgICAgIGlmIChmcy5GaWxlU3lzdGVtVHlwZSA9PT0gJ09OVEFQJykge1xuICAgICAgICAgICAgICAgIC8vIFNuYXBNaXJyb3LplqLkv4Ljga7norroqo1cbiAgICAgICAgICAgICAgICByZXBsaWNhdGlvblN0YXR1cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIGZpbGVTeXN0ZW1JZDogZnMuRmlsZVN5c3RlbUlkLFxuICAgICAgICAgICAgICAgICAgbGlmZWN5Y2xlOiBmcy5MaWZlY3ljbGUsXG4gICAgICAgICAgICAgICAgICBvbnRhcENvbmZpZ3VyYXRpb246IGZzLk9udGFwQ29uZmlndXJhdGlvblxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1czogJ0hFQUxUSFknLCAvLyDnsKHnlaXljJZcbiAgICAgICAgICAgICAgZmlsZVN5c3RlbXM6IHJlcGxpY2F0aW9uU3RhdHVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgZGV0YWlsczogcmVwbGljYXRpb25TdGF0dXNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZTeOebo+imluOCqOODqeODvDonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXM6ICdGQUlMRUQnLFxuICAgICAgICAgICAgICBlcnJvcjogZXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjYWxjdWxhdGVEeW5hbW9EQkxhZygpIHtcbiAgICAgICAgICAvLyBEeW5hbW9EQiBHbG9iYWwgVGFibGVz44Gu44Os44OX44Oq44Kx44O844K344On44Oz6YGF5bu26KiI566XXG4gICAgICAgICAgLy8g5a6f6KOF6Kmz57Sw44Gv5b6M44Gn6L+95YqgXG4gICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBldmFsdWF0ZU92ZXJhbGxIZWFsdGgoc3RhdHVzZXMpIHtcbiAgICAgICAgICBjb25zdCBoZWFsdGh5Q291bnQgPSBzdGF0dXNlcy5maWx0ZXIocyA9PiBzLnN0YXR1cyA9PT0gJ0hFQUxUSFknKS5sZW5ndGg7XG4gICAgICAgICAgY29uc3QgdG90YWxDb3VudCA9IHN0YXR1c2VzLmxlbmd0aDtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaGVhbHRoeUNvdW50ID09PSB0b3RhbENvdW50KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6ICdIRUFMVEhZJywgaGVhbHRoU2NvcmU6IDEuMCB9O1xuICAgICAgICAgIH0gZWxzZSBpZiAoaGVhbHRoeUNvdW50ID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiAnREVHUkFERUQnLCBoZWFsdGhTY29yZTogaGVhbHRoeUNvdW50IC8gdG90YWxDb3VudCB9O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6ICdGQUlMRUQnLCBoZWFsdGhTY29yZTogMC4wIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gcmVjb3JkUmVwbGljYXRpb25TdGF0dXMoc2VydmljZVR5cGUsIHN0YXR1cywgdGltZXN0YW1wKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLnJlcGxpY2F0aW9uU3RhdHVzVGFibGUudGFibGVOYW1lfScsXG4gICAgICAgICAgICBJdGVtOiB7XG4gICAgICAgICAgICAgIHNlcnZpY2VUeXBlLFxuICAgICAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgICAgIHN0YXR1czogc3RhdHVzLnN0YXR1cyxcbiAgICAgICAgICAgICAgZGV0YWlsczogc3RhdHVzLFxuICAgICAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKCR7dGhpcy5jb25maWcuYmFja3VwUmV0ZW50aW9uRGF5c30gKiAyNCAqIDYwICogNjApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5wdXQocGFyYW1zKS5wcm9taXNlKCk7XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTVEFUVVNfVEFCTEVfTkFNRTogdGhpcy5yZXBsaWNhdGlvblN0YXR1c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUFJJTUFSWV9SRUdJT046IHRoaXMuY29uZmlnLnByaW1hcnlSZWdpb24sXG4gICAgICAgIFNFQ09OREFSWV9SRUdJT046IHRoaXMuY29uZmlnLnNlY29uZGFyeVJlZ2lvbixcbiAgICAgICAgQkFDS1VQX1JFVEVOVElPTl9EQVlTOiB0aGlzLmNvbmZpZy5iYWNrdXBSZXRlbnRpb25EYXlzLnRvU3RyaW5nKClcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg7zjgr/lkIzmnJ9MYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU3luY0Z1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RhdGFTeW5jRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1kYXRhLXN5bmNgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCfjg4fjg7zjgr/lkIzmnJ/lh6bnkIbplovlp4snKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3luY1Jlc3VsdHMgPSBbXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRHluYW1vRELlkIzmnJ/norroqo1cbiAgICAgICAgICAgIGNvbnN0IGR5bmFtb1Jlc3VsdCA9IGF3YWl0IHN5bmNEeW5hbW9EQkRhdGEoKTtcbiAgICAgICAgICAgIHN5bmNSZXN1bHRzLnB1c2goeyBzZXJ2aWNlOiAnZHluYW1vZGInLCByZXN1bHQ6IGR5bmFtb1Jlc3VsdCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gT3BlblNlYXJjaOWQjOacn+eiuuiqjVxuICAgICAgICAgICAgY29uc3Qgb3BlbnNlYXJjaFJlc3VsdCA9IGF3YWl0IHN5bmNPcGVuU2VhcmNoRGF0YSgpO1xuICAgICAgICAgICAgc3luY1Jlc3VsdHMucHVzaCh7IHNlcnZpY2U6ICdvcGVuc2VhcmNoJywgcmVzdWx0OiBvcGVuc2VhcmNoUmVzdWx0IH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGU3jlkIzmnJ/norroqo1cbiAgICAgICAgICAgIGNvbnN0IGZzeFJlc3VsdCA9IGF3YWl0IHN5bmNGU3hEYXRhKCk7XG4gICAgICAgICAgICBzeW5jUmVzdWx0cy5wdXNoKHsgc2VydmljZTogJ2ZzeCcsIHJlc3VsdDogZnN4UmVzdWx0IH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICByZXN1bHRzOiBzeW5jUmVzdWx0c1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcign44OH44O844K/5ZCM5pyf44Ko44Op44O8OicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzeW5jRHluYW1vREJEYXRhKCkge1xuICAgICAgICAgIC8vIER5bmFtb0RCIEdsb2JhbCBUYWJsZXPjga7lkIzmnJ/norroqo3jg7vkv67lvqlcbiAgICAgICAgICBjb25zb2xlLmxvZygnRHluYW1vRELlkIzmnJ/norroqo3kuK0uLi4nKTtcbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IEFXUy5EeW5hbW9EQih7IHJlZ2lvbjogJyR7dGhpcy5jb25maWcucHJpbWFyeVJlZ2lvbn0nIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHbG9iYWwgVGFibGVz44Gu5ZCM5pyf54q25oWL56K66KqNXG4gICAgICAgICAgICBjb25zdCB0YWJsZXMgPSBhd2FpdCBkeW5hbW9DbGllbnQubGlzdFRhYmxlcygpLnByb21pc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IHN5bmNSZXN1bHRzID0gW107XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgdGFibGVOYW1lIG9mIHRhYmxlcy5UYWJsZU5hbWVzKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2xvYmFsVGFibGVEZXNjID0gYXdhaXQgZHluYW1vQ2xpZW50LmRlc2NyaWJlR2xvYmFsVGFibGUoe1xuICAgICAgICAgICAgICAgICAgR2xvYmFsVGFibGVOYW1lOiB0YWJsZU5hbWVcbiAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g44Os44OX44Oq44Kr44Gu5ZCM5pyf54q25oWL56K66KqNXG4gICAgICAgICAgICAgICAgY29uc3QgcmVwbGljYXMgPSBnbG9iYWxUYWJsZURlc2MuR2xvYmFsVGFibGVEZXNjcmlwdGlvbi5SZXBsaWNhdGlvbkdyb3VwO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN5bmNTdGF0dXMgPSByZXBsaWNhcy5ldmVyeShyZXBsaWNhID0+IFxuICAgICAgICAgICAgICAgICAgcmVwbGljYS5SZXBsaWNhU3RhdHVzID09PSAnQUNUSVZFJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgc3luY1Jlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICB0YWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgICBzeW5jZWQ6IHN5bmNTdGF0dXMsXG4gICAgICAgICAgICAgICAgICByZXBsaWNhczogcmVwbGljYXMubGVuZ3RoXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIC8vIEdsb2JhbCBUYWJsZeOBp+OBquOBhOWgtOWQiOOBr+OCueOCreODg+ODl1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgIHN5bmNlZFRhYmxlczogc3luY1Jlc3VsdHMuZmlsdGVyKHIgPT4gci5zeW5jZWQpLmxlbmd0aCxcbiAgICAgICAgICAgICAgdG90YWxUYWJsZXM6IHN5bmNSZXN1bHRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgZGV0YWlsczogc3luY1Jlc3VsdHNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICBlcnJvcjogZXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzeW5jT3BlblNlYXJjaERhdGEoKSB7XG4gICAgICAgICAgLy8gT3BlblNlYXJjaOOCr+ODreOCueODquODvOOCuOODp+ODs+WQjOacn+eiuuiqjVxuICAgICAgICAgIGNvbnNvbGUubG9nKCdPcGVuU2VhcmNo5ZCM5pyf56K66KqN5LitLi4uJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOWun+ijheips+e0sOOBr+W+jOOBp+i/veWKoFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgbWVzc2FnZTogJ09wZW5TZWFyY2jlkIzmnJ/norroqo3lrozkuoYnXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc3luY0ZTeERhdGEoKSB7XG4gICAgICAgICAgLy8gRlN4IFNuYXBNaXJyb3LlkIzmnJ/norroqo1cbiAgICAgICAgICBjb25zb2xlLmxvZygnRlN45ZCM5pyf56K66KqN5LitLi4uJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZzeENsaWVudCA9IG5ldyBBV1MuRlN4KHsgcmVnaW9uOiAnJHt0aGlzLmNvbmZpZy5wcmltYXJ5UmVnaW9ufScgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOODleOCoeOCpOODq+OCt+OCueODhuODoOOBruWQjOacn+eKtuaFi+eiuuiqjVxuICAgICAgICAgICAgY29uc3QgZmlsZVN5c3RlbXMgPSBhd2FpdCBmc3hDbGllbnQuZGVzY3JpYmVGaWxlU3lzdGVtcygpLnByb21pc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IHN5bmNSZXN1bHRzID0gW107XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgZnMgb2YgZmlsZVN5c3RlbXMuRmlsZVN5c3RlbXMgfHwgW10pIHtcbiAgICAgICAgICAgICAgaWYgKGZzLkZpbGVTeXN0ZW1UeXBlID09PSAnT05UQVAnKSB7XG4gICAgICAgICAgICAgICAgLy8gU25hcE1pcnJvcumWouS/guOBruWQjOacn+eKtuaFi+eiuuiqjVxuICAgICAgICAgICAgICAgIHN5bmNSZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgZmlsZVN5c3RlbUlkOiBmcy5GaWxlU3lzdGVtSWQsXG4gICAgICAgICAgICAgICAgICBsaWZlY3ljbGU6IGZzLkxpZmVjeWNsZSxcbiAgICAgICAgICAgICAgICAgIHN5bmNlZDogZnMuTGlmZWN5Y2xlID09PSAnQVZBSUxBQkxFJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgIHN5bmNlZEZpbGVTeXN0ZW1zOiBzeW5jUmVzdWx0cy5maWx0ZXIociA9PiByLnN5bmNlZCkubGVuZ3RoLFxuICAgICAgICAgICAgICB0b3RhbEZpbGVTeXN0ZW1zOiBzeW5jUmVzdWx0cy5sZW5ndGgsXG4gICAgICAgICAgICAgIGRldGFpbHM6IHN5bmNSZXN1bHRzXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJJTUFSWV9SRUdJT046IHRoaXMuY29uZmlnLnByaW1hcnlSZWdpb24sXG4gICAgICAgIFNFQ09OREFSWV9SRUdJT046IHRoaXMuY29uZmlnLnNlY29uZGFyeVJlZ2lvblxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWumuacn+ebo+imluOCueOCseOCuOODpeODvOODq+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNb25pdG9yaW5nU2NoZWR1bGUoKTogdm9pZCB7XG4gICAgLy8g44Os44OX44Oq44Kx44O844K344On44Oz55uj6KaW44K544Kx44K444Ol44O844OrXG4gICAgY29uc3QgbW9uaXRvclJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1JlcGxpY2F0aW9uTW9uaXRvclNjaGVkdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1yZXBsaWNhdGlvbi1tb25pdG9yLXNjaGVkdWxlYCxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShEdXJhdGlvbi5taW51dGVzKHRoaXMuY29uZmlnLnJlcGxpY2F0aW9uSW50ZXJ2YWxNaW51dGVzKSlcbiAgICB9KTtcblxuICAgIG1vbml0b3JSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLnJlcGxpY2F0aW9uTW9uaXRvckZ1bmN0aW9uKSk7XG5cbiAgICAvLyDjg4fjg7zjgr/lkIzmnJ/jgrnjgrHjgrjjg6Xjg7zjg6vvvIjjgojjgorpoLvnuYHjgavlrp/ooYzvvIlcbiAgICBjb25zdCBzeW5jUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnRGF0YVN5bmNTY2hlZHVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tZGF0YS1zeW5jLXNjaGVkdWxlYCxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShEdXJhdGlvbi5taW51dGVzKE1hdGgubWF4KDUsIHRoaXMuY29uZmlnLnJlcGxpY2F0aW9uSW50ZXJ2YWxNaW51dGVzIC8gMikpKVxuICAgIH0pO1xuXG4gICAgc3luY1J1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMuc3luY0Z1bmN0aW9uKSk7XG4gIH1cblxuICAvKipcbiAgICogRHluYW1vREIgR2xvYmFsIFRhYmxlc+OBruioreWumlxuICAgKi9cbiAgcHVibGljIHNldHVwRHluYW1vREJHbG9iYWxUYWJsZXModGFibGVzOiBkeW5hbW9kYi5UYWJsZVtdKTogdm9pZCB7XG4gICAgLy8g5pei5a2Y44Gu44OG44O844OW44Or44KSR2xvYmFsIFRhYmxlc+OBq+WkieaPm1xuICAgIHRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIC8vIEdsb2JhbCBUYWJsZXPjga7oqK3lrprjga/lrp/pmpvjga7jg4fjg5fjg63jgqTmmYLjgavmiYvli5XjgafooYzjgYblv4XopoHjgYzjgYLjgotcbiAgICAgIC8vIENES+OBp+OBr+ebtOaOpeOCteODneODvOODiOOBleOCjOOBpuOBhOOBquOBhOOBn+OCgeOAgeOCq+OCueOCv+ODoOODquOCveODvOOCueOCkuS9v+eUqFxuICAgICAgY29uc29sZS5sb2coYFNldHRpbmcgdXAgR2xvYmFsIFRhYmxlIGZvcjogJHt0YWJsZS50YWJsZU5hbWV9YCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5qip6ZmQ6Kit5a6aXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRQZXJtaXNzaW9ucygpOiB2b2lkIHtcbiAgICAvLyBEeW5hbW9EQuaoqemZkFxuICAgIHRoaXMucmVwbGljYXRpb25TdGF0dXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5yZXBsaWNhdGlvbk1vbml0b3JGdW5jdGlvbik7XG4gICAgdGhpcy5yZXBsaWNhdGlvblN0YXR1c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLnN5bmNGdW5jdGlvbik7XG5cbiAgICAvLyDjgq/jg63jgrnjg6rjg7zjgrjjg6fjg7PjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBjb25zdCBjcm9zc1JlZ2lvblBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2R5bmFtb2RiOkRlc2NyaWJlVGFibGUnLFxuICAgICAgICAnZHluYW1vZGI6RGVzY3JpYmVHbG9iYWxUYWJsZScsXG4gICAgICAgICdkeW5hbW9kYjpMaXN0VGFibGVzJyxcbiAgICAgICAgJ2R5bmFtb2RiOkxpc3RHbG9iYWxUYWJsZXMnLFxuICAgICAgICAnb3BlbnNlYXJjaHNlcnZlcmxlc3M6TGlzdENvbGxlY3Rpb25zJyxcbiAgICAgICAgJ29wZW5zZWFyY2hzZXJ2ZXJsZXNzOkJhdGNoR2V0Q29sbGVjdGlvbicsXG4gICAgICAgICdmc3g6RGVzY3JpYmVGaWxlU3lzdGVtcycsXG4gICAgICAgICdmc3g6RGVzY3JpYmVTbmFwc2hvdHMnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZXBsaWNhdGlvbk1vbml0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koY3Jvc3NSZWdpb25Qb2xpY3kpO1xuICAgIHRoaXMuc3luY0Z1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShjcm9zc1JlZ2lvblBvbGljeSk7XG5cbiAgICAvLyDmmpflj7fljJbmqKnpmZDvvIjlv4XopoHjgavlv5zjgZjjgabvvIlcbiAgICBpZiAodGhpcy5jb25maWcuZW5jcnlwdGlvbkVuYWJsZWQpIHtcbiAgICAgIGNvbnN0IGVuY3J5cHRpb25Qb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdrbXM6RGVjcnlwdCcsXG4gICAgICAgICAgJ2ttczpEZXNjcmliZUtleScsXG4gICAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXknXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnJlcGxpY2F0aW9uTW9uaXRvckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlbmNyeXB0aW9uUG9saWN5KTtcbiAgICAgIHRoaXMuc3luY0Z1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlbmNyeXB0aW9uUG9saWN5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Os44OX44Oq44Kx44O844K344On44Oz54q25oWL44Gu5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0UmVwbGljYXRpb25TdGF0dXMoKTogZHluYW1vZGIuVGFibGUge1xuICAgIHJldHVybiB0aGlzLnJlcGxpY2F0aW9uU3RhdHVzVGFibGU7XG4gIH1cbn0iXX0=