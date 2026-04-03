// Feature: oidc-ldap-permission-mapping, Property 17: 構造化ログのシークレット除外
/**
 * Property 17: 構造化ログのシークレット除外
 *
 * For any log output, passwords/secrets/tokens are never included.
 * The `sanitizeForLog` function redacts all sensitive keys.
 *
 * **Validates: Requirements 10.4**
 */

import * as fc from 'fast-check';
import { sanitizeForLog, structuredLog, ErrorLog } from '../../lambda/agent-core-ad-sync/ldap-connector';

// ========================================
// Generators
// ========================================

const sensitiveKeyArb = fc.constantFrom(
  'password', 'Password', 'PASSWORD',
  'secret', 'Secret', 'SECRET',
  'token', 'Token', 'TOKEN',
  'bindPassword', 'clientSecret',
  'credential', 'Credential',
  'ldapBindPassword', 'oidcClientSecret',
  'apiToken', 'secretKey',
);

const sensitiveValueArb = fc.stringMatching(/^[A-Za-z0-9!@#$%^&*]{5,50}$/);

const safeKeyArb = fc.constantFrom(
  'userId', 'email', 'ldapUrl', 'baseDn', 'bindDn',
  'host', 'port', 'operation', 'level', 'source',
  'timestamp', 'elapsedMs', 'groupCount',
);

const safeValueArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.integer({ min: 0, max: 100000 }),
  fc.boolean(),
);

describe('Property 17: 構造化ログのシークレット除外', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sanitizeForLog redacts all sensitive keys regardless of value', async () => {
    await fc.assert(
      fc.property(
        sensitiveKeyArb,
        sensitiveValueArb,
        (key: string, value: string) => {
          const input: Record<string, unknown> = { [key]: value };
          const sanitized = sanitizeForLog(input);
          expect(sanitized[key]).toBe('***REDACTED***');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('sanitizeForLog preserves safe keys unchanged', async () => {
    await fc.assert(
      fc.property(
        safeKeyArb,
        safeValueArb,
        (key: string, value: unknown) => {
          const input: Record<string, unknown> = { [key]: value };
          const sanitized = sanitizeForLog(input);
          expect(sanitized[key]).toBe(value);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('sanitizeForLog redacts nested sensitive keys', async () => {
    await fc.assert(
      fc.property(
        sensitiveKeyArb,
        sensitiveValueArb,
        (key: string, value: string) => {
          const input: Record<string, unknown> = {
            context: { [key]: value, safeField: 'visible' },
          };
          const sanitized = sanitizeForLog(input);
          const ctx = sanitized.context as Record<string, unknown>;
          expect(ctx[key]).toBe('***REDACTED***');
          expect(ctx.safeField).toBe('visible');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('structuredLog output never contains raw sensitive values', async () => {
    await fc.assert(
      fc.property(
        sensitiveKeyArb,
        sensitiveValueArb,
        fc.constantFrom('ERROR', 'WARN', 'INFO') as fc.Arbitrary<'ERROR' | 'WARN' | 'INFO'>,
        (key: string, value: string, level) => {
          const logOutput: string[] = [];
          const spy = level === 'ERROR'
            ? jest.spyOn(console, 'error').mockImplementation((...args) => logOutput.push(args.join(' ')))
            : level === 'WARN'
              ? jest.spyOn(console, 'warn').mockImplementation((...args) => logOutput.push(args.join(' ')))
              : jest.spyOn(console, 'log').mockImplementation((...args) => logOutput.push(args.join(' ')));

          const log: ErrorLog = {
            level,
            source: 'LdapConnector',
            operation: 'test',
            userId: 'testuser',
            context: { [key]: value },
            timestamp: new Date().toISOString(),
          };

          structuredLog(log);

          // The raw sensitive value should NOT appear in the output
          for (const line of logOutput) {
            expect(line).not.toContain(value);
            expect(line).toContain('***REDACTED***');
          }

          spy.mockRestore();
        }
      ),
      { numRuns: 20 }
    );
  });
});
