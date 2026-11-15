/**
 * Fetches a public web page for the web extraction tool.
 *
 * The request is sent from the web app's Lambda, so the URL is untrusted input that could
 * point at the instance metadata service, the VPC, or the Lambda itself (SSRF). The guard:
 * - only http/https on the default ports, no credentials in the URL;
 * - every address the host name resolves to must be public; the connection is then made to
 *   that checked address (pinned lookup), so a second DNS answer cannot swap it (rebinding);
 * - redirects are followed by hand, at most 3, and each hop is checked again;
 * - 10 s timeout, 2 MB body limit, text/html or text/plain only.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { ToolInputError } from './text-model';

export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const ALLOWED_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];

type V4Range = [number, number, number, number, number];
/** Address ranges that are not public, as [a, b, c, d, prefix length]. */
const BLOCKED_V4: V4Range[] = [
  [0, 0, 0, 0, 8], // "this network"
  [10, 0, 0, 0, 8], // private
  [100, 64, 0, 0, 10], // shared address space (CGNAT)
  [127, 0, 0, 0, 8], // loopback
  [169, 254, 0, 0, 16], // link-local, includes the instance metadata service
  [172, 16, 0, 0, 12], // private
  [192, 0, 0, 0, 24], // IETF protocol assignments
  [192, 0, 2, 0, 24], // documentation
  [192, 88, 99, 0, 24], // 6to4 relay anycast
  [192, 168, 0, 0, 16], // private
  [198, 18, 0, 0, 15], // benchmarking
  [198, 51, 100, 0, 24], // documentation
  [203, 0, 113, 0, 24], // documentation
  [224, 0, 0, 0, 4], // multicast
  [240, 0, 0, 0, 4], // reserved, includes broadcast
];

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

export function isBlockedV4(ip: string): boolean {
  const value = v4ToInt(ip);
  return BLOCKED_V4.some(([a, b, c, d, bits]) => {
    const base = v4ToInt([a, b, c, d].join('.'));
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (base & mask);
  });
}

export function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase().split('%')[0];
  if (lower === '::' || lower === '::1') return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  // The URL parser writes an IPv4-mapped address in hex (::ffff:7f00:1 for 127.0.0.1).
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isBlockedV4([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
  }
  if (lower.startsWith('::ffff:0:') || /^::(\d|[0-9a-f]{1,4}:)/.test(lower)) return true; // IPv4-translated / compatible
  const first = parseInt(lower.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return true; // unique local fc00::/7 (includes the EC2 IPv6 metadata address)
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (lower.startsWith('64:ff9b:')) return true; // NAT64, can reach private IPv4
  if (lower.startsWith('2001:db8:')) return true; // documentation
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
}

/** Throws ToolInputError for a URL the tool must not fetch. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ToolInputError('not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ToolInputError('only http and https URLs are allowed');
  if (url.username || url.password) throw new ToolInputError('URLs with credentials are not allowed');
  if (url.port && url.port !== '80' && url.port !== '443') throw new ToolInputError('only the default ports are allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new ToolInputError('this host is not allowed');
  }
  if (net.isIP(host) && isBlockedAddress(host)) throw new ToolInputError('this address is not allowed');
  return url;
}

type Resolver = (host: string) => Promise<{ address: string; family: number }[]>;
let resolveAll: Resolver = (host) => dnsLookup(host, { all: true, verbatim: true });

/** Tests replace DNS. */
export function __setResolver(r: Resolver | null): void {
  resolveAll = r ?? ((host) => dnsLookup(host, { all: true, verbatim: true }));
}

export async function publicAddress(host: string): Promise<{ address: string; family: number }> {
  const bare = host.replace(/^\[|\]$/g, '');
  if (net.isIP(bare)) {
    if (isBlockedAddress(bare)) throw new ToolInputError('this address is not allowed');
    return { address: bare, family: net.isIP(bare) };
  }
  const answers = await resolveAll(bare);
  if (answers.length === 0) throw new ToolInputError('the host name did not resolve');
  if (answers.some((a) => isBlockedAddress(a.address))) throw new ToolInputError('the host resolves to an address that is not allowed');
  return answers[0];
}

export interface FetchedPage {
  url: string;
  contentType: string;
  body: string;
}

type Requester = (url: URL, address: { address: string; family: number }) => Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>;

const defaultRequester: Requester = (url, pinned) =>
  new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: 'GET',
        headers: { 'user-agent': 'permission-aware-rag-web-extract/1.0', accept: 'text/html,text/plain;q=0.9' },
        // Connect to the address that was checked, whatever DNS answers now.
        lookup: (_host, options, cb) => {
          if ((options as { all?: boolean }).all) {
            (cb as (e: Error | null, a: { address: string; family: number }[]) => void)(null, [pinned]);
          } else {
            (cb as (e: Error | null, a: string, f: number) => void)(null, pinned.address, pinned.family);
          }
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            req.destroy(new ToolInputError('the page is larger than 2 MB'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new ToolInputError('the page did not answer within 10 seconds')));
    req.on('error', reject);
    req.end();
  });

let requester: Requester = defaultRequester;
export function __setRequester(r: Requester | null): void {
  requester = r ?? defaultRequester;
}

export async function fetchPage(raw: string): Promise<FetchedPage> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const address = await publicAddress(url.hostname);
    const res = await requester(url, address);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      if (hop === MAX_REDIRECTS) throw new ToolInputError('too many redirects');
      url = checkUrl(new URL(String(res.headers.location), url).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new ToolInputError(`the page returned HTTP ${res.status}`);
    const contentType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(contentType)) throw new ToolInputError(`unsupported content type: ${contentType || 'none'}`);
    return { url: url.toString(), contentType, body: res.body.toString('utf-8') };
  }
  throw new ToolInputError('too many redirects');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Visible text of an HTML page, with block elements as line breaks. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const text = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, text };
}
