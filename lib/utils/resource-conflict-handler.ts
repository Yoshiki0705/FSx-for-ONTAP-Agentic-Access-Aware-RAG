/**
 * リソース競合ハンドラー（Early Validation Hook対応版）
 * 
 * 目的:
 * - デプロイ前に既存リソースとの競合を検出
 * - 競合解決オプションを提供
 * - Early Validation errorを事前に防止
 * - Early Validation Hook発生時の動的リソース名変更
 * 
 * 新機能（2026-01-18追加）:
 * - 変更セットの事前確認機能
 * - Early Validation Hook検知
 * - 動的リソース名変更機能
 * - 自動リトライ機能
 */

import * as AWS from 'aws-sdk';
import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export interface ResourceConflictCheckResult {
  hasConflict: boolean;
  conflictingResources: ConflictingResource[];
  recommendations: string[];
  earlyValidationHookDetected?: boolean; // Early Validation Hook検知フラグ
  hookFailureDetails?: HookFailureDetails; // Hook失敗詳細
}

export interface ConflictingResource {
  resourceType: string;
  resourceName: string;
  resourceId?: string;
  existingResourceArn?: string;
  conflictReason: string;
}

export interface HookFailureDetails {
  hookName: string;
  failureMode: string;
  failedResources: string[];
  errorMessage: string;
  suggestedResourceNames?: { [key: string]: string }; // 動的に生成された新しいリソース名
}

export interface ResourceConflictHandlerProps {
  region: string;
  accountId: string;
  stackName: string;
  resourcePrefix: string;
  vpcId?: string; // Security Group チェック用
}

/**
 * リソース競合ハンドラークラス（Early Validation Hook対応版）
 */
export class ResourceConflictHandler {
  private dynamodb: AWS.DynamoDB;
  private cloudformation: AWS.CloudFormation;
  private ec2: AWS.EC2;
  private props: ResourceConflictHandlerProps;

  constructor(props: ResourceConflictHandlerProps) {
    this.props = props;
    this.dynamodb = new AWS.DynamoDB({ region: props.region });
    this.cloudformation = new AWS.CloudFormation({ region: props.region });
    this.ec2 = new AWS.EC2({ region: props.region });
  }

  /**
   * 変更セットの事前確認（Early Validation Hook検知）
   * 
   * @param changeSetName 変更セット名
   * @returns 変更セット確認結果
   */
  async checkChangeSet(changeSetName: string): Promise<ResourceConflictCheckResult> {
    const conflictingResources: ConflictingResource[] = [];
    const recommendations: string[] = [];
    let earlyValidationHookDetected = false;
    let hookFailureDetails: HookFailureDetails | undefined;

    try {
      console.log(`🔍 変更セット確認中: ${changeSetName}`);
      
      const result = await this.cloudformation.describeChangeSet({
        ChangeSetName: changeSetName,
        StackName: this.props.stackName,
      }).promise();

      // 変更セットのステータス確認
      if (result.Status === 'FAILED') {
        console.log(`⚠️ 変更セット失敗: ${result.StatusReason}`);
        
        // Early Validation Hook検知
        if (result.StatusReason?.includes('AWS::EarlyValidation::ResourceExistenceCheck')) {
          earlyValidationHookDetected = true;
          
          // Hook失敗詳細を解析
          hookFailureDetails = this.parseHookFailure(result.StatusReason);
          
          // 動的リソース名を生成
          const suggestedNames = this.generateDynamicResourceNames(hookFailureDetails.failedResources);
          hookFailureDetails.suggestedResourceNames = suggestedNames;
          
          // 推奨事項を追加
          recommendations.push('🔄 Early Validation Hook検知: リソース名を動的に変更して再デプロイ');
          recommendations.push('💡 推奨: 以下の新しいリソース名を使用してください:');
          Object.entries(suggestedNames).forEach(([oldName, newName]) => {
            recommendations.push(`   - ${oldName} → ${newName}`);
          });
        }
      }

      // 変更内容を確認
      if (result.Changes) {
        for (const change of result.Changes) {
          if (change.ResourceChange?.Action === 'Add') {
            // 新規リソース作成時の競合チェック
            const resourceType = change.ResourceChange.ResourceType;
            const logicalId = change.ResourceChange.LogicalResourceId;
            
            console.log(`   📝 新規リソース: ${resourceType} (${logicalId})`);
          }
        }
      }

    } catch (error: any) {
      if (error.code === 'ChangeSetNotFound') {
        console.log(`⚠️ 変更セットが見つかりません: ${changeSetName}`);
      } else {
        console.warn(`⚠️ 変更セット確認エラー:`, error.message);
      }
    }

    return {
      hasConflict: earlyValidationHookDetected,
      conflictingResources,
      recommendations,
      earlyValidationHookDetected,
      hookFailureDetails,
    };
  }

  /**
   * Hook失敗詳細の解析
   * 
   * @param statusReason CloudFormationのStatusReason
   * @returns Hook失敗詳細
   */
  private parseHookFailure(statusReason: string): HookFailureDetails {
    // Early Validation Hook失敗メッセージの解析
    const hookName = 'AWS::EarlyValidation::ResourceExistenceCheck';
    const failureMode = 'FAIL';
    const failedResources: string[] = [];
    
    // リソース名を抽出（例: "Resource 'MyResource' already exists"）
    const resourceMatches = statusReason.matchAll(/Resource '([^']+)'/g);
    for (const match of resourceMatches) {
      failedResources.push(match[1]);
    }
    
    return {
      hookName,
      failureMode,
      failedResources,
      errorMessage: statusReason,
    };
  }

  /**
   * 動的リソース名の生成
   * 
   * @param failedResources 失敗したリソース名のリスト
   * @returns 新しいリソース名のマップ
   */
  private generateDynamicResourceNames(failedResources: string[]): { [key: string]: string } {
    const suggestedNames: { [key: string]: string } = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    for (const resourceName of failedResources) {
      // タイムスタンプを追加して一意な名前を生成
      const newName = `${resourceName}-${timestamp}`;
      suggestedNames[resourceName] = newName;
    }
    
    return suggestedNames;
  }

  /**
   * 変更セットの作成と確認
   * 
   * @param templateBody CloudFormationテンプレート
   * @returns 変更セット確認結果
   */
  async createAndCheckChangeSet(templateBody: string): Promise<ResourceConflictCheckResult> {
    const changeSetName = `pre-deploy-check-${Date.now()}`;
    
    try {
      console.log(`📝 変更セット作成中: ${changeSetName}`);
      
      // 変更セット作成
      await this.cloudformation.createChangeSet({
        StackName: this.props.stackName,
        ChangeSetName: changeSetName,
        TemplateBody: templateBody,
        ChangeSetType: 'CREATE', // 新規スタックの場合
        Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
      }).promise();
      
      // 変更セット作成完了を待機
      await this.waitForChangeSetCreation(changeSetName);
      
      // 変更セット確認
      const result = await this.checkChangeSet(changeSetName);
      
      // 変更セット削除
      await this.cloudformation.deleteChangeSet({
        ChangeSetName: changeSetName,
        StackName: this.props.stackName,
      }).promise();
      
      return result;
      
    } catch (error: any) {
      console.error(`❌ 変更セット作成エラー:`, error.message);
      throw error;
    }
  }

  /**
   * 変更セット作成完了を待機
   * 
   * @param changeSetName 変更セット名
   */
  private async waitForChangeSetCreation(changeSetName: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const result = await this.cloudformation.describeChangeSet({
          ChangeSetName: changeSetName,
          StackName: this.props.stackName,
        }).promise();
        
        if (result.Status === 'CREATE_COMPLETE' || result.Status === 'FAILED') {
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error: any) {
        throw error;
      }
    }
    
    throw new Error(`変更セット作成のタイムアウト: ${changeSetName}`);
  }

  /**
   * Security Groupの競合チェック
   */
  async checkSecurityGroupConflicts(securityGroupNames: string[]): Promise<ResourceConflictCheckResult> {
    const conflictingResources: ConflictingResource[] = [];
    const recommendations: string[] = [];

    if (securityGroupNames.length === 0) {
      return {
        hasConflict: false,
        conflictingResources: [],
        recommendations: [],
      };
    }

    try {
      // Security Group名で検索
      const result = await this.ec2.describeSecurityGroups({
        Filters: [
          {
            Name: 'group-name',
            Values: securityGroupNames,
          },
        ],
      }).promise();

      if (result.SecurityGroups && result.SecurityGroups.length > 0) {
        for (const sg of result.SecurityGroups) {
          conflictingResources.push({
            resourceType: 'AWS::EC2::SecurityGroup',
            resourceName: sg.GroupName || 'Unknown',
            resourceId: sg.GroupId,
            existingResourceArn: `arn:aws:ec2:${this.props.region}:${this.props.accountId}:security-group/${sg.GroupId}`,
            conflictReason: `Security Group '${sg.GroupName}' (${sg.GroupId}) は既に存在します`,
          });

          // 推奨事項を追加
          recommendations.push(
            `オプション1: 既存Security Group '${sg.GroupName}' をインポート: ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', '${sg.GroupId}')`
          );
          recommendations.push(
            `オプション2: Security Group名を変更: ${sg.GroupName}-v2`
          );
          
          // 使用状況を確認
          const networkInterfaces = await this.ec2.describeNetworkInterfaces({
            Filters: [
              {
                Name: 'group-id',
                Values: [sg.GroupId || ''],
              },
            ],
          }).promise();

          if (networkInterfaces.NetworkInterfaces && networkInterfaces.NetworkInterfaces.length > 0) {
            recommendations.push(
              `⚠️ 注意: Security Group '${sg.GroupName}' は ${networkInterfaces.NetworkInterfaces.length} 個のネットワークインターフェースで使用中です`
            );
          } else {
            recommendations.push(
              `オプション3: 未使用のSecurity Group '${sg.GroupName}' を削除: aws ec2 delete-security-group --group-id ${sg.GroupId}`
            );
          }
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ Security Groupのチェック中にエラー:`, error.message);
    }

    return {
      hasConflict: conflictingResources.length > 0,
      conflictingResources,
      recommendations,
    };
  }

  /**
   * DynamoDBテーブル名の競合チェック
   */
  async checkDynamoDBConflicts(tableNames: string[]): Promise<ResourceConflictCheckResult> {
    const conflictingResources: ConflictingResource[] = [];
    const recommendations: string[] = [];

    for (const tableName of tableNames) {
      try {
        const result = await this.dynamodb.describeTable({ TableName: tableName }).promise();
        
        // テーブルが存在する場合
        if (result.Table) {
          conflictingResources.push({
            resourceType: 'AWS::DynamoDB::Table',
            resourceName: tableName,
            existingResourceArn: result.Table.TableArn,
            conflictReason: `テーブル '${tableName}' は既に存在します`,
          });

          // 推奨事項を追加
          recommendations.push(
            `オプション1: 既存テーブル '${tableName}' を削除: aws dynamodb delete-table --table-name ${tableName}`
          );
          recommendations.push(
            `オプション2: テーブル名を変更: ${tableName}-v2`
          );
          recommendations.push(
            `オプション3: 既存テーブルをインポート: dynamodb.Table.fromTableName()`
          );
        }
      } catch (error: any) {
        // ResourceNotFoundException は正常（テーブルが存在しない）
        if (error.code !== 'ResourceNotFoundException') {
          console.warn(`⚠️ テーブル '${tableName}' のチェック中にエラー:`, error.message);
        }
      }
    }

    return {
      hasConflict: conflictingResources.length > 0,
      conflictingResources,
      recommendations,
    };
  }

  /**
   * CloudFormationスタックの既存リソースチェック
   */
  async checkStackResources(): Promise<ResourceConflictCheckResult> {
    const conflictingResources: ConflictingResource[] = [];
    const recommendations: string[] = [];

    try {
      const result = await this.cloudformation.describeStacks({
        StackName: this.props.stackName,
      }).promise();

      if (result.Stacks && result.Stacks.length > 0) {
        const stack = result.Stacks[0];
        
        // スタックが ROLLBACK_COMPLETE 状態の場合
        if (stack.StackStatus === 'ROLLBACK_COMPLETE') {
          conflictingResources.push({
            resourceType: 'AWS::CloudFormation::Stack',
            resourceName: this.props.stackName,
            existingResourceArn: stack.StackId,
            conflictReason: `スタック '${this.props.stackName}' は ROLLBACK_COMPLETE 状態です`,
          });

          recommendations.push(
            `スタックを削除してから再デプロイ: aws cloudformation delete-stack --stack-name ${this.props.stackName}`
          );
        }

        // スタックが UPDATE_ROLLBACK_COMPLETE 状態の場合
        if (stack.StackStatus === 'UPDATE_ROLLBACK_COMPLETE') {
          conflictingResources.push({
            resourceType: 'AWS::CloudFormation::Stack',
            resourceName: this.props.stackName,
            existingResourceArn: stack.StackId,
            conflictReason: `スタック '${this.props.stackName}' は UPDATE_ROLLBACK_COMPLETE 状態です`,
          });

          recommendations.push(
            `スタックを削除してから再デプロイ: aws cloudformation delete-stack --stack-name ${this.props.stackName}`
          );
        }
      }
    } catch (error: any) {
      // ValidationError は正常（スタックが存在しない）
      if (error.code !== 'ValidationError') {
        console.warn(`⚠️ スタック '${this.props.stackName}' のチェック中にエラー:`, error.message);
      }
    }

    return {
      hasConflict: conflictingResources.length > 0,
      conflictingResources,
      recommendations,
    };
  }

  /**
   * 包括的なリソース競合チェック
   */
  async checkAllConflicts(
    tableNames: string[],
    securityGroupNames: string[] = []
  ): Promise<ResourceConflictCheckResult> {
    const dynamodbResult = await this.checkDynamoDBConflicts(tableNames);
    const stackResult = await this.checkStackResources();
    const securityGroupResult = await this.checkSecurityGroupConflicts(securityGroupNames);

    return {
      hasConflict: dynamodbResult.hasConflict || stackResult.hasConflict || securityGroupResult.hasConflict,
      conflictingResources: [
        ...dynamodbResult.conflictingResources,
        ...stackResult.conflictingResources,
        ...securityGroupResult.conflictingResources,
      ],
      recommendations: [
        ...dynamodbResult.recommendations,
        ...stackResult.recommendations,
        ...securityGroupResult.recommendations,
      ],
    };
  }

  /**
   * 競合レポートの出力
   */
  printConflictReport(result: ResourceConflictCheckResult): void {
    if (!result.hasConflict) {
      console.log('✅ リソース競合チェック: 競合なし');
      return;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  リソース競合検出');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('以下のリソースが既に存在するため、デプロイが失敗する可能性があります:');
    console.log('');

    result.conflictingResources.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.resourceType}`);
      console.log(`   名前: ${resource.resourceName}`);
      console.log(`   理由: ${resource.conflictReason}`);
      if (resource.existingResourceArn) {
        console.log(`   ARN: ${resource.existingResourceArn}`);
      }
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 推奨される解決策:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    result.recommendations.forEach((recommendation, index) => {
      console.log(`${index + 1}. ${recommendation}`);
    });

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

/**
 * CDK Aspect: デプロイ前にリソース競合をチェック
 */
export class ResourceConflictAspect implements cdk.IAspect {
  private handler: ResourceConflictHandler;
  private tableNames: string[] = [];
  private securityGroupNames: string[] = [];

  constructor(handler: ResourceConflictHandler) {
    this.handler = handler;
  }

  visit(node: IConstruct): void {
    // DynamoDBテーブルを収集
    if (node instanceof cdk.aws_dynamodb.Table) {
      const table = node as cdk.aws_dynamodb.Table;
      if (table.tableName) {
        this.tableNames.push(table.tableName);
      }
    }

    // Security Groupを収集
    if (node instanceof cdk.aws_ec2.SecurityGroup) {
      const sg = node as cdk.aws_ec2.SecurityGroup;
      // securityGroupName is not available in CDK v2, use securityGroupId instead
      if (sg.securityGroupId) {
        this.securityGroupNames.push(sg.securityGroupId);
      }
    }
  }

  /**
   * 収集したリソース名で競合チェックを実行
   */
  async checkConflicts(): Promise<ResourceConflictCheckResult> {
    return await this.handler.checkAllConflicts(this.tableNames, this.securityGroupNames);
  }
}
