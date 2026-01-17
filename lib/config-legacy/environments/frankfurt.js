"use strict";
/**
 * Frankfurt Region Configuration
 * フランクフルトリージョン設定（EU地域）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.frankfurtConfig = void 0;
exports.frankfurtConfig = {
    projectName: 'rag-frankfurt',
    environment: 'prod',
    region: 'eu-central-1',
    features: {
        networking: {
            vpc: true,
            loadBalancer: true,
            cdn: true,
            customDomain: 'rag-eu.example.com'
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
        primaryRegion: 'eu-central-1',
        supportedRegions: ['eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3'],
        dataResidency: 'eu',
        timezone: 'Europe/Berlin'
    },
    compliance: {
        regulations: ['GDPR', 'BDSG'],
        dataProtection: {
            encryptionAtRest: true,
            encryptionInTransit: true,
            dataClassification: true,
            accessLogging: true,
            dataRetention: {
                defaultRetentionDays: 1095, // 3 years
                personalDataRetentionDays: 1095,
                logRetentionDays: 365,
                backupRetentionDays: 1095
            }
        },
        auditLogging: true,
        gdprCompliance: {
            dpiaRequired: true,
            rightToErasure: true,
            dataPortability: true,
            consentManagement: true,
            dataProcessingRecords: true
        }
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJhbmtmdXJ0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZnJhbmtmdXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUlVLFFBQUEsZUFBZSxHQUFvQjtJQUM5QyxXQUFXLEVBQUUsZUFBZTtJQUM1QixXQUFXLEVBQUUsTUFBTTtJQUNuQixNQUFNLEVBQUUsY0FBYztJQUV0QixRQUFRLEVBQUU7UUFDUixVQUFVLEVBQUU7WUFDVixHQUFHLEVBQUUsSUFBSTtZQUNULFlBQVksRUFBRSxJQUFJO1lBQ2xCLEdBQUcsRUFBRSxJQUFJO1lBQ1QsWUFBWSxFQUFFLG9CQUFvQjtTQUNuQztRQUNELFFBQVEsRUFBRTtZQUNSLEdBQUcsRUFBRSxJQUFJO1lBQ1QsT0FBTyxFQUFFLElBQUk7WUFDYixVQUFVLEVBQUUsSUFBSTtZQUNoQixVQUFVLEVBQUUsSUFBSTtTQUNqQjtRQUNELE9BQU8sRUFBRTtZQUNQLEdBQUcsRUFBRSxJQUFJO1lBQ1QsRUFBRSxFQUFFLElBQUk7WUFDUixNQUFNLEVBQUUsSUFBSTtZQUNaLFNBQVMsRUFBRSxJQUFJO1NBQ2hCO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsUUFBUSxFQUFFLElBQUk7WUFDZCxVQUFVLEVBQUUsSUFBSTtZQUNoQixHQUFHLEVBQUUsSUFBSTtZQUNULFNBQVMsRUFBRSxJQUFJO1NBQ2hCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsTUFBTSxFQUFFLElBQUk7WUFDWixHQUFHLEVBQUUsSUFBSTtZQUNULE9BQU8sRUFBRSxJQUFJO1NBQ2Q7UUFDRCxHQUFHLEVBQUU7WUFDSCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRSxJQUFJO1lBQ2IsU0FBUyxFQUFFLElBQUk7WUFDZixRQUFRLEVBQUUsSUFBSTtTQUNmO1FBQ0QsRUFBRSxFQUFFO1lBQ0YsT0FBTyxFQUFFLElBQUk7WUFDYixTQUFTLEVBQUUsSUFBSTtZQUNmLEdBQUcsRUFBRSxJQUFJO1lBQ1QsZUFBZSxFQUFFLElBQUk7U0FDdEI7UUFDRCxVQUFVLEVBQUU7WUFDVixVQUFVLEVBQUUsSUFBSTtZQUNoQixJQUFJLEVBQUUsSUFBSTtZQUNWLE1BQU0sRUFBRSxJQUFJO1lBQ1osVUFBVSxFQUFFLElBQUk7U0FDakI7UUFDRCxVQUFVLEVBQUU7WUFDVixXQUFXLEVBQUUsSUFBSTtZQUNqQixPQUFPLEVBQUUsSUFBSTtZQUNiLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFVBQVUsRUFBRSxJQUFJO1NBQ2pCO0tBQ0Y7SUFFRCxnQkFBZ0IsRUFBRTtRQUNoQixhQUFhLEVBQUUsY0FBYztRQUM3QixnQkFBZ0IsRUFBRSxDQUFDLGNBQWMsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztRQUN6RSxhQUFhLEVBQUUsSUFBSTtRQUNuQixRQUFRLEVBQUUsZUFBZTtLQUMxQjtJQUVELFVBQVUsRUFBRTtRQUNWLFdBQVcsRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUM7UUFDN0IsY0FBYyxFQUFFO1lBQ2QsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixtQkFBbUIsRUFBRSxJQUFJO1lBQ3pCLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsYUFBYSxFQUFFLElBQUk7WUFDbkIsYUFBYSxFQUFFO2dCQUNiLG9CQUFvQixFQUFFLElBQUksRUFBRSxVQUFVO2dCQUN0Qyx5QkFBeUIsRUFBRSxJQUFJO2dCQUMvQixnQkFBZ0IsRUFBRSxHQUFHO2dCQUNyQixtQkFBbUIsRUFBRSxJQUFJO2FBQzFCO1NBQ0Y7UUFDRCxZQUFZLEVBQUUsSUFBSTtRQUNsQixjQUFjLEVBQUU7WUFDZCxZQUFZLEVBQUUsSUFBSTtZQUNsQixjQUFjLEVBQUUsSUFBSTtZQUNwQixlQUFlLEVBQUUsSUFBSTtZQUNyQixpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLHFCQUFxQixFQUFFLElBQUk7U0FDNUI7S0FDRjtDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZyYW5rZnVydCBSZWdpb24gQ29uZmlndXJhdGlvblxuICog44OV44Op44Oz44Kv44OV44Or44OI44Oq44O844K444On44Oz6Kit5a6a77yIRVXlnLDln5/vvIlcbiAqL1xuXG5pbXBvcnQgeyBHbG9iYWxSYWdDb25maWcgfSBmcm9tICcuLi8uLi90eXBlcy9nbG9iYWwtY29uZmlnJztcblxuZXhwb3J0IGNvbnN0IGZyYW5rZnVydENvbmZpZzogR2xvYmFsUmFnQ29uZmlnID0ge1xuICBwcm9qZWN0TmFtZTogJ3JhZy1mcmFua2Z1cnQnLFxuICBlbnZpcm9ubWVudDogJ3Byb2QnLFxuICByZWdpb246ICdldS1jZW50cmFsLTEnLFxuICBcbiAgZmVhdHVyZXM6IHtcbiAgICBuZXR3b3JraW5nOiB7XG4gICAgICB2cGM6IHRydWUsXG4gICAgICBsb2FkQmFsYW5jZXI6IHRydWUsXG4gICAgICBjZG46IHRydWUsXG4gICAgICBjdXN0b21Eb21haW46ICdyYWctZXUuZXhhbXBsZS5jb20nXG4gICAgfSxcbiAgICBzZWN1cml0eToge1xuICAgICAgd2FmOiB0cnVlLFxuICAgICAgY29nbml0bzogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICBjb21wbGlhbmNlOiB0cnVlXG4gICAgfSxcbiAgICBzdG9yYWdlOiB7XG4gICAgICBmc3g6IHRydWUsXG4gICAgICBzMzogdHJ1ZSxcbiAgICAgIGJhY2t1cDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZTogdHJ1ZVxuICAgIH0sXG4gICAgZGF0YWJhc2U6IHtcbiAgICAgIGR5bmFtb2RiOiB0cnVlLFxuICAgICAgb3BlbnNlYXJjaDogdHJ1ZSxcbiAgICAgIHJkczogdHJ1ZSxcbiAgICAgIG1pZ3JhdGlvbjogdHJ1ZVxuICAgIH0sXG4gICAgY29tcHV0ZToge1xuICAgICAgbGFtYmRhOiB0cnVlLFxuICAgICAgZWNzOiB0cnVlLFxuICAgICAgc2NhbGluZzogdHJ1ZVxuICAgIH0sXG4gICAgYXBpOiB7XG4gICAgICByZXN0QXBpOiB0cnVlLFxuICAgICAgZ3JhcGhxbDogdHJ1ZSxcbiAgICAgIHdlYnNvY2tldDogdHJ1ZSxcbiAgICAgIGZyb250ZW5kOiB0cnVlXG4gICAgfSxcbiAgICBhaToge1xuICAgICAgYmVkcm9jazogdHJ1ZSxcbiAgICAgIGVtYmVkZGluZzogdHJ1ZSxcbiAgICAgIHJhZzogdHJ1ZSxcbiAgICAgIG1vZGVsTWFuYWdlbWVudDogdHJ1ZVxuICAgIH0sXG4gICAgbW9uaXRvcmluZzoge1xuICAgICAgY2xvdWR3YXRjaDogdHJ1ZSxcbiAgICAgIHhyYXk6IHRydWUsXG4gICAgICBhbGFybXM6IHRydWUsXG4gICAgICBkYXNoYm9hcmRzOiB0cnVlXG4gICAgfSxcbiAgICBlbnRlcnByaXNlOiB7XG4gICAgICBtdWx0aVRlbmFudDogdHJ1ZSxcbiAgICAgIGJpbGxpbmc6IHRydWUsXG4gICAgICBjb21wbGlhbmNlOiB0cnVlLFxuICAgICAgZ292ZXJuYW5jZTogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgXG4gIHJlZ2lvbmFsU2V0dGluZ3M6IHtcbiAgICBwcmltYXJ5UmVnaW9uOiAnZXUtY2VudHJhbC0xJyxcbiAgICBzdXBwb3J0ZWRSZWdpb25zOiBbJ2V1LWNlbnRyYWwtMScsICdldS13ZXN0LTEnLCAnZXUtd2VzdC0yJywgJ2V1LXdlc3QtMyddLFxuICAgIGRhdGFSZXNpZGVuY3k6ICdldScsXG4gICAgdGltZXpvbmU6ICdFdXJvcGUvQmVybGluJ1xuICB9LFxuICBcbiAgY29tcGxpYW5jZToge1xuICAgIHJlZ3VsYXRpb25zOiBbJ0dEUFInLCAnQkRTRyddLFxuICAgIGRhdGFQcm90ZWN0aW9uOiB7XG4gICAgICBlbmNyeXB0aW9uQXRSZXN0OiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbkluVHJhbnNpdDogdHJ1ZSxcbiAgICAgIGRhdGFDbGFzc2lmaWNhdGlvbjogdHJ1ZSxcbiAgICAgIGFjY2Vzc0xvZ2dpbmc6IHRydWUsXG4gICAgICBkYXRhUmV0ZW50aW9uOiB7XG4gICAgICAgIGRlZmF1bHRSZXRlbnRpb25EYXlzOiAxMDk1LCAvLyAzIHllYXJzXG4gICAgICAgIHBlcnNvbmFsRGF0YVJldGVudGlvbkRheXM6IDEwOTUsXG4gICAgICAgIGxvZ1JldGVudGlvbkRheXM6IDM2NSxcbiAgICAgICAgYmFja3VwUmV0ZW50aW9uRGF5czogMTA5NVxuICAgICAgfVxuICAgIH0sXG4gICAgYXVkaXRMb2dnaW5nOiB0cnVlLFxuICAgIGdkcHJDb21wbGlhbmNlOiB7XG4gICAgICBkcGlhUmVxdWlyZWQ6IHRydWUsXG4gICAgICByaWdodFRvRXJhc3VyZTogdHJ1ZSxcbiAgICAgIGRhdGFQb3J0YWJpbGl0eTogdHJ1ZSxcbiAgICAgIGNvbnNlbnRNYW5hZ2VtZW50OiB0cnVlLFxuICAgICAgZGF0YVByb2Nlc3NpbmdSZWNvcmRzOiB0cnVlXG4gICAgfVxuICB9XG59OyJdfQ==