/**
 * Encryption Utilities
 * 設定ファイルの暗号化・復号化機能
 */

import * as crypto from 'crypto';

export class EncryptionManager {
  private algorithm = 'aes-256-cbc';
  private keyLength = 32; // 256 bits
  private ivLength = 16;  // 128 bits

  /**
   * パスワードから暗号化キーを生成
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * データを暗号化
   */
  encrypt(data: string, password: string): string {
    try {
      // ランダムなソルトとIVを生成
      const salt = crypto.randomBytes(32);
      const iv = crypto.randomBytes(this.ivLength);
      
      // パスワードからキーを導出
      const key = this.deriveKey(password, salt);
      
      // 暗号化
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // ソルト + IV + 暗号化データを結合
      const result = Buffer.concat([
        salt,
        iv,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return result.toString('base64');
    } catch (error) {
      throw new Error(`暗号化に失敗しました: ${error.message}`);
    }
  }

  /**
   * データを復号化
   */
  decrypt(encryptedData: string, password: string): string {
    try {
      const data = Buffer.from(encryptedData, 'base64');
      
      // ソルト、IV、暗号化データを分離
      const salt = data.subarray(0, 32);
      const iv = data.subarray(32, 32 + this.ivLength);
      const encrypted = data.subarray(32 + this.ivLength);
      
      // パスワードからキーを導出
      const key = this.deriveKey(password, salt);
      
      // 復号化
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`復号化に失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイルを暗号化して保存
   */
  async encryptFile(filePath: string, data: string, password: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const encryptedData = this.encrypt(data, password);
    
    // ディレクトリを作成
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // 暗号化されたデータを保存
    await fs.writeFile(filePath, encryptedData, 'utf8');
  }

  /**
   * 暗号化されたファイルを読み込んで復号化
   */
  async decryptFile(filePath: string, password: string): Promise<string> {
    const fs = await import('fs/promises');
    
    try {
      const encryptedData = await fs.readFile(filePath, 'utf8');
      return this.decrypt(encryptedData, password);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`暗号化ファイルが見つかりません: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * パスワードの強度をチェック
   */
  validatePassword(password: string): { valid: boolean; message: string } {
    if (password.length < 8) {
      return { valid: false, message: 'パスワードは8文字以上である必要があります' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'パスワードには大文字を含める必要があります' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'パスワードには小文字を含める必要があります' };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'パスワードには数字を含める必要があります' };
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, message: 'パスワードには特殊文字を含める必要があります' };
    }

    return { valid: true, message: 'パスワードは有効です' };
  }

  /**
   * ランダムなパスワードを生成
   */
  generatePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }
}