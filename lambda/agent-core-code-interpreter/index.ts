/**
 * Amazon Bedrock AgentCore Code Interpreter Lambda Function
 * 
 * Pythonコードを安全なサンドボックス環境で実行する機能を提供します。
 * 
 * 主要機能:
 * - セッション管理（開始、停止）
 * - コード実行（Python）
 * - ファイル操作（書き込み、読み込み、削除、一覧）
 * - ターミナルコマンド実行
 * - FSx for ONTAP統合（オプション）
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import { BedrockAgentRuntimeClient, InvokeInlineAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

/**
 * 環境変数
 */
interface EnvironmentVariables {
  PROJECT_NAME: string;
  ENVIRONMENT: string;
  FSX_S3_ACCESS_POINT_ARN: string;
  EXECUTION_TIMEOUT: string;
  MEMORY_LIMIT: string;
  ALLOWED_PACKAGES: string;
  ALLOW_NETWORK_ACCESS: string;
  SESSION_TIMEOUT: string;
  MAX_CONCURRENT_SESSIONS: string;
}

/**
 * Code Interpreterリクエスト
 */
interface CodeInterpreterRequest {
  action: 'START_SESSION' | 'STOP_SESSION' | 'EXECUTE_CODE' | 'WRITE_FILE' | 'READ_FILE' | 'DELETE_FILE' | 'LIST_FILES' | 'EXECUTE_COMMAND' | 'INSTALL_PACKAGE' | 'LIST_PACKAGES';
  sessionId?: string;
  code?: string;
  language?: 'python' | 'nodejs';
  filePath?: string;
  fileContent?: string;
  command?: string;
  packageName?: string;
  packageVersion?: string;
  options?: {
    timeout?: number;
    captureOutput?: boolean;
  };
}

/**
 * Code Interpreterレスポンス
 */
interface CodeInterpreterResponse {
  requestId: string;
  sessionId?: string;
  status: 'SUCCESS' | 'FAILED';
  result?: {
    output?: string;
    error?: string;
    files?: string[];
    fileContent?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  metrics: {
    latency: number;
    executionTime?: number;
  };
}

/**
 * セッション情報
 */
interface SessionInfo {
  sessionId: string;
  createdAt: number;
  lastAccessedAt: number;
  workingDirectory: string;
  installedPackages: Map<string, string>; // パッケージ名 -> バージョン
}

/**
 * セッションストア（メモリ内）
 */
const sessions = new Map<string, SessionInfo>();

/**
 * S3クライアント
 */
const s3Client = new S3Client({});

/**
 * Bedrock Agent Runtimeクライアント
 */
const bedrockClient = new BedrockAgentRuntimeClient({});

/**
 * 環境変数を取得
 */
function getEnvironmentVariables(): EnvironmentVariables {
  return {
    PROJECT_NAME: process.env.PROJECT_NAME || '',
    ENVIRONMENT: process.env.ENVIRONMENT || '',
    FSX_S3_ACCESS_POINT_ARN: process.env.FSX_S3_ACCESS_POINT_ARN || '',
    EXECUTION_TIMEOUT: process.env.EXECUTION_TIMEOUT || '60',
    MEMORY_LIMIT: process.env.MEMORY_LIMIT || '512',
    ALLOWED_PACKAGES: process.env.ALLOWED_PACKAGES || '["numpy", "pandas", "matplotlib", "scipy"]',
    ALLOW_NETWORK_ACCESS: process.env.ALLOW_NETWORK_ACCESS || 'false',
    SESSION_TIMEOUT: process.env.SESSION_TIMEOUT || '3600',
    MAX_CONCURRENT_SESSIONS: process.env.MAX_CONCURRENT_SESSIONS || '10',
  };
}

/**
 * リクエストIDを生成
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * セッションIDを生成
 */
function generateSessionId(): string {
  return `session-${crypto.randomUUID()}`;
}

/**
 * セッションを開始
 */
async function startSession(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // 最大同時セッション数チェック
    const maxSessions = parseInt(env.MAX_CONCURRENT_SESSIONS, 10);
    if (sessions.size >= maxSessions) {
      throw new Error(`Maximum concurrent sessions (${maxSessions}) reached`);
    }

    // セッションID生成
    const sessionId = generateSessionId();

    // 作業ディレクトリ作成
    const workingDirectory = `/tmp/${sessionId}`;

    // セッション情報を保存
    const sessionInfo: SessionInfo = {
      sessionId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      workingDirectory,
      installedPackages: new Map(),
    };
    sessions.set(sessionId, sessionInfo);

    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId,
      status: 'SUCCESS',
      result: {
        output: `Session ${sessionId} started successfully`,
      },
      metrics: {
        latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'SESSION_START_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * セッションを停止
 */
async function stopSession(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // セッション削除
    sessions.delete(request.sessionId);

    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        output: `Session ${request.sessionId} stopped successfully`,
      },
      metrics: {
        latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'SESSION_STOP_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * コードを実行
 */
async function executeCode(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    if (!request.code) {
      throw new Error('Code is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // セッションタイムアウトチェック
    const sessionTimeout = parseInt(env.SESSION_TIMEOUT, 10) * 1000;
    if (Date.now() - sessionInfo.lastAccessedAt > sessionTimeout) {
      sessions.delete(request.sessionId);
      throw new Error(`Session ${request.sessionId} has expired`);
    }

    // 最終アクセス時刻更新
    sessionInfo.lastAccessedAt = Date.now();

    // 実行タイムアウト設定
    const executionTimeout = request.options?.timeout || parseInt(env.EXECUTION_TIMEOUT, 10);

    // コード実行（Bedrock Agent Runtime経由）
    const executionStart = Date.now();
    
    // Bedrock Agent Runtime APIを使用してコード実行
    // 注: Amazon Bedrock AgentCore Code Interpreterは、InvokeInlineAgentコマンドを使用
    const command = new InvokeInlineAgentCommand({
      sessionId: request.sessionId,
      inputText: request.code,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: 'Execute the provided code and return the output.',
      enableTrace: true,
      endSession: false,
    });

    let output = '';
    let error = '';

    try {
      // タイムアウト付きでコード実行
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), executionTimeout * 1000);
      });

      const executionPromise = bedrockClient.send(command);

      const response = await Promise.race([executionPromise, timeoutPromise]);

      // レスポンスから出力を抽出（AsyncIterableの処理）
      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            output += new TextDecoder().decode(chunk.chunk.bytes);
          }
        }
      }
    } catch (execError) {
      error = execError instanceof Error ? execError.message : 'Unknown execution error';
      
      // タイムアウトエラーの場合
      if (error.includes('timeout')) {
        throw new Error(`Code execution timeout after ${executionTimeout} seconds`);
      }
      
      throw execError;
    }
    
    const executionTime = Date.now() - executionStart;
    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        output: output || 'Code executed successfully (no output)',
        error: error || undefined,
      },
      metrics: {
        latency,
        executionTime,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'CODE_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * ファイルを書き込み
 */
async function writeFile(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    if (!request.filePath) {
      throw new Error('File path is required');
    }

    if (!request.fileContent) {
      throw new Error('File content is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // FSx for ONTAP S3 Access Point経由でファイル保存
    if (env.FSX_S3_ACCESS_POINT_ARN) {
      const key = `${request.sessionId}/${request.filePath}`;
      
      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.FSX_S3_ACCESS_POINT_ARN,
          Key: key,
          Body: request.fileContent,
        })
      );
    }

    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        output: `File ${request.filePath} written successfully`,
      },
      metrics: {
        latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'FILE_WRITE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * ファイルを読み込み
 */
async function readFile(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    if (!request.filePath) {
      throw new Error('File path is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // FSx for ONTAP S3 Access Point経由でファイル読み込み
    let fileContent = '';
    if (env.FSX_S3_ACCESS_POINT_ARN) {
      const key = `${request.sessionId}/${request.filePath}`;
      
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: env.FSX_S3_ACCESS_POINT_ARN,
          Key: key,
        })
      );

      fileContent = await response.Body?.transformToString() || '';
    }

    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        fileContent,
      },
      metrics: {
        latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'FILE_READ_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * ファイルを削除
 */
async function deleteFile(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    if (!request.filePath) {
      throw new Error('File path is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // FSx for ONTAP S3 Access Point経由でファイル削除
    if (env.FSX_S3_ACCESS_POINT_ARN) {
      const key = `${request.sessionId}/${request.filePath}`;
      
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: env.FSX_S3_ACCESS_POINT_ARN,
          Key: key,
        })
      );
    }

    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        output: `File ${request.filePath} deleted successfully`,
      },
      metrics: {
        latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'FILE_DELETE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * ファイル一覧を取得
 */
async function listFiles(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // FSx for ONTAP S3 Access Point経由でファイル一覧取得
    const files: string[] = [];
    if (env.FSX_S3_ACCESS_POINT_ARN) {
      const prefix = `${request.sessionId}/`;
      
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: env.FSX_S3_ACCESS_POINT_ARN,
          Prefix: prefix,
        })
      );

      if (response.Contents) {
        files.push(...response.Contents.map(obj => obj.Key?.replace(prefix, '') || ''));
      }
    }

    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        files,
      },
      metrics: {
        latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'FILE_LIST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * ターミナルコマンドを実行
 */
async function executeCommand(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    if (!request.command) {
      throw new Error('Command is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // ネットワークアクセスチェック
    const allowNetworkAccess = env.ALLOW_NETWORK_ACCESS === 'true';
    if (!allowNetworkAccess && (request.command.includes('curl') || request.command.includes('wget'))) {
      throw new Error('Network access is not allowed');
    }

    // 危険なコマンドのブロック
    const dangerousCommands = ['rm -rf', 'dd', 'mkfs', ':(){:|:&};:', 'fork bomb'];
    const commandText = request.command || '';
    if (dangerousCommands.some(cmd => commandText.includes(cmd))) {
      throw new Error('Dangerous command is not allowed');
    }

    // 実行タイムアウト設定
    const executionTimeout = request.options?.timeout || parseInt(env.EXECUTION_TIMEOUT, 10);

    // コマンド実行（Bedrock Agent Runtime経由）
    const executionStart = Date.now();
    
    // Pythonコードとしてラップしてsubprocessで実行
    const pythonCode = `
import subprocess
import sys

try:
    result = subprocess.run(
        ${JSON.stringify(commandText)},
        shell=True,
        capture_output=True,
        text=True,
        timeout=${executionTimeout}
    )
    print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr}", file=sys.stderr)
    sys.exit(result.returncode)
except subprocess.TimeoutExpired:
    print("Command execution timeout", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

    const command = new InvokeInlineAgentCommand({
      sessionId: request.sessionId,
      inputText: pythonCode,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: 'Execute the provided terminal command and return the output.',
      enableTrace: true,
      endSession: false,
    });

    let output = '';

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Command execution timeout')), (executionTimeout + 5) * 1000);
      });

      const executionPromise = bedrockClient.send(command);
      const response = await Promise.race([executionPromise, timeoutPromise]);

      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            output += new TextDecoder().decode(chunk.chunk.bytes);
          }
        }
      }
    } catch (execError) {
      const error = execError instanceof Error ? execError.message : 'Unknown execution error';
      throw new Error(`Command execution failed: ${error}`);
    }

    const executionTime = Date.now() - executionStart;
    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        output: output || 'Command executed successfully (no output)',
      },
      metrics: {
        latency,
        executionTime,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'COMMAND_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * パッケージをインストール
 */
async function installPackage(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    if (!request.packageName) {
      throw new Error('Package name is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // 許可されたパッケージのチェック
    const allowedPackages = JSON.parse(env.ALLOWED_PACKAGES) as string[];
    if (!allowedPackages.includes(request.packageName)) {
      throw new Error(`Package ${request.packageName} is not allowed. Allowed packages: ${allowedPackages.join(', ')}`);
    }

    // パッケージインストールコマンド生成
    const language = request.language || 'python';
    let installCommand = '';
    
    if (language === 'python') {
      const version = request.packageVersion ? `==${request.packageVersion}` : '';
      installCommand = `pip install ${request.packageName}${version}`;
    } else if (language === 'nodejs') {
      const version = request.packageVersion ? `@${request.packageVersion}` : '';
      installCommand = `npm install ${request.packageName}${version}`;
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }

    // インストール実行
    const executionStart = Date.now();
    
    const pythonCode = `
import subprocess
import sys

try:
    result = subprocess.run(
        ${JSON.stringify(installCommand)},
        shell=True,
        capture_output=True,
        text=True,
        timeout=120
    )
    print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr}", file=sys.stderr)
    
    if result.returncode != 0:
        sys.exit(result.returncode)
    
    # インストール成功
    print(f"Successfully installed ${request.packageName}")
    sys.exit(0)
except subprocess.TimeoutExpired:
    print("Package installation timeout", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

    const command = new InvokeInlineAgentCommand({
      sessionId: request.sessionId,
      inputText: pythonCode,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: 'Install the specified package and return the installation result.',
      enableTrace: true,
      endSession: false,
    });

    let output = '';

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Package installation timeout')), 125000);
      });

      const executionPromise = bedrockClient.send(command);
      const response = await Promise.race([executionPromise, timeoutPromise]);

      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            output += new TextDecoder().decode(chunk.chunk.bytes);
          }
        }
      }

      // インストール成功時、セッション情報に記録
      sessionInfo.installedPackages.set(
        request.packageName,
        request.packageVersion || 'latest'
      );
    } catch (execError) {
      const error = execError instanceof Error ? execError.message : 'Unknown execution error';
      throw new Error(`Package installation failed: ${error}`);
    }

    const executionTime = Date.now() - executionStart;
    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        output: output || `Package ${request.packageName} installed successfully`,
      },
      metrics: {
        latency,
        executionTime,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'PACKAGE_INSTALL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * インストール済みパッケージ一覧を取得
 */
async function listPackages(
  request: CodeInterpreterRequest,
  env: EnvironmentVariables
): Promise<CodeInterpreterResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (!request.sessionId) {
      throw new Error('Session ID is required');
    }

    // セッション存在確認
    const sessionInfo = sessions.get(request.sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    // インストール済みパッケージを取得
    const packages: string[] = [];
    sessionInfo.installedPackages.forEach((version, name) => {
      packages.push(`${name}==${version}`);
    });

    const latency = Date.now() - startTime;

    return {
      requestId,
      sessionId: request.sessionId,
      status: 'SUCCESS',
      result: {
        files: packages,
        output: packages.length > 0 
          ? `Installed packages:\n${packages.join('\n')}`
          : 'No packages installed',
      },
      metrics: {
        latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      requestId,
      status: 'FAILED',
      error: {
        code: 'PACKAGE_LIST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency,
      },
    };
  }
}

/**
 * Lambda Handler
 */
export async function handler(event: CodeInterpreterRequest): Promise<CodeInterpreterResponse> {
  console.log('Code Interpreter request received:', JSON.stringify(event, null, 2));

  const env = getEnvironmentVariables();

  try {
    switch (event.action) {
      case 'START_SESSION':
        return await startSession(event, env);
      case 'STOP_SESSION':
        return await stopSession(event, env);
      case 'EXECUTE_CODE':
        return await executeCode(event, env);
      case 'WRITE_FILE':
        return await writeFile(event, env);
      case 'READ_FILE':
        return await readFile(event, env);
      case 'DELETE_FILE':
        return await deleteFile(event, env);
      case 'LIST_FILES':
        return await listFiles(event, env);
      case 'EXECUTE_COMMAND':
        return await executeCommand(event, env);
      case 'INSTALL_PACKAGE':
        return await installPackage(event, env);
      case 'LIST_PACKAGES':
        return await listPackages(event, env);
      default:
        const exhaustiveCheck: never = event.action;
        throw new Error(`Unhandled action: ${exhaustiveCheck}`);
    }
  } catch (error) {
    console.error('Code Interpreter error:', error);

    return {
      requestId: generateRequestId(),
      status: 'FAILED',
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      metrics: {
        latency: 0,
      },
    };
  }
}
