/**
 * サインインフォームコンポーネント
 * 認証フォームとテストアカウント情報を担当
 */
interface SignInFormProps {
    onSubmit: (username: string, password: string) => Promise<void>;
    isLoading: boolean;
    error: string;
}
export default function SignInForm({ onSubmit, isLoading, error }: SignInFormProps): import("react").JSX.Element;
export {};
