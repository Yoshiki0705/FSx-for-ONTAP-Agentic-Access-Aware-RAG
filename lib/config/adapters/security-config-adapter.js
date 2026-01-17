"use strict";
/**
 * SecurityConfig アダプター
 *
 * EnvironmentConfigのsecurity設定をSecurityConfigインターフェースに変換
 * 本番環境に必要な完全なセキュリティ設定を提供
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptSecurityConfig = adaptSecurityConfig;
/**
 * EnvironmentConfigからSecurityConfigを生成（完全実装）
 */
function adaptSecurityConfig(envConfig) {
    const security = envConfig.security || {};
    return {
        // IAM設定
        iam: {
            enforceStrongPasswords: true,
            mfaRequired: true,
            sessionTimeout: 3600,
            passwordPolicy: {
                minimumLength: 14,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSymbols: true,
                preventReuse: 24,
                maxAge: 90
            },
            accessAnalyzer: true
        },
        // KMS設定
        kms: {
            keyRotation: security.kmsKeyRotation ?? true,
            keySpec: 'SYMMETRIC_DEFAULT',
            keyUsage: 'ENCRYPT_DECRYPT',
            pendingWindow: 30,
            multiRegion: false,
            alias: `alias/${envConfig.naming?.projectName || 'permission-aware-rag'}-key`
        },
        // WAF設定
        waf: {
            enabled: security.enableWaf ?? true,
            scope: 'REGIONAL',
            rules: {
                awsManagedRules: true,
                rateLimiting: true,
                geoBlocking: [],
                ipAllowList: [],
                ipBlockList: [],
                sqlInjectionProtection: true,
                xssProtection: true
            },
            logging: {
                enabled: true,
                destination: 'cloudwatch',
                retentionDays: 90
            },
            metrics: true
        },
        // GuardDuty設定
        guardDuty: {
            enabled: security.enableGuardDuty ?? true,
            findingPublishingFrequency: 'FIFTEEN_MINUTES',
            s3Protection: true,
            kubernetesProtection: true,
            malwareProtection: true
        },
        // コンプライアンス設定
        compliance: {
            fiscCompliance: true,
            personalInfoProtection: true,
            gdprCompliance: true,
            soxCompliance: false,
            hipaaCompliance: false,
            auditLogging: true,
            dataClassification: true,
            accessControls: true
        },
        // 監視設定
        monitoring: {
            cloudTrail: security.enableCloudTrail ?? true,
            config: security.enableConfig ?? true,
            securityHub: true,
            inspector: false
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktY29uZmlnLWFkYXB0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1jb25maWctYWRhcHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7O0FBUUgsa0RBa0ZDO0FBckZEOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CLENBQUMsU0FBYztJQUNoRCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQztJQUUxQyxPQUFPO1FBQ0wsUUFBUTtRQUNSLEdBQUcsRUFBRTtZQUNILHNCQUFzQixFQUFFLElBQUk7WUFDNUIsV0FBVyxFQUFFLElBQUk7WUFDakIsY0FBYyxFQUFFLElBQUk7WUFDcEIsY0FBYyxFQUFFO2dCQUNkLGFBQWEsRUFBRSxFQUFFO2dCQUNqQixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixjQUFjLEVBQUUsSUFBSTtnQkFDcEIsY0FBYyxFQUFFLElBQUk7Z0JBQ3BCLFlBQVksRUFBRSxFQUFFO2dCQUNoQixNQUFNLEVBQUUsRUFBRTthQUNYO1lBQ0QsY0FBYyxFQUFFLElBQUk7U0FDckI7UUFFRCxRQUFRO1FBQ1IsR0FBRyxFQUFFO1lBQ0gsV0FBVyxFQUFFLFFBQVEsQ0FBQyxjQUFjLElBQUksSUFBSTtZQUM1QyxPQUFPLEVBQUUsbUJBQTBCO1lBQ25DLFFBQVEsRUFBRSxpQkFBd0I7WUFDbEMsYUFBYSxFQUFFLEVBQUU7WUFDakIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsS0FBSyxFQUFFLFNBQVMsU0FBUyxDQUFDLE1BQU0sRUFBRSxXQUFXLElBQUksc0JBQXNCLE1BQU07U0FDOUU7UUFFRCxRQUFRO1FBQ1IsR0FBRyxFQUFFO1lBQ0gsT0FBTyxFQUFFLFFBQVEsQ0FBQyxTQUFTLElBQUksSUFBSTtZQUNuQyxLQUFLLEVBQUUsVUFBVTtZQUNqQixLQUFLLEVBQUU7Z0JBQ0wsZUFBZSxFQUFFLElBQUk7Z0JBQ3JCLFlBQVksRUFBRSxJQUFJO2dCQUNsQixXQUFXLEVBQUUsRUFBRTtnQkFDZixXQUFXLEVBQUUsRUFBRTtnQkFDZixXQUFXLEVBQUUsRUFBRTtnQkFDZixzQkFBc0IsRUFBRSxJQUFJO2dCQUM1QixhQUFhLEVBQUUsSUFBSTthQUNwQjtZQUNELE9BQU8sRUFBRTtnQkFDUCxPQUFPLEVBQUUsSUFBSTtnQkFDYixXQUFXLEVBQUUsWUFBWTtnQkFDekIsYUFBYSxFQUFFLEVBQUU7YUFDbEI7WUFDRCxPQUFPLEVBQUUsSUFBSTtTQUNkO1FBRUQsY0FBYztRQUNkLFNBQVMsRUFBRTtZQUNULE9BQU8sRUFBRSxRQUFRLENBQUMsZUFBZSxJQUFJLElBQUk7WUFDekMsMEJBQTBCLEVBQUUsaUJBQWlCO1lBQzdDLFlBQVksRUFBRSxJQUFJO1lBQ2xCLG9CQUFvQixFQUFFLElBQUk7WUFDMUIsaUJBQWlCLEVBQUUsSUFBSTtTQUN4QjtRQUdELGFBQWE7UUFDYixVQUFVLEVBQUU7WUFDVixjQUFjLEVBQUUsSUFBSTtZQUNwQixzQkFBc0IsRUFBRSxJQUFJO1lBQzVCLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLGFBQWEsRUFBRSxLQUFLO1lBQ3BCLGVBQWUsRUFBRSxLQUFLO1lBQ3RCLFlBQVksRUFBRSxJQUFJO1lBQ2xCLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsY0FBYyxFQUFFLElBQUk7U0FDckI7UUFFRCxPQUFPO1FBQ1AsVUFBVSxFQUFFO1lBQ1YsVUFBVSxFQUFFLFFBQVEsQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJO1lBQzdDLE1BQU0sRUFBRSxRQUFRLENBQUMsWUFBWSxJQUFJLElBQUk7WUFDckMsV0FBVyxFQUFFLElBQUk7WUFDakIsU0FBUyxFQUFFLEtBQUs7U0FDakI7S0FDRixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2VjdXJpdHlDb25maWcg44Ki44OA44OX44K/44O8XG4gKiBcbiAqIEVudmlyb25tZW50Q29uZmln44Guc2VjdXJpdHnoqK3lrprjgpJTZWN1cml0eUNvbmZpZ+OCpOODs+OCv+ODvOODleOCp+ODvOOCueOBq+WkieaPm1xuICog5pys55Wq55Kw5aKD44Gr5b+F6KaB44Gq5a6M5YWo44Gq44K744Kt44Ol44Oq44OG44Kj6Kit5a6a44KS5o+Q5L6bXG4gKi9cblxuaW1wb3J0ICogYXMgd2FmdjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXdhZnYyJztcbmltcG9ydCB7IFNlY3VyaXR5Q29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9pbnRlcmZhY2VzL3NlY3VyaXR5LWNvbmZpZyc7XG5cbi8qKlxuICogRW52aXJvbm1lbnRDb25maWfjgYvjgolTZWN1cml0eUNvbmZpZ+OCkueUn+aIkO+8iOWujOWFqOWun+ijhe+8iVxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRhcHRTZWN1cml0eUNvbmZpZyhlbnZDb25maWc6IGFueSk6IFNlY3VyaXR5Q29uZmlnIHtcbiAgY29uc3Qgc2VjdXJpdHkgPSBlbnZDb25maWcuc2VjdXJpdHkgfHwge307XG4gIFxuICByZXR1cm4ge1xuICAgIC8vIElBTeioreWumlxuICAgIGlhbToge1xuICAgICAgZW5mb3JjZVN0cm9uZ1Bhc3N3b3JkczogdHJ1ZSxcbiAgICAgIG1mYVJlcXVpcmVkOiB0cnVlLFxuICAgICAgc2Vzc2lvblRpbWVvdXQ6IDM2MDAsXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5pbXVtTGVuZ3RoOiAxNCxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZU51bWJlcnM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgICBwcmV2ZW50UmV1c2U6IDI0LFxuICAgICAgICBtYXhBZ2U6IDkwXG4gICAgICB9LFxuICAgICAgYWNjZXNzQW5hbHl6ZXI6IHRydWVcbiAgICB9LFxuICAgIFxuICAgIC8vIEtNU+ioreWumlxuICAgIGttczoge1xuICAgICAga2V5Um90YXRpb246IHNlY3VyaXR5Lmttc0tleVJvdGF0aW9uID8/IHRydWUsXG4gICAgICBrZXlTcGVjOiAnU1lNTUVUUklDX0RFRkFVTFQnIGFzIGFueSxcbiAgICAgIGtleVVzYWdlOiAnRU5DUllQVF9ERUNSWVBUJyBhcyBhbnksXG4gICAgICBwZW5kaW5nV2luZG93OiAzMCxcbiAgICAgIG11bHRpUmVnaW9uOiBmYWxzZSxcbiAgICAgIGFsaWFzOiBgYWxpYXMvJHtlbnZDb25maWcubmFtaW5nPy5wcm9qZWN0TmFtZSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWcnfS1rZXlgXG4gICAgfSxcbiAgICBcbiAgICAvLyBXQUboqK3lrppcbiAgICB3YWY6IHtcbiAgICAgIGVuYWJsZWQ6IHNlY3VyaXR5LmVuYWJsZVdhZiA/PyB0cnVlLFxuICAgICAgc2NvcGU6ICdSRUdJT05BTCcsXG4gICAgICBydWxlczoge1xuICAgICAgICBhd3NNYW5hZ2VkUnVsZXM6IHRydWUsXG4gICAgICAgIHJhdGVMaW1pdGluZzogdHJ1ZSxcbiAgICAgICAgZ2VvQmxvY2tpbmc6IFtdLFxuICAgICAgICBpcEFsbG93TGlzdDogW10sXG4gICAgICAgIGlwQmxvY2tMaXN0OiBbXSxcbiAgICAgICAgc3FsSW5qZWN0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbiAgICAgICAgeHNzUHJvdGVjdGlvbjogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGxvZ2dpbmc6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgZGVzdGluYXRpb246ICdjbG91ZHdhdGNoJyxcbiAgICAgICAgcmV0ZW50aW9uRGF5czogOTBcbiAgICAgIH0sXG4gICAgICBtZXRyaWNzOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICAvLyBHdWFyZER1dHnoqK3lrppcbiAgICBndWFyZER1dHk6IHtcbiAgICAgIGVuYWJsZWQ6IHNlY3VyaXR5LmVuYWJsZUd1YXJkRHV0eSA/PyB0cnVlLFxuICAgICAgZmluZGluZ1B1Ymxpc2hpbmdGcmVxdWVuY3k6ICdGSUZURUVOX01JTlVURVMnLFxuICAgICAgczNQcm90ZWN0aW9uOiB0cnVlLFxuICAgICAga3ViZXJuZXRlc1Byb3RlY3Rpb246IHRydWUsXG4gICAgICBtYWx3YXJlUHJvdGVjdGlvbjogdHJ1ZVxuICAgIH0sXG4gICAgXG5cbiAgICAvLyDjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnoqK3lrppcbiAgICBjb21wbGlhbmNlOiB7XG4gICAgICBmaXNjQ29tcGxpYW5jZTogdHJ1ZSxcbiAgICAgIHBlcnNvbmFsSW5mb1Byb3RlY3Rpb246IHRydWUsXG4gICAgICBnZHByQ29tcGxpYW5jZTogdHJ1ZSxcbiAgICAgIHNveENvbXBsaWFuY2U6IGZhbHNlLFxuICAgICAgaGlwYWFDb21wbGlhbmNlOiBmYWxzZSxcbiAgICAgIGF1ZGl0TG9nZ2luZzogdHJ1ZSxcbiAgICAgIGRhdGFDbGFzc2lmaWNhdGlvbjogdHJ1ZSxcbiAgICAgIGFjY2Vzc0NvbnRyb2xzOiB0cnVlXG4gICAgfSxcbiAgICBcbiAgICAvLyDnm6PoppboqK3lrppcbiAgICBtb25pdG9yaW5nOiB7XG4gICAgICBjbG91ZFRyYWlsOiBzZWN1cml0eS5lbmFibGVDbG91ZFRyYWlsID8/IHRydWUsXG4gICAgICBjb25maWc6IHNlY3VyaXR5LmVuYWJsZUNvbmZpZyA/PyB0cnVlLFxuICAgICAgc2VjdXJpdHlIdWI6IHRydWUsXG4gICAgICBpbnNwZWN0b3I6IGZhbHNlXG4gICAgfVxuICB9O1xufVxuIl19