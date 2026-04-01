/**
 * AD Sync Lambda プロパティベーステスト
 *
 * Feature: cognito-ad-federation
 * テストフレームワーク: fast-check + aws-sdk-client-mock
 * 各プロパティテストは最低100回のイテレーションで実行
 *
 * Property 2: Cognito Triggerイベント処理（AD_TYPE分岐）
 * Property 3: キャッシュTTLリフレッシュ
 * Property 4: 非ブロッキングエラーハンドリング
 */

import * as fc from 'fast-check';
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
// AWS SDK Mocks
// ========================================
const ssmMock = mockClient(SSMClient);
const dynamoMock = mockClient(DynamoDBClient);
const dsMock = mockClient(DirectoryServiceClient);

// Set env vars before importing handler (module-level const reads)
process.env.AD_TYPE = 'self-managed';
process.env.AD_EC2_INSTANCE_ID = 'i-0123456789abcdef0';
process.env.AD_DIRECTORY_ID = 'd-test123';
process.env.AD_DOMAIN_NAME = 'test.local';
process.env.AD_DNS_IPS = '10.0.0.1';
process.env.USER_ACCESS_TABLE_NAME = 'test-user-access';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.SID_CACHE_TTL = '86400';
process.env.SSM_TIMEOUT = '5';

import { handler } from '../../lambda/agent-core-ad-sync/index';


// ========================================
// ヘルパー: Cognito Post-Auth Event生成
// ========================================
function createCognitoEvent(email: string, sub: string, adGroups?: string) {
  return {
    version: '1',
    triggerSource: 'PostAuthentication_Authentication' as const,
    region: 'ap-northeast-1',
    userPoolId: 'ap-northeast-1_TestPool',
    userName: sub,
    callerContext: {
      awsSdkVersion: 'aws-sdk-nodejs-3.0.0',
      clientId: 'test-client-id',
    },
    request: {
      userAttributes: {
        email,
        sub,
        ...(adGroups ? { 'custom:ad_groups': adGroups } : {}),
      },
    },
    response: {},
  };
}

// ========================================
// ヘルパー: fast-check Arbitraries
// ========================================

/** ランダムなメールアドレス生成 */
const emailArb = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9._]{2,15}$/),
  fc.stringMatching(/^[a-z]{2,10}\.[a-z]{2,5}$/)
).map(([local, domain]) => `${local}@${domain}`);

/** ランダムなCognito sub (UUID形式) */
const subArb = fc.uuid();

/** ランダムなADグループ文字列 */
const adGroupsArb = fc.option(
  fc.array(fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{2,20}$/), { minLength: 1, maxLength: 5 })
    .map(groups => groups.join(','))
);

// ========================================
// ヘルパー: SSM mock
// ========================================
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
 */
async function runHandlerWithFakeTimers(event: any): Promise<any> {
  jest.useFakeTimers();
  const promise = handler(event);
  for (let i = 0; i < 5; i++) {
    jest.advanceTimersByTime(6000);
    await Promise.resolve();
  }
  const result = await promise;
  jest.useRealTimers();
  return result;
}

// ========================================
// テスト前後のセットアップ
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
// Property 2: Cognito Triggerイベント処理（AD_TYPE分岐）
// Feature: cognito-ad-federation, Property 2
// **Validates: Requirements 2.2, 2.4**
//
// Note: AD_TYPE is read at module load time as a const.
// Since we set AD_TYPE='self-managed' before import, the handler
// always uses the self-managed path. This test validates that:
// 1. Username is correctly extracted from email (split('@')[0])
// 2. The handler returns the original event object
// 3. SID data is saved to DynamoDB
// ========================================

describe('Property 2: Cognito Triggerイベント処理（AD_TYPE分岐）', () => {
  it('handler extracts username from email, invokes SID sync, and returns original event', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        subArb,
        adGroupsArb,
        async (email, sub, adGroups) => {
          ssmMock.reset();
          dynamoMock.reset();

          // No cache
          dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
          dynamoMock.on(PutItemCommand).resolves({});

          const testSID = 'S-1-5-21-1234567890-1234567890-1234567890-1001';
          const testGroupSIDs = ['S-1-5-21-1234567890-1234567890-1234567890-513', 'S-1-1-0'];
          setupSsmMockSuccess(testSID, testGroupSIDs);

          const event = createCognitoEvent(email, sub, adGroups ?? undefined);
          const result = await runHandlerWithFakeTimers(event);

          // Property: handler returns the original event object
          expect(result).toBe(event);
          expect(result.triggerSource).toBe('PostAuthentication_Authentication');
          expect(result.request.userAttributes.email).toBe(email);
          expect(result.userName).toBe(sub);

          // Property: DynamoDB PutItem was called (SID was saved)
          const putCalls = dynamoMock.commandCalls(PutItemCommand);
          expect(putCalls.length).toBe(1);

          // Property: username extracted from email correctly
          const savedItem = putCalls[0].args[0].input.Item;
          const expectedUsername = email.split('@')[0];
          expect(savedItem?.email?.S).toBe(expectedUsername);
        }
      ),
      { numRuns: 100 }
    );
  }, 120000);
});


// ========================================
// Property 3: キャッシュTTLリフレッシュ
// Feature: cognito-ad-federation, Property 3
// **Validates: Requirements 2.3**
// ========================================

describe('Property 3: キャッシュTTLリフレッシュ', () => {
  it('SID data is re-fetched only when TTL is exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        subArb,
        fc.boolean(), // true = within TTL, false = outside TTL
        async (email, sub, withinTtl) => {
          ssmMock.reset();
          dynamoMock.reset();

          const ttlSeconds = 86400;
          const nowMs = Date.now();

          let retrievedAt: number;
          if (withinTtl) {
            // Within TTL: retrieved half TTL ago
            retrievedAt = nowMs - (ttlSeconds * 1000 / 2);
          } else {
            // Outside TTL: retrieved TTL + 1 minute ago
            retrievedAt = nowMs - (ttlSeconds * 1000 + 60000);
          }

          // Mock DynamoDB GetItem to return cached data
          dynamoMock.on(GetItemCommand).resolves({
            Item: {
              userId: { S: sub },
              userSID: { S: 'S-1-5-21-cached-sid' },
              groupSIDs: { L: [{ S: 'S-1-1-0' }] },
              retrievedAt: { N: retrievedAt.toString() },
            },
          });
          dynamoMock.on(PutItemCommand).resolves({});

          // Mock SSM for fresh SID retrieval
          setupSsmMockSuccess('S-1-5-21-fresh-sid', ['S-1-1-0']);

          const event = createCognitoEvent(email, sub);

          let result: any;
          if (withinTtl) {
            // No SSM call needed — cache hit, no fake timers needed
            result = await handler(event);
          } else {
            // SSM call needed — use fake timers
            result = await runHandlerWithFakeTimers(event);
          }

          // Property: always returns original event
          expect(result).toBe(event);

          const putCalls = dynamoMock.commandCalls(PutItemCommand);

          if (withinTtl) {
            // Within TTL: should NOT re-fetch (no PutItem call)
            expect(putCalls.length).toBe(0);
          } else {
            // Outside TTL: should re-fetch (PutItem called)
            expect(putCalls.length).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 120000);
});


// ========================================
// Property 4: 非ブロッキングエラーハンドリング
// Feature: cognito-ad-federation, Property 4
// **Validates: Requirements 2.5**
// ========================================

describe('Property 4: 非ブロッキングエラーハンドリング', () => {
  /** Error scenario generators */
  const errorScenarioArb = fc.constantFrom(
    // Network errors
    { name: 'NetworkError', message: 'Network timeout', code: 'ETIMEDOUT' },
    { name: 'ConnectionRefused', message: 'Connection refused', code: 'ECONNREFUSED' },
    // DynamoDB errors
    { name: 'DynamoDBError', message: 'Provisioned throughput exceeded', code: 'ProvisionedThroughputExceededException' },
    { name: 'DynamoDBError', message: 'Internal server error', code: 'InternalServerError' },
    // Managed AD errors (LDAP, Directory Service)
    { name: 'LDAPError', message: 'LDAP connection failed', code: 'LDAP_CONNECT_ERROR' },
    { name: 'DirectoryServiceError', message: 'Directory not found', code: 'EntityDoesNotExistException' },
    // Self-managed AD errors (SSM, PowerShell)
    { name: 'SSMError', message: 'SSM SendCommand failed', code: 'InvalidInstanceId' },
    { name: 'SSMTimeout', message: 'Command timed out', code: 'CommandTimedOut' },
    { name: 'PowerShellError', message: 'Get-ADUser: User not found', code: 'PS_ERROR' }
  );

  it('handler does NOT throw exceptions and returns original event for any error scenario', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        subArb,
        errorScenarioArb,
        async (email, sub, errorScenario) => {
          ssmMock.reset();
          dynamoMock.reset();
          dsMock.reset();

          // Mock: no cache
          dynamoMock.on(GetItemCommand).resolves({ Item: undefined });

          // Make the AD SID retrieval fail with the given error
          const error = new Error(errorScenario.message);
          (error as any).code = errorScenario.code;
          (error as any).name = errorScenario.name;

          ssmMock.on(SendCommandCommand).rejects(error);
          dsMock.on(DescribeDirectoriesCommand).rejects(error);

          const event = createCognitoEvent(email, sub);
          const result = await runHandlerWithFakeTimers(event);

          // Property: handler MUST NOT throw
          // Property: returns original event object unchanged
          expect(result).toBe(event);
          expect(result.triggerSource).toBe('PostAuthentication_Authentication');
          expect(result.request.userAttributes.email).toBe(email);
          expect(result.userName).toBe(sub);
        }
      ),
      { numRuns: 100 }
    );
  }, 120000);
});
