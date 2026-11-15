/**
 * Saved use cases (the use case builder): prompt templates a user creates on screen and
 * runs later, without code. One DynamoDB item per use case, keyed by the signed-in user, so
 * a user only sees and runs their own. `{{input}}` in the template is replaced by the text
 * typed when running it; `useDocuments` adds the documents that user may read.
 */
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ToolInputError } from './text-model';

export const MAX_USE_CASES_PER_USER = 50;
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 300;
const MAX_TEMPLATE = 4_000;

export interface UseCase {
  userId: string;
  useCaseId: string;
  title: string;
  description: string;
  template: string;
  useDocuments: boolean;
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

function text(value: unknown, max: number, field: string, required = false): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new ToolInputError(`${field} is required`);
  if (s.length > max) throw new ToolInputError(`${field} is longer than ${max} characters`);
  return s;
}

export function buildUseCase(userId: string, input: Record<string, unknown>, existing?: UseCase): UseCase {
  const now = new Date().toISOString();
  return {
    userId,
    useCaseId: existing?.useCaseId || `uc-${randomUUID().slice(0, 12)}`,
    title: text(input.title ?? existing?.title, MAX_TITLE, 'title', true),
    description: text(input.description ?? existing?.description, MAX_DESCRIPTION, 'description'),
    template: text(input.template ?? existing?.template, MAX_TEMPLATE, 'template', true),
    useDocuments: typeof input.useDocuments === 'boolean' ? input.useDocuments : existing?.useDocuments ?? false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export async function listUseCases(userId: string): Promise<UseCase[]> {
  const out = (await client().send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      Limit: MAX_USE_CASES_PER_USER,
    }),
  )) as { Items?: UseCase[] };
  return (out.Items || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getUseCase(userId: string, useCaseId: string): Promise<UseCase | null> {
  const out = (await client().send(new GetCommand({ TableName: table(), Key: { userId, useCaseId } }))) as { Item?: UseCase };
  return out.Item || null;
}

export async function saveUseCase(userId: string, input: Record<string, unknown>): Promise<UseCase> {
  const id = typeof input.useCaseId === 'string' ? input.useCaseId : '';
  const existing = id ? await getUseCase(userId, id) : null;
  if (id && !existing) throw new ToolInputError('use case not found');
  if (!existing && (await listUseCases(userId)).length >= MAX_USE_CASES_PER_USER) {
    throw new ToolInputError(`a user can save up to ${MAX_USE_CASES_PER_USER} use cases`);
  }
  const item = buildUseCase(userId, input, existing || undefined);
  await client().send(new PutCommand({ TableName: table(), Item: item }));
  return item;
}

export async function deleteUseCase(userId: string, useCaseId: string): Promise<void> {
  await client().send(new DeleteCommand({ TableName: table(), Key: { userId, useCaseId } }));
}
