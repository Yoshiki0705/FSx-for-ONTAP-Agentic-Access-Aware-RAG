import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Supported locales
const locales = ['en', 'ja'] as const;
type Locale = typeof locales[number];

interface OfflinePageProps {
  params: Promise<{
    locale: string;
  }>;
}

// Server component for the offline page
export default async function OfflinePage({ params }: OfflinePageProps) {
  // Await params in Next.js 15
  const { locale: localeParam } = await params;
  
  // Validate locale
  const locale = localeParam as Locale;
  if (!locales.includes(locale)) {
    notFound();
  }

  // Use minimal messages for now to avoid dynamic headers issue
  const messages = {};

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {locale === 'ja' ? 'オフライン' : 'Offline'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {locale === 'ja' 
              ? 'インターネット接続を確認してください。' 
              : 'Please check your internet connection.'}
          </p>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}

// Metadata
export const metadata = {
  title: 'Offline - Permission-aware RAG Chatbot',
  description: 'Offline page for the chatbot application',
};
