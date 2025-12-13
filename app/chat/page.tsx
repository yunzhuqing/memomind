'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import AppHeader from '@/app/components/AppHeader';
import Chat from '../components/Chat';

export default function ChatPage() {
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

  const handleTabChange = (tab: 'notes' | 'files' | 'admin' | 'chat') => {
    switch (tab) {
      case 'notes':
        router.push('/notebook');
        break;
      case 'files':
        router.push('/files');
        break;
      case 'chat':
        router.push('/chat');
        break;
      case 'admin':
        router.push('/admin');
        break;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <AppHeader activeTab="chat" onTabChange={handleTabChange} />
      <Chat />
    </div>
  );
}
