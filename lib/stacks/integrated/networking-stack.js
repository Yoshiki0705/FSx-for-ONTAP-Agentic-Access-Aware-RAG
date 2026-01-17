"use strict";
/**
 * 統合ネットワーキングスタック
 *
 * モジュラーアーキテクチャに基づくネットワーク基盤統合管理
 * - VPC・サブネット構成
 * - インターネットゲートウェイ・NATゲートウェイ
 * - セキュリティグループ・NACL
 * - VPCエンドポイント
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
exports.NetworkingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const networking_1 = require("../../modules/networking");
// タグ設定
const tagging_config_1 = require("../../config/tagging-config");
class NetworkingStack extends cdk.Stack {
    networkingConstruct;
    vpc;
    publicSubnets;
    privateSubnets;
    isolatedSubnets;
    securityGroups;
    constructor(scope, id, props) {
        super(scope, id, props);
        // コスト配布タグの適用
        const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig(props.projectName, (props.environment === 'test' ? 'dev' : props.environment));
        tagging_config_1.TaggingStrategy.applyTagsToStack(this, taggingConfig);
        try {
            // 入力値の検証
            this.validateProps(props);
            const { config, projectName, environment } = props;
            // ネットワーキングコンストラクト作成
            this.networkingConstruct = new networking_1.NetworkingConstruct(this, 'NetworkingConstruct', {
                config,
                projectName,
                environment,
            });
            // 主要リソースの参照を設定
            this.vpc = this.networkingConstruct.vpc;
            this.publicSubnets = this.networkingConstruct.publicSubnets;
            this.privateSubnets = this.networkingConstruct.privateSubnets;
            this.isolatedSubnets = this.networkingConstruct.isolatedSubnets;
            this.securityGroups = this.networkingConstruct.securityGroups;
            // CloudFormation出力
            this.createOutputs();
            // スタックレベルのタグ設定
            this.applyStackTags(projectName, environment);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`NetworkingStack初期化エラー: ${errorMessage}`);
        }
    }
    /**
     * プロパティの検証
     */
    validateProps(props) {
        const { config, projectName, environment } = props;
        if (!projectName || projectName.trim().length === 0) {
            throw new Error('プロジェクト名が設定されていません');
        }
        if (!environment || environment.trim().length === 0) {
            throw new Error('環境名が設定されていません');
        }
        if (!config) {
            throw new Error('ネットワーキング設定が設定されていません');
        }
        // プロジェクト名の長さ制限（AWS リソース名制限を考慮）
        if (projectName.length > 50) {
            throw new Error('プロジェクト名は50文字以内で設定してください');
        }
        // 環境名の検証
        const validEnvironments = ['dev', 'staging', 'prod', 'test'];
        if (!validEnvironments.includes(environment)) {
            throw new Error(`環境名は次のいずれかを指定してください: ${validEnvironments.join(', ')}`);
        }
    }
    /**
     * CloudFormation出力の作成
     */
    createOutputs() {
        // VPC情報
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID',
            exportName: `${this.stackName}-VpcId`,
        });
        new cdk.CfnOutput(this, 'VpcCidr', {
            value: this.vpc.vpcCidrBlock,
            description: 'VPC CIDR Block',
            exportName: `${this.stackName}-VpcCidr`,
        });
        new cdk.CfnOutput(this, 'VpcAvailabilityZones', {
            value: cdk.Fn.join(',', this.vpc.availabilityZones),
            description: 'VPC Availability Zones',
            exportName: `${this.stackName}-AvailabilityZones`,
        });
        // サブネット情報
        this.publicSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Public Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-PublicSubnet${index + 1}Id`,
            });
        });
        this.privateSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Private Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-PrivateSubnet${index + 1}Id`,
            });
        });
        this.isolatedSubnets.forEach((subnet, index) => {
            new cdk.CfnOutput(this, `IsolatedSubnet${index + 1}Id`, {
                value: subnet.subnetId,
                description: `Isolated Subnet ${index + 1} ID`,
                exportName: `${this.stackName}-IsolatedSubnet${index + 1}Id`,
            });
        });
        // セキュリティグループ情報
        Object.entries(this.securityGroups).forEach(([name, sg]) => {
            new cdk.CfnOutput(this, `SecurityGroup${name}Id`, {
                value: sg.securityGroupId,
                description: `Security Group ${name} ID`,
                exportName: `${this.stackName}-SecurityGroup${name}Id`,
            });
        });
    }
    /**
     * スタックレベルのタグ設定
     */
    applyStackTags(projectName, environment) {
        // タグ値のサニタイズ（セキュリティ対策）
        const sanitizedProjectName = this.sanitizeTagValue(projectName);
        const sanitizedEnvironment = this.sanitizeTagValue(environment);
        cdk.Tags.of(this).add('Project', sanitizedProjectName);
        cdk.Tags.of(this).add('Environment', sanitizedEnvironment);
        cdk.Tags.of(this).add('Stack', 'NetworkingStack');
        cdk.Tags.of(this).add('Component', 'Infrastructure');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('CostCenter', `${sanitizedProjectName}-${sanitizedEnvironment}-networking`);
        cdk.Tags.of(this).add('CreatedAt', new Date().toISOString().split('T')[0]);
    }
    /**
     * タグ値のサニタイズ
     */
    sanitizeTagValue(value) {
        // 不正な文字を除去し、長さを制限
        return value
            .replace(/[<>\"'&]/g, '') // XSS対策
            .substring(0, 256) // AWS タグ値の最大長制限
            .trim();
    }
    /**
     * 他のスタックで使用するためのネットワーク情報を取得
     */
    getNetworkingInfo() {
        return {
            vpc: this.vpc,
            publicSubnets: this.publicSubnets,
            privateSubnets: this.privateSubnets,
            isolatedSubnets: this.isolatedSubnets,
            securityGroups: this.securityGroups,
            availabilityZones: this.vpc.availabilityZones,
        };
    }
    /**
     * 特定のセキュリティグループを取得
     */
    getSecurityGroup(name) {
        return this.securityGroups[name];
    }
    /**
     * VPCエンドポイント情報を取得
     */
    getVpcEndpoints() {
        return this.networkingConstruct.vpcEndpoints || {};
    }
}
exports.NetworkingStack = NetworkingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29ya2luZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ldHdvcmtpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUVuQyx5REFBK0Q7QUFHL0QsT0FBTztBQUNQLGdFQUFzRjtBQWN0RixNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUIsbUJBQW1CLENBQXNCO0lBQ3pDLEdBQUcsQ0FBa0I7SUFDckIsYUFBYSxDQUF3QjtJQUNyQyxjQUFjLENBQXdCO0lBQ3RDLGVBQWUsQ0FBd0I7SUFDdkMsY0FBYyxDQUErQztJQUU3RSxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGFBQWE7UUFDYixNQUFNLGFBQWEsR0FBRyx1Q0FBc0IsQ0FBQyxpQkFBaUIsQ0FDNUQsS0FBSyxDQUFDLFdBQVcsRUFDakIsQ0FBQyxLQUFLLENBQUMsV0FBVyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUErQixDQUN6RixDQUFDO1FBQ0YsZ0NBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFdEQsSUFBSSxDQUFDO1lBQ0gsU0FBUztZQUNULElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFMUIsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEdBQUcsS0FBSyxDQUFDO1lBRW5ELG9CQUFvQjtZQUNwQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxnQ0FBbUIsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7Z0JBQzlFLE1BQU07Z0JBQ04sV0FBVztnQkFDWCxX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QUFjO1lBQ25DLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZTtZQUNyQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWM7WUFDbkMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUI7U0FDOUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLGdCQUFnQixDQUFDLElBQVk7UUFDbEMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRDs7T0FFRztJQUNJLGVBQWU7UUFDcEIsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQztJQUNyRCxDQUFDO0NBQ0Y7QUF4TUQsMENBd01DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDntbHlkIjjg43jg4Pjg4jjg6/jg7zjgq3jg7PjgrDjgrnjgr/jg4Pjgq9cbiAqIFxuICog44Oi44K444Ol44Op44O844Ki44O844Kt44OG44Kv44OB44Oj44Gr5Z+644Gl44GP44ON44OD44OI44Ov44O844Kv5Z+655uk57Wx5ZCI566h55CGXG4gKiAtIFZQQ+ODu+OCteODluODjeODg+ODiOani+aIkFxuICogLSDjgqTjg7Pjgr/jg7zjg43jg4Pjg4jjgrLjg7zjg4jjgqbjgqfjgqTjg7tOQVTjgrLjg7zjg4jjgqbjgqfjgqRcbiAqIC0g44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44O7TkFDTFxuICogLSBWUEPjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBOZXR3b3JraW5nQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9uZXR3b3JraW5nJztcbmltcG9ydCB7IE5ldHdvcmtpbmdDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL25ldHdvcmtpbmcnO1xuXG4vLyDjgr/jgrDoqK3lrppcbmltcG9ydCB7IFRhZ2dpbmdTdHJhdGVneSwgUGVybWlzc2lvbkF3YXJlUkFHVGFncyB9IGZyb20gJy4uLy4uL2NvbmZpZy90YWdnaW5nLWNvbmZpZyc7XG5cbi8qKlxuICogTmV0d29ya2luZ1N0YWNrIOOBruODl+ODreODkeODhuOCo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIE5ldHdvcmtpbmdTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKiog44ON44OD44OI44Ov44O844Kt44Oz44Kw6Kit5a6aICovXG4gIGNvbmZpZzogTmV0d29ya2luZ0NvbmZpZztcbiAgLyoqIOODl+ODreOCuOOCp+OCr+ODiOWQje+8iDUw5paH5a2X5Lul5YaF77yJICovXG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIC8qKiDnkrDlooPlkI3vvIhkZXYvc3RhZ2luZy9wcm9kL3Rlc3TvvIkgKi9cbiAgZW52aXJvbm1lbnQ6ICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnIHwgJ3Rlc3QnO1xufVxuXG5leHBvcnQgY2xhc3MgTmV0d29ya2luZ1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IG5ldHdvcmtpbmdDb25zdHJ1Y3Q6IE5ldHdvcmtpbmdDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSB2cGM6IGNkay5hd3NfZWMyLlZwYztcbiAgcHVibGljIHJlYWRvbmx5IHB1YmxpY1N1Ym5ldHM6IGNkay5hd3NfZWMyLklTdWJuZXRbXTtcbiAgcHVibGljIHJlYWRvbmx5IHByaXZhdGVTdWJuZXRzOiBjZGsuYXdzX2VjMi5JU3VibmV0W107XG4gIHB1YmxpYyByZWFkb25seSBpc29sYXRlZFN1Ym5ldHM6IGNkay5hd3NfZWMyLklTdWJuZXRbXTtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXBzOiB7IFtrZXk6IHN0cmluZ106IGNkay5hd3NfZWMyLlNlY3VyaXR5R3JvdXAgfTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTmV0d29ya2luZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOOCs+OCueODiOmFjeW4g+OCv+OCsOOBrumBqeeUqFxuICAgIGNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKFxuICAgICAgcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAocHJvcHMuZW52aXJvbm1lbnQgPT09ICd0ZXN0JyA/ICdkZXYnIDogcHJvcHMuZW52aXJvbm1lbnQpIGFzICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnXG4gICAgKTtcbiAgICBUYWdnaW5nU3RyYXRlZ3kuYXBwbHlUYWdzVG9TdGFjayh0aGlzLCB0YWdnaW5nQ29uZmlnKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDlhaXlipvlgKTjga7mpJzoqLxcbiAgICAgIHRoaXMudmFsaWRhdGVQcm9wcyhwcm9wcyk7XG5cbiAgICAgIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuXG4gICAgICAvLyDjg43jg4Pjg4jjg6/jg7zjgq3jg7PjgrDjgrPjg7Pjgrnjg4jjg6njgq/jg4jkvZzmiJBcbiAgICAgIHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdCA9IG5ldyBOZXR3b3JraW5nQ29uc3RydWN0KHRoaXMsICdOZXR3b3JraW5nQ29uc3RydWN0Jywge1xuICAgICAgICBjb25maWcsXG4gICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDkuLvopoHjg6rjgr3jg7zjgrnjga7lj4LnhafjgpLoqK3lrppcbiAgICAgIHRoaXMudnBjID0gdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0LnZwYztcbiAgICAgIHRoaXMucHVibGljU3VibmV0cyA9IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC5wdWJsaWNTdWJuZXRzO1xuICAgICAgdGhpcy5wcml2YXRlU3VibmV0cyA9IHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC5wcml2YXRlU3VibmV0cztcbiAgICAgIHRoaXMuaXNvbGF0ZWRTdWJuZXRzID0gdGhpcy5uZXR3b3JraW5nQ29uc3RydWN0Lmlzb2xhdGVkU3VibmV0cztcbiAgICAgIHRoaXMuc2VjdXJpdHlHcm91cHMgPSB0aGlzLm5ldHdvcmtpbmdDb25zdHJ1Y3Quc2VjdXJpdHlHcm91cHM7XG5cbiAgICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcblxuICAgICAgLy8g44K544K/44OD44Kv44Os44OZ44Or44Gu44K/44Kw6Kit5a6aXG4gICAgICB0aGlzLmFwcGx5U3RhY2tUYWdzKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCk7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBOZXR3b3JraW5nU3RhY2vliJ3mnJ/ljJbjgqjjg6njg7w6ICR7ZXJyb3JNZXNzYWdlfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5fjg63jg5Hjg4bjgqPjga7mpJzoqLxcbiAgICovXG4gIHByaXZhdGUgdmFsaWRhdGVQcm9wcyhwcm9wczogTmV0d29ya2luZ1N0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbmZpZywgcHJvamVjdE5hbWUsIGVudmlyb25tZW50IH0gPSBwcm9wcztcblxuICAgIGlmICghcHJvamVjdE5hbWUgfHwgcHJvamVjdE5hbWUudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jlkI3jgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICBpZiAoIWVudmlyb25tZW50IHx8IGVudmlyb25tZW50LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign55Kw5aKD5ZCN44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgaWYgKCFjb25maWcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign44ON44OD44OI44Ov44O844Kt44Oz44Kw6Kit5a6a44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN44Gu6ZW344GV5Yi26ZmQ77yIQVdTIOODquOCveODvOOCueWQjeWItumZkOOCkuiAg+aFru+8iVxuICAgIGlmIChwcm9qZWN0TmFtZS5sZW5ndGggPiA1MCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jlkI3jga81MOaWh+Wtl+S7peWGheOBp+ioreWumuOBl+OBpuOBj+OBoOOBleOBhCcpO1xuICAgIH1cblxuICAgIC8vIOeSsOWig+WQjeOBruaknOiovFxuICAgIGNvbnN0IHZhbGlkRW52aXJvbm1lbnRzID0gWydkZXYnLCAnc3RhZ2luZycsICdwcm9kJywgJ3Rlc3QnXTtcbiAgICBpZiAoIXZhbGlkRW52aXJvbm1lbnRzLmluY2x1ZGVzKGVudmlyb25tZW50KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDnkrDlooPlkI3jga/mrKHjga7jgYTjgZrjgozjgYvjgpLmjIflrprjgZfjgabjgY/jgaDjgZXjgYQ6ICR7dmFsaWRFbnZpcm9ubWVudHMuam9pbignLCAnKX1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRGb3JtYXRpb27lh7rlipvjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICAvLyBWUEPmg4XloLFcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMudnBjSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjSWRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZwY0NpZHInLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMudnBjQ2lkckJsb2NrLFxuICAgICAgZGVzY3JpcHRpb246ICdWUEMgQ0lEUiBCbG9jaycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVnBjQ2lkcmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjQXZhaWxhYmlsaXR5Wm9uZXMnLCB7XG4gICAgICB2YWx1ZTogY2RrLkZuLmpvaW4oJywnLCB0aGlzLnZwYy5hdmFpbGFiaWxpdHlab25lcyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBBdmFpbGFiaWxpdHkgWm9uZXMnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUF2YWlsYWJpbGl0eVpvbmVzYCxcbiAgICB9KTtcblxuICAgIC8vIOOCteODluODjeODg+ODiOaDheWgsVxuICAgIHRoaXMucHVibGljU3VibmV0cy5mb3JFYWNoKChzdWJuZXQsIGluZGV4KSA9PiB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgUHVibGljU3VibmV0JHtpbmRleCArIDF9SWRgLCB7XG4gICAgICAgIHZhbHVlOiBzdWJuZXQuc3VibmV0SWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUHVibGljIFN1Ym5ldCAke2luZGV4ICsgMX0gSURgLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUHVibGljU3VibmV0JHtpbmRleCArIDF9SWRgLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLnByaXZhdGVTdWJuZXRzLmZvckVhY2goKHN1Ym5ldCwgaW5kZXgpID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBQcml2YXRlU3VibmV0JHtpbmRleCArIDF9SWRgLCB7XG4gICAgICAgIHZhbHVlOiBzdWJuZXQuc3VibmV0SWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgUHJpdmF0ZSBTdWJuZXQgJHtpbmRleCArIDF9IElEYCxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVByaXZhdGVTdWJuZXQke2luZGV4ICsgMX1JZGAsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuaXNvbGF0ZWRTdWJuZXRzLmZvckVhY2goKHN1Ym5ldCwgaW5kZXgpID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBJc29sYXRlZFN1Ym5ldCR7aW5kZXggKyAxfUlkYCwge1xuICAgICAgICB2YWx1ZTogc3VibmV0LnN1Ym5ldElkLFxuICAgICAgICBkZXNjcmlwdGlvbjogYElzb2xhdGVkIFN1Ym5ldCAke2luZGV4ICsgMX0gSURgLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tSXNvbGF0ZWRTdWJuZXQke2luZGV4ICsgMX1JZGAsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+aDheWgsVxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuc2VjdXJpdHlHcm91cHMpLmZvckVhY2goKFtuYW1lLCBzZ10pID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBTZWN1cml0eUdyb3VwJHtuYW1lfUlkYCwge1xuICAgICAgICB2YWx1ZTogc2cuc2VjdXJpdHlHcm91cElkLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFNlY3VyaXR5IEdyb3VwICR7bmFtZX0gSURgLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU2VjdXJpdHlHcm91cCR7bmFtZX1JZGAsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/jg6zjg5njg6vjga7jgr/jgrDoqK3lrppcbiAgICovXG4gIHByaXZhdGUgYXBwbHlTdGFja1RhZ3MocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIOOCv+OCsOWApOOBruOCteODi+OCv+OCpOOCuu+8iOOCu+OCreODpeODquODhuOCo+Wvvuetlu+8iVxuICAgIGNvbnN0IHNhbml0aXplZFByb2plY3ROYW1lID0gdGhpcy5zYW5pdGl6ZVRhZ1ZhbHVlKHByb2plY3ROYW1lKTtcbiAgICBjb25zdCBzYW5pdGl6ZWRFbnZpcm9ubWVudCA9IHRoaXMuc2FuaXRpemVUYWdWYWx1ZShlbnZpcm9ubWVudCk7XG4gICAgXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0Jywgc2FuaXRpemVkUHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBzYW5pdGl6ZWRFbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFjaycsICdOZXR3b3JraW5nU3RhY2snKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NvbXBvbmVudCcsICdJbmZyYXN0cnVjdHVyZScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29zdENlbnRlcicsIGAke3Nhbml0aXplZFByb2plY3ROYW1lfS0ke3Nhbml0aXplZEVudmlyb25tZW50fS1uZXR3b3JraW5nYCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDcmVhdGVkQXQnLCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXSk7XG4gIH1cblxuICAvKipcbiAgICog44K/44Kw5YCk44Gu44K144OL44K/44Kk44K6XG4gICAqL1xuICBwcml2YXRlIHNhbml0aXplVGFnVmFsdWUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8g5LiN5q2j44Gq5paH5a2X44KS6Zmk5Y6744GX44CB6ZW344GV44KS5Yi26ZmQXG4gICAgcmV0dXJuIHZhbHVlXG4gICAgICAucmVwbGFjZSgvWzw+XFxcIicmXS9nLCAnJykgLy8gWFNT5a++562WXG4gICAgICAuc3Vic3RyaW5nKDAsIDI1NikgLy8gQVdTIOOCv+OCsOWApOOBruacgOWkp+mVt+WItumZkFxuICAgICAgLnRyaW0oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDku5bjga7jgrnjgr/jg4Pjgq/jgafkvb/nlKjjgZnjgovjgZ/jgoHjga7jg43jg4Pjg4jjg6/jg7zjgq/mg4XloLHjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXROZXR3b3JraW5nSW5mbygpOiB7XG4gICAgdnBjOiBjZGsuYXdzX2VjMi5WcGM7XG4gICAgcHVibGljU3VibmV0czogY2RrLmF3c19lYzIuSVN1Ym5ldFtdO1xuICAgIHByaXZhdGVTdWJuZXRzOiBjZGsuYXdzX2VjMi5JU3VibmV0W107XG4gICAgaXNvbGF0ZWRTdWJuZXRzOiBjZGsuYXdzX2VjMi5JU3VibmV0W107XG4gICAgc2VjdXJpdHlHcm91cHM6IHsgW2tleTogc3RyaW5nXTogY2RrLmF3c19lYzIuU2VjdXJpdHlHcm91cCB9O1xuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBzdHJpbmdbXTtcbiAgfSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBwdWJsaWNTdWJuZXRzOiB0aGlzLnB1YmxpY1N1Ym5ldHMsXG4gICAgICBwcml2YXRlU3VibmV0czogdGhpcy5wcml2YXRlU3VibmV0cyxcbiAgICAgIGlzb2xhdGVkU3VibmV0czogdGhpcy5pc29sYXRlZFN1Ym5ldHMsXG4gICAgICBzZWN1cml0eUdyb3VwczogdGhpcy5zZWN1cml0eUdyb3VwcyxcbiAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiB0aGlzLnZwYy5hdmFpbGFiaWxpdHlab25lcyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOeJueWumuOBruOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCkuWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldFNlY3VyaXR5R3JvdXAobmFtZTogc3RyaW5nKTogY2RrLmF3c19lYzIuU2VjdXJpdHlHcm91cCB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuc2VjdXJpdHlHcm91cHNbbmFtZV07XG4gIH1cblxuICAvKipcbiAgICogVlBD44Ko44Oz44OJ44Od44Kk44Oz44OI5oOF5aCx44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0VnBjRW5kcG9pbnRzKCk6IHsgW2tleTogc3RyaW5nXTogY2RrLmF3c19lYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQgfCBjZGsuYXdzX2VjMi5HYXRld2F5VnBjRW5kcG9pbnQgfSB7XG4gICAgcmV0dXJuIHRoaXMubmV0d29ya2luZ0NvbnN0cnVjdC52cGNFbmRwb2ludHMgfHwge307XG4gIH1cbn0iXX0=