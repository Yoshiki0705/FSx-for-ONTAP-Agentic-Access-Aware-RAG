/**
 * Bedrock Agent CDKリソース作成プロパティテスト
 * 
 * **Feature: bedrock-agent-dynamic-model-selection, Property 1: CDKデプロイ後のリソース存在確認**
 * **Validates: Requirements 1.1**
 * 
 * このテストは、CDKデプロイ後に以下のリソースが正しく作成されていることを確認します：
 * - Bedrock Agent
 * - Agent Service Role
 * - Agent Alias
 * - CloudFormation Outputs
 */

import { 
  BedrockAgentClient, 
  GetAgentCommand, 
  GetAgentAliasCommand 
} from '@aws-sdk/client-bedrock-agent';
import { 
  IAMClient, 
  GetRoleCommand 
} from '@aws-sdk/client-iam';
import { 
  CloudFormationClient, 
  DescribeStacksCommand 
} from '@aws-sdk/client-cloudformation';

// テスト設定
const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const STACK_NAME = process.env.STACK_NAME || 'WebAppStack';

// AWSクライアント
const bedrockAgentClient = new BedrockAgentClient({ region: REGION });
const iamClient = new IAMClient({ region: REGION });
const cloudFormationClient = new CloudFormationClient({ region: REGION });

/**
 * CloudFormation Outputsから値を取得
 */
async function getStackOutput(outputKey: string): Promise<string | undefined> {
  const command = new DescribeStacksCommand({
    StackName: STACK_NAME,
  });
  
  const response = await cloudFormationClient.send(command);
  const stack = response.Stacks?.[0];
  
  if (!stack || !stack.Outputs) {
    throw new Error(`Stack ${STACK_NAME} not found or has no outputs`);
  }
  
  const output = stack.Outputs.find(o => o.OutputKey === outputKey);
  return output?.OutputValue;
}

describe('Bedrock Agent CDKリソース作成プロパティテスト', () => {
  let agentId: string;
  let agentAliasId: string;
  let serviceRoleArn: string;

  beforeAll(async () => {
    // CloudFormation Outputsから値を取得
    agentId = await getStackOutput('BedrockAgentId') || '';
    agentAliasId = await getStackOutput('BedrockAgentAliasId') || '';
    serviceRoleArn = await getStackOutput('BedrockAgentServiceRoleArn') || '';
    
    console.log('テスト設定:');
    console.log(`  Agent ID: ${agentId}`);
    console.log(`  Agent Alias ID: ${agentAliasId}`);
    console.log(`  Service Role ARN: ${serviceRoleArn}`);
  });

  /**
   * Property 1: CDKデプロイ後のBedrock Agent存在確認
   * 
   * For any CDKデプロイ、Bedrock Agentが正しく作成されていること
   */
  test('Property 1: Bedrock Agentが存在すること', async () => {
    expect(agentId).toBeTruthy();
    expect(agentId).not.toBe('');
    
    const command = new GetAgentCommand({
      agentId: agentId,
    });
    
    const response = await bedrockAgentClient.send(command);
    
    // Agentが存在すること
    expect(response.agent).toBeDefined();
    expect(response.agent?.agentId).toBe(agentId);
    
    // Agentのステータスが有効であること
    expect(['PREPARED', 'CREATING', 'UPDATING']).toContain(response.agent?.agentStatus);
    
    // Foundation Modelが設定されていること
    expect(response.agent?.foundationModel).toBeTruthy();
    
    // Service Roleが設定されていること
    expect(response.agent?.agentResourceRoleArn).toBeTruthy();
    
    // Instructionが設定されていること
    expect(response.agent?.instruction).toBeTruthy();
    expect(response.agent?.instruction).toContain('権限認識型RAG');
    
    // Idle Session TTLが設定されていること
    expect(response.agent?.idleSessionTTLInSeconds).toBe(600);
  }, 30000); // タイムアウト: 30秒

  /**
   * Property 1: CDKデプロイ後のAgent Alias存在確認
   * 
   * For any CDKデプロイ、Agent Aliasが正しく作成されていること
   */
  test('Property 1: Agent Aliasが存在すること', async () => {
    expect(agentId).toBeTruthy();
    expect(agentAliasId).toBeTruthy();
    expect(agentAliasId).not.toBe('');
    
    const command = new GetAgentAliasCommand({
      agentId: agentId,
      agentAliasId: agentAliasId,
    });
    
    const response = await bedrockAgentClient.send(command);
    
    // Agent Aliasが存在すること
    expect(response.agentAlias).toBeDefined();
    expect(response.agentAlias?.agentAliasId).toBe(agentAliasId);
    
    // Agent Alias名が設定されていること
    expect(response.agentAlias?.agentAliasName).toBe('dev-alias');
    
    // Agent IDが一致すること
    expect(response.agentAlias?.agentId).toBe(agentId);
  }, 30000); // タイムアウト: 30秒

  /**
   * Property 1: CDKデプロイ後のService Role存在確認
   * 
   * For any CDKデプロイ、Agent Service Roleが正しく作成されていること
   */
  test('Property 1: Agent Service Roleが存在すること', async () => {
    expect(serviceRoleArn).toBeTruthy();
    expect(serviceRoleArn).not.toBe('');
    
    // ARNからRole名を抽出
    const roleName = serviceRoleArn.split('/').pop();
    expect(roleName).toBeTruthy();
    
    const command = new GetRoleCommand({
      RoleName: roleName,
    });
    
    const response = await iamClient.send(command);
    
    // Roleが存在すること
    expect(response.Role).toBeDefined();
    expect(response.Role?.Arn).toBe(serviceRoleArn);
    
    // Trust Policyにbedrock.amazonaws.comが含まれていること
    const assumeRolePolicy = JSON.parse(
      decodeURIComponent(response.Role?.AssumeRolePolicyDocument || '{}')
    );
    
    const bedrockPrincipal = assumeRolePolicy.Statement?.find(
      (stmt: any) => stmt.Principal?.Service === 'bedrock.amazonaws.com'
    );
    
    expect(bedrockPrincipal).toBeDefined();
  }, 30000); // タイムアウト: 30秒

  /**
   * Property 1: CDKデプロイ後のCloudFormation Outputs確認
   * 
   * For any CDKデプロイ、必要なOutputsが全て設定されていること
   */
  test('Property 1: CloudFormation Outputsが全て設定されていること', async () => {
    const requiredOutputs = [
      'BedrockAgentId',
      'BedrockAgentArn',
      'BedrockAgentAliasId',
      'BedrockAgentAliasArn',
      'BedrockAgentServiceRoleArn',
    ];
    
    for (const outputKey of requiredOutputs) {
      const outputValue = await getStackOutput(outputKey);
      
      // Outputが存在すること
      expect(outputValue).toBeTruthy();
      expect(outputValue).not.toBe('');
      
      console.log(`  ✅ ${outputKey}: ${outputValue}`);
    }
  }, 30000); // タイムアウト: 30秒
});
