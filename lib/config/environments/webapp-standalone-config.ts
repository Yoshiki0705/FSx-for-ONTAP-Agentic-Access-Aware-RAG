/**
 * WebAppスタンドアローンモード設定
 * 
 * WebAppStackを独立してデプロイする際の設定を定義します。
 * 他のスタック（Networking, Security）に依存せず、
 * 必要なリソースを自動作成します。
 */

import { WebAppStackConfig } from '../interfaces/webapp-stack-config';

/**
 * 東京リージョン - WebAppスタンドアローン設定
 */
export const tokyoWebAppStandaloneConfig: WebAppStackConfig = {
  // デプロイモード設定
  deployMode: {
    useStandalone: true,
    skipLambdaCreation: false,
    debugMode: false,
  },

  // スタンドアローンモード設定
  standalone: {
    // VPC設定
    vpc: {
      useExisting: false,
      create: {
        cidr: '10.1.0.0/16',
        maxAzs: 2,
        enableNatGateway: true,
      },
    },

    // セキュリティグループ設定
    securityGroup: {
      useExisting: false,
      create: {
        name: 'webapp-standalone-sg',
        description: 'Security group for WebApp standalone deployment',
        ingressRules: [
          {
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            cidr: '0.0.0.0/0',
            description: 'Allow HTTPS from anywhere',
          },
          {
            protocol: 'tcp',
            fromPort: 80,
            toPort: 80,
            cidr: '0.0.0.0/0',
            description: 'Allow HTTP from anywhere',
          },
        ],
        egressRules: [
          {
            protocol: '-1',
            fromPort: 0,
            toPort: 0,
            cidr: '0.0.0.0/0',
            description: 'Allow all outbound traffic',
          },
        ],
      },
    },

    // IAMロール設定
    iamRole: {
      executionRoleName: 'webapp-standalone-execution-role',
      additionalManagedPolicies: [
        'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
        'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess',
      ],
    },
  },

  // 統合モード設定（スタンドアローンでは未使用）
  integrated: {
    networking: {
      stackName: 'permission-aware-rag-prod-networking',
      vpcOutputName: 'VpcId',
    },
    security: {
      stackName: 'permission-aware-rag-prod-security',
      securityGroupOutputName: 'WebAppSecurityGroupId',
      iamRoleOutputName: 'WebAppExecutionRoleArn',
    },
  },

  // WebApp共通設定
  webapp: {
    // ECRリポジトリ設定
    ecr: {
      repositoryName: 'permission-aware-rag-webapp',
      imageScanOnPush: true,
      imageTagMutability: 'MUTABLE',
      lifecyclePolicy: {
        maxImageCount: 10,
      },
    },

    // Lambda関数設定
    lambda: {
      functionName: 'TokyoRegion-permission-aware-rag-prod-WebApp-Function',
      memorySize: 2048,
      timeout: 30,
      environment: {
        NODE_ENV: 'production',
        REGION: 'ap-northeast-1',
        LOG_LEVEL: 'info',
      },
      webAdapter: {
        port: 3000,
      },
      reservedConcurrentExecutions: 10,
      // VPC配置設定
      vpc: {
        // Lambda関数をVPC内に配置するか
        // true: VPC内に配置（セキュリティ向上、VPC Endpoint必要）
        // false: VPC外に配置（シンプル、インターネット経由）
        enabled: false, // デフォルトはVPC外（シンプル構成）
        endpoints: {
          // DynamoDB VPC Endpoint（Gateway型、無料）
          dynamodb: true,
          // Bedrock Runtime VPC Endpoint（Interface型、$7.2/月）
          // KB Modeで必要（InvokeModel API）
          bedrockRuntime: true,
          // Bedrock Agent Runtime VPC Endpoint（Interface型、$7.2/月）
          // Agent Modeで必要（InvokeAgent API）
          bedrockAgentRuntime: true,
        },
      },
    },

    // CloudFront設定
    cloudfront: {
      distributionName: 'TokyoRegion-permission-aware-rag-prod-WebApp-Distribution',
      priceClass: 'PriceClass_200',
      cache: {
        defaultTtl: 86400, // 1日
        minTtl: 0,
        maxTtl: 31536000, // 1年
      },
    },

    // タグ設定
    tags: {
      Project: 'permission-aware-rag',
      Environment: 'prod',
      Stack: 'WebApp',
      DeployMode: 'Standalone',
      DeployDate: new Date().toISOString().split('T')[0],
      CostCenter: 'AI-RAG-Development',
      Owner: 'Development-Team',
      Backup: 'Required',
      Monitoring: 'Enabled',
    },
  },
};

/**
 * 東京リージョン - WebAppスタンドアローン設定（既存VPC使用）
 */
export const tokyoWebAppStandaloneWithExistingVpcConfig: WebAppStackConfig = {
  ...tokyoWebAppStandaloneConfig,

  // スタンドアローンモード設定（既存VPC使用）
  standalone: {
    ...tokyoWebAppStandaloneConfig.standalone,
    vpc: {
      useExisting: true,
      existingVpcId: process.env.EXISTING_VPC_ID || '',
    },
  },
};

/**
 * 東京リージョン - WebAppスタンドアローン設定（ECRのみ）
 */
export const tokyoWebAppStandaloneEcrOnlyConfig: WebAppStackConfig = {
  ...tokyoWebAppStandaloneConfig,

  // デプロイモード設定（Lambda作成スキップ）
  deployMode: {
    ...tokyoWebAppStandaloneConfig.deployMode,
    skipLambdaCreation: true,
  },
};

/**
 * 東京リージョン - WebAppスタンドアローン設定（デバッグモード）
 */
export const tokyoWebAppStandaloneDebugConfig: WebAppStackConfig = {
  ...tokyoWebAppStandaloneConfig,

  // デプロイモード設定（デバッグモード有効）
  deployMode: {
    ...tokyoWebAppStandaloneConfig.deployMode,
    debugMode: true,
  },

  // Lambda設定（デバッグモード）
  webapp: {
    ...tokyoWebAppStandaloneConfig.webapp,
    lambda: {
      ...tokyoWebAppStandaloneConfig.webapp.lambda,
      environment: {
        ...tokyoWebAppStandaloneConfig.webapp.lambda.environment,
        LOG_LEVEL: 'debug',
        DEBUG: 'true',
      },
    },
  },
};
