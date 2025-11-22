'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  DocumentIcon,
  LinkIcon,
  CloudArrowDownIcon,
} from '@heroicons/react/24/outline';

interface TorrentFile {
  index: number;
  name: string;
  path: string;
  length: number;
  offset: number;
}

interface TorrentInfo {
  name: string;
  infoHash: string;
  length: number;
  files: TorrentFile[];
  announce: string[];
  isMagnetUri?: boolean;
  note?: string;
}

interface TorrentDialogProps {
  userId: string;
  currentPath: string;
  onClose: () => void;
  onDownloadComplete: () => void;
}

export default function TorrentDialog({
  userId,
  currentPath,
  onClose,
  onDownloadComplete,
}: TorrentDialogProps) {
  const [inputMethod, setInputMethod] = useState<'file' | 'magnet'>('magnet');
  const [magnetUri, setMagnetUri] = useState('');
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleParseTorrent = async () => {
    if (!magnetUri && !torrentFile) {
      toast.error('Please provide a magnet URI or torrent file');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (torrentFile) {
        formData.append('file', torrentFile);
      } else {
        formData.append('magnetUri', magnetUri);
      }

      const response = await fetch('/api/torrent/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setTorrentInfo(data.torrent);
        // Select all files by default (if files are available)
        if (data.torrent.files && data.torrent.files.length > 0) {
          setSelectedFiles(data.torrent.files.map((_: any, index: number) => index));
        }
        
        if (data.torrent.isMagnetUri && data.torrent.files.length === 0) {
          toast.success('Magnet URI parsed! File info will be retrieved when download starts.');
        } else {
          toast.success('Torrent parsed successfully!');
        }
      } else {
        toast.error(data.error || 'Failed to parse torrent');
      }
    } catch (error) {
      console.error('Error parsing torrent:', error);
      toast.error('Failed to parse torrent');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!torrentInfo) return;

    // For magnet URIs without file info, allow download without file selection
    if (!torrentInfo.isMagnetUri && selectedFiles.length === 0) {
      toast.error('Please select at least one file to download');
      return;
    }

    setDownloading(true);
    try {
      let torrentFileBase64 = null;
      if (torrentFile) {
        const buffer = await torrentFile.arrayBuffer();
        torrentFileBase64 = Buffer.from(buffer).toString('base64');
      }

      const response = await fetch('/api/torrent/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          magnetUri: magnetUri || null,
          torrentFile: torrentFileBase64,
          selectedFiles,
          directoryPath: currentPath,
          torrentName: torrentInfo?.name || 'Unknown Torrent',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Download completed!');
        onDownloadComplete();
        onClose();
      } else {
        toast.error(data.error || 'Download failed');
      }
    } catch (error) {
      console.error('Error downloading torrent:', error);
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const toggleFileSelection = (index: number) => {
    setSelectedFiles((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === torrentInfo?.files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(torrentInfo?.files.map((_, index) => index) || []);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl transform transition-all flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Torrent Download</h3>
            <p className="text-sm text-gray-500 mt-1">
              {torrentInfo ? 'Select files to download' : 'Add a torrent file or magnet link'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {!torrentInfo ? (
          <div className="space-y-4">
            {/* Input Method Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setInputMethod('magnet')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                  inputMethod === 'magnet'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LinkIcon className="w-4 h-4 inline mr-2" />
                Magnet Link
              </button>
              <button
                onClick={() => setInputMethod('file')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                  inputMethod === 'file'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <DocumentIcon className="w-4 h-4 inline mr-2" />
                Torrent File
              </button>
            </div>

            {inputMethod === 'magnet' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magnet URI
                </label>
                <textarea
                  value={magnetUri}
                  onChange={(e) => setMagnetUri(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-gray-900"
                  rows={4}
                  placeholder="magnet:?xt=urn:btih:..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Torrent File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors">
                  <input
                    type="file"
                    accept=".torrent"
                    onChange={(e) => setTorrentFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="torrent-file-input"
                  />
                  <label
                    htmlFor="torrent-file-input"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <CloudArrowDownIcon className="w-12 h-12 text-gray-400 mb-3" />
                    {torrentFile ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{torrentFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatFileSize(torrentFile.size)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Click to select a .torrent file
                        </p>
                        <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={handleParseTorrent}
              disabled={loading || (!magnetUri && !torrentFile)}
              className="w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Parsing...' : 'Parse Torrent'}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Torrent Info */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">{torrentInfo.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Info Hash:</span>
                  <span className="ml-2 font-mono text-xs text-gray-900">
                    {torrentInfo.infoHash.substring(0, 16)}...
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Files:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {torrentInfo.files.length > 0 ? torrentInfo.files.length : 'Unknown'}
                  </span>
                </div>
              </div>
              {torrentInfo.note && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">{torrentInfo.note}</p>
                </div>
              )}
            </div>

            {torrentInfo.files.length > 0 ? (
              <>
                {/* File Selection */}
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFiles.length === torrentInfo.files.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All ({selectedFiles.length}/{torrentInfo.files.length})
                    </span>
                  </label>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl mb-4">
                  {torrentInfo.files.map((file) => (
                    <label
                      key={file.index}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.index)}
                        onChange={() => toggleFileSelection(file.index)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 flex-shrink-0"
                      />
                      <DocumentIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate text-sm">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">{formatFileSize(file.length)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center border border-gray-200 rounded-xl mb-4 p-8">
                <div className="text-center">
                  <LinkIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">Magnet URI Ready</p>
                  <p className="text-xs text-gray-500">
                    File information will be retrieved when download starts
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setTorrentInfo(null)}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Back
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading || (!torrentInfo.isMagnetUri && selectedFiles.length === 0)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                {downloading 
                  ? 'Downloading...' 
                  : torrentInfo.isMagnetUri && torrentInfo.files.length === 0
                    ? 'Start Download'
                    : `Download (${selectedFiles.length})`
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
