'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './contexts/AuthContext';
import Link from 'next/link';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/notebook');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">MemoMind</h1>
        <p className="text-2xl mb-8">Your Personal Markdown Notebook</p>
        <div className="space-x-4">
          <Link
            href="/login"
            className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 inline-block"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-800 inline-block"
          >
            Register
          </Link>
        </div>
        <div className="mt-12 text-lg">
          <p className="mb-2">✨ Write beautiful markdown notes</p>
          <p className="mb-2">📝 Organize your thoughts</p>
          <p>🔒 Secure user authentication</p>
        </div>
      </div>
    </div>
  );
}
