'use client';

const SUPPORTED_REGIONS = ['us-east-1', 'us-west-2', 'ap-southeast-2', 'ap-northeast-1', 'eu-west-1'];

interface RegistryErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

/**
 * Registry Error Boundary フォールバック
 * Requirements: 10.1, 10.3, 10.4, 10.5, 10.6, 11.6
 */
export function RegistryErrorFallback({ error, onRetry }: RegistryErrorFallbackProps) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Registry Error
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
        {error?.message || 'An unexpected error occurred in the Registry panel.'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}

/**
 * リージョン非対応時の警告バナー
 * Requirements: 10.5, 11.6
 */
export function RegistryRegionWarning() {
  return (
    <div className="mb-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Region Not Supported
          </h4>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            Your deploy region does not support Agent Registry. Set{' '}
            <code className="font-mono bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">agentRegistryRegion</code>{' '}
            in <code className="font-mono bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">cdk.context.json</code>{' '}
            to one of the supported regions: {SUPPORTED_REGIONS.join(', ')}.
          </p>
        </div>
      </div>
    </div>
  );
}
