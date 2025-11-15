'use client';

import { useState } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export interface UploadTask {
  id: string;
  filename: string;
  status: 'uploading' | 'completed' | 'failed';
  progress: number;
  currentChunk: number;
  totalChunks: number;
  error?: string;
}

interface TaskCenterProps {
  tasks: UploadTask[];
  onRemoveTask: (taskId: string) => void;
}

export default function TaskCenter({ tasks, onRemoveTask }: TaskCenterProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  if (tasks.length === 0) return null;

  const activeTasks = tasks.filter(t => t.status === 'uploading');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b cursor-pointer hover:bg-gray-50"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Upload Tasks</h3>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
            {activeTasks.length} active
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(!isMinimized);
          }}
          className="text-gray-500 hover:text-gray-700"
        >
          {isMinimized ? (
            <ChevronUpIcon className="w-5 h-5" />
          ) : (
            <ChevronDownIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Task List */}
      {!isMinimized && (
        <div className="max-h-96 overflow-y-auto">
          {/* Active Tasks */}
          {activeTasks.length > 0 && (
            <div className="p-4 space-y-3">
              {activeTasks.map((task) => (
                <div key={task.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {task.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        Chunk {task.currentChunk} of {task.totalChunks}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemoveTask(task.id)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Progress</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="border-t">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-between"
              >
                <span>Completed ({completedTasks.length})</span>
                {isExpanded ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>
              {isExpanded && (
                <div className="p-4 space-y-2">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2 bg-green-50 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {task.filename}
                        </p>
                        <p className="text-xs text-green-600">Completed</p>
                      </div>
                      <button
                        onClick={() => onRemoveTask(task.id)}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Failed Tasks */}
          {failedTasks.length > 0 && (
            <div className="border-t p-4 space-y-2">
              {failedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2 bg-red-50 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {task.filename}
                    </p>
                    <p className="text-xs text-red-600">
                      {task.error || 'Upload failed'}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveTask(task.id)}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
