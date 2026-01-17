import { useState, useEffect, useCallback } from 'react';

interface CSRFTokenState {
  token: string | null;
  loading: boolean;
  isLoading: boolean; // 追加: SignInForm で使用される
  error: string | null;
}

export function useCSRFToken() {
  const [state, setState] = useState<CSRFTokenState>({
    token: null,
    loading: true,
    isLoading: true, // 追加
    error: null
  });

  const refreshToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/csrf-token', {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`CSRF token fetch failed: ${response.status}`);
      }

      const data = await response.json();
      
      setState({
        token: data.token,
        loading: false,
        isLoading: false, // 追加
        error: null
      });
    } catch (error) {
      setState({
        token: null,
        loading: false,
        isLoading: false, // 追加
        error: error instanceof Error ? error.message : 'CSRF token fetch failed'
      });
    }
  }, []);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  const getHeaders = useCallback((additionalHeaders: Record<string, string> = {}) => {
    return {
      'X-CSRF-Token': state.token || '',
      'Content-Type': 'application/json',
      ...additionalHeaders
    };
  }, [state.token]);

  const csrfFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = getHeaders(options.headers as Record<string, string>);
    
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
  }, [getHeaders]);

  const getFormToken = useCallback(() => {
    return state.token;
  }, [state.token]);

  return {
    token: state.token,
    loading: state.loading,
    isLoading: state.isLoading, // 追加
    error: state.error,
    refreshToken,
    getHeaders,
    csrfFetch,
    getFormToken
  };
}
