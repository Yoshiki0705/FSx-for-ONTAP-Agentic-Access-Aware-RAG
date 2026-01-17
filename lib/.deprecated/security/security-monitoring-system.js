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
exports.SecurityMonitoringSystem = exports.IncidentStatus = exports.ThreatLevel = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const stepfunctions = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const sfnTasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
/**
 * セキュリティ脅威レベル
 */
var ThreatLevel;
(function (ThreatLevel) {
    ThreatLevel["CRITICAL"] = "CRITICAL";
    ThreatLevel["HIGH"] = "HIGH";
    ThreatLevel["MEDIUM"] = "MEDIUM";
    ThreatLevel["LOW"] = "LOW";
    ThreatLevel["INFO"] = "INFO";
})(ThreatLevel || (exports.ThreatLevel = ThreatLevel = {}));
/**
 * インシデント状態
 */
var IncidentStatus;
(function (IncidentStatus) {
    IncidentStatus["OPEN"] = "OPEN";
    IncidentStatus["INVESTIGATING"] = "INVESTIGATING";
    IncidentStatus["CONTAINED"] = "CONTAINED";
    IncidentStatus["RESOLVED"] = "RESOLVED";
    IncidentStatus["CLOSED"] = "CLOSED";
})(IncidentStatus || (exports.IncidentStatus = IncidentStatus = {}));
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
class SecurityMonitoringSystem extends constructs_1.Construct {
    securityEventsTable;
    incidentsTable;
    threatIntelTable;
    threatDetectorFunction;
    incidentResponderFunction;
    securityAnalyzerFunction;
    alertManagerFunction;
    securityWorkflow;
    securityAlertTopic;
    securityLogGroup;
    globalConfig;
    securityConfig;
    constructor(scope, id, props) {
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
    createSecurityEventsTable() {
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
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
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
    createIncidentsTable() {
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
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
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
    createThreatIntelTable() {
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
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            timeToLiveAttribute: 'ttl'
        });
    }
    /**
     * セキュリティログ群の作成
     */
    createSecurityLogGroup() {
        return new logs.LogGroup(this, 'SecurityLogGroup', {
            logGroupName: `/aws/${this.globalConfig.projectName}/security/${this.globalConfig.environment}`,
            retention: logs.RetentionDays.ONE_YEAR,
            removalPolicy: this.globalConfig.environment === 'prod' ?
                aws_cdk_lib_1.RemovalPolicy.RETAIN :
                aws_cdk_lib_1.RemovalPolicy.DESTROY
        });
    }
    /**
     * セキュリティアラートトピックの作成
     */
    createSecurityAlertTopic() {
        return new sns.Topic(this, 'SecurityAlerts', {
            topicName: `${this.globalConfig.projectName}-security-alerts`,
            displayName: 'Security Monitoring Alerts'
        });
    }
    /**
     * 脅威検出Lambda関数
     */
    createThreatDetectorFunction() {
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
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            environment: {
                SECURITY_EVENTS_TABLE: this.securityEventsTable.tableName,
                INCIDENTS_TABLE: this.incidentsTable.tableName,
                SECURITY_LOG_GROUP: this.securityLogGroup.logGroupName,
                INCIDENT_RESPONDER_FUNCTION: this.incidentResponderFunction.functionName
            }
        });
    } /*
  *
     * インシデント対応Lambda関数
     */
    createIncidentResponderFunction() {
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
            timeout: aws_cdk_lib_1.Duration.minutes(10),
            environment: {
                INCIDENTS_TABLE: this.incidentsTable.tableName,
                SECURITY_ALERT_TOPIC: this.securityAlertTopic.topicArn
            }
        });
    }
    /**
     * セキュリティ分析Lambda関数
     */
    createSecurityAnalyzerFunction() {
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
            timeout: aws_cdk_lib_1.Duration.minutes(10),
            environment: {
                SECURITY_EVENTS_TABLE: this.securityEventsTable.tableName,
                INCIDENTS_TABLE: this.incidentsTable.tableName
            }
        });
    }
    /**
     * アラート管理Lambda関数
     */
    createAlertManagerFunction() {
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
            timeout: aws_cdk_lib_1.Duration.minutes(5),
            environment: {
                SECURITY_ALERT_TOPIC: this.securityAlertTopic.topicArn
            }
        });
    }
    /**
     * Step Functions ワークフローの作成
     */
    createSecurityWorkflow() {
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
            .when(stepfunctions.Condition.or(stepfunctions.Condition.numberGreaterThan('$.summary.byLevel.CRITICAL', 0), stepfunctions.Condition.numberGreaterThan('$.summary.byLevel.HIGH', 0)), respondToIncident)
            .otherwise(analyzeSecurityData))
            .next(securitySuccess);
        return new stepfunctions.StateMachine(this, 'SecurityWorkflow', {
            stateMachineName: `${this.globalConfig.projectName}-security-workflow`,
            definition,
            timeout: aws_cdk_lib_1.Duration.hours(1)
        });
    }
    /**
     * 監視スケジュールの作成
     */
    createMonitoringSchedules() {
        // 脅威検出定期実行
        const threatDetectionSchedule = new events.Rule(this, 'ThreatDetectionSchedule', {
            ruleName: `${this.globalConfig.projectName}-threat-detection-schedule`,
            description: 'Regular threat detection execution',
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.minutes(this.securityConfig.monitoringIntervalMinutes))
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
    createSecurityEventRules() {
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
    setupIamPermissions() {
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
    initialize() {
        // IAM権限の設定
        this.setupIamPermissions();
    }
}
exports.SecurityMonitoringSystem = SecurityMonitoringSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktbW9uaXRvcmluZy1zeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1tb25pdG9yaW5nLXN5c3RlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUF1QztBQUN2Qyw2Q0FBc0Q7QUFDdEQsK0RBQWlEO0FBQ2pELG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUUzQywyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLDZFQUErRDtBQUMvRCw4RUFBZ0U7QUF5QmhFOztHQUVHO0FBQ0gsSUFBWSxXQU1YO0FBTkQsV0FBWSxXQUFXO0lBQ3JCLG9DQUFxQixDQUFBO0lBQ3JCLDRCQUFhLENBQUE7SUFDYixnQ0FBaUIsQ0FBQTtJQUNqQiwwQkFBVyxDQUFBO0lBQ1gsNEJBQWEsQ0FBQTtBQUNmLENBQUMsRUFOVyxXQUFXLDJCQUFYLFdBQVcsUUFNdEI7QUFFRDs7R0FFRztBQUNILElBQVksY0FNWDtBQU5ELFdBQVksY0FBYztJQUN4QiwrQkFBYSxDQUFBO0lBQ2IsaURBQStCLENBQUE7SUFDL0IseUNBQXVCLENBQUE7SUFDdkIsdUNBQXFCLENBQUE7SUFDckIsbUNBQWlCLENBQUE7QUFDbkIsQ0FBQyxFQU5XLGNBQWMsOEJBQWQsY0FBYyxRQU16QjtBQUVEOzs7Ozs7Ozs7R0FTRztBQUNILE1BQWEsd0JBQXlCLFNBQVEsc0JBQVM7SUFDckMsbUJBQW1CLENBQWlCO0lBQ3BDLGNBQWMsQ0FBaUI7SUFDL0IsZ0JBQWdCLENBQWlCO0lBQ2pDLHNCQUFzQixDQUFrQjtJQUN4Qyx5QkFBeUIsQ0FBa0I7SUFDM0Msd0JBQXdCLENBQWtCO0lBQzFDLG9CQUFvQixDQUFrQjtJQUN0QyxnQkFBZ0IsQ0FBNkI7SUFDN0Msa0JBQWtCLENBQVk7SUFDOUIsZ0JBQWdCLENBQWdCO0lBRS9CLFlBQVksQ0FBa0I7SUFDOUIsY0FBYyxDQUEy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QUFtQjtRQUNuQixJQUFJLENBQUMsc0JBQXNCLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNsRSxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDO1lBQ2xDLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLENBQUM7U0FDeEQsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQ7O09BRUc7SUFDSSxVQUFVO1FBQ2YsV0FBVztRQUNYLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0lBQzdCLENBQUM7Q0FDRjtBQXIwQ0QsNERBcTBDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRHVyYXRpb24sIFJlbW92YWxQb2xpY3kgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc2ZuVGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgR2xvYmFsUmFnQ29uZmlnIH0gZnJvbSAnLi4vLi4vdHlwZXMvZ2xvYmFsLWNvbmZpZyc7XG5cbi8qKlxuICog44K744Kt44Ol44Oq44OG44Kj55uj6KaW6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2VjdXJpdHlNb25pdG9yaW5nQ29uZmlnIHtcbiAgLyoqIOiEheWogeaknOWHuuaEn+W6puODrOODmeODqyAqL1xuICB0aHJlYXREZXRlY3Rpb25TZW5zaXRpdml0eTogJ0xPVycgfCAnTUVESVVNJyB8ICdISUdIJyB8ICdDUklUSUNBTCc7XG4gIC8qKiDnm6PoppbplpPpmpTvvIjliIbvvIkgKi9cbiAgbW9uaXRvcmluZ0ludGVydmFsTWludXRlczogbnVtYmVyO1xuICAvKiog44Kk44Oz44K344OH44Oz44OI5a++5b+cU0xB77yI5YiG77yJICovXG4gIGluY2lkZW50UmVzcG9uc2VTbGFNaW51dGVzOiBudW1iZXI7XG4gIC8qKiDoh6rli5Xlr77lv5zmnInlirnljJYgKi9cbiAgYXV0b1Jlc3BvbnNlRW5hYmxlZDogYm9vbGVhbjtcbiAgLyoqIOebo+imluWvvuixoeWcsOWfnyAqL1xuICBtb25pdG9yZWRSZWdpb25zOiBzdHJpbmdbXTtcbiAgLyoqIOOCouODqeODvOODiOmAmuefpeioreWumiAqL1xuICBhbGVydFNldHRpbmdzOiB7XG4gICAgZW1haWw6IHN0cmluZ1tdO1xuICAgIHNtczogc3RyaW5nW107XG4gICAgd2ViaG9vaz86IHN0cmluZztcbiAgfTtcbn1cblxuLyoqXG4gKiDjgrvjgq3jg6Xjg6rjg4bjgqPohIXlqIHjg6zjg5njg6tcbiAqL1xuZXhwb3J0IGVudW0gVGhyZWF0TGV2ZWwge1xuICBDUklUSUNBTCA9ICdDUklUSUNBTCcsXG4gIEhJR0ggPSAnSElHSCcsXG4gIE1FRElVTSA9ICdNRURJVU0nLFxuICBMT1cgPSAnTE9XJyxcbiAgSU5GTyA9ICdJTkZPJ1xufVxuXG4vKipcbiAqIOOCpOODs+OCt+ODh+ODs+ODiOeKtuaFi1xuICovXG5leHBvcnQgZW51bSBJbmNpZGVudFN0YXR1cyB7XG4gIE9QRU4gPSAnT1BFTicsXG4gIElOVkVTVElHQVRJTkcgPSAnSU5WRVNUSUdBVElORycsXG4gIENPTlRBSU5FRCA9ICdDT05UQUlORUQnLFxuICBSRVNPTFZFRCA9ICdSRVNPTFZFRCcsXG4gIENMT1NFRCA9ICdDTE9TRUQnXG59XG5cbi8qKlxuICog57Wx5LiA44K744Kt44Ol44Oq44OG44Kj55uj6KaW44K344K544OG44OgXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0g57Wx5LiA44K744Kt44Ol44Oq44OG44Kj5Z+65rqW55uj6KaWXG4gKiAtIOiEheWogeaknOWHuuOCt+OCueODhuODoFxuICogLSDjgqTjg7Pjgrfjg4fjg7Pjg4jlr77lv5zoh6rli5XljJZcbiAqIC0g44K744Kt44Ol44Oq44OG44Kj44Oh44OI44Oq44Kv44K55Y+O6ZuGXG4gKiAtIOODquOCouODq+OCv+OCpOODoOOCouODqeODvOODiFxuICovXG5leHBvcnQgY2xhc3MgU2VjdXJpdHlNb25pdG9yaW5nU3lzdGVtIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5RXZlbnRzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgaW5jaWRlbnRzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgdGhyZWF0SW50ZWxUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSB0aHJlYXREZXRlY3RvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBpbmNpZGVudFJlc3BvbmRlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzZWN1cml0eUFuYWx5emVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFsZXJ0TWFuYWdlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzZWN1cml0eVdvcmtmbG93OiBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZTtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5QWxlcnRUb3BpYzogc25zLlRvcGljO1xuICBwdWJsaWMgcmVhZG9ubHkgc2VjdXJpdHlMb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcblxuICBwcml2YXRlIHJlYWRvbmx5IGdsb2JhbENvbmZpZzogR2xvYmFsUmFnQ29uZmlnO1xuICBwcml2YXRlIHJlYWRvbmx5IHNlY3VyaXR5Q29uZmlnOiBTZWN1cml0eU1vbml0b3JpbmdDb25maWc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IHtcbiAgICBnbG9iYWxDb25maWc6IEdsb2JhbFJhZ0NvbmZpZztcbiAgICBzZWN1cml0eUNvbmZpZzogU2VjdXJpdHlNb25pdG9yaW5nQ29uZmlnO1xuICB9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIHRoaXMuZ2xvYmFsQ29uZmlnID0gcHJvcHMuZ2xvYmFsQ29uZmlnO1xuICAgIHRoaXMuc2VjdXJpdHlDb25maWcgPSBwcm9wcy5zZWN1cml0eUNvbmZpZztcblxuICAgIC8vIER5bmFtb0RC44OG44O844OW44Or5L2c5oiQXG4gICAgdGhpcy5zZWN1cml0eUV2ZW50c1RhYmxlID0gdGhpcy5jcmVhdGVTZWN1cml0eUV2ZW50c1RhYmxlKCk7XG4gICAgdGhpcy5pbmNpZGVudHNUYWJsZSA9IHRoaXMuY3JlYXRlSW5jaWRlbnRzVGFibGUoKTtcbiAgICB0aGlzLnRocmVhdEludGVsVGFibGUgPSB0aGlzLmNyZWF0ZVRocmVhdEludGVsVGFibGUoKTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc1xuICAgIHRoaXMuc2VjdXJpdHlMb2dHcm91cCA9IHRoaXMuY3JlYXRlU2VjdXJpdHlMb2dHcm91cCgpO1xuXG4gICAgLy8gU05T6YCa55+l44OI44OU44OD44KvXG4gICAgdGhpcy5zZWN1cml0eUFsZXJ0VG9waWMgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5QWxlcnRUb3BpYygpO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgdGhpcy50aHJlYXREZXRlY3RvckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVUaHJlYXREZXRlY3RvckZ1bmN0aW9uKCk7XG4gICAgdGhpcy5pbmNpZGVudFJlc3BvbmRlckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVJbmNpZGVudFJlc3BvbmRlckZ1bmN0aW9uKCk7XG4gICAgdGhpcy5zZWN1cml0eUFuYWx5emVyRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZVNlY3VyaXR5QW5hbHl6ZXJGdW5jdGlvbigpO1xuICAgIHRoaXMuYWxlcnRNYW5hZ2VyRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUFsZXJ0TWFuYWdlckZ1bmN0aW9uKCk7XG5cbiAgICAvLyBTdGVwIEZ1bmN0aW9ucyDjg6/jg7zjgq/jg5Xjg63jg7xcbiAgICB0aGlzLnNlY3VyaXR5V29ya2Zsb3cgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5V29ya2Zsb3coKTtcblxuICAgIC8vIOebo+imluOCueOCseOCuOODpeODvOODq+ioreWumlxuICAgIHRoaXMuY3JlYXRlTW9uaXRvcmluZ1NjaGVkdWxlcygpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCDjgqTjg5njg7Pjg4jjg6vjg7zjg6voqK3lrppcbiAgICB0aGlzLmNyZWF0ZVNlY3VyaXR5RXZlbnRSdWxlcygpO1xuICB9IFxuIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgqTjg5njg7Pjg4jjg4bjg7zjg5bjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlFdmVudHNUYWJsZSgpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgcmV0dXJuIG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU2VjdXJpdHlFdmVudHNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LXNlY3VyaXR5LWV2ZW50c2AsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2V2ZW50SWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgICBnbG9iYWxTZWNvbmRhcnlJbmRleGVzOiBbe1xuICAgICAgICBpbmRleE5hbWU6ICdUaHJlYXRMZXZlbEluZGV4JyxcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgICAgbmFtZTogJ3RocmVhdExldmVsJyxcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgICB9LFxuICAgICAgICBzb3J0S2V5OiB7XG4gICAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgICAgfVxuICAgICAgfSwge1xuICAgICAgICBpbmRleE5hbWU6ICdSZWdpb25JbmRleCcsXG4gICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgIG5hbWU6ICdyZWdpb24nLFxuICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICAgIH0sXG4gICAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgICBuYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCpOODs+OCt+ODh+ODs+ODiOODhuODvOODluODq+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVJbmNpZGVudHNUYWJsZSgpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgcmV0dXJuIG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSW5jaWRlbnRzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1zZWN1cml0eS1pbmNpZGVudHNgLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdpbmNpZGVudElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICAgIGdsb2JhbFNlY29uZGFyeUluZGV4ZXM6IFt7XG4gICAgICAgIGluZGV4TmFtZTogJ1N0YXR1c0luZGV4JyxcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgICAgbmFtZTogJ3N0YXR1cycsXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgICAgfSxcbiAgICAgICAgc29ydEtleToge1xuICAgICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICAgIH1cbiAgICAgIH0sIHtcbiAgICAgICAgaW5kZXhOYW1lOiAnU2V2ZXJpdHlJbmRleCcsXG4gICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgIG5hbWU6ICdzZXZlcml0eScsXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgICAgfSxcbiAgICAgICAgc29ydEtleToge1xuICAgICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog6ISF5aiB44Kk44Oz44OG44Oq44K444Kn44Oz44K544OG44O844OW44Or44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVRocmVhdEludGVsVGFibGUoKTogZHluYW1vZGIuVGFibGUge1xuICAgIHJldHVybiBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1RocmVhdEludGVsVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS10aHJlYXQtaW50ZWxsaWdlbmNlYCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndGhyZWF0SWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Ot44Kw576k44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNlY3VyaXR5TG9nR3JvdXAoKTogbG9ncy5Mb2dHcm91cCB7XG4gICAgcmV0dXJuIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdTZWN1cml0eUxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy8ke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS9zZWN1cml0eS8ke3RoaXMuZ2xvYmFsQ29uZmlnLmVudmlyb25tZW50fWAsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfWUVBUixcbiAgICAgIHJlbW92YWxQb2xpY3k6IHRoaXMuZ2xvYmFsQ29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyBcbiAgICAgICAgUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBcbiAgICAgICAgUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Ki44Op44O844OI44OI44OU44OD44Kv44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNlY3VyaXR5QWxlcnRUb3BpYygpOiBzbnMuVG9waWMge1xuICAgIHJldHVybiBuZXcgc25zLlRvcGljKHRoaXMsICdTZWN1cml0eUFsZXJ0cycsIHtcbiAgICAgIHRvcGljTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LXNlY3VyaXR5LWFsZXJ0c2AsXG4gICAgICBkaXNwbGF5TmFtZTogJ1NlY3VyaXR5IE1vbml0b3JpbmcgQWxlcnRzJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOiEheWogeaknOWHukxhbWJkYemWouaVsFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVUaHJlYXREZXRlY3RvckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1RocmVhdERldGVjdG9yRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS10aHJlYXQtZGV0ZWN0b3JgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQoKTtcbiAgICAgICAgY29uc3QgY2xvdWR3YXRjaGxvZ3MgPSBuZXcgQVdTLkNsb3VkV2F0Y2hMb2dzKCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygn6ISF5aiB5qSc5Ye66ZaL5aeLOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRldGVjdGlvblJlc3VsdHMgPSBbXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5ZCE5Zyw5Z+f44Gn44Gu6ISF5aiB5qSc5Ye65a6f6KGMXG4gICAgICAgICAgICBjb25zdCByZWdpb25zID0gJHtKU09OLnN0cmluZ2lmeSh0aGlzLnNlY3VyaXR5Q29uZmlnLm1vbml0b3JlZFJlZ2lvbnMpfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZm9yIChjb25zdCByZWdpb24gb2YgcmVnaW9ucykge1xuICAgICAgICAgICAgICBjb25zdCB0aHJlYXRzID0gYXdhaXQgZGV0ZWN0VGhyZWF0c0luUmVnaW9uKHJlZ2lvbik7XG4gICAgICAgICAgICAgIGRldGVjdGlvblJlc3VsdHMucHVzaCguLi50aHJlYXRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5qSc5Ye644GV44KM44Gf6ISF5aiB44Gu5Yem55CGXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRocmVhdCBvZiBkZXRlY3Rpb25SZXN1bHRzKSB7XG4gICAgICAgICAgICAgIGF3YWl0IHByb2Nlc3NEZXRlY3RlZFRocmVhdCh0aHJlYXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDohIXlqIHjg6zjg5njg6vliKXjgrXjg57jg6rjg7xcbiAgICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPSBnZW5lcmF0ZVRocmVhdFN1bW1hcnkoZGV0ZWN0aW9uUmVzdWx0cyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIHRocmVhdHNEZXRlY3RlZDogZGV0ZWN0aW9uUmVzdWx0cy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgc3VtbWFyeSxcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfohIXlqIHmpJzlh7rjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gZGV0ZWN0VGhyZWF0c0luUmVnaW9uKHJlZ2lvbikge1xuICAgICAgICAgIGNvbnN0IHRocmVhdHMgPSBbXTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDnlbDluLjjgapBUEnlkbzjgbPlh7rjgZfjg5Hjgr/jg7zjg7Pjga7mpJzlh7pcbiAgICAgICAgICBjb25zdCBhcGlUaHJlYXRzID0gYXdhaXQgZGV0ZWN0QW5vbWFsb3VzQXBpQ2FsbHMocmVnaW9uKTtcbiAgICAgICAgICB0aHJlYXRzLnB1c2goLi4uYXBpVGhyZWF0cyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5LiN5q2j44Ki44Kv44K744K56Kmm6KGM44Gu5qSc5Ye6XG4gICAgICAgICAgY29uc3QgYWNjZXNzVGhyZWF0cyA9IGF3YWl0IGRldGVjdFVuYXV0aG9yaXplZEFjY2VzcyhyZWdpb24pO1xuICAgICAgICAgIHRocmVhdHMucHVzaCguLi5hY2Nlc3NUaHJlYXRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjg4fjg7zjgr/mvI/mtKnjga7lhYblgJnmpJzlh7pcbiAgICAgICAgICBjb25zdCBkYXRhVGhyZWF0cyA9IGF3YWl0IGRldGVjdERhdGFFeGZpbHRyYXRpb24ocmVnaW9uKTtcbiAgICAgICAgICB0aHJlYXRzLnB1c2goLi4uZGF0YVRocmVhdHMpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOioreWumuWkieabtOOBruebo+imllxuICAgICAgICAgIGNvbnN0IGNvbmZpZ1RocmVhdHMgPSBhd2FpdCBkZXRlY3RTdXNwaWNpb3VzQ29uZmlnQ2hhbmdlcyhyZWdpb24pO1xuICAgICAgICAgIHRocmVhdHMucHVzaCguLi5jb25maWdUaHJlYXRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gdGhyZWF0cztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gZGV0ZWN0QW5vbWFsb3VzQXBpQ2FsbHMocmVnaW9uKSB7XG4gICAgICAgICAgLy8gQ2xvdWRUcmFpbOODreOCsOOBi+OCieeVsOW4uOOBqkFQSeWRvOOBs+WHuuOBl+OCkuaknOWHulxuICAgICAgICAgIGNvbnN0IHRocmVhdHMgPSBbXTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDnn63mmYLplpPjgafjga7lpKfph49BUEnlkbzjgbPlh7rjgZdcbiAgICAgICAgICBjb25zdCBoaWdoVm9sdW1lVGhyZWF0cyA9IGF3YWl0IGNoZWNrSGlnaFZvbHVtZUFwaUNhbGxzKHJlZ2lvbik7XG4gICAgICAgICAgdGhyZWF0cy5wdXNoKC4uLmhpZ2hWb2x1bWVUaHJlYXRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDpgJrluLjjgajnlbDjgarjgovmmYLplpPluK/jgafjga5BUEnlkbzjgbPlh7rjgZdcbiAgICAgICAgICBjb25zdCBvZmZIb3Vyc1RocmVhdHMgPSBhd2FpdCBjaGVja09mZkhvdXJzQXBpQ2FsbHMocmVnaW9uKTtcbiAgICAgICAgICB0aHJlYXRzLnB1c2goLi4ub2ZmSG91cnNUaHJlYXRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDmqKnpmZDmmIfmoLzjga7oqabooYxcbiAgICAgICAgICBjb25zdCBwcml2aWxlZ2VFc2NhbGF0aW9uVGhyZWF0cyA9IGF3YWl0IGNoZWNrUHJpdmlsZWdlRXNjYWxhdGlvbihyZWdpb24pO1xuICAgICAgICAgIHRocmVhdHMucHVzaCguLi5wcml2aWxlZ2VFc2NhbGF0aW9uVGhyZWF0cyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHRocmVhdHM7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrSGlnaFZvbHVtZUFwaUNhbGxzKHJlZ2lvbikge1xuICAgICAgICAgIC8vIOewoeeVpeWMluOBleOCjOOBn+Wun+ijhVxuICAgICAgICAgIGNvbnN0IG1vY2tUaHJlYXQgPSBNYXRoLnJhbmRvbSgpIDwgMC4xOyAvLyAxMCXjga7norrnjofjgafohIXlqIHmpJzlh7pcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAobW9ja1RocmVhdCkge1xuICAgICAgICAgICAgcmV0dXJuIFt7XG4gICAgICAgICAgICAgIHRocmVhdElkOiBcXGB0aHJlYXQtXFwke0RhdGUubm93KCl9LVxcJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSl9XFxgLFxuICAgICAgICAgICAgICB0eXBlOiAnQU5PTUFMT1VTX0FQSV9WT0xVTUUnLFxuICAgICAgICAgICAgICB0aHJlYXRMZXZlbDogJ01FRElVTScsXG4gICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfnn63mmYLplpPjgafjga7nlbDluLjjgavlpJrjgYRBUEnlkbzjgbPlh7rjgZfjgYzmpJzlh7rjgZXjgozjgb7jgZfjgZ8nLFxuICAgICAgICAgICAgICBzb3VyY2VJcDogJzE5Mi4xNjguMS4xMDAnLFxuICAgICAgICAgICAgICB1c2VyQWdlbnQ6ICdhd3MtY2xpLzIuMC4wJyxcbiAgICAgICAgICAgICAgYXBpQ2FsbENvdW50OiAxNTAwLFxuICAgICAgICAgICAgICB0aW1lV2luZG93OiAnNeWIhumWkycsXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuICAgICAgICAgICAgfV07XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tPZmZIb3Vyc0FwaUNhbGxzKHJlZ2lvbikge1xuICAgICAgICAgIGNvbnN0IGN1cnJlbnRIb3VyID0gbmV3IERhdGUoKS5nZXRIb3VycygpO1xuICAgICAgICAgIGNvbnN0IGlzT2ZmSG91cnMgPSBjdXJyZW50SG91ciA8IDYgfHwgY3VycmVudEhvdXIgPiAyMjsgLy8gMjLmmYItNuaZguOCkuWWtualreaZgumWk+WkluOBqOOBmeOCi1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChpc09mZkhvdXJzICYmIE1hdGgucmFuZG9tKCkgPCAwLjA1KSB7IC8vIDUl44Gu56K6546H44Gn6ISF5aiB5qSc5Ye6XG4gICAgICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICAgICAgdGhyZWF0SWQ6IFxcYHRocmVhdC1cXCR7RGF0ZS5ub3coKX0tXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGAsXG4gICAgICAgICAgICAgIHR5cGU6ICdPRkZfSE9VUlNfQUNUSVZJVFknLFxuICAgICAgICAgICAgICB0aHJlYXRMZXZlbDogJ0xPVycsXG4gICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfllrbmpa3mmYLplpPlpJbjgafjga7nrqHnkIbogIXmqKnpmZBBUEnlkbzjgbPlh7rjgZfjgYzmpJzlh7rjgZXjgozjgb7jgZfjgZ8nLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgICAgIH1dO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrUHJpdmlsZWdlRXNjYWxhdGlvbihyZWdpb24pIHtcbiAgICAgICAgICBjb25zdCBtb2NrVGhyZWF0ID0gTWF0aC5yYW5kb20oKSA8IDAuMDI7IC8vIDIl44Gu56K6546H44Gn6ISF5aiB5qSc5Ye6XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKG1vY2tUaHJlYXQpIHtcbiAgICAgICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgICB0aHJlYXRJZDogXFxgdGhyZWF0LVxcJHtEYXRlLm5vdygpfS1cXCR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDkpfVxcYCxcbiAgICAgICAgICAgICAgdHlwZTogJ1BSSVZJTEVHRV9FU0NBTEFUSU9OJyxcbiAgICAgICAgICAgICAgdGhyZWF0TGV2ZWw6ICdISUdIJyxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aoqemZkOaYh+agvOOBruippuihjOOBjOaknOWHuuOBleOCjOOBvuOBl+OBnycsXG4gICAgICAgICAgICAgIHRhcmdldFJlc291cmNlOiAnSUFNIFJvbGUnLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgICAgIH1dO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGRldGVjdFVuYXV0aG9yaXplZEFjY2VzcyhyZWdpb24pIHtcbiAgICAgICAgICBjb25zdCB0aHJlYXRzID0gW107XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g6KSH5pWw5Zue44Gu6KqN6Ki85aSx5pWXXG4gICAgICAgICAgY29uc3QgYnJ1dGVGb3JjZVRocmVhdHMgPSBhd2FpdCBjaGVja0JydXRlRm9yY2VBdHRlbXB0cyhyZWdpb24pO1xuICAgICAgICAgIHRocmVhdHMucHVzaCguLi5icnV0ZUZvcmNlVGhyZWF0cyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5LiN5q2j44GqSVDjgqLjg4njg6zjgrnjgYvjgonjga7jgqLjgq/jgrvjgrlcbiAgICAgICAgICBjb25zdCBzdXNwaWNpb3VzSXBUaHJlYXRzID0gYXdhaXQgY2hlY2tTdXNwaWNpb3VzSXBBY2Nlc3MocmVnaW9uKTtcbiAgICAgICAgICB0aHJlYXRzLnB1c2goLi4uc3VzcGljaW91c0lwVGhyZWF0cyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHRocmVhdHM7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrQnJ1dGVGb3JjZUF0dGVtcHRzKHJlZ2lvbikge1xuICAgICAgICAgIGNvbnN0IG1vY2tUaHJlYXQgPSBNYXRoLnJhbmRvbSgpIDwgMC4wMzsgLy8gMyXjga7norrnjofjgafohIXlqIHmpJzlh7pcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAobW9ja1RocmVhdCkge1xuICAgICAgICAgICAgcmV0dXJuIFt7XG4gICAgICAgICAgICAgIHRocmVhdElkOiBcXGB0aHJlYXQtXFwke0RhdGUubm93KCl9LVxcJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSl9XFxgLFxuICAgICAgICAgICAgICB0eXBlOiAnQlJVVEVfRk9SQ0VfQVRUQUNLJyxcbiAgICAgICAgICAgICAgdGhyZWF0TGV2ZWw6ICdISUdIJyxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+efreaZgumWk+OBp+OBruikh+aVsOWbnuiqjeiovOWkseaVl+OBjOaknOWHuuOBleOCjOOBvuOBl+OBnycsXG4gICAgICAgICAgICAgIHNvdXJjZUlwOiAnMjAzLjAuMTEzLjEnLFxuICAgICAgICAgICAgICBmYWlsZWRBdHRlbXB0czogMjUsXG4gICAgICAgICAgICAgIHRpbWVXaW5kb3c6ICcxMOWIhumWkycsXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuICAgICAgICAgICAgfV07XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tTdXNwaWNpb3VzSXBBY2Nlc3MocmVnaW9uKSB7XG4gICAgICAgICAgY29uc3QgbW9ja1RocmVhdCA9IE1hdGgucmFuZG9tKCkgPCAwLjAyOyAvLyAyJeOBrueiuueOh+OBp+iEheWogeaknOWHulxuICAgICAgICAgIFxuICAgICAgICAgIGlmIChtb2NrVGhyZWF0KSB7XG4gICAgICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICAgICAgdGhyZWF0SWQ6IFxcYHRocmVhdC1cXCR7RGF0ZS5ub3coKX0tXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGAsXG4gICAgICAgICAgICAgIHR5cGU6ICdTVVNQSUNJT1VTX0lQX0FDQ0VTUycsXG4gICAgICAgICAgICAgIHRocmVhdExldmVsOiAnTUVESVVNJyxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ+aXouefpeOBruaCquaEj+OBguOCi0lQ44Ki44OJ44Os44K544GL44KJ44Gu44Ki44Kv44K744K544GM5qSc5Ye644GV44KM44G+44GX44GfJyxcbiAgICAgICAgICAgICAgc291cmNlSXA6ICcxOTguNTEuMTAwLjEnLFxuICAgICAgICAgICAgICBnZW9Mb2NhdGlvbjogJ1Vua25vd24nLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgICAgIH1dO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGRldGVjdERhdGFFeGZpbHRyYXRpb24ocmVnaW9uKSB7XG4gICAgICAgICAgY29uc3QgbW9ja1RocmVhdCA9IE1hdGgucmFuZG9tKCkgPCAwLjAxOyAvLyAxJeOBrueiuueOh+OBp+iEheWogeaknOWHulxuICAgICAgICAgIFxuICAgICAgICAgIGlmIChtb2NrVGhyZWF0KSB7XG4gICAgICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICAgICAgdGhyZWF0SWQ6IFxcYHRocmVhdC1cXCR7RGF0ZS5ub3coKX0tXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGAsXG4gICAgICAgICAgICAgIHR5cGU6ICdEQVRBX0VYRklMVFJBVElPTicsXG4gICAgICAgICAgICAgIHRocmVhdExldmVsOiAnQ1JJVElDQUwnLFxuICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5aSn6YeP44Gu44OH44O844K/44OA44Km44Oz44Ot44O844OJ44GM5qSc5Ye644GV44KM44G+44GX44GfJyxcbiAgICAgICAgICAgICAgZGF0YVZvbHVtZTogJzEwR0InLFxuICAgICAgICAgICAgICB0aW1lV2luZG93OiAnMzDliIbplpMnLFxuICAgICAgICAgICAgICB0YXJnZXRSZXNvdXJjZTogJ1MzIEJ1Y2tldCcsXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuICAgICAgICAgICAgfV07XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gZGV0ZWN0U3VzcGljaW91c0NvbmZpZ0NoYW5nZXMocmVnaW9uKSB7XG4gICAgICAgICAgY29uc3QgbW9ja1RocmVhdCA9IE1hdGgucmFuZG9tKCkgPCAwLjA1OyAvLyA1JeOBrueiuueOh+OBp+iEheWogeaknOWHulxuICAgICAgICAgIFxuICAgICAgICAgIGlmIChtb2NrVGhyZWF0KSB7XG4gICAgICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICAgICAgdGhyZWF0SWQ6IFxcYHRocmVhdC1cXCR7RGF0ZS5ub3coKX0tXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGAsXG4gICAgICAgICAgICAgIHR5cGU6ICdTVVNQSUNJT1VTX0NPTkZJR19DSEFOR0UnLFxuICAgICAgICAgICAgICB0aHJlYXRMZXZlbDogJ01FRElVTScsXG4gICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICfjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjga7oqK3lrprlpInmm7TjgYzmpJzlh7rjgZXjgozjgb7jgZfjgZ8nLFxuICAgICAgICAgICAgICBjaGFuZ2VkUmVzb3VyY2U6ICdTZWN1cml0eSBHcm91cCcsXG4gICAgICAgICAgICAgIGNoYW5nZVR5cGU6ICdSdWxlIEFkZGl0aW9uJyxcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiBwcm9jZXNzRGV0ZWN0ZWRUaHJlYXQodGhyZWF0KSB7XG4gICAgICAgICAgLy8g44K744Kt44Ol44Oq44OG44Kj44Kk44OZ44Oz44OI44Go44GX44Gm6KiY6YyyXG4gICAgICAgICAgYXdhaXQgcmVjb3JkU2VjdXJpdHlFdmVudCh0aHJlYXQpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOiEheWogeODrOODmeODq+OBq+W/nOOBmOOBn+WHpueQhlxuICAgICAgICAgIGlmICh0aHJlYXQudGhyZWF0TGV2ZWwgPT09ICdDUklUSUNBTCcgfHwgdGhyZWF0LnRocmVhdExldmVsID09PSAnSElHSCcpIHtcbiAgICAgICAgICAgIGF3YWl0IGNyZWF0ZVNlY3VyaXR5SW5jaWRlbnQodGhyZWF0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44Ot44Kw6KiY6YyyXG4gICAgICAgICAgYXdhaXQgbG9nU2VjdXJpdHlFdmVudCh0aHJlYXQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiByZWNvcmRTZWN1cml0eUV2ZW50KHRocmVhdCkge1xuICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICAgIFRhYmxlTmFtZTogJyR7dGhpcy5zZWN1cml0eUV2ZW50c1RhYmxlLnRhYmxlTmFtZX0nLFxuICAgICAgICAgICAgSXRlbToge1xuICAgICAgICAgICAgICBldmVudElkOiB0aHJlYXQudGhyZWF0SWQsXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogdGhyZWF0LnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgdGhyZWF0TGV2ZWw6IHRocmVhdC50aHJlYXRMZXZlbCxcbiAgICAgICAgICAgICAgcmVnaW9uOiB0aHJlYXQucmVnaW9uLFxuICAgICAgICAgICAgICB0eXBlOiB0aHJlYXQudHlwZSxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRocmVhdC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgZGV0YWlsczogdGhyZWF0LFxuICAgICAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKDM2NSAqIDI0ICogNjAgKiA2MCkgLy8gMeW5tOS/neaMgVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgZHluYW1vZGIucHV0KHBhcmFtcykucHJvbWlzZSgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjcmVhdGVTZWN1cml0eUluY2lkZW50KHRocmVhdCkge1xuICAgICAgICAgIGNvbnN0IGluY2lkZW50SWQgPSBcXGBpbmNpZGVudC1cXCR7RGF0ZS5ub3coKX0tXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGA7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgaW5jaWRlbnQgPSB7XG4gICAgICAgICAgICBpbmNpZGVudElkLFxuICAgICAgICAgICAgdGltZXN0YW1wOiB0aHJlYXQudGltZXN0YW1wLFxuICAgICAgICAgICAgc3RhdHVzOiAnT1BFTicsXG4gICAgICAgICAgICBzZXZlcml0eTogdGhyZWF0LnRocmVhdExldmVsLFxuICAgICAgICAgICAgdHlwZTogdGhyZWF0LnR5cGUsXG4gICAgICAgICAgICByZWdpb246IHRocmVhdC5yZWdpb24sXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogdGhyZWF0LmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgcmVsYXRlZEV2ZW50czogW3RocmVhdC50aHJlYXRJZF0sXG4gICAgICAgICAgICBhc3NpZ25lZFRvOiBnZXREZWZhdWx0QXNzaWduZWUodGhyZWF0LnRocmVhdExldmVsKSxcbiAgICAgICAgICAgIHNsYURlYWRsaW5lOiBuZXcgRGF0ZShEYXRlLm5vdygpICsgKCR7dGhpcy5zZWN1cml0eUNvbmZpZy5pbmNpZGVudFJlc3BvbnNlU2xhTWludXRlc30gKiA2MCAqIDEwMDApKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgdHRsOiBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArICgzNjUgKiAyNCAqIDYwICogNjApXG4gICAgICAgICAgfTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgICAgICBUYWJsZU5hbWU6ICcke3RoaXMuaW5jaWRlbnRzVGFibGUudGFibGVOYW1lfScsXG4gICAgICAgICAgICBJdGVtOiBpbmNpZGVudFxuICAgICAgICAgIH07XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgZHluYW1vZGIucHV0KHBhcmFtcykucHJvbWlzZSgpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOOCpOODs+OCt+ODh+ODs+ODiOWvvuW/nOiAheOBq+mAmuefpVxuICAgICAgICAgIGF3YWl0IG5vdGlmeUluY2lkZW50UmVzcG9uc2UoaW5jaWRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZXREZWZhdWx0QXNzaWduZWUodGhyZWF0TGV2ZWwpIHtcbiAgICAgICAgICBjb25zdCBhc3NpZ25lZXMgPSB7XG4gICAgICAgICAgICAnQ1JJVElDQUwnOiAnc2VjdXJpdHktdGVhbS1sZWFkJyxcbiAgICAgICAgICAgICdISUdIJzogJ3NlY3VyaXR5LWFuYWx5c3QnLFxuICAgICAgICAgICAgJ01FRElVTSc6ICdvcGVyYXRpb25zLXRlYW0nLFxuICAgICAgICAgICAgJ0xPVyc6ICdtb25pdG9yaW5nLXRlYW0nXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gYXNzaWduZWVzW3RocmVhdExldmVsXSB8fCAnc2VjdXJpdHktdGVhbSc7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIG5vdGlmeUluY2lkZW50UmVzcG9uc2UoaW5jaWRlbnQpIHtcbiAgICAgICAgICBjb25zdCBsYW1iZGEgPSBuZXcgQVdTLkxhbWJkYSgpO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGxhbWJkYS5pbnZva2Uoe1xuICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnJHt0aGlzLmluY2lkZW50UmVzcG9uZGVyRnVuY3Rpb24uZnVuY3Rpb25OYW1lfScsXG4gICAgICAgICAgICBJbnZvY2F0aW9uVHlwZTogJ0V2ZW50JyxcbiAgICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KGluY2lkZW50KVxuICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gbG9nU2VjdXJpdHlFdmVudCh0aHJlYXQpIHtcbiAgICAgICAgICBjb25zdCBsb2dFdmVudCA9IHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXZlbnRUeXBlOiAnVEhSRUFUX0RFVEVDVEVEJyxcbiAgICAgICAgICAgICAgdGhyZWF0SWQ6IHRocmVhdC50aHJlYXRJZCxcbiAgICAgICAgICAgICAgdGhyZWF0TGV2ZWw6IHRocmVhdC50aHJlYXRMZXZlbCxcbiAgICAgICAgICAgICAgdHlwZTogdGhyZWF0LnR5cGUsXG4gICAgICAgICAgICAgIHJlZ2lvbjogdGhyZWF0LnJlZ2lvbixcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRocmVhdC5kZXNjcmlwdGlvblxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNsb3Vkd2F0Y2hsb2dzLnB1dExvZ0V2ZW50cyh7XG4gICAgICAgICAgICBsb2dHcm91cE5hbWU6ICcke3RoaXMuc2VjdXJpdHlMb2dHcm91cC5sb2dHcm91cE5hbWV9JyxcbiAgICAgICAgICAgIGxvZ1N0cmVhbU5hbWU6IFxcYHRocmVhdC1kZXRlY3Rpb24tXFwke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdfVxcYCxcbiAgICAgICAgICAgIGxvZ0V2ZW50czogW2xvZ0V2ZW50XVxuICAgICAgICAgIH0pLnByb21pc2UoKS5jYXRjaChhc3luYyAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvci5jb2RlID09PSAnUmVzb3VyY2VOb3RGb3VuZEV4Y2VwdGlvbicpIHtcbiAgICAgICAgICAgICAgLy8g44Ot44Kw44K544OI44Oq44O844Og44GM5a2Y5Zyo44GX44Gq44GE5aC05ZCI44Gv5L2c5oiQXG4gICAgICAgICAgICAgIGF3YWl0IGNsb3Vkd2F0Y2hsb2dzLmNyZWF0ZUxvZ1N0cmVhbSh7XG4gICAgICAgICAgICAgICAgbG9nR3JvdXBOYW1lOiAnJHt0aGlzLnNlY3VyaXR5TG9nR3JvdXAubG9nR3JvdXBOYW1lfScsXG4gICAgICAgICAgICAgICAgbG9nU3RyZWFtTmFtZTogXFxgdGhyZWF0LWRldGVjdGlvbi1cXCR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF19XFxgXG4gICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIOWGjeippuihjFxuICAgICAgICAgICAgICBhd2FpdCBjbG91ZHdhdGNobG9ncy5wdXRMb2dFdmVudHMoe1xuICAgICAgICAgICAgICAgIGxvZ0dyb3VwTmFtZTogJyR7dGhpcy5zZWN1cml0eUxvZ0dyb3VwLmxvZ0dyb3VwTmFtZX0nLFxuICAgICAgICAgICAgICAgIGxvZ1N0cmVhbU5hbWU6IFxcYHRocmVhdC1kZXRlY3Rpb24tXFwke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdfVxcYCxcbiAgICAgICAgICAgICAgICBsb2dFdmVudHM6IFtsb2dFdmVudF1cbiAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZW5lcmF0ZVRocmVhdFN1bW1hcnkodGhyZWF0cykge1xuICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPSB7XG4gICAgICAgICAgICB0b3RhbDogdGhyZWF0cy5sZW5ndGgsXG4gICAgICAgICAgICBieUxldmVsOiB7XG4gICAgICAgICAgICAgIENSSVRJQ0FMOiB0aHJlYXRzLmZpbHRlcih0ID0+IHQudGhyZWF0TGV2ZWwgPT09ICdDUklUSUNBTCcpLmxlbmd0aCxcbiAgICAgICAgICAgICAgSElHSDogdGhyZWF0cy5maWx0ZXIodCA9PiB0LnRocmVhdExldmVsID09PSAnSElHSCcpLmxlbmd0aCxcbiAgICAgICAgICAgICAgTUVESVVNOiB0aHJlYXRzLmZpbHRlcih0ID0+IHQudGhyZWF0TGV2ZWwgPT09ICdNRURJVU0nKS5sZW5ndGgsXG4gICAgICAgICAgICAgIExPVzogdGhyZWF0cy5maWx0ZXIodCA9PiB0LnRocmVhdExldmVsID09PSAnTE9XJykubGVuZ3RoXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYnlUeXBlOiB7fVxuICAgICAgICAgIH07XG4gICAgICAgICAgXG4gICAgICAgICAgdGhyZWF0cy5mb3JFYWNoKHRocmVhdCA9PiB7XG4gICAgICAgICAgICBzdW1tYXJ5LmJ5VHlwZVt0aHJlYXQudHlwZV0gPSAoc3VtbWFyeS5ieVR5cGVbdGhyZWF0LnR5cGVdIHx8IDApICsgMTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gc3VtbWFyeTtcbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNFQ1VSSVRZX0VWRU5UU19UQUJMRTogdGhpcy5zZWN1cml0eUV2ZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgSU5DSURFTlRTX1RBQkxFOiB0aGlzLmluY2lkZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgU0VDVVJJVFlfTE9HX0dST1VQOiB0aGlzLnNlY3VyaXR5TG9nR3JvdXAubG9nR3JvdXBOYW1lLFxuICAgICAgICBJTkNJREVOVF9SRVNQT05ERVJfRlVOQ1RJT046IHRoaXMuaW5jaWRlbnRSZXNwb25kZXJGdW5jdGlvbi5mdW5jdGlvbk5hbWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfSAgLypcbipcbiAgICog44Kk44Oz44K344OH44Oz44OI5a++5b+cTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUluY2lkZW50UmVzcG9uZGVyRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSW5jaWRlbnRSZXNwb25kZXJGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LWluY2lkZW50LXJlc3BvbmRlcmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBjb25zdCBzbnMgPSBuZXcgQVdTLlNOUygpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+OCpOODs+OCt+ODh+ODs+ODiOWvvuW/nOmWi+WnizonLCBKU09OLnN0cmluZ2lmeShldmVudCkpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBpbmNpZGVudCA9IGV2ZW50O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjgqTjg7Pjgrfjg4fjg7Pjg4jnirbmhYvjgpLoqr/mn7vkuK3jgavmm7TmlrBcbiAgICAgICAgICAgIGF3YWl0IHVwZGF0ZUluY2lkZW50U3RhdHVzKGluY2lkZW50LmluY2lkZW50SWQsICdJTlZFU1RJR0FUSU5HJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOiHquWLleWvvuW/nOOBjOacieWKueOBquWgtOWQiOOBr+WIneacn+WvvuW/nOOCkuWun+ihjFxuICAgICAgICAgICAgaWYgKCR7dGhpcy5zZWN1cml0eUNvbmZpZy5hdXRvUmVzcG9uc2VFbmFibGVkfSkge1xuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZUFjdGlvbnMgPSBhd2FpdCBleGVjdXRlQXV0b1Jlc3BvbnNlKGluY2lkZW50KTtcbiAgICAgICAgICAgICAgYXdhaXQgdXBkYXRlSW5jaWRlbnRXaXRoQWN0aW9ucyhpbmNpZGVudC5pbmNpZGVudElkLCByZXNwb25zZUFjdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjgqLjg6njg7zjg4jpgIHkv6FcbiAgICAgICAgICAgIGF3YWl0IHNlbmRTZWN1cml0eUFsZXJ0KGluY2lkZW50KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g44Ko44K544Kr44Os44O844K344On44Oz5Yik5a6aXG4gICAgICAgICAgICBpZiAoc2hvdWxkRXNjYWxhdGUoaW5jaWRlbnQpKSB7XG4gICAgICAgICAgICAgIGF3YWl0IGVzY2FsYXRlSW5jaWRlbnQoaW5jaWRlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpbmNpZGVudElkOiBpbmNpZGVudC5pbmNpZGVudElkLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ0lOVkVTVElHQVRJTkcnLFxuICAgICAgICAgICAgICAgIGF1dG9SZXNwb25zZUV4ZWN1dGVkOiAke3RoaXMuc2VjdXJpdHlDb25maWcuYXV0b1Jlc3BvbnNlRW5hYmxlZH0sXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ+OCpOODs+OCt+ODh+ODs+ODiOWvvuW/nOOCkumWi+Wni+OBl+OBvuOBl+OBnydcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcign44Kk44Oz44K344OH44Oz44OI5a++5b+c44Ko44Op44O8OicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUluY2lkZW50U3RhdHVzKGluY2lkZW50SWQsIHN0YXR1cykge1xuICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICAgIFRhYmxlTmFtZTogJyR7dGhpcy5pbmNpZGVudHNUYWJsZS50YWJsZU5hbWV9JyxcbiAgICAgICAgICAgIEtleToge1xuICAgICAgICAgICAgICBpbmNpZGVudElkLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCkgLy8g5a6f6Zqb44Gu5a6f6KOF44Gn44Gv5q2j56K644Gq44K/44Kk44Og44K544K/44Oz44OX44GM5b+F6KaBXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgVXBkYXRlRXhwcmVzc2lvbjogJ1NFVCAjc3RhdHVzID0gOnN0YXR1cywgI3VwZGF0ZWRBdCA9IDp1cGRhdGVkQXQnLFxuICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICAgICAgICcjc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgICAgICAgICAgICcjdXBkYXRlZEF0JzogJ3VwZGF0ZWRBdCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgICAgICc6c3RhdHVzJzogc3RhdHVzLFxuICAgICAgICAgICAgICAnOnVwZGF0ZWRBdCc6IERhdGUubm93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnVwZGF0ZShwYXJhbXMpLnByb21pc2UoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZUF1dG9SZXNwb25zZShpbmNpZGVudCkge1xuICAgICAgICAgIGNvbnN0IGFjdGlvbnMgPSBbXTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjgqTjg7Pjgrfjg4fjg7Pjg4jjgr/jgqTjg5fjgavlv5zjgZjjgZ/oh6rli5Xlr77lv5xcbiAgICAgICAgICBzd2l0Y2ggKGluY2lkZW50LnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ0JSVVRFX0ZPUkNFX0FUVEFDSyc6XG4gICAgICAgICAgICAgIGFjdGlvbnMucHVzaChhd2FpdCBibG9ja1N1c3BpY2lvdXNJcChpbmNpZGVudCkpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ1BSSVZJTEVHRV9FU0NBTEFUSU9OJzpcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKGF3YWl0IHN1c3BlbmRTdXNwaWNpb3VzVXNlcihpbmNpZGVudCkpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0RBVEFfRVhGSUxUUkFUSU9OJzpcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKGF3YWl0IGJsb2NrRGF0YUFjY2VzcyhpbmNpZGVudCkpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ1NVU1BJQ0lPVVNfQ09ORklHX0NIQU5HRSc6XG4gICAgICAgICAgICAgIGFjdGlvbnMucHVzaChhd2FpdCByZXZlcnRDb25maWdDaGFuZ2UoaW5jaWRlbnQpKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBhY3Rpb25zLnB1c2goYXdhaXQgZW5hYmxlRW5oYW5jZWRNb25pdG9yaW5nKGluY2lkZW50KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBhY3Rpb25zLmZpbHRlcihhY3Rpb24gPT4gYWN0aW9uICE9PSBudWxsKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gYmxvY2tTdXNwaWNpb3VzSXAoaW5jaWRlbnQpIHtcbiAgICAgICAgICAvLyDnlpHjgo/jgZfjgYRJUOOCouODieODrOOCueOCkuODluODreODg+OCr1xuICAgICAgICAgIGNvbnNvbGUubG9nKFxcYElQ44Ki44OJ44Os44K544KS44OW44Ot44OD44Kv5LitOiBcXCR7aW5jaWRlbnQuZGV0YWlscz8uc291cmNlSXB9XFxgKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aW9uOiAnQkxPQ0tfSVAnLFxuICAgICAgICAgICAgdGFyZ2V0OiBpbmNpZGVudC5kZXRhaWxzPy5zb3VyY2VJcCxcbiAgICAgICAgICAgIHN0YXR1czogJ0VYRUNVVEVEJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIGRldGFpbHM6ICdTdXNwaWNpb3VzIElQIGFkZHJlc3MgYmxvY2tlZCBpbiBzZWN1cml0eSBncm91cCdcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzdXNwZW5kU3VzcGljaW91c1VzZXIoaW5jaWRlbnQpIHtcbiAgICAgICAgICAvLyDnlpHjgo/jgZfjgYTjg6bjg7zjgrbjg7zjgqLjgqvjgqbjg7Pjg4jjgpLkuIDmmYLlgZzmraJcbiAgICAgICAgICBjb25zb2xlLmxvZygn55aR44KP44GX44GE44Om44O844K244O844Ki44Kr44Km44Oz44OI44KS5LiA5pmC5YGc5q2i5LitJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFjdGlvbjogJ1NVU1BFTkRfVVNFUicsXG4gICAgICAgICAgICB0YXJnZXQ6IGluY2lkZW50LmRldGFpbHM/LnVzZXJJZCB8fCAndW5rbm93bicsXG4gICAgICAgICAgICBzdGF0dXM6ICdFWEVDVVRFRCcsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICBkZXRhaWxzOiAnVXNlciBhY2NvdW50IHRlbXBvcmFyaWx5IHN1c3BlbmRlZCBkdWUgdG8gcHJpdmlsZWdlIGVzY2FsYXRpb24gYXR0ZW1wdCdcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiBibG9ja0RhdGFBY2Nlc3MoaW5jaWRlbnQpIHtcbiAgICAgICAgICAvLyDjg4fjg7zjgr/jgqLjgq/jgrvjgrnjgpLjg5bjg63jg4Pjgq9cbiAgICAgICAgICBjb25zb2xlLmxvZyhcXGDjg4fjg7zjgr/jgqLjgq/jgrvjgrnjgpLjg5bjg63jg4Pjgq/kuK06IFxcJHtpbmNpZGVudC5kZXRhaWxzPy50YXJnZXRSZXNvdXJjZX1cXGApO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhY3Rpb246ICdCTE9DS19EQVRBX0FDQ0VTUycsXG4gICAgICAgICAgICB0YXJnZXQ6IGluY2lkZW50LmRldGFpbHM/LnRhcmdldFJlc291cmNlLFxuICAgICAgICAgICAgc3RhdHVzOiAnRVhFQ1VURUQnLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgZGV0YWlsczogJ0RhdGEgYWNjZXNzIGJsb2NrZWQgdG8gcHJldmVudCBmdXJ0aGVyIGV4ZmlsdHJhdGlvbidcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiByZXZlcnRDb25maWdDaGFuZ2UoaW5jaWRlbnQpIHtcbiAgICAgICAgICAvLyDoqK3lrprlpInmm7TjgpLlhYPjgavmiLvjgZlcbiAgICAgICAgICBjb25zb2xlLmxvZyhcXGDoqK3lrprlpInmm7TjgpLlhYPjgavmiLvjgZfkuK06IFxcJHtpbmNpZGVudC5kZXRhaWxzPy5jaGFuZ2VkUmVzb3VyY2V9XFxgKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aW9uOiAnUkVWRVJUX0NPTkZJRycsXG4gICAgICAgICAgICB0YXJnZXQ6IGluY2lkZW50LmRldGFpbHM/LmNoYW5nZWRSZXNvdXJjZSxcbiAgICAgICAgICAgIHN0YXR1czogJ0VYRUNVVEVEJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIGRldGFpbHM6ICdTdXNwaWNpb3VzIGNvbmZpZ3VyYXRpb24gY2hhbmdlIHJldmVydGVkJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGVuYWJsZUVuaGFuY2VkTW9uaXRvcmluZyhpbmNpZGVudCkge1xuICAgICAgICAgIC8vIOW8t+WMluebo+imluOCkuacieWKueWMllxuICAgICAgICAgIGNvbnNvbGUubG9nKCflvLfljJbnm6PoppbjgpLmnInlirnljJbkuK0nKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aW9uOiAnRU5BQkxFX0VOSEFOQ0VEX01PTklUT1JJTkcnLFxuICAgICAgICAgICAgdGFyZ2V0OiBpbmNpZGVudC5yZWdpb24sXG4gICAgICAgICAgICBzdGF0dXM6ICdFWEVDVVRFRCcsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICBkZXRhaWxzOiAnRW5oYW5jZWQgbW9uaXRvcmluZyBlbmFibGVkIGZvciB0aGUgYWZmZWN0ZWQgcmVnaW9uJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUluY2lkZW50V2l0aEFjdGlvbnMoaW5jaWRlbnRJZCwgYWN0aW9ucykge1xuICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICAgIFRhYmxlTmFtZTogJyR7dGhpcy5pbmNpZGVudHNUYWJsZS50YWJsZU5hbWV9JyxcbiAgICAgICAgICAgIEtleToge1xuICAgICAgICAgICAgICBpbmNpZGVudElkLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCkgLy8g5a6f6Zqb44Gu5a6f6KOF44Gn44Gv5q2j56K644Gq44K/44Kk44Og44K544K/44Oz44OX44GM5b+F6KaBXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgVXBkYXRlRXhwcmVzc2lvbjogJ1NFVCAjcmVzcG9uc2VBY3Rpb25zID0gOmFjdGlvbnMsICN1cGRhdGVkQXQgPSA6dXBkYXRlZEF0JyxcbiAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICAgICAnI3Jlc3BvbnNlQWN0aW9ucyc6ICdyZXNwb25zZUFjdGlvbnMnLFxuICAgICAgICAgICAgICAnI3VwZGF0ZWRBdCc6ICd1cGRhdGVkQXQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICAgICAnOmFjdGlvbnMnOiBhY3Rpb25zLFxuICAgICAgICAgICAgICAnOnVwZGF0ZWRBdCc6IERhdGUubm93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnVwZGF0ZShwYXJhbXMpLnByb21pc2UoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc2VuZFNlY3VyaXR5QWxlcnQoaW5jaWRlbnQpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gXFxgXG7jgrvjgq3jg6Xjg6rjg4bjgqPjgqTjg7Pjgrfjg4fjg7Pjg4jjgqLjg6njg7zjg4hcblxu44Kk44Oz44K344OH44Oz44OISUQ6IFxcJHtpbmNpZGVudC5pbmNpZGVudElkfVxu6YeN6KaB5bqmOiBcXCR7aW5jaWRlbnQuc2V2ZXJpdHl9XG7jgr/jgqTjg5c6IFxcJHtpbmNpZGVudC50eXBlfVxu5Zyw5Z+fOiBcXCR7aW5jaWRlbnQucmVnaW9ufVxu6Kqs5piOOiBcXCR7aW5jaWRlbnQuZGVzY3JpcHRpb259XG5cblNMQeacn+mZkDogXFwke2luY2lkZW50LnNsYURlYWRsaW5lfVxu5ouF5b2T6ICFOiBcXCR7aW5jaWRlbnQuYXNzaWduZWRUb31cblxu5Y2z5bqn44Gu5a++5b+c44GM5b+F6KaB44Gn44GZ44CCXG4gICAgICAgICAgXFxgO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHNucy5wdWJsaXNoKHtcbiAgICAgICAgICAgIFRvcGljQXJuOiAnJHt0aGlzLnNlY3VyaXR5QWxlcnRUb3BpYy50b3BpY0Fybn0nLFxuICAgICAgICAgICAgTWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgIFN1YmplY3Q6IFxcYOOCu+OCreODpeODquODhuOCo+OCpOODs+OCt+ODh+ODs+ODiCAoXFwke2luY2lkZW50LnNldmVyaXR5fSkgLSBcXCR7aW5jaWRlbnQuaW5jaWRlbnRJZH1cXGBcbiAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIHNob3VsZEVzY2FsYXRlKGluY2lkZW50KSB7XG4gICAgICAgICAgLy8g44Ko44K544Kr44Os44O844K344On44Oz5p2h5Lu2XG4gICAgICAgICAgcmV0dXJuIGluY2lkZW50LnNldmVyaXR5ID09PSAnQ1JJVElDQUwnIHx8IFxuICAgICAgICAgICAgICAgICBpbmNpZGVudC50eXBlID09PSAnREFUQV9FWEZJTFRSQVRJT04nIHx8XG4gICAgICAgICAgICAgICAgIGluY2lkZW50LnR5cGUgPT09ICdQUklWSUxFR0VfRVNDQUxBVElPTic7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGVzY2FsYXRlSW5jaWRlbnQoaW5jaWRlbnQpIHtcbiAgICAgICAgICAvLyDkuIrkvY3nrqHnkIbogIXjgavjgqjjgrnjgqvjg6zjg7zjgrfjg6fjg7NcbiAgICAgICAgICBjb25zdCBlc2NhbGF0aW9uTWVzc2FnZSA9IFxcYFxu57eK5oCl44K744Kt44Ol44Oq44OG44Kj44Kk44Oz44K344OH44Oz44OIIC0g44Ko44K544Kr44Os44O844K344On44OzXG5cbuOCpOODs+OCt+ODh+ODs+ODiElEOiBcXCR7aW5jaWRlbnQuaW5jaWRlbnRJZH1cbumHjeimgeW6pjogXFwke2luY2lkZW50LnNldmVyaXR5fVxu44K/44Kk44OXOiBcXCR7aW5jaWRlbnQudHlwZX1cbuWcsOWfnzogXFwke2luY2lkZW50LnJlZ2lvbn1cblxu44GT44Gu44Kk44Oz44K344OH44Oz44OI44Gv6Ieq5YuV55qE44Gr44Ko44K544Kr44Os44O844K344On44Oz44GV44KM44G+44GX44Gf44CCXG7ljbPluqfjga7nrqHnkIbogIXlr77lv5zjgYzlv4XopoHjgafjgZnjgIJcbiAgICAgICAgICBcXGA7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgc25zLnB1Ymxpc2goe1xuICAgICAgICAgICAgVG9waWNBcm46ICcke3RoaXMuc2VjdXJpdHlBbGVydFRvcGljLnRvcGljQXJufScsXG4gICAgICAgICAgICBNZXNzYWdlOiBlc2NhbGF0aW9uTWVzc2FnZSxcbiAgICAgICAgICAgIFN1YmplY3Q6IFxcYOe3iuaApeOCqOOCueOCq+ODrOODvOOCt+ODp+ODsyAtIFxcJHtpbmNpZGVudC5pbmNpZGVudElkfVxcYFxuICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjgqTjg7Pjgrfjg4fjg7Pjg4jnirbmhYvjgpLmm7TmlrBcbiAgICAgICAgICBhd2FpdCB1cGRhdGVJbmNpZGVudFN0YXR1cyhpbmNpZGVudC5pbmNpZGVudElkLCAnRVNDQUxBVEVEJyk7XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBJTkNJREVOVFNfVEFCTEU6IHRoaXMuaW5jaWRlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTRUNVUklUWV9BTEVSVF9UT1BJQzogdGhpcy5zZWN1cml0eUFsZXJ0VG9waWMudG9waWNBcm5cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPliIbmnpBMYW1iZGHplqLmlbBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlBbmFseXplckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1NlY3VyaXR5QW5hbHl6ZXJGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LXNlY3VyaXR5LWFuYWx5emVyYCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygn44K744Kt44Ol44Oq44OG44Kj5YiG5p6Q6ZaL5aeLOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFuYWx5c2lzVHlwZSA9IGV2ZW50LmFuYWx5c2lzVHlwZSB8fCAnY29tcHJlaGVuc2l2ZSc7XG4gICAgICAgICAgICBjb25zdCB0aW1lUmFuZ2UgPSBldmVudC50aW1lUmFuZ2UgfHwgMjQ7IC8vIGhvdXJzXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOODh+ODvOOCv+WPjumbhlxuICAgICAgICAgICAgY29uc3Qgc2VjdXJpdHlFdmVudHMgPSBhd2FpdCBjb2xsZWN0U2VjdXJpdHlFdmVudHModGltZVJhbmdlKTtcbiAgICAgICAgICAgIGNvbnN0IGluY2lkZW50cyA9IGF3YWl0IGNvbGxlY3RJbmNpZGVudHModGltZVJhbmdlKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5YiG5p6Q5a6f6KGMXG4gICAgICAgICAgICBjb25zdCBhbmFseXNpcyA9IGF3YWl0IHBlcmZvcm1TZWN1cml0eUFuYWx5c2lzKHNlY3VyaXR5RXZlbnRzLCBpbmNpZGVudHMsIGFuYWx5c2lzVHlwZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOaOqOWlqOS6i+mgheeUn+aIkFxuICAgICAgICAgICAgY29uc3QgcmVjb21tZW5kYXRpb25zID0gYXdhaXQgZ2VuZXJhdGVTZWN1cml0eVJlY29tbWVuZGF0aW9ucyhhbmFseXNpcyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGFuYWx5c2lzVHlwZSxcbiAgICAgICAgICAgICAgICB0aW1lUmFuZ2UsXG4gICAgICAgICAgICAgICAgYW5hbHlzaXMsXG4gICAgICAgICAgICAgICAgcmVjb21tZW5kYXRpb25zLFxuICAgICAgICAgICAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcign44K744Kt44Ol44Oq44OG44Kj5YiG5p6Q44Ko44Op44O8OicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RTZWN1cml0eUV2ZW50cyh0aW1lUmFuZ2UpIHtcbiAgICAgICAgICBjb25zdCBjdXRvZmZUaW1lID0gRGF0ZS5ub3coKSAtICh0aW1lUmFuZ2UgKiA2MCAqIDYwICogMTAwMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLnNlY3VyaXR5RXZlbnRzVGFibGUudGFibGVOYW1lfScsXG4gICAgICAgICAgICBGaWx0ZXJFeHByZXNzaW9uOiAnI3RpbWVzdGFtcCA+IDpjdXRvZmZUaW1lJyxcbiAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICAgICAnI3RpbWVzdGFtcCc6ICd0aW1lc3RhbXAnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICAgICAnOmN1dG9mZlRpbWUnOiBjdXRvZmZUaW1lXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5zY2FuKHBhcmFtcykucHJvbWlzZSgpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQuSXRlbXMgfHwgW107XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RJbmNpZGVudHModGltZVJhbmdlKSB7XG4gICAgICAgICAgY29uc3QgY3V0b2ZmVGltZSA9IERhdGUubm93KCkgLSAodGltZVJhbmdlICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICAgIFRhYmxlTmFtZTogJyR7dGhpcy5pbmNpZGVudHNUYWJsZS50YWJsZU5hbWV9JyxcbiAgICAgICAgICAgIEZpbHRlckV4cHJlc3Npb246ICcjdGltZXN0YW1wID4gOmN1dG9mZlRpbWUnLFxuICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICAgICAgICcjdGltZXN0YW1wJzogJ3RpbWVzdGFtcCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgICAgICc6Y3V0b2ZmVGltZSc6IGN1dG9mZlRpbWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLnNjYW4ocGFyYW1zKS5wcm9taXNlKCk7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdC5JdGVtcyB8fCBbXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gcGVyZm9ybVNlY3VyaXR5QW5hbHlzaXMoZXZlbnRzLCBpbmNpZGVudHMsIGFuYWx5c2lzVHlwZSkge1xuICAgICAgICAgIGNvbnN0IGFuYWx5c2lzID0ge1xuICAgICAgICAgICAgc3VtbWFyeTogZ2VuZXJhdGVTdW1tYXJ5KGV2ZW50cywgaW5jaWRlbnRzKSxcbiAgICAgICAgICAgIHRyZW5kczogYW5hbHl6ZVRyZW5kcyhldmVudHMsIGluY2lkZW50cyksXG4gICAgICAgICAgICBwYXR0ZXJuczogaWRlbnRpZnlQYXR0ZXJucyhldmVudHMpLFxuICAgICAgICAgICAgcmlza0Fzc2Vzc21lbnQ6IGFzc2Vzc1Jpc2soZXZlbnRzLCBpbmNpZGVudHMpLFxuICAgICAgICAgICAgcGVyZm9ybWFuY2U6IGFuYWx5emVQZXJmb3JtYW5jZShpbmNpZGVudHMpXG4gICAgICAgICAgfTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoYW5hbHlzaXNUeXBlID09PSAnY29tcHJlaGVuc2l2ZScpIHtcbiAgICAgICAgICAgIGFuYWx5c2lzLmRldGFpbGVkQnJlYWtkb3duID0gZ2VuZXJhdGVEZXRhaWxlZEJyZWFrZG93bihldmVudHMsIGluY2lkZW50cyk7XG4gICAgICAgICAgICBhbmFseXNpcy5nZW9ncmFwaGljQW5hbHlzaXMgPSBhbmFseXplR2VvZ3JhcGhpY0Rpc3RyaWJ1dGlvbihldmVudHMpO1xuICAgICAgICAgICAgYW5hbHlzaXMudGltZUFuYWx5c2lzID0gYW5hbHl6ZVRpbWVQYXR0ZXJucyhldmVudHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gYW5hbHlzaXM7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlU3VtbWFyeShldmVudHMsIGluY2lkZW50cykge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0b3RhbEV2ZW50czogZXZlbnRzLmxlbmd0aCxcbiAgICAgICAgICAgIHRvdGFsSW5jaWRlbnRzOiBpbmNpZGVudHMubGVuZ3RoLFxuICAgICAgICAgICAgZXZlbnRzQnlUaHJlYXRMZXZlbDoge1xuICAgICAgICAgICAgICBDUklUSUNBTDogZXZlbnRzLmZpbHRlcihlID0+IGUudGhyZWF0TGV2ZWwgPT09ICdDUklUSUNBTCcpLmxlbmd0aCxcbiAgICAgICAgICAgICAgSElHSDogZXZlbnRzLmZpbHRlcihlID0+IGUudGhyZWF0TGV2ZWwgPT09ICdISUdIJykubGVuZ3RoLFxuICAgICAgICAgICAgICBNRURJVU06IGV2ZW50cy5maWx0ZXIoZSA9PiBlLnRocmVhdExldmVsID09PSAnTUVESVVNJykubGVuZ3RoLFxuICAgICAgICAgICAgICBMT1c6IGV2ZW50cy5maWx0ZXIoZSA9PiBlLnRocmVhdExldmVsID09PSAnTE9XJykubGVuZ3RoXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5jaWRlbnRzQnlTZXZlcml0eToge1xuICAgICAgICAgICAgICBDUklUSUNBTDogaW5jaWRlbnRzLmZpbHRlcihpID0+IGkuc2V2ZXJpdHkgPT09ICdDUklUSUNBTCcpLmxlbmd0aCxcbiAgICAgICAgICAgICAgSElHSDogaW5jaWRlbnRzLmZpbHRlcihpID0+IGkuc2V2ZXJpdHkgPT09ICdISUdIJykubGVuZ3RoLFxuICAgICAgICAgICAgICBNRURJVU06IGluY2lkZW50cy5maWx0ZXIoaSA9PiBpLnNldmVyaXR5ID09PSAnTUVESVVNJykubGVuZ3RoLFxuICAgICAgICAgICAgICBMT1c6IGluY2lkZW50cy5maWx0ZXIoaSA9PiBpLnNldmVyaXR5ID09PSAnTE9XJykubGVuZ3RoXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5jaWRlbnRzQnlTdGF0dXM6IHtcbiAgICAgICAgICAgICAgT1BFTjogaW5jaWRlbnRzLmZpbHRlcihpID0+IGkuc3RhdHVzID09PSAnT1BFTicpLmxlbmd0aCxcbiAgICAgICAgICAgICAgSU5WRVNUSUdBVElORzogaW5jaWRlbnRzLmZpbHRlcihpID0+IGkuc3RhdHVzID09PSAnSU5WRVNUSUdBVElORycpLmxlbmd0aCxcbiAgICAgICAgICAgICAgQ09OVEFJTkVEOiBpbmNpZGVudHMuZmlsdGVyKGkgPT4gaS5zdGF0dXMgPT09ICdDT05UQUlORUQnKS5sZW5ndGgsXG4gICAgICAgICAgICAgIFJFU09MVkVEOiBpbmNpZGVudHMuZmlsdGVyKGkgPT4gaS5zdGF0dXMgPT09ICdSRVNPTFZFRCcpLmxlbmd0aCxcbiAgICAgICAgICAgICAgQ0xPU0VEOiBpbmNpZGVudHMuZmlsdGVyKGkgPT4gaS5zdGF0dXMgPT09ICdDTE9TRUQnKS5sZW5ndGhcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBhbmFseXplVHJlbmRzKGV2ZW50cywgaW5jaWRlbnRzKSB7XG4gICAgICAgICAgLy8g57Ch55Wl5YyW44GV44KM44Gf44OI44Os44Oz44OJ5YiG5p6QXG4gICAgICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICBjb25zdCBvbmVIb3VyQWdvID0gbm93IC0gKDYwICogNjAgKiAxMDAwKTtcbiAgICAgICAgICBjb25zdCBzaXhIb3Vyc0FnbyA9IG5vdyAtICg2ICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHJlY2VudEV2ZW50cyA9IGV2ZW50cy5maWx0ZXIoZSA9PiBlLnRpbWVzdGFtcCA+IG9uZUhvdXJBZ28pLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCBvbGRlckV2ZW50cyA9IGV2ZW50cy5maWx0ZXIoZSA9PiBlLnRpbWVzdGFtcCA+IHNpeEhvdXJzQWdvICYmIGUudGltZXN0YW1wIDw9IG9uZUhvdXJBZ28pLmxlbmd0aDtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXZlbnRUcmVuZDogcmVjZW50RXZlbnRzIC0gb2xkZXJFdmVudHMsXG4gICAgICAgICAgICBtb3N0Q29tbW9uVGhyZWF0VHlwZXM6IGdldE1vc3RDb21tb25UaHJlYXRUeXBlcyhldmVudHMpLFxuICAgICAgICAgICAgcGVha0FjdGl2aXR5SG91cnM6IGlkZW50aWZ5UGVha0hvdXJzKGV2ZW50cylcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZXRNb3N0Q29tbW9uVGhyZWF0VHlwZXMoZXZlbnRzKSB7XG4gICAgICAgICAgY29uc3QgdHlwZUNvdW50cyA9IHt9O1xuICAgICAgICAgIGV2ZW50cy5mb3JFYWNoKGV2ZW50ID0+IHtcbiAgICAgICAgICAgIHR5cGVDb3VudHNbZXZlbnQudHlwZV0gPSAodHlwZUNvdW50c1tldmVudC50eXBlXSB8fCAwKSArIDE7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHR5cGVDb3VudHMpXG4gICAgICAgICAgICAuc29ydCgoWyxhXSwgWyxiXSkgPT4gYiAtIGEpXG4gICAgICAgICAgICAuc2xpY2UoMCwgNSlcbiAgICAgICAgICAgIC5tYXAoKFt0eXBlLCBjb3VudF0pID0+ICh7IHR5cGUsIGNvdW50IH0pKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gaWRlbnRpZnlQZWFrSG91cnMoZXZlbnRzKSB7XG4gICAgICAgICAgY29uc3QgaG91ckNvdW50cyA9IHt9O1xuICAgICAgICAgIGV2ZW50cy5mb3JFYWNoKGV2ZW50ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGhvdXIgPSBuZXcgRGF0ZShldmVudC50aW1lc3RhbXApLmdldEhvdXJzKCk7XG4gICAgICAgICAgICBob3VyQ291bnRzW2hvdXJdID0gKGhvdXJDb3VudHNbaG91cl0gfHwgMCkgKyAxO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhob3VyQ291bnRzKVxuICAgICAgICAgICAgLnNvcnQoKFssYV0sIFssYl0pID0+IGIgLSBhKVxuICAgICAgICAgICAgLnNsaWNlKDAsIDMpXG4gICAgICAgICAgICAubWFwKChbaG91ciwgY291bnRdKSA9PiAoeyBob3VyOiBwYXJzZUludChob3VyKSwgY291bnQgfSkpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBpZGVudGlmeVBhdHRlcm5zKGV2ZW50cykge1xuICAgICAgICAgIC8vIOODkeOCv+ODvOODs+itmOWIpVxuICAgICAgICAgIGNvbnN0IHBhdHRlcm5zID0gW107XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5ZCM5LiASVDjgYvjgonjga7opIfmlbDmlLvmkoNcbiAgICAgICAgICBjb25zdCBpcFBhdHRlcm5zID0gaWRlbnRpZnlJcFBhdHRlcm5zKGV2ZW50cyk7XG4gICAgICAgICAgcGF0dGVybnMucHVzaCguLi5pcFBhdHRlcm5zKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDmmYLplpPnmoTjg5Hjgr/jg7zjg7NcbiAgICAgICAgICBjb25zdCB0aW1lUGF0dGVybnMgPSBpZGVudGlmeVRpbWVQYXR0ZXJucyhldmVudHMpO1xuICAgICAgICAgIHBhdHRlcm5zLnB1c2goLi4udGltZVBhdHRlcm5zKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gcGF0dGVybnM7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGlkZW50aWZ5SXBQYXR0ZXJucyhldmVudHMpIHtcbiAgICAgICAgICBjb25zdCBpcENvdW50cyA9IHt9O1xuICAgICAgICAgIGV2ZW50cy5mb3JFYWNoKGV2ZW50ID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC5kZXRhaWxzPy5zb3VyY2VJcCkge1xuICAgICAgICAgICAgICBpcENvdW50c1tldmVudC5kZXRhaWxzLnNvdXJjZUlwXSA9IChpcENvdW50c1tldmVudC5kZXRhaWxzLnNvdXJjZUlwXSB8fCAwKSArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKGlwQ291bnRzKVxuICAgICAgICAgICAgLmZpbHRlcigoWywgY291bnRdKSA9PiBjb3VudCA+IDMpXG4gICAgICAgICAgICAubWFwKChbaXAsIGNvdW50XSkgPT4gKHtcbiAgICAgICAgICAgICAgdHlwZTogJ1JFUEVBVEVEX0lQX0FUVEFDS1MnLFxuICAgICAgICAgICAgICBzb3VyY2VJcDogaXAsXG4gICAgICAgICAgICAgIGV2ZW50Q291bnQ6IGNvdW50LFxuICAgICAgICAgICAgICByaXNrTGV2ZWw6IGNvdW50ID4gMTAgPyAnSElHSCcgOiAnTUVESVVNJ1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBpZGVudGlmeVRpbWVQYXR0ZXJucyhldmVudHMpIHtcbiAgICAgICAgICAvLyDnn63mmYLplpPjgafjga7lpKfph4/jgqTjg5njg7Pjg4hcbiAgICAgICAgICBjb25zdCB0aW1lV2luZG93cyA9IHt9O1xuICAgICAgICAgIGNvbnN0IHdpbmRvd1NpemUgPSAxMCAqIDYwICogMTAwMDsgLy8gMTDliIZcbiAgICAgICAgICBcbiAgICAgICAgICBldmVudHMuZm9yRWFjaChldmVudCA9PiB7XG4gICAgICAgICAgICBjb25zdCB3aW5kb3cgPSBNYXRoLmZsb29yKGV2ZW50LnRpbWVzdGFtcCAvIHdpbmRvd1NpemUpICogd2luZG93U2l6ZTtcbiAgICAgICAgICAgIHRpbWVXaW5kb3dzW3dpbmRvd10gPSAodGltZVdpbmRvd3Nbd2luZG93XSB8fCAwKSArIDE7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHRpbWVXaW5kb3dzKVxuICAgICAgICAgICAgLmZpbHRlcigoWywgY291bnRdKSA9PiBjb3VudCA+IDUpXG4gICAgICAgICAgICAubWFwKChbd2luZG93LCBjb3VudF0pID0+ICh7XG4gICAgICAgICAgICAgIHR5cGU6ICdISUdIX0FDVElWSVRZX0JVUlNUJyxcbiAgICAgICAgICAgICAgdGltZVdpbmRvdzogbmV3IERhdGUocGFyc2VJbnQod2luZG93KSkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgZXZlbnRDb3VudDogY291bnQsXG4gICAgICAgICAgICAgIHJpc2tMZXZlbDogY291bnQgPiAyMCA/ICdISUdIJyA6ICdNRURJVU0nXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGFzc2Vzc1Jpc2soZXZlbnRzLCBpbmNpZGVudHMpIHtcbiAgICAgICAgICBjb25zdCBjcml0aWNhbEV2ZW50cyA9IGV2ZW50cy5maWx0ZXIoZSA9PiBlLnRocmVhdExldmVsID09PSAnQ1JJVElDQUwnKS5sZW5ndGg7XG4gICAgICAgICAgY29uc3QgaGlnaEV2ZW50cyA9IGV2ZW50cy5maWx0ZXIoZSA9PiBlLnRocmVhdExldmVsID09PSAnSElHSCcpLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCBvcGVuSW5jaWRlbnRzID0gaW5jaWRlbnRzLmZpbHRlcihpID0+IGkuc3RhdHVzID09PSAnT1BFTicpLmxlbmd0aDtcbiAgICAgICAgICBcbiAgICAgICAgICBsZXQgcmlza1Njb3JlID0gMDtcbiAgICAgICAgICByaXNrU2NvcmUgKz0gY3JpdGljYWxFdmVudHMgKiAxMDtcbiAgICAgICAgICByaXNrU2NvcmUgKz0gaGlnaEV2ZW50cyAqIDU7XG4gICAgICAgICAgcmlza1Njb3JlICs9IG9wZW5JbmNpZGVudHMgKiAzO1xuICAgICAgICAgIFxuICAgICAgICAgIGxldCByaXNrTGV2ZWwgPSAnTE9XJztcbiAgICAgICAgICBpZiAocmlza1Njb3JlID4gNTApIHJpc2tMZXZlbCA9ICdDUklUSUNBTCc7XG4gICAgICAgICAgZWxzZSBpZiAocmlza1Njb3JlID4gMjUpIHJpc2tMZXZlbCA9ICdISUdIJztcbiAgICAgICAgICBlbHNlIGlmIChyaXNrU2NvcmUgPiAxMCkgcmlza0xldmVsID0gJ01FRElVTSc7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJpc2tTY29yZSxcbiAgICAgICAgICAgIHJpc2tMZXZlbCxcbiAgICAgICAgICAgIGZhY3RvcnM6IHtcbiAgICAgICAgICAgICAgY3JpdGljYWxFdmVudHMsXG4gICAgICAgICAgICAgIGhpZ2hFdmVudHMsXG4gICAgICAgICAgICAgIG9wZW5JbmNpZGVudHNcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBhbmFseXplUGVyZm9ybWFuY2UoaW5jaWRlbnRzKSB7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWRJbmNpZGVudHMgPSBpbmNpZGVudHMuZmlsdGVyKGkgPT4gaS5zdGF0dXMgPT09ICdSRVNPTFZFRCcgfHwgaS5zdGF0dXMgPT09ICdDTE9TRUQnKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAocmVzb2x2ZWRJbmNpZGVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4geyBhdmVyYWdlUmVzb2x1dGlvblRpbWU6IDAsIHNsYUNvbXBsaWFuY2U6IDEwMCB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCByZXNvbHV0aW9uVGltZXMgPSByZXNvbHZlZEluY2lkZW50cy5tYXAoaW5jaWRlbnQgPT4ge1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlZEF0ID0gaW5jaWRlbnQudGltZXN0YW1wO1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWRBdCA9IGluY2lkZW50LnJlc29sdmVkQXQgfHwgRGF0ZS5ub3coKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlZEF0IC0gY3JlYXRlZEF0O1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGF2ZXJhZ2VSZXNvbHV0aW9uVGltZSA9IHJlc29sdXRpb25UaW1lcy5yZWR1Y2UoKHN1bSwgdGltZSkgPT4gc3VtICsgdGltZSwgMCkgLyByZXNvbHV0aW9uVGltZXMubGVuZ3RoO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFNMQea6luaLoOeOh+ioiOeul++8iOewoeeVpeWMlu+8iVxuICAgICAgICAgIGNvbnN0IHNsYVRhcmdldCA9ICR7dGhpcy5zZWN1cml0eUNvbmZpZy5pbmNpZGVudFJlc3BvbnNlU2xhTWludXRlc30gKiA2MCAqIDEwMDA7XG4gICAgICAgICAgY29uc3Qgc2xhQ29tcGxpYW50ID0gcmVzb2x1dGlvblRpbWVzLmZpbHRlcih0aW1lID0+IHRpbWUgPD0gc2xhVGFyZ2V0KS5sZW5ndGg7XG4gICAgICAgICAgY29uc3Qgc2xhQ29tcGxpYW5jZSA9IChzbGFDb21wbGlhbnQgLyByZXNvbHV0aW9uVGltZXMubGVuZ3RoKSAqIDEwMDtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXZlcmFnZVJlc29sdXRpb25UaW1lOiBNYXRoLnJvdW5kKGF2ZXJhZ2VSZXNvbHV0aW9uVGltZSAvICg2MCAqIDEwMDApKSwgLy8g5YiG5Y2Y5L2NXG4gICAgICAgICAgICBzbGFDb21wbGlhbmNlOiBNYXRoLnJvdW5kKHNsYUNvbXBsaWFuY2UpXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVTZWN1cml0eVJlY29tbWVuZGF0aW9ucyhhbmFseXNpcykge1xuICAgICAgICAgIGNvbnN0IHJlY29tbWVuZGF0aW9ucyA9IFtdO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOODquOCueOCr+ODrOODmeODq+OBq+WfuuOBpeOBj+aOqOWlqOS6i+mghVxuICAgICAgICAgIGlmIChhbmFseXNpcy5yaXNrQXNzZXNzbWVudC5yaXNrTGV2ZWwgPT09ICdDUklUSUNBTCcpIHtcbiAgICAgICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCfnt4rmgKU6IOmHjeimgeOBquOCu+OCreODpeODquODhuOCo+iEheWogeOBjOaknOWHuuOBleOCjOOBpuOBhOOBvuOBmeOAguWNs+W6p+OBruWvvuW/nOOBjOW/heimgeOBp+OBmeOAgicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjg5Hjgr/jg7zjg7Pjgavln7rjgaXjgY/mjqjlpajkuovpoIVcbiAgICAgICAgICBhbmFseXNpcy5wYXR0ZXJucy5mb3JFYWNoKHBhdHRlcm4gPT4ge1xuICAgICAgICAgICAgaWYgKHBhdHRlcm4udHlwZSA9PT0gJ1JFUEVBVEVEX0lQX0FUVEFDS1MnKSB7XG4gICAgICAgICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKFxcYElQIFxcJHtwYXR0ZXJuLnNvdXJjZUlwfSDjgYvjgonjga7nubDjgorov5TjgZfmlLvmkoPjgYzmpJzlh7rjgZXjgozjgabjgYTjgb7jgZnjgILjgZPjga5JUOOCkuODluODreODg+OCr+OBmeOCi+OBk+OBqOOCkuaknOiojuOBl+OBpuOBj+OBoOOBleOBhOOAglxcYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44OR44OV44Kp44O844Oe44Oz44K544Gr5Z+644Gl44GP5o6o5aWo5LqL6aCFXG4gICAgICAgICAgaWYgKGFuYWx5c2lzLnBlcmZvcm1hbmNlLnNsYUNvbXBsaWFuY2UgPCA4MCkge1xuICAgICAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ+OCpOODs+OCt+ODh+ODs+ODiOWvvuW/nOOBrlNMQea6luaLoOeOh+OBjOS9juS4i+OBl+OBpuOBhOOBvuOBmeOAguWvvuW/nOODl+ODreOCu+OCueOBruimi+ebtOOBl+OCkuaknOiojuOBl+OBpuOBj+OBoOOBleOBhOOAgicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyDkuIDoiKznmoTjgarmjqjlpajkuovpoIVcbiAgICAgICAgICBpZiAoYW5hbHlzaXMuc3VtbWFyeS50b3RhbEV2ZW50cyA+IDEwMCkge1xuICAgICAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ+OCu+OCreODpeODquODhuOCo+OCpOODmeODs+ODiOOBjOWkmueZuuOBl+OBpuOBhOOBvuOBmeOAguebo+imluioreWumuOBruiqv+aVtOOCkuaknOiojuOBl+OBpuOBj+OBoOOBleOBhOOAgicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gcmVjb21tZW5kYXRpb25zO1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMTApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU0VDVVJJVFlfRVZFTlRTX1RBQkxFOiB0aGlzLnNlY3VyaXR5RXZlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBJTkNJREVOVFNfVEFCTEU6IHRoaXMuaW5jaWRlbnRzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44Ki44Op44O844OI566h55CGTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFsZXJ0TWFuYWdlckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FsZXJ0TWFuYWdlckZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tYWxlcnQtbWFuYWdlcmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IHNucyA9IG5ldyBBV1MuU05TKCk7XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygn44Ki44Op44O844OI566h55CG6ZaL5aeLOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFsZXJ0VHlwZSA9IGV2ZW50LmFsZXJ0VHlwZTtcbiAgICAgICAgICAgIGNvbnN0IHNldmVyaXR5ID0gZXZlbnQuc2V2ZXJpdHk7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gZXZlbnQubWVzc2FnZTtcbiAgICAgICAgICAgIGNvbnN0IGRldGFpbHMgPSBldmVudC5kZXRhaWxzIHx8IHt9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjgqLjg6njg7zjg4jpgIHkv6FcbiAgICAgICAgICAgIGF3YWl0IHNlbmRBbGVydChhbGVydFR5cGUsIHNldmVyaXR5LCBtZXNzYWdlLCBkZXRhaWxzKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgYWxlcnRUeXBlLFxuICAgICAgICAgICAgICAgIHNldmVyaXR5LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICfjgqLjg6njg7zjg4jjgYzpgIHkv6HjgZXjgozjgb7jgZfjgZ8nLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+OCouODqeODvOODiOeuoeeQhuOCqOODqeODvDonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzZW5kQWxlcnQoYWxlcnRUeXBlLCBzZXZlcml0eSwgbWVzc2FnZSwgZGV0YWlscykge1xuICAgICAgICAgIGNvbnN0IGFsZXJ0TWVzc2FnZSA9IGZvcm1hdEFsZXJ0TWVzc2FnZShhbGVydFR5cGUsIHNldmVyaXR5LCBtZXNzYWdlLCBkZXRhaWxzKTtcbiAgICAgICAgICBjb25zdCBzdWJqZWN0ID0gXFxgW1xcJHtzZXZlcml0eX1dIFxcJHthbGVydFR5cGV9IC0gXFwke2RldGFpbHMucmVnaW9uIHx8ICdHbG9iYWwnfVxcYDtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBzbnMucHVibGlzaCh7XG4gICAgICAgICAgICBUb3BpY0FybjogJyR7dGhpcy5zZWN1cml0eUFsZXJ0VG9waWMudG9waWNBcm59JyxcbiAgICAgICAgICAgIE1lc3NhZ2U6IGFsZXJ0TWVzc2FnZSxcbiAgICAgICAgICAgIFN1YmplY3Q6IHN1YmplY3RcbiAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGZvcm1hdEFsZXJ0TWVzc2FnZShhbGVydFR5cGUsIHNldmVyaXR5LCBtZXNzYWdlLCBkZXRhaWxzKSB7XG4gICAgICAgICAgcmV0dXJuIFxcYFxu44K744Kt44Ol44Oq44OG44Kj44Ki44Op44O844OIXG5cbuOCouODqeODvOODiOOCv+OCpOODlzogXFwke2FsZXJ0VHlwZX1cbumHjeimgeW6pjogXFwke3NldmVyaXR5fVxu44Oh44OD44K744O844K4OiBcXCR7bWVzc2FnZX1cblxu6Kmz57Sw5oOF5aCxOlxuXFwke09iamVjdC5lbnRyaWVzKGRldGFpbHMpLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBcXGAtIFxcJHtrZXl9OiBcXCR7dmFsdWV9XFxgKS5qb2luKCdcXFxcbicpfVxuXG7nmbrnlJ/mmYLliLs6IFxcJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9XG4gICAgICAgICAgXFxgO1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTRUNVUklUWV9BTEVSVF9UT1BJQzogdGhpcy5zZWN1cml0eUFsZXJ0VG9waWMudG9waWNBcm5cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGVwIEZ1bmN0aW9ucyDjg6/jg7zjgq/jg5Xjg63jg7zjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlXb3JrZmxvdygpOiBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSB7XG4gICAgLy8g6ISF5aiB5qSc5Ye6XG4gICAgY29uc3QgZGV0ZWN0VGhyZWF0cyA9IG5ldyBzZm5UYXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0RldGVjdFRocmVhdHMnLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogdGhpcy50aHJlYXREZXRlY3RvckZ1bmN0aW9uLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCdcbiAgICB9KTtcblxuICAgIC8vIOiEheWogeODrOODmeODq+WIpOWumlxuICAgIGNvbnN0IGV2YWx1YXRlVGhyZWF0cyA9IG5ldyBzdGVwZnVuY3Rpb25zLkNob2ljZSh0aGlzLCAnRXZhbHVhdGVUaHJlYXRzJyk7XG5cbiAgICAvLyDjgqTjg7Pjgrfjg4fjg7Pjg4jlr77lv5xcbiAgICBjb25zdCByZXNwb25kVG9JbmNpZGVudCA9IG5ldyBzZm5UYXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ1Jlc3BvbmRUb0luY2lkZW50Jywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IHRoaXMuaW5jaWRlbnRSZXNwb25kZXJGdW5jdGlvbixcbiAgICAgIG91dHB1dFBhdGg6ICckLlBheWxvYWQnXG4gICAgfSk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPliIbmnpBcbiAgICBjb25zdCBhbmFseXplU2VjdXJpdHlEYXRhID0gbmV3IHNmblRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnQW5hbHl6ZVNlY3VyaXR5RGF0YScsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiB0aGlzLnNlY3VyaXR5QW5hbHl6ZXJGdW5jdGlvbixcbiAgICAgIG91dHB1dFBhdGg6ICckLlBheWxvYWQnXG4gICAgfSk7XG5cbiAgICAvLyDmiJDlip/jg7vlpLHmlZfnirbmhYtcbiAgICBjb25zdCBzZWN1cml0eVN1Y2Nlc3MgPSBuZXcgc3RlcGZ1bmN0aW9ucy5TdWNjZWVkKHRoaXMsICdTZWN1cml0eVN1Y2Nlc3MnKTtcbiAgICBjb25zdCBzZWN1cml0eUZhaWxlZCA9IG5ldyBzdGVwZnVuY3Rpb25zLkZhaWwodGhpcywgJ1NlY3VyaXR5RmFpbGVkJyk7XG5cbiAgICAvLyDjg6/jg7zjgq/jg5Xjg63jg7zlrprnvqlcbiAgICBjb25zdCBkZWZpbml0aW9uID0gZGV0ZWN0VGhyZWF0c1xuICAgICAgLm5leHQoZXZhbHVhdGVUaHJlYXRzXG4gICAgICAgIC53aGVuKHN0ZXBmdW5jdGlvbnMuQ29uZGl0aW9uLm9yKFxuICAgICAgICAgIHN0ZXBmdW5jdGlvbnMuQ29uZGl0aW9uLm51bWJlckdyZWF0ZXJUaGFuKCckLnN1bW1hcnkuYnlMZXZlbC5DUklUSUNBTCcsIDApLFxuICAgICAgICAgIHN0ZXBmdW5jdGlvbnMuQ29uZGl0aW9uLm51bWJlckdyZWF0ZXJUaGFuKCckLnN1bW1hcnkuYnlMZXZlbC5ISUdIJywgMClcbiAgICAgICAgKSwgcmVzcG9uZFRvSW5jaWRlbnQpXG4gICAgICAgIC5vdGhlcndpc2UoYW5hbHl6ZVNlY3VyaXR5RGF0YSkpXG4gICAgICAubmV4dChzZWN1cml0eVN1Y2Nlc3MpO1xuXG4gICAgcmV0dXJuIG5ldyBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSh0aGlzLCAnU2VjdXJpdHlXb3JrZmxvdycsIHtcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1zZWN1cml0eS13b3JrZmxvd2AsXG4gICAgICBkZWZpbml0aW9uLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uaG91cnMoMSlcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnm6PoppbjgrnjgrHjgrjjg6Xjg7zjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTW9uaXRvcmluZ1NjaGVkdWxlcygpOiB2b2lkIHtcbiAgICAvLyDohIXlqIHmpJzlh7rlrprmnJ/lrp/ooYxcbiAgICBjb25zdCB0aHJlYXREZXRlY3Rpb25TY2hlZHVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnVGhyZWF0RGV0ZWN0aW9uU2NoZWR1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LXRocmVhdC1kZXRlY3Rpb24tc2NoZWR1bGVgLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWd1bGFyIHRocmVhdCBkZXRlY3Rpb24gZXhlY3V0aW9uJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShEdXJhdGlvbi5taW51dGVzKHRoaXMuc2VjdXJpdHlDb25maWcubW9uaXRvcmluZ0ludGVydmFsTWludXRlcykpXG4gICAgfSk7XG5cbiAgICB0aHJlYXREZXRlY3Rpb25TY2hlZHVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy50aHJlYXREZXRlY3RvckZ1bmN0aW9uKSk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPliIbmnpDlrprmnJ/lrp/ooYzvvIjml6XmrKHvvIlcbiAgICBjb25zdCBzZWN1cml0eUFuYWx5c2lzU2NoZWR1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1NlY3VyaXR5QW5hbHlzaXNTY2hlZHVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tc2VjdXJpdHktYW5hbHlzaXMtc2NoZWR1bGVgLFxuICAgICAgZGVzY3JpcHRpb246ICdEYWlseSBzZWN1cml0eSBhbmFseXNpcyBleGVjdXRpb24nLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHsgaG91cjogJzInLCBtaW51dGU6ICcwJyB9KSAvLyDmr47ml6Uy5pmCXG4gICAgfSk7XG5cbiAgICBzZWN1cml0eUFuYWx5c2lzU2NoZWR1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMuc2VjdXJpdHlBbmFseXplckZ1bmN0aW9uLCB7XG4gICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgYW5hbHlzaXNUeXBlOiAnY29tcHJlaGVuc2l2ZScsXG4gICAgICAgIHRpbWVSYW5nZTogMjRcbiAgICAgIH0pXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3VkV2F0Y2jjgqTjg5njg7Pjg4jjg6vjg7zjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlFdmVudFJ1bGVzKCk6IHZvaWQge1xuICAgIC8vIEFXUyBBUEnlkbzjgbPlh7rjgZfnm6PoppZcbiAgICBjb25zdCBhcGlDYWxsUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQXBpQ2FsbE1vbml0b3JpbmdSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1hcGktY2FsbC1tb25pdG9yaW5nYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTW9uaXRvciBzdXNwaWNpb3VzIEFQSSBjYWxscycsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2F3cy5pYW0nLCAnYXdzLnN0cyddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0FXUyBBUEkgQ2FsbCB2aWEgQ2xvdWRUcmFpbCddLFxuICAgICAgICBkZXRhaWw6IHtcbiAgICAgICAgICBldmVudE5hbWU6IFsnQXNzdW1lUm9sZScsICdDcmVhdGVSb2xlJywgJ0F0dGFjaFJvbGVQb2xpY3knXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhcGlDYWxsUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy50aHJlYXREZXRlY3RvckZ1bmN0aW9uKSk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5flpInmm7Tnm6PoppZcbiAgICBjb25zdCBzZ0NoYW5nZVJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1NlY3VyaXR5R3JvdXBDaGFuZ2VSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1zZy1jaGFuZ2UtbW9uaXRvcmluZ2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ01vbml0b3Igc2VjdXJpdHkgZ3JvdXAgY2hhbmdlcycsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2F3cy5lYzInXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydBV1MgQVBJIENhbGwgdmlhIENsb3VkVHJhaWwnXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgZXZlbnROYW1lOiBbJ0F1dGhvcml6ZVNlY3VyaXR5R3JvdXBJbmdyZXNzJywgJ1Jldm9rZVNlY3VyaXR5R3JvdXBJbmdyZXNzJ11cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgc2dDaGFuZ2VSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLnRocmVhdERldGVjdG9yRnVuY3Rpb24pKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlv4XopoHjgapJQU3mqKnpmZDjga7oqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBJYW1QZXJtaXNzaW9ucygpOiB2b2lkIHtcbiAgICAvLyBEeW5hbW9EQuODhuODvOODluODq+OBuOOBruiqreOBv+abuOOBjeaoqemZkFxuICAgIGNvbnN0IHRhYmxlcyA9IFt0aGlzLnNlY3VyaXR5RXZlbnRzVGFibGUsIHRoaXMuaW5jaWRlbnRzVGFibGUsIHRoaXMudGhyZWF0SW50ZWxUYWJsZV07XG4gICAgY29uc3QgZnVuY3Rpb25zID0gW1xuICAgICAgdGhpcy50aHJlYXREZXRlY3RvckZ1bmN0aW9uLFxuICAgICAgdGhpcy5pbmNpZGVudFJlc3BvbmRlckZ1bmN0aW9uLFxuICAgICAgdGhpcy5zZWN1cml0eUFuYWx5emVyRnVuY3Rpb24sXG4gICAgICB0aGlzLmFsZXJ0TWFuYWdlckZ1bmN0aW9uXG4gICAgXTtcblxuICAgIHRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIGZ1bmN0aW9ucy5mb3JFYWNoKGZ1bmMgPT4ge1xuICAgICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZnVuYyk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc+aoqemZkFxuICAgIGZ1bmN0aW9ucy5mb3JFYWNoKGZ1bmMgPT4ge1xuICAgICAgZnVuYy5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cycsXG4gICAgICAgICAgJ2xvZ3M6RGVzY3JpYmVMb2dTdHJlYW1zJ1xuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLnNlY3VyaXR5TG9nR3JvdXAubG9nR3JvdXBBcm5dXG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICAvLyBTTlPpgJrnn6XmqKnpmZBcbiAgICBmdW5jdGlvbnMuZm9yRWFjaChmdW5jID0+IHtcbiAgICAgIHRoaXMuc2VjdXJpdHlBbGVydFRvcGljLmdyYW50UHVibGlzaChmdW5jKTtcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYemWouaVsOmWk+OBruWRvOOBs+WHuuOBl+aoqemZkFxuICAgIHRoaXMudGhyZWF0RGV0ZWN0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydsYW1iZGE6SW52b2tlRnVuY3Rpb24nXSxcbiAgICAgIHJlc291cmNlczogW3RoaXMuaW5jaWRlbnRSZXNwb25kZXJGdW5jdGlvbi5mdW5jdGlvbkFybl1cbiAgICB9KSk7XG4gIH1cblxuICAvKipcbiAgICog5Yid5pyf5YyW5Yem55CGXG4gICAqL1xuICBwdWJsaWMgaW5pdGlhbGl6ZSgpOiB2b2lkIHtcbiAgICAvLyBJQU3mqKnpmZDjga7oqK3lrppcbiAgICB0aGlzLnNldHVwSWFtUGVybWlzc2lvbnMoKTtcbiAgfVxufSJdfQ==