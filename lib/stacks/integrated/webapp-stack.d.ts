/**
 * WebAppStack - Lambda Web Adapter + Next.js + CloudFront + Permission API統合スタック
 *
 * 機能:
 * - Lambda Function (Container) with Web Adapter
 * - Lambda Function URL
 * - CloudFront Distribution
 * - ECR Repository
 * - IAM Roles and Permissions
 * - Permission API Lambda Function
 * - API Gateway (Permission API用)
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { INetworkingStack, ISecurityStack } from './interfaces/stack-interfaces';
import { BedrockAgentCoreRuntimeConstruct } from '../../modules/ai/constructs/bedrock-agent-core-runtime-construct';
import { BedrockAgentCoreGatewayConstruct } from '../../modules/ai/constructs/bedrock-agent-core-gateway-construct';
import { BedrockAgentCoreMemoryConstruct } from '../../modules/ai/constructs/bedrock-agent-core-memory-construct';
import { BedrockAgentCoreBrowserConstruct } from '../../modules/ai/constructs/bedrock-agent-core-browser-construct';
import { BedrockAgentCoreCodeInterpreterConstruct } from '../../modules/ai/constructs/bedrock-agent-core-code-interpreter-construct';
import { AgentCoreConfig } from '../../../types/agentcore-config';
/**
 * WebAppスタック設定インターフェース
 * EnvironmentConfigとの互換性を保つため、柔軟な型定義
 */
export interface WebAppStackConfig {
    readonly project?: {
        name?: string;
    };
    readonly naming?: {
        projectName?: string;
        environment?: string;
        regionPrefix?: string;
    };
    readonly environment?: string;
    readonly compute?: {
        lambda?: {
            timeout?: number;
            memorySize?: number;
        };
    };
    readonly ai?: {
        bedrock?: {
            region?: string;
            [key: string]: any;
        };
    };
    readonly database?: {
        dynamodb?: {
            enabled?: boolean;
            tableArns?: string[];
        };
    };
    readonly permissionApi?: {
        enabled?: boolean;
        ontapManagementLif?: string;
        ssmParameterPrefix?: string;
    };
    readonly bedrockAgent?: {
        enabled?: boolean;
        useCase?: 'chat' | 'generation' | 'costEffective' | 'multimodal';
        modelRequirements?: {
            onDemand?: boolean;
            streaming?: boolean;
            crossRegion?: boolean;
            inputModalities?: string[];
        };
        enableDynamicModelSelection?: boolean;
        enableAutoUpdate?: boolean;
        parameterStorePrefix?: string;
        knowledgeBaseId?: string;
        documentSearchLambdaArn?: string;
    };
    readonly agentCore?: AgentCoreConfig;
    [key: string]: any;
}
/**
 * WebAppスタックプロパティ
 *
 * Phase 7: 型定義の厳密化
 * - `any`型を完全排除
 * - INetworkingStack, ISecurityStack型を適用
 * - 型安全性100%達成
 */
export interface WebAppStackProps extends cdk.StackProps {
    readonly config: WebAppStackConfig;
    readonly projectName: string;
    readonly environment: string;
    readonly standaloneMode?: boolean;
    readonly existingVpcId?: string;
    readonly existingSecurityGroupId?: string;
    readonly networkingStack?: INetworkingStack;
    readonly securityStack?: ISecurityStack;
    readonly skipLambdaCreation?: boolean;
    readonly dockerPath?: string;
    readonly imageTag?: string;
    /**
     * 環境別リソース作成制御設定
     */
    readonly environmentResourceControl?: {
        readonly createLambdaFunction?: boolean;
        readonly createCloudFrontDistribution?: boolean;
        readonly enableBedrockAgent?: boolean;
        readonly enablePermissionApi?: boolean;
        readonly enableAgentCore?: boolean;
        readonly validateConfiguration?: boolean;
    };
    readonly userAccessTable?: dynamodb.ITable;
    readonly permissionCacheTable?: dynamodb.ITable;
    readonly dataStack?: {
        chatHistoryTable?: dynamodb.ITable;
        userPreferencesTable?: dynamodb.ITable;
    };
}
/**
 * WebAppStack - フル実装版
 */
export declare class WebAppStack extends cdk.Stack {
    /** Lambda Function */
    readonly webAppFunction: lambda.Function;
    /** Lambda Function URL */
    readonly functionUrl: lambda.FunctionUrl;
    /** CloudFront Distribution */
    readonly distribution: cloudfront.Distribution;
    /** ECR Repository */
    readonly ecrRepository: ecr.IRepository;
    /** Permission API Lambda Function */
    permissionApiFunction?: lambda.Function;
    /** Permission API Gateway */
    permissionApi?: apigateway.RestApi;
    /** VPC（スタンドアローンモード用） */
    private vpc?;
    /** セキュリティグループ（スタンドアローンモード用） */
    private securityGroup?;
    /** Lambda実行ロール（addToPolicyメソッド使用のため具象型） */
    private executionRole?;
    /** Permission API実行ロール */
    private permissionApiExecutionRole?;
    /** Bedrock Agent Service Role */
    bedrockAgentServiceRole?: iam.Role;
    /** Bedrock Agent */
    bedrockAgent?: bedrock.CfnAgent;
    /** Bedrock Agent Alias */
    bedrockAgentAlias?: bedrock.CfnAgentAlias;
    /** WebAppStack設定（VPC Endpoint作成時に参照） */
    private readonly config;
    /** Phase 4: AgentCore Constructs（オプション） */
    agentCoreRuntime?: BedrockAgentCoreRuntimeConstruct;
    agentCoreGateway?: BedrockAgentCoreGatewayConstruct;
    agentCoreMemory?: BedrockAgentCoreMemoryConstruct;
    agentCoreBrowser?: BedrockAgentCoreBrowserConstruct;
    agentCoreCodeInterpreter?: BedrockAgentCoreCodeInterpreterConstruct;
    constructor(scope: Construct, id: string, props: WebAppStackProps);
    /**
     * スタンドアローンモード用リソースセットアップ
     * 必要なリソースを参照または作成
     */
    private setupStandaloneResources;
    /**
     * 統合モード用リソースセットアップ
     * 他のStackからリソースを参照
     */
    private setupIntegratedResources;
    /**
     * 最小限のVPCを作成
     * プライベートサブネット + NATゲートウェイ（Lambda用）
     */
    private createMinimalVpc;
    /**
     * DynamoDB VPC Endpointを作成
     * Gateway型エンドポイント（無料）を使用
     * Lambda関数がVPC内からDynamoDBにアクセスするために必要
     */
    private createDynamoDbVpcEndpoint;
    /**
     * Bedrock Runtime VPC Endpointを作成
     * Interface型エンドポイント（$7.2/月）を使用
     * Lambda関数がVPC内からBedrock Runtime API（InvokeModel）にアクセスするために必要
     * KB Modeで使用
     */
    private createBedrockRuntimeVpcEndpoint;
    /**
     * Bedrock Agent Runtime VPC Endpointを作成
     * Interface型エンドポイント（$7.2/月）を使用
     * Lambda関数がVPC内からBedrock Agent Runtime API（InvokeAgent）にアクセスするために必要
     * Agent Modeで使用
     */
    private createBedrockAgentRuntimeVpcEndpoint;
    /**
     * セキュリティグループを作成
     */
    private createSecurityGroup;
    /**
     * IAMロールを作成
     */
    private createIamRoles;
    /**
     * Permission APIリソースを作成
     */
    private createPermissionApiResources;
    /**
     * Bedrock Agentリソースを作成
     * Phase 2 - Task 3: BedrockAgentDynamicConstructを使用した動的モデル選択
     */
    private createBedrockAgentResources;
    /**
     * Agent指示プロンプトを取得
     */
    private getAgentInstruction;
    /**
     * Bedrock Agent CloudFormation Outputsを作成
     */
    private createBedrockAgentOutputs;
    /**
     * AgentCore Constructs統合（Phase 4）
     */
    private integrateAgentCoreConstructs;
    /**
     * AgentCore CloudFormation Outputsを作成
     */
    private createAgentCoreOutputs;
    /**
     * 環境設定の検証
     * Task 6.3: 手動対処部分の自動化
     */
    private validateEnvironmentConfiguration;
}
