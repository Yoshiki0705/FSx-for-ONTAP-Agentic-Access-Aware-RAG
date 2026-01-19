"use strict";
/**
 * 監査ログ設定
 *
 * 権限制御システムの監査ログ設定
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultAuditLoggingConfig = void 0;
exports.DefaultAuditLoggingConfig = {
    enabled: true,
    logLevel: 'INFO',
    destinations: {
        cloudWatch: true,
        s3: true,
        elasticsearch: false
    },
    sensitiveDataMasking: {
        enabled: true,
        maskPatterns: [
            'password',
            'token',
            'key',
            'secret',
            'credential'
        ]
    },
    retentionDays: 2555, // 7年間（法的要件対応）
    realTimeMonitoring: {
        enabled: true,
        alertThresholds: {
            failedAccessAttempts: 5,
            suspiciousIpAccess: 3,
            afterHoursAccess: 10
        }
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaXQtbG9nZ2luZy1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdWRpdC1sb2dnaW5nLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7O0FBb0NVLFFBQUEseUJBQXlCLEdBQXVCO0lBQzNELE9BQU8sRUFBRSxJQUFJO0lBQ2IsUUFBUSxFQUFFLE1BQU07SUFDaEIsWUFBWSxFQUFFO1FBQ1osVUFBVSxFQUFFLElBQUk7UUFDaEIsRUFBRSxFQUFFLElBQUk7UUFDUixhQUFhLEVBQUUsS0FBSztLQUNyQjtJQUNELG9CQUFvQixFQUFFO1FBQ3BCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsWUFBWSxFQUFFO1lBQ1osVUFBVTtZQUNWLE9BQU87WUFDUCxLQUFLO1lBQ0wsUUFBUTtZQUNSLFlBQVk7U0FDYjtLQUNGO0lBQ0QsYUFBYSxFQUFFLElBQUksRUFBRSxjQUFjO0lBQ25DLGtCQUFrQixFQUFFO1FBQ2xCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsZUFBZSxFQUFFO1lBQ2Ysb0JBQW9CLEVBQUUsQ0FBQztZQUN2QixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLGdCQUFnQixFQUFFLEVBQUU7U0FDckI7S0FDRjtDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOebo+afu+ODreOCsOioreWumlxuICogXG4gKiDmqKnpmZDliLblvqHjgrfjgrnjg4bjg6Djga7nm6Pmn7vjg63jgrDoqK3lrppcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1ZGl0TG9nZ2luZ0NvbmZpZyB7XG4gIC8qKiDnm6Pmn7vjg63jgrDmnInlirnljJYgKi9cbiAgZW5hYmxlZDogYm9vbGVhbjtcbiAgXG4gIC8qKiDjg63jgrDjg6zjg5njg6sgKi9cbiAgbG9nTGV2ZWw6ICdERUJVRycgfCAnSU5GTycgfCAnV0FSTicgfCAnRVJST1InO1xuICBcbiAgLyoqIOODreOCsOWHuuWKm+WFiCAqL1xuICBkZXN0aW5hdGlvbnM6IHtcbiAgICBjbG91ZFdhdGNoOiBib29sZWFuO1xuICAgIHMzOiBib29sZWFuO1xuICAgIGVsYXN0aWNzZWFyY2g6IGJvb2xlYW47XG4gIH07XG4gIFxuICAvKiog5qmf5a+G5oOF5aCx44Oe44K544Kt44Oz44KwICovXG4gIHNlbnNpdGl2ZURhdGFNYXNraW5nOiB7XG4gICAgZW5hYmxlZDogYm9vbGVhbjtcbiAgICBtYXNrUGF0dGVybnM6IHN0cmluZ1tdO1xuICB9O1xuICBcbiAgLyoqIOODreOCsOS/neaMgeacn+mWkyAqL1xuICByZXRlbnRpb25EYXlzOiBudW1iZXI7XG4gIFxuICAvKiog44Oq44Ki44Or44K/44Kk44Og55uj6KaWICovXG4gIHJlYWxUaW1lTW9uaXRvcmluZzoge1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgYWxlcnRUaHJlc2hvbGRzOiB7XG4gICAgICBmYWlsZWRBY2Nlc3NBdHRlbXB0czogbnVtYmVyO1xuICAgICAgc3VzcGljaW91c0lwQWNjZXNzOiBudW1iZXI7XG4gICAgICBhZnRlckhvdXJzQWNjZXNzOiBudW1iZXI7XG4gICAgfTtcbiAgfTtcbn1cblxuZXhwb3J0IGNvbnN0IERlZmF1bHRBdWRpdExvZ2dpbmdDb25maWc6IEF1ZGl0TG9nZ2luZ0NvbmZpZyA9IHtcbiAgZW5hYmxlZDogdHJ1ZSxcbiAgbG9nTGV2ZWw6ICdJTkZPJyxcbiAgZGVzdGluYXRpb25zOiB7XG4gICAgY2xvdWRXYXRjaDogdHJ1ZSxcbiAgICBzMzogdHJ1ZSxcbiAgICBlbGFzdGljc2VhcmNoOiBmYWxzZVxuICB9LFxuICBzZW5zaXRpdmVEYXRhTWFza2luZzoge1xuICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgbWFza1BhdHRlcm5zOiBbXG4gICAgICAncGFzc3dvcmQnLFxuICAgICAgJ3Rva2VuJyxcbiAgICAgICdrZXknLFxuICAgICAgJ3NlY3JldCcsXG4gICAgICAnY3JlZGVudGlhbCdcbiAgICBdXG4gIH0sXG4gIHJldGVudGlvbkRheXM6IDI1NTUsIC8vIDflubTplpPvvIjms5XnmoTopoHku7blr77lv5zvvIlcbiAgcmVhbFRpbWVNb25pdG9yaW5nOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBhbGVydFRocmVzaG9sZHM6IHtcbiAgICAgIGZhaWxlZEFjY2Vzc0F0dGVtcHRzOiA1LFxuICAgICAgc3VzcGljaW91c0lwQWNjZXNzOiAzLFxuICAgICAgYWZ0ZXJIb3Vyc0FjY2VzczogMTBcbiAgICB9XG4gIH1cbn07Il19