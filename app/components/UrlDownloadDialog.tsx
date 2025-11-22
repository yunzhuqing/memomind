'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

interface UrlDownloadDialogProps {
  userId: string;
  currentPath: string;
  onClose: () => void;
  onDownloadComplete: () => void;
}

export default function UrlDownloadDialog({
  userId,
  currentPath,
  onClose,
  onDownloadComplete,
}: UrlDownloadDialogProps) {
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      toast.error('Please enter a valid URL');
      return;
    }

    setDownloading(true);
    try {
      const response = await fetch('/api/download/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          url: url.trim(),
          directoryPath: currentPath,
          filename: filename.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Download started!');
        onDownloadComplete();
        onClose();
      } else {
        toast.error(data.error || 'Download failed');
      }
    } catch (error) {
      console.error('Error downloading from URL:', error);
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Download from URL</h3>
            <p className="text-sm text-gray-500 mt-1">
              Enter a direct link to download a file
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <LinkIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                placeholder="https://example.com/file.pdf"
                disabled={downloading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter a direct download link (HTTP/HTTPS)
            </p>
          </div>

          {/* Filename Input (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Filename <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
              placeholder="my-file.pdf"
              disabled={downloading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use filename from URL
            </p>
          </div>

          {/* Current Path Info */}
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Download to:</span> {currentPath}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={onClose}
              disabled={downloading}
              className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading || !url.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              {downloading ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </div>

        {/* Examples */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">Examples:</p>
          <div className="space-y-1">
            <button
              onClick={() => setUrl('https://example.com/sample.pdf')}
              className="block text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
              disabled={downloading}
            >
              https://example.com/sample.pdf
            </button>
            <button
              onClick={() => setUrl('https://example.com/image.jpg')}
              className="block text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
              disabled={downloading}
            >
              https://example.com/image.jpg
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
