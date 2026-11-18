'use client';
/**
 * Tools page: translate, proofread, diagram, web extraction, image generation (when the
 * feature flag is on) and the user's saved use cases. Every call goes to /api/tools/*,
 * which runs as the signed-in user; internal documents used as input are only those the
 * user may read.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Clapperboard, Code2, Copy, Download, EyeOff, FileSearch, Film, Mic, Globe, ImageIcon, Languages, Pencil, Play, Plus, SpellCheck, Trash2, Upload, Workflow, Wand2,
} from 'lucide-react';
import { MermaidView } from './MermaidView';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { exportUseCaseFile, parseUseCaseFile } from '@/lib/genu-tools/use-case-file';
import { MINUTES_FORMATS } from '@/lib/genu-tools/minutes-formats';

type Tab = 'translate' | 'proofread' | 'diagram' | 'webExtract' | 'image' | 'useCases' | 'code' | 'video' | 'minutes' | 'videoGen';

interface ToolsConfig {
  tools: { translate: boolean; proofread: boolean; diagram: boolean; webExtract: boolean; image: boolean; useCases: boolean; codeInterpreter: boolean; media: boolean; videoGeneration: boolean };
  videoGeneration: { region: string; modelId: string; crossRegion: boolean } | null;
  media: { maxVideoMb: number; maxAudioMb: number } | null;
  codeInterpreter: { maxRuns: number; runSeconds: number } | null;
  image: { region: string; modelId: string; crossRegion: boolean } | null;
  maxInputChars: number;
}

interface UseCase {
  useCaseId: string;
  title: string;
  description: string;
  template: string;
  useDocuments: boolean;
  shared?: boolean;
  ownedByMe?: boolean;
}
/** Use case files are at most 50 entries of a few KB; refuse anything larger before reading it. */
const MAX_IMPORT_BYTES = 1024 * 1024;

const LANGUAGES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es', 'pt', 'it', 'id', 'th', 'vi'] as const;
const DIAGRAM_TYPES = ['auto', 'flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'mindmap', 'timeline', 'pie'] as const;
const ASPECTS = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:5', '5:4'] as const;

async function postTool(tool: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tools/${tool}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
  if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const inputClass =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const buttonClass =
  'inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
const secondaryButton =
  'inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Text typed by the user, or a query over the documents the user may read. */
function SourceInput({
  source, setSource, text, setText, t,
}: { source: 'text' | 'documents'; setSource: (s: 'text' | 'documents') => void; text: string; setText: (s: string) => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300" role="radiogroup" aria-label={t('source.label')}>
        <label className="inline-flex items-center gap-1">
          <input type="radio" checked={source === 'text'} onChange={() => setSource('text')} /> {t('source.text')}
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="radio" checked={source === 'documents'} onChange={() => setSource('documents')} /> {t('source.documents')}
        </label>
      </div>
      {source === 'documents' ? (
        <>
          <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('source.queryPlaceholder')} aria-label={t('source.query')} />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('source.documentsNote')}</p>
        </>
      ) : (
        <textarea className={`${inputClass} min-h-[160px]`} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('source.textPlaceholder')} aria-label={t('source.text')} />
      )}
    </div>
  );
}

function Sources({ sources, t }: { sources?: string[]; t: ReturnType<typeof useTranslations> }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400">
      <span className="font-medium">{t('sources')}:</span> {sources.join(', ')}
    </div>
  );
}

function ResultText({ text, t, fileName }: { text: string; t: ReturnType<typeof useTranslations>; fileName: string }) {
  if (!text) return null;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className={secondaryButton} onClick={() => navigator.clipboard.writeText(text)}>
          <Copy className="h-4 w-4" aria-hidden /> {t('copy')}
        </button>
        <button type="button" className={secondaryButton} onClick={() => download(fileName, text, 'text/markdown')}>
          <Download className="h-4 w-4" aria-hidden /> {t('download')}
        </button>
      </div>
      <pre className="whitespace-pre-wrap rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-900 dark:text-gray-100">{text}</pre>
    </div>
  );
}

function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError('');
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run };
}

function ErrorLine({ error }: { error: string }) {
  return error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p> : null;
}

function TranslatePanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [source, setSource] = useState<'text' | 'documents'>('text');
  const [text, setText] = useState('');
  const [target, setTarget] = useState('en');
  const [style, setStyle] = useState('as-is');
  const [note, setNote] = useState('');
  const [out, setOut] = useState<{ result: string; sources?: string[] } | null>(null);
  const { busy, error, run } = useRunner();
  return (
    <div className="space-y-4">
      <SourceInput source={source} setSource={setSource} text={text} setText={setText} t={t} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('translate.target')}
          <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{t(`languages.${l}`)}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('translate.style')}
          <select className={inputClass} value={style} onChange={(e) => setStyle(e.target.value)}>
            {['as-is', 'formal', 'casual'].map((s) => <option key={s} value={s}>{t(`translate.styles.${s}`)}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('translate.note')}
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('translate.notePlaceholder')} />
        </label>
      </div>
      <button type="button" className={buttonClass} disabled={busy || !text.trim()} onClick={() => run(async () => setOut(await postTool('translate', { source, text, query: text, target, style, note })))}>
        <Languages className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('translate.run')}
      </button>
      <ErrorLine error={error} />
      {out && (
        <>
          <Sources sources={out.sources} t={t} />
          <ResultText text={out.result} t={t} fileName={`translation-${target}.md`} />
        </>
      )}
    </div>
  );
}

function ProofreadPanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [source, setSource] = useState<'text' | 'documents'>('text');
  const [text, setText] = useState('');
  const [out, setOut] = useState<{ corrected: string; issues: { original: string; suggestion: string; reason: string }[]; sources?: string[] } | null>(null);
  const { busy, error, run } = useRunner();
  return (
    <div className="space-y-4">
      <SourceInput source={source} setSource={setSource} text={text} setText={setText} t={t} />
      <button type="button" className={buttonClass} disabled={busy || !text.trim()} onClick={() => run(async () => setOut(await postTool('proofread', { source, text, query: text })))}>
        <SpellCheck className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('proofread.run')}
      </button>
      <ErrorLine error={error} />
      {out && (
        <div className="space-y-3">
          <Sources sources={out.sources} t={t} />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('proofread.issues', { count: out.issues.length })}</h3>
          {out.issues.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('proofread.noIssues')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400">
                  <th className="py-1 pr-2">{t('proofread.original')}</th>
                  <th className="py-1 pr-2">{t('proofread.suggestion')}</th>
                  <th className="py-1">{t('proofread.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {out.issues.map((i, n) => (
                  <tr key={n} className="border-t border-gray-200 dark:border-gray-700 align-top text-gray-900 dark:text-gray-100">
                    <td className="py-1 pr-2 line-through decoration-red-500">{i.original}</td>
                    <td className="py-1 pr-2 text-green-800 dark:text-green-300">{i.suggestion}</td>
                    <td className="py-1">{i.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('proofread.corrected')}</h3>
          <ResultText text={out.corrected} t={t} fileName="proofread.md" />
        </div>
      )}
    </div>
  );
}

function DiagramPanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [source, setSource] = useState<'text' | 'documents'>('text');
  const [text, setText] = useState('');
  const [type, setType] = useState('auto');
  const [out, setOut] = useState<{ mermaid: string; sources?: string[] } | null>(null);
  const [svg, setSvg] = useState('');
  const { busy, error, run } = useRunner();
  return (
    <div className="space-y-4">
      <SourceInput source={source} setSource={setSource} text={text} setText={setText} t={t} />
      <label className="block text-sm text-gray-700 dark:text-gray-300 sm:w-1/3">
        {t('diagram.type')}
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          {DIAGRAM_TYPES.map((d) => <option key={d} value={d}>{t(`diagram.types.${d}`)}</option>)}
        </select>
      </label>
      <button type="button" className={buttonClass} disabled={busy || !text.trim()} onClick={() => run(async () => setOut(await postTool('diagram', { source, text, query: text, type })))}>
        <Workflow className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('diagram.run')}
      </button>
      <ErrorLine error={error} />
      {out && (
        <div className="space-y-3">
          <Sources sources={out.sources} t={t} />
          <MermaidView code={out.mermaid} onSvg={setSvg} errorLabel={t('diagram.renderError')} />
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} disabled={!svg} onClick={() => download('diagram.svg', svg, 'image/svg+xml')}>
              <Download className="h-4 w-4" aria-hidden /> {t('diagram.downloadSvg')}
            </button>
            <button type="button" className={secondaryButton} onClick={() => navigator.clipboard.writeText(out.mermaid)}>
              <Copy className="h-4 w-4" aria-hidden /> {t('diagram.copyCode')}
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-gray-700 dark:text-gray-300">{t('diagram.code')}</summary>
            <pre className="whitespace-pre-wrap rounded-md bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-900 dark:text-gray-100">{out.mermaid}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

function WebExtractPanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [url, setUrl] = useState('');
  const [task, setTask] = useState('summary');
  const [question, setQuestion] = useState('');
  const [out, setOut] = useState<{ result: string; url: string; title: string; truncated: boolean } | null>(null);
  const { busy, error, run } = useRunner();
  return (
    <div className="space-y-4">
      <input className={inputClass} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label={t('webExtract.url')} />
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('webExtract.note')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('webExtract.task')}
          <select className={inputClass} value={task} onChange={(e) => setTask(e.target.value)}>
            {['summary', 'extract', 'question'].map((k) => <option key={k} value={k}>{t(`webExtract.tasks.${k}`)}</option>)}
          </select>
        </label>
        {task === 'question' && (
          <label className="text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
            {t('webExtract.question')}
            <input className={inputClass} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </label>
        )}
      </div>
      <button type="button" className={buttonClass} disabled={busy || !url.trim()} onClick={() => run(async () => setOut(await postTool('web-extract', { url, task, question, language: document.documentElement.lang || 'ja' })))}>
        <Globe className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('webExtract.run')}
      </button>
      <ErrorLine error={error} />
      {out && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {out.title ? `${out.title} · ` : ''}
            {out.url}
            {out.truncated ? ` (${t('webExtract.truncated')})` : ''}
          </p>
          <ResultText text={out.result} t={t} fileName="web-extract.md" />
        </div>
      )}
    </div>
  );
}

function ImagePanel({ t, config }: { t: ReturnType<typeof useTranslations>; config: NonNullable<ToolsConfig['image']> }) {
  const [prompt, setPrompt] = useState('');
  const [negative, setNegative] = useState('');
  const [aspect, setAspect] = useState('1:1');
  const [image, setImage] = useState('');
  const { busy, error, run } = useRunner();
  return (
    <div className="space-y-4">
      <div role="note" className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200">
        {config.crossRegion ? t('image.regionNotice', { region: config.region }) : t('image.inRegion', { region: config.region })}
        <span className="block text-xs mt-1">{t('image.model', { model: config.modelId })}</span>
      </div>
      <textarea className={`${inputClass} min-h-[100px]`} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('image.promptPlaceholder')} aria-label={t('image.prompt')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
          {t('image.negative')}
          <input className={inputClass} value={negative} onChange={(e) => setNegative(e.target.value)} />
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('image.aspect')}
          <select className={inputClass} value={aspect} onChange={(e) => setAspect(e.target.value)}>
            {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className={buttonClass} disabled={busy || !prompt.trim()} onClick={() => run(async () => setImage((await postTool('image', { prompt, negativePrompt: negative, aspectRatio: aspect })).imageBase64))}>
        <ImageIcon className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('image.run')}
      </button>
      <ErrorLine error={error} />
      {image && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${image}`} alt={prompt} className="max-h-[512px] rounded-md border border-gray-200 dark:border-gray-700" />
          <a className={secondaryButton} href={`data:image/png;base64,${image}`} download="generated.png">
            <Download className="h-4 w-4" aria-hidden /> {t('download')}
          </a>
        </div>
      )}
    </div>
  );
}

function UseCasesPanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [items, setItems] = useState<UseCase[]>([]);
  const [shared, setShared] = useState<UseCase[]>([]);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [editing, setEditing] = useState<Partial<UseCase> | null>(null);
  const [active, setActive] = useState<UseCase | null>(null);
  const [input, setInput] = useState('');
  const [out, setOut] = useState<{ result: string; sources?: string[] } | null>(null);
  const [notice, setNotice] = useState('');
  const isAdmin = useIsAdmin();
  const { busy, error, run } = useRunner();
  const load = useCallback(async () => {
    const res = await fetch('/api/tools/use-cases');
    const data = await res.json();
    if (data.success) {
      setItems(data.useCases);
      setShared((data.shared || []).filter((u: UseCase) => !u.ownedByMe));
      setSharingEnabled(!!data.sharingEnabled);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/tools/use-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  };
  const save = () =>
    run(async () => {
      await post(editing || {});
      setEditing(null);
      await load();
    });
  const remove = (id: string) =>
    run(async () => {
      const res = await fetch(`/api/tools/use-cases?useCaseId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (active?.useCaseId === id) setActive(null);
      await load();
    });
  // A copy is a new private use case of the user's own, with the same fields.
  const copy = (u: UseCase) =>
    run(async () => {
      await post({ title: u.title, description: u.description, template: u.template, useDocuments: u.useDocuments });
      setNotice(t('useCases.copied', { title: u.title }));
      await load();
    });
  const unshare = (u: UseCase) =>
    run(async () => {
      await post({ action: 'unshare', useCaseId: u.useCaseId });
      await load();
    });
  const exportFile = () => {
    const file = exportUseCaseFile(items);
    download(`use-cases-${file.exportedAt.slice(0, 10)}.json`, JSON.stringify(file, null, 2), 'application/json');
  };
  const importFile = (f: File | undefined) =>
    run(async () => {
      if (!f) return;
      if (f.size > MAX_IMPORT_BYTES) throw new Error(t('useCases.fileTooLarge'));
      let parsed: unknown;
      try {
        parsed = JSON.parse(await f.text());
      } catch {
        throw new Error(t('useCases.importInvalid'));
      }
      parseUseCaseFile(parsed); // same checks as the server, to name the problem before sending
      const data = await post({ action: 'import', file: parsed });
      setNotice(t('useCases.importDone', { count: data.imported }));
      await load();
    });
  const card = (u: UseCase, own: boolean) => (
    <li key={u.useCaseId} className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.title}</h3>
          {u.description && <p className="text-xs text-gray-600 dark:text-gray-400">{u.description}</p>}
          {u.useDocuments && <p className="text-xs text-blue-700 dark:text-blue-300">{t('useCases.withDocuments')}</p>}
          {own && u.shared && <p className="text-xs text-green-700 dark:text-green-300">{t('useCases.sharedBadge')}</p>}
        </div>
        <div className="flex gap-1">
          <button type="button" className={secondaryButton} aria-label={t('useCases.run')} onClick={() => { setActive(u); setOut(null); setInput(''); }}>
            <Play className="h-4 w-4" aria-hidden />
          </button>
          {own ? (
            <>
              <button type="button" className={secondaryButton} aria-label={t('useCases.edit')} onClick={() => setEditing(u)}>
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className={secondaryButton} aria-label={t('useCases.delete')} onClick={() => remove(u.useCaseId)}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <button type="button" className={secondaryButton} aria-label={t('useCases.copy')} disabled={busy} onClick={() => copy(u)}>
                <Copy className="h-4 w-4" aria-hidden />
              </button>
              {isAdmin && (
                <button type="button" className={secondaryButton} aria-label={t('useCases.unshare')} disabled={busy} onClick={() => unshare(u)}>
                  <EyeOff className="h-4 w-4" aria-hidden />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {!own && (
        <details className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          <summary className="cursor-pointer">{t('useCases.showTemplate')}</summary>
          <pre className="mt-1 whitespace-pre-wrap font-mono">{u.template}</pre>
        </details>
      )}
    </li>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('useCases.intro')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => setEditing({ title: '', description: '', template: t('useCases.templateExample'), useDocuments: false, shared: false })}>
          <Plus className="h-4 w-4" aria-hidden /> {t('useCases.new')}
        </button>
        <button type="button" className={secondaryButton} disabled={items.length === 0} onClick={exportFile}>
          <Download className="h-4 w-4" aria-hidden /> {t('useCases.export')}
        </button>
        <label className={`${secondaryButton} cursor-pointer`}>
          <Upload className="h-4 w-4" aria-hidden /> {t('useCases.import')}
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <ErrorLine error={error} />
      {notice && <p role="status" className="text-sm text-green-700 dark:text-green-300">{notice}</p>}
      {editing && (
        <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-4">
          <input className={inputClass} value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={t('useCases.title')} aria-label={t('useCases.title')} />
          <input className={inputClass} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder={t('useCases.description')} aria-label={t('useCases.description')} />
          <textarea className={`${inputClass} min-h-[140px] font-mono`} value={editing.template || ''} onChange={(e) => setEditing({ ...editing, template: e.target.value })} aria-label={t('useCases.template')} />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('useCases.templateHelp')}</p>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={!!editing.useDocuments} onChange={(e) => setEditing({ ...editing, useDocuments: e.target.checked })} />
            {t('useCases.useDocuments')}
          </label>
          {sharingEnabled && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={!!editing.shared} onChange={(e) => setEditing({ ...editing, shared: e.target.checked })} />
              {t('useCases.share')}
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" className={buttonClass} disabled={busy} onClick={save}>{t('useCases.save')}</button>
            <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>{t('useCases.cancel')}</button>
          </div>
        </div>
      )}
      {items.length === 0 && !editing ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('useCases.empty')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">{items.map((u) => card(u, true))}</ul>
      )}
      {sharingEnabled && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('useCases.sharedTitle')}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('useCases.sharedIntro')}</p>
          {shared.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('useCases.sharedEmpty')}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">{shared.map((u) => card(u, false))}</ul>
          )}
        </section>
      )}
      {active && (
        <div className="space-y-3 rounded-md border border-blue-200 dark:border-blue-800 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{active.title}</h3>
          <textarea className={`${inputClass} min-h-[100px]`} value={input} onChange={(e) => setInput(e.target.value)} aria-label={t('useCases.input')} placeholder={t('useCases.input')} />
          <button type="button" className={buttonClass} disabled={busy} onClick={() => run(async () => setOut(await postTool('use-case', { useCaseId: active.useCaseId, text: input })))}>
            <Wand2 className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('useCases.run')}
          </button>
          {out && (
            <>
              <Sources sources={out.sources} t={t} />
              <ResultText text={out.result} t={t} fileName={`${active.title}.md`} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
interface CodeRunView { ok: boolean; timedOut: boolean; stdout: string; stderr: string; durationMs: number }
function CodePanel({ t, limits }: { t: ReturnType<typeof useTranslations>; limits: { maxRuns: number; runSeconds: number } }) {
  const [task, setTask] = useState('');
  const [source, setSource] = useState<'text' | 'documents'>('documents');
  const [text, setText] = useState('');
  const [out, setOut] = useState<{ result: string; code: string; runs: CodeRunView[]; sources?: string[] } | null>(null);
  const { busy, error, run } = useRunner();
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        {t('code.notice', { runs: limits.maxRuns, seconds: limits.runSeconds })}
      </p>
      <label className="block text-sm text-gray-700 dark:text-gray-300">
        {t('code.task')}
        <textarea className={`${inputClass} min-h-[80px]`} value={task} onChange={(e) => setTask(e.target.value)} placeholder={t('code.taskPlaceholder')} />
      </label>
      <SourceInput source={source} setSource={setSource} text={text} setText={setText} t={t} />
      <button type="button" className={buttonClass} disabled={busy || !task.trim() || !text.trim()} onClick={() => run(async () => setOut(await postTool('code', source === 'documents' ? { task, source, query: text } : { task, text })))}>
        <Play className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('code.run')}
      </button>
      <ErrorLine error={error} />
      {out && (
        <>
          <Sources sources={out.sources} t={t} />
          <ResultText text={out.result} t={t} fileName="code-result.md" />
          <details className="text-sm text-gray-700 dark:text-gray-300">
            <summary className="cursor-pointer">{t('code.program')}</summary>
            <pre className="mt-2 overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-xs">{out.code}</pre>
          </details>
          <details className="text-sm text-gray-700 dark:text-gray-300">
            <summary className="cursor-pointer">{t('code.runs', { count: out.runs.length })}</summary>
            <ol className="mt-2 space-y-2 list-decimal pl-5">
              {out.runs.map((r, i) => (
                <li key={i}>
                  <span className={r.ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                    {r.ok ? t('code.ok') : r.timedOut ? t('code.timedOut') : t('code.failed')} ({(r.durationMs / 1000).toFixed(1)} s)
                  </span>
                  {(r.stdout || r.stderr) && <pre className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 dark:bg-gray-800 p-2 text-xs">{r.stdout || r.stderr}</pre>}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
const MINUTES_LANGUAGES = ['ja-JP', 'en-US', 'ko-KR', 'zh-CN', 'fr-FR', 'de-DE', 'es-ES'] as const;
const VIDEO_ASPECTS = ['16:9', '9:16'] as const;
const VIDEO_RESOLUTIONS = ['540p', '720p'] as const;
function VideoGenPanel({ t, config }: { t: ReturnType<typeof useTranslations>; config: NonNullable<ToolsConfig['videoGeneration']> }) {
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<string>('16:9');
  const [resolution, setResolution] = useState<string>('540p');
  const [url, setUrl] = useState('');
  const [seconds, setSeconds] = useState(0);
  const { busy, error, run } = useRunner();
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        {config.crossRegion ? t('videoGen.regionNotice', { region: config.region }) : t('videoGen.inRegion', { region: config.region })}
        <span className="block text-xs mt-1">{t('videoGen.model', { model: config.modelId })}</span>
      </p>
      <textarea className={`${inputClass} min-h-[100px]`} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('videoGen.promptPlaceholder')} aria-label={t('videoGen.prompt')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('videoGen.aspect')}
          <select className={inputClass} value={aspect} onChange={(e) => setAspect(e.target.value)}>
            {VIDEO_ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('videoGen.resolution')}
          <select className={inputClass} value={resolution} onChange={(e) => setResolution(e.target.value)}>
            {VIDEO_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <button
        type="button"
        className={buttonClass}
        disabled={busy || !prompt.trim()}
        onClick={() => run(async () => {
          setUrl('');
          setSeconds(0);
          const started = await postTool('video-generate-start', { prompt, aspectRatio: aspect, resolution });
          const t0 = Date.now();
          for (let i = 0; i < 90; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            setSeconds(Math.round((Date.now() - t0) / 1000));
            const s = await postTool('video-generate-status', { invocationArn: started.invocationArn });
            if (s.status === 'Failed') throw new Error(t('videoGen.failed', { reason: s.reason || '' }));
            if (s.status === 'Completed') {
              setUrl(s.url);
              return;
            }
          }
          throw new Error(t('videoGen.timedOut'));
        })}
      >
        <Clapperboard className="h-4 w-4" aria-hidden /> {busy ? t('videoGen.running', { seconds }) : t('videoGen.run')}
      </button>
      <ErrorLine error={error} />
      {url && (
        <div className="space-y-2">
          <video src={url} controls className="max-h-[480px] rounded-md border border-gray-200 dark:border-gray-700" />
          <a className={secondaryButton} href={url} download="generated.mp4">
            <Download className="h-4 w-4" aria-hidden /> {t('download')}
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('videoGen.expires')}</p>
        </div>
      )}
    </div>
  );
}
function MinutesPanel({ t, limits }: { t: ReturnType<typeof useTranslations>; limits: { maxAudioMb: number } }) {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>('ja-JP');
  const [speakers, setSpeakers] = useState(2);
  const [phase, setPhase] = useState('');
  const [format, setFormat] = useState<(typeof MINUTES_FORMATS)[number]>('minutes');
  const [instruction, setInstruction] = useState('');
  // The finished transcription job: another format is written from it without transcribing again.
  const [jobName, setJobName] = useState('');
  const [out, setOut] = useState<{ minutes: string; transcript: string; format?: string; truncated?: boolean; reason?: string } | null>(null);
  const { busy, error, run } = useRunner();
  const tooBig = !!file && file.size > limits.maxAudioMb * 1024 * 1024;
  const needsInstruction = format === 'custom' && !instruction.trim();
  const writeFormat = (name: string) =>
    postTool('minutes-status', { jobName: name, language, format, instruction: format === 'custom' ? instruction : '' });
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        {t('minutes.notice', { mb: limits.maxAudioMb })}
      </p>
      <label className="block text-sm text-gray-700 dark:text-gray-300">
        {t('minutes.file')}
        <input type="file" accept="audio/*,video/mp4,video/webm,.mp3,.m4a,.wav,.flac,.ogg,.mp4,.webm" className={inputClass} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setOut(null); setJobName(''); }} />
      </label>
      {tooBig && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('minutes.tooBig', { mb: limits.maxAudioMb })}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('minutes.language')}
          <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {MINUTES_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('minutes.speakers')}
          <input type="number" min={2} max={10} className={inputClass} value={speakers} onChange={(e) => setSpeakers(Number(e.target.value) || 2)} />
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
          {t('minutes.format')}
          <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value as (typeof MINUTES_FORMATS)[number])}>
            {MINUTES_FORMATS.map((f) => <option key={f} value={f}>{t(`minutes.formats.${f}`)}</option>)}
          </select>
        </label>
        {format === 'custom' && (
          <label className="text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
            {t('minutes.instruction')}
            <textarea className={`${inputClass} min-h-[80px]`} maxLength={1000} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t('minutes.instructionPlaceholder')} />
          </label>
        )}
      </div>
      <button
        type="button"
        className={buttonClass}
        disabled={busy || !file || tooBig || needsInstruction}
        onClick={() => run(async () => {
          if (!file) return;
          setOut(null);
          setJobName('');
          setPhase('upload');
          const up = await postTool('media-upload', { kind: 'audio', fileName: file.name, size: file.size });
          const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: file });
          if (!put.ok) throw new Error(t('minutes.uploadFailed', { status: put.status }));
          setPhase('transcribe');
          const started = await postTool('minutes-start', { key: up.key, language, speakers });
          for (let i = 0; i < 180; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const s = await writeFormat(started.jobName);
            if (s.status === 'FAILED') throw new Error(t('minutes.failed', { reason: s.reason || '' }));
            if (s.status === 'COMPLETED') {
              setOut(s);
              setJobName(started.jobName);
              setPhase('');
              return;
            }
          }
          throw new Error(t('minutes.timedOut'));
        })}
      >
        <Mic className="h-4 w-4" aria-hidden /> {busy ? (phase === 'upload' ? t('minutes.uploading') : t('minutes.transcribing')) : t('minutes.run')}
      </button>
      <ErrorLine error={error} />
      {out && (
        <>
          {out.reason && <p className="text-sm text-gray-700 dark:text-gray-300">{out.reason}</p>}
          {out.truncated && <p className="text-sm text-amber-800 dark:text-amber-200">{t('minutes.truncated')}</p>}
          {jobName && (
            <button type="button" className={secondaryButton} disabled={busy || needsInstruction} onClick={() => run(async () => setOut(await writeFormat(jobName)))}>
              <Wand2 className="h-4 w-4" aria-hidden /> {busy ? t('running') : t('minutes.rewrite')}
            </button>
          )}
          <ResultText text={out.minutes} t={t} fileName={`minutes-${out.format || 'minutes'}.md`} />
          <details className="text-sm text-gray-700 dark:text-gray-300">
            <summary className="cursor-pointer">{t('minutes.transcript')}</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-xs">{out.transcript}</pre>
          </details>
        </>
      )}
    </div>
  );
}
function VideoPanel({ t, limits }: { t: ReturnType<typeof useTranslations>; limits: { maxVideoMb: number } }) {
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState('');
  const [step, setStep] = useState<'' | 'upload' | 'analyze'>('');
  const [out, setOut] = useState<{ result: string; modelId: string } | null>(null);
  const { busy, error, run } = useRunner();
  const tooBig = !!file && file.size > limits.maxVideoMb * 1024 * 1024;
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        {t('video.notice', { mb: limits.maxVideoMb })}
      </p>
      <label className="block text-sm text-gray-700 dark:text-gray-300">
        {t('video.file')}
        <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv" className={inputClass} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setOut(null); }} />
      </label>
      {tooBig && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('video.tooBig', { mb: limits.maxVideoMb })}</p>}
      <label className="block text-sm text-gray-700 dark:text-gray-300">
        {t('video.question')}
        <textarea className={`${inputClass} min-h-[80px]`} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('video.questionPlaceholder')} />
      </label>
      <button
        type="button"
        className={buttonClass}
        disabled={busy || !file || tooBig}
        onClick={() => run(async () => {
          if (!file) return;
          setStep('upload');
          const up = await postTool('media-upload', { kind: 'video', fileName: file.name, size: file.size });
          const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: file });
          if (!put.ok) throw new Error(t('video.uploadFailed', { status: put.status }));
          setStep('analyze');
          setOut(await postTool('video', { key: up.key, question, language: locale }));
          setStep('');
        })}
      >
        <Film className="h-4 w-4" aria-hidden /> {busy ? (step === 'upload' ? t('video.uploading') : t('video.analyzing')) : t('video.run')}
      </button>
      <ErrorLine error={error} />
      {out && (
        <>
          <ResultText text={out.result} t={t} fileName="video-analysis.md" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('video.model', { model: out.modelId })}</p>
        </>
      )}
    </div>
  );
}
export function ToolsWorkspace({ initialTab }: { initialTab?: string }) {
  const t = useTranslations('tools');
  const [config, setConfig] = useState<ToolsConfig | null>(null);
  const [tab, setTab] = useState<Tab>((initialTab as Tab) || 'translate');

  useEffect(() => {
    fetch('/api/tools/config')
      .then((r) => r.json())
      .then((d) => d.success && setConfig(d))
      .catch(() => {});
  }, []);

  const tabs: { id: Tab; icon: typeof Languages; enabled: boolean }[] = [
    { id: 'translate', icon: Languages, enabled: true },
    { id: 'proofread', icon: SpellCheck, enabled: true },
    { id: 'diagram', icon: Workflow, enabled: true },
    { id: 'webExtract', icon: Globe, enabled: config?.tools.webExtract ?? true },
    { id: 'image', icon: ImageIcon, enabled: config?.tools.image ?? false },
    { id: 'videoGen', icon: Clapperboard, enabled: config?.tools.videoGeneration ?? false },
    { id: 'minutes', icon: Mic, enabled: config?.tools.media ?? false },
    { id: 'video', icon: Film, enabled: config?.tools.media ?? false },
    { id: 'code', icon: Code2, enabled: config?.tools.codeInterpreter ?? false },
    { id: 'useCases', icon: FileSearch, enabled: config?.tools.useCases ?? true },
  ];
  const visible = tabs.filter((x) => x.enabled);
  const current = visible.some((x) => x.id === tab) ? tab : 'translate';

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('title')}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('subtitle')}</p>
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4" role="tablist" aria-label={t('title')}>
        {visible.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={current === id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              current === id ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden /> {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4" role="tabpanel">
        {current === 'translate' && <TranslatePanel t={t} />}
        {current === 'proofread' && <ProofreadPanel t={t} />}
        {current === 'diagram' && <DiagramPanel t={t} />}
        {current === 'webExtract' && <WebExtractPanel t={t} />}
        {current === 'image' && config?.image && <ImagePanel t={t} config={config.image} />}
        {current === 'videoGen' && config?.videoGeneration && <VideoGenPanel t={t} config={config.videoGeneration} />}
        {current === 'minutes' && config?.media && <MinutesPanel t={t} limits={config.media} />}
        {current === 'video' && config?.media && <VideoPanel t={t} limits={config.media} />}
        {current === 'code' && config?.codeInterpreter && <CodePanel t={t} limits={config.codeInterpreter} />}
        {current === 'useCases' && <UseCasesPanel t={t} />}
      </section>
    </div>
  );
}
