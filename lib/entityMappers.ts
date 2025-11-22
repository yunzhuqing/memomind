// Helper functions to convert between camelCase and snake_case for API responses

import { File } from './entities/File';
import { Note } from './entities/Note';
import { Task } from './entities/Task';
import { Directory } from './entities/Directory';
import { User } from './entities/User';

export function mapFileToResponse(file: File) {
  return {
    id: file.id,
    user_id: file.userId,
    filename: file.filename,
    original_filename: file.originalFilename,
    file_path: file.filePath,
    file_type: file.fileType,
    file_size: file.fileSize,
    mime_type: file.mimeType,
    directory_path: file.directoryPath,
    thumbnail_key: file.thumbnailKey,
    created_at: file.createdAt,
    updated_at: file.updatedAt,
  };
}

export function mapNoteToResponse(note: Note) {
  return {
    id: note.id,
    user_id: note.userId,
    title: note.title,
    content: note.content,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

export function mapTaskToResponse(task: Task) {
  return {
    id: task.id,
    user_id: task.userId,
    type: task.type,
    name: task.name,
    status: task.status,
    progress: task.progress,
    total_size: task.totalSize,
    downloaded_size: task.downloadedSize,
    file_path: task.filePath,
    metadata: task.metadata,
    error_message: task.errorMessage,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt,
  };
}

export function mapDirectoryToResponse(directory: Directory) {
  return {
    id: directory.id,
    user_id: directory.userId,
    name: directory.name,
    path: directory.path,
    parent_path: directory.parentPath,
    created_at: directory.createdAt,
    updated_at: directory.updatedAt,
  };
}

export function mapUserToResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    team_id: user.teamId,
    address: user.address,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}
