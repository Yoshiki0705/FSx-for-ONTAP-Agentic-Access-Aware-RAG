"use strict";
/**
 * Tokyo Region Configuration
 * 東京リージョン設定（メインリージョン）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokyoConfig = void 0;
exports.tokyoConfig = {
    projectName: 'rag-tokyo',
    environment: 'prod',
    region: 'ap-northeast-1',
    features: {
        networking: {
            vpc: true,
            loadBalancer: true,
            cdn: true,
            customDomain: 'rag.example.com'
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
            rds: true,
            migration: true
        },
        compute: {
            lambda: true,
            ecs: true,
            scaling: true
        },
        api: {
            restApi: true,
            graphql: true,
            websocket: true,
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
            multiTenant: true,
            billing: true,
            compliance: true,
            governance: true
        }
    },
    regionalSettings: {
        primaryRegion: 'ap-northeast-1',
        secondaryRegion: 'ap-northeast-3',
        supportedRegions: ['ap-northeast-1', 'ap-northeast-3'],
        dataResidency: 'japan',
        timezone: 'Asia/Tokyo'
    },
    disasterRecovery: {
        enabled: true,
        primaryRegion: 'ap-northeast-1',
        secondaryRegion: 'ap-northeast-3',
        rto: 4, // 4 hours
        rpo: 1, // 1 hour
        replicationServices: ['dynamodb', 'fsx', 'opensearch', 's3']
    },
    compliance: {
        regulations: ['FISC'],
        dataProtection: {
            encryptionAtRest: true,
            encryptionInTransit: true,
            dataClassification: true,
            accessLogging: true,
            dataRetention: {
                defaultRetentionDays: 2555, // 7 years for financial data
                personalDataRetentionDays: 1095, // 3 years
                logRetentionDays: 365,
                backupRetentionDays: 2555
            }
        },
        auditLogging: true
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9reW8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0b2t5by50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFJVSxRQUFBLFdBQVcsR0FBb0I7SUFDMUMsV0FBVyxFQUFFLFdBQVc7SUFDeEIsV0FBVyxFQUFFLE1BQU07SUFDbkIsTUFBTSxFQUFFLGdCQUFnQjtJQUV4QixRQUFRLEVBQUU7UUFDUixVQUFVLEVBQUU7WUFDVixHQUFHLEVBQUUsSUFBSTtZQUNULFlBQVksRUFBRSxJQUFJO1lBQ2xCLEdBQUcsRUFBRSxJQUFJO1lBQ1QsWUFBWSxFQUFFLGlCQUFpQjtTQUNoQztRQUNELFFBQVEsRUFBRTtZQUNSLEdBQUcsRUFBRSxJQUFJO1lBQ1QsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUsSUFBSTtZQUNoQixVQUFVLEVBQUUsSUFBSTtTQUNqQjtRQUNELE9BQU8sRUFBRTtZQUNQLEdBQUcsRUFBRSxJQUFJO1lBQ1QsRUFBRSxFQUFFLElBQUk7WUFDUixNQUFNLEVBQUUsSUFBSTtZQUNaLFNBQVMsRUFBRSxJQUFJO1NBQ2hCO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsUUFBUSxFQUFFLElBQUk7WUFDZCxVQUFVLEVBQUUsSUFBSTtZQUNoQixHQUFHLEVBQUUsSUFBSTtZQUNULFNBQVMsRUFBRSxJQUFJO1NBQ2hCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsTUFBTSxFQUFFLElBQUk7WUFDWixHQUFHLEVBQUUsSUFBSTtZQUNULE9BQU8sRUFBRSxJQUFJO1NBQ2Q7UUFDRCxHQUFHLEVBQUU7WUFDSCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRSxJQUFJO1lBQ2IsU0FBUyxFQUFFLElBQUk7WUFDZixRQUFRLEVBQUUsSUFBSTtTQUNmO1FBQ0QsRUFBRSxFQUFFO1lBQ0YsT0FBTyxFQUFFLElBQUk7WUFDYixTQUFTLEVBQUUsSUFBSTtZQUNmLEdBQUcsRUFBRSxJQUFJO1lBQ1QsZUFBZSxFQUFFLElBQUk7U0FDdEI7UUFDRCxVQUFVLEVBQUU7WUFDVixVQUFVLEVBQUUsSUFBSTtZQUNoQixJQUFJLEVBQUUsSUFBSTtZQUNWLE1BQU0sRUFBRSxJQUFJO1lBQ1osVUFBVSxFQUFFLElBQUk7U0FDakI7UUFDRCxVQUFVLEVBQUU7WUFDVixXQUFXLEVBQUUsSUFBSTtZQUNqQixPQUFPLEVBQUUsSUFBSTtZQUNiLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFVBQVUsRUFBRSxJQUFJO1NBQ2pCO0tBQ0Y7SUFFRCxnQkFBZ0IsRUFBRTtRQUNoQixhQUFhLEVBQUUsZ0JBQWdCO1FBQy9CLGVBQWUsRUFBRSxnQkFBZ0I7UUFDakMsZ0JBQWdCLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxnQkFBZ0IsQ0FBQztRQUN0RCxhQUFhLEVBQUUsT0FBTztRQUN0QixRQUFRLEVBQUUsWUFBWTtLQUN2QjtJQUVELGdCQUFnQixFQUFFO1FBQ2hCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsYUFBYSxFQUFFLGdCQUFnQjtRQUMvQixlQUFlLEVBQUUsZ0JBQWdCO1FBQ2pDLEdBQUcsRUFBRSxDQUFDLEVBQUUsVUFBVTtRQUNsQixHQUFHLEVBQUUsQ0FBQyxFQUFFLFNBQVM7UUFDakIsbUJBQW1CLEVBQUUsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxJQUFJLENBQUM7S0FDN0Q7SUFFRCxVQUFVLEVBQUU7UUFDVixXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDckIsY0FBYyxFQUFFO1lBQ2QsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixtQkFBbUIsRUFBRSxJQUFJO1lBQ3pCLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsYUFBYSxFQUFFLElBQUk7WUFDbkIsYUFBYSxFQUFFO2dCQUNiLG9CQUFvQixFQUFFLElBQUksRUFBRSw2QkFBNkI7Z0JBQ3pELHlCQUF5QixFQUFFLElBQUksRUFBRSxVQUFVO2dCQUMzQyxnQkFBZ0IsRUFBRSxHQUFHO2dCQUNyQixtQkFBbUIsRUFBRSxJQUFJO2FBQzFCO1NBQ0Y7UUFDRCxZQUFZLEVBQUUsSUFBSTtLQUNuQjtDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRva3lvIFJlZ2lvbiBDb25maWd1cmF0aW9uXG4gKiDmnbHkuqzjg6rjg7zjgrjjg6fjg7PoqK3lrprvvIjjg6HjgqTjg7Pjg6rjg7zjgrjjg6fjg7PvvIlcbiAqL1xuXG5pbXBvcnQgeyBHbG9iYWxSYWdDb25maWcgfSBmcm9tICcuLi8uLi90eXBlcy9nbG9iYWwtY29uZmlnJztcblxuZXhwb3J0IGNvbnN0IHRva3lvQ29uZmlnOiBHbG9iYWxSYWdDb25maWcgPSB7XG4gIHByb2plY3ROYW1lOiAncmFnLXRva3lvJyxcbiAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgcmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnLFxuICBcbiAgZmVhdHVyZXM6IHtcbiAgICBuZXR3b3JraW5nOiB7XG4gICAgICB2cGM6IHRydWUsXG4gICAgICBsb2FkQmFsYW5jZXI6IHRydWUsXG4gICAgICBjZG46IHRydWUsXG4gICAgICBjdXN0b21Eb21haW46ICdyYWcuZXhhbXBsZS5jb20nXG4gICAgfSxcbiAgICBzZWN1cml0eToge1xuICAgICAgd2FmOiB0cnVlLFxuICAgICAgY29nbml0bzogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICBjb21wbGlhbmNlOiB0cnVlXG4gICAgfSxcbiAgICBzdG9yYWdlOiB7XG4gICAgICBmc3g6IHRydWUsXG4gICAgICBzMzogdHJ1ZSxcbiAgICAgIGJhY2t1cDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZTogdHJ1ZVxuICAgIH0sXG4gICAgZGF0YWJhc2U6IHtcbiAgICAgIGR5bmFtb2RiOiB0cnVlLFxuICAgICAgb3BlbnNlYXJjaDogdHJ1ZSxcbiAgICAgIHJkczogdHJ1ZSxcbiAgICAgIG1pZ3JhdGlvbjogdHJ1ZVxuICAgIH0sXG4gICAgY29tcHV0ZToge1xuICAgICAgbGFtYmRhOiB0cnVlLFxuICAgICAgZWNzOiB0cnVlLFxuICAgICAgc2NhbGluZzogdHJ1ZVxuICAgIH0sXG4gICAgYXBpOiB7XG4gICAgICByZXN0QXBpOiB0cnVlLFxuICAgICAgZ3JhcGhxbDogdHJ1ZSxcbiAgICAgIHdlYnNvY2tldDogdHJ1ZSxcbiAgICAgIGZyb250ZW5kOiB0cnVlXG4gICAgfSxcbiAgICBhaToge1xuICAgICAgYmVkcm9jazogdHJ1ZSxcbiAgICAgIGVtYmVkZGluZzogdHJ1ZSxcbiAgICAgIHJhZzogdHJ1ZSxcbiAgICAgIG1vZGVsTWFuYWdlbWVudDogdHJ1ZVxuICAgIH0sXG4gICAgbW9uaXRvcmluZzoge1xuICAgICAgY2xvdWR3YXRjaDogdHJ1ZSxcbiAgICAgIHhyYXk6IHRydWUsXG4gICAgICBhbGFybXM6IHRydWUsXG4gICAgICBkYXNoYm9hcmRzOiB0cnVlXG4gICAgfSxcbiAgICBlbnRlcnByaXNlOiB7XG4gICAgICBtdWx0aVRlbmFudDogdHJ1ZSxcbiAgICAgIGJpbGxpbmc6IHRydWUsXG4gICAgICBjb21wbGlhbmNlOiB0cnVlLFxuICAgICAgZ292ZXJuYW5jZTogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgXG4gIHJlZ2lvbmFsU2V0dGluZ3M6IHtcbiAgICBwcmltYXJ5UmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnLFxuICAgIHNlY29uZGFyeVJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0zJyxcbiAgICBzdXBwb3J0ZWRSZWdpb25zOiBbJ2FwLW5vcnRoZWFzdC0xJywgJ2FwLW5vcnRoZWFzdC0zJ10sXG4gICAgZGF0YVJlc2lkZW5jeTogJ2phcGFuJyxcbiAgICB0aW1lem9uZTogJ0FzaWEvVG9reW8nXG4gIH0sXG4gIFxuICBkaXNhc3RlclJlY292ZXJ5OiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBwcmltYXJ5UmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnLFxuICAgIHNlY29uZGFyeVJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0zJyxcbiAgICBydG86IDQsIC8vIDQgaG91cnNcbiAgICBycG86IDEsIC8vIDEgaG91clxuICAgIHJlcGxpY2F0aW9uU2VydmljZXM6IFsnZHluYW1vZGInLCAnZnN4JywgJ29wZW5zZWFyY2gnLCAnczMnXVxuICB9LFxuICBcbiAgY29tcGxpYW5jZToge1xuICAgIHJlZ3VsYXRpb25zOiBbJ0ZJU0MnXSxcbiAgICBkYXRhUHJvdGVjdGlvbjoge1xuICAgICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb25JblRyYW5zaXQ6IHRydWUsXG4gICAgICBkYXRhQ2xhc3NpZmljYXRpb246IHRydWUsXG4gICAgICBhY2Nlc3NMb2dnaW5nOiB0cnVlLFxuICAgICAgZGF0YVJldGVudGlvbjoge1xuICAgICAgICBkZWZhdWx0UmV0ZW50aW9uRGF5czogMjU1NSwgLy8gNyB5ZWFycyBmb3IgZmluYW5jaWFsIGRhdGFcbiAgICAgICAgcGVyc29uYWxEYXRhUmV0ZW50aW9uRGF5czogMTA5NSwgLy8gMyB5ZWFyc1xuICAgICAgICBsb2dSZXRlbnRpb25EYXlzOiAzNjUsXG4gICAgICAgIGJhY2t1cFJldGVudGlvbkRheXM6IDI1NTVcbiAgICAgIH1cbiAgICB9LFxuICAgIGF1ZGl0TG9nZ2luZzogdHJ1ZVxuICB9XG59OyJdfQ==