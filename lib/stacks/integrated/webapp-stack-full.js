"use strict";
/**
 * WebAppStack - Lambda Web Adapter + Next.js + CloudFront統合スタック
 *
 * 機能:
 * - Lambda Function (Container) with Web Adapter
 * - Lambda Function URL
 * - CloudFront Distribution
 * - ECR Repository
 * - IAM Roles and Permissions
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
exports.WebAppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
/**
 * WebAppStack - フル実装版
 */
class WebAppStack extends cdk.Stack {
    /** Lambda Function */
    webAppFunction;
    /** Lambda Function URL */
    functionUrl;
    /** CloudFront Distribution */
    distribution;
    /** ECR Repository */
    ecrRepository;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        const projectName = config.project?.name || config.naming?.projectName || 'permission-aware-rag';
        const environment = config.environment || config.naming?.environment || 'prod';
        const regionPrefix = config.naming?.regionPrefix || 'TokyoRegion';
        console.log('🚀 WebAppStack (Full) 初期化開始...');
        console.log(`   プロジェクト名: ${projectName}`);
        console.log(`   環境: ${environment}`);
        console.log(`   リージョンプレフィックス: ${regionPrefix}`);
        // ECR Repository
        this.ecrRepository = new ecr.Repository(this, 'WebAppRepository', {
            repositoryName: `${regionPrefix.toLowerCase()}-${projectName}-${environment}-webapp-repo`,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            lifecycleRules: [
                {
                    description: 'Keep last 10 images',
                    maxImageCount: 10,
                },
            ],
        });
        // Lambda Execution Role
        const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
            roleName: `${regionPrefix}-${projectName}-${environment}-WebApp-Lambda-Role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Bedrock access
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListFoundationModels',
                'bedrock:GetFoundationModel',
            ],
            resources: ['*'],
        }));
        // Bedrock Agent access
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeAgent',
            ],
            resources: ['*'],
        }));
        // DynamoDB access (if needed)
        if (config.database?.dynamodb) {
            lambdaRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:DeleteItem',
                    'dynamodb:Query',
                    'dynamodb:Scan',
                ],
                resources: ['*'], // TODO: Scope to specific tables
            }));
        }
        // Lambda Function
        this.webAppFunction = new lambda.Function(this, 'WebAppFunction', {
            functionName: `${regionPrefix}-${projectName}-${environment}-WebApp-Function`,
            runtime: lambda.Runtime.FROM_IMAGE,
            code: lambda.Code.fromEcrImage(this.ecrRepository, {
                tagOrDigest: 'latest',
            }),
            handler: lambda.Handler.FROM_IMAGE,
            role: lambdaRole,
            timeout: cdk.Duration.seconds(config.compute?.lambda?.timeout || 30),
            memorySize: config.compute?.lambda?.memorySize || 512,
            environment: {
                NODE_ENV: 'production',
                BEDROCK_REGION: config.ai?.bedrock?.region || 'us-east-1',
                AWS_LWA_INVOKE_MODE: 'response_stream',
                AWS_LWA_PORT: '3000',
                RUST_LOG: 'info',
            },
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        // Lambda Function URL
        this.functionUrl = this.webAppFunction.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedOrigins: ['*'],
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedHeaders: ['*'],
            },
            invokeMode: lambda.InvokeMode.BUFFERED,
        });
        // CloudFront Distribution
        this.distribution = new cloudfront.Distribution(this, 'WebAppDistribution', {
            comment: `${regionPrefix}-${projectName}-${environment}-WebApp-Distribution`,
            defaultBehavior: {
                origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', this.functionUrl.url))),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                compress: true,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
            },
            priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
            enableLogging: false,
        });
        // Outputs
        new cdk.CfnOutput(this, 'FunctionUrl', {
            value: this.functionUrl.url,
            description: 'Lambda Function URL',
            exportName: `${this.stackName}-FunctionUrl`,
        });
        new cdk.CfnOutput(this, 'CloudFrontUrl', {
            value: `https://${this.distribution.distributionDomainName}`,
            description: 'CloudFront Distribution URL',
            exportName: `${this.stackName}-CloudFrontUrl`,
        });
        new cdk.CfnOutput(this, 'ECRRepositoryUri', {
            value: this.ecrRepository.repositoryUri,
            description: 'ECR Repository URI',
            exportName: `${this.stackName}-ECRRepositoryUri`,
        });
        // Tags
        cdk.Tags.of(this).add('Module', 'WebApp');
        cdk.Tags.of(this).add('Framework', 'Next.js');
        cdk.Tags.of(this).add('Adapter', 'Lambda Web Adapter');
        cdk.Tags.of(this).add('CDN', 'CloudFront');
        console.log('✅ WebAppStack (Full) 初期化完了');
    }
}
exports.WebAppStack = WebAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YWNrLWZ1bGwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3ZWJhcHAtc3RhY2stZnVsbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUVuQywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyx1RUFBeUQ7QUFDekQsNEVBQThEO0FBQzlELDJEQUE2QztBQU03Qzs7R0FFRztBQUNILE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3hDLHNCQUFzQjtJQUNOLGNBQWMsQ0FBa0I7SUFFaEQsMEJBQTBCO0lBQ1YsV0FBVyxDQUFxQjtJQUVoRCw4QkFBOEI7SUFDZCxZQUFZLENBQTBCO0lBRXRELHFCQUFxQjtJQUNMLGFBQWEsQ0FBaUI7SUFFOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsV0FBVyxJQUFJLHNCQUFzQixDQUFDO1FBQ2pHLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxXQUFXLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxXQUFXLElBQUksTUFBTSxDQUFDO1FBQy9FLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsWUFBWSxJQUFJLGFBQWEsQ0FBQztRQUVsRSxPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDOUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxV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QUFDO1FBRUgsT0FBTztRQUNQLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDMUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM5QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7UUFDdkQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztRQUUzQyxPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBL0pELGtDQStKQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2ViQXBwU3RhY2sgLSBMYW1iZGEgV2ViIEFkYXB0ZXIgKyBOZXh0LmpzICsgQ2xvdWRGcm9udOe1seWQiOOCueOCv+ODg+OCr1xuICogXG4gKiDmqZ/og706XG4gKiAtIExhbWJkYSBGdW5jdGlvbiAoQ29udGFpbmVyKSB3aXRoIFdlYiBBZGFwdGVyXG4gKiAtIExhbWJkYSBGdW5jdGlvbiBVUkxcbiAqIC0gQ2xvdWRGcm9udCBEaXN0cmlidXRpb25cbiAqIC0gRUNSIFJlcG9zaXRvcnlcbiAqIC0gSUFNIFJvbGVzIGFuZCBQZXJtaXNzaW9uc1xuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGVjciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdlYkFwcFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGNvbmZpZzogYW55OyAvLyDntbHlkIjoqK3lrprjgqrjg5bjgrjjgqfjgq/jg4hcbn1cblxuLyoqXG4gKiBXZWJBcHBTdGFjayAtIOODleODq+Wun+ijheeJiFxuICovXG5leHBvcnQgY2xhc3MgV2ViQXBwU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAvKiogTGFtYmRhIEZ1bmN0aW9uICovXG4gIHB1YmxpYyByZWFkb25seSB3ZWJBcHBGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBcbiAgLyoqIExhbWJkYSBGdW5jdGlvbiBVUkwgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZ1bmN0aW9uVXJsOiBsYW1iZGEuRnVuY3Rpb25Vcmw7XG4gIFxuICAvKiogQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gKi9cbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIFxuICAvKiogRUNSIFJlcG9zaXRvcnkgKi9cbiAgcHVibGljIHJlYWRvbmx5IGVjclJlcG9zaXRvcnk6IGVjci5SZXBvc2l0b3J5O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBXZWJBcHBTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IGNvbmZpZyB9ID0gcHJvcHM7XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb25maWcucHJvamVjdD8ubmFtZSB8fCBjb25maWcubmFtaW5nPy5wcm9qZWN0TmFtZSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWcnO1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0gY29uZmlnLmVudmlyb25tZW50IHx8IGNvbmZpZy5uYW1pbmc/LmVudmlyb25tZW50IHx8ICdwcm9kJztcbiAgICBjb25zdCByZWdpb25QcmVmaXggPSBjb25maWcubmFtaW5nPy5yZWdpb25QcmVmaXggfHwgJ1Rva3lvUmVnaW9uJztcblxuICAgIGNvbnNvbGUubG9nKCfwn5qAIFdlYkFwcFN0YWNrIChGdWxsKSDliJ3mnJ/ljJbplovlp4suLi4nKTtcbiAgICBjb25zb2xlLmxvZyhgICAg44OX44Ot44K444Kn44Kv44OI5ZCNOiAke3Byb2plY3ROYW1lfWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDnkrDlooM6ICR7ZW52aXJvbm1lbnR9YCk7XG4gICAgY29uc29sZS5sb2coYCAgIOODquODvOOCuOODp+ODs+ODl+ODrOODleOCo+ODg+OCr+OCuTogJHtyZWdpb25QcmVmaXh9YCk7XG5cbiAgICAvLyBFQ1IgUmVwb3NpdG9yeVxuICAgIHRoaXMuZWNyUmVwb3NpdG9yeSA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnV2ViQXBwUmVwb3NpdG9yeScsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBgJHtyZWdpb25QcmVmaXgudG9Mb3dlckNhc2UoKX0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0td2ViYXBwLXJlcG9gLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnS2VlcCBsYXN0IDEwIGltYWdlcycsXG4gICAgICAgICAgbWF4SW1hZ2VDb3VudDogMTAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIEV4ZWN1dGlvbiBSb2xlXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1MYW1iZGEtUm9sZWAsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBCZWRyb2NrIGFjY2Vzc1xuICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEZvdW5kYXRpb25Nb2RlbHMnLFxuICAgICAgICAnYmVkcm9jazpHZXRGb3VuZGF0aW9uTW9kZWwnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gQmVkcm9jayBBZ2VudCBhY2Nlc3NcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlQWdlbnQnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gRHluYW1vREIgYWNjZXNzIChpZiBuZWVkZWQpXG4gICAgaWYgKGNvbmZpZy5kYXRhYmFzZT8uZHluYW1vZGIpIHtcbiAgICAgIGxhbWJkYVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6RGVsZXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sIC8vIFRPRE86IFNjb3BlIHRvIHNwZWNpZmljIHRhYmxlc1xuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYSBGdW5jdGlvblxuICAgIHRoaXMud2ViQXBwRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdXZWJBcHBGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHAtRnVuY3Rpb25gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuRlJPTV9JTUFHRSxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21FY3JJbWFnZSh0aGlzLmVjclJlcG9zaXRvcnksIHtcbiAgICAgICAgdGFnT3JEaWdlc3Q6ICdsYXRlc3QnLFxuICAgICAgfSksXG4gICAgICBoYW5kbGVyOiBsYW1iZGEuSGFuZGxlci5GUk9NX0lNQUdFLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5jb21wdXRlPy5sYW1iZGE/LnRpbWVvdXQgfHwgMzApLFxuICAgICAgbWVtb3J5U2l6ZTogY29uZmlnLmNvbXB1dGU/LmxhbWJkYT8ubWVtb3J5U2l6ZSB8fCA1MTIsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgICBCRURST0NLX1JFR0lPTjogY29uZmlnLmFpPy5iZWRyb2NrPy5yZWdpb24gfHwgJ3VzLWVhc3QtMScsXG4gICAgICAgIEFXU19MV0FfSU5WT0tFX01PREU6ICdyZXNwb25zZV9zdHJlYW0nLFxuICAgICAgICBBV1NfTFdBX1BPUlQ6ICczMDAwJyxcbiAgICAgICAgUlVTVF9MT0c6ICdpbmZvJyxcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbiBVUkxcbiAgICB0aGlzLmZ1bmN0aW9uVXJsID0gdGhpcy53ZWJBcHBGdW5jdGlvbi5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgIH0sXG4gICAgICBpbnZva2VNb2RlOiBsYW1iZGEuSW52b2tlTW9kZS5CVUZGRVJFRCxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ1dlYkFwcERpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGNvbW1lbnQ6IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwLURpc3RyaWJ1dGlvbmAsXG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGNkay5Gbi5zZWxlY3QoMiwgY2RrLkZuLnNwbGl0KCcvJywgdGhpcy5mdW5jdGlvblVybC51cmwpKSksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRCxcbiAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUixcbiAgICAgIH0sXG4gICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMjAwLFxuICAgICAgZW5hYmxlTG9nZ2luZzogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Z1bmN0aW9uVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuZnVuY3Rpb25VcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgRnVuY3Rpb24gVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1GdW5jdGlvblVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1DbG91ZEZyb250VXJsYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFQ1JSZXBvc2l0b3J5VXJpJywge1xuICAgICAgdmFsdWU6IHRoaXMuZWNyUmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpLFxuICAgICAgZGVzY3JpcHRpb246ICdFQ1IgUmVwb3NpdG9yeSBVUkknLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVDUlJlcG9zaXRvcnlVcmlgLFxuICAgIH0pO1xuXG4gICAgLy8gVGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTW9kdWxlJywgJ1dlYkFwcCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRnJhbWV3b3JrJywgJ05leHQuanMnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0FkYXB0ZXInLCAnTGFtYmRhIFdlYiBBZGFwdGVyJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDRE4nLCAnQ2xvdWRGcm9udCcpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBXZWJBcHBTdGFjayAoRnVsbCkg5Yid5pyf5YyW5a6M5LqGJyk7XG4gIH1cbn1cbiJdfQ==