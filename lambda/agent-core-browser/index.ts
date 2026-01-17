/**
 * Amazon Bedrock AgentCore Browser Lambda Function
 * 
 * Headless Chromeによるブラウザ自動化機能を提供します。
 * 
 * 主要機能:
 * - Headless Chrome統合（Puppeteer）
 * - Webスクレイピング（Cheerio）
 * - スクリーンショット撮影
 * - FSx for ONTAP + S3 Access Points統合
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import * as puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import * as cheerio from 'cheerio';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

/**
 * 環境変数
 */
interface EnvironmentVariables {
  PROJECT_NAME: string;
  ENVIRONMENT: string;
  SCREENSHOT_BUCKET: string;
  FSX_S3_ACCESS_POINT_ARN: string;
  SCREENSHOT_FORMAT: 'png' | 'jpeg' | 'webp';
  GENERATE_THUMBNAIL: string;
  RATE_LIMIT: string;
  RESPECT_ROBOTS_TXT: string;
  USER_AGENT: string;
}

/**
 * ブラウザリクエスト
 */
interface BrowserRequest {
  url: string;
  action: 'SCREENSHOT' | 'SCRAPE' | 'AUTOMATE';
  options?: {
    viewport?: { width: number; height: number };
    waitFor?: string;
    timeout?: number;
  };
  automation?: {
    steps: AutomationStep[];
  };
}

/**
 * 自動化ステップ
 */
interface AutomationStep {
  type: 'CLICK' | 'TYPE' | 'WAIT' | 'SCROLL';
  selector?: string;
  value?: string;
  timeout?: number;
}

/**
 * ブラウザレスポンス
 */
interface BrowserResponse {
  requestId: string;
  status: 'SUCCESS' | 'FAILED';
  result?: {
    screenshot?: string; // S3 URL
    html?: string;
    data?: Record<string, any>;
  };
  error?: {
    code: string;
    message: string;
  };
  metrics: {
    latency: number;
    pageLoadTime: number;
  };
}

/**
 * S3クライアント
 */
const s3Client = new S3Client({});

/**
 * 環境変数を取得
 */
function getEnvironmentVariables(): EnvironmentVariables {
  return {
    PROJECT_NAME: process.env.PROJECT_NAME || '',
    ENVIRONMENT: process.env.ENVIRONMENT || '',
    SCREENSHOT_BUCKET: process.env.SCREENSHOT_BUCKET || '',
    FSX_S3_ACCESS_POINT_ARN: process.env.FSX_S3_ACCESS_POINT_ARN || '',
    SCREENSHOT_FORMAT: (process.env.SCREENSHOT_FORMAT as 'png' | 'jpeg' | 'webp') || 'png',
    GENERATE_THUMBNAIL: process.env.GENERATE_THUMBNAIL || 'true',
    RATE_LIMIT: process.env.RATE_LIMIT || '10',
    RESPECT_ROBOTS_TXT: process.env.RESPECT_ROBOTS_TXT || 'true',
    USER_AGENT: process.env.USER_AGENT || 'BedrockAgentCore-Browser/1.0',
  };
}

/**
 * ストレージ設定を取得
 * FSx for ONTAP S3 Access Pointが設定されている場合はそちらを優先
 */
function getStorageConfig(env: EnvironmentVariables): {
  bucket: string;
  useFsxAccessPoint: boolean;
} {
  if (env.FSX_S3_ACCESS_POINT_ARN) {
    // FSx for ONTAP S3 Access Point ARNからバケット名を抽出
    // 形式: arn:aws:s3:region:account-id:accesspoint/access-point-name
    const match = env.FSX_S3_ACCESS_POINT_ARN.match(/accesspoint\/(.+)$/);
    const accessPointName = match ? match[1] : '';
    
    return {
      bucket: accessPointName,
      useFsxAccessPoint: true,
    };
  }

  return {
    bucket: env.SCREENSHOT_BUCKET,
    useFsxAccessPoint: false,
  };
}

/**
 * リクエストIDを生成
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Puppeteerブラウザを起動
 */
async function launchBrowser(userAgent: string): Promise<puppeteer.Browser> {
  return await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

/**
 * スクリーンショットを撮影
 */
async function takeScreenshot(
  request: BrowserRequest,
  env: EnvironmentVariables
): Promise<BrowserResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let pageLoadTime = 0;

  let browser: puppeteer.Browser | null = null;

  try {
    // ストレージ設定を取得
    const storageConfig = getStorageConfig(env);

    // ブラウザ起動
    browser = await launchBrowser(env.USER_AGENT);
    const page = await browser.newPage();

    // ビューポート設定
    if (request.options?.viewport) {
      await page.setViewport(request.options.viewport);
    }

    // ページ読み込み
    const pageLoadStart = Date.now();
    await page.goto(request.url, {
      waitUntil: 'networkidle2',
      timeout: request.options?.timeout || 30000,
    });
    pageLoadTime = Date.now() - pageLoadStart;

    // 待機（オプション）
    if (request.options?.waitFor) {
      await page.waitForSelector(request.options.waitFor, {
        timeout: request.options?.timeout || 30000,
      });
    }

    // スクリーンショット撮影
    const screenshot = await page.screenshot({
      type: env.SCREENSHOT_FORMAT,
      fullPage: true,
    });

    // S3にアップロード（FSx for ONTAP S3 Access Point経由または通常のS3）
    const key = `screenshots/${requestId}.${env.SCREENSHOT_FORMAT}`;
    
    if (storageConfig.useFsxAccessPoint) {
      // FSx for ONTAP S3 Access Point経由でアップロード
      // S3 APIは透過的にFSx for ONTAPにアクセス
      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.FSX_S3_ACCESS_POINT_ARN, // Access Point ARNを直接使用
          Key: key,
          Body: screenshot,
          ContentType: `image/${env.SCREENSHOT_FORMAT}`,
        })
      );
    } else {
      // 通常のS3バケットにアップロード
      await s3Client.send(
        new PutObjectCommand({
          Bucket: storageConfig.bucket,
          Key: key,
          Body: screenshot,
          ContentType: `image/${env.SCREENSHOT_FORMAT}`,
        })
      );
    }

    const screenshotUrl = storageConfig.useFsxAccessPoint
      ? `s3://${env.FSX_S3_ACCESS_POINT_ARN}/${key}`
      : `s3://${storageConfig.bucket}/${key}`;

    // ブラウザ終了
    await browser.close();

    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'SUCCESS',
      result: {
        screenshot: screenshotUrl,
      },
      metrics: {
        latency,
        pageLoadTime,
      },
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'SCREENSHOT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
        pageLoadTime,
      },
    };
  }
}

/**
 * Webスクレイピングを実行
 */
async function scrapeWebPage(
  request: BrowserRequest,
  env: EnvironmentVariables
): Promise<BrowserResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let pageLoadTime = 0;

  let browser: puppeteer.Browser | null = null;

  try {
    // ブラウザ起動
    browser = await launchBrowser(env.USER_AGENT);
    const page = await browser.newPage();

    // ページ読み込み
    const pageLoadStart = Date.now();
    await page.goto(request.url, {
      waitUntil: 'networkidle2',
      timeout: request.options?.timeout || 30000,
    });
    pageLoadTime = Date.now() - pageLoadStart;

    // HTML取得
    const html = await page.content();

    // Cheerioでパース
    const $ = cheerio.load(html);

    // データ抽出（基本的な例）
    const data = {
      title: $('title').text(),
      headings: $('h1, h2, h3')
        .map((_, el) => $(el).text())
        .get(),
      links: $('a')
        .map((_, el) => $(el).attr('href'))
        .get(),
      images: $('img')
        .map((_, el) => $(el).attr('src'))
        .get(),
    };

    // ブラウザ終了
    await browser.close();

    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'SUCCESS',
      result: {
        html,
        data,
      },
      metrics: {
        latency,
        pageLoadTime,
      },
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'SCRAPE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
        pageLoadTime,
      },
    };
  }
}

/**
 * ブラウザ自動化を実行
 */
async function automateWorkflow(
  request: BrowserRequest,
  env: EnvironmentVariables
): Promise<BrowserResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let pageLoadTime = 0;

  let browser: puppeteer.Browser | null = null;

  try {
    if (!request.automation?.steps || request.automation.steps.length === 0) {
      throw new Error('Automation steps are required');
    }

    // ブラウザ起動
    browser = await launchBrowser(env.USER_AGENT);
    const page = await browser.newPage();

    // ページ読み込み
    const pageLoadStart = Date.now();
    await page.goto(request.url, {
      waitUntil: 'networkidle2',
      timeout: request.options?.timeout || 30000,
    });
    pageLoadTime = Date.now() - pageLoadStart;

    // 自動化ステップを実行
    for (const step of request.automation.steps) {
      switch (step.type) {
        case 'CLICK':
          if (step.selector) {
            await page.click(step.selector);
          }
          break;
        case 'TYPE':
          if (step.selector && step.value) {
            await page.type(step.selector, step.value);
          }
          break;
        case 'WAIT':
          if (step.selector) {
            await page.waitForSelector(step.selector, {
              timeout: step.timeout || 30000,
            });
          } else if (step.timeout) {
            await new Promise(resolve => setTimeout(resolve, step.timeout));
          }
          break;
        case 'SCROLL':
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          break;
      }
    }

    // 最終的なHTML取得
    const html = await page.content();

    // ブラウザ終了
    await browser.close();

    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'SUCCESS',
      result: {
        html,
      },
      metrics: {
        latency,
        pageLoadTime,
      },
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'AUTOMATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
        pageLoadTime,
      },
    };
  }
}

/**
 * Lambda Handler
 */
export async function handler(event: BrowserRequest): Promise<BrowserResponse> {
  console.log('Browser request received:', JSON.stringify(event, null, 2));

  const env = getEnvironmentVariables();

  try {
    switch (event.action) {
      case 'SCREENSHOT':
        return await takeScreenshot(event, env);
      case 'SCRAPE':
        return await scrapeWebPage(event, env);
      case 'AUTOMATE':
        return await automateWorkflow(event, env);
      default:
        const exhaustiveCheck: never = event.action;
        throw new Error(`Unhandled action: ${exhaustiveCheck}`);
    }
  } catch (error) {
    console.error('Browser error:', error);

    return {
      requestId: generateRequestId(),
      status: 'FAILED',
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency: 0,
        pageLoadTime: 0,
      },
    };
  }
};
