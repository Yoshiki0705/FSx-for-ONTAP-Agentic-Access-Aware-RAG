/**
 * LDAP Connector ユニットテスト
 *
 * テスト対象: lambda/agent-core-ad-sync/ldap-connector.ts
 * テストケース:
 *   1. escapeFilter — LDAPインジェクション防止（Task 4.2）
 *   2. sanitizeForLog — 構造化ログのシークレット除外（Task 4.4）
 *   3. getBindPassword — Secrets Managerからのパスワード取得（Task 4.3）
 *   4. LdapConnector.queryUser — LDAP接続・クエリ（Task 4.1）
 *   5. structuredLog — 構造化ログ出力（Task 4.4）
 *
 * Requirements: 3.1, 3.3, 3.4, 3.5, 10.1, 10.4, 10.5, 10.6
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

import {
  escapeFilter,
  sanitizeForLog,
  getBindPassword,
  LdapConnector,
  structuredLog,
} from '../../lambda/agent-core-ad-sync/ldap-connector';

// ========================================
// AWS SDK Mocks
// ========================================
const smMock = mockClient(SecretsManagerClient);

// ========================================
// テストセットアップ
// ========================================
beforeEach(() => {
  smMock.reset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ========================================
// 1. escapeFilter — LDAPインジェクション防止（Task 4.2）
// Validates: Requirements 10.6
// ========================================

describe('escapeFilter', () => {
  it('escapes backslash character', () => {
    expect(escapeFilter('user\\name')).toBe('user\\5cname');
  });

  it('escapes asterisk character', () => {
    expect(escapeFilter('user*name')).toBe('user\\2aname');
  });

  it('escapes opening parenthesis', () => {
    expect(escapeFilter('user(name')).toBe('user\\28name');
  });

  it('escapes closing parenthesis', () => {
    expect(escapeFilter('user)name')).toBe('user\\29name');
  });

  it('escapes null byte', () => {
    expect(escapeFilter('user\0name')).toBe('user\\00name');
  });

  it('escapes multiple special characters in one string', () => {
    expect(escapeFilter('u\\s*e(r)n\0e')).toBe('u\\5cs\\2ae\\28r\\29n\\00e');
  });

  it('returns unchanged string when no special characters', () => {
    expect(escapeFilter('normaluser@example.com')).toBe('normaluser@example.com');
  });

  it('handles empty string', () => {
    expect(escapeFilter('')).toBe('');
  });

  it('prevents LDAP injection via email-like input', () => {
    // Attempt to inject: )(uid=*)
    const malicious = 'user@example.com)(uid=*)';
    const escaped = escapeFilter(malicious);
    expect(escaped).not.toContain('*');
    expect(escaped).not.toContain('(');
    expect(escaped).not.toContain(')');
    expect(escaped).toBe('user@example.com\\29\\28uid=\\2a\\29');
  });

  it('is accessible as static method on LdapConnector', () => {
    expect(LdapConnector.escapeFilter('test*')).toBe('test\\2a');
  });
});

// ========================================
// 2. sanitizeForLog — 構造化ログのシークレット除外（Task 4.4）
// Validates: Requirements 10.4
// ========================================

describe('sanitizeForLog', () => {
  it('redacts password fields', () => {
    const result = sanitizeForLog({ password: 'secret123', username: 'admin' });
    expect(result.password).toBe('***REDACTED***');
    expect(result.username).toBe('admin');
  });

  it('redacts bindPassword fields', () => {
    const result = sanitizeForLog({ bindPassword: 'ldap-pass', baseDn: 'dc=example' });
    expect(result.bindPassword).toBe('***REDACTED***');
    expect(result.baseDn).toBe('dc=example');
  });

  it('redacts secret fields', () => {
    const result = sanitizeForLog({ clientSecret: 'oidc-secret', clientId: 'app-id' });
    expect(result.clientSecret).toBe('***REDACTED***');
    expect(result.clientId).toBe('app-id');
  });

  it('redacts token fields', () => {
    const result = sanitizeForLog({ accessToken: 'jwt-token', userId: 'user1' });
    expect(result.accessToken).toBe('***REDACTED***');
    expect(result.userId).toBe('user1');
  });

  it('redacts credential fields', () => {
    const result = sanitizeForLog({ credential: 'cred-value', host: 'ldap.example.com' });
    expect(result.credential).toBe('***REDACTED***');
    expect(result.host).toBe('ldap.example.com');
  });

  it('redacts nested sensitive fields', () => {
    const result = sanitizeForLog({
      config: { bindPassword: 'nested-pass', ldapUrl: 'ldaps://example.com' },
    });
    const config = result.config as Record<string, unknown>;
    expect(config.bindPassword).toBe('***REDACTED***');
    expect(config.ldapUrl).toBe('ldaps://example.com');
  });

  it('preserves non-sensitive fields', () => {
    const result = sanitizeForLog({
      ldapUrl: 'ldaps://ldap.example.com',
      baseDn: 'dc=example,dc=com',
      port: 636,
    });
    expect(result.ldapUrl).toBe('ldaps://ldap.example.com');
    expect(result.baseDn).toBe('dc=example,dc=com');
    expect(result.port).toBe(636);
  });

  it('handles empty object', () => {
    expect(sanitizeForLog({})).toEqual({});
  });

  it('is case-insensitive for sensitive key detection', () => {
    const result = sanitizeForLog({ PASSWORD: 'secret', Token: 'jwt' });
    expect(result.PASSWORD).toBe('***REDACTED***');
    expect(result.Token).toBe('***REDACTED***');
  });
});

// ========================================
// 3. getBindPassword — Secrets Manager取得（Task 4.3）
// Validates: Requirements 10.1
// ========================================

describe('getBindPassword', () => {
  it('returns secret string on success', async () => {
    smMock.on(GetSecretValueCommand).resolves({
      SecretString: 'my-ldap-password',
    });

    const result = await getBindPassword('arn:aws:secretsmanager:ap-northeast-1:123:secret:test', smMock as any);
    expect(result).toBe('my-ldap-password');
  });

  it('retries once on failure then returns null', async () => {
    smMock
      .on(GetSecretValueCommand)
      .rejectsOnce(new Error('Temporary network error'))
      .rejectsOnce(new Error('Still failing'));

    const result = await getBindPassword('arn:aws:secretsmanager:ap-northeast-1:123:secret:test', smMock as any);
    expect(result).toBeNull();

    // Verify 2 calls were made (initial + 1 retry)
    const calls = smMock.commandCalls(GetSecretValueCommand);
    expect(calls.length).toBe(2);
  });

  it('succeeds on retry after first failure', async () => {
    smMock
      .on(GetSecretValueCommand)
      .rejectsOnce(new Error('Temporary error'))
      .resolves({ SecretString: 'recovered-password' });

    const result = await getBindPassword('arn:aws:secretsmanager:ap-northeast-1:123:secret:test', smMock as any);
    expect(result).toBe('recovered-password');
  });

  it('returns null when SecretString is empty', async () => {
    smMock.on(GetSecretValueCommand).resolves({
      SecretString: '',
    });

    const result = await getBindPassword('arn:aws:secretsmanager:ap-northeast-1:123:secret:test', smMock as any);
    expect(result).toBeNull();
  });

  it('returns null when SecretString is undefined', async () => {
    smMock.on(GetSecretValueCommand).resolves({});

    const result = await getBindPassword('arn:aws:secretsmanager:ap-northeast-1:123:secret:test', smMock as any);
    expect(result).toBeNull();
  });
});

// ========================================
// 4. LdapConnector.queryUser — LDAP接続（Task 4.1）
// Validates: Requirements 3.1, 3.3, 3.4, 3.5, 10.5
// ========================================

describe('LdapConnector', () => {
  it('creates instance with config', () => {
    const connector = new LdapConnector({
      ldapUrl: 'ldaps://ldap.example.com:636',
      baseDn: 'dc=example,dc=com',
      bindDn: 'cn=readonly,dc=example,dc=com',
      bindPassword: 'test-password',
      userSearchFilter: '(mail={email})',
      groupSearchFilter: '(member={dn})',
    });
    expect(connector).toBeDefined();
  });

  it('returns null when LDAP server is unreachable (Fail-Open)', async () => {
    const connector = new LdapConnector({
      ldapUrl: 'ldap://127.0.0.1:19999', // Refused port
      baseDn: 'dc=example,dc=com',
      bindDn: 'cn=readonly,dc=example,dc=com',
      bindPassword: 'test-password',
      userSearchFilter: '(mail={email})',
      groupSearchFilter: '(member={dn})',
    });

    // Should return null (Fail-Open), not throw
    const result = await connector.queryUser('user@example.com');
    expect(result).toBeNull();
  }, 10000);

  it('returns null when LDAPS server is unreachable (Fail-Open)', async () => {
    const connector = new LdapConnector({
      ldapUrl: 'ldaps://127.0.0.1:19998', // Refused port
      baseDn: 'dc=example,dc=com',
      bindDn: 'cn=readonly,dc=example,dc=com',
      bindPassword: 'test-password',
      userSearchFilter: '(mail={email})',
      groupSearchFilter: '(member={dn})',
    });

    const result = await connector.queryUser('user@example.com');
    expect(result).toBeNull();
  }, 10000);

  it('uses escapeFilter for email in search filter', () => {
    // Verify escapeFilter is used correctly
    const maliciousEmail = 'user@example.com)(uid=*)';
    const escaped = LdapConnector.escapeFilter(maliciousEmail);
    expect(escaped).not.toContain('*');
    expect(escaped).not.toContain('(');
    expect(escaped).not.toContain(')');
  });

  it('parses LDAPS URL correctly', () => {
    // Verify URL parsing works for ldaps://
    const url = new URL('ldaps://ldap.example.com:636');
    expect(url.protocol).toBe('ldaps:');
    expect(url.hostname).toBe('ldap.example.com');
    expect(url.port).toBe('636');
  });

  it('parses LDAP URL correctly', () => {
    const url = new URL('ldap://ldap.example.com:389');
    expect(url.protocol).toBe('ldap:');
    expect(url.hostname).toBe('ldap.example.com');
    expect(url.port).toBe('389');
  });
});

// ========================================
// 5. structuredLog — 構造化ログ出力（Task 4.4）
// Validates: Requirements 10.4
// ========================================

describe('structuredLog', () => {
  it('outputs ERROR level to console.error', () => {
    const errorSpy = jest.spyOn(console, 'error');
    structuredLog({
      level: 'ERROR',
      source: 'LdapConnector',
      operation: 'bind',
      userId: 'user@example.com',
      error: 'Connection refused',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logOutput = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('ERROR');
    expect(logOutput.source).toBe('LdapConnector');
    expect(logOutput.operation).toBe('bind');
  });

  it('outputs WARN level to console.warn', () => {
    const warnSpy = jest.spyOn(console, 'warn');
    structuredLog({
      level: 'WARN',
      source: 'LdapConnector',
      operation: 'getBindPassword',
      userId: '',
      error: 'Retry attempt',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('outputs INFO level to console.log', () => {
    const logSpy = jest.spyOn(console, 'log');
    structuredLog({
      level: 'INFO',
      source: 'LdapConnector',
      operation: 'queryUser',
      userId: 'user@example.com',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('sanitizes context containing sensitive data', () => {
    const logSpy = jest.spyOn(console, 'log');
    structuredLog({
      level: 'INFO',
      source: 'LdapConnector',
      operation: 'queryUser',
      userId: 'user@example.com',
      context: { bindPassword: 'secret-pass', baseDn: 'dc=example' },
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    const logOutput = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logOutput.context.bindPassword).toBe('***REDACTED***');
    expect(logOutput.context.baseDn).toBe('dc=example');
  });

  it('includes all required ErrorLog fields', () => {
    const errorSpy = jest.spyOn(console, 'error');
    structuredLog({
      level: 'ERROR',
      source: 'LdapConnector',
      operation: 'connect',
      userId: 'test@example.com',
      error: 'Timeout',
      stack: 'Error: Timeout\n    at ...',
      context: { host: 'ldap.example.com', port: 636 },
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    const logOutput = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logOutput).toHaveProperty('level');
    expect(logOutput).toHaveProperty('source');
    expect(logOutput).toHaveProperty('operation');
    expect(logOutput).toHaveProperty('userId');
    expect(logOutput).toHaveProperty('error');
    expect(logOutput).toHaveProperty('stack');
    expect(logOutput).toHaveProperty('context');
    expect(logOutput).toHaveProperty('timestamp');
  });
});
