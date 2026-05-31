/**
 * RAG Pipeline — SID Permission Filter
 *
 * Handles SID-based document access control:
 * 1. Lambda-based filtering (preferred, when PERMISSION_FILTER_LAMBDA_ARN is set)
 * 2. Inline SID matching (fallback)
 *
 * Fail-Closed: If user SIDs cannot be retrieved, all documents are denied.
 */

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { UserAccessRecord, ParsedRetrievalResult, FilterResult, AllowedDocument } from './types';

const PERMISSION_FILTER_LAMBDA_ARN = process.env.PERMISSION_FILTER_LAMBDA_ARN || '';
const MULTIMODAL_ENABLED = process.env.MULTIMODAL_ENABLED === 'true';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1',
});

const lambdaClient = PERMISSION_FILTER_LAMBDA_ARN
  ? new LambdaClient({ region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1' })
  : null;

/**
 * Retrieve user SID/GID information from DynamoDB.
 * Returns null if table is not configured or user not found (Fail-Closed).
 */
export async function getUserSIDs(userId: string): Promise<UserAccessRecord | null> {
  const tableName = process.env.USER_ACCESS_TABLE_NAME;
  if (!tableName) return null;
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: tableName,
      Key: { userId: { S: userId } },
    }));
    if (!result.Item) return null;
    const item = unmarshall(result.Item);
    return {
      userId: item.userId,
      userSID: item.userSID || '',
      groupSIDs: item.groupSIDs || [],
      ...(item.accessSchedule ? { accessSchedule: item.accessSchedule } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Check if any user SID matches any document SID.
 * Returns false if docSIDs is empty or invalid (Fail-Closed).
 */
export function checkSIDAccess(userSIDs: string[], docSIDs: string[]): boolean {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return false;
  return userSIDs.some(sid => docSIDs.includes(sid));
}

/**
 * Invoke Permission Filter Lambda for SID filtering.
 * Returns null if Lambda is not configured or invocation fails (triggers inline fallback).
 */
async function invokePermissionFilterLambda(
  userId: string,
  parsedResults: ParsedRetrievalResult[],
): Promise<FilterResult | null> {
  if (!lambdaClient || !PERMISSION_FILTER_LAMBDA_ARN) return null;
  try {
    const resp = await lambdaClient.send(new InvokeCommand({
      FunctionName: PERMISSION_FILTER_LAMBDA_ARN,
      Payload: Buffer.from(JSON.stringify({
        userId,
        retrievalResults: parsedResults.map(r => ({
          content: r.content, s3Uri: r.s3Uri, score: r.score, metadata: r.metadata,
        })),
      })),
    }));
    if (resp.FunctionError) {
      console.error('[PermFilter Lambda] Error:', resp.FunctionError);
      return null;
    }
    const result = JSON.parse(new TextDecoder().decode(resp.Payload));
    console.log(`[PermFilter Lambda] ${result.allowedDocuments}/${result.totalDocuments} allowed`);
    return {
      allowed: result.allowed || [],
      filterLog: {
        totalDocuments: result.totalDocuments,
        allowedDocuments: result.allowedDocuments,
        deniedDocuments: result.deniedDocuments,
        userId: result.userId,
        userSIDs: result.userSIDs,
        filterMethod: result.filterMethod,
        details: result.filterLog,
        timestamp: new Date().toISOString(),
        source: 'lambda',
      },
    };
  } catch (error) {
    console.error('[PermFilter Lambda] Invocation failed, falling back to inline:', error);
    return null;
  }
}

/**
 * Parse document SIDs from metadata (handles various formats).
 */
function parseDocumentSIDs(metadata: Record<string, unknown>): string[] {
  const raw = metadata?.allowed_group_sids ??
    (metadata?.metadataAttributes as Record<string, unknown>)?.allowed_group_sids;
  if (Array.isArray(raw)) {
    return (raw as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s);
  }
  if (typeof raw === 'string') {
    try {
      return (JSON.parse(raw) as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s);
    } catch {
      return [raw.replace(/^"|"$/g, '')];
    }
  }
  return [];
}

/**
 * Execute SID-based permission filtering on retrieval results.
 *
 * Strategy:
 * 1. Try Lambda-based filtering (if configured)
 * 2. Fall back to inline SID matching
 *
 * Fail-Closed: No SIDs → all documents denied.
 */
export async function filterByPermissions(
  userId: string,
  parsedResults: ParsedRetrievalResult[],
): Promise<FilterResult> {
  // Try Lambda first
  const lambdaResult = await invokePermissionFilterLambda(userId, parsedResults);
  if (lambdaResult) {
    return {
      allowed: lambdaResult.allowed.map((a, i) => ({
        ...a,
        mediaType: MULTIMODAL_ENABLED ? parsedResults[i]?.mediaType : undefined,
      })),
      filterLog: lambdaResult.filterLog,
    };
  }

  // Inline fallback
  const userAccess = await getUserSIDs(userId);
  const allUserSIDs: string[] = [];
  if (userAccess) {
    if (userAccess.userSID) allUserSIDs.push(userAccess.userSID);
    if (Array.isArray(userAccess.groupSIDs)) allUserSIDs.push(...userAccess.groupSIDs);
  }

  type FilterDetail = { fileName: string; documentSIDs: string[]; matched: boolean; matchedSID?: string };
  const details: FilterDetail[] = [];
  const allowed: AllowedDocument[] = [];

  for (const r of parsedResults) {
    const fileName = r.s3Uri.split('/').pop() || r.s3Uri;
    const docSIDs = parseDocumentSIDs(r.metadata);
    const ok = allUserSIDs.length > 0 && checkSIDAccess(allUserSIDs, docSIDs);
    const matchedSID = ok ? allUserSIDs.find(s => docSIDs.includes(s)) : undefined;
    details.push({ fileName, documentSIDs: docSIDs, matched: ok, matchedSID });
    if (ok) {
      allowed.push({
        fileName, s3Uri: r.s3Uri, content: r.content, metadata: r.metadata,
        mediaType: MULTIMODAL_ENABLED ? r.mediaType : undefined,
      });
    }
  }

  return {
    allowed,
    filterLog: {
      totalDocuments: parsedResults.length,
      allowedDocuments: allowed.length,
      deniedDocuments: parsedResults.length - allowed.length,
      userId,
      userSIDs: allUserSIDs,
      filterMethod: allUserSIDs.length > 0 ? 'SID_MATCHING' : 'DENY_ALL',
      details,
      timestamp: new Date().toISOString(),
      source: 'inline',
    },
  };
}
