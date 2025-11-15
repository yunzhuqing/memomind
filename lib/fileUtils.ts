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
