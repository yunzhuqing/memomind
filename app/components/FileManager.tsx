'use client';

import { useState, useEffect } from 'react';
import { 
  FolderIcon, 
  DocumentIcon, 
  PhotoIcon, 
  VideoCameraIcon,
  DocumentTextIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  FolderPlusIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface FileItem {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  directory_path: string;
  created_at: string;
}

interface Directory {
  id: number;
  name: string;
  path: string;
  parent_path: string;
}

interface FileManagerProps {
  userId: string;
}

export default function FileManager({ userId }: FileManagerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadFiles();
    loadDirectories();
  }, [currentPath, searchQuery, fileTypeFilter]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId,
        directoryPath: currentPath,
        ...(searchQuery && { search: searchQuery }),
        ...(fileTypeFilter !== 'all' && { fileType: fileTypeFilter }),
      });

      const response = await fetch(`/api/files?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectories = async () => {
    try {
      const params = new URLSearchParams({
        userId,
        parentPath: currentPath,
      });

      const response = await fetch(`/api/directories?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setDirectories(data.directories);
      }
    } catch (error) {
      console.error('Error loading directories:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('directoryPath', currentPath);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        loadFiles();
        alert('File uploaded successfully!');
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Upload failed');
    }

    // Reset input
    event.target.value = '';
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/files?fileId=${fileId}&userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        loadFiles();
        alert('File deleted successfully!');
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Delete failed');
    }
  };

  const handleDownloadFile = async (fileId: number, filename: string) => {
    try {
      const response = await fetch(`/api/files/download?fileId=${fileId}&userId=${userId}`);
      
      if (!response.ok) {
        alert('Download failed');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Download failed');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('Please enter a folder name');
      return;
    }

    try {
      const response = await fetch('/api/directories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          name: newFolderName,
          parentPath: currentPath,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        loadDirectories();
        setShowNewFolderDialog(false);
        setNewFolderName('');
        alert('Folder created successfully!');
      } else {
        alert(data.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    }
  };

  const handleDeleteDirectory = async (directoryId: number) => {
    if (!confirm('Are you sure you want to delete this folder?')) return;

    try {
      const response = await fetch(`/api/directories?directoryId=${directoryId}&userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        loadDirectories();
        alert('Folder deleted successfully!');
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Delete failed');
    }
  };

  const navigateToDirectory = (path: string) => {
    setCurrentPath(path);
    setSearchQuery('');
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    setCurrentPath(newPath);
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return <PhotoIcon className="w-6 h-6 text-blue-500" />;
      case 'video':
        return <VideoCameraIcon className="w-6 h-6 text-purple-500" />;
      case 'pdf':
        return <DocumentTextIcon className="w-6 h-6 text-red-500" />;
      case 'markdown':
      case 'text':
        return <DocumentIcon className="w-6 h-6 text-gray-500" />;
      default:
        return <DocumentIcon className="w-6 h-6 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">File Manager</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewFolderDialog(true)}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              <FolderPlusIcon className="w-4 h-4" />
              New Folder
            </button>
            <label className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer text-sm">
              <ArrowUpTrayIcon className="w-4 h-4" />
              Upload File
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,video/*,.pdf,.txt,.md"
              />
            </label>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          {currentPath !== '/' && (
            <button
              onClick={navigateUp}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
          )}
          <div className="text-sm text-gray-600">
            Current: <span className="font-medium">{currentPath}</span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
            />
          </div>
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="pdf">PDF</option>
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-2">
            {/* Directories */}
            {directories.map((dir) => (
              <div
                key={dir.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <div
                  className="flex items-center gap-3 flex-1"
                  onClick={() => navigateToDirectory(dir.path)}
                >
                  <FolderIcon className="w-6 h-6 text-yellow-500" />
                  <div>
                    <div className="font-medium">{dir.name}</div>
                    <div className="text-xs text-gray-500">Folder</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDirectory(dir.id);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))}

            {/* Files */}
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getFileIcon(file.file_type)}
                  <div>
                    <div className="font-medium">{file.original_filename}</div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadFile(file.id, file.original_filename)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {directories.length === 0 && files.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No files or folders found
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewFolderDialog(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
