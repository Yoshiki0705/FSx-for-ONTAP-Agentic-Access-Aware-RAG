"use strict";
/**
 * Configuration Manager
 * システム全体の設定管理と環境固有設定の処理を担当
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
exports.ConfigurationManager = void 0;
class ConfigurationManager {
    config = null;
    configPath;
    constructor(configPath = './config/cpos.config.json') {
        this.configPath = configPath;
    }
    /**
     * 設定ファイルを読み込む
     */
    async loadConfig() {
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const configData = await fs.readFile(this.configPath, 'utf-8');
            this.config = JSON.parse(configData);
            return this.config;
        }
        catch (error) {
            console.warn(`設定ファイルが見つかりません: ${this.configPath}. デフォルト設定を使用します。`);
            return this.getDefaultConfig();
        }
    }
    /**
     * デフォルト設定を取得
     */
    getDefaultConfig() {
        return {
            version: "1.0.0",
            environments: {
                local: {
                    basePath: "./",
                    tempPath: "./temp",
                    backupPath: "./backups"
                },
                ec2: {
                    basePath: "/home/ubuntu/project",
                    tempPath: "/home/ubuntu/project/temp",
                    backupPath: "/home/ubuntu/project/backups",
                    host: process.env.EC2_HOST || "",
                    user: process.env.EC2_USER || "ubuntu",
                    keyPath: process.env.SSH_KEY_PATH || ""
                }
            },
            classification: {
                rules: "./config/classification-rules.json",
                confidence: 0.8,
                autoApply: true
            },
            sync: {
                interval: "0 */6 * * *", // 6時間毎
                conflictResolution: "prompt",
                excludePatterns: ["node_modules", "*.log", "cdk.out"]
            },
            backup: {
                schedule: {
                    incremental: "0 2 * * *", // 毎日2時
                    full: "0 2 * * 0", // 毎週日曜2時
                    archive: "0 2 1 * *" // 毎月1日2時
                },
                retention: {
                    daily: 30,
                    weekly: 12,
                    monthly: 12
                }
            }
        };
    }
    /**
     * 設定を保存
     */
    async saveConfig(config) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        // 設定ディレクトリを作成
        const configDir = path.dirname(this.configPath);
        await fs.mkdir(configDir, { recursive: true });
        // 設定を保存
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
        this.config = config;
    }
    /**
     * 現在の設定を取得
     */
    getConfig() {
        if (!this.config) {
            throw new Error('設定が読み込まれていません。loadConfig()を先に実行してください。');
        }
        return this.config;
    }
    /**
     * 環境固有の設定を取得
     */
    getEnvironmentConfig(environment) {
        const config = this.getConfig();
        return config.environments[environment];
    }
    /**
     * 設定の検証
     */
    validateConfig(config) {
        // 必須フィールドの検証
        if (!config.version || !config.environments) {
            return false;
        }
        // 環境設定の検証
        const { local, ec2 } = config.environments;
        if (!local?.basePath || !ec2?.basePath) {
            return false;
        }
        return true;
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQStDSCxNQUFhLG9CQUFvQjtJQUN2QixNQUFNLEdBQXNCLElBQUksQ0FBQztJQUNqQyxVQUFVLENBQVM7SUFFM0IsWUFBWSxhQUFxQiwyQkFBMkI7UUFDMUQsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7SUFDL0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVU7UUFDZCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsR0FBRyx3REFBYSxhQUFhLEdBQUMsQ0FBQztZQUN2QyxNQUFNLFVBQVUsR0FBRyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUMvRCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDckMsT0FBTyxJQUFJLENBQUMsTUFBTyxDQUFDO1FBQ3RCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxDQUFDLFVBQVUsa0JBQWtCLENBQUMsQ0FBQztZQUNuRSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxnQkFBZ0I7UUFDZCxPQUFPO1lBQ0wsT0FBTyxFQUFFLE9BQU87WUFDaEIsWUFBWSxFQUFFO2dCQUNaLEtBQUssRUFBRTtvQkFDTCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxRQUFRLEVBQUUsUUFBUTtvQkFDbEIsVUFBVSxFQUFFLFdBQVc7aUJBQ3hCO2dCQUNELEdBQUcsRUFBRTtvQkFDSCxRQUFRLEVBQUUsc0JBQXNCO29CQUNoQyxRQUFRLEVBQUUsMkJBQTJC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t+OCueODhuODoOWFqOS9k+OBruioreWumueuoeeQhuOBqOeSsOWig+WbuuacieioreWumuOBruWHpueQhuOCkuaLheW9k1xuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ1BPU0NvbmZpZyB7XG4gIHZlcnNpb246IHN0cmluZztcbiAgZW52aXJvbm1lbnRzOiB7XG4gICAgbG9jYWw6IEVudmlyb25tZW50Q29uZmlnO1xuICAgIGVjMjogRW52aXJvbm1lbnRDb25maWc7XG4gIH07XG4gIGNsYXNzaWZpY2F0aW9uOiBDbGFzc2lmaWNhdGlvbkNvbmZpZztcbiAgc3luYzogU3luY0NvbmZpZztcbiAgYmFja3VwOiBCYWNrdXBDb25maWc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW52aXJvbm1lbnRDb25maWcge1xuICBiYXNlUGF0aDogc3RyaW5nO1xuICB0ZW1wUGF0aDogc3RyaW5nO1xuICBiYWNrdXBQYXRoOiBzdHJpbmc7XG4gIGhvc3Q/OiBzdHJpbmc7XG4gIHVzZXI/OiBzdHJpbmc7XG4gIGtleVBhdGg/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2xhc3NpZmljYXRpb25Db25maWcge1xuICBydWxlczogc3RyaW5nO1xuICBjb25maWRlbmNlOiBudW1iZXI7XG4gIGF1dG9BcHBseTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTeW5jQ29uZmlnIHtcbiAgaW50ZXJ2YWw6IHN0cmluZztcbiAgY29uZmxpY3RSZXNvbHV0aW9uOiAncHJvbXB0JyB8ICdhdXRvJyB8ICdtYW51YWwnO1xuICBleGNsdWRlUGF0dGVybnM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJhY2t1cENvbmZpZyB7XG4gIHNjaGVkdWxlOiB7XG4gICAgaW5jcmVtZW50YWw6IHN0cmluZztcbiAgICBmdWxsOiBzdHJpbmc7XG4gICAgYXJjaGl2ZTogc3RyaW5nO1xuICB9O1xuICByZXRlbnRpb246IHtcbiAgICBkYWlseTogbnVtYmVyO1xuICAgIHdlZWtseTogbnVtYmVyO1xuICAgIG1vbnRobHk6IG51bWJlcjtcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbmZpZ3VyYXRpb25NYW5hZ2VyIHtcbiAgcHJpdmF0ZSBjb25maWc6IENQT1NDb25maWcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjb25maWdQYXRoOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnUGF0aDogc3RyaW5nID0gJy4vY29uZmlnL2Nwb3MuY29uZmlnLmpzb24nKSB7XG4gICAgdGhpcy5jb25maWdQYXRoID0gY29uZmlnUGF0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiDoqK3lrprjg5XjgqHjgqTjg6vjgpLoqq3jgb/ovrzjgoBcbiAgICovXG4gIGFzeW5jIGxvYWRDb25maWcoKTogUHJvbWlzZTxDUE9TQ29uZmlnPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KCdmcy9wcm9taXNlcycpO1xuICAgICAgY29uc3QgY29uZmlnRGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKHRoaXMuY29uZmlnUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICB0aGlzLmNvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnRGF0YSk7XG4gICAgICByZXR1cm4gdGhpcy5jb25maWchO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOioreWumuODleOCoeOCpOODq+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCkzogJHt0aGlzLmNvbmZpZ1BhdGh9LiDjg4fjg5Xjgqnjg6vjg4joqK3lrprjgpLkvb/nlKjjgZfjgb7jgZnjgIJgKTtcbiAgICAgIHJldHVybiB0aGlzLmdldERlZmF1bHRDb25maWcoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI6Kit5a6a44KS5Y+W5b6XXG4gICAqL1xuICBnZXREZWZhdWx0Q29uZmlnKCk6IENQT1NDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICB2ZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgICBlbnZpcm9ubWVudHM6IHtcbiAgICAgICAgbG9jYWw6IHtcbiAgICAgICAgICBiYXNlUGF0aDogXCIuL1wiLFxuICAgICAgICAgIHRlbXBQYXRoOiBcIi4vdGVtcFwiLFxuICAgICAgICAgIGJhY2t1cFBhdGg6IFwiLi9iYWNrdXBzXCJcbiAgICAgICAgfSxcbiAgICAgICAgZWMyOiB7XG4gICAgICAgICAgYmFzZVBhdGg6IFwiL2hvbWUvdWJ1bnR1L3Byb2plY3RcIixcbiAgICAgICAgICB0ZW1wUGF0aDogXCIvaG9tZS91YnVudHUvcHJvamVjdC90ZW1wXCIsXG4gICAgICAgICAgYmFja3VwUGF0aDogXCIvaG9tZS91YnVudHUvcHJvamVjdC9iYWNrdXBzXCIsXG4gICAgICAgICAgaG9zdDogcHJvY2Vzcy5lbnYuRUMyX0hPU1QgfHwgXCJcIixcbiAgICAgICAgICB1c2VyOiBwcm9jZXNzLmVudi5FQzJfVVNFUiB8fCBcInVidW50dVwiLFxuICAgICAgICAgIGtleVBhdGg6IHByb2Nlc3MuZW52LlNTSF9LRVlfUEFUSCB8fCBcIlwiXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjbGFzc2lmaWNhdGlvbjoge1xuICAgICAgICBydWxlczogXCIuL2NvbmZpZy9jbGFzc2lmaWNhdGlvbi1ydWxlcy5qc29uXCIsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuOCxcbiAgICAgICAgYXV0b0FwcGx5OiB0cnVlXG4gICAgICB9LFxuICAgICAgc3luYzoge1xuICAgICAgICBpbnRlcnZhbDogXCIwICovNiAqICogKlwiLCAvLyA25pmC6ZaT5q+OXG4gICAgICAgIGNvbmZsaWN0UmVzb2x1dGlvbjogXCJwcm9tcHRcIixcbiAgICAgICAgZXhjbHVkZVBhdHRlcm5zOiBbXCJub2RlX21vZHVsZXNcIiwgXCIqLmxvZ1wiLCBcImNkay5vdXRcIl1cbiAgICAgIH0sXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgc2NoZWR1bGU6IHtcbiAgICAgICAgICBpbmNyZW1lbnRhbDogXCIwIDIgKiAqICpcIiwgICAgLy8g5q+O5pelMuaZglxuICAgICAgICAgIGZ1bGw6IFwiMCAyICogKiAwXCIsICAgICAgICAgICAvLyDmr47pgLHml6Xmm5wy5pmCXG4gICAgICAgICAgYXJjaGl2ZTogXCIwIDIgMSAqICpcIiAgICAgICAgIC8vIOavjuaciDHml6Uy5pmCXG4gICAgICAgIH0sXG4gICAgICAgIHJldGVudGlvbjoge1xuICAgICAgICAgIGRhaWx5OiAzMCxcbiAgICAgICAgICB3ZWVrbHk6IDEyLFxuICAgICAgICAgIG1vbnRobHk6IDEyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOioreWumuOCkuS/neWtmFxuICAgKi9cbiAgYXN5bmMgc2F2ZUNvbmZpZyhjb25maWc6IENQT1NDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmcyA9IGF3YWl0IGltcG9ydCgnZnMvcHJvbWlzZXMnKTtcbiAgICBjb25zdCBwYXRoID0gYXdhaXQgaW1wb3J0KCdwYXRoJyk7XG4gICAgXG4gICAgLy8g6Kit5a6a44OH44Kj44Os44Kv44OI44Oq44KS5L2c5oiQXG4gICAgY29uc3QgY29uZmlnRGlyID0gcGF0aC5kaXJuYW1lKHRoaXMuY29uZmlnUGF0aCk7XG4gICAgYXdhaXQgZnMubWtkaXIoY29uZmlnRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICBcbiAgICAvLyDoqK3lrprjgpLkv53lrZhcbiAgICBhd2FpdCBmcy53cml0ZUZpbGUodGhpcy5jb25maWdQYXRoLCBKU09OLnN0cmluZ2lmeShjb25maWcsIG51bGwsIDIpKTtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiDnj77lnKjjga7oqK3lrprjgpLlj5blvpdcbiAgICovXG4gIGdldENvbmZpZygpOiBDUE9TQ29uZmlnIHtcbiAgICBpZiAoIXRoaXMuY29uZmlnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ioreWumuOBjOiqreOBv+i+vOOBvuOCjOOBpuOBhOOBvuOBm+OCk+OAgmxvYWRDb25maWcoKeOCkuWFiOOBq+Wun+ihjOOBl+OBpuOBj+OBoOOBleOBhOOAgicpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jb25maWc7XG4gIH1cblxuICAvKipcbiAgICog55Kw5aKD5Zu65pyJ44Gu6Kit5a6a44KS5Y+W5b6XXG4gICAqL1xuICBnZXRFbnZpcm9ubWVudENvbmZpZyhlbnZpcm9ubWVudDogJ2xvY2FsJyB8ICdlYzInKTogRW52aXJvbm1lbnRDb25maWcge1xuICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuZ2V0Q29uZmlnKCk7XG4gICAgcmV0dXJuIGNvbmZpZy5lbnZpcm9ubWVudHNbZW52aXJvbm1lbnRdO1xuICB9XG5cbiAgLyoqXG4gICAqIOioreWumuOBruaknOiovFxuICAgKi9cbiAgdmFsaWRhdGVDb25maWcoY29uZmlnOiBDUE9TQ29uZmlnKTogYm9vbGVhbiB7XG4gICAgLy8g5b+F6aCI44OV44Kj44O844Or44OJ44Gu5qSc6Ki8XG4gICAgaWYgKCFjb25maWcudmVyc2lvbiB8fCAhY29uZmlnLmVudmlyb25tZW50cykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIOeSsOWig+ioreWumuOBruaknOiovFxuICAgIGNvbnN0IHsgbG9jYWwsIGVjMiB9ID0gY29uZmlnLmVudmlyb25tZW50cztcbiAgICBpZiAoIWxvY2FsPy5iYXNlUGF0aCB8fCAhZWMyPy5iYXNlUGF0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG59Il19