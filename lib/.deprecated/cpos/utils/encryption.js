"use strict";
/**
 * Encryption Utilities
 * 設定ファイルの暗号化・復号化機能
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionManager = void 0;
const crypto = __importStar(require("crypto"));
class EncryptionManager {
    algorithm = 'aes-256-cbc';
    keyLength = 32; // 256 bits
    ivLength = 16; // 128 bits
    /**
     * パスワードから暗号化キーを生成
     */
    deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
    }
    /**
     * データを暗号化
     */
    encrypt(data, password) {
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
        }
        catch (error) {
            throw new Error(`暗号化に失敗しました: ${error.message}`);
        }
    }
    /**
     * データを復号化
     */
    decrypt(encryptedData, password) {
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
        }
        catch (error) {
            throw new Error(`復号化に失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルを暗号化して保存
     */
    async encryptFile(filePath, data, password) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
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
    async decryptFile(filePath, password) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        try {
            const encryptedData = await fs.readFile(filePath, 'utf8');
            return this.decrypt(encryptedData, password);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`暗号化ファイルが見つかりません: ${filePath}`);
            }
            throw error;
        }
    }
    /**
     * パスワードの強度をチェック
     */
    validatePassword(password) {
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
    generatePassword(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charset.length);
            password += charset[randomIndex];
        }
        return password;
    }
}
exports.EncryptionManager = EncryptionManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5jcnlwdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVuY3J5cHRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwrQ0FBaUM7QUFFakMsTUFBYSxpQkFBaUI7SUFDcEIsU0FBUyxHQUFHLGFBQWEsQ0FBQztJQUMxQixTQUFTLEdBQUcsRUFBRSxDQUFDLENBQUMsV0FBVztJQUMzQixRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUUsV0FBVztJQUVuQzs7T0FFRztJQUNLLFNBQVMsQ0FBQyxRQUFnQixFQUFFLElBQVk7UUFDOUMsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTyxDQUFDLElBQVksRUFBRSxRQUFnQjtRQUNwQyxJQUFJLENBQUM7WUFDSCxpQkFBaUI7WUFDakIsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNwQyxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUU3QyxlQUFlO1lBQ2YsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFM0MsTUFBTTtZQUNOLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFOUQsSUFBSSxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ25ELFNBQVMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUss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WSxFQUFFLENBQUM7SUFDaEQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsZ0JBQWdCLENBQUMsU0FBaUIsRUFBRTtRQUNsQyxNQUFNLE9BQU8sR0FBRywwRkFBMEYsQ0FBQztRQUMzRyxJQUFJLFFBQVEsR0FBRyxFQUFFLENBQUM7UUFFbEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN4RCxRQUFRLElBQUksT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0NBQ0Y7QUFqSkQsOENBaUpDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFbmNyeXB0aW9uIFV0aWxpdGllc1xuICog6Kit5a6a44OV44Kh44Kk44Or44Gu5pqX5Y+35YyW44O75b6p5Y+35YyW5qmf6IO9XG4gKi9cblxuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5cbmV4cG9ydCBjbGFzcyBFbmNyeXB0aW9uTWFuYWdlciB7XG4gIHByaXZhdGUgYWxnb3JpdGhtID0gJ2Flcy0yNTYtY2JjJztcbiAgcHJpdmF0ZSBrZXlMZW5ndGggPSAzMjsgLy8gMjU2IGJpdHNcbiAgcHJpdmF0ZSBpdkxlbmd0aCA9IDE2OyAgLy8gMTI4IGJpdHNcblxuICAvKipcbiAgICog44OR44K544Ov44O844OJ44GL44KJ5pqX5Y+35YyW44Kt44O844KS55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGRlcml2ZUtleShwYXNzd29yZDogc3RyaW5nLCBzYWx0OiBCdWZmZXIpOiBCdWZmZXIge1xuICAgIHJldHVybiBjcnlwdG8ucGJrZGYyU3luYyhwYXNzd29yZCwgc2FsdCwgMTAwMDAwLCB0aGlzLmtleUxlbmd0aCwgJ3NoYTI1NicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODvOOCv+OCkuaal+WPt+WMllxuICAgKi9cbiAgZW5jcnlwdChkYXRhOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICAvLyDjg6njg7Pjg4Djg6Djgarjgr3jg6vjg4jjgahJVuOCkueUn+aIkFxuICAgICAgY29uc3Qgc2FsdCA9IGNyeXB0by5yYW5kb21CeXRlcygzMik7XG4gICAgICBjb25zdCBpdiA9IGNyeXB0by5yYW5kb21CeXRlcyh0aGlzLml2TGVuZ3RoKTtcbiAgICAgIFxuICAgICAgLy8g44OR44K544Ov44O844OJ44GL44KJ44Kt44O844KS5bCO5Ye6XG4gICAgICBjb25zdCBrZXkgPSB0aGlzLmRlcml2ZUtleShwYXNzd29yZCwgc2FsdCk7XG4gICAgICBcbiAgICAgIC8vIOaal+WPt+WMllxuICAgICAgY29uc3QgY2lwaGVyID0gY3J5cHRvLmNyZWF0ZUNpcGhlcml2KHRoaXMuYWxnb3JpdGhtLCBrZXksIGl2KTtcbiAgICAgIFxuICAgICAgbGV0IGVuY3J5cHRlZCA9IGNpcGhlci51cGRhdGUoZGF0YSwgJ3V0ZjgnLCAnaGV4Jyk7XG4gICAgICBlbmNyeXB0ZWQgKz0gY2lwaGVyLmZpbmFsKCdoZXgnKTtcbiAgICAgIFxuICAgICAgLy8g44K944Or44OIICsgSVYgKyDmmpflj7fljJbjg4fjg7zjgr/jgpLntZDlkIhcbiAgICAgIGNvbnN0IHJlc3VsdCA9IEJ1ZmZlci5jb25jYXQoW1xuICAgICAgICBzYWx0LFxuICAgICAgICBpdixcbiAgICAgICAgQnVmZmVyLmZyb20oZW5jcnlwdGVkLCAnaGV4JylcbiAgICAgIF0pO1xuICAgICAgXG4gICAgICByZXR1cm4gcmVzdWx0LnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDmmpflj7fljJbjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OH44O844K/44KS5b6p5Y+35YyWXG4gICAqL1xuICBkZWNyeXB0KGVuY3J5cHRlZERhdGE6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBCdWZmZXIuZnJvbShlbmNyeXB0ZWREYXRhLCAnYmFzZTY0Jyk7XG4gICAgICBcbiAgICAgIC8vIOOCveODq+ODiOOAgUlW44CB5pqX5Y+35YyW44OH44O844K/44KS5YiG6ZuiXG4gICAgICBjb25zdCBzYWx0ID0gZGF0YS5zdWJhcnJheSgwLCAzMik7XG4gICAgICBjb25zdCBpdiA9IGRhdGEuc3ViYXJyYXkoMzIsIDMyICsgdGhpcy5pdkxlbmd0aCk7XG4gICAgICBjb25zdCBlbmNyeXB0ZWQgPSBkYXRhLnN1YmFycmF5KDMyICsgdGhpcy5pdkxlbmd0aCk7XG4gICAgICBcbiAgICAgIC8vIOODkeOCueODr+ODvOODieOBi+OCieOCreODvOOCkuWwjuWHulxuICAgICAgY29uc3Qga2V5ID0gdGhpcy5kZXJpdmVLZXkocGFzc3dvcmQsIHNhbHQpO1xuICAgICAgXG4gICAgICAvLyDlvqnlj7fljJZcbiAgICAgIGNvbnN0IGRlY2lwaGVyID0gY3J5cHRvLmNyZWF0ZURlY2lwaGVyaXYodGhpcy5hbGdvcml0aG0sIGtleSwgaXYpO1xuICAgICAgXG4gICAgICBsZXQgZGVjcnlwdGVkID0gZGVjaXBoZXIudXBkYXRlKGVuY3J5cHRlZCwgdW5kZWZpbmVkLCAndXRmOCcpO1xuICAgICAgZGVjcnlwdGVkICs9IGRlY2lwaGVyLmZpbmFsKCd1dGY4Jyk7XG4gICAgICBcbiAgICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg5b6p5Y+35YyW44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OCkuaal+WPt+WMluOBl+OBpuS/neWtmFxuICAgKi9cbiAgYXN5bmMgZW5jcnlwdEZpbGUoZmlsZVBhdGg6IHN0cmluZywgZGF0YTogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZnMgPSBhd2FpdCBpbXBvcnQoJ2ZzL3Byb21pc2VzJyk7XG4gICAgY29uc3QgcGF0aCA9IGF3YWl0IGltcG9ydCgncGF0aCcpO1xuICAgIFxuICAgIGNvbnN0IGVuY3J5cHRlZERhdGEgPSB0aGlzLmVuY3J5cHQoZGF0YSwgcGFzc3dvcmQpO1xuICAgIFxuICAgIC8vIOODh+OCo+ODrOOCr+ODiOODquOCkuS9nOaIkFxuICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShmaWxlUGF0aCk7XG4gICAgYXdhaXQgZnMubWtkaXIoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICBcbiAgICAvLyDmmpflj7fljJbjgZXjgozjgZ/jg4fjg7zjgr/jgpLkv53lrZhcbiAgICBhd2FpdCBmcy53cml0ZUZpbGUoZmlsZVBhdGgsIGVuY3J5cHRlZERhdGEsICd1dGY4Jyk7XG4gIH1cblxuICAvKipcbiAgICog5pqX5Y+35YyW44GV44KM44Gf44OV44Kh44Kk44Or44KS6Kqt44G/6L6844KT44Gn5b6p5Y+35YyWXG4gICAqL1xuICBhc3luYyBkZWNyeXB0RmlsZShmaWxlUGF0aDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydCgnZnMvcHJvbWlzZXMnKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW5jcnlwdGVkRGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmOCcpO1xuICAgICAgcmV0dXJuIHRoaXMuZGVjcnlwdChlbmNyeXB0ZWREYXRhLCBwYXNzd29yZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvci5jb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYOaal+WPt+WMluODleOCoeOCpOODq+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCkzogJHtmaWxlUGF0aH1gKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Hjgrnjg6/jg7zjg4njga7lvLfluqbjgpLjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHZhbGlkYXRlUGFzc3dvcmQocGFzc3dvcmQ6IHN0cmluZyk6IHsgdmFsaWQ6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9IHtcbiAgICBpZiAocGFzc3dvcmQubGVuZ3RoIDwgOCkge1xuICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBtZXNzYWdlOiAn44OR44K544Ov44O844OJ44GvOOaWh+Wtl+S7peS4iuOBp+OBguOCi+W/heimgeOBjOOBguOCiuOBvuOBmScgfTtcbiAgICB9XG5cbiAgICBpZiAoIS9bQS1aXS8udGVzdChwYXNzd29yZCkpIHtcbiAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgbWVzc2FnZTogJ+ODkeOCueODr+ODvOODieOBq+OBr+Wkp+aWh+Wtl+OCkuWQq+OCgeOCi+W/heimgeOBjOOBguOCiuOBvuOBmScgfTtcbiAgICB9XG5cbiAgICBpZiAoIS9bYS16XS8udGVzdChwYXNzd29yZCkpIHtcbiAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgbWVzc2FnZTogJ+ODkeOCueODr+ODvOODieOBq+OBr+Wwj+aWh+Wtl+OCkuWQq+OCgeOCi+W/heimgeOBjOOBguOCiuOBvuOBmScgfTtcbiAgICB9XG5cbiAgICBpZiAoIS9bMC05XS8udGVzdChwYXNzd29yZCkpIHtcbiAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgbWVzc2FnZTogJ+ODkeOCueODr+ODvOODieOBq+OBr+aVsOWtl+OCkuWQq+OCgeOCi+W/heimgeOBjOOBguOCiuOBvuOBmScgfTtcbiAgICB9XG5cbiAgICBpZiAoIS9bIUAjJCVeJiooKV8rXFwtPVxcW1xcXXt9Oyc6XCJcXFxcfCwuPD5cXC8/XS8udGVzdChwYXNzd29yZCkpIHtcbiAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgbWVzc2FnZTogJ+ODkeOCueODr+ODvOODieOBq+OBr+eJueauiuaWh+Wtl+OCkuWQq+OCgeOCi+W/heimgeOBjOOBguOCiuOBvuOBmScgfTtcbiAgICB9XG5cbiAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgbWVzc2FnZTogJ+ODkeOCueODr+ODvOODieOBr+acieWKueOBp+OBmScgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6njg7Pjg4Djg6Djgarjg5Hjgrnjg6/jg7zjg4njgpLnlJ/miJBcbiAgICovXG4gIGdlbmVyYXRlUGFzc3dvcmQobGVuZ3RoOiBudW1iZXIgPSAxNik6IHN0cmluZyB7XG4gICAgY29uc3QgY2hhcnNldCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSFAIyQlXiYqKClfKy09W117fXw7OiwuPD4/JztcbiAgICBsZXQgcGFzc3dvcmQgPSAnJztcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByYW5kb21JbmRleCA9IGNyeXB0by5yYW5kb21JbnQoMCwgY2hhcnNldC5sZW5ndGgpO1xuICAgICAgcGFzc3dvcmQgKz0gY2hhcnNldFtyYW5kb21JbmRleF07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBwYXNzd29yZDtcbiAgfVxufSJdfQ==