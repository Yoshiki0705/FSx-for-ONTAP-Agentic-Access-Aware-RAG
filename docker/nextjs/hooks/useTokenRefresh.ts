/**
 * useTokenRefresh フック
 *
 * トークン有効期限の5分前にバックグラウンドリフレッシュを実行し、
 * リフレッシュ失敗時はサインイン画面にリダイレクトする。
 *
 * Requirements: 14.2, 14.3, 14.5
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/** localStorage に保存するトークン情報のキー */
const TOKEN_EXPIRY_KEY = "token_expiry";
const REFRESH_TOKEN_KEY = "refresh_token";
const ACCESS_TOKEN_KEY = "access_token";
const ID_TOKEN_KEY = "id_token";

/** リフレッシュ実行の閾値（有効期限の5分前） */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/** チェック間隔（60秒） */
const CHECK_INTERVAL_MS = 60 * 1000;

export interface UseTokenRefreshResult {
  isRefreshing: boolean;
}

export function useTokenRefresh(): UseTokenRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const refreshInProgressRef = useRef(false);

  const performRefresh = useCallback(async () => {
    // 二重実行防止
    if (refreshInProgressRef.current) return;

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;

    refreshInProgressRef.current = true;
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // 401 = リフレッシュトークン期限切れ → サインイン画面へ
        if (response.status === 401) {
          console.warn("[useTokenRefresh] リフレッシュトークン期限切れ → サインイン画面へリダイレクト");
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(ID_TOKEN_KEY);
          router.push("/signin");
          return;
        }
        console.error("[useTokenRefresh] リフレッシュ失敗:", response.status);
        return;
      }

      const data = await response.json();

      // localStorage を新しいトークンで更新
      if (data.accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      }
      if (data.idToken) {
        localStorage.setItem(ID_TOKEN_KEY, data.idToken);
      }
      if (data.expiresIn) {
        const newExpiry = Date.now() + data.expiresIn * 1000;
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(newExpiry));
      }

      console.log("[useTokenRefresh] トークンリフレッシュ成功");
    } catch (error) {
      console.error("[useTokenRefresh] リフレッシュエラー:", error);
    } finally {
      refreshInProgressRef.current = false;
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    const checkAndRefresh = () => {
      const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!expiryStr) return;

      const expiry = Number(expiryStr);
      if (isNaN(expiry)) return;

      const timeUntilExpiry = expiry - Date.now();

      // 有効期限の5分前以内ならリフレッシュ実行
      if (timeUntilExpiry > 0 && timeUntilExpiry <= REFRESH_THRESHOLD_MS) {
        performRefresh();
      }

      // 既に期限切れの場合もリフレッシュを試行
      if (timeUntilExpiry <= 0) {
        performRefresh();
      }
    };

    // 初回チェック
    checkAndRefresh();

    // 60秒間隔で定期チェック
    const intervalId = setInterval(checkAndRefresh, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [performRefresh]);

  return { isRefreshing };
}
