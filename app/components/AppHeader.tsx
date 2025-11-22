'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';

interface AppHeaderProps {
  activeTab: 'notes' | 'files' | 'admin';
  onTabChange: (tab: 'notes' | 'files' | 'admin') => void;
}

export default function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-indigo-600 text-white px-4 py-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-lg font-bold">MemoMind</h1>
            <p className="text-xs">Welcome, {user?.name}</p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1">
            <button
              onClick={() => onTabChange('notes')}
              className={`px-6 py-2 font-medium rounded-md transition-colors ${
                activeTab === 'notes'
                  ? 'bg-white text-indigo-600'
                  : 'bg-indigo-700 text-white hover:bg-indigo-500'
              }`}
            >
              Notebook
            </button>
            <button
              onClick={() => onTabChange('files')}
              className={`px-6 py-2 font-medium rounded-md transition-colors ${
                activeTab === 'files'
                  ? 'bg-white text-indigo-600'
                  : 'bg-indigo-700 text-white hover:bg-indigo-500'
              }`}
            >
              Files
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => onTabChange('admin')}
                className={`px-6 py-2 font-medium rounded-md transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-white text-indigo-600'
                    : 'bg-indigo-700 text-white hover:bg-indigo-500'
                }`}
              >
                Admin
              </button>
            )}
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="bg-indigo-700 hover:bg-indigo-800 px-3 py-1 text-sm rounded-md"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
