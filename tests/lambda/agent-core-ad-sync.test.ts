/**
 * AD Sync Lambda ユニットテスト
 *
 * テスト対象: lambda/agent-core-ad-sync/index.ts
 * テストケース:
 *   1. Cognito Triggerイベント正常処理（Self-managed AD）
 *   2. Cognito Trigger email username extraction
 *   3. 既存AdSyncEvent後方互換性テスト
 *   4. エラー時のサインイン非ブロッキングテスト
 *   5. キャッシュTTL判定テスト
 *
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
} from '@aws-sdk/client-ssm';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DirectoryServiceClient,
  DescribeDirectoriesCommand,
} from '@aws-sdk/client-directory-service';

// ========================================
// AWS SDK Mocks — must be set up before importing handler
// ========================================
const ssmMock = mockClient(SSMClient);
const dynamoMock = mockClient(DynamoDBClient);
const dsMock = mockClient(DirectoryServiceClient);

// Set default env vars before importing the handler module
process.env.AD_TYPE = 'self-managed';
process.env.AD_EC2_INSTANCE_ID = 'i-0123456789abcdef0';
process.env.AD_DIRECTORY_ID = 'd-test123';
process.env.AD_DOMAIN_NAME = 'test.local';
process.env.AD_DNS_IPS = '10.0.0.1';
process.env.USER_ACCESS_TABLE_NAME = 'test-user-access';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.SID_CACHE_TTL = '86400';
process.env.SSM_TIMEOUT = '5';

// Import handler AFTER env vars are set
import { handler } from '../../lambda/agent-core-ad-sync/index';


// ========================================
// ヘルパー
// ========================================

function createCognitoEvent(emailOverride?: string) {
  const email = emailOverride || 'testuser@example.com';
  return {
    version: '1',
    triggerSource: 'PostAuthentication_Authentication' as const,
    region: 'ap-northeast-1',
    userPoolId: 'ap-northeast-1_TestPool',
    userName: 'test-user-sub-123',
    callerContext: {
      awsSdkVersion: 'aws-sdk-nodejs-3.0.0',
      clientId: 'test-client-id',
    },
    request: {
      userAttributes: {
        email,
        sub: 'test-user-sub-123',
      },
    },
    response: {},
  };
}

function setupSsmMockSuccess(userSID: string, groupSIDs: string[]) {
  ssmMock.on(SendCommandCommand).resolves({
    Command: { CommandId: 'cmd-test-123' },
  });
  ssmMock.on(GetCommandInvocationCommand).resolves({
    Status: 'Success',
    StandardOutputContent: JSON.stringify({ userSID, groupSIDs }),
  });
}

/**
 * Run handler with fake timers to avoid SSM polling delays.
 * The executeSsmCommand function uses setTimeout(5000) for polling.
 */
async function runHandlerWithFakeTimers(event: any): Promise<any> {
  jest.useFakeTimers();
  const promise = handler(event);

  // Advance timers to resolve all setTimeout calls in the SSM polling loop
  // SSM_TIMEOUT=5, so maxAttempts=1, but there's an initial 5s delay + loop delay
  for (let i = 0; i < 5; i++) {
    jest.advanceTimersByTime(6000);
    await Promise.resolve(); // flush microtasks
  }

  const result = await promise;
  jest.useRealTimers();
  return result;
}

// ========================================
// テストセットアップ
// ========================================

beforeEach(() => {
  ssmMock.reset();
  dynamoMock.reset();
  dsMock.reset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ========================================
// 1. Cognito Triggerイベント正常処理（Self-managed AD）
// Validates: Requirements 2.2, 2.4
// ========================================

describe('Cognito Trigger normal processing (Self-managed AD)', () => {
  it('extracts username from email and saves SID via SSM', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    const testSID = 'S-1-5-21-9999999999-8888888888-7777777777-1001';
    const testGroupSIDs = ['S-1-5-21-9999999999-8888888888-7777777777-512', 'S-1-1-0'];
    setupSsmMockSuccess(testSID, testGroupSIDs);

    const event = createCognitoEvent();
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);
    expect((result as any).triggerSource).toBe('PostAuthentication_Authentication');

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);

    const savedItem = putCalls[0].args[0].input.Item;
    expect(savedItem?.userId?.S).toBe('test-user-sub-123');
    expect(savedItem?.email?.S).toBe('testuser');
    expect(savedItem?.userSID?.S).toBe(testSID);
  }, 15000);
});


// ========================================
// 2. Cognito Trigger email username extraction
// Validates: Requirements 2.2, 2.4
// ========================================

describe('Cognito Trigger email username extraction', () => {
  it('extracts username correctly from various email formats', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});
    setupSsmMockSuccess('S-1-5-21-test', ['S-1-1-0']);

    const event = createCognitoEvent('john.doe@corp.example.com');
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
    expect(putCalls[0].args[0].input.Item?.email?.S).toBe('john.doe');
  }, 15000);
});

// ========================================
// 3. 既存AdSyncEvent後方互換性テスト
// Validates: Requirements 2.4
// ========================================

describe('Existing AdSyncEvent backward compatibility', () => {
  it('handles AdSyncEvent format (no triggerSource) correctly', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    const testSID = 'S-1-5-21-1234567890-1234567890-1234567890-1001';
    const testGroupSIDs = ['S-1-1-0'];
    setupSsmMockSuccess(testSID, testGroupSIDs);

    const event = { username: 'johndoe', userId: 'user-123' };
    const result = await runHandlerWithFakeTimers(event);

    expect((result as any).success).toBe(true);
    expect((result as any).adType).toBe('self-managed');
    expect((result as any).data).toBeDefined();
    expect((result as any).data.username).toBe('johndoe');
    expect((result as any).data.userId).toBe('user-123');
    expect((result as any).data.userSID).toBe(testSID);
  }, 15000);
});

// ========================================
// 4. エラー時のサインイン非ブロッキングテスト
// Validates: Requirements 2.5
// ========================================

describe('Error non-blocking sign-in', () => {
  it('returns original event when SSM command fails', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    ssmMock.on(SendCommandCommand).rejects(new Error('SSM SendCommand failed'));

    const event = createCognitoEvent();
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);
    expect((result as any).triggerSource).toBe('PostAuthentication_Authentication');
  }, 15000);

  it('returns original event when DynamoDB GetItem fails during cache check', async () => {
    dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));
    dynamoMock.on(PutItemCommand).resolves({});
    setupSsmMockSuccess('S-1-5-21-test', ['S-1-1-0']);

    const event = createCognitoEvent();
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);
  }, 15000);

  it('returns original event when email attribute is empty', async () => {
    const event = {
      version: '1',
      triggerSource: 'PostAuthentication_Authentication' as const,
      region: 'ap-northeast-1',
      userPoolId: 'ap-northeast-1_TestPool',
      userName: 'test-sub',
      callerContext: { awsSdkVersion: '3.0.0', clientId: 'test' },
      request: {
        userAttributes: { email: '', sub: 'test-sub' },
      },
      response: {},
    };
    // No SSM needed — empty email skips SID sync
    const result = await handler(event as any);
    expect(result).toBe(event);
  });

  it('returns original event when DynamoDB PutItem fails', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB write failed'));
    setupSsmMockSuccess('S-1-5-21-test', ['S-1-1-0']);

    const event = createCognitoEvent();
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);
  }, 15000);
});


// ========================================
// 5. キャッシュTTL判定テスト
// Validates: Requirements 2.3
// ========================================

describe('Cache TTL determination', () => {
  it('skips SID sync when cache is within TTL (24 hours)', async () => {
    const oneHourAgoMs = Date.now() - (3600 * 1000);
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: 'test-user-sub-123' },
        userSID: { S: 'S-1-5-21-cached-sid' },
        groupSIDs: { L: [{ S: 'S-1-1-0' }] },
        retrievedAt: { N: oneHourAgoMs.toString() },
      },
    });

    const event = createCognitoEvent();
    // No SSM needed — cache hit, no fake timers needed
    const result = await handler(event);

    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(0);
  });

  it('re-fetches SID when cache is expired (older than 24 hours)', async () => {
    const twentyFiveHoursAgoMs = Date.now() - (25 * 3600 * 1000);
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: 'test-user-sub-123' },
        userSID: { S: 'S-1-5-21-old-sid' },
        groupSIDs: { L: [{ S: 'S-1-1-0' }] },
        retrievedAt: { N: twentyFiveHoursAgoMs.toString() },
      },
    });
    dynamoMock.on(PutItemCommand).resolves({});
    setupSsmMockSuccess('S-1-5-21-fresh-sid', ['S-1-1-0']);

    const event = createCognitoEvent();
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
    expect(putCalls[0].args[0].input.Item?.userSID?.S).toBe('S-1-5-21-fresh-sid');
  }, 15000);

  it('re-fetches SID when retrievedAt is 0 (no timestamp)', async () => {
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: 'test-user-sub-123' },
        userSID: { S: 'S-1-5-21-old-sid' },
        groupSIDs: { L: [{ S: 'S-1-1-0' }] },
        retrievedAt: { N: '0' },
      },
    });
    dynamoMock.on(PutItemCommand).resolves({});
    setupSsmMockSuccess('S-1-5-21-fresh-sid', ['S-1-1-0']);

    const event = createCognitoEvent();
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
  }, 15000);

  it('re-fetches SID when no item exists in DynamoDB', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});
    setupSsmMockSuccess('S-1-5-21-new-sid', ['S-1-1-0']);

    const event = createCognitoEvent();
    const result = await runHandlerWithFakeTimers(event);

    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
  }, 15000);
});
