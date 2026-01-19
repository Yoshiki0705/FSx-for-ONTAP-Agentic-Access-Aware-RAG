#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BedrockAgentCoreRuntimeConstruct } from '../lib/modules/ai/constructs/bedrock-agent-core-runtime-construct';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'TokyoRegion-permission-aware-rag-prod-AgentCore-Runtime', {
  env: {
    account: '178625946981',
    region: 'ap-northeast-1',
  },
  description: 'AgentCore Runtime Lambda Function Only',
});

// Runtime Construct
const runtime = new BedrockAgentCoreRuntimeConstruct(stack, 'AgentCoreRuntime', {
  functionName: 'TokyoRegion-permission-aware-rag-prod-AgentCoreRuntime',
  description: 'Bedrock Agent Core Runtime Function',
});

// Outputs
new cdk.CfnOutput(stack, 'RuntimeFunctionArn', {
  value: runtime.lambdaFunction.functionArn,
  description: 'AgentCore Runtime Lambda Function ARN',
});

new cdk.CfnOutput(stack, 'RuntimeFunctionName', {
  value: runtime.lambdaFunction.functionName,
  description: 'AgentCore Runtime Lambda Function Name',
});

app.synth();
