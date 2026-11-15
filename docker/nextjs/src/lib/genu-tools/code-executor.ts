/**
 * Runs Python in the AgentCore built-in Code Interpreter, the one place this tool touches
 * that service. The rest of the tool (code-interpreter.ts) calls `executePython` and
 * nothing else, so a different sandbox replaces this one file.
 *
 * The built-in sandbox has no network: a DNS lookup from inside it fails (checked
 * 2026-11-15 in ap-northeast-1). Code a model writes after reading a document therefore
 * cannot send that document out. pandas and numpy are installed.
 */
import {
  BedrockAgentCoreClient,
  InvokeCodeInterpreterCommand,
  StartCodeInterpreterSessionCommand,
  StopCodeInterpreterSessionCommand,
} from '@aws-sdk/client-bedrock-agentcore';

export const CODE_INTERPRETER_ID = 'aws.codeinterpreter.v1';

export interface SandboxFile {
  /** A fixed name chosen by the server (doc1.txt, input.txt); never taken from a user. */
  path: string;
  text: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  isError: boolean;
  timedOut: boolean;
  durationMs: number;
}

export type Executor = (code: string, files: SandboxFile[], timeoutMs: number) => Promise<ExecutionResult>;

let client: BedrockAgentCoreClient | null = null;
function agentCore(): BedrockAgentCoreClient {
  client ??= new BedrockAgentCoreClient({
    region: process.env.CODE_INTERPRETER_REGION || process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 2,
  });
  return client;
}

/** Tests replace the SDK client. */
export function __setAgentCoreClient(c: { send: (cmd: unknown, opts?: unknown) => Promise<unknown> } | null): void {
  client = c as BedrockAgentCoreClient | null;
}

interface StreamEvent {
  result?: {
    content?: { type?: string; text?: string }[];
    structuredContent?: { stdout?: string; stderr?: string };
    isError?: boolean;
  };
  [exception: string]: unknown;
}

async function collect(stream: AsyncIterable<StreamEvent> | undefined): Promise<{ stdout: string; stderr: string; isError: boolean }> {
  let stdout = '';
  let stderr = '';
  let isError = false;
  for await (const ev of stream ?? []) {
    if (ev.result) {
      const sc = ev.result.structuredContent;
      if (sc && (sc.stdout !== undefined || sc.stderr !== undefined)) {
        stdout += sc.stdout ?? '';
        stderr += sc.stderr ?? '';
      } else {
        stdout += (ev.result.content || []).map((c) => c.text || '').join('');
      }
      if (ev.result.isError) isError = true;
      continue;
    }
    const exception = Object.keys(ev).find((k) => k.endsWith('Exception'));
    if (exception) throw new Error(`code interpreter: ${exception}`);
  }
  return { stdout, stderr, isError };
}

export const executePython: Executor = async (code, files, timeoutMs) => {
  const started = Date.now();
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sessionId: string | undefined;
  const work = (async () => {
    const session = await agentCore().send(
      new StartCodeInterpreterSessionCommand({
        codeInterpreterIdentifier: CODE_INTERPRETER_ID,
        name: 'rag-tool',
        sessionTimeoutSeconds: 120,
      }),
      { abortSignal: abort.signal },
    );
    sessionId = session.sessionId;
    if (files.length > 0) {
      const written = await agentCore().send(
        new InvokeCodeInterpreterCommand({
          codeInterpreterIdentifier: CODE_INTERPRETER_ID,
          sessionId,
          name: 'writeFiles',
          arguments: { content: files.map((f) => ({ path: f.path, text: f.text })) },
        }),
        { abortSignal: abort.signal },
      );
      const w = await collect(written.stream as AsyncIterable<StreamEvent> | undefined);
      if (w.isError) throw new Error('code interpreter: could not write the input files');
    }
    const out = await agentCore().send(
      new InvokeCodeInterpreterCommand({
        codeInterpreterIdentifier: CODE_INTERPRETER_ID,
        sessionId,
        name: 'executeCode',
        arguments: { language: 'python', code },
      }),
      { abortSignal: abort.signal },
    );
    return collect(out.stream as AsyncIterable<StreamEvent> | undefined);
  })();
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  try {
    const done = await Promise.race([work, timeout]);
    if (done === 'timeout') {
      abort.abort();
      work.catch(() => undefined);
      return {
        stdout: '',
        stderr: `The program did not finish within ${Math.round(timeoutMs / 1000)} seconds and was stopped.`,
        isError: true,
        timedOut: true,
        durationMs: Date.now() - started,
      };
    }
    return { ...done, timedOut: false, durationMs: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
    if (sessionId) {
      // Best effort: the session also ends on its own timeout.
      agentCore()
        .send(new StopCodeInterpreterSessionCommand({ codeInterpreterIdentifier: CODE_INTERPRETER_ID, sessionId }))
        .catch(() => undefined);
    }
  }
};
