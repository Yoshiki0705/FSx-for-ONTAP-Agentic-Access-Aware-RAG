// The service worker must cache only files that are the same for every user.
// public/sw.js is plain JavaScript run by the browser, so it is loaded here in a sandbox
// with a fake Cache Storage and the events are fired by hand.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SOURCE = fs.readFileSync(path.join(__dirname, '../../../public/sw.js'), 'utf8');
const ORIGIN = 'https://app.example.test';

type Handler = (event: any) => void;

function makeResponse(status = 200, type = 'basic', body = 'x') {
  return { ok: status >= 200 && status < 300, status, type, body, clone() { return { ...this }; } };
}

function setup(network: (url: string, init?: any) => any) {
  const stores = new Map<string, Map<string, any>>();
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  const cacheApi = (name: string) => {
    const s = store(name);
    return {
      addAll: async (urls: string[]) => { for (const u of urls) s.set(ORIGIN + u, makeResponse()); },
      match: async (req: any) => s.get(typeof req === 'string' ? (req.startsWith('http') ? req : ORIGIN + req) : req.url),
      put: async (req: any, res: any) => { s.set(req.url, res); },
      keys: async () => [...s.keys()].map((url) => ({ url })),
      delete: async (req: any) => s.delete(req.url ?? req),
    };
  };
  const caches = {
    open: async (name: string) => cacheApi(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (req: string) => {
      for (const s of stores.values()) if (s.has(ORIGIN + req)) return s.get(ORIGIN + req);
      return undefined;
    },
  };
  const handlers: Record<string, Handler> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, h: Handler) => { handlers[type] = h; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const fetched: string[] = [];
  const sandbox: any = {
    self, caches, URL,
    Response: { error: () => ({ error: true }) },
    fetch: async (req: any) => { fetched.push(req.url); return network(req.url, req); },
  };
  vm.runInNewContext(SOURCE, sandbox);
  const fire = async (type: string, event: any) => {
    let pending: Promise<any> | undefined;
    event.waitUntil = (p: Promise<any>) => { pending = p; };
    event.respondWith = (p: Promise<any>) => { pending = p; event.responded = true; };
    handlers[type](event);
    return pending ? await pending : undefined;
  };
  const request = (url: string, extra: any = {}) => ({ url: url.startsWith('http') ? url : ORIGIN + url, method: 'GET', mode: 'no-cors', ...extra });
  return { stores, store, fire, request, fetched };
}

const allCachedUrls = (stores: Map<string, Map<string, any>>) => [...stores.values()].flatMap((s) => [...s.keys()]);

describe('service worker', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => { t = setup(() => makeResponse()); });

  it('precaches the offline page and the icons on install', async () => {
    await t.fire('install', {});
    expect(allCachedUrls(t.stores).sort()).toEqual(
      ['/icons/icon-192.png', '/icons/icon-512.png', '/offline.html'].map((u) => ORIGIN + u).sort());
  });

  it('caches a build asset after the first fetch and serves it from the cache after that', async () => {
    const url = '/_next/static/chunks/app-abc123.js';
    const first: any = { request: t.request(url) };
    await t.fire('fetch', first);
    expect(first.responded).toBe(true);
    expect(t.fetched).toEqual([ORIGIN + url]);
    await t.fire('fetch', { request: t.request(url) });
    expect(t.fetched).toHaveLength(1); // the second request came from the cache
  });

  // Control for the tests below: this is the path that is allowed to store things.
  it('does not store an error, a redirect or an opaque response', async () => {
    for (const [i, res] of [makeResponse(404), makeResponse(500), makeResponse(200, 'opaque'), makeResponse(200, 'cors')].entries()) {
      const tt = setup(() => res);
      await tt.fire('fetch', { request: tt.request(`/_next/static/chunks/x${i}.js`) });
      expect(allCachedUrls(tt.stores)).toEqual([]);
    }
  });

  it.each([
    '/api/bedrock/kb/retrieve',
    '/api/auth/session',
    '/api/files/download?key=a',
    '/ja/genai',
    '/ja/signin',
    '/manifest.json',
    '/config/kb-models.json',
  ])('does not handle or store %s', async (p) => {
    const e: any = { request: t.request(p) };
    await t.fire('fetch', e);
    expect(e.responded).toBeUndefined();
    expect(t.fetched).toEqual([]);
    expect(allCachedUrls(t.stores)).toEqual([]);
  });

  it('does not handle a write request even to a static path', async () => {
    const e: any = { request: t.request('/_next/static/chunks/a.js', { method: 'POST' }) };
    await t.fire('fetch', e);
    expect(e.responded).toBeUndefined();
    expect(t.fetched).toEqual([]);
  });

  it('does not handle another origin, even for a static-looking path', async () => {
    const e: any = { request: t.request('https://cdn.example.test/_next/static/a.js') };
    await t.fire('fetch', e);
    expect(e.responded).toBeUndefined();
    expect(allCachedUrls(t.stores)).toEqual([]);
  });

  it('sends a page navigation to the network and never stores the page', async () => {
    const e: any = { request: t.request('/ja/genai', { mode: 'navigate' }) };
    const res = await t.fire('fetch', e);
    expect(res.body).toBe('x');
    expect(t.fetched).toEqual([ORIGIN + '/ja/genai']);
    expect(allCachedUrls(t.stores)).toEqual([]);
  });

  it('shows the offline page when a navigation cannot reach the network', async () => {
    const offline = setup(() => { throw new Error('network down'); });
    await offline.fire('install', {});
    const res = await offline.fire('fetch', { request: offline.request('/ja/genai', { mode: 'navigate' }) });
    expect(res).toBe(offline.store('rag-static-v1').get(ORIGIN + '/offline.html'));
  });

  it('removes caches from older versions on activate', async () => {
    t.store('rag-static-v0').set('x', 1);
    t.store('something-else').set('y', 1);
    await t.fire('install', {});
    await t.fire('activate', {});
    expect([...t.stores.keys()]).toEqual(['rag-static-v1']);
  });

  it('keeps the asset cache bounded', async () => {
    for (let i = 0; i < 170; i++) {
      await t.fire('fetch', { request: t.request(`/_next/static/chunks/c${i}.js`) });
    }
    expect(t.store('rag-static-v1').size).toBeLessThanOrEqual(150);
  });
});
