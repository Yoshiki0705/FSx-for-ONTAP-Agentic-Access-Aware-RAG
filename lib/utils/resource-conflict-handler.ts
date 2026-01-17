/**
 * リソース競合ハンドラー
 * 
 * 目的:
 * - デプロイ前に既存リソースとの競合を検出
 * - 競合解決オプションを提供
 * - Early Validation errorを事前に防止
 */

import * as AWS from 'aws-sdk';
import * as cdk from 'aws-cdk-lib';

export interface ResourceConflictCheckResult {
  hasConflict: boolean;
  conflictingResources: ConflictingResource[];
  recommendations: string[];
}

export interface ConflictingResource {
  resourceType: string;
  resourceName: string;
  resourceId?: string;
  existingResourceArn?: string;
  conflictReason: string;
}

export interface ResourceConflictHandlerProps {
  region: string;
  accountId: string;
  stackName: string;
  resourcePrefix: string;
  vpcId?: string; // Security Group チェック用
}

/**
 * リソース競合ハンドラークラス
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

  visit(node: cdk.IConstruct): void {
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
      if (sg.securityGroupName) {
        this.securityGroupNames.push(sg.securityGroupName);
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
