'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import AppHeader from '@/app/components/AppHeader';
import UserManagement from '@/app/components/UserManagement';

export default function AdminPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && user && user.role !== 'admin') {
      // 如果不是管理员，重定向到文件页面
      router.push('/files');
    }
  }, [loading, isAuthenticated, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // 如果不是管理员，显示无权限提示
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader activeTab="admin" onTabChange={(tab) => {
        if (tab === 'notes') {
          router.push('/notebook');
        } else if (tab === 'files') {
          router.push('/files');
        } else if (tab === 'chat') {
          router.push('/chat');
        } else if (tab === 'admin') {
          router.push('/admin');
        }
      }} />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <UserManagement currentUserId={user.id} />
      </div>
    </div>
  );
}
