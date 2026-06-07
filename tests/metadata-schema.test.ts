/**
 * .metadata.json Schema — Validation Tests
 */
import {
  validateMetadata,
  normalizeAllowedSIDs,
  isValidSID,
  createMetadata,
} from '../lib/schemas/metadata-schema';

describe('isValidSID', () => {
  it('accepts standard Windows SID', () => {
    expect(isValidSID('S-1-5-21-1234567890-1234567890-1234567890-512')).toBe(true);
  });

  it('accepts Everyone SID', () => {
    expect(isValidSID('S-1-1-0')).toBe(true);
  });

  it('accepts short SID', () => {
    expect(isValidSID('S-1-5-32-544')).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(isValidSID('invalid')).toBe(false);
    expect(isValidSID('')).toBe(false);
    expect(isValidSID('1-5-21-123')).toBe(false);
  });
});

describe('normalizeAllowedSIDs', () => {
  it('handles array format', () => {
    expect(normalizeAllowedSIDs(['S-1-1-0', 'S-1-5-21-xxx-512'])).toEqual(['S-1-1-0', 'S-1-5-21-xxx-512']);
  });

  it('handles comma-separated string', () => {
    expect(normalizeAllowedSIDs('S-1-1-0,S-1-5-21-xxx-512')).toEqual(['S-1-1-0', 'S-1-5-21-xxx-512']);
  });

  it('handles JSON string array', () => {
    expect(normalizeAllowedSIDs('["S-1-1-0", "S-1-5-21-xxx-512"]')).toEqual(['S-1-1-0', 'S-1-5-21-xxx-512']);
  });

  it('handles single string', () => {
    expect(normalizeAllowedSIDs('S-1-1-0')).toEqual(['S-1-1-0']);
  });

  it('handles empty/null/undefined', () => {
    expect(normalizeAllowedSIDs('')).toEqual([]);
    expect(normalizeAllowedSIDs(null)).toEqual([]);
    expect(normalizeAllowedSIDs(undefined)).toEqual([]);
  });

  it('trims whitespace', () => {
    expect(normalizeAllowedSIDs('S-1-1-0, S-1-5-21-xxx-512 ')).toEqual(['S-1-1-0', 'S-1-5-21-xxx-512']);
  });
});

describe('validateMetadata', () => {
  it('validates correct metadata (array SIDs)', () => {
    const result = validateMetadata({
      metadataAttributes: {
        allowed_group_sids: ['S-1-1-0', 'S-1-5-21-1234-512'],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalizedSIDs).toEqual(['S-1-1-0', 'S-1-5-21-1234-512']);
  });

  it('validates comma-separated format with warning', () => {
    const result = validateMetadata({
      metadataAttributes: {
        allowed_group_sids: 'S-1-1-0,S-1-5-21-1234-512',
      },
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('comma-separated');
  });

  it('rejects missing metadataAttributes', () => {
    const result = validateMetadata({});
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('metadataAttributes');
  });

  it('rejects missing allowed_group_sids', () => {
    const result = validateMetadata({ metadataAttributes: {} });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('allowed_group_sids');
  });

  it('rejects empty SID list', () => {
    const result = validateMetadata({
      metadataAttributes: { allowed_group_sids: [] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('at least one SID');
  });

  it('warns about invalid SID format', () => {
    const result = validateMetadata({
      metadataAttributes: { allowed_group_sids: ['invalid-sid'] },
    });
    expect(result.valid).toBe(true); // valid but with warning
    expect(result.warnings[0]).toContain('Invalid SID format');
  });

  it('rejects non-object input', () => {
    expect(validateMetadata(null).valid).toBe(false);
    expect(validateMetadata('string').valid).toBe(false);
    expect(validateMetadata(123).valid).toBe(false);
  });
});

describe('createMetadata', () => {
  it('creates correct format', () => {
    const meta = createMetadata(['S-1-1-0', 'S-1-5-21-xxx-512']);
    expect(meta.metadataAttributes.allowed_group_sids).toEqual(['S-1-1-0', 'S-1-5-21-xxx-512']);
    expect(Array.isArray(meta.metadataAttributes.allowed_group_sids)).toBe(true);
  });

  it('includes optional fields when provided', () => {
    const meta = createMetadata(['S-1-1-0'], {
      category: 'esg',
      owner: 'sustainability-team',
      classification: 'internal',
    });
    expect(meta.metadataAttributes.category).toBe('esg');
    expect(meta.metadataAttributes.owner).toBe('sustainability-team');
    expect(meta.metadataAttributes.classification).toBe('internal');
  });
});
