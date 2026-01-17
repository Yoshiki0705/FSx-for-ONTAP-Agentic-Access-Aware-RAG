"use strict";
/**
 * File Scanner Factory
 * ファイルスキャナーのファクトリークラス
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileScannerFactory = void 0;
const index_1 = require("./index");
class FileScannerFactory {
    /**
     * デフォルト設定でファイルスキャナーを作成
     */
    static createDefault() {
        const defaultConfig = {
            watchPaths: [
                './lib',
                './src',
                './config',
                './docs',
                './scripts',
                './lambda',
                './types'
            ],
            excludePatterns: [
                'node_modules',
                '.git',
                'cdk.out',
                '*.log',
                'temp',
                'backups',
                '.DS_Store',
                'Thumbs.db',
                '*.tmp',
                '*.swp',
                '*.bak'
            ],
            scanInterval: 30000, // 30秒
            enableRealTimeWatch: true,
            maxFileSize: 10 * 1024 * 1024 // 10MB
        };
        return new index_1.FileScanner(defaultConfig);
    }
    /**
     * CPOS設定からファイルスキャナーを作成
     */
    static createFromConfig(cposConfig) {
        const config = {
            watchPaths: [
                cposConfig.environments.local.basePath,
                './lib',
                './src',
                './config',
                './docs',
                './scripts',
                './lambda',
                './types'
            ],
            excludePatterns: [
                ...cposConfig.sync.excludePatterns,
                '.DS_Store',
                'Thumbs.db',
                '*.tmp',
                '*.swp',
                '*.bak'
            ],
            scanInterval: 30000, // 30秒
            enableRealTimeWatch: true,
            maxFileSize: 10 * 1024 * 1024 // 10MB
        };
        return new index_1.FileScanner(config);
    }
    /**
     * カスタム設定でファイルスキャナーを作成
     */
    static createCustom(config) {
        const defaultScanner = this.createDefault();
        const defaultConfig = defaultScanner.config;
        const mergedConfig = {
            ...defaultConfig,
            ...config
        };
        return new index_1.FileScanner(mergedConfig);
    }
    /**
     * 環境別ファイルスキャナーを作成
     */
    static createForEnvironment(environment, cposConfig) {
        const envConfig = cposConfig.environments[environment];
        const config = {
            watchPaths: [
                envConfig.basePath,
                `${envConfig.basePath}/lib`,
                `${envConfig.basePath}/src`,
                `${envConfig.basePath}/config`,
                `${envConfig.basePath}/docs`,
                `${envConfig.basePath}/scripts`,
                `${envConfig.basePath}/lambda`,
                `${envConfig.basePath}/types`
            ],
            excludePatterns: [
                ...cposConfig.sync.excludePatterns,
                '.DS_Store',
                'Thumbs.db',
                '*.tmp',
                '*.swp',
                '*.bak'
            ],
            scanInterval: environment === 'local' ? 30000 : 60000, // EC2は1分間隔
            enableRealTimeWatch: environment === 'local', // ローカルのみリアルタイム監視
            maxFileSize: 10 * 1024 * 1024 // 10MB
        };
        return new index_1.FileScanner(config);
    }
}
exports.FileScannerFactory = FileScannerFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nhbm5lci1mYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2Nhbm5lci1mYWN0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILG1DQUF5RDtBQUd6RCxNQUFhLGtCQUFrQjtJQUM3Qjs7T0FFRztJQUNILE1BQU0sQ0FBQyxhQUFhO1FBQ2xCLE1BQU0sYUFBYSxHQUFzQjtZQUN2QyxVQUFVLEVBQUU7Z0JBQ1YsT0FBTztnQkFDUCxPQUFPO2dCQUNQLFVBQVU7Z0JBQ1YsUUFBUTtnQkFDUixXQUFXO2dCQUNYLFVBQVU7Z0JBQ1YsU0FBUzthQUNWO1lBQ0QsZUFBZSxFQUFFO2dCQUNmLGNBQWM7Z0JBQ2QsTUFBTTtnQkFDTixTQUFTO2dCQUNULE9BQU87Z0JBQ1AsTUFBTTtnQkFDTixTQUFTO2dCQUNULFdBQVc7Z0JBQ1gsV0FBVztnQkFDWCxPQUFPO2dCQUNQLE9BQU87Z0JBQ1AsT0FBTzthQUNSO1lBQ0QsWUFBWSxFQUFFLEtBQUssRUFBRSxNQUFNO1lBQzNCLG1CQUFtQixFQUFFLElBQUk7WUFDekIsV0FBVyxFQUFFLEVBQUUsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU87U0FDdEMsQ0FBQztRQUVGLE9BQU8sSUFBSSxtQkFBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFzQjtRQUM1QyxNQUFNLE1BQU0sR0FBc0I7WUFDaEMsVUFBVSxFQUFFO2dCQUNWLFVBQVUsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLFFBQVE7Z0JBQ3RDLE9BQU87Z0JBQ1AsT0FBTztnQkFDUCxVQUFVO2dCQUNWLFFBQVE7Z0JBQ1IsV0FBVztnQkFDWCxVQUFVO2dCQUNWLFNBQVM7YUFDVjtZQUNELGVBQWUsRUFBRTtnQkFDZixHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsZUFBZTtnQkFDbEMsV0FBVztnQkFDWCxXQUFXO2dCQUNYLE9BQU87Z0JBQ1AsT0FBTztnQkFDUCxPQUFPO2FBQ1I7WUFDRCxZQUFZLEVBQUUsS0FBSyxFQUFFLE1BQU07WUFDM0IsbUJBQW1CLEVBQUUsSUFBSTtZQUN6QixXQUFXLEVBQUUsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTztTQUN0QyxDQUFDO1FBRUYsT0FBTyxJQUFJLG1CQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFrQztRQUNwRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDNUMsTUFBTSxhQUFhLEdBQUksY0FBc0IsQ0FBQyxNQUFNLENBQUM7UUFDckQsTUFBTSxZQUFZLEdBQXNCO1lBQ3RDLEdBQUcsYUFBYTtZQUNoQixHQUFHLE1BQU07U0FDVixDQUFDO1FBRUYsT0FBTyxJQUFJLG1CQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLG9CQUFvQixDQUFDLFdBQTRCLEVBQUUsVUFBc0I7UUFDOUUsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV2RCxNQUFNLE1BQU0sR0FBc0I7WUFDaEMsVUFBVSxFQUFFO2dCQUNWLFNBQVMsQ0FBQyxRQUFRO2dCQUNsQixHQUFHLFNBQVMsQ0FBQyxRQUFRLE1BQU07Z0JBQzNCLEdBQUcsU0FBUyxDQUFDLFFBQVEsTUFBTTtnQkFDM0IsR0FBRyxTQUFTLENBQUMsUUFBUSxTQUFTO2dCQUM5QixHQUFHLFNBQVMsQ0FBQyxRQUFRLE9BQU87Z0JBQzVCLEdBQUcsU0FBUyxDQUFDLFFBQVEsVUFBVTtnQkFDL0IsR0FBRyxTQUFTLENBQUMsUUFBUSxTQUFTO2dCQUM5QixHQUFHLFNBQVMsQ0FBQyxRQUFRLFFBQVE7YUFDOUI7WUFDRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLGVBQWU7Z0JBQ2xDLFdBQVc7Z0JBQ1gsV0FBVztnQkFDWCxPQUFPO2dCQUNQLE9BQU87Z0JBQ1AsT0FBTzthQUNSO1lBQ0QsWUFBWSxFQUFFLFdBQVcsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLFdBQVc7WUFDbEUsbUJBQW1CLEVBQUUsV0FBVyxLQUFLLE9BQU8sRUFBRSxpQkFBaUI7WUFDL0QsV0FBVyxFQUFFLEVBQUUsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU87U0FDdEMsQ0FBQztRQUVGLE9BQU8sSUFBSSxtQkFBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pDLENBQUM7Q0FDRjtBQWpIRCxnREFpSEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZpbGUgU2Nhbm5lciBGYWN0b3J5XG4gKiDjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7zjga7jg5XjgqHjgq/jg4jjg6rjg7zjgq/jg6njgrlcbiAqL1xuXG5pbXBvcnQgeyBGaWxlU2Nhbm5lciwgRmlsZVNjYW5uZXJDb25maWcgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IENQT1NDb25maWcgfSBmcm9tICcuLi9jb25maWd1cmF0aW9uJztcblxuZXhwb3J0IGNsYXNzIEZpbGVTY2FubmVyRmFjdG9yeSB7XG4gIC8qKlxuICAgKiDjg4fjg5Xjgqnjg6vjg4joqK3lrprjgafjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7zjgpLkvZzmiJBcbiAgICovXG4gIHN0YXRpYyBjcmVhdGVEZWZhdWx0KCk6IEZpbGVTY2FubmVyIHtcbiAgICBjb25zdCBkZWZhdWx0Q29uZmlnOiBGaWxlU2Nhbm5lckNvbmZpZyA9IHtcbiAgICAgIHdhdGNoUGF0aHM6IFtcbiAgICAgICAgJy4vbGliJyxcbiAgICAgICAgJy4vc3JjJyxcbiAgICAgICAgJy4vY29uZmlnJyxcbiAgICAgICAgJy4vZG9jcycsXG4gICAgICAgICcuL3NjcmlwdHMnLFxuICAgICAgICAnLi9sYW1iZGEnLFxuICAgICAgICAnLi90eXBlcydcbiAgICAgIF0sXG4gICAgICBleGNsdWRlUGF0dGVybnM6IFtcbiAgICAgICAgJ25vZGVfbW9kdWxlcycsXG4gICAgICAgICcuZ2l0JyxcbiAgICAgICAgJ2Nkay5vdXQnLFxuICAgICAgICAnKi5sb2cnLFxuICAgICAgICAndGVtcCcsXG4gICAgICAgICdiYWNrdXBzJyxcbiAgICAgICAgJy5EU19TdG9yZScsXG4gICAgICAgICdUaHVtYnMuZGInLFxuICAgICAgICAnKi50bXAnLFxuICAgICAgICAnKi5zd3AnLFxuICAgICAgICAnKi5iYWsnXG4gICAgICBdLFxuICAgICAgc2NhbkludGVydmFsOiAzMDAwMCwgLy8gMzDnp5JcbiAgICAgIGVuYWJsZVJlYWxUaW1lV2F0Y2g6IHRydWUsXG4gICAgICBtYXhGaWxlU2l6ZTogMTAgKiAxMDI0ICogMTAyNCAvLyAxME1CXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgRmlsZVNjYW5uZXIoZGVmYXVsdENvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICogQ1BPU+ioreWumuOBi+OCieODleOCoeOCpOODq+OCueOCreODo+ODiuODvOOCkuS9nOaIkFxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZUZyb21Db25maWcoY3Bvc0NvbmZpZzogQ1BPU0NvbmZpZyk6IEZpbGVTY2FubmVyIHtcbiAgICBjb25zdCBjb25maWc6IEZpbGVTY2FubmVyQ29uZmlnID0ge1xuICAgICAgd2F0Y2hQYXRoczogW1xuICAgICAgICBjcG9zQ29uZmlnLmVudmlyb25tZW50cy5sb2NhbC5iYXNlUGF0aCxcbiAgICAgICAgJy4vbGliJyxcbiAgICAgICAgJy4vc3JjJyxcbiAgICAgICAgJy4vY29uZmlnJyxcbiAgICAgICAgJy4vZG9jcycsXG4gICAgICAgICcuL3NjcmlwdHMnLFxuICAgICAgICAnLi9sYW1iZGEnLFxuICAgICAgICAnLi90eXBlcydcbiAgICAgIF0sXG4gICAgICBleGNsdWRlUGF0dGVybnM6IFtcbiAgICAgICAgLi4uY3Bvc0NvbmZpZy5zeW5jLmV4Y2x1ZGVQYXR0ZXJucyxcbiAgICAgICAgJy5EU19TdG9yZScsXG4gICAgICAgICdUaHVtYnMuZGInLFxuICAgICAgICAnKi50bXAnLFxuICAgICAgICAnKi5zd3AnLFxuICAgICAgICAnKi5iYWsnXG4gICAgICBdLFxuICAgICAgc2NhbkludGVydmFsOiAzMDAwMCwgLy8gMzDnp5JcbiAgICAgIGVuYWJsZVJlYWxUaW1lV2F0Y2g6IHRydWUsXG4gICAgICBtYXhGaWxlU2l6ZTogMTAgKiAxMDI0ICogMTAyNCAvLyAxME1CXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgRmlsZVNjYW5uZXIoY29uZmlnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqvjgrnjgr/jg6DoqK3lrprjgafjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7zjgpLkvZzmiJBcbiAgICovXG4gIHN0YXRpYyBjcmVhdGVDdXN0b20oY29uZmlnOiBQYXJ0aWFsPEZpbGVTY2FubmVyQ29uZmlnPik6IEZpbGVTY2FubmVyIHtcbiAgICBjb25zdCBkZWZhdWx0U2Nhbm5lciA9IHRoaXMuY3JlYXRlRGVmYXVsdCgpO1xuICAgIGNvbnN0IGRlZmF1bHRDb25maWcgPSAoZGVmYXVsdFNjYW5uZXIgYXMgYW55KS5jb25maWc7XG4gICAgY29uc3QgbWVyZ2VkQ29uZmlnOiBGaWxlU2Nhbm5lckNvbmZpZyA9IHtcbiAgICAgIC4uLmRlZmF1bHRDb25maWcsXG4gICAgICAuLi5jb25maWdcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBGaWxlU2Nhbm5lcihtZXJnZWRDb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+WIpeODleOCoeOCpOODq+OCueOCreODo+ODiuODvOOCkuS9nOaIkFxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZUZvckVudmlyb25tZW50KGVudmlyb25tZW50OiAnbG9jYWwnIHwgJ2VjMicsIGNwb3NDb25maWc6IENQT1NDb25maWcpOiBGaWxlU2Nhbm5lciB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gY3Bvc0NvbmZpZy5lbnZpcm9ubWVudHNbZW52aXJvbm1lbnRdO1xuICAgIFxuICAgIGNvbnN0IGNvbmZpZzogRmlsZVNjYW5uZXJDb25maWcgPSB7XG4gICAgICB3YXRjaFBhdGhzOiBbXG4gICAgICAgIGVudkNvbmZpZy5iYXNlUGF0aCxcbiAgICAgICAgYCR7ZW52Q29uZmlnLmJhc2VQYXRofS9saWJgLFxuICAgICAgICBgJHtlbnZDb25maWcuYmFzZVBhdGh9L3NyY2AsXG4gICAgICAgIGAke2VudkNvbmZpZy5iYXNlUGF0aH0vY29uZmlnYCxcbiAgICAgICAgYCR7ZW52Q29uZmlnLmJhc2VQYXRofS9kb2NzYCxcbiAgICAgICAgYCR7ZW52Q29uZmlnLmJhc2VQYXRofS9zY3JpcHRzYCxcbiAgICAgICAgYCR7ZW52Q29uZmlnLmJhc2VQYXRofS9sYW1iZGFgLFxuICAgICAgICBgJHtlbnZDb25maWcuYmFzZVBhdGh9L3R5cGVzYFxuICAgICAgXSxcbiAgICAgIGV4Y2x1ZGVQYXR0ZXJuczogW1xuICAgICAgICAuLi5jcG9zQ29uZmlnLnN5bmMuZXhjbHVkZVBhdHRlcm5zLFxuICAgICAgICAnLkRTX1N0b3JlJyxcbiAgICAgICAgJ1RodW1icy5kYicsXG4gICAgICAgICcqLnRtcCcsXG4gICAgICAgICcqLnN3cCcsXG4gICAgICAgICcqLmJhaydcbiAgICAgIF0sXG4gICAgICBzY2FuSW50ZXJ2YWw6IGVudmlyb25tZW50ID09PSAnbG9jYWwnID8gMzAwMDAgOiA2MDAwMCwgLy8gRUMy44GvMeWIhumWk+malFxuICAgICAgZW5hYmxlUmVhbFRpbWVXYXRjaDogZW52aXJvbm1lbnQgPT09ICdsb2NhbCcsIC8vIOODreODvOOCq+ODq+OBruOBv+ODquOCouODq+OCv+OCpOODoOebo+imllxuICAgICAgbWF4RmlsZVNpemU6IDEwICogMTAyNCAqIDEwMjQgLy8gMTBNQlxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IEZpbGVTY2FubmVyKGNvbmZpZyk7XG4gIH1cbn0iXX0=