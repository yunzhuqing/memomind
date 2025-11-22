'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
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
  ArrowDownTrayIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import TaskCenter, { UploadTask } from './TaskCenter';
import TorrentDialog from './TorrentDialog';

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
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItem | null>(null);
  const [moveDialogPath, setMoveDialogPath] = useState<string>('/');
  const [moveDialogDirectories, setMoveDialogDirectories] = useState<Directory[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>('/');
  const [showTorrentDialog, setShowTorrentDialog] = useState(false);

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

    // Use chunked upload for files larger than 10MB
    const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB chunks
    const USE_CHUNKED_UPLOAD = file.size > 10 * 1024 * 1024; // 10MB threshold

    if (USE_CHUNKED_UPLOAD) {
      await handleChunkedUpload(file);
    } else {
      await handleSimpleUpload(file);
    }

    // Reset input
    event.target.value = '';
  };

  const handleSimpleUpload = async (file: File) => {
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
        toast.success('File uploaded successfully!');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Upload failed');
    }
  };

  const handleChunkedUpload = async (file: File) => {
    const taskId = `upload_${Date.now()}_${Math.random()}`;
    
    try {
      // Initialize upload - server will calculate chunk size and total chunks
      const initFormData = new FormData();
      initFormData.append('action', 'init');
      initFormData.append('userId', userId);
      initFormData.append('filename', file.name);
      initFormData.append('fileType', file.type);
      initFormData.append('totalSize', file.size.toString());
      initFormData.append('directoryPath', currentPath);

      const initResponse = await fetch('/api/files/upload-chunk', {
        method: 'POST',
        body: initFormData,
      });

      const initData = await initResponse.json();
      if (!initData.success) {
        toast.error(initData.error || 'Failed to initialize upload');
        return;
      }

      const { sessionId, chunkSize, totalChunks, uploadedParts } = initData;
      const uploadedPartNumbers = new Set(uploadedParts || []);

      // Add task to task center
      const newTask: UploadTask = {
        id: taskId,
        filename: file.name,
        status: 'uploading',
        progress: 0,
        currentChunk: 0,
        totalChunks,
      };
      setUploadTasks(prev => [...prev, newTask]);

      // Upload chunks with progress
      let uploadedBytes = uploadedPartNumbers.size * chunkSize;
      
      for (let i = 0; i < totalChunks; i++) {
        const partNumber = i + 1;
        
        // Skip already uploaded parts (for resume)
        if (uploadedPartNumbers.has(partNumber)) {
          console.log(`Skipping part ${partNumber} (already uploaded)`);
          uploadedBytes += Math.min(chunkSize, file.size - (i * chunkSize));
          continue;
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const chunkFormData = new FormData();
        chunkFormData.append('action', 'upload');
        chunkFormData.append('sessionId', sessionId);
        chunkFormData.append('partNumber', partNumber.toString());
        chunkFormData.append('chunk', chunk);

        const chunkResponse = await fetch('/api/files/upload-chunk', {
          method: 'POST',
          body: chunkFormData,
        });

        const chunkData = await chunkResponse.json();
        if (!chunkData.success) {
          throw new Error(`Failed to upload chunk ${partNumber}`);
        }

        uploadedBytes += chunk.size;
        const progress = Math.round((uploadedBytes / file.size) * 100);
        console.log(`Upload progress: ${progress}% (${partNumber}/${totalChunks})`);
        
        // Update task progress
        setUploadTasks(prev => prev.map(task => 
          task.id === taskId 
            ? { ...task, progress, currentChunk: partNumber }
            : task
        ));
      }

      // Complete upload
      const completeFormData = new FormData();
      completeFormData.append('action', 'complete');
      completeFormData.append('sessionId', sessionId);

      const completeResponse = await fetch('/api/files/upload-chunk', {
        method: 'POST',
        body: completeFormData,
      });

      const completeData = await completeResponse.json();
      if (completeData.success) {
        loadFiles();
        // Mark task as completed
        setUploadTasks(prev => prev.map(task => 
          task.id === taskId 
            ? { ...task, status: 'completed', progress: 100 }
            : task
        ));
      } else {
        throw new Error(completeData.error || 'Failed to complete upload');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      // Mark task as failed
      setUploadTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'failed', error: (error as Error).message }
          : task
      ));
    }
  };

  const handleRemoveTask = (taskId: string) => {
    setUploadTasks(prev => prev.filter(task => task.id !== taskId));
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
        toast.success('File deleted successfully!');
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Delete failed');
    }
  };

  const handleDownloadFile = async (fileId: number, filename: string) => {
    try {
      const response = await fetch(`/api/files/download?fileId=${fileId}&userId=${userId}`);
      
      if (!response.ok) {
        toast.error('Download failed');
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
      toast.error('Please enter a folder name');
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
        toast.success('Folder created successfully!');
      } else {
        toast.error(data.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
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
        toast.success('Folder deleted successfully!');
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Delete failed');
    }
  };

  const loadMoveDialogDirectories = async (path: string) => {
    try {
      const params = new URLSearchParams({
        userId,
        parentPath: path,
      });

      const response = await fetch(`/api/directories?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setMoveDialogDirectories(data.directories);
      }
    } catch (error) {
      console.error('Error loading move dialog directories:', error);
    }
  };

  const handleMoveFile = async (file: FileItem) => {
    setFileToMove(file);
    setMoveDialogPath('/');
    setSelectedDestination('/');
    await loadMoveDialogDirectories('/');
    setShowMoveDialog(true);
  };

  const navigateToMoveDialogDirectory = async (path: string) => {
    setMoveDialogPath(path);
    setSelectedDestination(path);
    await loadMoveDialogDirectories(path);
  };

  const navigateMoveDialogUp = async () => {
    if (moveDialogPath === '/') return;
    const parts = moveDialogPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    setMoveDialogPath(newPath);
    setSelectedDestination(newPath);
    await loadMoveDialogDirectories(newPath);
  };

  const handleConfirmMove = async () => {
    if (!fileToMove) return;

    if (selectedDestination === fileToMove.directory_path) {
      toast.error('File is already in this directory');
      return;
    }

    try {
      const response = await fetch('/api/files', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: fileToMove.id,
          userId,
          newDirectoryPath: selectedDestination,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        loadFiles();
        setShowMoveDialog(false);
        setFileToMove(null);
        toast.success('File moved successfully!');
      } else {
        toast.error(data.error || 'Move failed');
      }
    } catch (error) {
      console.error('Error moving file:', error);
      toast.error('Move failed');
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

  const getFileIcon = (fileType: string, size: 'small' | 'large' = 'small') => {
    const iconClass = size === 'large' ? 'w-12 h-12' : 'w-6 h-6';
    switch (fileType) {
      case 'image':
        return <PhotoIcon className={`${iconClass} text-white`} />;
      case 'video':
        return <VideoCameraIcon className={`${iconClass} text-white`} />;
      case 'pdf':
        return <DocumentTextIcon className={`${iconClass} text-white`} />;
      case 'markdown':
      case 'text':
        return <DocumentIcon className={`${iconClass} text-white`} />;
      default:
        return <DocumentIcon className={`${iconClass} text-white`} />;
    }
  };

  const getThumbnailUrl = (fileId: number, useThumbnail: boolean = true) => {
    if (useThumbnail) {
      return `/api/files/download?fileId=${fileId}&userId=${userId}&thumbnail=true`;
    }
    return `/api/files/download?fileId=${fileId}&userId=${userId}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Modern Header */}
      <div className="px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              File Manager
            </h2>
            <p className="text-sm text-gray-500 mt-1">Manage your files and folders</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowNewFolderDialog(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-sm font-medium"
            >
              <FolderPlusIcon className="w-4 h-4" />
              New Folder
            </button>
            <button
              onClick={() => setShowTorrentDialog(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-sm font-medium"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Torrent
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 cursor-pointer transition-all shadow-md hover:shadow-lg text-sm font-medium">
              <ArrowUpTrayIcon className="w-4 h-4" />
              Upload
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          {currentPath !== '/' && (
            <button
              onClick={navigateUp}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Path:</span>
            <span className="font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
              {currentPath}
            </span>
          </div>
        </div>

        {/* Search, Filter and View Toggle */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium text-gray-700"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="pdf">PDF</option>
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
          </select>
          
          {/* View Mode Toggle */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="List view"
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Grid view"
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-sm">Loading...</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {/* Directories - Grid */}
            {directories.map((dir) => (
              <div
                key={dir.id}
                className="group relative"
              >
                <div
                  className="flex flex-col items-center p-4 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-2xl hover:bg-white hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all duration-200 aspect-square"
                  onClick={() => navigateToDirectory(dir.path)}
                >
                  <div className="flex-1 flex items-center justify-center">
                    <div className="p-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-sm">
                      <FolderIcon className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <div className="w-full text-center mt-3">
                    <div className="font-semibold text-gray-900 text-sm truncate">{dir.name}</div>
                    <div className="text-xs text-gray-500 mt-1">Folder</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDirectory(dir.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 bg-white text-red-500 hover:bg-red-50 rounded-lg shadow-md transition-all"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Files - Grid */}
            {files.map((file) => (
              <div
                key={file.id}
                className="group relative"
              >
                <div 
                  className="flex flex-col items-center p-4 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-2xl hover:bg-white hover:shadow-md hover:border-indigo-200 transition-all duration-200 aspect-square overflow-hidden cursor-pointer"
                  onClick={() => {
                    if (file.file_type === 'image' || file.file_type === 'video') {
                      setPreviewFile(file);
                    }
                  }}
                >
                  <div className="flex-1 flex items-center justify-center w-full">
                    {file.file_type === 'image' ? (
                      <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl">
                        <img
                          src={getThumbnailUrl(file.id, true)}
                          alt={file.original_filename}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback to icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                        <div className="hidden p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-sm">
                          {getFileIcon(file.file_type, 'large')}
                        </div>
                      </div>
                    ) : file.file_type === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-xl relative">
                        <img
                          src={getThumbnailUrl(file.id, true)}
                          alt={file.original_filename}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback to icon if thumbnail fails to load
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                        <div className="hidden p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-sm">
                          {getFileIcon(file.file_type, 'large')}
                        </div>
                        {/* Play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="p-3 bg-black/50 rounded-full">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-sm">
                        {getFileIcon(file.file_type, 'large')}
                      </div>
                    )}
                  </div>
                  <div className="w-full text-center mt-3">
                    <div className="font-semibold text-gray-900 text-sm truncate" title={file.original_filename}>
                      {file.original_filename}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatFileSize(file.file_size)}
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button
                    onClick={() => handleMoveFile(file)}
                    className="p-2 bg-white text-green-600 hover:bg-green-50 rounded-lg shadow-md transition-all"
                    title="Move"
                  >
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownloadFile(file.id, file.original_filename)}
                    className="p-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-lg shadow-md transition-all"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-2 bg-white text-red-500 hover:bg-red-50 rounded-lg shadow-md transition-all"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {directories.length === 0 && files.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <DocumentIcon className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No files or folders found</p>
                <p className="text-gray-400 text-sm mt-1">Upload files to get started</p>
              </div>
            )}
          </div>
        ) : (
          /* List View */
          <div className="grid grid-cols-1 gap-2">
            {/* Directories */}
            {directories.map((dir) => (
              <div
                key={dir.id}
                className="group flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-2xl hover:bg-white hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all duration-200"
              >
                <div
                  className="flex items-center gap-4 flex-1"
                  onClick={() => navigateToDirectory(dir.path)}
                >
                  <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-sm">
                    <FolderIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{dir.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Folder</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDirectory(dir.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))}

            {/* Files */}
            {files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-2xl hover:bg-white hover:shadow-md hover:border-indigo-200 transition-all duration-200"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm flex-shrink-0">
                    {getFileIcon(file.file_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">{file.original_filename}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMoveFile(file)}
                    className="p-2.5 text-green-600 hover:bg-green-50 rounded-xl transition-all"
                    title="Move"
                  >
                    <ArrowRightIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDownloadFile(file.id, file.original_filename)}
                    className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {directories.length === 0 && files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <DocumentIcon className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No files or folders found</p>
                <p className="text-gray-400 text-sm mt-1">Upload files to get started</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Center */}
      <TaskCenter tasks={uploadTasks} onRemoveTask={handleRemoveTask} />

      {/* Media Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <button
            onClick={() => setPreviewFile(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
          >
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>
          
          <div className="max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            {previewFile.file_type === 'image' ? (
              <img
                src={getThumbnailUrl(previewFile.id, false)}
                alt={previewFile.original_filename}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : previewFile.file_type === 'video' ? (
              <video
                src={getThumbnailUrl(previewFile.id, false)}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg"
              >
                Your browser does not support the video tag.
              </video>
            ) : null}
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3">
            <p className="text-white font-medium text-center">{previewFile.original_filename}</p>
            <p className="text-white/70 text-sm text-center mt-1">{formatFileSize(previewFile.file_size)}</p>
          </div>
        </div>
      )}

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Create New Folder</h3>
            <p className="text-sm text-gray-500 mb-6">Enter a name for your new folder</p>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNewFolderDialog(false);
                  setNewFolderName('');
                }}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Torrent Dialog */}
      {showTorrentDialog && (
        <TorrentDialog
          userId={userId}
          currentPath={currentPath}
          onClose={() => setShowTorrentDialog(false)}
          onDownloadComplete={() => {
            loadFiles();
            loadDirectories();
          }}
        />
      )}

      {/* Move File Dialog */}
      {showMoveDialog && fileToMove && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Move File</h3>
            <p className="text-sm text-gray-500 mb-4">
              Moving: <span className="font-semibold text-gray-900">{fileToMove.original_filename}</span>
            </p>
            
            {/* Breadcrumb for move dialog */}
            <div className="flex items-center gap-2 mb-4">
              {moveDialogPath !== '/' && (
                <button
                  onClick={navigateMoveDialogUp}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
                </button>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Current:</span>
                <span className="font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                  {moveDialogPath}
                </span>
              </div>
            </div>

            {/* Select current directory button */}
            <button
              onClick={() => setSelectedDestination(moveDialogPath)}
              className={`w-full flex items-center gap-3 p-3 mb-2 rounded-xl border-2 transition-all ${
                selectedDestination === moveDialogPath
                  ? 'bg-green-50 border-green-500'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                selectedDestination === moveDialogPath ? 'bg-green-100' : 'bg-white'
              }`}>
                <FolderIcon className={`w-5 h-5 ${
                  selectedDestination === moveDialogPath ? 'text-green-600' : 'text-gray-600'
                }`} />
              </div>
              <div className="flex-1 text-left">
                <div className={`font-semibold ${
                  selectedDestination === moveDialogPath ? 'text-green-900' : 'text-gray-900'
                }`}>
                  Move to this folder
                </div>
                <div className="text-xs text-gray-500">{moveDialogPath}</div>
              </div>
              {selectedDestination === moveDialogPath && (
                <div className="w-2 h-2 bg-green-600 rounded-full flex-shrink-0"></div>
              )}
            </button>

            <p className="text-sm text-gray-500 mb-2">Or navigate to a subfolder:</p>
            
            {/* Directory list */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl mb-6">
              {moveDialogDirectories.length > 0 ? (
                moveDialogDirectories.map((dir) => (
                  <button
                    key={dir.id}
                    onClick={() => navigateToMoveDialogDirectory(dir.path)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-all"
                  >
                    <FolderIcon className="w-5 h-5 flex-shrink-0 text-yellow-500" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{dir.name}</div>
                      <div className="text-xs text-gray-500 truncate">{dir.path}</div>
                    </div>
                    <ArrowRightIcon className="w-4 h-4 text-gray-400" />
                  </button>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No subfolders in this directory
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowMoveDialog(false);
                  setFileToMove(null);
                }}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMove}
                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                Move File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
