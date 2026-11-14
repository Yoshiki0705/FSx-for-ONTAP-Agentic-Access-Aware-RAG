/**
 * permission-search handler: the AgentCore Gateway tool that is the agents' permission
 * boundary. The SID filter is the real one (docker/nextjs/src/lib/rag-pipeline/sid-filter.ts);
 * only DynamoDB and the Knowledge Base client are replaced.
 */
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const ddb = mockClient(DynamoDBClient);
const kb = mockClient(BedrockAgentRuntimeClient);

process.env.KNOWLEDGE_BASE_ID = 'KBTEST0001';
process.env.USER_ACCESS_TABLE_NAME = 'user-access';
delete process.env.PERMISSION_FILTER_LAMBDA_ARN;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler, clampMaxResults } = require('../index');

const doc = (name: string, sids: string[], score = 0.9) => ({
  content: { text: `body of ${name}` },
  location: { type: 'S3' as const, s3Location: { uri: `s3://bucket/${name}` } },
  score,
  metadata: { allowed_group_sids: JSON.stringify(sids) },
});

beforeEach(() => {
  ddb.reset();
  kb.reset();
});

describe('clampMaxResults', () => {
  it.each([
    [undefined, 5],
    ['x', 5],
    [0, 1],
    [-3, 1],
    [3.7, 3],
    ['7', 7],
    [50, 10],
  ])('%p -> %p', (input, expected) => {
    expect(clampMaxResults(input)).toBe(expected);
  });
});

describe('handler', () => {
  it('returns nothing and does not search when userId is missing (fail-closed)', async () => {
    const out = await handler({ query: 'contract' });
    expect(out.count).toBe(0);
    expect(out.filterLog.filterMethod).toBe('DENY_ALL');
    expect(kb.commandCalls(RetrieveCommand)).toHaveLength(0);
  });

  it('rejects an empty query', async () => {
    const out = await handler({ query: '  ', userId: 'u1' });
    expect(out.error).toBe('query is required');
    expect(kb.commandCalls(RetrieveCommand)).toHaveLength(0);
  });

  it('returns only documents whose SIDs match the user', async () => {
    kb.on(RetrieveCommand).resolves({
      retrievalResults: [
        doc('public.md', ['S-1-1-0']),
        doc('legal-only.md', ['S-1-5-21-1-1100']),
        doc('hr-only.md', ['S-1-5-21-1-1200']),
      ],
    });
    ddb.on(GetItemCommand).resolves({
      Item: { userId: { S: 'u1' }, userSID: { S: 'S-1-5-21-1-1001' }, groupSIDs: { L: [{ S: 'S-1-1-0' }, { S: 'S-1-5-21-1-1100' }] } },
    });
    const out = await handler({ query: 'contract', userId: 'u1', maxResults: 5 });
    expect(out.results.map((r: { fileName: string }) => r.fileName)).toEqual(['public.md', 'legal-only.md']);
    expect(out.filterLog.filterMethod).toBe('SID_MATCHING');
    expect(kb.commandCalls(RetrieveCommand)[0].args[0].input.retrievalConfiguration?.vectorSearchConfiguration?.numberOfResults).toBe(15);
  });

  it('denies everything for a user without an access record', async () => {
    kb.on(RetrieveCommand).resolves({ retrievalResults: [doc('public.md', ['S-1-1-0'])] });
    ddb.on(GetItemCommand).resolves({});
    const out = await handler({ query: 'contract', userId: 'nobody' });
    expect(out.count).toBe(0);
    expect(out.filterLog.filterMethod).toBe('DENY_ALL');
  });

  it('cuts the allowed list to maxResults and ranks from 1', async () => {
    kb.on(RetrieveCommand).resolves({
      retrievalResults: [doc('a.md', ['S-1-1-0']), doc('b.md', ['S-1-1-0']), doc('c.md', ['S-1-1-0'])],
    });
    ddb.on(GetItemCommand).resolves({ Item: { userId: { S: 'u1' }, userSID: { S: 'S-1-1-0' } } });
    const out = await handler({ query: 'q', userId: 'u1', maxResults: 2 });
    expect(out.results.map((r: { rank: number }) => r.rank)).toEqual([1, 2]);
    expect(out.count).toBe(2);
  });
});
