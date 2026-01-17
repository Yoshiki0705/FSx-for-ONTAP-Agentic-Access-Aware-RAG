'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useEffect } from 'react';

/**
 * Bedrock Agent トレース情報の型定義
 * AWS Bedrock Agent API仕様に基づく
 */
export interface AgentTrace {
  timestamp: number;
  query: string;
  trace: {
    orchestrationTrace?: {
      modelInvocationInput?: {
        text?: string;
        type?: string;
      };
      modelInvocationOutput?: {
        parsedResponse?: {
          rationale?: string;
          isValid?: boolean;
        };
      };
      observation?: {
        type?: string;
        knowledgeBaseLookupOutput?: {
          retrievedReferences?: Array<{
            content?: { text?: string };
            location?: { type?: string; s3Location?: { uri?: string } };
          }>;
        };
        actionGroupInvocationOutput?: {
          text?: string;
        };
      };
    };
    failureTrace?: {
      failureReason?: string;
      traceId?: string;
    };
    guardrailTrace?: {
      action?: string;
      inputAssessments?: any[];
      outputAssessments?: any[];
    };
  };
}

/**
 * Agentモードの状態管理フック
 * URLパラメータでモードを管理
 */
export function useAgentMode() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [clientMode, setClientMode] = useState<boolean | null>(null);
  
  // クライアントサイドでのURLパラメータ初期化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const isAgentMode = mode === 'agent';
      
      console.log('🔄 [useAgentMode] クライアントサイド初期化:', {
        url: window.location.href,
        mode,
        isAgentMode
      });
      
      setClientMode(isAgentMode);
      
      // localStorageにも保存
      localStorage.setItem('agentMode', isAgentMode ? 'agent' : 'kb');
    }
  }, []);
  
  // URL パラメータから現在のモードを取得（デフォルトはKBモード）
  const agentMode = useMemo(() => {
    // クライアントサイドの初期化が完了していない場合はlocalStorageから取得
    if (clientMode === null && typeof window !== 'undefined') {
      const stored = localStorage.getItem('agentMode');
      return stored === 'agent';
    }
    
    // クライアントサイドの値を優先
    if (clientMode !== null) {
      return clientMode;
    }
    
    // フォールバック: searchParamsから取得
    const mode = searchParams.get('mode');
    return mode === 'agent';
  }, [searchParams, clientMode]);

  const setAgentMode = useCallback((mode: boolean) => {
    console.log('🔄 [useAgentMode] モード切り替え:', mode ? 'Agent' : 'KB');
    
    // クライアントサイドの状態を更新
    setClientMode(mode);
    
    // 現在のURLを取得
    const currentPath = window.location.pathname;
    const currentSearch = new URLSearchParams(window.location.search);
    
    // modeパラメータを更新
    if (mode) {
      currentSearch.set('mode', 'agent');
    } else {
      currentSearch.delete('mode'); // KBモードの場合はパラメータを削除
    }
    
    // 新しいURLに遷移（replace を使用してブラウザ履歴を置き換え）
    const newUrl = `${currentPath}${currentSearch.toString() ? '?' + currentSearch.toString() : ''}`;
    console.log('✅ [useAgentMode] URL更新:', newUrl);
    
    // router.replace を使用してページをリロードせずにURLを更新
    router.replace(newUrl, { scroll: false });
    
    // localStorageにもモードを保存（フォールバック用）
    if (typeof window !== 'undefined') {
      localStorage.setItem('agentMode', mode ? 'agent' : 'kb');
      console.log('💾 [useAgentMode] localStorageに保存:', mode ? 'agent' : 'kb');
    }
  }, [router]);

  // モード切り替えの非同期関数
  const toggleAgentMode = useCallback(async () => {
    console.log('🔄 [useAgentMode] toggleAgentMode開始');
    setIsTransitioning(true);
    
    // モード切り替えの遅延をシミュレート（UIフィードバックのため）
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // モードを切り替え
    setAgentMode(!agentMode);
    
    // 切り替え完了後の遅延
    await new Promise(resolve => setTimeout(resolve, 200));
    setIsTransitioning(false);
    console.log('✅ [useAgentMode] toggleAgentMode完了');
  }, [agentMode, setAgentMode]);

  return { agentMode, setAgentMode, toggleAgentMode, isTransitioning };
}

/**
 * Agentトレース情報の状態管理フック
 * トレース情報をlocalStorageに永続化
 */
export function useAgentTraces() {
  const [agentTraces, setAgentTraces] = useState<AgentTrace[]>([]);

  // localStorageからトレース情報を読み込み
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agentTraces');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // timestampはnumber型として扱う
          setAgentTraces(parsed);
          console.log('📊 [useAgentTraces] トレース情報を読み込み:', parsed.length);
        } catch (error) {
          console.error('❌ [useAgentTraces] トレース情報の読み込みエラー:', error);
        }
      }
    }
  }, []);

  // トレース情報をlocalStorageに保存
  const saveTraces = useCallback((traces: AgentTrace[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('agentTraces', JSON.stringify(traces));
        console.log('💾 [useAgentTraces] トレース情報を保存:', traces.length);
      } catch (error) {
        console.error('❌ [useAgentTraces] トレース情報の保存エラー:', error);
      }
    }
  }, []);

  const setAgentTracesWithSave = useCallback((traces: AgentTrace[] | ((prev: AgentTrace[]) => AgentTrace[])) => {
    setAgentTraces(prev => {
      const newTraces = typeof traces === 'function' ? traces(prev) : traces;
      saveTraces(newTraces);
      return newTraces;
    });
  }, [saveTraces]);

  return { agentTraces, setAgentTraces: setAgentTracesWithSave };
}

/**
 * セッション属性の状態管理フック
 * AWS Bedrock Agent SessionState.sessionAttributes に対応
 */
export function useSessionAttributes() {
  const [sessionAttributes, setSessionAttributes] = useState<Record<string, string>>({});

  // localStorageからセッション属性を読み込み
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sessionAttributes');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSessionAttributes(parsed);
          console.log('💾 [useSessionAttributes] セッション属性を読み込み:', Object.keys(parsed).length);
        } catch (error) {
          console.error('❌ [useSessionAttributes] セッション属性の読み込みエラー:', error);
        }
      }
    }
  }, []);

  // セッション属性をlocalStorageに保存
  const saveAttributes = useCallback((attributes: Record<string, string>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sessionAttributes', JSON.stringify(attributes));
        console.log('💾 [useSessionAttributes] セッション属性を保存:', Object.keys(attributes).length);
      } catch (error) {
        console.error('❌ [useSessionAttributes] セッション属性の保存エラー:', error);
      }
    }
  }, []);

  const setSessionAttributesWithSave = useCallback((attributes: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    setSessionAttributes(prev => {
      const newAttributes = typeof attributes === 'function' ? attributes(prev) : attributes;
      saveAttributes(newAttributes);
      return newAttributes;
    });
  }, [saveAttributes]);

  return { sessionAttributes, setSessionAttributes: setSessionAttributesWithSave };
}

/**
 * Agent UI表示状態の管理フック
 * トレース表示とセッション属性パネルの表示/非表示を管理
 */
export function useAgentUI() {
  const [showAgentTrace, setShowAgentTrace] = useState(false);
  const [showSessionAttributes, setShowSessionAttributes] = useState(false);

  // localStorageからUI状態を読み込み
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTrace = localStorage.getItem('showAgentTrace');
      const storedAttributes = localStorage.getItem('showSessionAttributes');
      
      if (storedTrace) {
        setShowAgentTrace(storedTrace === 'true');
      }
      if (storedAttributes) {
        setShowSessionAttributes(storedAttributes === 'true');
      }
    }
  }, []);

  // UI状態をlocalStorageに保存
  const setShowAgentTraceWithSave = useCallback((show: boolean) => {
    setShowAgentTrace(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('showAgentTrace', String(show));
    }
  }, []);

  const setShowSessionAttributesWithSave = useCallback((show: boolean) => {
    setShowSessionAttributes(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('showSessionAttributes', String(show));
    }
  }, []);

  return { 
    showAgentTrace, 
    setShowAgentTrace: setShowAgentTraceWithSave, 
    showSessionAttributes, 
    setShowSessionAttributes: setShowSessionAttributesWithSave 
  };
}
