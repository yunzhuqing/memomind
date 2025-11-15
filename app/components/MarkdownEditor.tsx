'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function MarkdownEditor({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    // Load notes from API
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes', {
          headers: {
            'x-user-id': userId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes);
          if (data.notes.length > 0) {
            setCurrentNote(data.notes[0]);
            setContent(data.notes[0].content);
            setTitle(data.notes[0].title);
          }
        }
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      }
    };

    fetchNotes();
  }, [userId]);

  const saveNote = useCallback(async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    const loadingToast = toast.loading('Saving note...');

    try {
      if (currentNote) {
        // Update existing note
        const response = await fetch('/api/notes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            id: currentNote.id,
            title,
            content,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const updatedNotes = notes.map((note) =>
            note.id === currentNote.id ? data.note : note
          );
          setNotes(updatedNotes);
          setCurrentNote(data.note);
          toast.success('Note updated successfully!', { id: loadingToast });
        } else {
          toast.error('Failed to update note', { id: loadingToast });
        }
      } else {
        // Create new note
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            title,
            content,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const updatedNotes = [data.note, ...notes];
          setNotes(updatedNotes);
          setCurrentNote(data.note);
          toast.success('Note created successfully!', { id: loadingToast });
        } else {
          toast.error('Failed to create note', { id: loadingToast });
        }
      }
    } catch (error) {
      console.error('Save note error:', error);
      toast.error('Failed to save note', { id: loadingToast });
    }
  }, [title, content, currentNote, notes, userId]);

  const createNewNote = useCallback(() => {
    setCurrentNote(null);
    setTitle('');
    setContent('');
  }, []);

  const selectNote = useCallback((note: Note) => {
    setCurrentNote(note);
    setTitle(note.title);
    setContent(note.content);
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notes?id=${noteId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        },
      });

      if (response.ok) {
        const updatedNotes = notes.filter((note) => note.id !== noteId);
        setNotes(updatedNotes);

        if (currentNote?.id === noteId) {
          if (updatedNotes.length > 0) {
            setCurrentNote(updatedNotes[0]);
            setTitle(updatedNotes[0].title);
            setContent(updatedNotes[0].content);
          } else {
            setCurrentNote(null);
            setTitle('');
            setContent('');
          }
        }
        toast.success('Note deleted successfully!');
      } else {
        toast.error('Failed to delete note');
      }
    } catch (error) {
      console.error('Delete note error:', error);
      toast.error('Failed to delete note');
    }
  }, [notes, currentNote, userId]);

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-50 to-gray-100 relative">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-white border-r border-gray-200 overflow-y-auto shadow-sm transition-all duration-300 ease-in-out`}>
        <div className={`p-4 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
          <button
            onClick={createNewNote}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 mb-4 font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Note
          </button>
          <h3 className="text-lg font-bold mb-3 text-gray-800">My Notes</h3>
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  currentNote?.id === note.id 
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-sm' 
                    : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div onClick={() => selectNote(note)}>
                  <h4 className="font-semibold truncate text-gray-900">{note.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="text-red-500 text-xs mt-2 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              </div>
            ))}
            {notes.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No notes yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-gray-300 rounded-r-lg p-2 shadow-md hover:bg-gray-50 transition-all"
        style={{ left: isSidebarOpen ? '256px' : '0px' }}
        title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        <svg 
          className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="Note Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-3xl font-bold border-none focus:outline-none text-gray-900 placeholder-gray-300"
            />
            <button
              onClick={saveNote}
              className="ml-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:from-indigo-700 hover:to-purple-700 font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Note
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6" data-color-mode="light">
          <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              height="100%"
              preview="live"
              hideToolbar={false}
              enableScroll={true}
              visibleDragbar={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
