'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Search, 
  FileText, 
  Users, 
  BarChart3, 
  Settings,
  Activity
} from 'lucide-react';

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: Home },
  { name: '検索', href: '/search', icon: Search },
  { name: '文書管理', href: '/documents', icon: FileText },
  { name: '権限管理', href: '/permissions', icon: Users },
  { name: 'メトリクス', href: '/metrics', icon: BarChart3 },
  { name: 'ログ', href: '/logs', icon: Activity },
  { name: '設定', href: '/settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-white shadow-sm border-r border-gray-200">
      <div className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-netapp-blue text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
