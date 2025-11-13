'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import MarkdownEditor from '@/app/components/MarkdownEditor';
import FileManager from '@/app/components/FileManager';

export default function NotebookPage() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'notes' | 'files'>('notes');

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

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'notes'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'files'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Files
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'notes' ? (
          <MarkdownEditor userId={user.id} />
        ) : (
          <FileManager userId={user.id} />
        )}
      </div>
    </div>
  );
}
