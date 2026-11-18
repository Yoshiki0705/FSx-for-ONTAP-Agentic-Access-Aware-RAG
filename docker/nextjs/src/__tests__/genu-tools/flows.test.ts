// @vitest-environment node
/**
 * Calling Bedrock Flows (docs/mcp-flows-threat-model.md): only registered flows, and only when
 * the version the alias points to has no node type that reads internal data or writes outside.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setFlowClients, disallowedNodeTypes, flowsConfig, nodeTypesOf } from '@/lib/genu-tools/flows';
import { runTool, toolsConfig, ToolInputError } from '@/lib/genu-tools';

const FLOW = 'FLOWAAAAA1';
const ALIAS = 'ALIASAAAA1';
const node = (type: string, name = type.toLowerCase(), inner?: unknown[]) =>
  ({ type, name, ...(inner ? { configuration: { loop: { definition: { nodes: inner } } } } : {}) });
const safe = [node('Input', 'FlowInputNode'), node('Prompt'), node('Output')];

let definition: { nodes: unknown[] };
let routing: { flowVersion: string }[];
const invoked: any[] = [];
const logs: string[] = [];

beforeEach(() => {
  definition = { nodes: safe };
  routing = [{ flowVersion: '3' }];
  invoked.length = 0;
  logs.length = 0;
  process.env.FLOWS_CONFIG = JSON.stringify([{ key: 'summary', flowId: FLOW, aliasId: ALIAS, name: 'Summary', description: 'Summarize text' }]);
  __setFlowClients(
    {
      send: async (cmd: any) => {
        const name = cmd.constructor.name;
        if (name === 'GetFlowAliasCommand') return { routingConfiguration: routing };
        if (name === 'GetFlowVersionCommand') return { definition };
        throw new Error(`unexpected ${name}`);
      },
    },
    {
      send: async (cmd: any) => {
        invoked.push(cmd.input);
        return {
          responseStream: (async function* () {
            yield { flowOutputEvent: { content: { document: 'the summary' } } };
            yield { flowCompletionEvent: { completionReason: 'SUCCESS' } };
          })(),
        };
      },
    },
  );
  vi.spyOn(console, 'log').mockImplementation((m: string) => { logs.push(String(m)); });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  __setFlowClients(null, null);
  delete process.env.FLOWS_CONFIG;
  vi.restoreAllMocks();
});

describe('flowsConfig', () => {
  it('reads the registered flows and drops malformed IDs', () => {
    process.env.FLOWS_CONFIG = JSON.stringify([{ key: 'a', flowId: FLOW, aliasId: ALIAS, name: 'A' }, { key: 'b', flowId: 'bad', aliasId: ALIAS }]);
    expect(flowsConfig().map((f) => f.key)).toEqual(['a']);
  });
  it('is empty without the setting or with invalid JSON', () => {
    expect(flowsConfig({})).toEqual([]);
    expect(flowsConfig({ FLOWS_CONFIG: '{oops' })).toEqual([]);
  });
  it('gives the screen keys and names, not the flow or alias IDs', () => {
    const cfg = toolsConfig();
    expect(cfg.tools.flows).toBe(true);
    expect(cfg.flows).toEqual([{ key: 'summary', name: 'Summary', description: 'Summarize text' }]);
    expect(JSON.stringify(cfg)).not.toContain(FLOW);
  });
});

describe('node check', () => {
  it('allows input, prompt, condition, iterator, collector, output and loops of them', () => {
    const def = { nodes: [...safe, node('Condition'), node('Iterator'), node('Collector'), node('Loop', 'loop', [node('LoopInput'), node('Prompt'), node('LoopController')])] };
    expect(disallowedNodeTypes(def)).toEqual([]);
  });
  it.each(['KnowledgeBase', 'Agent', 'Retrieval', 'Storage', 'LambdaFunction', 'InlineCode', 'Lex', 'SomethingNew'])('refuses %s', (type) => {
    expect(disallowedNodeTypes({ nodes: [...safe, node(type)] })).toEqual([type]);
  });
  it('finds a knowledge base node inside a loop', () => {
    const def = { nodes: [...safe, node('Loop', 'loop', [node('LoopInput'), node('KnowledgeBase'), node('LoopController')])] };
    expect(nodeTypesOf(def)).toContain('KnowledgeBase');
    expect(disallowedNodeTypes(def)).toEqual(['KnowledgeBase']);
  });
});

describe('runFlow', () => {
  it('calls the registered flow through its alias with the input node name, and returns the output', async () => {
    const out = await runTool('flow', 'u@example.com', { key: 'summary', text: 'long text' });
    expect(out).toMatchObject({ output: 'the summary', flow: 'Summary', version: '3' });
    expect(invoked).toEqual([{ flowIdentifier: FLOW, flowAliasIdentifier: ALIAS, inputs: [{ nodeName: 'FlowInputNode', nodeOutputName: 'document', content: { document: 'long text' } }] }]);
  });

  it('refuses a flow whose current version has a knowledge base node, without invoking it', async () => {
    definition = { nodes: [...safe, node('KnowledgeBase')] };
    await expect(runTool('flow', 'u@example.com', { key: 'summary', text: 'x' })).rejects.toThrow(/not allowed here: KnowledgeBase/);
    expect(invoked).toHaveLength(0);
  });

  it('refuses an alias that splits traffic between versions', async () => {
    routing = [{ flowVersion: '3' }, { flowVersion: '4' }];
    await expect(runTool('flow', 'u@example.com', { key: 'summary', text: 'x' })).rejects.toBeInstanceOf(ToolInputError);
    expect(invoked).toHaveLength(0);
  });

  it('refuses an unknown key and never takes an ID from the request', async () => {
    await expect(runTool('flow', 'u@example.com', { key: FLOW, text: 'x' })).rejects.toThrow('flow not found');
    await expect(runTool('flow', 'u@example.com', { key: 'other', flowId: FLOW, aliasId: ALIAS, text: 'x' })).rejects.toThrow('flow not found');
    expect(invoked).toHaveLength(0);
  });

  it('logs the decision and the user without the input text', async () => {
    await runTool('flow', 'u@example.com', { key: 'summary', text: 'SECRET INPUT' });
    definition = { nodes: [...safe, node('LambdaFunction')] };
    await runTool('flow', 'u@example.com', { key: 'summary', text: 'SECRET INPUT' }).catch(() => undefined);
    const entries = logs.filter((l) => l.includes('flow_call')).map((l) => JSON.parse(l));
    expect(entries.map((e) => e.decision)).toEqual(['called', 'refused']);
    expect(entries[1].nodeTypes).toEqual(['LambdaFunction']);
    expect(logs.join('\n')).not.toContain('SECRET INPUT');
  });
});
