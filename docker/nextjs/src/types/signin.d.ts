/**
 * サインインページ関連の型定義
 */
export type ImageLoadState = 'loading' | 'loaded' | 'error';
export interface BrandImageConfig {
    src: string;
    alt: string;
    fallbackMessage?: string;
}
export interface BrandImageSectionProps {
    imageConfig?: BrandImageConfig;
    onImageError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
    onImageLoad?: () => void;
}
export interface SignInFormData {
    username: string;
    password: string;
}
export interface SignInFormSectionProps extends SignInFormData {
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error: string;
}
export interface FormFieldProps {
    id: string;
    label: string;
    type: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    'aria-describedby'?: string;
}
