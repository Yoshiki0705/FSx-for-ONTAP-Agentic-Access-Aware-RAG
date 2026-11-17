/**
 * The opaque ID stored in a feedback record for a cited document: the first 24 hex
 * characters of the SHA-256 of its S3 URI. The record keeps no file name, so a reviewer who
 * may not read a document cannot learn its name from the feedback table. An operator who
 * can list the bucket finds the document again with `scripts/resolve-feedback-doc-ids.py`.
 */
import { createHash } from 'node:crypto';

export function docIdOf(s3Uri: string): string {
  return createHash('sha256').update(s3Uri).digest('hex').slice(0, 24);
}

/** At most `max` distinct IDs, from the citations the signed-in user was allowed to see. */
export function docIdsOf(uris: unknown, max = 20): string[] {
  if (!Array.isArray(uris)) return [];
  const ids: string[] = [];
  for (const u of uris) {
    if (typeof u !== 'string' || !u || u.length > 2048) continue;
    const id = docIdOf(u);
    if (!ids.includes(id)) ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}
