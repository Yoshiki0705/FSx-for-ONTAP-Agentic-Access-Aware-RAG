import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { GlobalRagConfig } from '../../types/global-config';

/**
 * セキュリティ監視設定
 */
export interface SecurityMonitoringConfig {
  /** 脅威検出感度レベル */
  threatDetectionSensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** 監視間隔（分） */
  monitoringIntervalMinutes: number;
  /** インシデント対応SLA（分） */
  incidentResponseSlaMinutes: number;
  /** 自動対応有効化 */
  autoResponseEnabled: boolean;
  /** 監視対象地域 */
  monitoredRegions: string[];
  /** アラート通知設定 */
  alertSettings: {
    email: string[];
    sms: string[];
    webhook?: string;
  };
}

/**
 * セキュリティ脅威レベル
 */
export enum ThreatLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

/**
 * インシデント状態
 */
export enum IncidentStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  CONTAINED = 'CONTAINED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

/**
 * 統一セキュリティ監視システム
 * 
 * 機能:
 * - 統一セキュリティ基準監視
 * - 脅威検出システム
 * - インシデント対応自動化
 * - セキュリティメトリクス収集
 * - リアルタイムアラート
 */
export class SecurityMonitoringSystem extends Construct {
  public readonly securityEventsTable: dynamodb.Table;
  public readonly incidentsTable: dynamodb.Table;
  public readonly threatIntelTable: dynamodb.Table;
  public readonly threatDetectorFunction: lambda.Function;
  public readonly incidentResponderFunction: lambda.Function;
  public readonly securityAnalyzerFunction: lambda.Function;
  public readonly alertManagerFunction: lambda.Function;
  public readonly securityWorkflow: stepfunctions.StateMachine;
  public readonly securityAlertTopic: sns.Topic;
  public readonly securityLogGroup: logs.LogGroup;

  private readonly globalConfig: GlobalRagConfig;
  private readonly securityConfig: SecurityMonitoringConfig;

  constructor(scope: Construct, id: string, props: {
    globalConfig: GlobalRagConfig;
    securityConfig: SecurityMonitoringConfig;
  }) {
    super(scope, id);

    this.globalConfig = props.globalConfig;
    this.securityConfig = props.securityConfig;

    // DynamoDBテーブル作成
    this.securityEventsTable = this.createSecurityEventsTable();
    this.incidentsTable = this.createIncidentsTable();
    this.threatIntelTable = this.createThreatIntelTable();

    // CloudWatch Logs
    this.securityLogGroup = this.createSecurityLogGroup();

    // SNS通知トピック
    this.securityAlertTopic = this.createSecurityAlertTopic();

    // Lambda関数作成
    this.threatDetectorFunction = this.createThreatDetectorFunction();
    this.incidentResponderFunction = this.createIncidentResponderFunction();
    this.securityAnalyzerFunction = this.createSecurityAnalyzerFunction();
    this.alertManagerFunction = this.createAlertManagerFunction();

    // Step Functions ワークフロー
    this.securityWorkflow = this.createSecurityWorkflow();

    // 監視スケジュール設定
    this.createMonitoringSchedules();

    // CloudWatch イベントルール設定
    this.createSecurityEventRules();
  } 
 /**
   * セキュリティイベントテーブルの作成
   */
  private createSecurityEventsTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'SecurityEventsTable', {
      tableName: `${this.globalConfig.projectName}-security-events`,
      partitionKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      globalSecondaryIndexes: [{
        indexName: 'ThreatLevelIndex',
        partitionKey: {
          name: 'threatLevel',
          type: dynamodb.AttributeType.STRING
        },
        sortKey: {
          name: 'timestamp',
          type: dynamodb.AttributeType.NUMBER
        }
      }, {
        indexName: 'RegionIndex',
        partitionKey: {
          name: 'region',
          type: dynamodb.AttributeType.STRING
        },
        sortKey: {
          name: 'timestamp',
          type: dynamodb.AttributeType.NUMBER
        }
      }]
    });
  }

  /**
   * インシデントテーブルの作成
   */
  private createIncidentsTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'IncidentsTable', {
      tableName: `${this.globalConfig.projectName}-security-incidents`,
      partitionKey: {
        name: 'incidentId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
      globalSecondaryIndexes: [{
        indexName: 'StatusIndex',
        partitionKey: {
          name: 'status',
          type: dynamodb.AttributeType.STRING
        },
        sortKey: {
          name: 'timestamp',
          type: dynamodb.AttributeType.NUMBER
        }
      }, {
        indexName: 'SeverityIndex',
        partitionKey: {
          name: 'severity',
          type: dynamodb.AttributeType.STRING
        },
        sortKey: {
          name: 'timestamp',
          type: dynamodb.AttributeType.NUMBER
        }
      }]
    });
  }

  /**
   * 脅威インテリジェンステーブルの作成
   */
  private createThreatIntelTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'ThreatIntelTable', {
      tableName: `${this.globalConfig.projectName}-threat-intelligence`,
      partitionKey: {
        name: 'threatId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl'
    });
  }

  /**
   * セキュリティログ群の作成
   */
  private createSecurityLogGroup(): logs.LogGroup {
    return new logs.LogGroup(this, 'SecurityLogGroup', {
      logGroupName: `/aws/${this.globalConfig.projectName}/security/${this.globalConfig.environment}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: this.globalConfig.environment === 'prod' ? 
        RemovalPolicy.RETAIN : 
        RemovalPolicy.DESTROY
    });
  }

  /**
   * セキュリティアラートトピックの作成
   */
  private createSecurityAlertTopic(): sns.Topic {
    return new sns.Topic(this, 'SecurityAlerts', {
      topicName: `${this.globalConfig.projectName}-security-alerts`,
      displayName: 'Security Monitoring Alerts'
    });
  }

  /**
   * 脅威検出Lambda関数
   */
  private createThreatDetectorFunction(): lambda.Function {
    return new lambda.Function(this, 'ThreatDetectorFunction', {
      functionName: `${this.globalConfig.projectName}-threat-detector`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const cloudwatchlogs = new AWS.CloudWatchLogs();
        
        exports.handler = async (event) => {
          console.log('脅威検出開始:', JSON.stringify(event));
          
          try {
            const detectionResults = [];
            
            // 各地域での脅威検出実行
            const regions = ${JSON.stringify(this.securityConfig.monitoredRegions)};
            
            for (const region of regions) {
              const threats = await detectThreatsInRegion(region);
              detectionResults.push(...threats);
            }
            
            // 検出された脅威の処理
            for (const threat of detectionResults) {
              await processDetectedThreat(threat);
            }
            
            // 脅威レベル別サマリー
            const summary = generateThreatSummary(detectionResults);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                threatsDetected: detectionResults.length,
                summary,
                timestamp: new Date().toISOString()
              })
            };
            
          } catch (error) {
            console.error('脅威検出エラー:', error);
            throw error;
          }
        };
        
        async function detectThreatsInRegion(region) {
          const threats = [];
          
          // 異常なAPI呼び出しパターンの検出
          const apiThreats = await detectAnomalousApiCalls(region);
          threats.push(...apiThreats);
          
          // 不正アクセス試行の検出
          const accessThreats = await detectUnauthorizedAccess(region);
          threats.push(...accessThreats);
          
          // データ漏洩の兆候検出
          const dataThreats = await detectDataExfiltration(region);
          threats.push(...dataThreats);
          
          // 設定変更の監視
          const configThreats = await detectSuspiciousConfigChanges(region);
          threats.push(...configThreats);
          
          return threats;
        }
        
        async function detectAnomalousApiCalls(region) {
          // CloudTrailログから異常なAPI呼び出しを検出
          const threats = [];
          
          // 短時間での大量API呼び出し
          const highVolumeThreats = await checkHighVolumeApiCalls(region);
          threats.push(...highVolumeThreats);
          
          // 通常と異なる時間帯でのAPI呼び出し
          const offHoursThreats = await checkOffHoursApiCalls(region);
          threats.push(...offHoursThreats);
          
          // 権限昇格の試行
          const privilegeEscalationThreats = await checkPrivilegeEscalation(region);
          threats.push(...privilegeEscalationThreats);
          
          return threats;
        }
        
        async function checkHighVolumeApiCalls(region) {
          // 簡略化された実装
          const mockThreat = Math.random() < 0.1; // 10%の確率で脅威検出
          
          if (mockThreat) {
            return [{
              threatId: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
              type: 'ANOMALOUS_API_VOLUME',
              threatLevel: 'MEDIUM',
              region,
              description: '短時間での異常に多いAPI呼び出しが検出されました',
              sourceIp: '192.168.1.100',
              userAgent: 'aws-cli/2.0.0',
              apiCallCount: 1500,
              timeWindow: '5分間',
              timestamp: Date.now()
            }];
          }
          
          return [];
        }
        
        async function checkOffHoursApiCalls(region) {
          const currentHour = new Date().getHours();
          const isOffHours = currentHour < 6 || currentHour > 22; // 22時-6時を営業時間外とする
          
          if (isOffHours && Math.random() < 0.05) { // 5%の確率で脅威検出
            return [{
              threatId: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
              type: 'OFF_HOURS_ACTIVITY',
              threatLevel: 'LOW',
              region,
              description: '営業時間外での管理者権限API呼び出しが検出されました',
              timestamp: Date.now()
            }];
          }
          
          return [];
        }
        
        async function checkPrivilegeEscalation(region) {
          const mockThreat = Math.random() < 0.02; // 2%の確率で脅威検出
          
          if (mockThreat) {
            return [{
              threatId: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
              type: 'PRIVILEGE_ESCALATION',
              threatLevel: 'HIGH',
              region,
              description: '権限昇格の試行が検出されました',
              targetResource: 'IAM Role',
              timestamp: Date.now()
            }];
          }
          
          return [];
        }
        
        async function detectUnauthorizedAccess(region) {
          const threats = [];
          
          // 複数回の認証失敗
          const bruteForceThreats = await checkBruteForceAttempts(region);
          threats.push(...bruteForceThreats);
          
          // 不正なIPアドレスからのアクセス
          const suspiciousIpThreats = await checkSuspiciousIpAccess(region);
          threats.push(...suspiciousIpThreats);
          
          return threats;
        }
        
        async function checkBruteForceAttempts(region) {
          const mockThreat = Math.random() < 0.03; // 3%の確率で脅威検出
          
          if (mockThreat) {
            return [{
              threatId: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
              type: 'BRUTE_FORCE_ATTACK',
              threatLevel: 'HIGH',
              region,
              description: '短時間での複数回認証失敗が検出されました',
              sourceIp: '203.0.113.1',
              failedAttempts: 25,
              timeWindow: '10分間',
              timestamp: Date.now()
            }];
          }
          
          return [];
        }
        
        async function checkSuspiciousIpAccess(region) {
          const mockThreat = Math.random() < 0.02; // 2%の確率で脅威検出
          
          if (mockThreat) {
            return [{
              threatId: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
              type: 'SUSPICIOUS_IP_ACCESS',
              threatLevel: 'MEDIUM',
              region,
              description: '既知の悪意あるIPアドレスからのアクセスが検出されました',
              sourceIp: '198.51.100.1',
              geoLocation: 'Unknown',
              timestamp: Date.now()
            }];
          }
          
          return [];
        }
        
        async function detectDataExfiltration(region) {
          const mockThreat = Math.random() < 0.01; // 1%の確率で脅威検出
          
          if (mockThreat) {
            return [{
              threatId: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
              type: 'DATA_EXFILTRATION',
              threatLevel: 'CRITICAL',
              region,
              description: '大量のデータダウンロードが検出されました',
              dataVolume: '10GB',
              timeWindow: '30分間',
              targetResource: 'S3 Bucket',
              timestamp: Date.now()
            }];
          }
          
          return [];
        }
        
        async function detectSuspiciousConfigChanges(region) {
          const mockThreat = Math.random() < 0.05; // 5%の確率で脅威検出
          
          if (mockThreat) {
            return [{
              threatId: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
              type: 'SUSPICIOUS_CONFIG_CHANGE',
              threatLevel: 'MEDIUM',
              region,
              description: 'セキュリティグループの設定変更が検出されました',
              changedResource: 'Security Group',
              changeType: 'Rule Addition',
              timestamp: Date.now()
            }];
          }
          
          return [];
        }
        
        async function processDetectedThreat(threat) {
          // セキュリティイベントとして記録
          await recordSecurityEvent(threat);
          
          // 脅威レベルに応じた処理
          if (threat.threatLevel === 'CRITICAL' || threat.threatLevel === 'HIGH') {
            await createSecurityIncident(threat);
          }
          
          // ログ記録
          await logSecurityEvent(threat);
        }
        
        async function recordSecurityEvent(threat) {
          const params = {
            TableName: '${this.securityEventsTable.tableName}',
            Item: {
              eventId: threat.threatId,
              timestamp: threat.timestamp,
              threatLevel: threat.threatLevel,
              region: threat.region,
              type: threat.type,
              description: threat.description,
              details: threat,
              ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1年保持
            }
          };
          
          await dynamodb.put(params).promise();
        }
        
        async function createSecurityIncident(threat) {
          const incidentId = \`incident-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
          
          const incident = {
            incidentId,
            timestamp: threat.timestamp,
            status: 'OPEN',
            severity: threat.threatLevel,
            type: threat.type,
            region: threat.region,
            description: threat.description,
            relatedEvents: [threat.threatId],
            assignedTo: getDefaultAssignee(threat.threatLevel),
            slaDeadline: new Date(Date.now() + (${this.securityConfig.incidentResponseSlaMinutes} * 60 * 1000)).toISOString(),
            ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
          };
          
          const params = {
            TableName: '${this.incidentsTable.tableName}',
            Item: incident
          };
          
          await dynamodb.put(params).promise();
          
          // インシデント対応者に通知
          await notifyIncidentResponse(incident);
        }
        
        function getDefaultAssignee(threatLevel) {
          const assignees = {
            'CRITICAL': 'security-team-lead',
            'HIGH': 'security-analyst',
            'MEDIUM': 'operations-team',
            'LOW': 'monitoring-team'
          };
          return assignees[threatLevel] || 'security-team';
        }
        
        async function notifyIncidentResponse(incident) {
          const lambda = new AWS.Lambda();
          
          await lambda.invoke({
            FunctionName: '${this.incidentResponderFunction.functionName}',
            InvocationType: 'Event',
            Payload: JSON.stringify(incident)
          }).promise();
        }
        
        async function logSecurityEvent(threat) {
          const logEvent = {
            timestamp: Date.now(),
            message: JSON.stringify({
              eventType: 'THREAT_DETECTED',
              threatId: threat.threatId,
              threatLevel: threat.threatLevel,
              type: threat.type,
              region: threat.region,
              description: threat.description
            })
          };
          
          await cloudwatchlogs.putLogEvents({
            logGroupName: '${this.securityLogGroup.logGroupName}',
            logStreamName: \`threat-detection-\${new Date().toISOString().split('T')[0]}\`,
            logEvents: [logEvent]
          }).promise().catch(async (error) => {
            if (error.code === 'ResourceNotFoundException') {
              // ログストリームが存在しない場合は作成
              await cloudwatchlogs.createLogStream({
                logGroupName: '${this.securityLogGroup.logGroupName}',
                logStreamName: \`threat-detection-\${new Date().toISOString().split('T')[0]}\`
              }).promise();
              
              // 再試行
              await cloudwatchlogs.putLogEvents({
                logGroupName: '${this.securityLogGroup.logGroupName}',
                logStreamName: \`threat-detection-\${new Date().toISOString().split('T')[0]}\`,
                logEvents: [logEvent]
              }).promise();
            }
          });
        }
        
        function generateThreatSummary(threats) {
          const summary = {
            total: threats.length,
            byLevel: {
              CRITICAL: threats.filter(t => t.threatLevel === 'CRITICAL').length,
              HIGH: threats.filter(t => t.threatLevel === 'HIGH').length,
              MEDIUM: threats.filter(t => t.threatLevel === 'MEDIUM').length,
              LOW: threats.filter(t => t.threatLevel === 'LOW').length
            },
            byType: {}
          };
          
          threats.forEach(threat => {
            summary.byType[threat.type] = (summary.byType[threat.type] || 0) + 1;
          });
          
          return summary;
        }
      `),
      timeout: Duration.minutes(15),
      environment: {
        SECURITY_EVENTS_TABLE: this.securityEventsTable.tableName,
        INCIDENTS_TABLE: this.incidentsTable.tableName,
        SECURITY_LOG_GROUP: this.securityLogGroup.logGroupName,
        INCIDENT_RESPONDER_FUNCTION: this.incidentResponderFunction.functionName
      }
    });
  }  /*
*
   * インシデント対応Lambda関数
   */
  private createIncidentResponderFunction(): lambda.Function {
    return new lambda.Function(this, 'IncidentResponderFunction', {
      functionName: `${this.globalConfig.projectName}-incident-responder`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const sns = new AWS.SNS();
        
        exports.handler = async (event) => {
          console.log('インシデント対応開始:', JSON.stringify(event));
          
          try {
            const incident = event;
            
            // インシデント状態を調査中に更新
            await updateIncidentStatus(incident.incidentId, 'INVESTIGATING');
            
            // 自動対応が有効な場合は初期対応を実行
            if (${this.securityConfig.autoResponseEnabled}) {
              const responseActions = await executeAutoResponse(incident);
              await updateIncidentWithActions(incident.incidentId, responseActions);
            }
            
            // アラート送信
            await sendSecurityAlert(incident);
            
            // エスカレーション判定
            if (shouldEscalate(incident)) {
              await escalateIncident(incident);
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                incidentId: incident.incidentId,
                status: 'INVESTIGATING',
                autoResponseExecuted: ${this.securityConfig.autoResponseEnabled},
                message: 'インシデント対応を開始しました'
              })
            };
            
          } catch (error) {
            console.error('インシデント対応エラー:', error);
            throw error;
          }
        };
        
        async function updateIncidentStatus(incidentId, status) {
          const params = {
            TableName: '${this.incidentsTable.tableName}',
            Key: {
              incidentId,
              timestamp: Date.now() // 実際の実装では正確なタイムスタンプが必要
            },
            UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: {
              ':status': status,
              ':updatedAt': Date.now()
            }
          };
          
          await dynamodb.update(params).promise();
        }
        
        async function executeAutoResponse(incident) {
          const actions = [];
          
          // インシデントタイプに応じた自動対応
          switch (incident.type) {
            case 'BRUTE_FORCE_ATTACK':
              actions.push(await blockSuspiciousIp(incident));
              break;
            case 'PRIVILEGE_ESCALATION':
              actions.push(await suspendSuspiciousUser(incident));
              break;
            case 'DATA_EXFILTRATION':
              actions.push(await blockDataAccess(incident));
              break;
            case 'SUSPICIOUS_CONFIG_CHANGE':
              actions.push(await revertConfigChange(incident));
              break;
            default:
              actions.push(await enableEnhancedMonitoring(incident));
          }
          
          return actions.filter(action => action !== null);
        }
        
        async function blockSuspiciousIp(incident) {
          // 疑わしいIPアドレスをブロック
          console.log(\`IPアドレスをブロック中: \${incident.details?.sourceIp}\`);
          
          return {
            action: 'BLOCK_IP',
            target: incident.details?.sourceIp,
            status: 'EXECUTED',
            timestamp: Date.now(),
            details: 'Suspicious IP address blocked in security group'
          };
        }
        
        async function suspendSuspiciousUser(incident) {
          // 疑わしいユーザーアカウントを一時停止
          console.log('疑わしいユーザーアカウントを一時停止中');
          
          return {
            action: 'SUSPEND_USER',
            target: incident.details?.userId || 'unknown',
            status: 'EXECUTED',
            timestamp: Date.now(),
            details: 'User account temporarily suspended due to privilege escalation attempt'
          };
        }
        
        async function blockDataAccess(incident) {
          // データアクセスをブロック
          console.log(\`データアクセスをブロック中: \${incident.details?.targetResource}\`);
          
          return {
            action: 'BLOCK_DATA_ACCESS',
            target: incident.details?.targetResource,
            status: 'EXECUTED',
            timestamp: Date.now(),
            details: 'Data access blocked to prevent further exfiltration'
          };
        }
        
        async function revertConfigChange(incident) {
          // 設定変更を元に戻す
          console.log(\`設定変更を元に戻し中: \${incident.details?.changedResource}\`);
          
          return {
            action: 'REVERT_CONFIG',
            target: incident.details?.changedResource,
            status: 'EXECUTED',
            timestamp: Date.now(),
            details: 'Suspicious configuration change reverted'
          };
        }
        
        async function enableEnhancedMonitoring(incident) {
          // 強化監視を有効化
          console.log('強化監視を有効化中');
          
          return {
            action: 'ENABLE_ENHANCED_MONITORING',
            target: incident.region,
            status: 'EXECUTED',
            timestamp: Date.now(),
            details: 'Enhanced monitoring enabled for the affected region'
          };
        }
        
        async function updateIncidentWithActions(incidentId, actions) {
          const params = {
            TableName: '${this.incidentsTable.tableName}',
            Key: {
              incidentId,
              timestamp: Date.now() // 実際の実装では正確なタイムスタンプが必要
            },
            UpdateExpression: 'SET #responseActions = :actions, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#responseActions': 'responseActions',
              '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: {
              ':actions': actions,
              ':updatedAt': Date.now()
            }
          };
          
          await dynamodb.update(params).promise();
        }
        
        async function sendSecurityAlert(incident) {
          const message = \`
セキュリティインシデントアラート

インシデントID: \${incident.incidentId}
重要度: \${incident.severity}
タイプ: \${incident.type}
地域: \${incident.region}
説明: \${incident.description}

SLA期限: \${incident.slaDeadline}
担当者: \${incident.assignedTo}

即座の対応が必要です。
          \`;
          
          await sns.publish({
            TopicArn: '${this.securityAlertTopic.topicArn}',
            Message: message,
            Subject: \`セキュリティインシデント (\${incident.severity}) - \${incident.incidentId}\`
          }).promise();
        }
        
        function shouldEscalate(incident) {
          // エスカレーション条件
          return incident.severity === 'CRITICAL' || 
                 incident.type === 'DATA_EXFILTRATION' ||
                 incident.type === 'PRIVILEGE_ESCALATION';
        }
        
        async function escalateIncident(incident) {
          // 上位管理者にエスカレーション
          const escalationMessage = \`
緊急セキュリティインシデント - エスカレーション

インシデントID: \${incident.incidentId}
重要度: \${incident.severity}
タイプ: \${incident.type}
地域: \${incident.region}

このインシデントは自動的にエスカレーションされました。
即座の管理者対応が必要です。
          \`;
          
          await sns.publish({
            TopicArn: '${this.securityAlertTopic.topicArn}',
            Message: escalationMessage,
            Subject: \`緊急エスカレーション - \${incident.incidentId}\`
          }).promise();
          
          // インシデント状態を更新
          await updateIncidentStatus(incident.incidentId, 'ESCALATED');
        }
      `),
      timeout: Duration.minutes(10),
      environment: {
        INCIDENTS_TABLE: this.incidentsTable.tableName,
        SECURITY_ALERT_TOPIC: this.securityAlertTopic.topicArn
      }
    });
  }

  /**
   * セキュリティ分析Lambda関数
   */
  private createSecurityAnalyzerFunction(): lambda.Function {
    return new lambda.Function(this, 'SecurityAnalyzerFunction', {
      functionName: `${this.globalConfig.projectName}-security-analyzer`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        exports.handler = async (event) => {
          console.log('セキュリティ分析開始:', JSON.stringify(event));
          
          try {
            const analysisType = event.analysisType || 'comprehensive';
            const timeRange = event.timeRange || 24; // hours
            
            // データ収集
            const securityEvents = await collectSecurityEvents(timeRange);
            const incidents = await collectIncidents(timeRange);
            
            // 分析実行
            const analysis = await performSecurityAnalysis(securityEvents, incidents, analysisType);
            
            // 推奨事項生成
            const recommendations = await generateSecurityRecommendations(analysis);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                analysisType,
                timeRange,
                analysis,
                recommendations,
                generatedAt: new Date().toISOString()
              })
            };
            
          } catch (error) {
            console.error('セキュリティ分析エラー:', error);
            throw error;
          }
        };
        
        async function collectSecurityEvents(timeRange) {
          const cutoffTime = Date.now() - (timeRange * 60 * 60 * 1000);
          
          const params = {
            TableName: '${this.securityEventsTable.tableName}',
            FilterExpression: '#timestamp > :cutoffTime',
            ExpressionAttributeNames: {
              '#timestamp': 'timestamp'
            },
            ExpressionAttributeValues: {
              ':cutoffTime': cutoffTime
            }
          };
          
          const result = await dynamodb.scan(params).promise();
          return result.Items || [];
        }
        
        async function collectIncidents(timeRange) {
          const cutoffTime = Date.now() - (timeRange * 60 * 60 * 1000);
          
          const params = {
            TableName: '${this.incidentsTable.tableName}',
            FilterExpression: '#timestamp > :cutoffTime',
            ExpressionAttributeNames: {
              '#timestamp': 'timestamp'
            },
            ExpressionAttributeValues: {
              ':cutoffTime': cutoffTime
            }
          };
          
          const result = await dynamodb.scan(params).promise();
          return result.Items || [];
        }
        
        async function performSecurityAnalysis(events, incidents, analysisType) {
          const analysis = {
            summary: generateSummary(events, incidents),
            trends: analyzeTrends(events, incidents),
            patterns: identifyPatterns(events),
            riskAssessment: assessRisk(events, incidents),
            performance: analyzePerformance(incidents)
          };
          
          if (analysisType === 'comprehensive') {
            analysis.detailedBreakdown = generateDetailedBreakdown(events, incidents);
            analysis.geographicAnalysis = analyzeGeographicDistribution(events);
            analysis.timeAnalysis = analyzeTimePatterns(events);
          }
          
          return analysis;
        }
        
        function generateSummary(events, incidents) {
          return {
            totalEvents: events.length,
            totalIncidents: incidents.length,
            eventsByThreatLevel: {
              CRITICAL: events.filter(e => e.threatLevel === 'CRITICAL').length,
              HIGH: events.filter(e => e.threatLevel === 'HIGH').length,
              MEDIUM: events.filter(e => e.threatLevel === 'MEDIUM').length,
              LOW: events.filter(e => e.threatLevel === 'LOW').length
            },
            incidentsBySeverity: {
              CRITICAL: incidents.filter(i => i.severity === 'CRITICAL').length,
              HIGH: incidents.filter(i => i.severity === 'HIGH').length,
              MEDIUM: incidents.filter(i => i.severity === 'MEDIUM').length,
              LOW: incidents.filter(i => i.severity === 'LOW').length
            },
            incidentsByStatus: {
              OPEN: incidents.filter(i => i.status === 'OPEN').length,
              INVESTIGATING: incidents.filter(i => i.status === 'INVESTIGATING').length,
              CONTAINED: incidents.filter(i => i.status === 'CONTAINED').length,
              RESOLVED: incidents.filter(i => i.status === 'RESOLVED').length,
              CLOSED: incidents.filter(i => i.status === 'CLOSED').length
            }
          };
        }
        
        function analyzeTrends(events, incidents) {
          // 簡略化されたトレンド分析
          const now = Date.now();
          const oneHourAgo = now - (60 * 60 * 1000);
          const sixHoursAgo = now - (6 * 60 * 60 * 1000);
          
          const recentEvents = events.filter(e => e.timestamp > oneHourAgo).length;
          const olderEvents = events.filter(e => e.timestamp > sixHoursAgo && e.timestamp <= oneHourAgo).length;
          
          return {
            eventTrend: recentEvents - olderEvents,
            mostCommonThreatTypes: getMostCommonThreatTypes(events),
            peakActivityHours: identifyPeakHours(events)
          };
        }
        
        function getMostCommonThreatTypes(events) {
          const typeCounts = {};
          events.forEach(event => {
            typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
          });
          
          return Object.entries(typeCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
        }
        
        function identifyPeakHours(events) {
          const hourCounts = {};
          events.forEach(event => {
            const hour = new Date(event.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          });
          
          return Object.entries(hourCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([hour, count]) => ({ hour: parseInt(hour), count }));
        }
        
        function identifyPatterns(events) {
          // パターン識別
          const patterns = [];
          
          // 同一IPからの複数攻撃
          const ipPatterns = identifyIpPatterns(events);
          patterns.push(...ipPatterns);
          
          // 時間的パターン
          const timePatterns = identifyTimePatterns(events);
          patterns.push(...timePatterns);
          
          return patterns;
        }
        
        function identifyIpPatterns(events) {
          const ipCounts = {};
          events.forEach(event => {
            if (event.details?.sourceIp) {
              ipCounts[event.details.sourceIp] = (ipCounts[event.details.sourceIp] || 0) + 1;
            }
          });
          
          return Object.entries(ipCounts)
            .filter(([, count]) => count > 3)
            .map(([ip, count]) => ({
              type: 'REPEATED_IP_ATTACKS',
              sourceIp: ip,
              eventCount: count,
              riskLevel: count > 10 ? 'HIGH' : 'MEDIUM'
            }));
        }
        
        function identifyTimePatterns(events) {
          // 短時間での大量イベント
          const timeWindows = {};
          const windowSize = 10 * 60 * 1000; // 10分
          
          events.forEach(event => {
            const window = Math.floor(event.timestamp / windowSize) * windowSize;
            timeWindows[window] = (timeWindows[window] || 0) + 1;
          });
          
          return Object.entries(timeWindows)
            .filter(([, count]) => count > 5)
            .map(([window, count]) => ({
              type: 'HIGH_ACTIVITY_BURST',
              timeWindow: new Date(parseInt(window)).toISOString(),
              eventCount: count,
              riskLevel: count > 20 ? 'HIGH' : 'MEDIUM'
            }));
        }
        
        function assessRisk(events, incidents) {
          const criticalEvents = events.filter(e => e.threatLevel === 'CRITICAL').length;
          const highEvents = events.filter(e => e.threatLevel === 'HIGH').length;
          const openIncidents = incidents.filter(i => i.status === 'OPEN').length;
          
          let riskScore = 0;
          riskScore += criticalEvents * 10;
          riskScore += highEvents * 5;
          riskScore += openIncidents * 3;
          
          let riskLevel = 'LOW';
          if (riskScore > 50) riskLevel = 'CRITICAL';
          else if (riskScore > 25) riskLevel = 'HIGH';
          else if (riskScore > 10) riskLevel = 'MEDIUM';
          
          return {
            riskScore,
            riskLevel,
            factors: {
              criticalEvents,
              highEvents,
              openIncidents
            }
          };
        }
        
        function analyzePerformance(incidents) {
          const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED');
          
          if (resolvedIncidents.length === 0) {
            return { averageResolutionTime: 0, slaCompliance: 100 };
          }
          
          const resolutionTimes = resolvedIncidents.map(incident => {
            const createdAt = incident.timestamp;
            const resolvedAt = incident.resolvedAt || Date.now();
            return resolvedAt - createdAt;
          });
          
          const averageResolutionTime = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
          
          // SLA準拠率計算（簡略化）
          const slaTarget = ${this.securityConfig.incidentResponseSlaMinutes} * 60 * 1000;
          const slaCompliant = resolutionTimes.filter(time => time <= slaTarget).length;
          const slaCompliance = (slaCompliant / resolutionTimes.length) * 100;
          
          return {
            averageResolutionTime: Math.round(averageResolutionTime / (60 * 1000)), // 分単位
            slaCompliance: Math.round(slaCompliance)
          };
        }
        
        async function generateSecurityRecommendations(analysis) {
          const recommendations = [];
          
          // リスクレベルに基づく推奨事項
          if (analysis.riskAssessment.riskLevel === 'CRITICAL') {
            recommendations.push('緊急: 重要なセキュリティ脅威が検出されています。即座の対応が必要です。');
          }
          
          // パターンに基づく推奨事項
          analysis.patterns.forEach(pattern => {
            if (pattern.type === 'REPEATED_IP_ATTACKS') {
              recommendations.push(\`IP \${pattern.sourceIp} からの繰り返し攻撃が検出されています。このIPをブロックすることを検討してください。\`);
            }
          });
          
          // パフォーマンスに基づく推奨事項
          if (analysis.performance.slaCompliance < 80) {
            recommendations.push('インシデント対応のSLA準拠率が低下しています。対応プロセスの見直しを検討してください。');
          }
          
          // 一般的な推奨事項
          if (analysis.summary.totalEvents > 100) {
            recommendations.push('セキュリティイベントが多発しています。監視設定の調整を検討してください。');
          }
          
          return recommendations;
        }
      `),
      timeout: Duration.minutes(10),
      environment: {
        SECURITY_EVENTS_TABLE: this.securityEventsTable.tableName,
        INCIDENTS_TABLE: this.incidentsTable.tableName
      }
    });
  }

  /**
   * アラート管理Lambda関数
   */
  private createAlertManagerFunction(): lambda.Function {
    return new lambda.Function(this, 'AlertManagerFunction', {
      functionName: `${this.globalConfig.projectName}-alert-manager`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const sns = new AWS.SNS();
        
        exports.handler = async (event) => {
          console.log('アラート管理開始:', JSON.stringify(event));
          
          try {
            const alertType = event.alertType;
            const severity = event.severity;
            const message = event.message;
            const details = event.details || {};
            
            // アラート送信
            await sendAlert(alertType, severity, message, details);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                alertType,
                severity,
                message: 'アラートが送信されました',
                timestamp: new Date().toISOString()
              })
            };
            
          } catch (error) {
            console.error('アラート管理エラー:', error);
            throw error;
          }
        };
        
        async function sendAlert(alertType, severity, message, details) {
          const alertMessage = formatAlertMessage(alertType, severity, message, details);
          const subject = \`[\${severity}] \${alertType} - \${details.region || 'Global'}\`;
          
          await sns.publish({
            TopicArn: '${this.securityAlertTopic.topicArn}',
            Message: alertMessage,
            Subject: subject
          }).promise();
        }
        
        function formatAlertMessage(alertType, severity, message, details) {
          return \`
セキュリティアラート

アラートタイプ: \${alertType}
重要度: \${severity}
メッセージ: \${message}

詳細情報:
\${Object.entries(details).map(([key, value]) => \`- \${key}: \${value}\`).join('\\n')}

発生時刻: \${new Date().toISOString()}
          \`;
        }
      `),
      timeout: Duration.minutes(5),
      environment: {
        SECURITY_ALERT_TOPIC: this.securityAlertTopic.topicArn
      }
    });
  }

  /**
   * Step Functions ワークフローの作成
   */
  private createSecurityWorkflow(): stepfunctions.StateMachine {
    // 脅威検出
    const detectThreats = new sfnTasks.LambdaInvoke(this, 'DetectThreats', {
      lambdaFunction: this.threatDetectorFunction,
      outputPath: '$.Payload'
    });

    // 脅威レベル判定
    const evaluateThreats = new stepfunctions.Choice(this, 'EvaluateThreats');

    // インシデント対応
    const respondToIncident = new sfnTasks.LambdaInvoke(this, 'RespondToIncident', {
      lambdaFunction: this.incidentResponderFunction,
      outputPath: '$.Payload'
    });

    // セキュリティ分析
    const analyzeSecurityData = new sfnTasks.LambdaInvoke(this, 'AnalyzeSecurityData', {
      lambdaFunction: this.securityAnalyzerFunction,
      outputPath: '$.Payload'
    });

    // 成功・失敗状態
    const securitySuccess = new stepfunctions.Succeed(this, 'SecuritySuccess');
    const securityFailed = new stepfunctions.Fail(this, 'SecurityFailed');

    // ワークフロー定義
    const definition = detectThreats
      .next(evaluateThreats
        .when(stepfunctions.Condition.or(
          stepfunctions.Condition.numberGreaterThan('$.summary.byLevel.CRITICAL', 0),
          stepfunctions.Condition.numberGreaterThan('$.summary.byLevel.HIGH', 0)
        ), respondToIncident)
        .otherwise(analyzeSecurityData))
      .next(securitySuccess);

    return new stepfunctions.StateMachine(this, 'SecurityWorkflow', {
      stateMachineName: `${this.globalConfig.projectName}-security-workflow`,
      definition,
      timeout: Duration.hours(1)
    });
  }

  /**
   * 監視スケジュールの作成
   */
  private createMonitoringSchedules(): void {
    // 脅威検出定期実行
    const threatDetectionSchedule = new events.Rule(this, 'ThreatDetectionSchedule', {
      ruleName: `${this.globalConfig.projectName}-threat-detection-schedule`,
      description: 'Regular threat detection execution',
      schedule: events.Schedule.rate(Duration.minutes(this.securityConfig.monitoringIntervalMinutes))
    });

    threatDetectionSchedule.addTarget(new targets.LambdaFunction(this.threatDetectorFunction));

    // セキュリティ分析定期実行（日次）
    const securityAnalysisSchedule = new events.Rule(this, 'SecurityAnalysisSchedule', {
      ruleName: `${this.globalConfig.projectName}-security-analysis-schedule`,
      description: 'Daily security analysis execution',
      schedule: events.Schedule.cron({ hour: '2', minute: '0' }) // 毎日2時
    });

    securityAnalysisSchedule.addTarget(new targets.LambdaFunction(this.securityAnalyzerFunction, {
      event: events.RuleTargetInput.fromObject({
        analysisType: 'comprehensive',
        timeRange: 24
      })
    }));
  }

  /**
   * CloudWatchイベントルールの作成
   */
  private createSecurityEventRules(): void {
    // AWS API呼び出し監視
    const apiCallRule = new events.Rule(this, 'ApiCallMonitoringRule', {
      ruleName: `${this.globalConfig.projectName}-api-call-monitoring`,
      description: 'Monitor suspicious API calls',
      eventPattern: {
        source: ['aws.iam', 'aws.sts'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: ['AssumeRole', 'CreateRole', 'AttachRolePolicy']
        }
      }
    });

    apiCallRule.addTarget(new targets.LambdaFunction(this.threatDetectorFunction));

    // セキュリティグループ変更監視
    const sgChangeRule = new events.Rule(this, 'SecurityGroupChangeRule', {
      ruleName: `${this.globalConfig.projectName}-sg-change-monitoring`,
      description: 'Monitor security group changes',
      eventPattern: {
        source: ['aws.ec2'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: ['AuthorizeSecurityGroupIngress', 'RevokeSecurityGroupIngress']
        }
      }
    });

    sgChangeRule.addTarget(new targets.LambdaFunction(this.threatDetectorFunction));
  }

  /**
   * 必要なIAM権限の設定
   */
  private setupIamPermissions(): void {
    // DynamoDBテーブルへの読み書き権限
    const tables = [this.securityEventsTable, this.incidentsTable, this.threatIntelTable];
    const functions = [
      this.threatDetectorFunction,
      this.incidentResponderFunction,
      this.securityAnalyzerFunction,
      this.alertManagerFunction
    ];

    tables.forEach(table => {
      functions.forEach(func => {
        table.grantReadWriteData(func);
      });
    });

    // CloudWatch Logs権限
    functions.forEach(func => {
      func.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams'
        ],
        resources: [this.securityLogGroup.logGroupArn]
      }));
    });

    // SNS通知権限
    functions.forEach(func => {
      this.securityAlertTopic.grantPublish(func);
    });

    // Lambda関数間の呼び出し権限
    this.threatDetectorFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [this.incidentResponderFunction.functionArn]
    }));
  }

  /**
   * 初期化処理
   */
  public initialize(): void {
    // IAM権限の設定
    this.setupIamPermissions();
  }
}