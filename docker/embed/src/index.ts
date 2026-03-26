/**
 * FSx ONTAP Embedding Server
 * 
 * CIFSマウントされたFSx ONTAPボリューム上のドキュメントを読み取り、
 * Amazon Bedrock Titan Embed Text v2でベクトル化し、
 * OpenSearch Serverlessにインデックスする。
 * 
 * メタデータファイル（.metadata.json）からSID情報を読み取り、
 * Permission-aware RAGのためのアクセス制御情報を保持する。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { indexDocument, initOssClient } from './oss-client';

dotenv.config();

const REGION = process.env.ENV_REGION || 'ap-northeast-1';
const DATA_DIR = process.env.ENV_DATA_DIR || '/opt/netapp/ai/data';
const DB_DIR = process.env.ENV_DB_DIR || '/opt/netapp/ai/db';
const EMBEDDING_MODEL = process.env.ENV_EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
const INDEX_NAME = process.env.ENV_INDEX_NAME || 'bedrock-knowledge-base-default-index';
const COLLECTION_NAME = process.env.ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME || '';
const WATCH_MODE = process.env.ENV_WATCH_MODE === 'true';

const bedrock = new BedrockRuntimeClient({ region: REGION });

/** 処理済みファイルの記録 */
const processedDbPath = path.join(DB_DIR, 'processed.json');

interface ProcessedRecord {
  [filePath: string]: { mtime: string; indexedAt: string };
}

function loadProcessed(): ProcessedRecord {
  try {
    if (fs.existsSync(processedDbPath)) {
      return JSON.parse(fs.readFileSync(processedDbPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveProcessed(records: ProcessedRecord): void {
  fs.mkdirSync(path.dirname(processedDbPath), { recursive: true });
  fs.writeFileSync(processedDbPath, JSON.stringify(records, null, 2));
}

/** Bedrock Titan Embed Text v2 でテキストをベクトル化 */
async function generateEmbedding(text: string): Promise<number[]> {
  const body = JSON.stringify({
    inputText: text.substring(0, 8000), // Titan v2 max input
    dimensions: 1024,
    normalize: true,
  });

  const resp = await bedrock.send(new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  }));

  const result = JSON.parse(new TextDecoder().decode(resp.body));
  return result.embedding;
}

/** メタデータファイルを読み取り */
interface DocMetadata {
  metadataAttributes?: Record<string, any>;
  documentId?: string;
  [key: string]: any;
}

function loadMetadata(docPath: string): DocMetadata {
  const metaPath = docPath + '.metadata.json';
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
  } catch (e) {
    console.warn(`⚠️ メタデータ読み取り失敗: ${metaPath}`, e);
  }
  return {};
}

/** テキストをチャンクに分割（シンプルな固定サイズ分割） */
function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }
  return chunks.length > 0 ? chunks : [text];
}

/** ディレクトリを再帰的にスキャンしてドキュメントファイルを取得 */
function scanDocuments(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️ ディレクトリが存在しません: ${dir}`);
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDocuments(fullPath));
    } else if (entry.isFile() && !entry.name.endsWith('.metadata.json')) {
      // .md, .txt, .html などのテキストファイルを対象
      const ext = path.extname(entry.name).toLowerCase();
      if (['.md', '.txt', '.html', '.csv', '.json', '.xml'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

/** 1ファイルを処理（チャンク分割→Embedding→インデックス） */
async function processFile(filePath: string): Promise<number> {
  const relativePath = path.relative(DATA_DIR, filePath);
  console.log(`📄 処理中: ${relativePath}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.trim()) {
    console.log(`  ⏭️ 空ファイル、スキップ`);
    return 0;
  }

  const metadata = loadMetadata(filePath);
  const chunks = chunkText(content);
  console.log(`  📝 ${chunks.length} チャンクに分割`);

  let indexed = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const embedding = await generateEmbedding(chunk);

      // Bedrock KB互換のメタデータ形式
      const metadataStr = JSON.stringify({
        source: relativePath,
        'x-amz-bedrock-kb-source-uri': `s3://fsx-ontap/${relativePath}`,
        ...metadata.metadataAttributes,
      });

      const docId = `${relativePath.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`;

      await indexDocument(INDEX_NAME, docId, {
        'bedrock-knowledge-base-default-vector': embedding,
        'AMAZON_BEDROCK_TEXT_CHUNK': chunk,
        'AMAZON_BEDROCK_METADATA': metadataStr,
      });

      indexed++;
      // Bedrock API rate limit対策
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`  ❌ チャンク ${i} のインデックス失敗:`, e);
    }
  }

  console.log(`  ✅ ${indexed}/${chunks.length} チャンクをインデックス`);
  return indexed;
}

/** メイン処理 */
async function main(): Promise<void> {
  console.log('🚀 FSx ONTAP Embedding Server 起動');
  console.log(`  リージョン: ${REGION}`);
  console.log(`  データディレクトリ: ${DATA_DIR}`);
  console.log(`  DBディレクトリ: ${DB_DIR}`);
  console.log(`  Embeddingモデル: ${EMBEDDING_MODEL}`);
  console.log(`  インデックス名: ${INDEX_NAME}`);
  console.log(`  コレクション名: ${COLLECTION_NAME}`);
  console.log(`  監視モード: ${WATCH_MODE}`);

  // OpenSearch Serverless クライアント初期化
  await initOssClient(REGION, COLLECTION_NAME);

  // 処理済みファイル記録をロード
  const processed = loadProcessed();

  // ドキュメントスキャン
  const files = scanDocuments(DATA_DIR);
  console.log(`\n📂 ${files.length} ファイルを検出`);

  let totalIndexed = 0;
  let totalSkipped = 0;

  for (const filePath of files) {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtime.toISOString();
    const relativePath = path.relative(DATA_DIR, filePath);

    // 既に処理済みで変更がない場合はスキップ
    if (processed[relativePath] && processed[relativePath].mtime === mtime) {
      console.log(`⏭️ スキップ（変更なし）: ${relativePath}`);
      totalSkipped++;
      continue;
    }

    try {
      const count = await processFile(filePath);
      totalIndexed += count;

      // 処理済み記録を更新
      processed[relativePath] = { mtime, indexedAt: new Date().toISOString() };
      saveProcessed(processed);
    } catch (e) {
      console.error(`❌ ファイル処理失敗: ${relativePath}`, e);
    }
  }

  console.log(`\n📊 処理完了サマリー:`);
  console.log(`  検出ファイル: ${files.length}`);
  console.log(`  インデックス済みチャンク: ${totalIndexed}`);
  console.log(`  スキップ: ${totalSkipped}`);

  if (WATCH_MODE) {
    console.log('\n👀 ファイル監視モード開始...');
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(DATA_DIR, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
    });

    // 並行実行を防ぐキュー（大量ファイル同時アップロード対策）
    const queue: string[] = [];
    let processing = false;
    async function processQueue() {
      if (processing) return;
      processing = true;
      while (queue.length > 0) {
        const fp = queue.shift()!;
        try {
          await processFile(fp);
          const rel = path.relative(DATA_DIR, fp);
          const mtime = fs.statSync(fp).mtime.toISOString();
          const proc = loadProcessed();
          proc[rel] = { mtime, indexedAt: new Date().toISOString() };
          saveProcessed(proc);
        } catch (e) {
          console.error(`❌ ファイル処理失敗: ${fp}`, e);
        }
      }
      processing = false;
    }

    watcher.on('add', (fp: string) => {
      if (!fp.endsWith('.metadata.json')) {
        console.log(`\n📥 新規ファイル検出: ${fp}`);
        queue.push(fp);
        processQueue();
      }
    });

    watcher.on('change', (fp: string) => {
      if (!fp.endsWith('.metadata.json')) {
        console.log(`\n📝 ファイル変更検出: ${fp}`);
        queue.push(fp);
        processQueue();
      }
    });

    // プロセスを維持
    await new Promise(() => {});
  } else {
    console.log('\n✅ バッチ処理完了。終了します。');
  }
}

main().catch((err) => {
  console.error('💥 致命的エラー:', err);
  process.exit(1);
});
