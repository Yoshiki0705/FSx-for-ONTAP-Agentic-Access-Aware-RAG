/**
 * Identity Sync Lambda ユニットテスト — OIDC拡張
 *
 * テスト対象: lambda/agent-core-ad-sync/index.ts
 * テストケース:
 *   1. detectAuthSource — 認証ソース判別（Task 3.1）
 *   2. parseOidcClaims — OIDCクレームパーサー（Task 3.2）
 *   3. DynamoDB保存ロジック拡張（Task 3.3）
 *   4. OIDCパスのメインハンドラー統合（Task 3.4）
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 10.3
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
} from '@aws-sdk/client-directory-service';

// ========================================
// AWS SDK Mocks
// ========================================
const ssmMock = mockClient(SSMClient);
const dynamoMock = mockClient(DynamoDBClient);
const dsMock = mockClient(DirectoryServiceClient);

// Set env vars before importing
process.env.AD_TYPE = 'self-managed';
process.env.AD_EC2_INSTANCE_ID = 'i-0123456789abcdef0';
process.env.USER_ACCESS_TABLE_NAME = 'test-user-access';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.SID_CACHE_TTL = '86400';
process.env.SSM_TIMEOUT = '5';
process.env.OIDC_GROUP_CLAIM_NAME = 'groups';
// No LDAP config by default
process.env.LDAP_URL = '';
process.env.LDAP_BASE_DN = '';
process.env.LDAP_BIND_DN = '';

import { handler, detectAuthSource, parseOidcClaims } from '../../lambda/agent-core-ad-sync/index';

// ========================================
// ヘルパー
// ========================================

function createCognitoEvent(overrides?: {
  email?: string;
  identities?: string;
  extraAttributes?: Record<string, string>;
}) {
  const email = overrides?.email || 'testuser@example.com';
  const attrs: Record<string, string | undefined> = {
    email,
    sub: 'test-user-sub-123',
  };
  if (overrides?.identities !== undefined) {
    attrs['identities'] = overrides.identities;
  }
  if (overrides?.extraAttributes) {
    Object.assign(attrs, overrides.extraAttributes);
  }
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
    request: { userAttributes: attrs },
    response: {},
  };
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
// 1. detectAuthSource — 認証ソース判別（Task 3.1）
// Validates: Requirements 4.3
// ========================================

describe('detectAuthSource', () => {
  it('returns "saml" when identities contains SAML provider', () => {
    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'SAML', providerName: 'EntraID' }]),
    });
    expect(detectAuthSource(event as any)).toBe('saml');
  });

  it('returns "oidc" when identities contains OIDC provider', () => {
    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Keycloak' }]),
    });
    expect(detectAuthSource(event as any)).toBe('oidc');
  });

  it('returns "direct" when no identities attribute', () => {
    const event = createCognitoEvent();
    expect(detectAuthSource(event as any)).toBe('direct');
  });

  it('returns "direct" when identities is empty array', () => {
    const event = createCognitoEvent({ identities: '[]' });
    expect(detectAuthSource(event as any)).toBe('direct');
  });

  it('returns "direct" when identities is invalid JSON', () => {
    const event = createCognitoEvent({ identities: 'not-json' });
    expect(detectAuthSource(event as any)).toBe('direct');
  });

  it('returns "saml" when both SAML and OIDC are present (SAML takes priority)', () => {
    const event = createCognitoEvent({
      identities: JSON.stringify([
        { providerType: 'SAML', providerName: 'AD' },
        { providerType: 'OIDC', providerName: 'Keycloak' },
      ]),
    });
    expect(detectAuthSource(event as any)).toBe('saml');
  });

  it('returns "direct" when identities contains unknown provider type', () => {
    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'CUSTOM', providerName: 'Custom' }]),
    });
    expect(detectAuthSource(event as any)).toBe('direct');
  });
});

// ========================================
// 2. parseOidcClaims — OIDCクレームパーサー（Task 3.2）
// Validates: Requirements 8.1, 8.2
// ========================================

describe('parseOidcClaims', () => {
  it('extracts groups from "groups" claim (JSON array string)', () => {
    const event = createCognitoEvent({
      extraAttributes: { groups: '["developers","admins"]' },
    });
    const result = parseOidcClaims(event as any);
    expect(result.groups).toEqual(['developers', 'admins']);
    expect(result.email).toBe('testuser@example.com');
  });

  it('extracts groups from "custom:groups" claim', () => {
    const event = createCognitoEvent({
      extraAttributes: { 'custom:groups': '["engineering"]' },
    });
    const result = parseOidcClaims(event as any);
    expect(result.groups).toEqual(['engineering']);
  });

  it('prefers "custom:groups" over "groups"', () => {
    const event = createCognitoEvent({
      extraAttributes: {
        'custom:groups': '["custom-group"]',
        groups: '["plain-group"]',
      },
    });
    const result = parseOidcClaims(event as any);
    expect(result.groups).toEqual(['custom-group']);
  });

  it('returns empty array when no groups claim exists', () => {
    const event = createCognitoEvent();
    const result = parseOidcClaims(event as any);
    expect(result.groups).toEqual([]);
  });

  it('handles comma-separated string as fallback', () => {
    const event = createCognitoEvent({
      extraAttributes: { groups: 'dev,ops,admin' },
    });
    const result = parseOidcClaims(event as any);
    expect(result.groups).toEqual(['dev', 'ops', 'admin']);
  });

  it('uses custom groupClaimName parameter', () => {
    const event = createCognitoEvent({
      extraAttributes: { 'custom:roles': '["role-a","role-b"]' },
    });
    const result = parseOidcClaims(event as any, 'roles');
    expect(result.groups).toEqual(['role-a', 'role-b']);
  });

  it('handles empty string groups claim', () => {
    const event = createCognitoEvent({
      extraAttributes: { groups: '' },
    });
    const result = parseOidcClaims(event as any);
    expect(result.groups).toEqual([]);
  });
});

// ========================================
// 3. DynamoDB保存ロジック拡張（Task 3.3）
// Validates: Requirements 5.1, 5.2, 5.3, 4.5
// ========================================

describe('DynamoDB save with extended fields (OIDC path)', () => {
  it('saves OIDC-Claims source with oidcGroups when no LDAP config', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Keycloak' }]),
      extraAttributes: { groups: '["developers","ops"]' },
    });

    const result = await handler(event as any);
    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);

    const savedItem = putCalls[0].args[0].input.Item!;
    expect(savedItem.source?.S).toBe('OIDC-Claims');
    expect(savedItem.authSource?.S).toBe('oidc');
    expect(savedItem.oidcGroups?.L).toEqual([{ S: 'developers' }, { S: 'ops' }]);
    expect(savedItem.userSID?.S).toBe('');
    expect(savedItem.groupSIDs?.L).toEqual([]);
  });

  it('preserves existing fields (userId, email, displayName, retrievedAt, ttl)', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Okta' }]),
    });

    await handler(event as any);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    const savedItem = putCalls[0].args[0].input.Item!;
    expect(savedItem.userId?.S).toBe('test-user-sub-123');
    expect(savedItem.email?.S).toBe('testuser');
    expect(savedItem.displayName?.S).toBe('testuser');
    expect(savedItem.retrievedAt?.N).toBeDefined();
    expect(savedItem.ttl?.N).toBeDefined();
    expect(savedItem.createdAt?.S).toBeDefined();
    expect(savedItem.updatedAt?.S).toBeDefined();
  });

  it('saves unixGroups as empty list when no LDAP data', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Keycloak' }]),
    });

    await handler(event as any);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    const savedItem = putCalls[0].args[0].input.Item!;
    expect(savedItem.unixGroups?.L).toEqual([]);
  });
});

// ========================================
// 4. OIDCパスのメインハンドラー統合（Task 3.4）
// Validates: Requirements 4.4, 5.4, 5.5, 8.3, 8.4, 10.3
// ========================================

describe('OIDC path main handler integration', () => {
  it('routes OIDC events to OIDC path (Claims-only)', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Keycloak' }]),
      extraAttributes: { groups: '["team-a"]' },
    });

    const result = await handler(event as any);
    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
    expect(putCalls[0].args[0].input.Item!.source?.S).toBe('OIDC-Claims');
  });

  it('uses cache when TTL is valid for OIDC events', async () => {
    const oneHourAgoMs = Date.now() - (3600 * 1000);
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: 'test-user-sub-123' },
        userSID: { S: '' },
        groupSIDs: { L: [] },
        oidcGroups: { L: [{ S: 'cached-group' }] },
        retrievedAt: { N: oneHourAgoMs.toString() },
        source: { S: 'OIDC-Claims' },
      },
    });

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Keycloak' }]),
      extraAttributes: { groups: '["new-group"]' },
    });

    const result = await handler(event as any);
    expect(result).toBe(event);

    // Should NOT write to DynamoDB (cache hit)
    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(0);
  });

  it('bypasses cache when forceRefresh is set', async () => {
    const oneHourAgoMs = Date.now() - (3600 * 1000);
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: 'test-user-sub-123' },
        userSID: { S: '' },
        retrievedAt: { N: oneHourAgoMs.toString() },
      },
    });
    dynamoMock.on(PutItemCommand).resolves({});

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Keycloak' }]),
      extraAttributes: {
        groups: '["refreshed-group"]',
        'custom:forceRefresh': 'true',
      },
    });

    const result = await handler(event as any);
    expect(result).toBe(event);

    // Should write to DynamoDB despite cache being valid
    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
  });

  it('returns original event on OIDC path error (Fail-Open)', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB write failed'));

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'OIDC', providerName: 'Keycloak' }]),
    });

    const result = await handler(event as any);
    // Fail-Open: must return original event, not throw
    expect(result).toBe(event);
    expect((result as any).triggerSource).toBe('PostAuthentication_Authentication');
  });

  it('SAML events still use existing AD Sync path (backward compatibility)', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    ssmMock.on(SendCommandCommand).resolves({
      Command: { CommandId: 'cmd-test-123' },
    });
    ssmMock.on(GetCommandInvocationCommand).resolves({
      Status: 'Success',
      StandardOutputContent: JSON.stringify({
        userSID: 'S-1-5-21-test-saml',
        groupSIDs: ['S-1-1-0'],
      }),
    });

    const event = createCognitoEvent({
      identities: JSON.stringify([{ providerType: 'SAML', providerName: 'EntraID' }]),
    });

    jest.useFakeTimers();
    const promise = handler(event as any);
    for (let i = 0; i < 5; i++) {
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
    }
    const result = await promise;
    jest.useRealTimers();

    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
    // SAML path uses AD-Sync source, not OIDC source
    expect(putCalls[0].args[0].input.Item!.source?.S).toBe('AD-Sync-self-managed');
    // No authSource field for SAML path (backward compat)
    expect(putCalls[0].args[0].input.Item!.authSource).toBeUndefined();
  }, 15000);

  it('direct auth events use existing AD Sync path (backward compatibility)', async () => {
    dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
    dynamoMock.on(PutItemCommand).resolves({});

    ssmMock.on(SendCommandCommand).resolves({
      Command: { CommandId: 'cmd-test-456' },
    });
    ssmMock.on(GetCommandInvocationCommand).resolves({
      Status: 'Success',
      StandardOutputContent: JSON.stringify({
        userSID: 'S-1-5-21-test-direct',
        groupSIDs: ['S-1-1-0'],
      }),
    });

    const event = createCognitoEvent(); // no identities = direct

    jest.useFakeTimers();
    const promise = handler(event as any);
    for (let i = 0; i < 5; i++) {
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
    }
    const result = await promise;
    jest.useRealTimers();

    expect(result).toBe(event);

    const putCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(putCalls.length).toBe(1);
    expect(putCalls[0].args[0].input.Item!.source?.S).toBe('AD-Sync-self-managed');
  }, 15000);
});
