import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * i18nデバッグAPI
 * Lambda環境での翻訳ファイルとi18n設定の状況を確認
 */
export async function GET(request: NextRequest) {
  try {
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      workingDirectory: process.cwd(),
      lambdaWebAdapter: {
        port: process.env.AWS_LWA_PORT,
        invokeMode: process.env.AWS_LWA_INVOKE_MODE,
        readinessCheckPath: process.env.AWS_LWA_READINESS_CHECK_PATH,
      }
    };

    // ファイルシステム構造を確認
    try {
      const rootFiles = await fs.readdir(process.cwd());
      debugInfo.rootFiles = rootFiles;
    } catch (error) {
      debugInfo.rootFilesError = error.message;
    }

    // messagesディレクトリの確認
    try {
      const messagesPath = path.join(process.cwd(), 'messages');
      const messageFiles = await fs.readdir(messagesPath);
      debugInfo.messageFiles = messageFiles;
      
      // ja.jsonファイルの内容を一部確認
      const jaPath = path.join(messagesPath, 'ja.json');
      const jaContent = await fs.readFile(jaPath, 'utf-8');
      const jaJson = JSON.parse(jaContent);
      debugInfo.jaMessageKeys = Object.keys(jaJson);
      debugInfo.chatAgentKeys = jaJson.chat?.agent ? Object.keys(jaJson.chat.agent) : 'chat.agent not found';
    } catch (error) {
      debugInfo.messagesError = error.message;
    }

    // srcディレクトリの確認
    try {
      const srcPath = path.join(process.cwd(), 'src');
      const srcExists = await fs.access(srcPath).then(() => true).catch(() => false);
      debugInfo.srcExists = srcExists;
      
      if (srcExists) {
        const srcFiles = await fs.readdir(srcPath);
        debugInfo.srcFiles = srcFiles;
        
        // src/messagesディレクトリの確認
        const srcMessagesPath = path.join(srcPath, 'messages');
        const srcMessagesExists = await fs.access(srcMessagesPath).then(() => true).catch(() => false);
        debugInfo.srcMessagesExists = srcMessagesExists;
        
        if (srcMessagesExists) {
          const srcMessageFiles = await fs.readdir(srcMessagesPath);
          debugInfo.srcMessageFiles = srcMessageFiles;
        }
      }
    } catch (error) {
      debugInfo.srcError = error.message;
    }

    // i18n設定ファイルの確認
    try {
      const i18nPath = path.join(process.cwd(), 'i18n.ts');
      const i18nExists = await fs.access(i18nPath).then(() => true).catch(() => false);
      debugInfo.i18nExists = i18nExists;
    } catch (error) {
      debugInfo.i18nError = error.message;
    }

    // 翻訳ファイルの動的インポートテスト
    try {
      // 現在のi18n/request.tsで使用されているパス
      const messages1 = await import(`../../messages/ja.json`);
      debugInfo.importTest1 = {
        success: true,
        keysCount: Object.keys(messages1.default).length,
        hasChatAgent: !!messages1.default.chat?.agent
      };
    } catch (error) {
      debugInfo.importTest1 = {
        success: false,
        error: error.message
      };
    }

    // 別のパスでのインポートテスト
    try {
      const messages2 = await import(`../../../../../messages/ja.json`);
      debugInfo.importTest2 = {
        success: true,
        keysCount: Object.keys(messages2.default).length,
        hasChatAgent: !!messages2.default.chat?.agent
      };
    } catch (error) {
      debugInfo.importTest2 = {
        success: false,
        error: error.message
      };
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Debug API failed', 
        message: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}