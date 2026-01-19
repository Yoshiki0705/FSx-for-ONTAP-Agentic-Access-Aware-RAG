#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BedrockAgentCoreRuntimeConstruct } from '../lib/modules/ai/constructs/bedrock-agent-core-runtime-construct';
import { BedrockAgentCoreGatewayConstruct } from '../lib/modules/ai/constructs/bedrock-agent-core-gateway-construct';
import { BedrockAgentCoreMemoryConstruct } from '../lib/modules/ai/constructs/bedrock-agent-core-memory-construct';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'TokyoRegion-permission-aware-rag-prod-AgentCore-Lambda', {
  env: {
    account: '178625946981',
    region: 'ap-northeast-1',
  },
  description: 'AgentCore Lambda Functions Only',
});

// Runtime Construct
const runtime = new BedrockAgentCoreRuntimeConstruct(stack, 'AgentCoreRuntime', {
  functionName: 'TokyoRegion-permission-aware-rag-prod-AgentCoreRuntime',
  description: 'Bedrock Agent Core Runtime Function',
});

// Gateway Construct（機能を無効化してデプロイ）
const gateway = new BedrockAgentCoreGatewayConstruct(stack, 'AgentCoreGateway', {
  projectName: 'permission-aware-rag',
  environment: 'prod',
  // 全ての機能を無効化（リソースが未提供のため）
  // restApiConversion: undefined,  // gatewaySpecsBucketが未提供
  // lambdaFunctionConversion: undefined,  // functionArnsが空
  // mcpServerIntegration: undefined,  // serverEndpointのみでは不十分
});

// Memory Construct
const memory = new BedrockAgentCoreMemoryConstruct(stack, 'AgentCoreMemory', {});

// Outputs
new cdk.CfnOutput(stack, 'RuntimeFunctionArn', {
  value: runtime.lambdaFunction.functionArn,
  description: 'AgentCore Runtime Lambda Function ARN',
});

if (gateway.restApiConverterFunction) {
  new cdk.CfnOutput(stack, 'GatewayRestApiConverterArn', {
    value: gateway.restApiConverterFunction.functionArn,
    description: 'AgentCore Gateway REST API Converter ARN',
  });
}

if (gateway.lambdaConverterFunction) {
  new cdk.CfnOutput(stack, 'GatewayLambdaConverterArn', {
    value: gateway.lambdaConverterFunction.functionArn,
    description: 'AgentCore Gateway Lambda Converter ARN',
  });
}

if (gateway.mcpIntegrationFunction) {
  new cdk.CfnOutput(stack, 'GatewayMcpIntegrationArn', {
    value: gateway.mcpIntegrationFunction.functionArn,
    description: 'AgentCore Gateway MCP Integration ARN',
  });
}

app.synth();
