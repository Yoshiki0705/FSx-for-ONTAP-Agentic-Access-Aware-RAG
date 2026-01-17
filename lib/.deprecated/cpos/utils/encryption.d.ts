/**
 * Encryption Utilities
 * 設定ファイルの暗号化・復号化機能
 */
export declare class EncryptionManager {
    private algorithm;
    private keyLength;
    private ivLength;
    /**
     * パスワードから暗号化キーを生成
     */
    private deriveKey;
    /**
     * データを暗号化
     */
    encrypt(data: string, password: string): string;
    /**
     * データを復号化
     */
    decrypt(encryptedData: string, password: string): string;
    /**
     * ファイルを暗号化して保存
     */
    encryptFile(filePath: string, data: string, password: string): Promise<void>;
    /**
     * 暗号化されたファイルを読み込んで復号化
     */
    decryptFile(filePath: string, password: string): Promise<string>;
    /**
     * パスワードの強度をチェック
     */
    validatePassword(password: string): {
        valid: boolean;
        message: string;
    };
    /**
     * ランダムなパスワードを生成
     */
    generatePassword(length?: number): string;
}
