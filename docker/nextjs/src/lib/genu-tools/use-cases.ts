/**
 * Saved use cases (the use case builder): prompt templates a user creates on screen and
 * runs later, without code. One DynamoDB item per use case, keyed by the signed-in user.
 * `{{input}}` in the template is replaced by the text typed when running it; `useDocuments`
 * adds the documents the user running it may read.
 *
 * Sharing (USE_CASE_SHARING_ENABLED=true): the owner can mark a use case shared. Every
 * signed-in user can then list, run and copy it; only the owner can change or delete it,
 * and an administrator can stop sharing it. A shared item carries `sharedPartition`, the
 * key of the sparse index `shared-index`, so only shared items are in that index. Running a
 * shared use case searches the documents of the user running it, never the owner's. The
 * owner of a shared item is not returned to other users (`ownedByMe` only).
 */
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ToolInputError } from './text-model';
import { USE_CASE_LIMITS, type UseCaseFields } from './use-case-file';

export const MAX_USE_CASES_PER_USER = 50;
/** Shared use cases listed at most (a demo-sized catalog; the index is queried once). */
export const MAX_SHARED_LISTED = 200;
const SHARED = 'shared';
export const SHARED_INDEX = 'shared-index';

export interface UseCase {
  userId: string;
  useCaseId: string;
  title: string;
  description: string;
  template: string;
  useDocuments: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present (value `shared`) only on shared items: the sparse index key. */
  sharedPartition?: string;
  sharedAt?: string;
}

/** What the API returns: no owner ID. */
export interface UseCaseView extends UseCaseFields {
  useCaseId: string;
  shared: boolean;
  ownedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

let ddb: { send: (cmd: unknown) => Promise<unknown> } | null = null;
function client(): { send: (cmd: unknown) => Promise<unknown> } {
  ddb ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' }),
  ) as unknown as { send: (cmd: unknown) => Promise<unknown> };
  return ddb;
}
export function __setUseCaseClient(c: { send: (cmd: unknown) => Promise<unknown> } | null): void {
  ddb = c;
}
function table(): string {
  const name = process.env.USE_CASES_TABLE_NAME;
  if (!name) throw new ToolInputError('the use case table is not configured');
  return name;
}
export function useCaseSharingEnabled(): boolean {
  return process.env.USE_CASE_SHARING_ENABLED === 'true';
}
function text(value: unknown, max: number, field: string, required = false): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new ToolInputError(`${field} is required`);
  if (s.length > max) throw new ToolInputError(`${field} is longer than ${max} characters`);
  return s;
}

export function toView(item: UseCase, userId: string): UseCaseView {
  return {
    useCaseId: item.useCaseId,
    title: item.title,
    description: item.description,
    template: item.template,
    useDocuments: item.useDocuments,
    shared: item.sharedPartition === SHARED,
    ownedByMe: item.userId === userId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function buildUseCase(userId: string, input: Record<string, unknown>, existing?: UseCase): UseCase {
  const now = new Date().toISOString();
  const wasShared = existing?.sharedPartition === SHARED;
  // `shared` is honoured only while sharing is enabled; turning the flag off leaves existing
  // items as they are but lets no one newly share.
  const shared = useCaseSharingEnabled() && typeof input.shared === 'boolean' ? input.shared : wasShared;
  const item: UseCase = {
    userId,
    useCaseId: existing?.useCaseId || `uc-${randomUUID().slice(0, 12)}`,
    title: text(input.title ?? existing?.title, USE_CASE_LIMITS.title, 'title', true),
    description: text(input.description ?? existing?.description, USE_CASE_LIMITS.description, 'description'),
    template: text(input.template ?? existing?.template, USE_CASE_LIMITS.template, 'template', true),
    useDocuments: typeof input.useDocuments === 'boolean' ? input.useDocuments : existing?.useDocuments ?? false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (shared) {
    item.sharedPartition = SHARED;
    item.sharedAt = wasShared && existing?.sharedAt ? existing.sharedAt : now;
  }
  return item;
}

async function ownItems(userId: string): Promise<UseCase[]> {
  const out = (await client().send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      Limit: MAX_USE_CASES_PER_USER,
    }),
  )) as { Items?: UseCase[] };
  return out.Items || [];
}

export async function listUseCases(userId: string): Promise<UseCaseView[]> {
  return (await ownItems(userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((i) => toView(i, userId));
}

/** Shared use cases of every user, newest first. Empty while sharing is disabled. */
export async function listSharedUseCases(userId: string): Promise<UseCaseView[]> {
  if (!useCaseSharingEnabled()) return [];
  const out = (await client().send(
    new QueryCommand({
      TableName: table(),
      IndexName: SHARED_INDEX,
      KeyConditionExpression: 'sharedPartition = :s',
      ExpressionAttributeValues: { ':s': SHARED },
      Limit: MAX_SHARED_LISTED,
    }),
  )) as { Items?: UseCase[] };
  return (out.Items || [])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((i) => toView(i, userId));
}

export async function getUseCase(userId: string, useCaseId: string): Promise<UseCase | null> {
  const out = (await client().send(new GetCommand({ TableName: table(), Key: { userId, useCaseId } }))) as { Item?: UseCase };
  return out.Item || null;
}

async function findShared(useCaseId: string): Promise<UseCase | null> {
  const out = (await client().send(
    new QueryCommand({
      TableName: table(),
      IndexName: SHARED_INDEX,
      KeyConditionExpression: 'sharedPartition = :s AND useCaseId = :id',
      ExpressionAttributeValues: { ':s': SHARED, ':id': useCaseId },
      Limit: 1,
    }),
  )) as { Items?: UseCase[] };
  return out.Items?.[0] || null;
}

/** A use case the user may run: their own, or a shared one while sharing is enabled. */
export async function getRunnableUseCase(userId: string, useCaseId: string): Promise<UseCase | null> {
  if (!useCaseId) return null;
  const own = await getUseCase(userId, useCaseId);
  if (own) return own;
  return useCaseSharingEnabled() ? findShared(useCaseId) : null;
}

export async function saveUseCase(userId: string, input: Record<string, unknown>): Promise<UseCaseView> {
  const id = typeof input.useCaseId === 'string' ? input.useCaseId : '';
  const existing = id ? await getUseCase(userId, id) : null;
  // Another user's ID (shared or not) is "not found": only the owner's key reaches the item.
  if (id && !existing) throw new ToolInputError('use case not found');
  if (!existing && (await ownItems(userId)).length >= MAX_USE_CASES_PER_USER) {
    throw new ToolInputError(`a user can save up to ${MAX_USE_CASES_PER_USER} use cases`);
  }
  const item = buildUseCase(userId, input, existing || undefined);
  await client().send(new PutCommand({ TableName: table(), Item: item }));
  return toView(item, userId);
}

export async function deleteUseCase(userId: string, useCaseId: string): Promise<void> {
  await client().send(new DeleteCommand({ TableName: table(), Key: { userId, useCaseId } }));
}

/**
 * Stop sharing. The owner may stop sharing their own; an administrator may stop sharing
 * anyone's (the item stays with its owner, private). Returns false when there is nothing
 * the caller may unshare.
 */
export async function unshareUseCase(userId: string, useCaseId: string, isAdmin: boolean): Promise<boolean> {
  const own = await getUseCase(userId, useCaseId);
  const target = own ?? (isAdmin ? await findShared(useCaseId) : null);
  if (!target || target.sharedPartition !== SHARED) return false;
  await client().send(
    new UpdateCommand({
      TableName: table(),
      Key: { userId: target.userId, useCaseId: target.useCaseId },
      UpdateExpression: 'REMOVE sharedPartition, sharedAt',
      ConditionExpression: 'attribute_exists(useCaseId)',
    }),
  );
  return true;
}

/**
 * Create private use cases from a validated file, all or none (one transaction), within
 * the per-user limit.
 */
export async function importUseCases(userId: string, entries: UseCaseFields[]): Promise<UseCaseView[]> {
  const count = (await ownItems(userId)).length;
  if (count + entries.length > MAX_USE_CASES_PER_USER) {
    throw new ToolInputError(
      `importing ${entries.length} would exceed ${MAX_USE_CASES_PER_USER} use cases (you have ${count})`,
    );
  }
  const items = entries.map((e) =>
    buildUseCase(userId, { title: e.title, description: e.description, template: e.template, useDocuments: e.useDocuments, shared: false }),
  );
  await client().send(
    new TransactWriteCommand({
      TransactItems: items.map((Item) => ({
        Put: { TableName: table(), Item, ConditionExpression: 'attribute_not_exists(useCaseId)' },
      })),
    }),
  );
  return items.map((i) => toView(i, userId));
}
