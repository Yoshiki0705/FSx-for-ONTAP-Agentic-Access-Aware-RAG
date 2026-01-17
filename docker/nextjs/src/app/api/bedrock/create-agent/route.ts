import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentClient, CreateAgentCommand, CreateAgentAliasCommand } from '@aws-sdk/client-bedrock-agent';

/**
 * Bedrock Agent作成API
 * 
 * POST /api/bedrock/create-agent
 * 
 * 新しいBedrock Agentを作成し、必要な設定を行います
 * - Agent作成
 * - Alias作成
 * - Knowledge Base関連付け（オプション）
 * 
 * Requirements: 28.1, 28.4
 */

interface CreateAgentRequest {
  name: string;
  description: string;
  foundationModel: string;
  knowledgeBaseIds?: string[];
  actionGroups?: ActionGroupConfig[];
  instructions: string;
  region: string;
}

interface ActionGroupConfig {
  name: string;
  description: string;
  functionSchema?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateAgentRequest = await request.json();
    
    // バリデーション
    if (!body.name || body.name.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Agent名は3文字以上で入力してください'
      }, { status: 400 });
    }

    if (!body.description || body.description.trim().length < 10) {
      return NextResponse.json({
        success: false,
        error: '説明は10文字以上で入力してください'
      }, { status: 400 });
    }

    if (!body.foundationModel) {
      return NextResponse.json({
        success: false,
        error: 'Foundation Modelを選択してください'
      }, { status: 400 });
    }

    if (!body.region) {
      return NextResponse.json({
        success: false,
        error: 'リージョンが指定されていません'
      }, { status: 400 });
    }

    // Bedrock Agentクライアント初期化
    const bedrockAgentClient = new BedrockAgentClient({
      region: body.region,
    });

    console.log('🚀 [CreateAgent] Agent作成開始:', {
      name: body.name,
      region: body.region,
      foundationModel: body.foundationModel
    });

    // Step 1: Agent作成
    const createAgentCommand = new CreateAgentCommand({
      agentName: body.name,
      description: body.description,
      foundationModel: body.foundationModel,
      instruction: body.instructions,
      idleSessionTTLInSeconds: 1800, // 30分
      agentResourceRoleArn: await getOrCreateAgentRole(body.region),
    });

    const createAgentResponse = await bedrockAgentClient.send(createAgentCommand);
    
    if (!createAgentResponse.agent?.agentId) {
      throw new Error('Agent作成に失敗しました: Agent IDが取得できませんでした');
    }

    const agentId = createAgentResponse.agent.agentId;
    console.log('✅ [CreateAgent] Agent作成成功:', agentId);

    // Step 2: Agent Alias作成
    const createAliasCommand = new CreateAgentAliasCommand({
      agentId: agentId,
      agentAliasName: 'DRAFT',
      description: `${body.name}のDRAFTエイリアス`,
    });

    const createAliasResponse = await bedrockAgentClient.send(createAliasCommand);
    const aliasId = createAliasResponse.agentAlias?.agentAliasId;
    
    console.log('✅ [CreateAgent] Alias作成成功:', aliasId);

    // Step 3: Knowledge Base関連付け（オプション）
    if (body.knowledgeBaseIds && body.knowledgeBaseIds.length > 0) {
      console.log('🔗 [CreateAgent] Knowledge Base関連付け:', body.knowledgeBaseIds);
      // TODO: Knowledge Base関連付けの実装
      // AssociateAgentKnowledgeBaseCommand を使用
    }

    // Step 4: Action Groups設定（オプション）
    if (body.actionGroups && body.actionGroups.length > 0) {
      console.log('⚡ [CreateAgent] Action Groups設定:', body.actionGroups.length);
      // TODO: Action Groups設定の実装
      // CreateAgentActionGroupCommand を使用
    }

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      message: 'Agentが正常に作成されました',
      agentId: agentId,
      aliasId: aliasId,
      data: {
        agent: {
          agentId: agentId,
          agentName: body.name,
          description: body.description,
          foundationModel: body.foundationModel,
          agentStatus: createAgentResponse.agent.agentStatus,
          createdAt: createAgentResponse.agent.createdAt,
        },
        alias: {
          agentAliasId: aliasId,
          agentAliasName: 'DRAFT',
          agentAliasStatus: createAliasResponse.agentAlias?.agentAliasStatus,
        }
      }
    });

  } catch (error) {
    console.error('❌ [CreateAgent] Agent作成エラー:', error);
    
    // エラーレスポンス
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Agent作成に失敗しました',
      details: {
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }, { status: 500 });
  }
}

/**
 * Agent用のIAMロールを取得または作成
 * 
 * @param region - AWSリージョン
 * @returns IAMロールARN
 */
async function getOrCreateAgentRole(region: string): Promise<string> {
  const { IAMClient, GetRoleCommand, CreateRoleCommand, AttachRolePolicyCommand } = await import('@aws-sdk/client-iam');
  
  const accountId = process.env.AWS_ACCOUNT_ID || '178625946981'; // 実際のアカウントID
  const roleName = 'TokyoRegion-permission-aware-rag-prod-Agent-Service-Role';
  const roleArn = `arn:aws:iam::${accountId}:role/${roleName}`;
  
  const iamClient = new IAMClient({ region });
  
  try {
    // 既存ロールの確認
    await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    console.log(`✅ 既存のAgent Service Roleを使用: ${roleArn}`);
    return roleArn;
  } catch (error: any) {
    if (error.name === 'NoSuchEntityException') {
      console.log('🔧 Agent Service Roleが存在しないため、新規作成します...');
      
      // 信頼ポリシー（Bedrockサービスがこのロールを引き受けることを許可）
      const trustPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'bedrock.amazonaws.com'
            },
            Action: 'sts:AssumeRole',
            Condition: {
              StringEquals: {
                'aws:SourceAccount': accountId
              }
            }
          }
        ]
      };
      
      // ロール作成
      await iamClient.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description: 'Service role for Bedrock Agent - Permission-aware RAG System',
        Tags: [
          { Key: 'Project', Value: 'permission-aware-rag' },
          { Key: 'Environment', Value: 'prod' },
          { Key: 'Purpose', Value: 'BedrockAgent' },
          { Key: 'CreatedBy', Value: 'AgentCreationWizard' },
        ]
      }));
      
      // 必要なポリシーをアタッチ
      const policies = [
        'arn:aws:iam::aws:policy/AmazonBedrockFullAccess', // Bedrock基本権限
      ];
      
      for (const policyArn of policies) {
        await iamClient.send(new AttachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: policyArn
        }));
      }
      
      console.log(`✅ Agent Service Role作成完了: ${roleArn}`);
      
      // ロール作成後、少し待機（IAMの整合性のため）
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return roleArn;
    } else {
      console.error('❌ Agent Service Role確認エラー:', error);
      throw new Error(`Agent Service Role確認に失敗しました: ${error.message}`);
    }
  }
}

/**
 * GET /api/bedrock/create-agent
 * 
 * Agent作成に必要な情報を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'ap-northeast-1';

    // 利用可能なFoundation Modelリストを取得
    // 実際の実装では、BedrockClientを使用してモデルリストを取得
    
    return NextResponse.json({
      success: true,
      data: {
        supportedRegions: [
          'ap-northeast-1',
          'us-east-1',
          'us-west-2',
          'eu-west-1',
          'eu-central-1'
        ],
        defaultInstructions: 'あなたは親切で知識豊富なAIアシスタントです。ユーザーの質問に正確で有用な回答を提供してください。',
        limits: {
          maxNameLength: 100,
          maxDescriptionLength: 500,
          maxInstructionsLength: 4000,
          maxKnowledgeBases: 10,
          maxActionGroups: 5
        }
      }
    });

  } catch (error) {
    console.error('❌ [CreateAgent] 設定取得エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '設定取得に失敗しました'
    }, { status: 500 });
  }
}