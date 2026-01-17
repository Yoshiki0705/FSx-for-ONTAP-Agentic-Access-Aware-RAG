"use strict";
/**
 * Virginia Region Configuration
 * バージニア地域設定（US East 1）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.virginiaConfig = void 0;
exports.virginiaConfig = {
    projectName: 'global-rag',
    environment: 'dev',
    region: 'us-east-1',
    regionalSettings: {
        primaryRegion: 'us-east-1',
        supportedRegions: ['us-east-1', 'us-west-2', 'us-east-2'],
        dataResidency: 'us',
        timezone: 'America/New_York'
    },
    features: {
        networking: {
            vpc: true,
            loadBalancer: true,
            cdn: true,
            customDomain: undefined
        },
        security: {
            waf: true,
            cognito: true,
            encryption: true,
            compliance: true
        },
        storage: {
            fsx: true,
            s3: true,
            backup: true,
            lifecycle: true
        },
        database: {
            dynamodb: true,
            opensearch: true,
            rds: false,
            migration: true
        },
        compute: {
            lambda: true,
            ecs: false,
            scaling: true
        },
        api: {
            restApi: true,
            graphql: false,
            websocket: false,
            frontend: true
        },
        ai: {
            bedrock: true,
            embedding: true,
            rag: true,
            modelManagement: true
        },
        monitoring: {
            cloudwatch: true,
            xray: true,
            alarms: true,
            dashboards: true
        },
        enterprise: {
            multiTenant: false,
            billing: false,
            compliance: true,
            governance: true
        }
    },
    compliance: {
        regulations: ['SOX', 'HIPAA'],
        dataProtection: {
            encryptionAtRest: true,
            encryptionInTransit: true,
            dataClassification: true,
            accessLogging: true,
            dataRetention: {
                defaultRetentionDays: 2555, // 7 years for SOX
                personalDataRetentionDays: 2190, // 6 years for HIPAA
                logRetentionDays: 365,
                backupRetentionDays: 2555
            }
        },
        auditLogging: true
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlyZ2luaWEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2aXJnaW5pYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFNVSxRQUFBLGNBQWMsR0FBb0I7SUFDN0MsV0FBVyxFQUFFLFlBQVk7SUFDekIsV0FBVyxFQUFFLEtBQUs7SUFDbEIsTUFBTSxFQUFFLFdBQVc7SUFFbkIsZ0JBQWdCLEVBQUU7UUFDaEIsYUFBYSxFQUFFLFdBQVc7UUFDMUIsZ0JBQWdCLEVBQUUsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztRQUN6RCxhQUFhLEVBQUUsSUFBSTtRQUNuQixRQUFRLEVBQUUsa0JBQWtCO0tBQzdCO0lBRUQsUUFBUSxFQUFFO1FBQ1IsVUFBVSxFQUFFO1lBQ1YsR0FBRyxFQUFFLElBQUk7WUFDVCxZQUFZLEVBQUUsSUFBSTtZQUNsQixHQUFHLEVBQUUsSUFBSTtZQUNULFlBQVksRUFBRSxTQUFTO1NBQ3hCO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsR0FBRyxFQUFFLElBQUk7WUFDVCxPQUFPLEVBQUUsSUFBSTtZQUNiLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFVBQVUsRUFBRSxJQUFJO1NBQ2pCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsR0FBRyxFQUFFLElBQUk7WUFDVCxFQUFFLEVBQUUsSUFBSTtZQUNSLE1BQU0sRUFBRSxJQUFJO1lBQ1osU0FBUyxFQUFFLElBQUk7U0FDaEI7UUFDRCxRQUFRLEVBQUU7WUFDUixRQUFRLEVBQUUsSUFBSTtZQUNkLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLEdBQUcsRUFBRSxLQUFLO1lBQ1YsU0FBUyxFQUFFLElBQUk7U0FDaEI7UUFDRCxPQUFPLEVBQUU7WUFDUCxNQUFNLEVBQUUsSUFBSTtZQUNaLEdBQUcsRUFBRSxLQUFLO1lBQ1YsT0FBTyxFQUFFLElBQUk7U0FDZDtRQUNELEdBQUcsRUFBRTtZQUNILE9BQU8sRUFBRSxJQUFJO1lBQ2IsT0FBTyxFQUFFLEtBQUs7WUFDZCxTQUFTLEVBQUUsS0FBSztZQUNoQixRQUFRLEVBQUUsSUFBSTtTQUNmO1FBQ0QsRUFBRSxFQUFFO1lBQ0YsT0FBTyxFQUFFLElBQUk7WUFDYixTQUFTLEVBQUUsSUFBSTtZQUNmLEdBQUcsRUFBRSxJQUFJO1lBQ1QsZUFBZSxFQUFFLElBQUk7U0FDdEI7UUFDRCxVQUFVLEVBQUU7WUFDVixVQUFVLEVBQUUsSUFBSTtZQUNoQixJQUFJLEVBQUUsSUFBSTtZQUNWLE1BQU0sRUFBRSxJQUFJO1lBQ1osVUFBVSxFQUFFLElBQUk7U0FDakI7UUFDRCxVQUFVLEVBQUU7WUFDVixXQUFXLEVBQUUsS0FBSztZQUNsQixPQUFPLEVBQUUsS0FBSztZQUNkLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFVBQVUsRUFBRSxJQUFJO1NBQ2pCO0tBQ0Y7SUFFRCxVQUFVLEVBQUU7UUFDVixXQUFXLEVBQUUsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUEyQjtRQUN2RCxjQUFjLEVBQUU7WUFDZCxnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLG1CQUFtQixFQUFFLElBQUk7WUFDekIsa0JBQWtCLEVBQUUsSUFBSTtZQUN4QixhQUFhLEVBQUUsSUFBSTtZQUNuQixhQUFhLEVBQUU7Z0JBQ2Isb0JBQW9CLEVBQUUsSUFBSSxFQUFFLGtCQUFrQjtnQkFDOUMseUJBQXlCLEVBQUUsSUFBSSxFQUFFLG9CQUFvQjtnQkFDckQsZ0JBQWdCLEVBQUUsR0FBRztnQkFDckIsbUJBQW1CLEVBQUUsSUFBSTthQUMxQjtTQUNGO1FBQ0QsWUFBWSxFQUFFLElBQUk7S0FDbkI7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBWaXJnaW5pYSBSZWdpb24gQ29uZmlndXJhdGlvblxuICog44OQ44O844K444OL44Ki5Zyw5Z+f6Kit5a6a77yIVVMgRWFzdCAx77yJXG4gKi9cblxuaW1wb3J0IHsgR2xvYmFsUmFnQ29uZmlnIH0gZnJvbSAnLi4vLi4vdHlwZXMvZ2xvYmFsLWNvbmZpZyc7XG4vLyBDb21wbGlhbmNlTWFwcGVy44Gv5b6M44Gn5a6f6KOF5LqI5a6a44Gu44Gf44KB44CB5LiA5pmC55qE44Gr55u05o6l6Kit5a6aXG5pbXBvcnQgeyBDb21wbGlhbmNlUmVndWxhdGlvbiB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuXG5leHBvcnQgY29uc3QgdmlyZ2luaWFDb25maWc6IEdsb2JhbFJhZ0NvbmZpZyA9IHtcbiAgcHJvamVjdE5hbWU6ICdnbG9iYWwtcmFnJyxcbiAgZW52aXJvbm1lbnQ6ICdkZXYnLFxuICByZWdpb246ICd1cy1lYXN0LTEnLFxuICBcbiAgcmVnaW9uYWxTZXR0aW5nczoge1xuICAgIHByaW1hcnlSZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIHN1cHBvcnRlZFJlZ2lvbnM6IFsndXMtZWFzdC0xJywgJ3VzLXdlc3QtMicsICd1cy1lYXN0LTInXSxcbiAgICBkYXRhUmVzaWRlbmN5OiAndXMnLFxuICAgIHRpbWV6b25lOiAnQW1lcmljYS9OZXdfWW9yaydcbiAgfSxcbiAgXG4gIGZlYXR1cmVzOiB7XG4gICAgbmV0d29ya2luZzoge1xuICAgICAgdnBjOiB0cnVlLFxuICAgICAgbG9hZEJhbGFuY2VyOiB0cnVlLFxuICAgICAgY2RuOiB0cnVlLFxuICAgICAgY3VzdG9tRG9tYWluOiB1bmRlZmluZWRcbiAgICB9LFxuICAgIHNlY3VyaXR5OiB7XG4gICAgICB3YWY6IHRydWUsXG4gICAgICBjb2duaXRvOiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgIGNvbXBsaWFuY2U6IHRydWVcbiAgICB9LFxuICAgIHN0b3JhZ2U6IHtcbiAgICAgIGZzeDogdHJ1ZSxcbiAgICAgIHMzOiB0cnVlLFxuICAgICAgYmFja3VwOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlOiB0cnVlXG4gICAgfSxcbiAgICBkYXRhYmFzZToge1xuICAgICAgZHluYW1vZGI6IHRydWUsXG4gICAgICBvcGVuc2VhcmNoOiB0cnVlLFxuICAgICAgcmRzOiBmYWxzZSxcbiAgICAgIG1pZ3JhdGlvbjogdHJ1ZVxuICAgIH0sXG4gICAgY29tcHV0ZToge1xuICAgICAgbGFtYmRhOiB0cnVlLFxuICAgICAgZWNzOiBmYWxzZSxcbiAgICAgIHNjYWxpbmc6IHRydWVcbiAgICB9LFxuICAgIGFwaToge1xuICAgICAgcmVzdEFwaTogdHJ1ZSxcbiAgICAgIGdyYXBocWw6IGZhbHNlLFxuICAgICAgd2Vic29ja2V0OiBmYWxzZSxcbiAgICAgIGZyb250ZW5kOiB0cnVlXG4gICAgfSxcbiAgICBhaToge1xuICAgICAgYmVkcm9jazogdHJ1ZSxcbiAgICAgIGVtYmVkZGluZzogdHJ1ZSxcbiAgICAgIHJhZzogdHJ1ZSxcbiAgICAgIG1vZGVsTWFuYWdlbWVudDogdHJ1ZVxuICAgIH0sXG4gICAgbW9uaXRvcmluZzoge1xuICAgICAgY2xvdWR3YXRjaDogdHJ1ZSxcbiAgICAgIHhyYXk6IHRydWUsXG4gICAgICBhbGFybXM6IHRydWUsXG4gICAgICBkYXNoYm9hcmRzOiB0cnVlXG4gICAgfSxcbiAgICBlbnRlcnByaXNlOiB7XG4gICAgICBtdWx0aVRlbmFudDogZmFsc2UsXG4gICAgICBiaWxsaW5nOiBmYWxzZSxcbiAgICAgIGNvbXBsaWFuY2U6IHRydWUsXG4gICAgICBnb3Zlcm5hbmNlOiB0cnVlXG4gICAgfVxuICB9LFxuICBcbiAgY29tcGxpYW5jZToge1xuICAgIHJlZ3VsYXRpb25zOiBbJ1NPWCcsICdISVBBQSddIGFzIENvbXBsaWFuY2VSZWd1bGF0aW9uW10sXG4gICAgZGF0YVByb3RlY3Rpb246IHtcbiAgICAgIGVuY3J5cHRpb25BdFJlc3Q6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uSW5UcmFuc2l0OiB0cnVlLFxuICAgICAgZGF0YUNsYXNzaWZpY2F0aW9uOiB0cnVlLFxuICAgICAgYWNjZXNzTG9nZ2luZzogdHJ1ZSxcbiAgICAgIGRhdGFSZXRlbnRpb246IHtcbiAgICAgICAgZGVmYXVsdFJldGVudGlvbkRheXM6IDI1NTUsIC8vIDcgeWVhcnMgZm9yIFNPWFxuICAgICAgICBwZXJzb25hbERhdGFSZXRlbnRpb25EYXlzOiAyMTkwLCAvLyA2IHllYXJzIGZvciBISVBBQVxuICAgICAgICBsb2dSZXRlbnRpb25EYXlzOiAzNjUsXG4gICAgICAgIGJhY2t1cFJldGVudGlvbkRheXM6IDI1NTVcbiAgICAgIH1cbiAgICB9LFxuICAgIGF1ZGl0TG9nZ2luZzogdHJ1ZVxuICB9XG59OyJdfQ==