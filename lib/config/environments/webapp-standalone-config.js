"use strict";
/**
 * WebAppスタンドアローンモード設定
 *
 * WebAppStackを独立してデプロイする際の設定を定義します。
 * 他のスタック（Networking, Security）に依存せず、
 * 必要なリソースを自動作成します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokyoWebAppStandaloneDebugConfig = exports.tokyoWebAppStandaloneEcrOnlyConfig = exports.tokyoWebAppStandaloneWithExistingVpcConfig = exports.tokyoWebAppStandaloneConfig = void 0;
/**
 * 東京リージョン - WebAppスタンドアローン設定
 */
exports.tokyoWebAppStandaloneConfig = {
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
exports.tokyoWebAppStandaloneWithExistingVpcConfig = {
    ...exports.tokyoWebAppStandaloneConfig,
    // スタンドアローンモード設定（既存VPC使用）
    standalone: {
        ...exports.tokyoWebAppStandaloneConfig.standalone,
        vpc: {
            useExisting: true,
            existingVpcId: process.env.EXISTING_VPC_ID || '',
        },
    },
};
/**
 * 東京リージョン - WebAppスタンドアローン設定（ECRのみ）
 */
exports.tokyoWebAppStandaloneEcrOnlyConfig = {
    ...exports.tokyoWebAppStandaloneConfig,
    // デプロイモード設定（Lambda作成スキップ）
    deployMode: {
        ...exports.tokyoWebAppStandaloneConfig.deployMode,
        skipLambdaCreation: true,
    },
};
/**
 * 東京リージョン - WebAppスタンドアローン設定（デバッグモード）
 */
exports.tokyoWebAppStandaloneDebugConfig = {
    ...exports.tokyoWebAppStandaloneConfig,
    // デプロイモード設定（デバッグモード有効）
    deployMode: {
        ...exports.tokyoWebAppStandaloneConfig.deployMode,
        debugMode: true,
    },
    // Lambda設定（デバッグモード）
    webapp: {
        ...exports.tokyoWebAppStandaloneConfig.webapp,
        lambda: {
            ...exports.tokyoWebAppStandaloneConfig.webapp.lambda,
            environment: {
                ...exports.tokyoWebAppStandaloneConfig.webapp.lambda.environment,
                LOG_LEVEL: 'debug',
                DEBUG: 'true',
            },
        },
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YW5kYWxvbmUtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2ViYXBwLXN0YW5kYWxvbmUtY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUlIOztHQUVHO0FBQ1UsUUFBQSwyQkFBMkIsR0FBc0I7SUFDNUQsWUFBWTtJQUNaLFVBQVUsRUFBRTtRQUNWLGFBQWEsRUFBRSxJQUFJO1FBQ25CLGtCQUFrQixFQUFFLEtBQUs7UUFDekIsU0FBUyxFQUFFLEtBQUs7S0FDakI7SUFFRCxnQkFBZ0I7SUFDaEIsVUFBVSxFQUFFO1FBQ1YsUUFBUTtRQUNSLEdBQUcsRUFBRTtZQUNILFdBQVcsRUFBRSxLQUFLO1lBQ2xCLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsYUFBYTtnQkFDbkIsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsZ0JBQWdCLEVBQUUsSUFBSTthQUN2QjtTQUNGO1FBRUQsZUFBZTtRQUNmLGFBQWEsRUFBRTtZQUNiLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsc0JBQXNCO2dCQUM1QixXQUFXLEVBQUUsaURBQWlEO2dCQUM5RCxZQUFZLEVBQUU7b0JBQ1o7d0JBQ0UsUUFBUSxFQUFFLEtBQUs7d0JBQ2YsUUFBUSxFQUFFLEdBQUc7d0JBQ2IsTUFBTSxFQUFFLEdBQUc7d0JBQ1gsSUFBSSxFQUFFLFdBQVc7d0JBQ2pCLFdBQVcsRUFBRSwyQkFBMkI7cUJBQ3pDO29CQUNEO3dCQUNFLFFBQVEsRUFBRSxLQUFLO3dCQUNmLFFBQVEsRUFBRSxFQUFFO3dCQUNaLE1BQU0sRUFBRSxFQUFFO3dCQUNWLElBQUksRUFBRSxXQUFXO3dCQUNqQixXQUFXLEVBQUUsMEJBQTBCO3FCQUN4QztpQkFDRjtnQkFDRCxXQUFXLEVBQUU7b0JBQ1g7d0JBQ0UsUUFBUSxFQUFFLElBQUk7d0JBQ2QsUUFBUSxFQUFFLENBQUM7d0JBQ1gsTUFBTSxFQUFFLENB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QjtJQUU5QiwwQkFBMEI7SUFDMUIsVUFBVSxFQUFFO1FBQ1YsR0FBRyxtQ0FBMkIsQ0FBQyxVQUFVO1FBQ3pDLGtCQUFrQixFQUFFLElBQUk7S0FDekI7Q0FDRixDQUFDO0FBRUY7O0dBRUc7QUFDVSxRQUFBLGdDQUFnQyxHQUFzQjtJQUNqRSxHQUFHLG1DQUEyQjtJQUU5Qix1QkFBdUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsR0FBRyxtQ0FBMkIsQ0FBQyxVQUFVO1FBQ3pDLFNBQVMsRUFBRSxJQUFJO0tBQ2hCO0lBRUQsb0JBQW9CO0lBQ3BCLE1BQU0sRUFBRTtRQUNOLEdBQUcsbUNBQTJCLENBQUMsTUFBTTtRQUNyQyxNQUFNLEVBQUU7WUFDTixHQUFHLG1DQUEyQixDQUFDLE1BQU0sQ0FBQyxNQUFNO1lBQzVDLFdBQVcsRUFBRTtnQkFDWCxHQUFHLG1DQUEyQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVztnQkFDeEQsU0FBUyxFQUFFLE9BQU87Z0JBQ2xCLEtBQUssRUFBRSxNQUFNO2FBQ2Q7U0FDRjtLQUNGO0NBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2ViQXBw44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ6Kit5a6aXG4gKiBcbiAqIFdlYkFwcFN0YWNr44KS54us56uL44GX44Gm44OH44OX44Ot44Kk44GZ44KL6Zqb44Gu6Kit5a6a44KS5a6a576p44GX44G+44GZ44CCXG4gKiDku5bjga7jgrnjgr/jg4Pjgq/vvIhOZXR3b3JraW5nLCBTZWN1cml0ee+8ieOBq+S+neWtmOOBm+OBmuOAgVxuICog5b+F6KaB44Gq44Oq44K944O844K544KS6Ieq5YuV5L2c5oiQ44GX44G+44GZ44CCXG4gKi9cblxuaW1wb3J0IHsgV2ViQXBwU3RhY2tDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL3dlYmFwcC1zdGFjay1jb25maWcnO1xuXG4vKipcbiAqIOadseS6rOODquODvOOCuOODp+ODsyAtIFdlYkFwcOOCueOCv+ODs+ODieOCouODreODvOODs+ioreWumlxuICovXG5leHBvcnQgY29uc3QgdG9reW9XZWJBcHBTdGFuZGFsb25lQ29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyA9IHtcbiAgLy8g44OH44OX44Ot44Kk44Oi44O844OJ6Kit5a6aXG4gIGRlcGxveU1vZGU6IHtcbiAgICB1c2VTdGFuZGFsb25lOiB0cnVlLFxuICAgIHNraXBMYW1iZGFDcmVhdGlvbjogZmFsc2UsXG4gICAgZGVidWdNb2RlOiBmYWxzZSxcbiAgfSxcblxuICAvLyDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4noqK3lrppcbiAgc3RhbmRhbG9uZToge1xuICAgIC8vIFZQQ+ioreWumlxuICAgIHZwYzoge1xuICAgICAgdXNlRXhpc3Rpbmc6IGZhbHNlLFxuICAgICAgY3JlYXRlOiB7XG4gICAgICAgIGNpZHI6ICcxMC4xLjAuMC8xNicsXG4gICAgICAgIG1heEF6czogMixcbiAgICAgICAgZW5hYmxlTmF0R2F0ZXdheTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+ioreWumlxuICAgIHNlY3VyaXR5R3JvdXA6IHtcbiAgICAgIHVzZUV4aXN0aW5nOiBmYWxzZSxcbiAgICAgIGNyZWF0ZToge1xuICAgICAgICBuYW1lOiAnd2ViYXBwLXN0YW5kYWxvbmUtc2cnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBXZWJBcHAgc3RhbmRhbG9uZSBkZXBsb3ltZW50JyxcbiAgICAgICAgaW5ncmVzc1J1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgcHJvdG9jb2w6ICd0Y3AnLFxuICAgICAgICAgICAgZnJvbVBvcnQ6IDQ0MyxcbiAgICAgICAgICAgIHRvUG9ydDogNDQzLFxuICAgICAgICAgICAgY2lkcjogJzAuMC4wLjAvMCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FsbG93IEhUVFBTIGZyb20gYW55d2hlcmUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcHJvdG9jb2w6ICd0Y3AnLFxuICAgICAgICAgICAgZnJvbVBvcnQ6IDgwLFxuICAgICAgICAgICAgdG9Qb3J0OiA4MCxcbiAgICAgICAgICAgIGNpZHI6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBbGxvdyBIVFRQIGZyb20gYW55d2hlcmUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGVncmVzc1J1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgcHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICBmcm9tUG9ydDogMCxcbiAgICAgICAgICAgIHRvUG9ydDogMCxcbiAgICAgICAgICAgIGNpZHI6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBbGxvdyBhbGwgb3V0Ym91bmQgdHJhZmZpYycsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIC8vIElBTeODreODvOODq+ioreWumlxuICAgIGlhbVJvbGU6IHtcbiAgICAgIGV4ZWN1dGlvblJvbGVOYW1lOiAnd2ViYXBwLXN0YW5kYWxvbmUtZXhlY3V0aW9uLXJvbGUnLFxuICAgICAgYWRkaXRpb25hbE1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnLFxuICAgICAgICAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQVdTWFJheURhZW1vbldyaXRlQWNjZXNzJyxcbiAgICAgIF0sXG4gICAgfSxcbiAgfSxcblxuICAvLyDntbHlkIjjg6Ljg7zjg4noqK3lrprvvIjjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjgafjga/mnKrkvb/nlKjvvIlcbiAgaW50ZWdyYXRlZDoge1xuICAgIG5ldHdvcmtpbmc6IHtcbiAgICAgIHN0YWNrTmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtbmV0d29ya2luZycsXG4gICAgICB2cGNPdXRwdXROYW1lOiAnVnBjSWQnLFxuICAgIH0sXG4gICAgc2VjdXJpdHk6IHtcbiAgICAgIHN0YWNrTmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnLXByb2Qtc2VjdXJpdHknLFxuICAgICAgc2VjdXJpdHlHcm91cE91dHB1dE5hbWU6ICdXZWJBcHBTZWN1cml0eUdyb3VwSWQnLFxuICAgICAgaWFtUm9sZU91dHB1dE5hbWU6ICdXZWJBcHBFeGVjdXRpb25Sb2xlQXJuJyxcbiAgICB9LFxuICB9LFxuXG4gIC8vIFdlYkFwcOWFsemAmuioreWumlxuICB3ZWJhcHA6IHtcbiAgICAvLyBFQ1Ljg6rjg53jgrjjg4jjg6roqK3lrppcbiAgICBlY3I6IHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiAncGVybWlzc2lvbi1hd2FyZS1yYWctd2ViYXBwJyxcbiAgICAgIGltYWdlU2Nhbk9uUHVzaDogdHJ1ZSxcbiAgICAgIGltYWdlVGFnTXV0YWJpbGl0eTogJ01VVEFCTEUnLFxuICAgICAgbGlmZWN5Y2xlUG9saWN5OiB7XG4gICAgICAgIG1heEltYWdlQ291bnQ6IDEwLFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgLy8gTGFtYmRh6Zai5pWw6Kit5a6aXG4gICAgbGFtYmRhOiB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdUb2t5b1JlZ2lvbi1wZXJtaXNzaW9uLWF3YXJlLXJhZy1wcm9kLVdlYkFwcC1GdW5jdGlvbicsXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LFxuICAgICAgdGltZW91dDogMzAsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgICBSRUdJT046ICdhcC1ub3J0aGVhc3QtMScsXG4gICAgICAgIExPR19MRVZFTDogJ2luZm8nLFxuICAgICAgfSxcbiAgICAgIHdlYkFkYXB0ZXI6IHtcbiAgICAgICAgcG9ydDogMzAwMCxcbiAgICAgIH0sXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxMCxcbiAgICAgIC8vIFZQQ+mFjee9ruioreWumlxuICAgICAgdnBjOiB7XG4gICAgICAgIC8vIExhbWJkYemWouaVsOOCklZQQ+WGheOBq+mFjee9ruOBmeOCi+OBi1xuICAgICAgICAvLyB0cnVlOiBWUEPlhoXjgavphY3nva7vvIjjgrvjgq3jg6Xjg6rjg4bjgqPlkJHkuIrjgIFWUEMgRW5kcG9pbnTlv4XopoHvvIlcbiAgICAgICAgLy8gZmFsc2U6IFZQQ+WkluOBq+mFjee9ru+8iOOCt+ODs+ODl+ODq+OAgeOCpOODs+OCv+ODvOODjeODg+ODiOe1jOeUse+8iVxuICAgICAgICBlbmFibGVkOiBmYWxzZSwgLy8g44OH44OV44Kp44Or44OI44GvVlBD5aSW77yI44K344Oz44OX44Or5qeL5oiQ77yJXG4gICAgICAgIGVuZHBvaW50czoge1xuICAgICAgICAgIC8vIER5bmFtb0RCIFZQQyBFbmRwb2ludO+8iEdhdGV3YXnlnovjgIHnhKHmlpnvvIlcbiAgICAgICAgICBkeW5hbW9kYjogdHJ1ZSxcbiAgICAgICAgICAvLyBCZWRyb2NrIFJ1bnRpbWUgVlBDIEVuZHBvaW5077yISW50ZXJmYWNl5Z6L44CBJDcuMi/mnIjvvIlcbiAgICAgICAgICAvLyBLQiBNb2Rl44Gn5b+F6KaB77yISW52b2tlTW9kZWwgQVBJ77yJXG4gICAgICAgICAgYmVkcm9ja1J1bnRpbWU6IHRydWUsXG4gICAgICAgICAgLy8gQmVkcm9jayBBZ2VudCBSdW50aW1lIFZQQyBFbmRwb2ludO+8iEludGVyZmFjZeWei+OAgSQ3LjIv5pyI77yJXG4gICAgICAgICAgLy8gQWdlbnQgTW9kZeOBp+W/heimge+8iEludm9rZUFnZW50IEFQSe+8iVxuICAgICAgICAgIGJlZHJvY2tBZ2VudFJ1bnRpbWU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICAvLyBDbG91ZEZyb2506Kit5a6aXG4gICAgY2xvdWRmcm9udDoge1xuICAgICAgZGlzdHJpYnV0aW9uTmFtZTogJ1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtV2ViQXBwLURpc3RyaWJ1dGlvbicsXG4gICAgICBwcmljZUNsYXNzOiAnUHJpY2VDbGFzc18yMDAnLFxuICAgICAgY2FjaGU6IHtcbiAgICAgICAgZGVmYXVsdFR0bDogODY0MDAsIC8vIDHml6VcbiAgICAgICAgbWluVHRsOiAwLFxuICAgICAgICBtYXhUdGw6IDMxNTM2MDAwLCAvLyAx5bm0XG4gICAgICB9LFxuICAgIH0sXG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0YWdzOiB7XG4gICAgICBQcm9qZWN0OiAncGVybWlzc2lvbi1hd2FyZS1yYWcnLFxuICAgICAgRW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgICAgIFN0YWNrOiAnV2ViQXBwJyxcbiAgICAgIERlcGxveU1vZGU6ICdTdGFuZGFsb25lJyxcbiAgICAgIERlcGxveURhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdLFxuICAgICAgQ29zdENlbnRlcjogJ0FJLVJBRy1EZXZlbG9wbWVudCcsXG4gICAgICBPd25lcjogJ0RldmVsb3BtZW50LVRlYW0nLFxuICAgICAgQmFja3VwOiAnUmVxdWlyZWQnLFxuICAgICAgTW9uaXRvcmluZzogJ0VuYWJsZWQnLFxuICAgIH0sXG4gIH0sXG59O1xuXG4vKipcbiAqIOadseS6rOODquODvOOCuOODp+ODsyAtIFdlYkFwcOOCueOCv+ODs+ODieOCouODreODvOODs+ioreWumu+8iOaXouWtmFZQQ+S9v+eUqO+8iVxuICovXG5leHBvcnQgY29uc3QgdG9reW9XZWJBcHBTdGFuZGFsb25lV2l0aEV4aXN0aW5nVnBjQ29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyA9IHtcbiAgLi4udG9reW9XZWJBcHBTdGFuZGFsb25lQ29uZmlnLFxuXG4gIC8vIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODieioreWumu+8iOaXouWtmFZQQ+S9v+eUqO+8iVxuICBzdGFuZGFsb25lOiB7XG4gICAgLi4udG9reW9XZWJBcHBTdGFuZGFsb25lQ29uZmlnLnN0YW5kYWxvbmUsXG4gICAgdnBjOiB7XG4gICAgICB1c2VFeGlzdGluZzogdHJ1ZSxcbiAgICAgIGV4aXN0aW5nVnBjSWQ6IHByb2Nlc3MuZW52LkVYSVNUSU5HX1ZQQ19JRCB8fCAnJyxcbiAgICB9LFxuICB9LFxufTtcblxuLyoqXG4gKiDmnbHkuqzjg6rjg7zjgrjjg6fjg7MgLSBXZWJBcHDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7PoqK3lrprvvIhFQ1Ljga7jgb/vvIlcbiAqL1xuZXhwb3J0IGNvbnN0IHRva3lvV2ViQXBwU3RhbmRhbG9uZUVjck9ubHlDb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnID0ge1xuICAuLi50b2t5b1dlYkFwcFN0YW5kYWxvbmVDb25maWcsXG5cbiAgLy8g44OH44OX44Ot44Kk44Oi44O844OJ6Kit5a6a77yITGFtYmRh5L2c5oiQ44K544Kt44OD44OX77yJXG4gIGRlcGxveU1vZGU6IHtcbiAgICAuLi50b2t5b1dlYkFwcFN0YW5kYWxvbmVDb25maWcuZGVwbG95TW9kZSxcbiAgICBza2lwTGFtYmRhQ3JlYXRpb246IHRydWUsXG4gIH0sXG59O1xuXG4vKipcbiAqIOadseS6rOODquODvOOCuOODp+ODsyAtIFdlYkFwcOOCueOCv+ODs+ODieOCouODreODvOODs+ioreWumu+8iOODh+ODkOODg+OCsOODouODvOODie+8iVxuICovXG5leHBvcnQgY29uc3QgdG9reW9XZWJBcHBTdGFuZGFsb25lRGVidWdDb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnID0ge1xuICAuLi50b2t5b1dlYkFwcFN0YW5kYWxvbmVDb25maWcsXG5cbiAgLy8g44OH44OX44Ot44Kk44Oi44O844OJ6Kit5a6a77yI44OH44OQ44OD44Kw44Oi44O844OJ5pyJ5Yq577yJXG4gIGRlcGxveU1vZGU6IHtcbiAgICAuLi50b2t5b1dlYkFwcFN0YW5kYWxvbmVDb25maWcuZGVwbG95TW9kZSxcbiAgICBkZWJ1Z01vZGU6IHRydWUsXG4gIH0sXG5cbiAgLy8gTGFtYmRh6Kit5a6a77yI44OH44OQ44OD44Kw44Oi44O844OJ77yJXG4gIHdlYmFwcDoge1xuICAgIC4uLnRva3lvV2ViQXBwU3RhbmRhbG9uZUNvbmZpZy53ZWJhcHAsXG4gICAgbGFtYmRhOiB7XG4gICAgICAuLi50b2t5b1dlYkFwcFN0YW5kYWxvbmVDb25maWcud2ViYXBwLmxhbWJkYSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLnRva3lvV2ViQXBwU3RhbmRhbG9uZUNvbmZpZy53ZWJhcHAubGFtYmRhLmVudmlyb25tZW50LFxuICAgICAgICBMT0dfTEVWRUw6ICdkZWJ1ZycsXG4gICAgICAgIERFQlVHOiAndHJ1ZScsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59O1xuIl19