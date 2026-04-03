// Feature: oidc-ldap-permission-mapping, Property 5: LDAPインジェクション防止
/**
 * Property 5: LDAPインジェクション防止
 *
 * For any user input string, `escapeFilter` correctly escapes all LDAP
 * special characters (\, *, (, ), \0) so that injection attacks cannot
 * succeed when the escaped value is inserted into an LDAP filter.
 *
 * **Validates: Requirements 10.6**
 */

import * as fc from 'fast-check';
import { escapeFilter } from '../../lambda/agent-core-ad-sync/ldap-connector';

const LDAP_SPECIAL_CHARS = ['\\', '*', '(', ')', '\0'];

describe('Property 5: LDAPインジェクション防止', () => {
  it('escapeFilter escapes all LDAP special characters for any input string', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (input: string) => {
          const escaped = escapeFilter(input);

          // After escaping, no raw special chars should remain
          // (they should all be replaced with \\XX hex sequences)
          for (const ch of LDAP_SPECIAL_CHARS) {
            // Count occurrences in input
            const inputCount = input.split(ch).length - 1;
            if (inputCount > 0) {
              // The escaped form should NOT contain the raw char
              // except as part of the escape sequence itself
              const hexCode = ch.charCodeAt(0).toString(16).padStart(2, '0');
              const escapeSeq = `\\${hexCode}`;

              // Remove all escape sequences, then check no raw special char remains
              const withoutEscapes = escaped.split(escapeSeq).join('');
              // For backslash, the escape is \5c, so after removing \5c sequences
              // there should be no raw backslash that isn't part of another escape
              if (ch === '\\') {
                // After removing \5c, remaining backslashes should only be
                // part of other escape sequences (\2a, \28, \29, \00)
                const remaining = withoutEscapes.replace(/\\(2a|28|29|00)/g, '');
                expect(remaining).not.toContain('\\');
              } else {
                expect(withoutEscapes).not.toContain(ch);
              }
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('escapeFilter preserves non-special characters unchanged', async () => {
    await fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9@._\-\s]{0,100}$/),
        (safeInput: string) => {
          const escaped = escapeFilter(safeInput);
          // Safe input should pass through unchanged
          expect(escaped).toBe(safeInput);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('escapeFilter produces output that cannot form valid LDAP filter injection', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (input: string) => {
          const escaped = escapeFilter(input);
          // The escaped string inserted into a filter template should not
          // create unbalanced parentheses or wildcard matches
          const filter = `(mail=${escaped})`;

          // Count raw unescaped parens — should be exactly 1 open and 1 close
          // from the template, not from user input
          const rawOpen = (filter.match(/(?<!\\)\(/g) || []).length;
          const rawClose = (filter.match(/(?<!\\)\)/g) || []).length;
          // The template adds exactly 1 ( and 1 )
          // Escaped parens are \28 and \29, which don't match the regex above
          expect(rawOpen).toBe(1);
          expect(rawClose).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  });
});
