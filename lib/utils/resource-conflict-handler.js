"use strict";
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
exports.ResourceConflictAspect = exports.ResourceConflictHandler = void 0;
const AWS = __importStar(require("aws-sdk"));
const cdk = __importStar(require("aws-cdk-lib"));
/**
 * リソース競合ハンドラークラス（Early Validation Hook対応版）
 */
class ResourceConflictHandler {
    dynamodb;
    cloudformation;
    ec2;
    props;
    constructor(props) {
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
    async checkChangeSet(changeSetName) {
        const conflictingResources = [];
        const recommendations = [];
        let earlyValidationHookDetected = false;
        let hookFailureDetails;
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
        }
        catch (error) {
            if (error.code === 'ChangeSetNotFound') {
                console.log(`⚠️ 変更セットが見つかりません: ${changeSetName}`);
            }
            else {
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
    parseHookFailure(statusReason) {
        // Early Validation Hook失敗メッセージの解析
        const hookName = 'AWS::EarlyValidation::ResourceExistenceCheck';
        const failureMode = 'FAIL';
        const failedResources = [];
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
    generateDynamicResourceNames(failedResources) {
        const suggestedNames = {};
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
    async createAndCheckChangeSet(templateBody) {
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
        }
        catch (error) {
            console.error(`❌ 変更セット作成エラー:`, error.message);
            throw error;
        }
    }
    /**
     * 変更セット作成完了を待機
     *
     * @param changeSetName 変更セット名
     */
    async waitForChangeSetCreation(changeSetName) {
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
            }
            catch (error) {
                throw error;
            }
        }
        throw new Error(`変更セット作成のタイムアウト: ${changeSetName}`);
    }
    /**
     * Security Groupの競合チェック
     */
    async checkSecurityGroupConflicts(securityGroupNames) {
        const conflictingResources = [];
        const recommendations = [];
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
                    recommendations.push(`オプション1: 既存Security Group '${sg.GroupName}' をインポート: ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', '${sg.GroupId}')`);
                    recommendations.push(`オプション2: Security Group名を変更: ${sg.GroupName}-v2`);
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
                        recommendations.push(`⚠️ 注意: Security Group '${sg.GroupName}' は ${networkInterfaces.NetworkInterfaces.length} 個のネットワークインターフェースで使用中です`);
                    }
                    else {
                        recommendations.push(`オプション3: 未使用のSecurity Group '${sg.GroupName}' を削除: aws ec2 delete-security-group --group-id ${sg.GroupId}`);
                    }
                }
            }
        }
        catch (error) {
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
    async checkDynamoDBConflicts(tableNames) {
        const conflictingResources = [];
        const recommendations = [];
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
                    recommendations.push(`オプション1: 既存テーブル '${tableName}' を削除: aws dynamodb delete-table --table-name ${tableName}`);
                    recommendations.push(`オプション2: テーブル名を変更: ${tableName}-v2`);
                    recommendations.push(`オプション3: 既存テーブルをインポート: dynamodb.Table.fromTableName()`);
                }
            }
            catch (error) {
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
    async checkStackResources() {
        const conflictingResources = [];
        const recommendations = [];
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
                    recommendations.push(`スタックを削除してから再デプロイ: aws cloudformation delete-stack --stack-name ${this.props.stackName}`);
                }
                // スタックが UPDATE_ROLLBACK_COMPLETE 状態の場合
                if (stack.StackStatus === 'UPDATE_ROLLBACK_COMPLETE') {
                    conflictingResources.push({
                        resourceType: 'AWS::CloudFormation::Stack',
                        resourceName: this.props.stackName,
                        existingResourceArn: stack.StackId,
                        conflictReason: `スタック '${this.props.stackName}' は UPDATE_ROLLBACK_COMPLETE 状態です`,
                    });
                    recommendations.push(`スタックを削除してから再デプロイ: aws cloudformation delete-stack --stack-name ${this.props.stackName}`);
                }
            }
        }
        catch (error) {
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
    async checkAllConflicts(tableNames, securityGroupNames = []) {
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
    printConflictReport(result) {
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
exports.ResourceConflictHandler = ResourceConflictHandler;
/**
 * CDK Aspect: デプロイ前にリソース競合をチェック
 */
class ResourceConflictAspect {
    handler;
    tableNames = [];
    securityGroupNames = [];
    constructor(handler) {
        this.handler = handler;
    }
    visit(node) {
        // DynamoDBテーブルを収集
        if (node instanceof cdk.aws_dynamodb.Table) {
            const table = node;
            if (table.tableName) {
                this.tableNames.push(table.tableName);
            }
        }
        // Security Groupを収集
        if (node instanceof cdk.aws_ec2.SecurityGroup) {
            const sg = node;
            // securityGroupName is not available in CDK v2, use securityGroupId instead
            if (sg.securityGroupId) {
                this.securityGroupNames.push(sg.securityGroupId);
            }
        }
    }
    /**
     * 収集したリソース名で競合チェックを実行
     */
    async checkConflicts() {
        return await this.handler.checkAllConflicts(this.tableNames, this.securityGroupNames);
    }
}
exports.ResourceConflictAspect = ResourceConflictAspect;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2UtY29uZmxpY3QtaGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlc291cmNlLWNvbmZsaWN0LWhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7OztHQWNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDZDQUErQjtBQUMvQixpREFBbUM7QUFtQ25DOztHQUVHO0FBQ0gsTUFBYSx1QkFBdUI7SUFDMUIsUUFBUSxDQUFlO0lBQ3ZCLGNBQWMsQ0FBcUI7SUFDbkMsR0FBRyxDQUFVO0lBQ2IsS0FBSyxDQUErQjtJQUU1QyxZQUFZLEtBQW1DO1FBQzdDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQzNELElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBcUI7UUFDeEMsTUFBTSxvQkFBb0IsR0FBMEIsRUFBRSxDQUFDO1FBQ3ZELE1BQU0sZUFBZSxHQUFhLEVBQUUsQ0FBQztRQUNyQyxJQUFJLDJCQUEyQixHQUFHLEtBQUssQ0FBQztRQUN4QyxJQUFJLGtCQUFrRCxDQUFDO1FBRXZELElBQUksQ0FBQztZQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLGFBQWEsRUFBRSxDQUFDLENBQUM7WUFFN0MsTUFBTSxN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O0dBRUc7QUFDSCxNQUFhLHNCQUFzQjtJQUN6QixPQUFPLENBQTBCO0lBQ2pDLFVBQVUsR0FBYSxFQUFFLENBQUM7SUFDMUIsa0JBQWtCLEdBQWEsRUFBRSxDQUFDO0lBRTFDLFlBQVksT0FBZ0M7UUFDMUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDekIsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFnQjtRQUNwQixrQkFBa0I7UUFDbEIsSUFBSSxJQUFJLFlBQVksR0FBRyxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMzQyxNQUFNLEtBQUssR0FBRyxJQUE4QixDQUFDO1lBQzdDLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDeEMsQ0FBQztRQUNILENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsSUFBSSxJQUFJLFlBQVksR0FBRyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUM5QyxNQUFNLEVBQUUsR0FBRyxJQUFpQyxDQUFDO1lBQzdDLDRFQUE0RTtZQUM1RSxJQUFJLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDbkQsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsY0FBYztRQUNsQixPQUFPLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7Q0FDRjtBQWxDRCx3REFrQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOODquOCveODvOOCueertuWQiOODj+ODs+ODieODqeODvO+8iEVhcmx5IFZhbGlkYXRpb24gSG9va+WvvuW/nOeJiO+8iVxuICogXG4gKiDnm67nmoQ6XG4gKiAtIOODh+ODl+ODreOCpOWJjeOBq+aXouWtmOODquOCveODvOOCueOBqOOBruertuWQiOOCkuaknOWHulxuICogLSDnq7blkIjop6Pmsbrjgqrjg5fjgrfjg6fjg7PjgpLmj5DkvptcbiAqIC0gRWFybHkgVmFsaWRhdGlvbiBlcnJvcuOCkuS6i+WJjeOBq+mYsuatolxuICogLSBFYXJseSBWYWxpZGF0aW9uIEhvb2vnmbrnlJ/mmYLjga7li5XnmoTjg6rjgr3jg7zjgrnlkI3lpInmm7RcbiAqIFxuICog5paw5qmf6IO977yIMjAyNi0wMS0xOOi/veWKoO+8iTpcbiAqIC0g5aSJ5pu044K744OD44OI44Gu5LqL5YmN56K66KqN5qmf6IO9XG4gKiAtIEVhcmx5IFZhbGlkYXRpb24gSG9va+aknOefpVxuICogLSDli5XnmoTjg6rjgr3jg7zjgrnlkI3lpInmm7TmqZ/og71cbiAqIC0g6Ieq5YuV44Oq44OI44Op44Kk5qmf6IO9XG4gKi9cblxuaW1wb3J0ICogYXMgQVdTIGZyb20gJ2F3cy1zZGsnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IElDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBSZXNvdXJjZUNvbmZsaWN0Q2hlY2tSZXN1bHQge1xuICBoYXNDb25mbGljdDogYm9vbGVhbjtcbiAgY29uZmxpY3RpbmdSZXNvdXJjZXM6IENvbmZsaWN0aW5nUmVzb3VyY2VbXTtcbiAgcmVjb21tZW5kYXRpb25zOiBzdHJpbmdbXTtcbiAgZWFybHlWYWxpZGF0aW9uSG9va0RldGVjdGVkPzogYm9vbGVhbjsgLy8gRWFybHkgVmFsaWRhdGlvbiBIb29r5qSc55+l44OV44Op44KwXG4gIGhvb2tGYWlsdXJlRGV0YWlscz86IEhvb2tGYWlsdXJlRGV0YWlsczsgLy8gSG9va+WkseaVl+ips+e0sFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbmZsaWN0aW5nUmVzb3VyY2Uge1xuICByZXNvdXJjZVR5cGU6IHN0cmluZztcbiAgcmVzb3VyY2VOYW1lOiBzdHJpbmc7XG4gIHJlc291cmNlSWQ/OiBzdHJpbmc7XG4gIGV4aXN0aW5nUmVzb3VyY2VBcm4/OiBzdHJpbmc7XG4gIGNvbmZsaWN0UmVhc29uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9va0ZhaWx1cmVEZXRhaWxzIHtcbiAgaG9va05hbWU6IHN0cmluZztcbiAgZmFpbHVyZU1vZGU6IHN0cmluZztcbiAgZmFpbGVkUmVzb3VyY2VzOiBzdHJpbmdbXTtcbiAgZXJyb3JNZXNzYWdlOiBzdHJpbmc7XG4gIHN1Z2dlc3RlZFJlc291cmNlTmFtZXM/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9OyAvLyDli5XnmoTjgavnlJ/miJDjgZXjgozjgZ/mlrDjgZfjgYTjg6rjgr3jg7zjgrnlkI1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXNvdXJjZUNvbmZsaWN0SGFuZGxlclByb3BzIHtcbiAgcmVnaW9uOiBzdHJpbmc7XG4gIGFjY291bnRJZDogc3RyaW5nO1xuICBzdGFja05hbWU6IHN0cmluZztcbiAgcmVzb3VyY2VQcmVmaXg6IHN0cmluZztcbiAgdnBjSWQ/OiBzdHJpbmc7IC8vIFNlY3VyaXR5IEdyb3VwIOODgeOCp+ODg+OCr+eUqFxufVxuXG4vKipcbiAqIOODquOCveODvOOCueertuWQiOODj+ODs+ODieODqeODvOOCr+ODqeOCue+8iEVhcmx5IFZhbGlkYXRpb24gSG9va+WvvuW/nOeJiO+8iVxuICovXG5leHBvcnQgY2xhc3MgUmVzb3VyY2VDb25mbGljdEhhbmRsZXIge1xuICBwcml2YXRlIGR5bmFtb2RiOiBBV1MuRHluYW1vREI7XG4gIHByaXZhdGUgY2xvdWRmb3JtYXRpb246IEFXUy5DbG91ZEZvcm1hdGlvbjtcbiAgcHJpdmF0ZSBlYzI6IEFXUy5FQzI7XG4gIHByaXZhdGUgcHJvcHM6IFJlc291cmNlQ29uZmxpY3RIYW5kbGVyUHJvcHM7XG5cbiAgY29uc3RydWN0b3IocHJvcHM6IFJlc291cmNlQ29uZmxpY3RIYW5kbGVyUHJvcHMpIHtcbiAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgdGhpcy5keW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIoeyByZWdpb246IHByb3BzLnJlZ2lvbiB9KTtcbiAgICB0aGlzLmNsb3VkZm9ybWF0aW9uID0gbmV3IEFXUy5DbG91ZEZvcm1hdGlvbih7IHJlZ2lvbjogcHJvcHMucmVnaW9uIH0pO1xuICAgIHRoaXMuZWMyID0gbmV3IEFXUy5FQzIoeyByZWdpb246IHByb3BzLnJlZ2lvbiB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlpInmm7Tjgrvjg4Pjg4jjga7kuovliY3norroqo3vvIhFYXJseSBWYWxpZGF0aW9uIEhvb2vmpJznn6XvvIlcbiAgICogXG4gICAqIEBwYXJhbSBjaGFuZ2VTZXROYW1lIOWkieabtOOCu+ODg+ODiOWQjVxuICAgKiBAcmV0dXJucyDlpInmm7Tjgrvjg4Pjg4jnorroqo3ntZDmnpxcbiAgICovXG4gIGFzeW5jIGNoZWNrQ2hhbmdlU2V0KGNoYW5nZVNldE5hbWU6IHN0cmluZyk6IFByb21pc2U8UmVzb3VyY2VDb25mbGljdENoZWNrUmVzdWx0PiB7XG4gICAgY29uc3QgY29uZmxpY3RpbmdSZXNvdXJjZXM6IENvbmZsaWN0aW5nUmVzb3VyY2VbXSA9IFtdO1xuICAgIGNvbnN0IHJlY29tbWVuZGF0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgZWFybHlWYWxpZGF0aW9uSG9va0RldGVjdGVkID0gZmFsc2U7XG4gICAgbGV0IGhvb2tGYWlsdXJlRGV0YWlsczogSG9va0ZhaWx1cmVEZXRhaWxzIHwgdW5kZWZpbmVkO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SNIOWkieabtOOCu+ODg+ODiOeiuuiqjeS4rTogJHtjaGFuZ2VTZXROYW1lfWApO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsb3VkZm9ybWF0aW9uLmRlc2NyaWJlQ2hhbmdlU2V0KHtcbiAgICAgICAgQ2hhbmdlU2V0TmFtZTogY2hhbmdlU2V0TmFtZSxcbiAgICAgICAgU3RhY2tOYW1lOiB0aGlzLnByb3BzLnN0YWNrTmFtZSxcbiAgICAgIH0pLnByb21pc2UoKTtcblxuICAgICAgLy8g5aSJ5pu044K744OD44OI44Gu44K544OG44O844K/44K556K66KqNXG4gICAgICBpZiAocmVzdWx0LlN0YXR1cyA9PT0gJ0ZBSUxFRCcpIHtcbiAgICAgICAgY29uc29sZS5sb2coYOKaoO+4jyDlpInmm7Tjgrvjg4Pjg4jlpLHmlZc6ICR7cmVzdWx0LlN0YXR1c1JlYXNvbn1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEVhcmx5IFZhbGlkYXRpb24gSG9va+aknOefpVxuICAgICAgICBpZiAocmVzdWx0LlN0YXR1c1JlYXNvbj8uaW5jbHVkZXMoJ0FXUzo6RWFybHlWYWxpZGF0aW9uOjpSZXNvdXJjZUV4aXN0ZW5jZUNoZWNrJykpIHtcbiAgICAgICAgICBlYXJseVZhbGlkYXRpb25Ib29rRGV0ZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEhvb2vlpLHmlZfoqbPntLDjgpLop6PmnpBcbiAgICAgICAgICBob29rRmFpbHVyZURldGFpbHMgPSB0aGlzLnBhcnNlSG9va0ZhaWx1cmUocmVzdWx0LlN0YXR1c1JlYXNvbik7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5YuV55qE44Oq44K944O844K55ZCN44KS55Sf5oiQXG4gICAgICAgICAgY29uc3Qgc3VnZ2VzdGVkTmFtZXMgPSB0aGlzLmdlbmVyYXRlRHluYW1pY1Jlc291cmNlTmFtZXMoaG9va0ZhaWx1cmVEZXRhaWxzLmZhaWxlZFJlc291cmNlcyk7XG4gICAgICAgICAgaG9va0ZhaWx1cmVEZXRhaWxzLnN1Z2dlc3RlZFJlc291cmNlTmFtZXMgPSBzdWdnZXN0ZWROYW1lcztcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDmjqjlpajkuovpoIXjgpLov73liqBcbiAgICAgICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgn8J+UhCBFYXJseSBWYWxpZGF0aW9uIEhvb2vmpJznn6U6IOODquOCveODvOOCueWQjeOCkuWLleeahOOBq+WkieabtOOBl+OBpuWGjeODh+ODl+ODreOCpCcpO1xuICAgICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCfwn5KhIOaOqOWlqDog5Lul5LiL44Gu5paw44GX44GE44Oq44K944O844K55ZCN44KS5L2/55So44GX44Gm44GP44Gg44GV44GEOicpO1xuICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHN1Z2dlc3RlZE5hbWVzKS5mb3JFYWNoKChbb2xkTmFtZSwgbmV3TmFtZV0pID0+IHtcbiAgICAgICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKGAgICAtICR7b2xkTmFtZX0g4oaSICR7bmV3TmFtZX1gKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyDlpInmm7TlhoXlrrnjgpLnorroqo1cbiAgICAgIGlmIChyZXN1bHQuQ2hhbmdlcykge1xuICAgICAgICBmb3IgKGNvbnN0IGNoYW5nZSBvZiByZXN1bHQuQ2hhbmdlcykge1xuICAgICAgICAgIGlmIChjaGFuZ2UuUmVzb3VyY2VDaGFuZ2U/LkFjdGlvbiA9PT0gJ0FkZCcpIHtcbiAgICAgICAgICAgIC8vIOaWsOimj+ODquOCveODvOOCueS9nOaIkOaZguOBruertuWQiOODgeOCp+ODg+OCr1xuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VUeXBlID0gY2hhbmdlLlJlc291cmNlQ2hhbmdlLlJlc291cmNlVHlwZTtcbiAgICAgICAgICAgIGNvbnN0IGxvZ2ljYWxJZCA9IGNoYW5nZS5SZXNvdXJjZUNoYW5nZS5Mb2dpY2FsUmVzb3VyY2VJZDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYCAgIPCfk50g5paw6KaP44Oq44K944O844K5OiAke3Jlc291cmNlVHlwZX0gKCR7bG9naWNhbElkfSlgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIGlmIChlcnJvci5jb2RlID09PSAnQ2hhbmdlU2V0Tm90Rm91bmQnKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDimqDvuI8g5aSJ5pu044K744OD44OI44GM6KaL44Gk44GL44KK44G+44Gb44KTOiAke2NoYW5nZVNldE5hbWV9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDlpInmm7Tjgrvjg4Pjg4jnorroqo3jgqjjg6njg7w6YCwgZXJyb3IubWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGhhc0NvbmZsaWN0OiBlYXJseVZhbGlkYXRpb25Ib29rRGV0ZWN0ZWQsXG4gICAgICBjb25mbGljdGluZ1Jlc291cmNlcyxcbiAgICAgIHJlY29tbWVuZGF0aW9ucyxcbiAgICAgIGVhcmx5VmFsaWRhdGlvbkhvb2tEZXRlY3RlZCxcbiAgICAgIGhvb2tGYWlsdXJlRGV0YWlscyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEhvb2vlpLHmlZfoqbPntLDjga7op6PmnpBcbiAgICogXG4gICAqIEBwYXJhbSBzdGF0dXNSZWFzb24gQ2xvdWRGb3JtYXRpb27jga5TdGF0dXNSZWFzb25cbiAgICogQHJldHVybnMgSG9va+WkseaVl+ips+e0sFxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUhvb2tGYWlsdXJlKHN0YXR1c1JlYXNvbjogc3RyaW5nKTogSG9va0ZhaWx1cmVEZXRhaWxzIHtcbiAgICAvLyBFYXJseSBWYWxpZGF0aW9uIEhvb2vlpLHmlZfjg6Hjg4Pjgrvjg7zjgrjjga7op6PmnpBcbiAgICBjb25zdCBob29rTmFtZSA9ICdBV1M6OkVhcmx5VmFsaWRhdGlvbjo6UmVzb3VyY2VFeGlzdGVuY2VDaGVjayc7XG4gICAgY29uc3QgZmFpbHVyZU1vZGUgPSAnRkFJTCc7XG4gICAgY29uc3QgZmFpbGVkUmVzb3VyY2VzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIOODquOCveODvOOCueWQjeOCkuaKveWHuu+8iOS+izogXCJSZXNvdXJjZSAnTXlSZXNvdXJjZScgYWxyZWFkeSBleGlzdHNcIu+8iVxuICAgIGNvbnN0IHJlc291cmNlTWF0Y2hlcyA9IHN0YXR1c1JlYXNvbi5tYXRjaEFsbCgvUmVzb3VyY2UgJyhbXiddKyknL2cpO1xuICAgIGZvciAoY29uc3QgbWF0Y2ggb2YgcmVzb3VyY2VNYXRjaGVzKSB7XG4gICAgICBmYWlsZWRSZXNvdXJjZXMucHVzaChtYXRjaFsxXSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBob29rTmFtZSxcbiAgICAgIGZhaWx1cmVNb2RlLFxuICAgICAgZmFpbGVkUmVzb3VyY2VzLFxuICAgICAgZXJyb3JNZXNzYWdlOiBzdGF0dXNSZWFzb24sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDli5XnmoTjg6rjgr3jg7zjgrnlkI3jga7nlJ/miJBcbiAgICogXG4gICAqIEBwYXJhbSBmYWlsZWRSZXNvdXJjZXMg5aSx5pWX44GX44Gf44Oq44K944O844K55ZCN44Gu44Oq44K544OIXG4gICAqIEByZXR1cm5zIOaWsOOBl+OBhOODquOCveODvOOCueWQjeOBruODnuODg+ODl1xuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZUR5bmFtaWNSZXNvdXJjZU5hbWVzKGZhaWxlZFJlc291cmNlczogc3RyaW5nW10pOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9IHtcbiAgICBjb25zdCBzdWdnZXN0ZWROYW1lczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKC9bOi5dL2csICctJykuc2xpY2UoMCwgMTkpO1xuICAgIFxuICAgIGZvciAoY29uc3QgcmVzb3VyY2VOYW1lIG9mIGZhaWxlZFJlc291cmNlcykge1xuICAgICAgLy8g44K/44Kk44Og44K544K/44Oz44OX44KS6L+95Yqg44GX44Gm5LiA5oSP44Gq5ZCN5YmN44KS55Sf5oiQXG4gICAgICBjb25zdCBuZXdOYW1lID0gYCR7cmVzb3VyY2VOYW1lfS0ke3RpbWVzdGFtcH1gO1xuICAgICAgc3VnZ2VzdGVkTmFtZXNbcmVzb3VyY2VOYW1lXSA9IG5ld05hbWU7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdWdnZXN0ZWROYW1lcztcbiAgfVxuXG4gIC8qKlxuICAgKiDlpInmm7Tjgrvjg4Pjg4jjga7kvZzmiJDjgajnorroqo1cbiAgICogXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZUJvZHkgQ2xvdWRGb3JtYXRpb27jg4bjg7Pjg5fjg6zjg7zjg4hcbiAgICogQHJldHVybnMg5aSJ5pu044K744OD44OI56K66KqN57WQ5p6cXG4gICAqL1xuICBhc3luYyBjcmVhdGVBbmRDaGVja0NoYW5nZVNldCh0ZW1wbGF0ZUJvZHk6IHN0cmluZyk6IFByb21pc2U8UmVzb3VyY2VDb25mbGljdENoZWNrUmVzdWx0PiB7XG4gICAgY29uc3QgY2hhbmdlU2V0TmFtZSA9IGBwcmUtZGVwbG95LWNoZWNrLSR7RGF0ZS5ub3coKX1gO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+TnSDlpInmm7Tjgrvjg4Pjg4jkvZzmiJDkuK06ICR7Y2hhbmdlU2V0TmFtZX1gKTtcbiAgICAgIFxuICAgICAgLy8g5aSJ5pu044K744OD44OI5L2c5oiQXG4gICAgICBhd2FpdCB0aGlzLmNsb3VkZm9ybWF0aW9uLmNyZWF0ZUNoYW5nZVNldCh7XG4gICAgICAgIFN0YWNrTmFtZTogdGhpcy5wcm9wcy5zdGFja05hbWUsXG4gICAgICAgIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUsXG4gICAgICAgIFRlbXBsYXRlQm9keTogdGVtcGxhdGVCb2R5LFxuICAgICAgICBDaGFuZ2VTZXRUeXBlOiAnQ1JFQVRFJywgLy8g5paw6KaP44K544K/44OD44Kv44Gu5aC05ZCIXG4gICAgICAgIENhcGFiaWxpdGllczogWydDQVBBQklMSVRZX0lBTScsICdDQVBBQklMSVRZX05BTUVEX0lBTScsICdDQVBBQklMSVRZX0FVVE9fRVhQQU5EJ10sXG4gICAgICB9KS5wcm9taXNlKCk7XG4gICAgICBcbiAgICAgIC8vIOWkieabtOOCu+ODg+ODiOS9nOaIkOWujOS6huOCkuW+heapn1xuICAgICAgYXdhaXQgdGhpcy53YWl0Rm9yQ2hhbmdlU2V0Q3JlYXRpb24oY2hhbmdlU2V0TmFtZSk7XG4gICAgICBcbiAgICAgIC8vIOWkieabtOOCu+ODg+ODiOeiuuiqjVxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jaGVja0NoYW5nZVNldChjaGFuZ2VTZXROYW1lKTtcbiAgICAgIFxuICAgICAgLy8g5aSJ5pu044K744OD44OI5YmK6ZmkXG4gICAgICBhd2FpdCB0aGlzLmNsb3VkZm9ybWF0aW9uLmRlbGV0ZUNoYW5nZVNldCh7XG4gICAgICAgIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUsXG4gICAgICAgIFN0YWNrTmFtZTogdGhpcy5wcm9wcy5zdGFja05hbWUsXG4gICAgICB9KS5wcm9taXNlKCk7XG4gICAgICBcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICBcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICBjb25zb2xlLmVycm9yKGDinYwg5aSJ5pu044K744OD44OI5L2c5oiQ44Ko44Op44O8OmAsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWkieabtOOCu+ODg+ODiOS9nOaIkOWujOS6huOCkuW+heapn1xuICAgKiBcbiAgICogQHBhcmFtIGNoYW5nZVNldE5hbWUg5aSJ5pu044K744OD44OI5ZCNXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHdhaXRGb3JDaGFuZ2VTZXRDcmVhdGlvbihjaGFuZ2VTZXROYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuICAgIGNvbnN0IG1heEF0dGVtcHRzID0gMzA7XG4gICAgXG4gICAgd2hpbGUgKGF0dGVtcHRzIDwgbWF4QXR0ZW1wdHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2xvdWRmb3JtYXRpb24uZGVzY3JpYmVDaGFuZ2VTZXQoe1xuICAgICAgICAgIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUsXG4gICAgICAgICAgU3RhY2tOYW1lOiB0aGlzLnByb3BzLnN0YWNrTmFtZSxcbiAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlc3VsdC5TdGF0dXMgPT09ICdDUkVBVEVfQ09NUExFVEUnIHx8IHJlc3VsdC5TdGF0dXMgPT09ICdGQUlMRUQnKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMjAwMCkpO1xuICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgdGhyb3cgbmV3IEVycm9yKGDlpInmm7Tjgrvjg4Pjg4jkvZzmiJDjga7jgr/jgqTjg6DjgqLjgqbjg4g6ICR7Y2hhbmdlU2V0TmFtZX1gKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWN1cml0eSBHcm91cOOBruertuWQiOODgeOCp+ODg+OCr1xuICAgKi9cbiAgYXN5bmMgY2hlY2tTZWN1cml0eUdyb3VwQ29uZmxpY3RzKHNlY3VyaXR5R3JvdXBOYW1lczogc3RyaW5nW10pOiBQcm9taXNlPFJlc291cmNlQ29uZmxpY3RDaGVja1Jlc3VsdD4ge1xuICAgIGNvbnN0IGNvbmZsaWN0aW5nUmVzb3VyY2VzOiBDb25mbGljdGluZ1Jlc291cmNlW10gPSBbXTtcbiAgICBjb25zdCByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgICBpZiAoc2VjdXJpdHlHcm91cE5hbWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaGFzQ29uZmxpY3Q6IGZhbHNlLFxuICAgICAgICBjb25mbGljdGluZ1Jlc291cmNlczogW10sXG4gICAgICAgIHJlY29tbWVuZGF0aW9uczogW10sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBTZWN1cml0eSBHcm91cOWQjeOBp+aknOe0olxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5lYzIuZGVzY3JpYmVTZWN1cml0eUdyb3Vwcyh7XG4gICAgICAgIEZpbHRlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBOYW1lOiAnZ3JvdXAtbmFtZScsXG4gICAgICAgICAgICBWYWx1ZXM6IHNlY3VyaXR5R3JvdXBOYW1lcyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSkucHJvbWlzZSgpO1xuXG4gICAgICBpZiAocmVzdWx0LlNlY3VyaXR5R3JvdXBzICYmIHJlc3VsdC5TZWN1cml0eUdyb3Vwcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZvciAoY29uc3Qgc2cgb2YgcmVzdWx0LlNlY3VyaXR5R3JvdXBzKSB7XG4gICAgICAgICAgY29uZmxpY3RpbmdSZXNvdXJjZXMucHVzaCh7XG4gICAgICAgICAgICByZXNvdXJjZVR5cGU6ICdBV1M6OkVDMjo6U2VjdXJpdHlHcm91cCcsXG4gICAgICAgICAgICByZXNvdXJjZU5hbWU6IHNnLkdyb3VwTmFtZSB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICByZXNvdXJjZUlkOiBzZy5Hcm91cElkLFxuICAgICAgICAgICAgZXhpc3RpbmdSZXNvdXJjZUFybjogYGFybjphd3M6ZWMyOiR7dGhpcy5wcm9wcy5yZWdpb259OiR7dGhpcy5wcm9wcy5hY2NvdW50SWR9OnNlY3VyaXR5LWdyb3VwLyR7c2cuR3JvdXBJZH1gLFxuICAgICAgICAgICAgY29uZmxpY3RSZWFzb246IGBTZWN1cml0eSBHcm91cCAnJHtzZy5Hcm91cE5hbWV9JyAoJHtzZy5Hcm91cElkfSkg44Gv5pei44Gr5a2Y5Zyo44GX44G+44GZYCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIOaOqOWlqOS6i+mgheOCkui/veWKoFxuICAgICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKFxuICAgICAgICAgICAgYOOCquODl+OCt+ODp+ODszE6IOaXouWtmFNlY3VyaXR5IEdyb3VwICcke3NnLkdyb3VwTmFtZX0nIOOCkuOCpOODs+ODneODvOODiDogZWMyLlNlY3VyaXR5R3JvdXAuZnJvbVNlY3VyaXR5R3JvdXBJZCh0aGlzLCAnU0cnLCAnJHtzZy5Hcm91cElkfScpYFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goXG4gICAgICAgICAgICBg44Kq44OX44K344On44OzMjogU2VjdXJpdHkgR3JvdXDlkI3jgpLlpInmm7Q6ICR7c2cuR3JvdXBOYW1lfS12MmBcbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOS9v+eUqOeKtuazgeOCkueiuuiqjVxuICAgICAgICAgIGNvbnN0IG5ldHdvcmtJbnRlcmZhY2VzID0gYXdhaXQgdGhpcy5lYzIuZGVzY3JpYmVOZXR3b3JrSW50ZXJmYWNlcyh7XG4gICAgICAgICAgICBGaWx0ZXJzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBOYW1lOiAnZ3JvdXAtaWQnLFxuICAgICAgICAgICAgICAgIFZhbHVlczogW3NnLkdyb3VwSWQgfHwgJyddLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9KS5wcm9taXNlKCk7XG5cbiAgICAgICAgICBpZiAobmV0d29ya0ludGVyZmFjZXMuTmV0d29ya0ludGVyZmFjZXMgJiYgbmV0d29ya0ludGVyZmFjZXMuTmV0d29ya0ludGVyZmFjZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goXG4gICAgICAgICAgICAgIGDimqDvuI8g5rOo5oSPOiBTZWN1cml0eSBHcm91cCAnJHtzZy5Hcm91cE5hbWV9JyDjga8gJHtuZXR3b3JrSW50ZXJmYWNlcy5OZXR3b3JrSW50ZXJmYWNlcy5sZW5ndGh9IOWAi+OBruODjeODg+ODiOODr+ODvOOCr+OCpOODs+OCv+ODvOODleOCp+ODvOOCueOBp+S9v+eUqOS4reOBp+OBmWBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKFxuICAgICAgICAgICAgICBg44Kq44OX44K344On44OzMzog5pyq5L2/55So44GuU2VjdXJpdHkgR3JvdXAgJyR7c2cuR3JvdXBOYW1lfScg44KS5YmK6ZmkOiBhd3MgZWMyIGRlbGV0ZS1zZWN1cml0eS1ncm91cCAtLWdyb3VwLWlkICR7c2cuR3JvdXBJZH1gXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIFNlY3VyaXR5IEdyb3Vw44Gu44OB44Kn44OD44Kv5Lit44Gr44Ko44Op44O8OmAsIGVycm9yLm1lc3NhZ2UpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBoYXNDb25mbGljdDogY29uZmxpY3RpbmdSZXNvdXJjZXMubGVuZ3RoID4gMCxcbiAgICAgIGNvbmZsaWN0aW5nUmVzb3VyY2VzLFxuICAgICAgcmVjb21tZW5kYXRpb25zLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRHluYW1vRELjg4bjg7zjg5bjg6vlkI3jga7nq7blkIjjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIGFzeW5jIGNoZWNrRHluYW1vREJDb25mbGljdHModGFibGVOYW1lczogc3RyaW5nW10pOiBQcm9taXNlPFJlc291cmNlQ29uZmxpY3RDaGVja1Jlc3VsdD4ge1xuICAgIGNvbnN0IGNvbmZsaWN0aW5nUmVzb3VyY2VzOiBDb25mbGljdGluZ1Jlc291cmNlW10gPSBbXTtcbiAgICBjb25zdCByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHRhYmxlTmFtZSBvZiB0YWJsZU5hbWVzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmR5bmFtb2RiLmRlc2NyaWJlVGFibGUoeyBUYWJsZU5hbWU6IHRhYmxlTmFtZSB9KS5wcm9taXNlKCk7XG4gICAgICAgIFxuICAgICAgICAvLyDjg4bjg7zjg5bjg6vjgYzlrZjlnKjjgZnjgovloLTlkIhcbiAgICAgICAgaWYgKHJlc3VsdC5UYWJsZSkge1xuICAgICAgICAgIGNvbmZsaWN0aW5nUmVzb3VyY2VzLnB1c2goe1xuICAgICAgICAgICAgcmVzb3VyY2VUeXBlOiAnQVdTOjpEeW5hbW9EQjo6VGFibGUnLFxuICAgICAgICAgICAgcmVzb3VyY2VOYW1lOiB0YWJsZU5hbWUsXG4gICAgICAgICAgICBleGlzdGluZ1Jlc291cmNlQXJuOiByZXN1bHQuVGFibGUuVGFibGVBcm4sXG4gICAgICAgICAgICBjb25mbGljdFJlYXNvbjogYOODhuODvOODluODqyAnJHt0YWJsZU5hbWV9JyDjga/ml6LjgavlrZjlnKjjgZfjgb7jgZlgLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8g5o6o5aWo5LqL6aCF44KS6L+95YqgXG4gICAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goXG4gICAgICAgICAgICBg44Kq44OX44K344On44OzMTog5pei5a2Y44OG44O844OW44OrICcke3RhYmxlTmFtZX0nIOOCkuWJiumZpDogYXdzIGR5bmFtb2RiIGRlbGV0ZS10YWJsZSAtLXRhYmxlLW5hbWUgJHt0YWJsZU5hbWV9YFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goXG4gICAgICAgICAgICBg44Kq44OX44K344On44OzMjog44OG44O844OW44Or5ZCN44KS5aSJ5pu0OiAke3RhYmxlTmFtZX0tdjJgXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZWNvbW1lbmRhdGlvbnMucHVzaChcbiAgICAgICAgICAgIGDjgqrjg5fjgrfjg6fjg7MzOiDml6LlrZjjg4bjg7zjg5bjg6vjgpLjgqTjg7Pjg53jg7zjg4g6IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUoKWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIC8vIFJlc291cmNlTm90Rm91bmRFeGNlcHRpb24g44Gv5q2j5bi477yI44OG44O844OW44Or44GM5a2Y5Zyo44GX44Gq44GE77yJXG4gICAgICAgIGlmIChlcnJvci5jb2RlICE9PSAnUmVzb3VyY2VOb3RGb3VuZEV4Y2VwdGlvbicpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDjg4bjg7zjg5bjg6sgJyR7dGFibGVOYW1lfScg44Gu44OB44Kn44OD44Kv5Lit44Gr44Ko44Op44O8OmAsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGhhc0NvbmZsaWN0OiBjb25mbGljdGluZ1Jlc291cmNlcy5sZW5ndGggPiAwLFxuICAgICAgY29uZmxpY3RpbmdSZXNvdXJjZXMsXG4gICAgICByZWNvbW1lbmRhdGlvbnMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZEZvcm1hdGlvbuOCueOCv+ODg+OCr+OBruaXouWtmOODquOCveODvOOCueODgeOCp+ODg+OCr1xuICAgKi9cbiAgYXN5bmMgY2hlY2tTdGFja1Jlc291cmNlcygpOiBQcm9taXNlPFJlc291cmNlQ29uZmxpY3RDaGVja1Jlc3VsdD4ge1xuICAgIGNvbnN0IGNvbmZsaWN0aW5nUmVzb3VyY2VzOiBDb25mbGljdGluZ1Jlc291cmNlW10gPSBbXTtcbiAgICBjb25zdCByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jbG91ZGZvcm1hdGlvbi5kZXNjcmliZVN0YWNrcyh7XG4gICAgICAgIFN0YWNrTmFtZTogdGhpcy5wcm9wcy5zdGFja05hbWUsXG4gICAgICB9KS5wcm9taXNlKCk7XG5cbiAgICAgIGlmIChyZXN1bHQuU3RhY2tzICYmIHJlc3VsdC5TdGFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBzdGFjayA9IHJlc3VsdC5TdGFja3NbMF07XG4gICAgICAgIFxuICAgICAgICAvLyDjgrnjgr/jg4Pjgq/jgYwgUk9MTEJBQ0tfQ09NUExFVEUg54q25oWL44Gu5aC05ZCIXG4gICAgICAgIGlmIChzdGFjay5TdGFja1N0YXR1cyA9PT0gJ1JPTExCQUNLX0NPTVBMRVRFJykge1xuICAgICAgICAgIGNvbmZsaWN0aW5nUmVzb3VyY2VzLnB1c2goe1xuICAgICAgICAgICAgcmVzb3VyY2VUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgcmVzb3VyY2VOYW1lOiB0aGlzLnByb3BzLnN0YWNrTmFtZSxcbiAgICAgICAgICAgIGV4aXN0aW5nUmVzb3VyY2VBcm46IHN0YWNrLlN0YWNrSWQsXG4gICAgICAgICAgICBjb25mbGljdFJlYXNvbjogYOOCueOCv+ODg+OCryAnJHt0aGlzLnByb3BzLnN0YWNrTmFtZX0nIOOBryBST0xMQkFDS19DT01QTEVURSDnirbmhYvjgafjgZlgLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goXG4gICAgICAgICAgICBg44K544K/44OD44Kv44KS5YmK6Zmk44GX44Gm44GL44KJ5YaN44OH44OX44Ot44KkOiBhd3MgY2xvdWRmb3JtYXRpb24gZGVsZXRlLXN0YWNrIC0tc3RhY2stbmFtZSAke3RoaXMucHJvcHMuc3RhY2tOYW1lfWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g44K544K/44OD44Kv44GMIFVQREFURV9ST0xMQkFDS19DT01QTEVURSDnirbmhYvjga7loLTlkIhcbiAgICAgICAgaWYgKHN0YWNrLlN0YWNrU3RhdHVzID09PSAnVVBEQVRFX1JPTExCQUNLX0NPTVBMRVRFJykge1xuICAgICAgICAgIGNvbmZsaWN0aW5nUmVzb3VyY2VzLnB1c2goe1xuICAgICAgICAgICAgcmVzb3VyY2VUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgcmVzb3VyY2VOYW1lOiB0aGlzLnByb3BzLnN0YWNrTmFtZSxcbiAgICAgICAgICAgIGV4aXN0aW5nUmVzb3VyY2VBcm46IHN0YWNrLlN0YWNrSWQsXG4gICAgICAgICAgICBjb25mbGljdFJlYXNvbjogYOOCueOCv+ODg+OCryAnJHt0aGlzLnByb3BzLnN0YWNrTmFtZX0nIOOBryBVUERBVEVfUk9MTEJBQ0tfQ09NUExFVEUg54q25oWL44Gn44GZYCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKFxuICAgICAgICAgICAgYOOCueOCv+ODg+OCr+OCkuWJiumZpOOBl+OBpuOBi+OCieWGjeODh+ODl+ODreOCpDogYXdzIGNsb3VkZm9ybWF0aW9uIGRlbGV0ZS1zdGFjayAtLXN0YWNrLW5hbWUgJHt0aGlzLnByb3BzLnN0YWNrTmFtZX1gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIC8vIFZhbGlkYXRpb25FcnJvciDjga/mraPluLjvvIjjgrnjgr/jg4Pjgq/jgYzlrZjlnKjjgZfjgarjgYTvvIlcbiAgICAgIGlmIChlcnJvci5jb2RlICE9PSAnVmFsaWRhdGlvbkVycm9yJykge1xuICAgICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDjgrnjgr/jg4Pjgq8gJyR7dGhpcy5wcm9wcy5zdGFja05hbWV9JyDjga7jg4Hjgqfjg4Pjgq/kuK3jgavjgqjjg6njg7w6YCwgZXJyb3IubWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGhhc0NvbmZsaWN0OiBjb25mbGljdGluZ1Jlc291cmNlcy5sZW5ndGggPiAwLFxuICAgICAgY29uZmxpY3RpbmdSZXNvdXJjZXMsXG4gICAgICByZWNvbW1lbmRhdGlvbnMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDljIXmi6znmoTjgarjg6rjgr3jg7zjgrnnq7blkIjjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIGFzeW5jIGNoZWNrQWxsQ29uZmxpY3RzKFxuICAgIHRhYmxlTmFtZXM6IHN0cmluZ1tdLFxuICAgIHNlY3VyaXR5R3JvdXBOYW1lczogc3RyaW5nW10gPSBbXVxuICApOiBQcm9taXNlPFJlc291cmNlQ29uZmxpY3RDaGVja1Jlc3VsdD4ge1xuICAgIGNvbnN0IGR5bmFtb2RiUmVzdWx0ID0gYXdhaXQgdGhpcy5jaGVja0R5bmFtb0RCQ29uZmxpY3RzKHRhYmxlTmFtZXMpO1xuICAgIGNvbnN0IHN0YWNrUmVzdWx0ID0gYXdhaXQgdGhpcy5jaGVja1N0YWNrUmVzb3VyY2VzKCk7XG4gICAgY29uc3Qgc2VjdXJpdHlHcm91cFJlc3VsdCA9IGF3YWl0IHRoaXMuY2hlY2tTZWN1cml0eUdyb3VwQ29uZmxpY3RzKHNlY3VyaXR5R3JvdXBOYW1lcyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaGFzQ29uZmxpY3Q6IGR5bmFtb2RiUmVzdWx0Lmhhc0NvbmZsaWN0IHx8IHN0YWNrUmVzdWx0Lmhhc0NvbmZsaWN0IHx8IHNlY3VyaXR5R3JvdXBSZXN1bHQuaGFzQ29uZmxpY3QsXG4gICAgICBjb25mbGljdGluZ1Jlc291cmNlczogW1xuICAgICAgICAuLi5keW5hbW9kYlJlc3VsdC5jb25mbGljdGluZ1Jlc291cmNlcyxcbiAgICAgICAgLi4uc3RhY2tSZXN1bHQuY29uZmxpY3RpbmdSZXNvdXJjZXMsXG4gICAgICAgIC4uLnNlY3VyaXR5R3JvdXBSZXN1bHQuY29uZmxpY3RpbmdSZXNvdXJjZXMsXG4gICAgICBdLFxuICAgICAgcmVjb21tZW5kYXRpb25zOiBbXG4gICAgICAgIC4uLmR5bmFtb2RiUmVzdWx0LnJlY29tbWVuZGF0aW9ucyxcbiAgICAgICAgLi4uc3RhY2tSZXN1bHQucmVjb21tZW5kYXRpb25zLFxuICAgICAgICAuLi5zZWN1cml0eUdyb3VwUmVzdWx0LnJlY29tbWVuZGF0aW9ucyxcbiAgICAgIF0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnq7blkIjjg6zjg53jg7zjg4jjga7lh7rliptcbiAgICovXG4gIHByaW50Q29uZmxpY3RSZXBvcnQocmVzdWx0OiBSZXNvdXJjZUNvbmZsaWN0Q2hlY2tSZXN1bHQpOiB2b2lkIHtcbiAgICBpZiAoIXJlc3VsdC5oYXNDb25mbGljdCkge1xuICAgICAgY29uc29sZS5sb2coJ+KchSDjg6rjgr3jg7zjgrnnq7blkIjjg4Hjgqfjg4Pjgq86IOertuWQiOOBquOBlycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdcXG7ilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcbiAgICBjb25zb2xlLmxvZygn4pqg77iPICDjg6rjgr3jg7zjgrnnq7blkIjmpJzlh7onKTtcbiAgICBjb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG4gICAgY29uc29sZS5sb2coJycpO1xuICAgIGNvbnNvbGUubG9nKCfku6XkuIvjga7jg6rjgr3jg7zjgrnjgYzml6LjgavlrZjlnKjjgZnjgovjgZ/jgoHjgIHjg4fjg5fjg63jgqTjgYzlpLHmlZfjgZnjgovlj6/og73mgKfjgYzjgYLjgorjgb7jgZk6Jyk7XG4gICAgY29uc29sZS5sb2coJycpO1xuXG4gICAgcmVzdWx0LmNvbmZsaWN0aW5nUmVzb3VyY2VzLmZvckVhY2goKHJlc291cmNlLCBpbmRleCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYCR7aW5kZXggKyAxfS4gJHtyZXNvdXJjZS5yZXNvdXJjZVR5cGV9YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAg5ZCN5YmNOiAke3Jlc291cmNlLnJlc291cmNlTmFtZX1gKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICDnkIbnlLE6ICR7cmVzb3VyY2UuY29uZmxpY3RSZWFzb259YCk7XG4gICAgICBpZiAocmVzb3VyY2UuZXhpc3RpbmdSZXNvdXJjZUFybikge1xuICAgICAgICBjb25zb2xlLmxvZyhgICAgQVJOOiAke3Jlc291cmNlLmV4aXN0aW5nUmVzb3VyY2VBcm59YCk7XG4gICAgICB9XG4gICAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG4gICAgY29uc29sZS5sb2coJ/CfkqEg5o6o5aWo44GV44KM44KL6Kej5rG6562WOicpO1xuICAgIGNvbnNvbGUubG9nKCfilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKTtcbiAgICBjb25zb2xlLmxvZygnJyk7XG5cbiAgICByZXN1bHQucmVjb21tZW5kYXRpb25zLmZvckVhY2goKHJlY29tbWVuZGF0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYCR7aW5kZXggKyAxfS4gJHtyZWNvbW1lbmRhdGlvbn1gKTtcbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICBjb25zb2xlLmxvZygn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDREsgQXNwZWN0OiDjg4fjg5fjg63jgqTliY3jgavjg6rjgr3jg7zjgrnnq7blkIjjgpLjg4Hjgqfjg4Pjgq9cbiAqL1xuZXhwb3J0IGNsYXNzIFJlc291cmNlQ29uZmxpY3RBc3BlY3QgaW1wbGVtZW50cyBjZGsuSUFzcGVjdCB7XG4gIHByaXZhdGUgaGFuZGxlcjogUmVzb3VyY2VDb25mbGljdEhhbmRsZXI7XG4gIHByaXZhdGUgdGFibGVOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBzZWN1cml0eUdyb3VwTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IoaGFuZGxlcjogUmVzb3VyY2VDb25mbGljdEhhbmRsZXIpIHtcbiAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICB9XG5cbiAgdmlzaXQobm9kZTogSUNvbnN0cnVjdCk6IHZvaWQge1xuICAgIC8vIER5bmFtb0RC44OG44O844OW44Or44KS5Y+O6ZuGXG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBjZGsuYXdzX2R5bmFtb2RiLlRhYmxlKSB7XG4gICAgICBjb25zdCB0YWJsZSA9IG5vZGUgYXMgY2RrLmF3c19keW5hbW9kYi5UYWJsZTtcbiAgICAgIGlmICh0YWJsZS50YWJsZU5hbWUpIHtcbiAgICAgICAgdGhpcy50YWJsZU5hbWVzLnB1c2godGFibGUudGFibGVOYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTZWN1cml0eSBHcm91cOOCkuWPjumbhlxuICAgIGlmIChub2RlIGluc3RhbmNlb2YgY2RrLmF3c19lYzIuU2VjdXJpdHlHcm91cCkge1xuICAgICAgY29uc3Qgc2cgPSBub2RlIGFzIGNkay5hd3NfZWMyLlNlY3VyaXR5R3JvdXA7XG4gICAgICAvLyBzZWN1cml0eUdyb3VwTmFtZSBpcyBub3QgYXZhaWxhYmxlIGluIENESyB2MiwgdXNlIHNlY3VyaXR5R3JvdXBJZCBpbnN0ZWFkXG4gICAgICBpZiAoc2cuc2VjdXJpdHlHcm91cElkKSB7XG4gICAgICAgIHRoaXMuc2VjdXJpdHlHcm91cE5hbWVzLnB1c2goc2cuc2VjdXJpdHlHcm91cElkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5Y+O6ZuG44GX44Gf44Oq44K944O844K55ZCN44Gn56u25ZCI44OB44Kn44OD44Kv44KS5a6f6KGMXG4gICAqL1xuICBhc3luYyBjaGVja0NvbmZsaWN0cygpOiBQcm9taXNlPFJlc291cmNlQ29uZmxpY3RDaGVja1Jlc3VsdD4ge1xuICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZXIuY2hlY2tBbGxDb25mbGljdHModGhpcy50YWJsZU5hbWVzLCB0aGlzLnNlY3VyaXR5R3JvdXBOYW1lcyk7XG4gIH1cbn1cbiJdfQ==