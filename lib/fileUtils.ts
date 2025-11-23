/**
 * Get MIME type based on file extension
 */
export function getMimeType(ext: string): string {
  const extension = ext.toLowerCase();
  
  // Images
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.bmp') return 'image/bmp';
  if (extension === '.ico') return 'image/x-icon';
  
  // Videos
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.webm') return 'video/webm';
  if (extension === '.ogg') return 'video/ogg';
  if (extension === '.avi') return 'video/x-msvideo';
  if (extension === '.mov') return 'video/quicktime';
  if (extension === '.wmv') return 'video/x-ms-wmv';
  if (extension === '.flv') return 'video/x-flv';
  if (extension === '.mkv') return 'video/x-matroska';
  if (extension === '.m4v') return 'video/x-m4v';
  if (extension === '.mpg' || extension === '.mpeg') return 'video/mpeg';
  if (extension === '.3gp') return 'video/3gpp';
  if (extension === '.ts') return 'video/mp2t';
  if (extension === '.h264' || extension === '.h265') return 'video/h264';
  
  // Audio
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.ogg') return 'audio/ogg';
  if (extension === '.m4a') return 'audio/mp4';
  if (extension === '.flac') return 'audio/flac';
  if (extension === '.aac') return 'audio/aac';
  
  // Documents
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.txt') return 'text/plain';
  if (extension === '.md') return 'text/markdown';
  if (extension === '.html' || extension === '.htm') return 'text/html';
  if (extension === '.css') return 'text/css';
  if (extension === '.js') return 'application/javascript';
  if (extension === '.json') return 'application/json';
  if (extension === '.xml') return 'application/xml';
  
  // Microsoft Office
  if (extension === '.doc') return 'application/msword';
  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === '.xls') return 'application/vnd.ms-excel';
  if (extension === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === '.ppt') return 'application/vnd.ms-powerpoint';
  if (extension === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  
  // Archives
  if (extension === '.zip') return 'application/zip';
  if (extension === '.tar') return 'application/x-tar';
  if (extension === '.gz' || extension === '.gzip') return 'application/gzip';
  if (extension === '.7z') return 'application/x-7z-compressed';
  if (extension === '.rar') return 'application/x-rar-compressed';
  if (extension === '.bz2') return 'application/x-bzip2';
  
  // Executables
  if (extension === '.exe') return 'application/x-msdownload';
  if (extension === '.apk') return 'application/vnd.android.package-archive';
  if (extension === '.jar') return 'application/java-archive';
  
  // Disk images
  if (extension === '.iso') return 'application/x-iso9660-image';
  if (extension === '.dmg') return 'application/x-apple-diskimage';
  
  // Torrents
  if (extension === '.torrent') return 'application/x-bittorrent';
  
  // Default
  return 'application/octet-stream';
}

/**
 * Determine file type based on MIME type and file extension
 */
export function getFileType(mimeType: string, ext: string): string {
  // Images
  if (mimeType.startsWith('image/')) return 'image';
  
  // Videos
  if (mimeType.startsWith('video/')) return 'video';
  
  // Documents
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'text/plain' || ext === '.txt') return 'text';
  if (mimeType === 'text/markdown' || ext === '.md') return 'markdown';
  
  // Microsoft Office formats
  if (mimeType === 'application/vnd.ms-powerpoint' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ext === '.ppt' || ext === '.pptx') return 'presentation';
  
  if (mimeType === 'application/vnd.ms-excel' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ext === '.xls' || ext === '.xlsx') return 'spreadsheet';
  
  if (mimeType === 'application/msword' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.doc' || ext === '.docx') return 'document';
  
  // Compressed/Archive formats
  if (mimeType === 'application/zip' || ext === '.zip') return 'archive';
  if (mimeType === 'application/x-tar' || ext === '.tar') return 'archive';
  if (mimeType === 'application/gzip' || ext === '.gz' || ext === '.tar.gz' || ext === '.tgz') return 'archive';
  if (mimeType === 'application/x-7z-compressed' || ext === '.7z') return 'archive';
  if (mimeType === 'application/x-rar-compressed' || ext === '.rar') return 'archive';
  
  // Executable/Application formats
  if (mimeType === 'application/x-msdownload' || ext === '.exe') return 'executable';
  if (mimeType === 'application/vnd.android.package-archive' || ext === '.apk') return 'executable';
  if (mimeType === 'application/java-archive' || ext === '.jar') return 'executable';
  
  // Disk images
  if (mimeType === 'application/x-iso9660-image' || ext === '.iso') return 'disk-image';
  
  return 'other';
}
