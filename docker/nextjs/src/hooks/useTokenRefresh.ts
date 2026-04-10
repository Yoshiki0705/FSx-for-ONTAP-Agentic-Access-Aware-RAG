/**
 * useTokenRefresh フック
 *
 * トークン有効期限の5分前にバックグラウンドリフレッシュを実行し、
 * リフレッシュ失敗時はサインイン画面にリダイレクトする。
 *
 * トークン情報はCookieベースで管理:
 * - refresh-token: httpOnly Cookie（サーバーサイドのみ読み取り可能）
 * - token-expiry: クライアント読み取り可能Cookie（有効期限チェック用）
 *
 * Requirements: 14.2, 14.3, 14.5
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/** リフレッシュ実行の閾値（有効期限の5分前） */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/** チェック間隔（60秒） */
const CHECK_INTERVAL_MS = 60 * 1000;

/** Cookieから値を取得するヘルパー */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface UseTokenRefreshResult {
  isRefreshing: boolean;
}

export function useTokenRefresh(): UseTokenRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const refreshInProgressRef = useRef(false);

  const performRefresh = useCallback(async () => {
    if (refreshInProgressRef.current) return;
    refreshInProgressRef.current = true;
    setIsRefreshing(true);

    try {
      // refresh-tokenはhttpOnly Cookieなので、サーバーサイドで自動的に送信される
      // リクエストボディは空でOK（サーバーがCookieから取得）
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("[useTokenRefresh] リフレッシュトークン期限切れ → サインイン画面へリダイレクト");
          router.push("/signin");
          return;
        }
        console.error("[useTokenRefresh] リフレッシュ失敗:", response.status);
        return;
      }

      const data = await response.json();

      // token-expiry Cookieを更新
      if (data.expiresIn) {
        const newExpiry = Date.now() + data.expiresIn * 1000;
        document.cookie = `token-expiry=${newExpiry}; path=/; max-age=${data.expiresIn}; SameSite=Lax`;
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
      const expiryStr = getCookie("token-expiry");
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
