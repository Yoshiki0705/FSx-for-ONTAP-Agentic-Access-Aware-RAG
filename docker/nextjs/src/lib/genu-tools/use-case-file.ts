/**
 * The JSON file a user exports their use cases to and imports them from. It carries only
 * what a use case is (title, description, template, whether it searches documents): no
 * user, no IDs, no dates of the original. Imported use cases become new private ones.
 *
 * No AWS SDK here: the screen builds the file with the same function the tests check.
 */
export const USE_CASE_FILE_FORMAT = 'rag-use-cases';
export const USE_CASE_FILE_VERSION = 1;
export const MAX_USE_CASES_PER_FILE = 50;
/** Field limits, shared with the server-side validation (use-cases.ts). */
export const USE_CASE_LIMITS = { title: 100, description: 300, template: 4_000 } as const;

export interface UseCaseFields {
  title: string;
  description: string;
  template: string;
  useDocuments: boolean;
}

export interface UseCaseFile {
  format: typeof USE_CASE_FILE_FORMAT;
  version: typeof USE_CASE_FILE_VERSION;
  exportedAt: string;
  useCases: UseCaseFields[];
}

export class UseCaseFileError extends Error {}

export function exportUseCaseFile(items: UseCaseFields[], now = new Date()): UseCaseFile {
  return {
    format: USE_CASE_FILE_FORMAT,
    version: USE_CASE_FILE_VERSION,
    exportedAt: now.toISOString(),
    useCases: items.map(({ title, description, template, useDocuments }) => ({ title, description, template, useDocuments })),
  };
}

function field(entry: Record<string, unknown>, name: keyof typeof USE_CASE_LIMITS, index: number, required: boolean): string {
  const value = entry[name];
  if (value !== undefined && typeof value !== 'string') throw new UseCaseFileError(`useCases[${index}].${name} must be a string`);
  const s = ((value as string | undefined) ?? '').trim();
  if (required && !s) throw new UseCaseFileError(`useCases[${index}].${name} is required`);
  if (s.length > USE_CASE_LIMITS[name]) throw new UseCaseFileError(`useCases[${index}].${name} is longer than ${USE_CASE_LIMITS[name]} characters`);
  return s;
}

/** Validate a parsed file. Throws UseCaseFileError naming the first problem. */
export function parseUseCaseFile(data: unknown): UseCaseFields[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new UseCaseFileError('the file is not a use case export');
  const file = data as Record<string, unknown>;
  if (file.format !== USE_CASE_FILE_FORMAT) throw new UseCaseFileError(`format must be "${USE_CASE_FILE_FORMAT}"`);
  if (file.version !== USE_CASE_FILE_VERSION) throw new UseCaseFileError(`version ${String(file.version)} is not supported (expected ${USE_CASE_FILE_VERSION})`);
  if (!Array.isArray(file.useCases) || file.useCases.length === 0) throw new UseCaseFileError('useCases must be a non-empty list');
  if (file.useCases.length > MAX_USE_CASES_PER_FILE) throw new UseCaseFileError(`a file can hold up to ${MAX_USE_CASES_PER_FILE} use cases`);
  return file.useCases.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new UseCaseFileError(`useCases[${i}] is not an object`);
    const entry = raw as Record<string, unknown>;
    if (entry.useDocuments !== undefined && typeof entry.useDocuments !== 'boolean') {
      throw new UseCaseFileError(`useCases[${i}].useDocuments must be true or false`);
    }
    return {
      title: field(entry, 'title', i, true),
      description: field(entry, 'description', i, false),
      template: field(entry, 'template', i, true),
      useDocuments: entry.useDocuments === true,
    };
  });
}
