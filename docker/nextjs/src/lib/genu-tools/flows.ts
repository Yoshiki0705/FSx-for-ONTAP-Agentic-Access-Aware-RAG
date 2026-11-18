/**
 * Calling Amazon Bedrock Flows (docs/mcp-flows-threat-model.md).
 *
 * A flow runs with its own service role, and a knowledge base node has no per-user filter,
 * so a flow that reads internal data would bypass the SID filter. Therefore:
 * - only flows an administrator registered (FLOWS_CONFIG, from CDK context `flows`) can be
 *   called, by their key, never by an ID from the request;
 * - before every call, the version the alias points to is read and its definition must
 *   consist only of ALLOWED_NODE_TYPES, including the nodes inside loops. Anything else
 *   (knowledge base, agent, S3 retrieval or storage, Lambda, inline code, Lex, or a type
 *   this code does not know) refuses the call without invoking the flow.
 * The result of the check and the call go to a structured log, without the input text.
 */
import { BedrockAgentClient, GetFlowAliasCommand, GetFlowVersionCommand } from '@aws-sdk/client-bedrock-agent';
import { BedrockAgentRuntimeClient, InvokeFlowCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { ToolInputError } from './text-model';

/** Node types that neither read internal data nor write outside. */
export const ALLOWED_NODE_TYPES = ['Input', 'Output', 'Prompt', 'Condition', 'Iterator', 'Collector', 'Loop', 'LoopInput', 'LoopController'] as const;
export const MAX_FLOW_INPUT_CHARS = 4_000;
const FLOW_ID = /^[0-9A-Z]{10}$/;

export interface FlowEntry {
  key: string;
  name: string;
  description: string;
  flowId: string;
  aliasId: string;
}

export class FlowRefusedError extends Error {
  constructor(message: string, public readonly nodeTypes: string[] = []) {
    super(message);
  }
}

/** The registered flows. An entry with a malformed ID is dropped (CDK validates them at synth). */
export function flowsConfig(env: Record<string, string | undefined> = process.env): FlowEntry[] {
  const raw = env.FLOWS_CONFIG;
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    console.warn(JSON.stringify({ event: 'flows_config', error: 'FLOWS_CONFIG is not JSON; no flows are offered' }));
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.flatMap((e, i): FlowEntry[] => {
    if (!e || typeof e !== 'object') return [];
    const o = e as Record<string, unknown>;
    const flowId = String(o.flowId ?? '');
    const aliasId = String(o.aliasId ?? '');
    if (!FLOW_ID.test(flowId) || !FLOW_ID.test(aliasId)) return [];
    return [{
      key: String(o.key || `flow-${i + 1}`),
      name: String(o.name || o.flowName || flowId).slice(0, 100),
      description: String(o.description || '').slice(0, 500),
      flowId,
      aliasId,
    }];
  });
}

type Node = { type?: string; name?: string; configuration?: { loop?: { definition?: { nodes?: Node[] } } } };

/** Node types in a flow definition, including the nodes inside loops. */
export function nodeTypesOf(definition: { nodes?: Node[] } | undefined): string[] {
  const out: string[] = [];
  const walk = (nodes: Node[] | undefined) => {
    for (const n of nodes || []) {
      out.push(String(n.type ?? 'unknown'));
      walk(n.configuration?.loop?.definition?.nodes);
    }
  };
  walk(definition?.nodes);
  return out;
}

/** Node types that are not allowed, without duplicates. Empty means the flow may be called. */
export function disallowedNodeTypes(definition: { nodes?: Node[] } | undefined): string[] {
  const allowed = new Set<string>(ALLOWED_NODE_TYPES);
  return [...new Set(nodeTypesOf(definition).filter((t) => !allowed.has(t)))];
}

type Sender = { send: (cmd: unknown) => Promise<unknown> };
let agentClient: Sender | null = null;
let runtimeClient: Sender | null = null;
export function __setFlowClients(agent: Sender | null, runtime: Sender | null): void {
  agentClient = agent;
  runtimeClient = runtime;
}
function region(): string {
  return process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
}

/** Check the version the alias points to now. Throws FlowRefusedError when it may not be called. */
export async function checkFlow(entry: FlowEntry): Promise<{ version: string; nodeTypes: string[]; definition: { nodes?: Node[] } }> {
  const agent = agentClient ?? (new BedrockAgentClient({ region: region() }) as unknown as Sender);
  const alias = (await agent.send(new GetFlowAliasCommand({ flowIdentifier: entry.flowId, aliasIdentifier: entry.aliasId }))) as {
    routingConfiguration?: { flowVersion?: string }[];
  };
  const versions = (alias.routingConfiguration || []).map((r) => r.flowVersion).filter((v): v is string => !!v);
  if (versions.length !== 1) throw new FlowRefusedError(`the alias must point to exactly one flow version (found ${versions.length})`);
  const version = versions[0];
  const got = (await agent.send(new GetFlowVersionCommand({ flowIdentifier: entry.flowId, flowVersion: version }))) as {
    definition?: { nodes?: Node[] };
  };
  const nodeTypes = nodeTypesOf(got.definition);
  if (nodeTypes.length === 0) throw new FlowRefusedError('the flow version has no nodes');
  const bad = disallowedNodeTypes(got.definition);
  if (bad.length > 0) {
    throw new FlowRefusedError(`this flow contains node types that are not allowed here: ${bad.join(', ')}`, bad);
  }
  return { version, nodeTypes, definition: got.definition as { nodes?: Node[] } };
}

/** The name of the flow's input node (the only node of type Input at the top level). */
function inputNodeName(definition: { nodes?: Node[] } | undefined): string {
  return definition?.nodes?.find((n) => n.type === 'Input')?.name || 'FlowInputNode';
}

export async function runFlow(userId: string, input: { key: string; text: string }): Promise<{ output: string; flow: string; version: string }> {
  const entry = flowsConfig().find((f) => f.key === input.key);
  if (!entry) throw new ToolInputError('flow not found');
  const text = (input.text || '').trim();
  if (!text) throw new ToolInputError('text is required');
  if (text.length > MAX_FLOW_INPUT_CHARS) throw new ToolInputError(`text is longer than ${MAX_FLOW_INPUT_CHARS} characters`);
  const log = (fields: Record<string, unknown>) => console.log(JSON.stringify({ event: 'flow_call', userId, flow: entry.key, flowId: entry.flowId, ...fields }));
  let version: string;
  let definition: { nodes?: Node[] };
  try {
    ({ version, definition } = await checkFlow(entry));
  } catch (error) {
    if (error instanceof FlowRefusedError) {
      log({ decision: 'refused', reason: error.message, nodeTypes: error.nodeTypes });
      throw new ToolInputError(error.message);
    }
    throw error;
  }
  const runtime = runtimeClient ?? (new BedrockAgentRuntimeClient({ region: region() }) as unknown as Sender);
  const resp = (await runtime.send(
    new InvokeFlowCommand({
      flowIdentifier: entry.flowId,
      flowAliasIdentifier: entry.aliasId,
      inputs: [{ nodeName: inputNodeName(definition), nodeOutputName: 'document', content: { document: text } }],
    }),
  )) as { responseStream?: AsyncIterable<Record<string, unknown>> };
  const parts: string[] = [];
  let completion = '';
  for await (const ev of resp.responseStream || []) {
    const out = ev.flowOutputEvent as { content?: { document?: unknown } } | undefined;
    if (out?.content?.document !== undefined) {
      const d = out.content.document;
      parts.push(typeof d === 'string' ? d : JSON.stringify(d));
    }
    const done = ev.flowCompletionEvent as { completionReason?: string } | undefined;
    if (done?.completionReason) completion = done.completionReason;
  }
  log({ decision: 'called', version, completion });
  if (completion && completion !== 'SUCCESS') throw new Error(`the flow ended with ${completion}`);
  return { output: parts.join('\n\n'), flow: entry.name, version };
}
