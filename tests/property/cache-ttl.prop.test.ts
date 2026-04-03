// Feature: oidc-ldap-permission-mapping, Property 10: キャッシュTTL動作
// Feature: oidc-ldap-permission-mapping, Property 11: forceRefreshキャッシュバイパス
/**
 * Property 10: キャッシュTTL動作
 * TTL future → cache hit (skip query), TTL past → cache miss (re-query).
 * **Validates: Requirements 5.4**
 *
 * Property 11: forceRefreshキャッシュバイパス
 * forceRefresh → always re-query regardless of TTL.
 * **Validates: Requirements 5.5**
 */

import * as fc from 'fast-check';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
} from '@aws-sdk/client-ssm';

const ssmMock = mockClient(SSMClient);
const dynamoMock = mockClient(DynamoDBClient);

// Set env vars before importing handler
process.env.AD_TYPE = 'self-managed';
process.env.AD_EC2_INSTANCE_ID = 'i-0123456789abcdef0';
process.env.USER_ACCESS_TABLE_NAME = 'test-user-access';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.SID_CACHE_TTL = '86400';
process.env.SSM_TIMEOUT = '5';

import { handler } from '../../lambda/agent-core-ad-sync/index';

// ========================================
// Helpers
// ========================================

function makeCognitoEvent(email: string, identities?: string) {
  return {
    version: '1',
    triggerSource: 'PostAuthentication_Authentication' as const,
    region: 'ap-northeast-1',
    userPoolId: 'ap-northeast-1_TestPool',
    userName: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    callerContext: { awsSdkVersion: '3.0.0', clientId: 'client-id' },
    request: {
      userAttributes: {
        email,
        sub: 'sub-123',
        ...(identities ? { identities } : {}),
      },
    },
    response: {},
  };
}

function setupSsmMockSuccess() {
  ssmMock.on(SendCommandCommand).resolves({
    Command: { CommandId: 'cmd-test-123' },
  });
  ssmMock.on(GetCommandInvocationCommand).resolves({
    Status: 'Success',
    StandardOutputContent: JSON.stringify({
      userSID: 'S-1-5-21-fresh-sid',
      groupSIDs: ['S-1-1-0'],
    }),
  });
}

async function runWithFakeTimers(event: any): Promise<any> {
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

const emailArb = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
  fc.stringMatching(/^[a-z]{2,8}\.[a-z]{2,4}$/)
).map(([local, domain]) => `${local}@${domain}`);

describe('Property 10: キャッシュTTL動作', () => {
  beforeEach(() => {
    ssmMock.reset();
    dynamoMock.reset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('TTL within range → cache hit, no re-query (SAML/direct path)', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        // fraction of TTL elapsed (0.01 to 0.9 = within TTL)
        fc.double({ min: 0.01, max: 0.9, noNaN: true }),
        async (email, ttlFraction) => {
          ssmMock.reset();
          dynamoMock.reset();

          const ttlSeconds = 86400;
          const nowMs = Date.now();
          const retrievedAt = nowMs - Math.floor(ttlFraction * ttlSeconds * 1000);

          dynamoMock.on(GetItemCommand).resolves({
            Item: {
              userId: { S: 'cached-user' },
              userSID: { S: 'S-1-5-21-cached-sid' },
              groupSIDs: { L: [{ S: 'S-1-1-0' }] },
              source: { S: 'AD-Sync-self-managed' },
              retrievedAt: { N: retrievedAt.toString() },
            },
          });
          dynamoMock.on(PutItemCommand).resolves({});
          setupSsmMockSuccess();

          const event = makeCognitoEvent(email);
          const result = await handler(event);

          expect(result).toBe(event);

          // Within TTL: should NOT re-fetch (no PutItem)
          const putCalls = dynamoMock.commandCalls(PutItemCommand);
          expect(putCalls.length).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);

  it('TTL expired → cache miss, re-query (SAML/direct path)', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        // extra seconds past TTL (1 to 3600)
        fc.integer({ min: 1, max: 3600 }),
        async (email, extraSeconds) => {
          ssmMock.reset();
          dynamoMock.reset();

          const ttlSeconds = 86400;
          const nowMs = Date.now();
          const retrievedAt = nowMs - (ttlSeconds * 1000 + extraSeconds * 1000);

          dynamoMock.on(GetItemCommand).resolves({
            Item: {
              userId: { S: 'cached-user' },
              userSID: { S: 'S-1-5-21-cached-sid' },
              groupSIDs: { L: [{ S: 'S-1-1-0' }] },
              source: { S: 'AD-Sync-self-managed' },
              retrievedAt: { N: retrievedAt.toString() },
            },
          });
          dynamoMock.on(PutItemCommand).resolves({});
          setupSsmMockSuccess();

          const event = makeCognitoEvent(email);
          const result = await runWithFakeTimers(event);

          expect(result).toBe(event);

          // Expired TTL: should re-fetch (PutItem called)
          const putCalls = dynamoMock.commandCalls(PutItemCommand);
          expect(putCalls.length).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);
});

describe('Property 11: forceRefreshキャッシュバイパス', () => {
  beforeEach(() => {
    ssmMock.reset();
    dynamoMock.reset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('OIDC path with forceRefresh=true → always re-queries regardless of TTL', async () => {
    await fc.assert(
      fc.asyncProperty(emailArb, async (email) => {
        dynamoMock.reset();

        const nowMs = Date.now();
        // Cache is very fresh (just retrieved)
        const retrievedAt = nowMs - 1000;

        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            userId: { S: 'cached-user' },
            userSID: { S: '' },
            groupSIDs: { L: [] },
            source: { S: 'OIDC-Claims' },
            retrievedAt: { N: retrievedAt.toString() },
          },
        });
        dynamoMock.on(PutItemCommand).resolves({});

        const identities = JSON.stringify([
          { providerType: 'OIDC', providerName: 'TestOIDC', userId: 'u1' },
        ]);

        const event = makeCognitoEvent(email, identities);
        // Set forceRefresh via custom attribute
        event.request.userAttributes['custom:forceRefresh'] = 'true';

        await handler(event);

        // forceRefresh: should re-query even though cache is fresh
        const putCalls = dynamoMock.commandCalls(PutItemCommand);
        expect(putCalls.length).toBe(1);
      }),
      { numRuns: 20 }
    );
  }, 120000);
});
