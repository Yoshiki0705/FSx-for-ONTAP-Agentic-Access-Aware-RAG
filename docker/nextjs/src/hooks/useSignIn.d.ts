/**
 * サインイン機能のカスタムフック
 * 認証ロジックとステート管理を分離
 */
interface SignInState {
    isLoading: boolean;
    error: string;
}
interface SignInActions {
    signIn: (username: string, password: string) => Promise<void>;
    clearError: () => void;
}
export declare function useSignIn(): SignInState & SignInActions;
export {};
