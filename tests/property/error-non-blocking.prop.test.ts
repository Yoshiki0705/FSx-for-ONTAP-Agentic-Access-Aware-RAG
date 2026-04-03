// Feature: oidc-ldap-permission-mapping, Property 6: エラー時の非ブロッキング動作
/**
 * Property 6: エラー時の非ブロッキング動作
 *
 * For any error during Identity Sync Lambda, handler returns original
 * Cognito event without throwing, ensuring sign-in is never blocked.
 *
 * **Validates: Requirements 3.6, 3.7, 10.3**
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
import {
  DirectoryServiceClient,
  DescribeDirectoriesCommand,
} from '@aws-sdk/client-directory-service';

const ssmMock = mockClient(SSMClient);
const dynamoMock = mockClient(DynamoDBClient);
const dsMock = mockClient(DirectoryServiceClient);

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
    userName: `user-${Date.now()}`,
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

const emailArb = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
  fc.stringMatching(/^[a-z]{2,8}\.[a-z]{2,4}$/)
).map(([local, domain]) => `${local}@${domain}`);

/** Various error types that can occur */
const errorTypeArb = fc.constantFrom(
  { name: 'NetworkError', message: 'LDAP connection timeout after 30000ms' },
  { name: 'LDAPBindError', message: 'LDAP bind failed with result code: 49' },
  { name: 'ConnectionRefused', message: 'connect ECONNREFUSED 10.0.0.1:389' },
  { name: 'SSMError', message: 'SSM SendCommand failed' },
  { name: 'DynamoDBError', message: 'Provisioned throughput exceeded' },
  { name: 'SecretsManagerError', message: 'Failed to retrieve secret' },
  { name: 'TimeoutError', message: 'Command timed out' },
  { name: 'ParseError', message: 'Unexpected token in JSON' },
  { name: 'UnknownError', message: 'Something unexpected happened' },
);

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

describe('Property 6: エラー時の非ブロッキング動作', () => {
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

  it('returns original Cognito event for any error during SAML/direct path', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        errorTypeArb,
        async (email, errorType) => {
          ssmMock.reset();
          dynamoMock.reset();

          // No cache
          dynamoMock.on(GetItemCommand).resolves({ Item: undefined });

          // Make SSM fail with the given error
          const error = new Error(errorType.message);
          (error as any).name = errorType.name;
          ssmMock.on(SendCommandCommand).rejects(error);

          const event = makeCognitoEvent(email);
          const result = await runWithFakeTimers(event);

          // Property: handler MUST return original event, never throw
          expect(result).toBe(event);
          expect((result as any).triggerSource).toBe('PostAuthentication_Authentication');
          expect((result as any).request.userAttributes.email).toBe(email);
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);

  it('returns original Cognito event for OIDC path errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        errorTypeArb,
        async (email, errorType) => {
          dynamoMock.reset();

          // OIDC identity
          const identities = JSON.stringify([
            { providerType: 'OIDC', providerName: 'TestOIDC', userId: 'u1' },
          ]);

          // DynamoDB fails
          const error = new Error(errorType.message);
          (error as any).name = errorType.name;
          dynamoMock.on(GetItemCommand).rejects(error);
          dynamoMock.on(PutItemCommand).rejects(error);

          const event = makeCognitoEvent(email, identities);

          // OIDC path doesn't use SSM, so no fake timers needed
          const result = await handler(event);

          // Property: handler MUST return original event, never throw
          expect(result).toBe(event);
          expect((result as any).triggerSource).toBe('PostAuthentication_Authentication');
        }
      ),
      { numRuns: 20 }
    );
  }, 120000);
});
