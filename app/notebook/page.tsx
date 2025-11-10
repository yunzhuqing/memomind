'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import MarkdownEditor from '@/app/components/MarkdownEditor';

export default function NotebookPage() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-2 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">MemoMind</h1>
          <p className="text-xs">Welcome, {user.name}</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-indigo-700 hover:bg-indigo-800 px-3 py-1 text-sm rounded-md"
        >
          Logout
        </button>
      </header>

      {/* Markdown Editor */}
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor userId={user.id} />
      </div>
    </div>
  );
}
