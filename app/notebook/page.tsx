'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import AppHeader from '@/app/components/AppHeader';
import MarkdownEditor from '@/app/components/MarkdownEditor';

export default function NotebookPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader activeTab="notes" onTabChange={(tab) => {
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
        <MarkdownEditor userId={user.id} />
      </div>
    </div>
  );
}
