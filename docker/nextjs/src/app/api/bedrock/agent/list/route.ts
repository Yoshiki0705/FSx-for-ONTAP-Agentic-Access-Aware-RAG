import { NextResponse } from 'next/server';
import { BedrockAgentClient, ListAgentsCommand } from '@aws-sdk/client-bedrock-agent';

// AWS設定
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// Bedrock Agentクライアント初期化
const bedrockAgentClient = new BedrockAgentClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken: process.env.AWS_SESSION_TOKEN
  }
});

export async function GET() {
  try {
    console.log('📋 [Agent List API] Agent一覧取得開始');
    
    // Agent一覧取得
    const command = new ListAgentsCommand({
      maxResults: 50
    });
    
    const response = await bedrockAgentClient.send(command);
    
    if (response.agentSummaries) {
      const agents = response.agentSummaries.map(agent => ({
        id: agent.agentId,
        name: agent.agentName,
        description: agent.description,
        status: agent.agentStatus
      }));

      console.log(`✅ [Agent List API] ${agents.length}個のAgentを取得`);
      
      return NextResponse.json({
        success: true,
        agents: agents,
        region: AWS_REGION,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('⚠️ [Agent List API] Agent一覧が空');
      return NextResponse.json({
        success: true,
        agents: [],
        region: AWS_REGION,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ [Agent List API] エラー:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}