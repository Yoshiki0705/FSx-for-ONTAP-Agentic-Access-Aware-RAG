/**
 * The code tool: a model writes a Python program for the user's task, the program runs in
 * the sandbox (code-executor.ts), and the model states the result from the program's output.
 *
 * Limits, per request: 3 runs, 60 seconds for one run, and 50 seconds in all (the web
 * app's front door, CloudFront, waits at most 60 seconds for an answer).
 * What goes into the sandbox: only documents the signed-in user may read
 * (`allowedDocuments`, the same SID filter as KB mode) and text the user typed.
 */
import { allowedDocuments, type ToolDocument } from './documents';
import { executePython, type ExecutionResult, type Executor, type SandboxFile } from './code-executor';
import { codeAnswerPrompt, codeFixMessage, codePrompt, extractPython, wrapInput } from './prompts';
import { generateText, ToolInputError } from './text-model';

export const MAX_RUNS = 3;
export const RUN_LIMIT_MS = 60_000;
export const TOTAL_BUDGET_MS = 50_000;
/** Time kept back for the model call that writes the answer. */
const ANSWER_RESERVE_MS = 8_000;
const MODEL_OUTPUT_CHARS = 6_000;
const CLIENT_OUTPUT_CHARS = 20_000;

export function codeInterpreterEnabled(): boolean {
  return process.env.CODE_INTERPRETER_ENABLED === 'true';
}

let executor: Executor = executePython;
/** Tests replace the sandbox. */
export function __setExecutor(e: Executor | null): void {
  executor = e ?? executePython;
}
let clock: () => number = () => Date.now();
export function __setClock(c: (() => number) | null): void {
  clock = c ?? (() => Date.now());
}

export interface CodeRun {
  ok: boolean;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface CodeToolResult {
  result: string;
  code: string;
  runs: CodeRun[];
  sources: string[];
  modelId: string;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n[output cut at ${max} characters]` : text;
}

function toRun(r: ExecutionResult): CodeRun {
  return {
    ok: !r.isError,
    timedOut: r.timedOut,
    stdout: clip(r.stdout, CLIENT_OUTPUT_CHARS),
    stderr: clip(r.stderr, CLIENT_OUTPUT_CHARS),
    durationMs: r.durationMs,
  };
}

export async function runCodeTool(
  userId: string,
  input: { task: string; text: string; source: string; query: string },
): Promise<CodeToolResult> {
  if (!codeInterpreterEnabled()) throw new ToolInputError('the code tool is not enabled');
  const task = input.task.trim();
  if (!task) throw new ToolInputError('task is required');

  const files: SandboxFile[] = [];
  const labels: { path: string; label: string }[] = [];
  let docs: ToolDocument[] = [];
  if (input.source === 'documents') {
    const query = input.query.trim() || task;
    docs = await allowedDocuments(userId, query);
    if (docs.length === 0) throw new ToolInputError('no readable documents matched the query');
    docs.forEach((d, i) => {
      const path = `doc${i + 1}.txt`;
      files.push({ path, text: d.content });
      labels.push({ path, label: `the document "${d.fileName.replace(/["\n\r]/g, ' ').slice(0, 120)}"` });
    });
  }
  if (input.text.trim()) {
    files.push({ path: 'input.txt', text: input.text });
    labels.push({ path: 'input.txt', label: 'text the user typed' });
  }

  const started = clock();
  const system = codePrompt(labels);
  const runs: CodeRun[] = [];
  let modelId = '';
  let code = '';
  let userMessage = `Task: ${task}`;
  let last: ExecutionResult | null = null;

  for (let attempt = 0; attempt < MAX_RUNS; attempt++) {
    const remaining = TOTAL_BUDGET_MS - (clock() - started) - ANSWER_RESERVE_MS;
    if (attempt > 0 && remaining < 5_000) break;
    const written = await generateText({ system, user: userMessage, maxTokens: 4096, temperature: 0 });
    modelId = written.modelId;
    code = extractPython(written.text);
    const limit = Math.min(RUN_LIMIT_MS, TOTAL_BUDGET_MS - (clock() - started) - ANSWER_RESERVE_MS);
    if (limit < 3_000) break;
    last = await executor(code, files, limit);
    runs.push(toRun(last));
    if (!last.isError) break;
    userMessage = codeFixMessage(task, code, clip(last.stderr || last.stdout, 3_000));
  }

  if (!last) throw new ToolInputError('the request ran out of time before the program could run');
  const output = last.isError ? `The program failed.\n${last.stderr || last.stdout}` : last.stdout || '(the program printed nothing)';
  const answer = await generateText({
    system: codeAnswerPrompt(),
    user: `Task: ${task}\n${wrapInput(clip(output, MODEL_OUTPUT_CHARS))}`,
    maxTokens: 2048,
    temperature: 0,
  });
  return { result: answer.text, code, runs, sources: docs.map((d) => d.fileName), modelId: answer.modelId || modelId };
}
