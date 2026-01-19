"use strict";
/**
 * WebApp Stack
 * API・フロントエンド統合スタック
 *
 * 統合機能:
 * - REST API、GraphQL、WebSocket、Next.js フロントエンド
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
const aws_cdk_lib_1 = require("aws-cdk-lib");
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
class WebAppStack extends aws_cdk_lib_1.Stack {
    restApi;
    webAppBucket;
    distribution;
    apiUrl;
    webAppUrl;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        // Create REST API
        if (config.features.api.restApi) {
            this.createRestApi(config, props);
        }
        // Create Frontend hosting
        if (config.features.api.frontend) {
            this.createFrontendHosting(config);
        }
        // Add outputs
        if (this.apiUrl) {
            new aws_cdk_lib_1.CfnOutput(this, 'ApiUrl', {
                value: this.apiUrl,
                description: 'API Gateway URL'
            });
        }
        if (this.webAppUrl) {
            new aws_cdk_lib_1.CfnOutput(this, 'WebAppUrl', {
                value: this.webAppUrl,
                description: 'Web Application URL'
            });
        }
    }
    createRestApi(config, props) {
        // Create API Gateway
        this.restApi = new apigateway.RestApi(this, 'RagApi', {
            restApiName: `${config.projectName}-api-${config.environment}`,
            description: 'RAG System API',
            defaultCorsPreflightOptions: {
                allowOrigins: config.environment === 'prod'
                    ? [`https://${config.features.networking.customDomain}`]
                    : apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
            },
            deployOptions: {
                stageName: config.environment
            }
        });
        // Create Cognito Authorizer if user pool is provided
        let authorizer;
        if (props.userPool) {
            authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
                cognitoUserPools: [props.userPool],
                authorizerName: 'CognitoAuthorizer'
            });
        }
        // Documents API endpoints
        const documentsResource = this.restApi.root.addResource('documents');
        // POST /documents - Upload document
        if (props.documentProcessorFunction) {
            documentsResource.addMethod('POST', new apigateway.LambdaIntegration(props.documentProcessorFunction), {
                authorizer,
                authorizationType: authorizer ? apigateway.AuthorizationType.COGNITO : apigateway.AuthorizationType.NONE
            });
        }
        // GET /documents - List documents
        documentsResource.addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseTemplates: {
                        'application/json': JSON.stringify({
                            message: 'Documents list endpoint - implement with Lambda function',
                            documents: []
                        })
                    }
                }],
            requestTemplates: {
                'application/json': '{ "statusCode": 200 }'
            }
        }), {
            methodResponses: [{ statusCode: '200' }],
            authorizer,
            authorizationType: authorizer ? apigateway.AuthorizationType.COGNITO : apigateway.AuthorizationType.NONE
        });
        // Query API endpoints
        const queryResource = this.restApi.root.addResource('query');
        // POST /query - RAG query
        if (props.ragQueryFunction) {
            queryResource.addMethod('POST', new apigateway.LambdaIntegration(props.ragQueryFunction), {
                authorizer,
                authorizationType: authorizer ? apigateway.AuthorizationType.COGNITO : apigateway.AuthorizationType.NONE
            });
        }
        // Health check endpoint
        const healthResource = this.restApi.root.addResource('health');
        healthResource.addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseTemplates: {
                        'application/json': JSON.stringify({
                            status: 'healthy',
                            timestamp: new Date().toISOString(),
                            version: '1.0.0'
                        })
                    }
                }],
            requestTemplates: {
                'application/json': '{ "statusCode": 200 }'
            }
        }), {
            methodResponses: [{ statusCode: '200' }]
        });
        this.apiUrl = this.restApi.url;
    }
    createFrontendHosting(config) {
        // Create S3 bucket for web app hosting
        this.webAppBucket = new s3.Bucket(this, 'WebAppBucket', {
            bucketName: `${config.projectName}-webapp-${config.environment}-${config.region}`,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'error.html',
            publicReadAccess: false, // Will be accessed through CloudFront
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
        });
        // Create Origin Access Identity for CloudFront
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
            comment: `OAI for ${config.projectName} web app`
        });
        // Grant CloudFront access to S3 bucket
        this.webAppBucket.grantRead(originAccessIdentity);
        // Create CloudFront distribution
        this.distribution = new cloudfront.Distribution(this, 'WebAppDistribution', {
            comment: `${config.projectName} Web App Distribution`,
            defaultBehavior: {
                origin: new origins.S3Origin(this.webAppBucket, {
                    originAccessIdentity
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                compress: true
            },
            additionalBehaviors: this.restApi ? {
                '/api/*': {
                    origin: new origins.RestApiOrigin(this.restApi),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN
                }
            } : {},
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html'
                }
            ],
            priceClass: config.environment === 'prod'
                ? cloudfront.PriceClass.PRICE_CLASS_ALL
                : cloudfront.PriceClass.PRICE_CLASS_100
        });
        this.webAppUrl = `https://${this.distribution.distributionDomainName}`;
        // Deploy sample web app
        new s3deploy.BucketDeployment(this, 'WebAppDeployment', {
            sources: [s3deploy.Source.data('index.html', this.generateSampleWebApp(config))],
            destinationBucket: this.webAppBucket,
            distribution: this.distribution,
            distributionPaths: ['/*']
        });
    }
    generateSampleWebApp(config) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.projectName} - RAG System</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .query-section {
            margin-bottom: 30px;
        }
        .query-input {
            width: 100%;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            margin-bottom: 10px;
        }
        .query-button {
            background: #007bff;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
        }
        .query-button:hover {
            background: #0056b3;
        }
        .response-section {
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 5px;
            display: none;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 ${config.projectName}</h1>
            <p>Permission-aware RAG System with FSx for NetApp ONTAP</p>
            <p><strong>Environment:</strong> ${config.environment} | <strong>Region:</strong> ${config.region}</p>
        </div>
        
        <div class="status success">
            ✅ System is running successfully!
        </div>
        
        <div class="query-section">
            <h2>Ask a Question</h2>
            <input type="text" id="queryInput" class="query-input" placeholder="Enter your question here..." />
            <button onclick="submitQuery()" class="query-button">Submit Query</button>
        </div>
        
        <div id="responseSection" class="response-section">
            <h3>Response:</h3>
            <div id="responseContent"></div>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <h3>System Information</h3>
            <ul>
                <li><strong>API Endpoint:</strong> <span id="apiEndpoint">${this.apiUrl || 'Not configured'}</span></li>
                <li><strong>Features Enabled:</strong></li>
                <ul>
                    <li>Networking: ${config.features.networking.vpc ? '✅' : '❌'}</li>
                    <li>Security: ${config.features.security.waf ? '✅' : '❌'}</li>
                    <li>AI/RAG: ${config.features.ai.rag ? '✅' : '❌'}</li>
                    <li>Database: ${config.features.database.dynamodb ? '✅' : '❌'}</li>
                </ul>
                <li><strong>Compliance:</strong> ${config.compliance.regulations.join(', ')}</li>
            </ul>
        </div>
    </div>
    
    <script>
        async function submitQuery() {
            const query = document.getElementById('queryInput').value;
            const responseSection = document.getElementById('responseSection');
            const responseContent = document.getElementById('responseContent');
            
            if (!query.trim()) {
                alert('Please enter a question');
                return;
            }
            
            responseSection.style.display = 'block';
            responseContent.innerHTML = 'Processing your query...';
            
            try {
                // TODO: Implement actual API call when backend is ready
                // const response = await fetch('/api/query', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({ query })
                // });
                
                // Simulate response for now
                setTimeout(() => {
                    responseContent.innerHTML = \`
                        <p><strong>Query:</strong> \${query}</p>
                        <p><strong>Response:</strong> This is a sample response. The RAG system will be implemented to provide actual answers based on your documents.</p>
                        <p><strong>Status:</strong> System is ready for implementation</p>
                    \`;
                }, 1000);
                
            } catch (error) {
                responseContent.innerHTML = \`<p style="color: red;">Error: \${error.message}</p>\`;
            }
        }
        
        // Allow Enter key to submit
        document.getElementById('queryInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                submitQuery();
            }
        });
    </script>
</body>
</html>
    `;
    }
}
exports.WebAppStack = WebAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2ViYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsNkNBQTJEO0FBRTNELHVFQUF5RDtBQUd6RCx1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFVOUQsTUFBYSxXQUFZLFNBQVEsbUJBQUs7SUFDN0IsT0FBTyxDQUFzQjtJQUM3QixZQUFZLENBQWE7SUFDekIsWUFBWSxDQUEyQjtJQUN2QyxNQUFNLENBQVU7SUFDaEIsU0FBUyxDQUFVO0lBRTFCLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBdUI7UUFDL0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV6QixrQkFBa0I7UUFDbEIsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBRUQsMEJBQTBCO1FBQzFCLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDakMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLENBQUM7UUFFRCxjQUFjO1FBQ2QsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEIsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7Z0JBQzVCLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDbEIsV0FBVyxFQUFFLGlCQUFpQjthQUMvQixDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxJQUFJ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Ii8qKlxuICogV2ViQXBwIFN0YWNrXG4gKiBBUEnjg7vjg5Xjg63jg7Pjg4jjgqjjg7Pjg4nntbHlkIjjgrnjgr/jg4Pjgq9cbiAqIFxuICog57Wx5ZCI5qmf6IO9OlxuICogLSBSRVNUIEFQSeOAgUdyYXBoUUzjgIFXZWJTb2NrZXTjgIFOZXh0LmpzIOODleODreODs+ODiOOCqOODs+ODiVxuICovXG5cbmltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzLCBDZm5PdXRwdXQgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgczNkZXBsb3kgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzLWRlcGxveW1lbnQnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0IHsgR2xvYmFsUmFnQ29uZmlnIH0gZnJvbSAnLi4vLi4vdHlwZXMvZ2xvYmFsLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2ViQXBwU3RhY2tQcm9wcyBleHRlbmRzIFN0YWNrUHJvcHMge1xuICBjb25maWc6IEdsb2JhbFJhZ0NvbmZpZztcbiAgdXNlclBvb2w/OiBjb2duaXRvLklVc2VyUG9vbDtcbiAgcmFnUXVlcnlGdW5jdGlvbj86IGxhbWJkYS5JRnVuY3Rpb247XG4gIGRvY3VtZW50UHJvY2Vzc29yRnVuY3Rpb24/OiBsYW1iZGEuSUZ1bmN0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgV2ViQXBwU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIHB1YmxpYyByZXN0QXBpPzogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgd2ViQXBwQnVja2V0PzogczMuQnVja2V0O1xuICBwdWJsaWMgZGlzdHJpYnV0aW9uPzogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyBhcGlVcmw/OiBzdHJpbmc7XG4gIHB1YmxpYyB3ZWJBcHBVcmw/OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFdlYkFwcFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgY29uZmlnIH0gPSBwcm9wcztcblxuICAgIC8vIENyZWF0ZSBSRVNUIEFQSVxuICAgIGlmIChjb25maWcuZmVhdHVyZXMuYXBpLnJlc3RBcGkpIHtcbiAgICAgIHRoaXMuY3JlYXRlUmVzdEFwaShjb25maWcsIHByb3BzKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgRnJvbnRlbmQgaG9zdGluZ1xuICAgIGlmIChjb25maWcuZmVhdHVyZXMuYXBpLmZyb250ZW5kKSB7XG4gICAgICB0aGlzLmNyZWF0ZUZyb250ZW5kSG9zdGluZyhjb25maWcpO1xuICAgIH1cblxuICAgIC8vIEFkZCBvdXRwdXRzXG4gICAgaWYgKHRoaXMuYXBpVXJsKSB7XG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFwaVVybCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy53ZWJBcHBVcmwpIHtcbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1dlYkFwcFVybCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMud2ViQXBwVXJsLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1dlYiBBcHBsaWNhdGlvbiBVUkwnXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVJlc3RBcGkoY29uZmlnOiBHbG9iYWxSYWdDb25maWcsIHByb3BzOiBXZWJBcHBTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgLy8gQ3JlYXRlIEFQSSBHYXRld2F5XG4gICAgdGhpcy5yZXN0QXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUmFnQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGAke2NvbmZpZy5wcm9qZWN0TmFtZX0tYXBpLSR7Y29uZmlnLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JBRyBTeXN0ZW0gQVBJJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gW2BodHRwczovLyR7Y29uZmlnLmZlYXR1cmVzLm5ldHdvcmtpbmcuY3VzdG9tRG9tYWlufWBdXG4gICAgICAgICAgOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknLCAnWC1BbXotU2VjdXJpdHktVG9rZW4nXVxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBjb25maWcuZW52aXJvbm1lbnRcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIEF1dGhvcml6ZXIgaWYgdXNlciBwb29sIGlzIHByb3ZpZGVkXG4gICAgbGV0IGF1dGhvcml6ZXI6IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIgfCB1bmRlZmluZWQ7XG4gICAgaWYgKHByb3BzLnVzZXJQb29sKSB7XG4gICAgICBhdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgJ0FwaUF1dGhvcml6ZXInLCB7XG4gICAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFtwcm9wcy51c2VyUG9vbF0sXG4gICAgICAgIGF1dGhvcml6ZXJOYW1lOiAnQ29nbml0b0F1dGhvcml6ZXInXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBEb2N1bWVudHMgQVBJIGVuZHBvaW50c1xuICAgIGNvbnN0IGRvY3VtZW50c1Jlc291cmNlID0gdGhpcy5yZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2RvY3VtZW50cycpO1xuICAgIFxuICAgIC8vIFBPU1QgL2RvY3VtZW50cyAtIFVwbG9hZCBkb2N1bWVudFxuICAgIGlmIChwcm9wcy5kb2N1bWVudFByb2Nlc3NvckZ1bmN0aW9uKSB7XG4gICAgICBkb2N1bWVudHNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBcbiAgICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvcHMuZG9jdW1lbnRQcm9jZXNzb3JGdW5jdGlvbiksXG4gICAgICAgIHtcbiAgICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhdXRob3JpemVyID8gYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPIDogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FXG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gR0VUIC9kb2N1bWVudHMgLSBMaXN0IGRvY3VtZW50c1xuICAgIGRvY3VtZW50c1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJyxcbiAgICAgIG5ldyBhcGlnYXRld2F5Lk1vY2tJbnRlZ3JhdGlvbih7XG4gICAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbe1xuICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgIHJlc3BvbnNlVGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgbWVzc2FnZTogJ0RvY3VtZW50cyBsaXN0IGVuZHBvaW50IC0gaW1wbGVtZW50IHdpdGggTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgZG9jdW1lbnRzOiBbXVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH1dLFxuICAgICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAneyBcInN0YXR1c0NvZGVcIjogMjAwIH0nXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFt7IHN0YXR1c0NvZGU6ICcyMDAnIH1dLFxuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXV0aG9yaXplciA/IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyA6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuTk9ORVxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBRdWVyeSBBUEkgZW5kcG9pbnRzXG4gICAgY29uc3QgcXVlcnlSZXNvdXJjZSA9IHRoaXMucmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdxdWVyeScpO1xuICAgIFxuICAgIC8vIFBPU1QgL3F1ZXJ5IC0gUkFHIHF1ZXJ5XG4gICAgaWYgKHByb3BzLnJhZ1F1ZXJ5RnVuY3Rpb24pIHtcbiAgICAgIHF1ZXJ5UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJyxcbiAgICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvcHMucmFnUXVlcnlGdW5jdGlvbiksXG4gICAgICAgIHtcbiAgICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhdXRob3JpemVyID8gYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPIDogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FXG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gSGVhbHRoIGNoZWNrIGVuZHBvaW50XG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLFxuICAgICAgbmV3IGFwaWdhdGV3YXkuTW9ja0ludGVncmF0aW9uKHtcbiAgICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XG4gICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgcmVzcG9uc2VUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBzdGF0dXM6ICdoZWFsdGh5JyxcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgIHZlcnNpb246ICcxLjAuMCdcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XSxcbiAgICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xuICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IDIwMCB9J1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbeyBzdGF0dXNDb2RlOiAnMjAwJyB9XVxuICAgICAgfVxuICAgICk7XG5cbiAgICB0aGlzLmFwaVVybCA9IHRoaXMucmVzdEFwaS51cmw7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUZyb250ZW5kSG9zdGluZyhjb25maWc6IEdsb2JhbFJhZ0NvbmZpZyk6IHZvaWQge1xuICAgIC8vIENyZWF0ZSBTMyBidWNrZXQgZm9yIHdlYiBhcHAgaG9zdGluZ1xuICAgIHRoaXMud2ViQXBwQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnV2ViQXBwQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYCR7Y29uZmlnLnByb2plY3ROYW1lfS13ZWJhcHAtJHtjb25maWcuZW52aXJvbm1lbnR9LSR7Y29uZmlnLnJlZ2lvbn1gLFxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnZXJyb3IuaHRtbCcsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiBmYWxzZSwgLy8gV2lsbCBiZSBhY2Nlc3NlZCB0aHJvdWdoIENsb3VkRnJvbnRcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTExcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBPcmlnaW4gQWNjZXNzIElkZW50aXR5IGZvciBDbG91ZEZyb250XG4gICAgY29uc3Qgb3JpZ2luQWNjZXNzSWRlbnRpdHkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnT0FJJywge1xuICAgICAgY29tbWVudDogYE9BSSBmb3IgJHtjb25maWcucHJvamVjdE5hbWV9IHdlYiBhcHBgXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IGFjY2VzcyB0byBTMyBidWNrZXRcbiAgICB0aGlzLndlYkFwcEJ1Y2tldC5ncmFudFJlYWQob3JpZ2luQWNjZXNzSWRlbnRpdHkpO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ1dlYkFwcERpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGNvbW1lbnQ6IGAke2NvbmZpZy5wcm9qZWN0TmFtZX0gV2ViIEFwcCBEaXN0cmlidXRpb25gLFxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4odGhpcy53ZWJBcHBCdWNrZXQsIHtcbiAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eVxuICAgICAgICB9KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjb21wcmVzczogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHRoaXMucmVzdEFwaSA/IHtcbiAgICAgICAgJy9hcGkvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4odGhpcy5yZXN0QXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5IVFRQU19PTkxZLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5DT1JTX1MzX09SSUdJTlxuICAgICAgICB9XG4gICAgICB9IDoge30sXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICBwcmljZUNsYXNzOiBjb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgPyBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfQUxMIFxuICAgICAgICA6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDBcbiAgICB9KTtcblxuICAgIHRoaXMud2ViQXBwVXJsID0gYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWA7XG5cbiAgICAvLyBEZXBsb3kgc2FtcGxlIHdlYiBhcHBcbiAgICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnV2ViQXBwRGVwbG95bWVudCcsIHtcbiAgICAgIHNvdXJjZXM6IFtzM2RlcGxveS5Tb3VyY2UuZGF0YSgnaW5kZXguaHRtbCcsIHRoaXMuZ2VuZXJhdGVTYW1wbGVXZWJBcHAoY29uZmlnKSldLFxuICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IHRoaXMud2ViQXBwQnVja2V0LFxuICAgICAgZGlzdHJpYnV0aW9uOiB0aGlzLmRpc3RyaWJ1dGlvbixcbiAgICAgIGRpc3RyaWJ1dGlvblBhdGhzOiBbJy8qJ11cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2VuZXJhdGVTYW1wbGVXZWJBcHAoY29uZmlnOiBHbG9iYWxSYWdDb25maWcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgXG48IURPQ1RZUEUgaHRtbD5cbjxodG1sIGxhbmc9XCJlblwiPlxuPGhlYWQ+XG4gICAgPG1ldGEgY2hhcnNldD1cIlVURi04XCI+XG4gICAgPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjBcIj5cbiAgICA8dGl0bGU+JHtjb25maWcucHJvamVjdE5hbWV9IC0gUkFHIFN5c3RlbTwvdGl0bGU+XG4gICAgPHN0eWxlPlxuICAgICAgICBib2R5IHtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZjtcbiAgICAgICAgICAgIG1heC13aWR0aDogMTIwMHB4O1xuICAgICAgICAgICAgbWFyZ2luOiAwIGF1dG87XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogI2Y1ZjVmNTtcbiAgICAgICAgfVxuICAgICAgICAuY29udGFpbmVyIHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgICAgcGFkZGluZzogMzBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgfVxuICAgICAgICAuaGVhZGVyIHtcbiAgICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDMwcHg7XG4gICAgICAgIH1cbiAgICAgICAgLnF1ZXJ5LXNlY3Rpb24ge1xuICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMzBweDtcbiAgICAgICAgfVxuICAgICAgICAucXVlcnktaW5wdXQge1xuICAgICAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgICAgICBwYWRkaW5nOiAxNXB4O1xuICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgI2RkZDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMTZweDtcbiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICAgIH1cbiAgICAgICAgLnF1ZXJ5LWJ1dHRvbiB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjMDA3YmZmO1xuICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgcGFkZGluZzogMTVweCAzMHB4O1xuICAgICAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICB9XG4gICAgICAgIC5xdWVyeS1idXR0b246aG92ZXIge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogIzAwNTZiMztcbiAgICAgICAgfVxuICAgICAgICAucmVzcG9uc2Utc2VjdGlvbiB7XG4gICAgICAgICAgICBtYXJnaW4tdG9wOiAyMHB4O1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmOGY5ZmE7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xuICAgICAgICB9XG4gICAgICAgIC5zdGF0dXMge1xuICAgICAgICAgICAgcGFkZGluZzogMTBweDtcbiAgICAgICAgICAgIG1hcmdpbjogMTBweCAwO1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICB9XG4gICAgICAgIC5zdGF0dXMuc3VjY2VzcyB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAjZDRlZGRhO1xuICAgICAgICAgICAgY29sb3I6ICMxNTU3MjQ7XG4gICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCAjYzNlNmNiO1xuICAgICAgICB9XG4gICAgICAgIC5zdGF0dXMuZXJyb3Ige1xuICAgICAgICAgICAgYmFja2dyb3VuZDogI2Y4ZDdkYTtcbiAgICAgICAgICAgIGNvbG9yOiAjNzIxYzI0O1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgI2Y1YzZjYjtcbiAgICAgICAgfVxuICAgIDwvc3R5bGU+XG48L2hlYWQ+XG48Ym9keT5cbiAgICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cbiAgICAgICAgICAgIDxoMT7wn6SWICR7Y29uZmlnLnByb2plY3ROYW1lfTwvaDE+XG4gICAgICAgICAgICA8cD5QZXJtaXNzaW9uLWF3YXJlIFJBRyBTeXN0ZW0gd2l0aCBGU3ggZm9yIE5ldEFwcCBPTlRBUDwvcD5cbiAgICAgICAgICAgIDxwPjxzdHJvbmc+RW52aXJvbm1lbnQ6PC9zdHJvbmc+ICR7Y29uZmlnLmVudmlyb25tZW50fSB8IDxzdHJvbmc+UmVnaW9uOjwvc3Ryb25nPiAke2NvbmZpZy5yZWdpb259PC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0dXMgc3VjY2Vzc1wiPlxuICAgICAgICAgICAg4pyFIFN5c3RlbSBpcyBydW5uaW5nIHN1Y2Nlc3NmdWxseSFcbiAgICAgICAgPC9kaXY+XG4gICAgICAgIFxuICAgICAgICA8ZGl2IGNsYXNzPVwicXVlcnktc2VjdGlvblwiPlxuICAgICAgICAgICAgPGgyPkFzayBhIFF1ZXN0aW9uPC9oMj5cbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwicXVlcnlJbnB1dFwiIGNsYXNzPVwicXVlcnktaW5wdXRcIiBwbGFjZWhvbGRlcj1cIkVudGVyIHlvdXIgcXVlc3Rpb24gaGVyZS4uLlwiIC8+XG4gICAgICAgICAgICA8YnV0dG9uIG9uY2xpY2s9XCJzdWJtaXRRdWVyeSgpXCIgY2xhc3M9XCJxdWVyeS1idXR0b25cIj5TdWJtaXQgUXVlcnk8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIFxuICAgICAgICA8ZGl2IGlkPVwicmVzcG9uc2VTZWN0aW9uXCIgY2xhc3M9XCJyZXNwb25zZS1zZWN0aW9uXCI+XG4gICAgICAgICAgICA8aDM+UmVzcG9uc2U6PC9oMz5cbiAgICAgICAgICAgIDxkaXYgaWQ9XCJyZXNwb25zZUNvbnRlbnRcIj48L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIFxuICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogMzBweDsgcGFkZGluZy10b3A6IDIwcHg7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjZGRkO1wiPlxuICAgICAgICAgICAgPGgzPlN5c3RlbSBJbmZvcm1hdGlvbjwvaDM+XG4gICAgICAgICAgICA8dWw+XG4gICAgICAgICAgICAgICAgPGxpPjxzdHJvbmc+QVBJIEVuZHBvaW50Ojwvc3Ryb25nPiA8c3BhbiBpZD1cImFwaUVuZHBvaW50XCI+JHt0aGlzLmFwaVVybCB8fCAnTm90IGNvbmZpZ3VyZWQnfTwvc3Bhbj48L2xpPlxuICAgICAgICAgICAgICAgIDxsaT48c3Ryb25nPkZlYXR1cmVzIEVuYWJsZWQ6PC9zdHJvbmc+PC9saT5cbiAgICAgICAgICAgICAgICA8dWw+XG4gICAgICAgICAgICAgICAgICAgIDxsaT5OZXR3b3JraW5nOiAke2NvbmZpZy5mZWF0dXJlcy5uZXR3b3JraW5nLnZwYyA/ICfinIUnIDogJ+KdjCd9PC9saT5cbiAgICAgICAgICAgICAgICAgICAgPGxpPlNlY3VyaXR5OiAke2NvbmZpZy5mZWF0dXJlcy5zZWN1cml0eS53YWYgPyAn4pyFJyA6ICfinYwnfTwvbGk+XG4gICAgICAgICAgICAgICAgICAgIDxsaT5BSS9SQUc6ICR7Y29uZmlnLmZlYXR1cmVzLmFpLnJhZyA/ICfinIUnIDogJ+KdjCd9PC9saT5cbiAgICAgICAgICAgICAgICAgICAgPGxpPkRhdGFiYXNlOiAke2NvbmZpZy5mZWF0dXJlcy5kYXRhYmFzZS5keW5hbW9kYiA/ICfinIUnIDogJ+KdjCd9PC9saT5cbiAgICAgICAgICAgICAgICA8L3VsPlxuICAgICAgICAgICAgICAgIDxsaT48c3Ryb25nPkNvbXBsaWFuY2U6PC9zdHJvbmc+ICR7Y29uZmlnLmNvbXBsaWFuY2UucmVndWxhdGlvbnMuam9pbignLCAnKX08L2xpPlxuICAgICAgICAgICAgPC91bD5cbiAgICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgXG4gICAgPHNjcmlwdD5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc3VibWl0UXVlcnkoKSB7XG4gICAgICAgICAgICBjb25zdCBxdWVyeSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWVyeUlucHV0JykudmFsdWU7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZVNlY3Rpb24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzcG9uc2VTZWN0aW9uJyk7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZUNvbnRlbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzcG9uc2VDb250ZW50Jyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghcXVlcnkudHJpbSgpKSB7XG4gICAgICAgICAgICAgICAgYWxlcnQoJ1BsZWFzZSBlbnRlciBhIHF1ZXN0aW9uJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXNwb25zZVNlY3Rpb24uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICByZXNwb25zZUNvbnRlbnQuaW5uZXJIVE1MID0gJ1Byb2Nlc3NpbmcgeW91ciBxdWVyeS4uLic7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogSW1wbGVtZW50IGFjdHVhbCBBUEkgY2FsbCB3aGVuIGJhY2tlbmQgaXMgcmVhZHlcbiAgICAgICAgICAgICAgICAvLyBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCcvYXBpL3F1ZXJ5Jywge1xuICAgICAgICAgICAgICAgIC8vICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgICAgICAvLyAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICAgICAgLy8gICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgcXVlcnkgfSlcbiAgICAgICAgICAgICAgICAvLyB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBTaW11bGF0ZSByZXNwb25zZSBmb3Igbm93XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlQ29udGVudC5pbm5lckhUTUwgPSBcXGBcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwPjxzdHJvbmc+UXVlcnk6PC9zdHJvbmc+IFxcJHtxdWVyeX08L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cD48c3Ryb25nPlJlc3BvbnNlOjwvc3Ryb25nPiBUaGlzIGlzIGEgc2FtcGxlIHJlc3BvbnNlLiBUaGUgUkFHIHN5c3RlbSB3aWxsIGJlIGltcGxlbWVudGVkIHRvIHByb3ZpZGUgYWN0dWFsIGFuc3dlcnMgYmFzZWQgb24geW91ciBkb2N1bWVudHMuPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHA+PHN0cm9uZz5TdGF0dXM6PC9zdHJvbmc+IFN5c3RlbSBpcyByZWFkeSBmb3IgaW1wbGVtZW50YXRpb248L3A+XG4gICAgICAgICAgICAgICAgICAgIFxcYDtcbiAgICAgICAgICAgICAgICB9LCAxMDAwKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2VDb250ZW50LmlubmVySFRNTCA9IFxcYDxwIHN0eWxlPVwiY29sb3I6IHJlZDtcIj5FcnJvcjogXFwke2Vycm9yLm1lc3NhZ2V9PC9wPlxcYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQWxsb3cgRW50ZXIga2V5IHRvIHN1Ym1pdFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVlcnlJbnB1dCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICAgICAgc3VibWl0UXVlcnkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgPC9zY3JpcHQ+XG48L2JvZHk+XG48L2h0bWw+XG4gICAgYDtcbiAgfVxufSJdfQ==