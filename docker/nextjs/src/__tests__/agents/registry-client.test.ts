/**
 * Agent Registry client: the `agent-registry` namespace.
 *
 * The service's replies used in these tests have the shape returned by the real service
 * (checked against a live registry on 2026-11-22). The SDK clients are replaced so no call leaves the process.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dataSend, controlSend } = vi.hoisted(() => ({ dataSend: vi.fn(), controlSend: vi.fn() }));

vi.mock('@aws-sdk/client-agent-registry', () => {
  class Command { constructor(public input: Record<string, unknown>) {} }
  return {
    AgentRegistryClient: class { send = dataSend; },
    SearchDiscoverableRegistryRecordsCommand: class extends Command { name = 'Search'; },
    BatchGetDiscoverableRegistryRecordCommand: class extends Command { name = 'BatchGet'; },
  };
});
vi.mock('@aws-sdk/client-agent-registry-control', () => {
  class Command { constructor(public input: Record<string, unknown>) {} }
  return {
    AgentRegistryControlClient: class { send = controlSend; },
    CreateRegistryRecordCommand: class extends Command { name = 'Create'; },
    GetRegistryRecordCommand: class extends Command { name = 'Get'; },
    SubmitRegistryRecordForApprovalCommand: class extends Command { name = 'Submit'; },
    DeleteRegistryRecordCommand: class extends Command { name = 'Delete'; },
  };
});

import {
  RegistryClient,
  parseRegistryRef,
  toRecordName,
  toRegistryRecord,
  toRegistryRecordDetail,
} from '@/lib/agentcore/registry-client';

const ARN = 'arn:aws:agent-registry:ap-northeast-1:123456789012:registry/TN7xzH4Pr84kD4TZ';

const agentCard = JSON.stringify({
  name: 'storage-helper',
  url: 'https://example.com/a2a',
  skills: [{ id: 'faq', name: 'FAQ' }],
});

const summary = (over: Record<string, unknown> = {}) => ({
  registryArn: ARN,
  recordArn: `${ARN}/record/gwAmPtGMitYv`,
  recordId: 'gwAmPtGMitYv',
  name: 'storage-helper',
  displayName: 'Storage Helper Agent',
  description: 'Answers storage questions',
  recordType: 'AGENT',
  status: 'APPROVED',
  createdAt: new Date('2026-11-21T22:19:51Z'),
  updatedAt: new Date('2026-11-21T22:20:15Z'),
  descriptors: { a2aAgentCard: { data: agentCard, dataSchemaVersion: '0.3' } },
  ...over,
});

describe('record mapping', () => {
  it('maps the service record to the shape the screens use', () => {
    expect(toRegistryRecord(summary())).toEqual({
      resourceId: 'gwAmPtGMitYv',
      resourceName: 'Storage Helper Agent',
      resourceType: 'Agent',
      description: 'Answers storage questions',
      publisherName: '',
      createdAt: '2026-11-21T22:19:51.000Z',
      updatedAt: '2026-11-21T22:20:15.000Z',
      approvalStatus: 'APPROVED',
    });
  });

  it('falls back to the unique name when there is no display name, and to Custom for an unknown type', () => {
    const r = toRegistryRecord(summary({ displayName: undefined, recordType: 'SOMETHING_NEW' }));
    expect(r.resourceName).toBe('storage-helper');
    expect(r.resourceType).toBe('Custom');
  });

  it.each([
    ['APPROVED', 'APPROVED'],
    ['DRAFT', 'PENDING'],
    ['PENDING_APPROVAL', 'PENDING'],
    ['REJECTED', 'REJECTED'],
    ['DEPRECATED', 'REJECTED'],
  ])('reads status %s as %s', (status, expected) => {
    expect(toRegistryRecord(summary({ status })).approvalStatus).toBe(expected);
  });

  it('reads the protocol, endpoint and skills of an A2A agent card', () => {
    const d = toRegistryRecordDetail(summary());
    expect(d.protocols).toEqual(['A2A']);
    expect(d.invocationMethod).toBe('https://example.com/a2a');
    expect(d.relatedServices).toEqual(['FAQ']);
  });

  it('reads the tools of an MCP server', () => {
    const d = toRegistryRecordDetail(
      summary({
        recordType: 'MCP',
        descriptors: {
          mcpServer: {
            data: JSON.stringify({ url: 'https://mcp.example.com' }),
            additionalData: { tools: { data: JSON.stringify({ tools: [{ name: 'search_docs' }] }) } },
          },
        },
      }),
    );
    expect(d.protocols).toEqual(['MCP']);
    expect(d.mcpServerInfo).toEqual({ endpointUrl: 'https://mcp.example.com', tools: ['search_docs'], authMethod: '' });
  });

  it('reads the foundation model of an agent that was published from this app', () => {
    const d = toRegistryRecordDetail(
      summary({
        recordType: 'CUSTOM',
        descriptors: { custom: { data: JSON.stringify({ agentId: 'ABC123', foundationModel: 'tier:light' }) } },
      }),
    );
    expect(d.agentInfo).toEqual({ foundationModel: 'tier:light', actionGroups: [], knowledgeBases: [] });
  });

  it('adds nothing for a descriptor that is not JSON', () => {
    const d = toRegistryRecordDetail(summary({ descriptors: { custom: { data: 'plain text' } } }));
    expect(d.agentInfo).toBeUndefined();
    expect(d.protocols).toEqual([]);
  });
});

describe('names and references', () => {
  it('turns a display name into a valid record name', () => {
    expect(toRecordName('My Agent (v2)')).toBe('My-Agent--v2-');
    expect(toRecordName('  ')).toBe('record');
    expect(toRecordName('a'.repeat(100))).toHaveLength(64);
  });

  it('reads the region from a registry ARN, and nothing from a bare id', () => {
    expect(parseRegistryRef(ARN)).toEqual({ region: 'ap-northeast-1', id: 'TN7xzH4Pr84kD4TZ' });
    expect(parseRegistryRef('TN7xzH4Pr84kD4TZ')).toEqual({ id: 'TN7xzH4Pr84kD4TZ' });
  });
});

describe('RegistryClient', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    dataSend.mockReset();
    controlSend.mockReset();
    process.env.ENABLE_AGENT_REGISTRY = 'true';
    process.env.AGENT_REGISTRY_ARN = ARN;
    delete process.env.AGENT_REGISTRY_REGION;
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.useRealTimers();
  });

  it('refuses to call the service when no registry is configured, instead of sending an empty id', async () => {
    process.env.AGENT_REGISTRY_ARN = '';
    await expect(new RegistryClient().searchResources({ query: '' })).rejects.toMatchObject({
      code: 'REGISTRY_NOT_CONFIGURED',
      statusCode: 503,
    });
    expect(dataSend).not.toHaveBeenCalled();
  });

  it('is off unless the flag is set', async () => {
    process.env.ENABLE_AGENT_REGISTRY = 'false';
    await expect(new RegistryClient().searchResources({ query: '' })).rejects.toMatchObject({ code: 'REGISTRY_DISABLED', statusCode: 404 });
  });

  it('takes the region from the registry ARN', () => {
    expect(new RegistryClient().getRegion()).toBe('ap-northeast-1');
  });

  it('searches one registry, filters by record type and maps the page', async () => {
    dataSend.mockResolvedValue({ registryRecords: [summary()], nextToken: 'next-1' });
    const result = await new RegistryClient().searchResources({ query: 'faq', resourceType: 'McpServer', nextToken: 't0', maxResults: 50 });
    const sent = dataSend.mock.calls[0][0];
    expect(sent.input).toEqual({
      searchQuery: 'faq',
      registryIds: [ARN],
      maxResults: 20,
      nextToken: 't0',
      filters: { recordType: { $eq: 'MCP' } },
    });
    expect(result.records).toHaveLength(1);
    expect(result.nextToken).toBe('next-1');
    expect(result.registryRegion).toBe('ap-northeast-1');
  });

  it('lists the newest records for an empty query, and for "*"', async () => {
    dataSend.mockResolvedValue({ registryRecords: [] });
    await new RegistryClient().searchResources({ query: '*' });
    expect(dataSend.mock.calls[0][0].input.searchQuery).toBe('');
  });

  it('reports a record that cannot be read as 404', async () => {
    dataSend.mockResolvedValue({ registryRecords: [], errors: [{ errorCode: 'RESOURCE_NOT_FOUND', message: 'no such record' }] });
    await expect(new RegistryClient().getResource('doesnotexist')).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
  });

  it('carries the service status code on a failed call', async () => {
    dataSend.mockRejectedValue(Object.assign(new Error('boom'), { name: 'ThrottlingException', $metadata: { httpStatusCode: 429 } }));
    await expect(new RegistryClient().searchResources({ query: '' })).rejects.toMatchObject({ code: 'ThrottlingException', statusCode: 429 });
  });

  it('publishes by creating, waiting until the record leaves CREATING, then submitting', async () => {
    vi.useFakeTimers();
    controlSend
      .mockResolvedValueOnce({ recordArn: `${ARN}/record/X9462b1YAECs`, status: 'CREATING' }) // create
      .mockResolvedValueOnce({ status: 'CREATING' }) // get
      .mockResolvedValueOnce({ status: 'DRAFT' }) // get
      .mockResolvedValueOnce({ status: 'APPROVED' }); // submit
    const pending = new RegistryClient().createResource({
      resourceName: 'Live check agent',
      resourceType: 'Agent',
      description: 'd',
      metadata: { agentId: 'ABC123', foundationModel: 'tier:light' },
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({ resourceId: 'X9462b1YAECs', status: 'APPROVED' });
    const names = controlSend.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(['Create', 'Get', 'Get', 'Submit']);
    const created = controlSend.mock.calls[0][0].input;
    expect(created).toMatchObject({ registryId: ARN, name: 'Live-check-agent', displayName: 'Live check agent', recordType: 'CUSTOM' });
    expect(JSON.parse(created.descriptors.custom.data)).toMatchObject({ agentId: 'ABC123', foundationModel: 'tier:light' });
    expect(controlSend.mock.calls[3][0].input).toEqual({ registryId: ARN, recordId: 'X9462b1YAECs' });
  });

  it('does not submit a record whose creation failed', async () => {
    controlSend
      .mockResolvedValueOnce({ recordArn: `${ARN}/record/X9462b1YAECs`, status: 'CREATE_FAILED' });
    await expect(
      new RegistryClient().createResource({ resourceName: 'x', resourceType: 'Agent', description: '', metadata: {} }),
    ).rejects.toMatchObject({ code: 'RECORD_NOT_READY' });
    expect(controlSend.mock.calls.map((c) => c[0].name)).toEqual(['Create']);
  });

  it('deletes a record by id', async () => {
    controlSend.mockResolvedValue({});
    await expect(new RegistryClient().deleteResource('X9462b1YAECs')).resolves.toEqual({ success: true });
    expect(controlSend.mock.calls[0][0].input).toEqual({ registryId: ARN, recordId: 'X9462b1YAECs' });
  });
});
