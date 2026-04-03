"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/**
 * Build the SAML redirect URL for AD sign-in via Cognito Hosted UI.
 */
function buildAdSignInUrl(
  cognitoDomain: string,
  cognitoRegion: string,
  cognitoClientId: string,
  callbackUrl: string,
  idpName: string,
): string {
  return (
    `https://${cognitoDomain}.auth.${cognitoRegion}.amazoncognito.com/oauth2/authorize` +
    `?identity_provider=${encodeURIComponent(idpName)}` +
    `&response_type=code` +
    `&client_id=${encodeURIComponent(cognitoClientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=openid+email+profile`
  );
}

/**
 * Build the OIDC redirect URL for OIDC IdP sign-in via Cognito Hosted UI.
 */
function buildOidcSignInUrl(
  cognitoDomain: string,
  cognitoRegion: string,
  cognitoClientId: string,
  callbackUrl: string,
  oidcProviderName: string,
): string {
  return (
    `https://${cognitoDomain}.auth.${cognitoRegion}.amazoncognito.com/oauth2/authorize` +
    `?identity_provider=${encodeURIComponent(oidcProviderName)}` +
    `&response_type=code` +
    `&client_id=${encodeURIComponent(cognitoClientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=openid+email+profile`
  );
}

// Exported for testing
export { buildAdSignInUrl, buildOidcSignInUrl };

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const refUser = useRef<HTMLInputElement>(null);
  const refPassword = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  // AD Federation environment variables
  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "";
  const cognitoRegion = process.env.NEXT_PUBLIC_COGNITO_REGION || "";
  const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
  const callbackUrl = process.env.NEXT_PUBLIC_CALLBACK_URL || "";
  const idpName = process.env.NEXT_PUBLIC_IDP_NAME || "ActiveDirectory";

  const adFederationEnabled = !!(cognitoDomain && cognitoRegion && cognitoClientId && callbackUrl);

  const handleAdSignIn = () => {
    if (!adFederationEnabled) return;
    const url = buildAdSignInUrl(cognitoDomain, cognitoRegion, cognitoClientId, callbackUrl, idpName);
    window.location.href = url;
  };

  // OIDC Federation environment variables
  const oidcProviderName = process.env.NEXT_PUBLIC_OIDC_PROVIDER_NAME || "";
  const oidcEnabled = !!(oidcProviderName && cognitoDomain && cognitoRegion && cognitoClientId && callbackUrl);

  const handleOidcSignIn = () => {
    if (!oidcEnabled) return;
    const url = buildOidcSignInUrl(cognitoDomain, cognitoRegion, cognitoClientId, callbackUrl, oidcProviderName);
    window.location.href = url;
  };

  const onSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    
    const username = refUser.current!.value;
    const password = refPassword.current!.value;
    
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // 認証成功
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('username', username);
        router.push('/chatbot');
      } else {
        setError(data.message || 'サインインに失敗しました');
      }
    } catch (error) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      className={`flex flex-col gap-6 ${className || ''}`}
      {...props}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">
          RAG Application with NetApp ONTAP
        </h1>
      </div>
      <div className="grid gap-6">
        {adFederationEnabled && (
          <>
            <button
              type="button"
              onClick={handleAdSignIn}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 w-full"
            >
              <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Sign in with AD
            </button>
          </>
        )}
        {oidcEnabled && (
          <button
            type="button"
            onClick={handleOidcSignIn}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2 w-full"
          >
            <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            Sign in with {oidcProviderName}
          </button>
        )}
        {(adFederationEnabled || oidcEnabled) && (
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">
              or
            </span>
          </div>
        )}
        <div className="grid gap-2">
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <input
            id="username"
            type="text"
            placeholder="user01"
            required
            ref={refUser}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
          </div>
          <input 
            id="password" 
            type="password" 
            required 
            ref={refPassword}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}
        <button 
          type="submit" 
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full" 
          disabled={isLoading}
        >
          {isLoading && (
            <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          Sign in
        </button>
        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-background px-2 text-muted-foreground">
            Or forgot password with
          </span>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => router.push("/reset")}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          Reset your password
        </button>
      </div>
    </form>
  );
}
