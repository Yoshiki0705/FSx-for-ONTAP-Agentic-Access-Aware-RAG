// @vitest-environment node
/**
 * Use case sharing and the export/import file. The table is an in-memory stand-in that
 * answers the document client's commands, including the sparse `shared-index`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { session } = vi.hoisted(() => ({ session: { user: 'a@example.com' as string | null, role: 'user' } }));
vi.mock('@/lib/agent-backend', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/agent-backend')>();
  return { ...real, sessionUserId: async () => session.user };
});
vi.mock('@/lib/auth/roles', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/auth/roles')>();
  return { ...real, sessionClaims: async () => (session.user ? { userId: session.user, role: session.role } : null) };
});

import { NextRequest } from 'next/server';
import { __setUseCaseClient, getRunnableUseCase, MAX_USE_CASES_PER_USER, type UseCase } from '@/lib/genu-tools/use-cases';
import { exportUseCaseFile, parseUseCaseFile, UseCaseFileError } from '@/lib/genu-tools/use-case-file';

type Item = UseCase & Record<string, unknown>;
const rows = new Map<string, Item>();
const key = (userId: string, useCaseId: string) => `${userId}|${useCaseId}`;
const calls: string[] = [];

function fakeTable() {
  __setUseCaseClient({
    send: async (cmd: unknown) => {
      const name = (cmd as object).constructor.name;
      const input = (cmd as { input: Record<string, any> }).input;
      calls.push(name);
      switch (name) {
        case 'GetCommand':
          return { Item: rows.get(key(input.Key.userId, input.Key.useCaseId)) };
        case 'PutCommand':
          rows.set(key(input.Item.userId, input.Item.useCaseId), { ...input.Item });
          return {};
        case 'DeleteCommand':
          rows.delete(key(input.Key.userId, input.Key.useCaseId));
          return {};
        case 'UpdateCommand': {
          const row = rows.get(key(input.Key.userId, input.Key.useCaseId));
          if (!row) throw new Error('ConditionalCheckFailed');
          delete row.sharedPartition;
          delete row.sharedAt;
          return {};
        }
        case 'QueryCommand': {
          const v = input.ExpressionAttributeValues;
          let items = [...rows.values()];
          if (input.IndexName === 'shared-index') {
            items = items.filter((i) => i.sharedPartition === v[':s'] && (!v[':id'] || i.useCaseId === v[':id']));
          } else {
            items = items.filter((i) => i.userId === v[':u']);
          }
          return { Items: items.slice(0, input.Limit) };
        }
        case 'TransactWriteCommand':
          for (const t of input.TransactItems) rows.set(key(t.Put.Item.userId, t.Put.Item.useCaseId), { ...t.Put.Item });
          return {};
        default:
          throw new Error(`unexpected ${name}`);
      }
    },
  });
}

const post = (body: unknown) => new NextRequest('http://l/api/tools/use-cases', { method: 'POST', body: JSON.stringify(body) });
async function route() {
  return import('@/app/api/tools/use-cases/route');
}
async function as(user: string, role = 'user') {
  session.user = user;
  session.role = role;
}

beforeEach(() => {
  rows.clear();
  calls.length = 0;
  process.env.USE_CASES_TABLE_NAME = 'use-cases';
  process.env.USE_CASE_SHARING_ENABLED = 'true';
  fakeTable();
  as('a@example.com');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  __setUseCaseClient(null);
  delete process.env.USE_CASE_SHARING_ENABLED;
  vi.restoreAllMocks();
});

async function create(body: Record<string, unknown>) {
  const res = await (await route()).POST(post({ title: 'T', template: 'Do {{input}}', ...body }));
  return (await res.json()).useCase;
}

describe('sharing', () => {
  it('shows a shared use case to other users without its owner', async () => {
    const uc = await create({ title: 'Weekly report', shared: true });
    await as('b@example.com');
    const data = await (await (await route()).GET()).json();
    expect(data.useCases).toEqual([]);
    expect(data.shared).toHaveLength(1);
    expect(data.shared[0]).toMatchObject({ useCaseId: uc.useCaseId, title: 'Weekly report', shared: true, ownedByMe: false });
    expect(JSON.stringify(data)).not.toContain('a@example.com');
  });

  it('keeps a use case private unless shared', async () => {
    await create({ title: 'Private' });
    await as('b@example.com');
    const data = await (await (await route()).GET()).json();
    expect(data.shared).toEqual([]);
  });

  it('lets another user run a shared use case but not a private one', async () => {
    const shared = await create({ shared: true });
    const priv = await create({ title: 'P' });
    expect(await getRunnableUseCase('b@example.com', shared.useCaseId)).toMatchObject({ useCaseId: shared.useCaseId });
    expect(await getRunnableUseCase('b@example.com', priv.useCaseId)).toBeNull();
  });

  it('does not let another user edit or delete a shared use case', async () => {
    const uc = await create({ title: 'Original', shared: true });
    await as('b@example.com');
    const r = await (await route()).POST(post({ useCaseId: uc.useCaseId, title: 'Changed', template: 'x' }));
    expect(r.status).toBe(400);
    await (await route()).DELETE(new NextRequest(`http://l/api/tools/use-cases?useCaseId=${uc.useCaseId}`, { method: 'DELETE' }));
    expect(rows.get(key('a@example.com', uc.useCaseId))?.title).toBe('Original');
  });

  it('lets the owner stop sharing by saving with shared=false, keeping the use case', async () => {
    const uc = await create({ shared: true });
    await (await route()).POST(post({ useCaseId: uc.useCaseId, shared: false }));
    expect(rows.get(key('a@example.com', uc.useCaseId))?.sharedPartition).toBeUndefined();
  });

  it('lets an administrator stop sharing anyone\'s, and refuses other users (404)', async () => {
    const uc = await create({ shared: true });
    await as('b@example.com');
    expect((await (await route()).POST(post({ action: 'unshare', useCaseId: uc.useCaseId }))).status).toBe(404);
    expect(rows.get(key('a@example.com', uc.useCaseId))?.sharedPartition).toBe('shared');
    await as('admin@example.com', 'administrator');
    expect((await (await route()).POST(post({ action: 'unshare', useCaseId: uc.useCaseId }))).status).toBe(200);
    const row = rows.get(key('a@example.com', uc.useCaseId));
    expect(row?.sharedPartition).toBeUndefined();
    expect(row?.title).toBe('T');
  });

  it('refuses sharing while the feature is off, and lists nothing shared', async () => {
    process.env.USE_CASE_SHARING_ENABLED = 'false';
    expect((await (await route()).POST(post({ title: 'T', template: 'x', shared: true }))).status).toBe(400);
    const data = await (await (await route()).GET()).json();
    expect(data.sharingEnabled).toBe(false);
    expect(data.shared).toEqual([]);
    expect(calls).not.toContain('TransactWriteCommand');
  });

  it('does not run another user\'s shared use case once sharing is off', async () => {
    const uc = await create({ shared: true });
    process.env.USE_CASE_SHARING_ENABLED = 'false';
    expect(await getRunnableUseCase('b@example.com', uc.useCaseId)).toBeNull();
  });

  it('refuses without a session (401)', async () => {
    session.user = null;
    expect((await (await route()).GET()).status).toBe(401);
  });
});

describe('export and import', () => {
  const file = (n: number) => exportUseCaseFile(Array.from({ length: n }, (_, i) => ({ title: `T${i}`, description: '', template: 'Do {{input}}', useDocuments: i % 2 === 0 })));

  it('exports only the fields of a use case', () => {
    const f = exportUseCaseFile([{ useCaseId: 'uc-1', userId: 'a@example.com', title: 'T', description: 'D', template: 'X', useDocuments: true } as never]);
    expect(f).toMatchObject({ format: 'rag-use-cases', version: 1 });
    expect(f.useCases).toEqual([{ title: 'T', description: 'D', template: 'X', useDocuments: true }]);
  });

  it('round-trips: imported use cases are new, private and the user\'s own', async () => {
    const original = await create({ title: 'Mine', shared: true });
    const exported = exportUseCaseFile([original]);
    await as('b@example.com');
    const res = await (await route()).POST(post({ action: 'import', file: exported }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(1);
    const [copy] = data.useCases;
    expect(copy.useCaseId).not.toBe(original.useCaseId);
    expect(copy).toMatchObject({ title: 'Mine', shared: false, ownedByMe: true });
    expect(rows.get(key('b@example.com', copy.useCaseId))?.sharedPartition).toBeUndefined();
  });

  it.each([
    ['another format', { format: 'x', version: 1, useCases: [{ title: 'T', template: 'x' }] }, /format/],
    ['an unknown version', { format: 'rag-use-cases', version: 2, useCases: [{ title: 'T', template: 'x' }] }, /version 2/],
    ['no entries', { format: 'rag-use-cases', version: 1, useCases: [] }, /non-empty/],
    ['a missing title', { format: 'rag-use-cases', version: 1, useCases: [{ template: 'x' }] }, /useCases\[0\]\.title is required/],
    ['a template too long', { format: 'rag-use-cases', version: 1, useCases: [{ title: 'T', template: 'x'.repeat(4001) }] }, /longer than 4000/],
    ['a non-boolean useDocuments', { format: 'rag-use-cases', version: 1, useCases: [{ title: 'T', template: 'x', useDocuments: 'yes' }] }, /true or false/],
  ])('rejects %s', (_name, data, message) => {
    expect(() => parseUseCaseFile(data)).toThrow(UseCaseFileError);
    expect(() => parseUseCaseFile(data)).toThrow(message);
  });

  it('rejects a file over 50 entries, and an import that would pass the per-user limit, writing nothing', async () => {
    expect(() => parseUseCaseFile(file(51))).toThrow(/up to 50/);
    for (let i = 0; i < MAX_USE_CASES_PER_USER - 2; i++) await create({ title: `E${i}` });
    const before = rows.size;
    const res = await (await route()).POST(post({ action: 'import', file: file(3) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/would exceed 50/);
    expect(rows.size).toBe(before);
  });

  it('writes an import in one transaction', async () => {
    await (await route()).POST(post({ action: 'import', file: file(5) }));
    expect(calls.filter((c) => c === 'TransactWriteCommand')).toHaveLength(1);
    expect(calls).not.toContain('PutCommand');
  });
});
