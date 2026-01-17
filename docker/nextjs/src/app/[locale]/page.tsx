import { redirect } from 'next/navigation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface LocaleHomePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  // Await params for Next.js 15 compatibility
  const resolvedParams = await params;
  
  // ロケール付きのサインインページにリダイレクト
  redirect(`/${resolvedParams.locale}/signin`);
}
