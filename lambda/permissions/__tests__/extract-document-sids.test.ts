/**
 * extractDocumentSIDs must strip the literal double quotes that S3 Vectors wraps around each SID
 * value. Without this the Lambda path denies every document while the inline path (which strips
 * them in parseDocumentSIDs) allows the right ones. Observed in the #230 real-environment run:
 * documentSIDs came back as ["\"S-1-5-21-...-512\""] and matched no user SID.
 */
import { extractDocumentSIDs } from '../metadata-filter-handler';

describe('extractDocumentSIDs', () => {
  it('strips the quotes S3 Vectors adds around array elements', () => {
    expect(extractDocumentSIDs({ allowed_group_sids: ['"S-1-5-21-0-0-0-512"', '"S-1-1-0"'] }))
      .toEqual(['S-1-5-21-0-0-0-512', 'S-1-1-0']);
  });

  it('reads the key under metadataAttributes too', () => {
    expect(extractDocumentSIDs({ metadataAttributes: { allowed_group_sids: ['"S-1-1-0"'] } }))
      .toEqual(['S-1-1-0']);
  });

  it('leaves already-clean values unchanged', () => {
    expect(extractDocumentSIDs({ allowed_group_sids: ['S-1-1-0', 'S-1-5-21-0-0-0-512'] }))
      .toEqual(['S-1-1-0', 'S-1-5-21-0-0-0-512']);
  });

  it('parses a JSON-string array and strips quotes', () => {
    expect(extractDocumentSIDs({ allowed_group_sids: '["S-1-1-0","S-1-5-21-0-0-0-512"]' }))
      .toEqual(['S-1-1-0', 'S-1-5-21-0-0-0-512']);
  });

  it('parses a comma-separated string', () => {
    expect(extractDocumentSIDs({ allowed_group_sids: 'S-1-1-0, S-1-5-21-0-0-0-512' }))
      .toEqual(['S-1-1-0', 'S-1-5-21-0-0-0-512']);
  });

  it('returns an empty array when the key is absent', () => {
    expect(extractDocumentSIDs({})).toEqual([]);
  });
});
