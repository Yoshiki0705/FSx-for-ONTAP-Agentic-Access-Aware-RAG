#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { BedrockAgentCoreGatewayConstruct } from '../lib/modules/ai/constructs/bedrock-agent-core-gateway-construct';
import { BedrockAgentCoreMemoryConstruct } from '../lib/modules/ai/constructs/bedrock-agent-core-memory-construct';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'TokyoRegion-permission-aware-rag-prod-AgentCore-Gateway', {
  env: {
    account: '178625946981',
    region: 'ap-northeast-1',
  },
  description: 'AgentCore Gateway with Full Lambda Functions',
});

// Create S3 bucket for OpenAPI specs
const gatewaySpecsBucket = new s3.Bucket(stack, 'GatewaySpecsBucket', {
  bucketName: `permission-aware-rag-prod-gateway-specs-${stack.account}`,
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  versioned: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  lifecycleRules: [
    {
      id: 'DeleteOldVersions',
      enabled: true,
      noncurrentVersionExpiration: cdk.Duration.days(30),
    },
  ],
});

// Gateway Construct with all features enabled
const gateway = new BedrockAgentCoreGatewayConstruct(stack, 'AgentCoreGateway', {
  projectName: 'permission-aware-rag',
  environment: 'prod',
  
  // S3 bucket for OpenAPI specs
  gatewaySpecsBucket: gatewaySpecsBucket,
  
  // REST API Conversion (enabled with sample spec)
  restApiConversion: {
    openApiSpecKey: 'openapi/sample-api.yaml',
    conversionOptions: {
      autoGenerateToolDefinitions: true,
      toolNamePrefix: 'api_',
    },
  },
  
  // Lambda Function Conversion (enabled with existing Lambda functions)
  lambdaFunctionConversion: {
    functionArns: [
      'arn:aws:lambda:ap-northeast-1:178625946981:function:TokyoRegion-permission-aware-rag-prod-AgentCoreRuntime',
      'arn:aws:lambda:ap-northeast-1:178625946981:function:TokyoRegion-permission-aware-rag-prod-AgentCore-V2',
    ],
    metadataSource: {
      useTags: true,
      useEnvironmentVariables: true,
    },
    conversionOptions: {
      autoGenerateToolDefinitions: true,
      toolNamePrefix: 'lambda_',
      timeout: 30,
    },
  },
  
  // MCP Server Integration (enabled with test endpoint)
  mcpServerIntegration: {
    serverEndpoint: 'wss://mcp-test.example.com/v1',  // Test endpoint
    authentication: {
      type: 'NONE',  // No authentication for testing
    },
    webSocketConfig: {
      connectionTimeout: 30,
      reconnectConfig: {
        maxRetries: 3,
        retryInterval: 1000,
      },
    },
    conversionOptions: {
      autoGenerateToolDefinitions: true,
      toolNamePrefix: 'mcp_',
    },
  },
});

// Memory Construct
const memory = new BedrockAgentCoreMemoryConstruct(stack, 'AgentCoreMemory', {});

// Outputs
new cdk.CfnOutput(stack, 'GatewaySpecsBucketName', {
  value: gatewaySpecsBucket.bucketName,
  description: 'S3 bucket for OpenAPI specifications',
  exportName: 'AgentCoreGatewaySpecsBucket',
});

if (gateway.restApiConverterFunction) {
  new cdk.CfnOutput(stack, 'GatewayRestApiConverterArn', {
    value: gateway.restApiConverterFunction.functionArn,
    description: 'AgentCore Gateway REST API Converter ARN',
    exportName: 'AgentCoreGatewayRestApiConverterArn',
  });
}

if (gateway.lambdaConverterFunction) {
  new cdk.CfnOutput(stack, 'GatewayLambdaConverterArn', {
    value: gateway.lambdaConverterFunction.functionArn,
    description: 'AgentCore Gateway Lambda Converter ARN',
    exportName: 'AgentCoreGatewayLambdaConverterArn',
  });
}

if (gateway.mcpIntegrationFunction) {
  new cdk.CfnOutput(stack, 'GatewayMcpIntegrationArn', {
    value: gateway.mcpIntegrationFunction.functionArn,
    description: 'AgentCore Gateway MCP Integration ARN',
    exportName: 'AgentCoreGatewayMcpIntegrationArn',
  });
}

app.synth();
