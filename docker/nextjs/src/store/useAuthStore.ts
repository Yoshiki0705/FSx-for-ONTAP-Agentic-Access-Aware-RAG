import { create } from 'zustand';

export interface User {
  username: string;
  role: string;
  permissions: string[];
}

export interface Session {
  user: User;
  loginTime: string;
  expiresAt: string;
  lastActivity?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  session: Session | null;
  isLoading: boolean;
  signIn: (username: string, password: string, csrfToken: string) => Promise<boolean>;
  signOut: (csrfToken: string) => Promise<void>;
  checkSession: () => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  session: null,
  isLoading: false,

  signIn: async (username: string, password: string, csrfToken: string) => {
    set({ isLoading: true });
    
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Sign in failed:', error);
        set({ isLoading: false });
        return false;
      }

      const data = await response.json();
      
      set({
        isAuthenticated: true,
        session: data.session,
        isLoading: false
      });

      console.log('Sign in successful:', data.session.user.username);
      return true;

    } catch (error) {
      console.error('Sign in error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  signOut: async (csrfToken: string) => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }

    set({
      isAuthenticated: false,
      session: null,
      isLoading: false
    });

    console.log('Sign out successful');
  },

  checkSession: async () => {
    try {
      const response = await fetch('/api/auth/session');
      
      if (!response.ok) {
        set({
          isAuthenticated: false,
          session: null
        });
        return false;
      }

      const data = await response.json();
      
      // ✅ APIレスポンスをSession型に変換
      const session: Session = {
        user: {
          username: data.session.username,
          role: 'user', // デフォルト値
          permissions: [] // デフォルト値
        },
        loginTime: data.session.createdAt,
        expiresAt: data.session.expiresAt,
        lastActivity: data.session.lastAccessedAt
      };
      
      set({
        isAuthenticated: true,
        session
      });

      return true;
    } catch (error) {
      console.error('Session check error:', error);
      set({
        isAuthenticated: false,
        session: null
      });
      return false;
    }
  },

  hasPermission: (permission: string) => {
    const { session } = get();
    return session?.user.permissions.includes(permission) || false;
  }
}));
