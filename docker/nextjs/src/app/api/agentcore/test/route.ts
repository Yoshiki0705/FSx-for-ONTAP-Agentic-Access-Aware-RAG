/**
 * AgentCore統合テスト用API（認証なし）
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // A development aid; not served by a deployment.
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    status: 'healthy',
    service: 'AgentCore Integration Test API',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      lambdaDirectInvoke: true,
      apiGatewayDisabled: true,
      dynamodbIntegration: true,
      eventBridgeIntegration: true
    }
  });
}

export async function POST(request: NextRequest) {
  // A development aid; not served by a deployment.
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await request.json();
    
    // AgentCore統合のシミュレーション
    const response = {
      success: true,
      message: 'AgentCore Integration Test Successful',
      input: body,
      timestamp: new Date().toISOString(),
      source: 'test-api',
      capabilities: [
        'Lambda Direct Invocation',
        'DynamoDB Settings Storage',
        'EventBridge Integration',
        'CloudWatch Monitoring'
      ]
    };

    return NextResponse.json(response);

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}