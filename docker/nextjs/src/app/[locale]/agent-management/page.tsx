/**
 * Agent管理ページ
 * UI上でのAgent作成・削除・更新とSSMパラメータ自動同期
 * Next.js 15互換性対応: params Promise対応
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AgentManagement } from '@/components/bedrock/AgentManagement';

// Next.js 15: params は Promise になった
interface AgentManagementPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AgentManagementPageProps): Promise<Metadata> {
  // Next.js 15: params を await で解決
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'agentManagement' });
  
  return {
    title: t('pageTitle', { default: 'Agent Management - Permission-aware RAG' }),
    description: t('pageDescription', { default: 'Manage Bedrock Agents with automatic SSM parameter synchronization' }),
  };
}

export default async function AgentManagementPage({ params }: AgentManagementPageProps) {
  // Next.js 15: params を await で解決
  const { locale } = await params;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Agent Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create, manage, and delete Bedrock Agents with automatic SSM parameter synchronization
            </p>
          </div>
          
          <AgentManagement />
        </div>
      </div>
    </div>
  );
}
