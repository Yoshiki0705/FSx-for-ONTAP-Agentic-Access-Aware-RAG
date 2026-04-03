/**
 * LDAP Connector モジュール
 *
 * LDAP/LDAPSプロトコルでディレクトリサービスに直接クエリを実行し、
 * ユーザー属性・グループメンバーシップを取得する。
 *
 * - Node.js built-in `net`/`tls` モジュールによる最小限のLDAPクライアント実装
 * - 接続プーリングなし（リクエストごとに接続作成・破棄）
 * - タイムアウト: 30秒
 * - Fail-Open: エラー時はサインインをブロックしない
 *
 * Requirements: 3.1, 3.3, 3.4, 3.5, 10.1, 10.4, 10.5, 10.6
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
// Note: Buffer/Uint8Array type compatibility issues with @types/node v20+
// are suppressed here. The code is functionally correct and tested.

import * as net from 'net';
import * as tls from 'tls';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// ========================================
// 型定義
// ========================================

export interface LdapConfig {
  ldapUrl: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userSearchFilter: string;   // e.g. '(mail={email})'
  groupSearchFilter: string;  // e.g. '(member={dn})'
}

export interface LdapUserInfo {
  dn: string;
  objectSid?: string;
  uidNumber?: number;
  gidNumber?: number;
  memberOf?: string[];
  groups?: Array<{ name: string; gid?: number; sid?: string }>;
}

/** 構造化ログインターフェース（Task 4.4） */
export interface ErrorLog {
  level: 'ERROR' | 'WARN' | 'INFO';
  source: 'LdapConnector' | 'IdentitySyncLambda' | 'OidcClaimsParser' | 'PermissionResolver';
  operation: string;
  userId: string;
  error?: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

// ========================================
// 構造化ログ出力（Task 4.4）
// ========================================

/** 機密情報を除外したログ出力 */

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'bindPassword', 'clientSecret', 'credential'];

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function structuredLog(log: ErrorLog): void {
  const sanitized = log.context ? { ...log, context: sanitizeForLog(log.context) } : log;
  if (log.level === 'ERROR') {
    console.error(JSON.stringify(sanitized));
  } else if (log.level === 'WARN') {
    console.warn(JSON.stringify(sanitized));
  } else {
    console.log(JSON.stringify(sanitized));
  }
}

// ========================================
// LDAPインジェクション防止（Task 4.2）
// ========================================

/**
 * LDAP特殊文字をエスケープする。
 * RFC 4515 に準拠: \, *, (, ), NUL をエスケープ。
 */
export function escapeFilter(input: string): string {
  return input
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

// ========================================
// Secrets Manager パスワード取得（Task 4.3）
// ========================================

const REGION = process.env.AWS_REGION || 'ap-northeast-1';

/**
 * Secrets Manager からバインドパスワードを取得する。
 * 失敗時は1回リトライ。それでも失敗した場合は null を返す（Fail-Open）。
 */
export async function getBindPassword(
  secretArn: string,
  smClient?: SecretsManagerClient,
): Promise<string | null> {
  const client = smClient || new SecretsManagerClient({ region: REGION });
  const maxRetries = 2; // 初回 + 1回リトライ

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      const secretString = resp.SecretString;
      if (!secretString) {
        structuredLog({
          level: 'WARN',
          source: 'LdapConnector',
          operation: 'getBindPassword',
          userId: '',
          error: 'SecretString is empty',
          context: { secretArn, attempt },
          timestamp: new Date().toISOString(),
        });
        return null;
      }
      return secretString;
    } catch (err: unknown) {
      const error = err as Error;
      structuredLog({
        level: attempt < maxRetries ? 'WARN' : 'ERROR',
        source: 'LdapConnector',
        operation: 'getBindPassword',
        userId: '',
        error: error.message,
        context: { secretArn, attempt, maxRetries },
        timestamp: new Date().toISOString(),
      });
      if (attempt >= maxRetries) {
        return null;
      }
    }
  }
  return null;
}

// ========================================
// 最小限 LDAP プロトコル実装
// ========================================

/** BER (Basic Encoding Rules) エンコーディングヘルパー */
// Helper to work around Buffer/Uint8Array type incompatibility in @types/node v20+
const concat = (...bufs: Buffer[]): Buffer => Buffer.concat(bufs as any);

function berLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  } else if (length < 0x100) {
    return Buffer.from([0x81, length]);
  } else {
    return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
  }
}

function berSequence(tag: number, ...parts: Buffer[]): Buffer {
  const content = concat(...parts);
  return concat(Buffer.from([tag]), berLength(content.length), content);
}

function berOctetString(value: string): Buffer {
  const buf = Buffer.from(value, 'utf8');
  return concat(Buffer.from([0x04]), berLength(buf.length), buf);
}

function berInteger(value: number): Buffer {
  const bytes: number[] = [];
  let v = value;
  if (v === 0) {
    bytes.push(0);
  } else {
    while (v > 0) {
      bytes.unshift(v & 0xff);
      v >>= 8;
    }
    if (bytes[0] & 0x80) bytes.unshift(0);
  }
  return concat(Buffer.from([0x02]), berLength(bytes.length), Buffer.from(bytes));
}

function berEnumerated(value: number): Buffer {
  return concat(Buffer.from([0x0a, 0x01, value]));
}

function berBoolean(value: boolean): Buffer {
  return Buffer.from([0x01, 0x01, value ? 0xff : 0x00]);
}

/** LDAP Bind Request を構築 */
function buildBindRequest(messageId: number, bindDn: string, password: string): Buffer {
  const version = berInteger(3);
  const name = berOctetString(bindDn);
  const auth = concat(Buffer.from([0x80]), berLength(Buffer.byteLength(password, 'utf8')), Buffer.from(password, 'utf8'));
  const bindReq = berSequence(0x60, version, name, auth);
  return berSequence(0x30, berInteger(messageId), bindReq);
}

/** LDAP Search Request を構築 */
function buildSearchRequest(
  messageId: number,
  baseDn: string,
  filter: string,
  attributes: string[],
): Buffer {
  const base = berOctetString(baseDn);
  const scope = berEnumerated(2); // wholeSubtree
  const deref = berEnumerated(0); // neverDerefAliases
  const sizeLimit = berInteger(1); // 1 result
  const timeLimit = berInteger(30);
  const typesOnly = berBoolean(false);

  // Simple filter encoding — wrap as raw octet string filter
  const filterBuf = encodeSimpleLdapFilter(filter);

  const attrList = berSequence(0x30, ...attributes.map(a => berOctetString(a)));

  const searchReq = berSequence(0x63, base, scope, deref, sizeLimit, timeLimit, typesOnly, filterBuf, attrList);
  return berSequence(0x30, berInteger(messageId), searchReq);
}

/** 簡易LDAPフィルタエンコーダ — (attr=value) 形式のみサポート */
function encodeSimpleLdapFilter(filter: string): Buffer {
  // Strip outer parens
  let f = filter.trim();
  if (f.startsWith('(') && f.endsWith(')')) {
    f = f.slice(1, -1);
  }

  // AND filter: &(...)(...) 
  if (f.startsWith('&')) {
    const parts = parseFilterParts(f.slice(1));
    return berSequence(0xa0, ...parts.map(p => encodeSimpleLdapFilter(p)));
  }

  // OR filter: |(...)(...) 
  if (f.startsWith('|')) {
    const parts = parseFilterParts(f.slice(1));
    return berSequence(0xa1, ...parts.map(p => encodeSimpleLdapFilter(p)));
  }

  // NOT filter: !(...)
  if (f.startsWith('!')) {
    const inner = f.slice(1).trim();
    return berSequence(0xa2, encodeSimpleLdapFilter(inner));
  }

  // Equality match: attr=value
  const eqIdx = f.indexOf('=');
  if (eqIdx > 0) {
    const attr = f.slice(0, eqIdx);
    const value = f.slice(eqIdx + 1);
    return berSequence(0xa3, berOctetString(attr), berOctetString(value));
  }

  // Fallback: present filter
  const buf = Buffer.from(f, 'utf8');
  return concat(Buffer.from([0x87]), berLength(buf.length), buf);
}

/** フィルタ内の括弧で囲まれたパーツを分割 */
function parseFilterParts(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (s[i] === ')') {
      depth--;
      if (depth === 0 && start >= 0) {
        parts.push(s.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return parts;
}

/** BER レスポンスパーサー */
function parseBerTlv(buf: Buffer, offset: number): { tag: number; length: number; value: Buffer; nextOffset: number } | null {
  if (offset >= buf.length) return null;
  const tag = buf[offset];
  let lenOffset = offset + 1;
  if (lenOffset >= buf.length) return null;

  let length: number;
  let valueOffset: number;

  if (buf[lenOffset] < 0x80) {
    length = buf[lenOffset];
    valueOffset = lenOffset + 1;
  } else if (buf[lenOffset] === 0x81) {
    if (lenOffset + 1 >= buf.length) return null;
    length = buf[lenOffset + 1];
    valueOffset = lenOffset + 2;
  } else if (buf[lenOffset] === 0x82) {
    if (lenOffset + 2 >= buf.length) return null;
    length = (buf[lenOffset + 1] << 8) | buf[lenOffset + 2];
    valueOffset = lenOffset + 3;
  } else {
    return null;
  }

  if (valueOffset + length > buf.length) return null;
  const value = buf.subarray(valueOffset, valueOffset + length);
  return { tag, length, value, nextOffset: valueOffset + length };
}

/** LDAP SearchResultEntry からユーザー情報を抽出 */
function parseSearchResultEntry(data: Buffer): Partial<LdapUserInfo> {
  const result: Partial<LdapUserInfo> = {};

  // Parse the LDAP message envelope
  const envelope = parseBerTlv(data, 0);
  if (!envelope || envelope.tag !== 0x30) return result;

  // Skip messageId, find SearchResultEntry (tag 0x64)
  let off = 0;
  const msgId = parseBerTlv(envelope.value, off);
  if (!msgId) return result;
  off = msgId.nextOffset - (data.length - envelope.value.length - (envelope.nextOffset - envelope.value.length));

  // Re-parse within envelope value

  // Simplified: parse attributes from raw buffer

  // Extract DN
  const dnMatch = extractStringAfterTag(envelope.value, 0x64);
  if (dnMatch) {
    result.dn = dnMatch;
  }

  // Extract attributes by searching for known attribute names
  const attrs = extractAttributes(data);

  if (attrs['objectSid'] || attrs['objectsid']) {
    const sidBuf = attrs['objectSid'] || attrs['objectsid'];
    if (sidBuf) {
      result.objectSid = typeof sidBuf === 'string' ? sidBuf : Array.isArray(sidBuf) ? sidBuf[0] : String(sidBuf);
    }
  }

  if (attrs['uidNumber'] || attrs['uidnumber']) {
    const val = attrs['uidNumber'] || attrs['uidnumber'];
    const num = parseInt(typeof val === 'string' ? val : val.toString(), 10);
    if (!isNaN(num)) result.uidNumber = num;
  }

  if (attrs['gidNumber'] || attrs['gidnumber']) {
    const val = attrs['gidNumber'] || attrs['gidnumber'];
    const num = parseInt(typeof val === 'string' ? val : val.toString(), 10);
    if (!isNaN(num)) result.gidNumber = num;
  }

  if (attrs['memberOf'] || attrs['memberof']) {
    const val = attrs['memberOf'] || attrs['memberof'];
    if (Array.isArray(val)) {
      result.memberOf = val.map(v => String(v));
    } else if (typeof val === 'string') {
      result.memberOf = [val];
    }
  }

  return result;
}

/** バイナリ objectSid を文字列 SID に変換 */
export function decodeSid(buf: Buffer): string {
  if (buf.length < 8) return buf.toString('hex');
  const revision = buf[0];
  const subAuthCount = buf[1];
  const authority = buf.readUIntBE(2, 6);
  const parts = [`S-${revision}-${authority}`];
  for (let i = 0; i < subAuthCount && (8 + i * 4 + 4) <= buf.length; i++) {
    parts.push(buf.readUInt32LE(8 + i * 4).toString());
  }
  return parts.join('-');
}

/** BER構造から属性を抽出する簡易パーサー */
function extractAttributes(data: Buffer): Record<string, string | string[]> {
  const attrs: Record<string, string | string[]> = {};
  const str = data.toString('binary');

  // Known attribute names to search for
  const attrNames = ['objectSid', 'objectsid', 'uidNumber', 'uidnumber', 'gidNumber', 'gidnumber', 'memberOf', 'memberof', 'cn', 'uid', 'mail'];

  for (const attrName of attrNames) {
    const idx = str.indexOf(attrName);
    if (idx >= 0) {
      // Try to extract value after the attribute name in BER structure
      const afterAttr = idx + attrName.length;
      // Look for octet string values following the attribute
      const remaining = data.subarray(afterAttr);
      const values = extractOctetStringValues(remaining);
      if (values.length === 1) {
        attrs[attrName] = values[0];
      } else if (values.length > 1) {
        attrs[attrName] = values;
      }
    }
  }

  return attrs;
}

/** BERデータからオクテット文字列値を抽出 */
function extractOctetStringValues(data: Buffer): string[] {
  const values: string[] = [];
  let offset = 0;
  let found = 0;

  while (offset < data.length && found < 20) {
    const tlv = parseBerTlv(data, offset);
    if (!tlv) break;

    if (tlv.tag === 0x04 && tlv.value.length > 0 && tlv.value.length < 1024) {
      const str = tlv.value.toString('utf8');
      // Filter out non-printable strings (likely binary data like SID)
      if (/^[\x20-\x7e\u0080-\uffff]+$/.test(str)) {
        values.push(str);
        found++;
      }
    }

    if (tlv.tag === 0x31) {
      // SET — contains attribute values
      const setValues = extractOctetStringValues(tlv.value);
      values.push(...setValues);
      found += setValues.length;
    }

    offset = tlv.nextOffset;
    if (found >= 5) break; // Limit extraction
  }

  return values;
}

/** タグ後の最初の文字列を抽出 */
function extractStringAfterTag(data: Buffer, tag: number): string | null {
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === tag) {
      const tlv = parseBerTlv(data, i);
      if (tlv && tlv.value.length > 0) {
        // First octet string inside
        const inner = parseBerTlv(tlv.value, 0);
        if (inner && inner.tag === 0x04) {
          return inner.value.toString('utf8');
        }
      }
    }
  }
  return null;
}

// ========================================
// LDAP Connector クラス（Task 4.1）
// ========================================

const LDAP_TIMEOUT_MS = 30_000;

export class LdapConnector {
  constructor(private config: LdapConfig) {}

  /**
   * メールアドレスでLDAPユーザーを検索し、権限情報を取得する。
   * エラー時は null を返す（Fail-Open）。
   */
  async queryUser(email: string): Promise<LdapUserInfo | null> {
    const startTime = Date.now();

    try {
      // URL解析
      const url = new URL(this.config.ldapUrl);
      const useTls = url.protocol === 'ldaps:';
      const host = url.hostname;
      const port = parseInt(url.port, 10) || (useTls ? 636 : 389);

      structuredLog({
        level: 'INFO',
        source: 'LdapConnector',
        operation: 'queryUser',
        userId: email,
        context: { host, port, useTls, baseDn: this.config.baseDn },
        timestamp: new Date().toISOString(),
      });

      // 接続確立
      const socket = await this.connect(host, port, useTls);

      try {
        // バインド認証
        await this.bind(socket, this.config.bindDn, this.config.bindPassword);

        // ユーザー検索
        const escapedEmail = escapeFilter(email);
        const filter = this.config.userSearchFilter.replace('{email}', escapedEmail);
        const attributes = ['dn', 'objectSid', 'uidNumber', 'gidNumber', 'memberOf', 'cn', 'uid', 'mail'];

        const userInfo = await this.search(socket, this.config.baseDn, filter, attributes);

        if (!userInfo) {
          structuredLog({
            level: 'INFO',
            source: 'LdapConnector',
            operation: 'queryUser',
            userId: email,
            error: 'User not found in LDAP',
            context: { filter, elapsedMs: Date.now() - startTime },
            timestamp: new Date().toISOString(),
          });
          return null;
        }

        // グループ情報の整形
        if (userInfo.memberOf && userInfo.memberOf.length > 0) {
          userInfo.groups = userInfo.memberOf.map(dn => {
            const cnMatch = dn.match(/^[Cc][Nn]=([^,]+)/);
            return { name: cnMatch ? cnMatch[1] : dn };
          });
        }

        structuredLog({
          level: 'INFO',
          source: 'LdapConnector',
          operation: 'queryUser',
          userId: email,
          context: {
            dn: userInfo.dn,
            hasObjectSid: !!userInfo.objectSid,
            hasUidNumber: userInfo.uidNumber !== undefined,
            hasGidNumber: userInfo.gidNumber !== undefined,
            groupCount: userInfo.memberOf?.length || 0,
            elapsedMs: Date.now() - startTime,
          },
          timestamp: new Date().toISOString(),
        });

        return userInfo;
      } finally {
        // 接続クローズ（プーリングなし）
        socket.destroy();
      }
    } catch (err: unknown) {
      const error = err as Error;
      structuredLog({
        level: 'ERROR',
        source: 'LdapConnector',
        operation: 'queryUser',
        userId: email,
        error: error.message,
        stack: error.stack,
        context: { elapsedMs: Date.now() - startTime },
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  /** TCP/TLS接続を確立 */
  private connect(host: string, port: number, useTls: boolean): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`LDAP connection timeout after ${LDAP_TIMEOUT_MS}ms`));
      }, LDAP_TIMEOUT_MS);

      let socket: net.Socket;

      if (useTls) {
        socket = tls.connect({ host, port, rejectUnauthorized: true }, () => {
          clearTimeout(timeout);
          resolve(socket);
        });
      } else {
        socket = net.connect({ host, port }, () => {
          clearTimeout(timeout);
          resolve(socket);
        });
      }

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      socket.setTimeout(LDAP_TIMEOUT_MS);
      socket.on('timeout', () => {
        socket.destroy();
        clearTimeout(timeout);
        reject(new Error(`LDAP socket timeout after ${LDAP_TIMEOUT_MS}ms`));
      });
    });
  }

  /** LDAP Bind 認証 */
  private bind(socket: net.Socket, bindDn: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('LDAP bind timeout'));
      }, LDAP_TIMEOUT_MS);

      const bindReq = buildBindRequest(1, bindDn, password);
      socket.write(bindReq as any);

      const onData = (data: Buffer) => {
        clearTimeout(timeout);
        socket.removeListener('data', onData);

        // Check for BindResponse (tag 0x61)
        // Parse result code from response
        const envelope = parseBerTlv(data, 0);
        if (!envelope || envelope.tag !== 0x30) {
          reject(new Error('Invalid LDAP bind response'));
          return;
        }

        // Look for result code 0 (success)
        if (data.includes(Buffer.from([0x61]))) {
          // Find result code in bind response
          const resultCode = extractResultCode(data);
          if (resultCode === 0) {
            resolve();
          } else {
            reject(new Error(`LDAP bind failed with result code: ${resultCode}`));
          }
        } else {
          reject(new Error('Unexpected LDAP bind response'));
        }
      };

      socket.on('data', onData);
    });
  }

  /** LDAP Search 実行 */
  private search(
    socket: net.Socket,
    baseDn: string,
    filter: string,
    attributes: string[],
  ): Promise<LdapUserInfo | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('LDAP search timeout'));
      }, LDAP_TIMEOUT_MS);

      const searchReq = buildSearchRequest(2, baseDn, filter, attributes);
      socket.write(searchReq as any);

      const chunks: Buffer[] = [];
      let userInfo: LdapUserInfo | null = null;

      const onData = (data: Buffer) => {
        chunks.push(data);
        const combined = concat(...chunks);

        // Check for SearchResultDone (tag 0x65)
        if (combined.includes(Buffer.from([0x65]))) {
          clearTimeout(timeout);
          socket.removeListener('data', onData);

          // Parse SearchResultEntry (tag 0x64) if present
          if (combined.includes(Buffer.from([0x64]))) {
            const parsed = parseSearchResultEntry(combined);
            if (parsed.dn) {
              userInfo = {
                dn: parsed.dn,
                objectSid: parsed.objectSid,
                uidNumber: parsed.uidNumber,
                gidNumber: parsed.gidNumber,
                memberOf: parsed.memberOf,
              };
            }
          }

          resolve(userInfo);
        }
      };

      socket.on('data', onData);
    });
  }

  /** escapeFilter の静的メソッド版（テスト用エクスポート） */
  static escapeFilter(input: string): string {
    return escapeFilter(input);
  }
}

/** LDAP レスポンスから結果コードを抽出 */
function extractResultCode(data: Buffer): number {
  // Search for enumerated value (tag 0x0a, length 0x01) after response tag
  for (let i = 0; i < data.length - 2; i++) {
    if (data[i] === 0x0a && data[i + 1] === 0x01) {
      return data[i + 2];
    }
  }
  return -1;
}
