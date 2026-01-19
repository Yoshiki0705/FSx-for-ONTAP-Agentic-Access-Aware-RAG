/**
 * AgentCore AD Sync Handler
 * 
 * Active Directory SIDを自動取得し、DynamoDBに保存する
 * 
 * Features:
 * - PowerShell実行（SSM Run Command経由）
 * - SID取得・パース・保存（DynamoDB）
 * - 24時間キャッシュ（TTL）
 * - エラーハンドリング（3回リトライ）
 */

import { 
  SSMClient, 
  SendCommandCommand, 
  GetCommandInvocationCommand,
  type SendCommandCommandOutput,
  type GetCommandInvocationCommandOutput
} from '@aws-sdk/client-ssm';
import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand,
  type PutItemCommandOutput,
  type GetItemCommandOutput
} from '@aws-sdk/client-dynamodb';

// 環境変数
const AD_EC2_INSTANCE_ID = process.env.AD_EC2_INSTANCE_ID;
const IDENTITY_TABLE_NAME = process.env.IDENTITY_TABLE_NAME;
const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const SSM_TIMEOUT = parseInt(process.env.SSM_TIMEOUT || '30', 10);
const SID_CACHE_TTL = parseInt(process.env.SID_CACHE_TTL || '86400', 10); // 24時間

// クライアント初期化
const ssmClient = new SSMClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });

// 型定義
interface AdSyncEvent {
  username: string;
  userId?: string;
  forceRefresh?: boolean;
}

interface AdSyncResponse {
  success: boolean;
  data?: {
    username: string;
    sid: string;
    uid?: number;
    gid?: number;
    retrievedAt: number;
    expiresAt: number;
    cached: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface AdUserInfo {
  SID: string;
  uidNumber?: number;
  gidNumber?: number;
}

interface SsmCommandResult {
  commandId: string;
  status: 'Success' | 'Failed' | 'TimedOut' | 'Cancelled';
  output?: string;
  error?: string;
}

/**
 * Lambda Handler
 */
export async function handler(event: AdSyncEvent): Promise<AdSyncResponse> {
  console.log('AD Sync Handler started:', JSON.stringify(event));

  try {
    // 入力検証
    if (!event.username) {
      throw new Error('Username is required');
    }

    // 環境変数検証
    if (!AD_EC2_INSTANCE_ID) {
      throw new Error('AD_EC2_INSTANCE_ID environment variable is not set');
    }

    if (!IDENTITY_TABLE_NAME) {
      throw new Error('IDENTITY_TABLE_NAME environment variable is not set');
    }

    // キャッシュチェック（forceRefreshがfalseの場合）
    if (!event.forceRefresh) {
      const cachedSid = await getCachedSid(event.username);
      if (cachedSid) {
        console.log('SID cache hit:', event.username);
        return {
          success: true,
          data: {
            ...cachedSid,
            cached: true
          }
        };
      }
    }

    // AD SID取得（リトライ付き）
    const adUserInfo = await getAdUserInfoWithRetry(event.username, 3);

    // DynamoDBに保存
    const expiresAt = Date.now() + (SID_CACHE_TTL * 1000);
    await saveSidToDb(event.username, adUserInfo, expiresAt);

    console.log('AD Sync completed successfully:', event.username);

    return {
      success: true,
      data: {
        username: event.username,
        sid: adUserInfo.SID,
        uid: adUserInfo.uidNumber,
        gid: adUserInfo.gidNumber,
        retrievedAt: Date.now(),
        expiresAt: expiresAt,
        cached: false
      }
    };

  } catch (error) {
    console.error('AD Sync failed:', error);
    
    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error occurred'
      }
    };
  }
}

/**
 * DynamoDBからキャッシュされたSIDを取得
 */
async function getCachedSid(username: string): Promise<AdSyncResponse['data'] | null> {
  try {
    const result: GetItemCommandOutput = await dynamoClient.send(new GetItemCommand({
      TableName: IDENTITY_TABLE_NAME,
      Key: {
        username: { S: username }
      }
    }));

    if (!result.Item) {
      return null;
    }

    const expiresAt = parseInt(result.Item.expiresAt?.N || '0', 10);
    
    // 有効期限チェック
    if (expiresAt < Date.now()) {
      console.log('SID cache expired:', username);
      return null;
    }

    return {
      username: username,
      sid: result.Item.sid?.S || '',
      uid: result.Item.uid?.N ? parseInt(result.Item.uid.N, 10) : undefined,
      gid: result.Item.gid?.N ? parseInt(result.Item.gid.N, 10) : undefined,
      retrievedAt: parseInt(result.Item.retrievedAt?.N || '0', 10),
      expiresAt: expiresAt,
      cached: true
    };

  } catch (error) {
    console.error('Failed to get cached SID:', error);
    return null;
  }
}

/**
 * AD User情報取得（リトライ付き）
 */
async function getAdUserInfoWithRetry(
  username: string, 
  maxRetries: number
): Promise<AdUserInfo> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`AD User info retrieval attempt ${attempt}/${maxRetries}`);
      
      const userInfo = await getAdUserInfo(username);
      return userInfo;
      
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to retrieve AD user info after retries');
}

/**
 * AD User情報取得（PowerShell実行）
 */
async function getAdUserInfo(username: string): Promise<AdUserInfo> {
  // PowerShellスクリプト生成
  const script = generateGetAdUserScript(username);
  
  // SSM Run Command実行
  const commandResult = await executePowerShellScript(script);
  
  // 結果パース
  const userInfo = parsePowerShellOutput(commandResult.output || '');
  
  return userInfo;
}

/**
 * Get-ADUser PowerShellスクリプト生成
 */
function generateGetAdUserScript(username: string): string {
  // ユーザー名をエスケープ
  const escapedUsername = username.replace(/'/g, "''");
  
  const script = `
$ErrorActionPreference = 'Stop'
try {
    # AD Userを取得（SID, uidNumber, gidNumber）
    $user = Get-ADUser -Identity '${escapedUsername}' -Properties uidNumber, gidNumber
    
    # 結果をJSON形式で出力
    $result = @{
        SID = $user.SID.Value
        uidNumber = $user.uidNumber
        gidNumber = $user.gidNumber
    }
    
    $result | ConvertTo-Json -Compress
    
} catch {
    Write-Error "Failed to get AD user: $_"
    exit 1
}
`.trim();

  return script;
}

/**
 * SSM PowerShellスクリプト実行
 */
async function executePowerShellScript(script: string): Promise<SsmCommandResult> {
  console.log('Executing PowerShell script via SSM...');
  
  // SSM Run Command実行
  const sendCommand: SendCommandCommandOutput = await ssmClient.send(new SendCommandCommand({
    InstanceIds: [AD_EC2_INSTANCE_ID!],
    DocumentName: 'AWS-RunPowerShellScript',
    Parameters: {
      commands: [script]
    },
    TimeoutSeconds: SSM_TIMEOUT
  }));
  
  const commandId = sendCommand.Command?.CommandId;
  if (!commandId) {
    throw new Error('Failed to get command ID from SSM');
  }
  
  console.log('SSM Command ID:', commandId);
  
  // コマンド完了を待機
  const result = await waitForCommandCompletion(commandId, AD_EC2_INSTANCE_ID!);
  
  return result;
}

/**
 * SSM Command完了待機
 */
async function waitForCommandCompletion(
  commandId: string,
  instanceId: string
): Promise<SsmCommandResult> {
  const maxAttempts = Math.ceil(SSM_TIMEOUT / 2); // 2秒ごとにポーリング
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const getCommand: GetCommandInvocationCommandOutput = await ssmClient.send(
      new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: instanceId
      })
    );
    
    const status = getCommand.Status;
    
    if (status === 'Success') {
      return {
        commandId,
        status: 'Success',
        output: getCommand.StandardOutputContent || ''
      };
    }
    
    if (status === 'Failed') {
      return {
        commandId,
        status: 'Failed',
        error: getCommand.StandardErrorContent || 'Unknown error'
      };
    }
    
    if (status === 'TimedOut') {
      return {
        commandId,
        status: 'TimedOut',
        error: 'Command execution timed out'
      };
    }
    
    if (status === 'Cancelled') {
      return {
        commandId,
        status: 'Cancelled',
        error: 'Command was cancelled'
      };
    }
    
    // まだ実行中の場合は待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // タイムアウト
  return {
    commandId,
    status: 'TimedOut',
    error: 'Polling timeout exceeded'
  };
}

/**
 * PowerShell出力をパース
 */
function parsePowerShellOutput(output: string): AdUserInfo {
  try {
    // JSON出力をパース
    const parsed = JSON.parse(output.trim());
    
    if (!parsed.SID) {
      throw new Error('SID not found in PowerShell output');
    }
    
    return {
      SID: parsed.SID,
      uidNumber: parsed.uidNumber || undefined,
      gidNumber: parsed.gidNumber || undefined
    };
    
  } catch (error) {
    console.error('Failed to parse PowerShell output:', output);
    throw new Error(`Failed to parse PowerShell output: ${error.message}`);
  }
}

/**
 * SIDをDynamoDBに保存
 */
async function saveSidToDb(
  username: string,
  adUserInfo: AdUserInfo,
  expiresAt: number
): Promise<void> {
  const item: Record<string, any> = {
    username: { S: username },
    sid: { S: adUserInfo.SID },
    retrievedAt: { N: Date.now().toString() },
    expiresAt: { N: expiresAt.toString() }
  };
  
  // uidNumber, gidNumberが存在する場合は追加
  if (adUserInfo.uidNumber !== undefined) {
    item.uid = { N: adUserInfo.uidNumber.toString() };
  }
  
  if (adUserInfo.gidNumber !== undefined) {
    item.gid = { N: adUserInfo.gidNumber.toString() };
  }
  
  const result: PutItemCommandOutput = await dynamoClient.send(new PutItemCommand({
    TableName: IDENTITY_TABLE_NAME,
    Item: item
  }));
  
  console.log('SID saved to DynamoDB:', username);
}
