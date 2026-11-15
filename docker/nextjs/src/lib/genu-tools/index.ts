/**
 * The GenU-style tools: translate, proofread, diagram, web extraction, image generation,
 * and saved use cases. Each runs for the signed-in user. When a tool takes internal
 * documents as input, they come from `allowedDocuments`, which returns only what that user
 * may read.
 */
import { allowedDocuments, type ToolDocument } from './documents';
import { codeInterpreterEnabled, MAX_RUNS, RUN_LIMIT_MS, runCodeTool } from './code-interpreter';
import { generateImage, imageConfig, type ImageRequest } from './image';
import {
  diagramPrompt,
  documentsBlock,
  extractMermaid,
  parseProofread,
  proofreadPrompt,
  renderTemplate,
  translatePrompt,
  useCaseSystemPrompt,
  webExtractPrompt,
  wrapInput,
} from './prompts';
import { generateText, MAX_INPUT_CHARS, ToolInputError } from './text-model';
import { getUseCase } from './use-cases';
import { fetchPage, htmlToText } from './web-fetch';
import { minutesStatus, startMinutes } from './minutes';
import { analyzeVideo, createUploadUrl, MAX_AUDIO_BYTES, MAX_VIDEO_BYTES, mediaToolsEnabled, type MediaKind } from './media';

export { ToolInputError } from './text-model';
export { ImageFilteredError, imageConfig } from './image';
export * from './use-cases';
export { codeInterpreterEnabled } from './code-interpreter';
export { mediaToolsEnabled } from './media';

export const TOOL_NAMES = ['translate', 'proofread', 'diagram', 'web-extract', 'image', 'use-case', 'code', 'media-upload', 'video', 'minutes-start', 'minutes-status'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export function webExtractEnabled(): boolean {
  return process.env.WEB_EXTRACT_ENABLED !== 'false';
}

export function toolsConfig() {
  const image = imageConfig();
  return {
    tools: {
      translate: true,
      proofread: true,
      diagram: true,
      webExtract: webExtractEnabled(),
      image: image.enabled,
      codeInterpreter: codeInterpreterEnabled(),
      media: mediaToolsEnabled(),
      useCases: !!process.env.USE_CASES_TABLE_NAME,
    },
    image: image.enabled ? { region: image.region, modelId: image.modelId, crossRegion: image.crossRegion } : null,
    codeInterpreter: codeInterpreterEnabled() ? { maxRuns: MAX_RUNS, runSeconds: RUN_LIMIT_MS / 1000 } : null,
    media: mediaToolsEnabled() ? { maxVideoMb: MAX_VIDEO_BYTES / 1024 / 1024, maxAudioMb: MAX_AUDIO_BYTES / 1024 / 1024 } : null,
    maxInputChars: MAX_INPUT_CHARS,
  };
}

type Body = Record<string, unknown>;

function str(body: Body, key: string): string {
  return typeof body[key] === 'string' ? (body[key] as string) : '';
}

/**
 * The text a tool works on: what the user typed, or, with `source: "documents"`, the
 * documents the user may read that match `query`.
 */
async function toolInput(userId: string, body: Body): Promise<{ text: string; sources: string[] }> {
  if (str(body, 'source') === 'documents') {
    const query = str(body, 'query') || str(body, 'text');
    if (!query.trim()) throw new ToolInputError('query is required');
    const docs: ToolDocument[] = await allowedDocuments(userId, query);
    if (docs.length === 0) throw new ToolInputError('no readable documents matched the query');
    return { text: docs.map((d) => `# ${d.fileName}\n${d.content}`).join('\n\n'), sources: docs.map((d) => d.fileName) };
  }
  return { text: str(body, 'text'), sources: [] };
}

export async function runTool(tool: string, userId: string, body: Body): Promise<Record<string, unknown>> {
  switch (tool) {
    case 'translate': {
      const system = translatePrompt(str(body, 'target') || 'en', str(body, 'style') || 'as-is', str(body, 'note'));
      const input = await toolInput(userId, body);
      const out = await generateText({ system, user: wrapInput(input.text), maxTokens: 8192 });
      return { result: out.text, sources: input.sources, modelId: out.modelId };
    }
    case 'proofread': {
      const input = await toolInput(userId, body);
      const out = await generateText({ system: proofreadPrompt(), user: wrapInput(input.text), maxTokens: 8192, temperature: 0 });
      return { ...parseProofread(out.text), sources: input.sources, modelId: out.modelId };
    }
    case 'diagram': {
      const system = diagramPrompt(str(body, 'type') || 'auto');
      const input = await toolInput(userId, body);
      const out = await generateText({ system, user: wrapInput(input.text), maxTokens: 4096 });
      return { mermaid: extractMermaid(out.text), sources: input.sources, modelId: out.modelId };
    }
    case 'web-extract': {
      if (!webExtractEnabled()) throw new ToolInputError('web extraction is not enabled');
      const page = await fetchPage(str(body, 'url'));
      const { title, text } = page.contentType === 'text/plain' ? { title: '', text: page.body } : htmlToText(page.body);
      if (!text) throw new ToolInputError('the page has no readable text');
      const system = webExtractPrompt(str(body, 'task') || 'summary', page.url, str(body, 'question'), str(body, 'language') || 'ja');
      const truncated = text.length > MAX_INPUT_CHARS - 100;
      const out = await generateText({ system, user: wrapInput(text.slice(0, MAX_INPUT_CHARS - 100)), maxTokens: 8192 });
      return { result: out.text, url: page.url, title, truncated, modelId: out.modelId };
    }
    case 'image': {
      const req: ImageRequest = {
        prompt: str(body, 'prompt'),
        negativePrompt: str(body, 'negativePrompt'),
        aspectRatio: str(body, 'aspectRatio') || '1:1',
        seed: typeof body.seed === 'number' ? body.seed : undefined,
      };
      return { ...(await generateImage(req)) };
    }
    case 'use-case': {
      const useCase = await getUseCase(userId, str(body, 'useCaseId'));
      if (!useCase) throw new ToolInputError('use case not found');
      const input = str(body, 'text');
      let docs = '';
      let sources: string[] = [];
      if (useCase.useDocuments) {
        const found = await allowedDocuments(userId, input || useCase.title);
        docs = documentsBlock(found);
        sources = found.map((d) => d.fileName);
      }
      const out = await generateText({ system: useCaseSystemPrompt(), user: renderTemplate(useCase.template, input) + docs, maxTokens: 8192, temperature: 0.4 });
      return { result: out.text, sources, modelId: out.modelId };
    }
    case 'code':
      return { ...(await runCodeTool(userId, { task: str(body, 'task'), text: str(body, 'text'), source: str(body, 'source'), query: str(body, 'query') })) };
    case 'media-upload':
      return { ...(await createUploadUrl(userId, { kind: str(body, 'kind') as MediaKind, fileName: str(body, 'fileName'), size: typeof body.size === 'number' ? body.size : 0 })) };
    case 'video':
      return { ...(await analyzeVideo(userId, { key: str(body, 'key'), question: str(body, 'question'), language: str(body, 'language') || 'ja' })) };
    case 'minutes-start':
      return { ...(await startMinutes(userId, { key: str(body, 'key'), language: str(body, 'language') || 'ja-JP', speakers: typeof body.speakers === 'number' ? body.speakers : 2 })) };
    case 'minutes-status':
      return { ...(await minutesStatus(userId, { jobName: str(body, 'jobName'), language: str(body, 'language') || 'ja-JP' })) };
    default:
      throw new ToolInputError(`unknown tool: ${tool}`);
  }
}
