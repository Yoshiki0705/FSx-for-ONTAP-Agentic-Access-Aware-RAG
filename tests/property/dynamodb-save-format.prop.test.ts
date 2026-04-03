// Feature: oidc-ldap-permission-mapping, Property 8: DynamoDB保存フォーマット整合性
// Feature: oidc-ldap-permission-mapping, Property 9: sourceフィールド正確性
/**
 * Property 8: DynamoDB保存フォーマット整合性
 * POSIX attributes → uid/gid/unixGroups saved; Windows AD → userSID/groupSIDs saved.
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * Property 9: sourceフィールド正確性
 * Correct source field for each auth source + LDAP config combination.
 * **Validates: Requirements 4.5**
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

function makeCognitoEvent(email: string, identities?: string, extraAttrs?: Record<string, string>) {
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
        ...(extraAttrs || {}),
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

const sidArb = fc.stringMatching(/^S-1-5-21-\d{1,10}-\d{1,10}-\d{1,10}-\d{1,5}$/);
const groupNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{1,15}$/);

describe('Property 8: DynamoDB保存フォーマット整合性', () => {
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

  it('SAML/direct path saves userSID and groupSIDs in existing format', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        sidArb,
        fc.array(sidArb, { minLength: 1, maxLength: 3 }),
        async (email, userSID, groupSIDs) => {
          ssmMock.reset();
          dynamoMock.reset();

          dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
          dynamoMock.on(PutItemCommand).resolves({});
          setupSsmMockSuccess(userSID, groupSIDs);

          const event = makeCognitoEvent(email);
          await runWithFakeTimers(event);

          const putCalls = dynamoMock.commandCalls(PutItemCommand);
          expect(putCalls.length).toBe(1);

          const item = putCalls[0].args[0].input.Item!;

          // Must have existing schema fields
          expect(item.userId?.S).toBeDefined();
          expect(item.userSID?.S).toBe(userSID);
          expect(item.groupSIDs?.L).toBeDefined();
          expect(item.email?.S).toBeDefined();
          expect(item.displayName?.S).toBeDefined();
          expect(item.source?.S).toBeDefined();
          expect(item.retrievedAt?.N).toBeDefined();
          expect(item.ttl?.N).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);

  it('OIDC path saves oidcGroups and authSource fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        fc.array(groupNameArb, { minLength: 1, maxLength: 5 }),
        async (email, groups) => {
          dynamoMock.reset();

          dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
          dynamoMock.on(PutItemCommand).resolves({});

          const identities = JSON.stringify([
            { providerType: 'OIDC', providerName: 'TestOIDC', userId: 'u1' },
          ]);

          const event = makeCognitoEvent(email, identities, {
            'custom:groups': JSON.stringify(groups),
          });

          await handler(event);

          const putCalls = dynamoMock.commandCalls(PutItemCommand);
          expect(putCalls.length).toBe(1);

          const item = putCalls[0].args[0].input.Item!;

          // Must have oidcGroups
          expect(item.oidcGroups?.L).toBeDefined();
          const savedGroups = item.oidcGroups!.L!.map((g: any) => g.S);
          expect(savedGroups).toEqual(groups);

          // Must have authSource
          expect(item.authSource?.S).toBe('oidc');

          // Must maintain backward compatibility
          expect(item.userId?.S).toBeDefined();
          expect(item.email?.S).toBeDefined();
          expect(item.retrievedAt?.N).toBeDefined();
          expect(item.ttl?.N).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);
});

describe('Property 9: sourceフィールド正確性', () => {
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

  it('SAML/direct path → source is "AD-Sync-self-managed"', async () => {
    await fc.assert(
      fc.asyncProperty(emailArb, async (email) => {
        ssmMock.reset();
        dynamoMock.reset();

        dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
        dynamoMock.on(PutItemCommand).resolves({});
        setupSsmMockSuccess('S-1-5-21-123-456-789-1001', ['S-1-1-0']);

        const event = makeCognitoEvent(email);
        await runWithFakeTimers(event);

        const putCalls = dynamoMock.commandCalls(PutItemCommand);
        expect(putCalls.length).toBe(1);
        expect(putCalls[0].args[0].input.Item!.source?.S).toBe('AD-Sync-self-managed');
      }),
      { numRuns: 20 }
    );
  }, 120000);

  it('OIDC without LDAP config → source is "OIDC-Claims"', async () => {
    await fc.assert(
      fc.asyncProperty(emailArb, async (email) => {
        dynamoMock.reset();

        dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
        dynamoMock.on(PutItemCommand).resolves({});

        const identities = JSON.stringify([
          { providerType: 'OIDC', providerName: 'TestOIDC', userId: 'u1' },
        ]);

        const event = makeCognitoEvent(email, identities);
        await handler(event);

        const putCalls = dynamoMock.commandCalls(PutItemCommand);
        expect(putCalls.length).toBe(1);

        // Without LDAP config, OIDC path uses claims-only
        const source = putCalls[0].args[0].input.Item!.source?.S;
        expect(source).toBe('OIDC-Claims');
      }),
      { numRuns: 20 }
    );
  }, 120000);
});
